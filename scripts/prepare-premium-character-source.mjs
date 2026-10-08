import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import {
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createWedgeGeometry,
} from './lib/hard-surface-geometry.mjs';

export const PREMIUM_CHARACTER_SOURCE_RELATIVE_PATH = 'operators/operator-premium-source-reference-lod0.glb';
const GENERATOR = 'Ironshade Vector deterministic premium character source generator';
const TEXTURE_SIZE = 8;

function pad(buffer, multiple, fill = 0) {
  const remainder = buffer.length % multiple;
  return remainder === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(multiple - remainder, fill)]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return out;
}

function pngRgba(width, height, pixels) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      raw[row + 1 + x * 4] = pixels[source];
      raw[row + 2 + x * 4] = pixels[source + 1];
      raw[row + 3 + x * 4] = pixels[source + 2];
      raw[row + 4 + x * 4] = pixels[source + 3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function texturePixels(kind) {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const index = (y * TEXTURE_SIZE + x) * 4;
      const checker = (x + y) % 2;
      const stripe = (x === 1 || x === 6 || y === 2) ? 1 : 0;
      let rgba;
      if (kind === 'base-color') rgba = checker ? [50, 69, 72, 255] : [30, 45, 50, 255];
      else if (kind === 'normal') rgba = stripe ? [142, 118, 247, 255] : [128, 128, 255, 255];
      else if (kind === 'orm') rgba = stripe ? [212, 104, 196, 255] : [236, 146, 176, 255];
      else rgba = stripe ? [45, 224, 255, 255] : [0, 10, 13, 255];
      pixels.set(rgba, index);
    }
  }
  return pixels;
}

function centered(geometry) {
  const minY = geometry.min[1];
  const maxY = geometry.max[1];
  const offsetY = -((minY + maxY) / 2);
  const positions = new Float32Array(geometry.positions);
  for (let index = 1; index < positions.length; index += 3) positions[index] += offsetY;
  return {
    ...geometry,
    positions,
    min: [geometry.min[0], geometry.min[1] + offsetY, geometry.min[2]],
    max: [geometry.max[0], geometry.max[1] + offsetY, geometry.max[2]],
  };
}

function bytes(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

function packBinary(parts) {
  const chunks = [];
  const views = [];
  let offset = 0;
  for (const part of parts) {
    const aligned = (offset + 3) & ~3;
    if (aligned > offset) chunks.push(Buffer.alloc(aligned - offset));
    offset = aligned;
    const payload = Buffer.isBuffer(part) ? part : bytes(part);
    views.push({ byteOffset: offset, byteLength: payload.length });
    chunks.push(payload);
    offset += payload.length;
  }
  return { buffer: Buffer.concat(chunks), views };
}

function encodeGlb(gltf, binary) {
  const json = pad(Buffer.from(JSON.stringify(gltf), 'utf8'), 4, 0x20);
  const bin = pad(binary, 4, 0);
  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, bin]);
}

function buildNodes() {
  const nodes = [];
  const add = node => { nodes.push(node); return nodes.length - 1; };

  const leftLegShell = add({ name: 'leg-left-shell', mesh: 0, translation: [0.02, -0.39, 0], scale: [0.23, 0.78, 0.24] });
  const leftBoot = add({ name: 'boot-left', mesh: 2, translation: [0.13, -0.83, 0], scale: [0.44, 0.18, 0.32] });
  const leftLeg = add({ name: 'leg-left', translation: [0, 0, 0.18], children: [leftLegShell, leftBoot] });
  const rightLegShell = add({ name: 'leg-right-shell', mesh: 0, translation: [0.02, -0.39, 0], scale: [0.23, 0.78, 0.24] });
  const rightBoot = add({ name: 'boot-right', mesh: 2, translation: [0.13, -0.83, 0], scale: [0.44, 0.18, 0.32] });
  const rightLeg = add({ name: 'leg-right', translation: [0, 0, -0.18], children: [rightLegShell, rightBoot] });

  const leftArmUpper = add({ name: 'arm-left-upper', mesh: 0, translation: [0, -0.19, 0], scale: [0.18, 0.40, 0.18] });
  const leftGauntlet = add({ name: 'gauntlet-left', mesh: 1, translation: [0.08, -0.43, 0], scale: [0.28, 0.22, 0.22] });
  const leftArm = add({ name: 'arm-left', translation: [0.02, 0.42, 0.40], children: [leftArmUpper, leftGauntlet] });
  const rightArmUpper = add({ name: 'arm-right-upper', mesh: 0, translation: [0, -0.19, 0], scale: [0.18, 0.40, 0.18] });
  const rightGauntlet = add({ name: 'gauntlet-right', mesh: 1, translation: [0.08, -0.43, 0], scale: [0.28, 0.22, 0.22] });
  const rightArm = add({ name: 'arm-right', translation: [0.02, 0.42, -0.40], children: [rightArmUpper, rightGauntlet] });

  const backpackCore = add({ name: 'backpack-core', mesh: 2, translation: [-0.18, 0.02, 0], scale: [0.24, 0.48, 0.46] });
  const thrusterLeft = add({ name: 'thruster-left', mesh: 4, translation: [-0.26, -0.22, 0.16], scale: [0.12, 0.24, 0.10] });
  const thrusterRight = add({ name: 'thruster-right', mesh: 4, translation: [-0.26, -0.22, -0.16], scale: [0.12, 0.24, 0.10] });
  const backpack = add({ name: 'backpack', translation: [-0.18, 0.18, 0], children: [backpackCore, thrusterLeft, thrusterRight] });

  const helmetShell = add({ name: 'helmet-shell', mesh: 0, translation: [0, 0, 0], scale: [0.48, 0.50, 0.46] });
  const helmetVisor = add({ name: 'helmet-visor', mesh: 3, translation: [0.26, -0.02, 0], scale: [0.10, 0.20, 0.34] });
  const helmetLamp = add({ name: 'helmet-lamp', mesh: 4, translation: [0.08, 0.25, -0.20], scale: [0.10, 0.07, 0.07] });
  const helmet = add({ name: 'helmet', translation: [0.02, 0.73, 0], children: [helmetShell, helmetVisor, helmetLamp] });

  const torsoSuit = add({ name: 'torso-suit', mesh: 5, translation: [0, 0, 0], scale: [0.56, 0.68, 0.56] });
  const chestPlate = add({ name: 'chest-plate', mesh: 6, translation: [0.25, 0.05, 0], scale: [0.14, 0.44, 0.44] });
  const chestStatus = add({ name: 'chest-status', mesh: 4, translation: [0.31, 0.10, -0.13], scale: [0.04, 0.09, 0.11] });

  const toolBarrel = add({
    name: 'source-reference-tool-barrel',
    mesh: 7,
    translation: [0.30, 0, 0],
    rotation: [0, 0, -0.7071067811865475, 0.7071067811865476],
    scale: [0.10, 0.60, 0.10],
  });
  const toolGuard = add({ name: 'source-reference-tool-guard', mesh: 8, translation: [0.16, 0.04, 0], scale: [0.16, 0.20, 0.24] });
  const tool = add({ name: 'source-reference-tool', children: [toolBarrel, toolGuard] });
  const weaponSocket = add({ name: 'weapon-socket', translation: [0.20, 0.18, -0.24], children: [tool] });

  const torso = add({ name: 'torso', translation: [0, 0.32, 0], children: [torsoSuit, chestPlate, chestStatus, helmet, leftArm, rightArm, backpack, weaponSocket] });
  const hipArmor = add({ name: 'hip-armor', mesh: 1, translation: [0, 0, 0], scale: [0.48, 0.20, 0.48] });
  const hip = add({ name: 'hip', translation: [0, 0.91, 0], children: [hipArmor, torso, leftLeg, rightLeg] });
  const rig = add({ name: 'operator-rig', children: [hip] });
  return { nodes, rig };
}

export function buildPremiumCharacterSourceGlb() {
  const geometries = [
    centered(createCylinderGeometry({ radius: 0.5, height: 1, segments: 20 })),
    centered(createChamferedBoxGeometry({ width: 1, height: 1, depth: 1, chamfer: 0.18 })),
    centered(createWedgeGeometry({ width: 1, height: 1, depth: 1 })),
  ];
  const textures = [
    pngRgba(TEXTURE_SIZE, TEXTURE_SIZE, texturePixels('base-color')),
    pngRgba(TEXTURE_SIZE, TEXTURE_SIZE, texturePixels('normal')),
    pngRgba(TEXTURE_SIZE, TEXTURE_SIZE, texturePixels('orm')),
    pngRgba(TEXTURE_SIZE, TEXTURE_SIZE, texturePixels('emissive')),
  ];
  const parts = [];
  for (const geometry of geometries) parts.push(geometry.positions, geometry.normals, geometry.tangents, geometry.uvs, geometry.indices);
  parts.push(...textures);
  const packed = packBinary(parts);

  const bufferViews = packed.views.map((view, index) => ({
    buffer: 0,
    byteOffset: view.byteOffset,
    byteLength: view.byteLength,
    ...(index < geometries.length * 5 ? { target: index % 5 === 4 ? 34963 : 34962 } : {}),
  }));
  const accessors = [];
  for (let slot = 0; slot < geometries.length; slot += 1) {
    const geometry = geometries[slot];
    const viewBase = slot * 5;
    accessors.push(
      { bufferView: viewBase, componentType: 5126, count: geometry.positions.length / 3, type: 'VEC3', min: geometry.min, max: geometry.max },
      { bufferView: viewBase + 1, componentType: 5126, count: geometry.normals.length / 3, type: 'VEC3' },
      { bufferView: viewBase + 2, componentType: 5126, count: geometry.tangents.length / 4, type: 'VEC4' },
      { bufferView: viewBase + 3, componentType: 5126, count: geometry.uvs.length / 2, type: 'VEC2' },
      { bufferView: viewBase + 4, componentType: 5123, count: geometry.indices.length, type: 'SCALAR', min: [0], max: [geometry.positions.length / 3 - 1] },
    );
  }
  const primitive = (geometrySlot, material) => ({
    attributes: {
      POSITION: geometrySlot * 5,
      NORMAL: geometrySlot * 5 + 1,
      TANGENT: geometrySlot * 5 + 2,
      TEXCOORD_0: geometrySlot * 5 + 3,
    },
    indices: geometrySlot * 5 + 4,
    material,
  });
  const meshes = [
    { name: 'premium-limb-cylinder', extras: { geometryFeature: 'cylindrical-limb' }, primitives: [primitive(0, 0)] },
    { name: 'premium-armor-chamfer', extras: { geometryFeature: 'chamfered-armor' }, primitives: [primitive(1, 1)] },
    { name: 'premium-tech-chamfer', extras: { geometryFeature: 'chamfered-equipment' }, primitives: [primitive(1, 2)] },
    { name: 'premium-visor-wedge', extras: { geometryFeature: 'wedge-visor' }, primitives: [primitive(2, 2)] },
    { name: 'premium-emissive-cylinder', extras: { geometryFeature: 'cylindrical-emissive-fixture' }, primitives: [primitive(0, 2)] },
    { name: 'premium-body-chamfer', extras: { geometryFeature: 'chamfered-body' }, primitives: [primitive(1, 0)] },
    { name: 'premium-chest-wedge', extras: { geometryFeature: 'wedge-armor' }, primitives: [primitive(2, 1)] },
    { name: 'premium-tool-cylinder', extras: { geometryFeature: 'cylindrical-tool' }, primitives: [primitive(0, 1)] },
    { name: 'premium-tool-wedge', extras: { geometryFeature: 'wedge-tool-guard' }, primitives: [primitive(2, 2)] },
  ];
  const commonTextureBindings = {
    baseColorTexture: { index: 0 },
    metallicRoughnessTexture: { index: 2 },
  };
  const materials = [
    {
      name: 'premium-character-suit',
      pbrMetallicRoughness: { ...commonTextureBindings, baseColorFactor: [0.45, 0.57, 0.59, 1], metallicFactor: 0.30, roughnessFactor: 0.58 },
      normalTexture: { index: 1, scale: 0.72 },
      occlusionTexture: { index: 2, strength: 0.78 },
    },
    {
      name: 'premium-character-armor',
      pbrMetallicRoughness: { ...commonTextureBindings, baseColorFactor: [0.68, 0.74, 0.71, 1], metallicFactor: 0.78, roughnessFactor: 0.31 },
      normalTexture: { index: 1, scale: 0.88 },
      occlusionTexture: { index: 2, strength: 0.84 },
    },
    {
      name: 'premium-character-equipment',
      pbrMetallicRoughness: { ...commonTextureBindings, baseColorFactor: [0.09, 0.14, 0.16, 1], metallicFactor: 0.62, roughnessFactor: 0.37 },
      normalTexture: { index: 1, scale: 0.68 },
      occlusionTexture: { index: 2, strength: 0.76 },
      emissiveTexture: { index: 3 },
      emissiveFactor: [0.12, 0.84, 1.0],
    },
  ];
  const { nodes, rig } = buildNodes();
  const textureViewStart = geometries.length * 5;
  const gltf = {
    asset: { version: '2.0', generator: GENERATOR },
    scene: 0,
    scenes: [{ name: 'premium-character-source-reference', nodes: [rig] }],
    nodes,
    meshes,
    materials,
    textures: [0, 1, 2, 3].map(source => ({ source })),
    images: [
      { name: 'premium-character-base-color', bufferView: textureViewStart, mimeType: 'image/png' },
      { name: 'premium-character-normal', bufferView: textureViewStart + 1, mimeType: 'image/png' },
      { name: 'premium-character-orm', bufferView: textureViewStart + 2, mimeType: 'image/png' },
      { name: 'premium-character-emissive', bufferView: textureViewStart + 3, mimeType: 'image/png' },
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: packed.buffer.length }],
    extras: {
      ironshadePremiumCharacterSource: {
        referenceOnly: true,
        sourcePathVersion: 1,
        forwardAxis: '+X',
        upAxis: '+Y',
        groundPivot: true,
        hitboxOwnership: 'simulation',
        namedRigNodes: ['operator-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack'],
        animationHooks: ['hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack'],
        socketNodes: ['weapon-socket'],
        cueAttachmentNodes: ['torso', 'helmet', 'weapon-socket'],
        geometryFeatures: ['cylindrical-limb', 'chamfered-body', 'chamfered-armor', 'wedge-armor', 'cylindrical-tool'],
        textureChannels: ['baseColor', 'normal', 'orm', 'emissive'],
        ormPacking: { occlusion: 'R', roughness: 'G', metallic: 'B' },
      },
    },
  };
  return encodeGlb(gltf, packed.buffer);
}

export async function writePremiumCharacterSourceReference() {
  const outPath = resolve(process.cwd(), 'public/assets/models', PREMIUM_CHARACTER_SOURCE_RELATIVE_PATH);
  const glb = buildPremiumCharacterSourceGlb();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, glb);
  return { relativePath: PREMIUM_CHARACTER_SOURCE_RELATIVE_PATH, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const result = await writePremiumCharacterSourceReference();
  console.log(`wrote ${result.relativePath} (${result.bytes} bytes)`);
}
