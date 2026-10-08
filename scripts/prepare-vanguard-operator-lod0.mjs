import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createInsetPanelGeometry,
  createWedgeGeometry,
} from './lib/hard-surface-geometry.mjs';

export const VANGUARD_OPERATOR_LOD0_RELATIVE_PATH = 'operators/operator-vanguard-lod0.glb';
const OUTPUT_ROOT = resolve(process.cwd(), 'public/assets/models');
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function align4(value) {
  return (value + 3) & ~3;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(buffer) {
  let a = 1;
  let b = 0;
  for (const value of buffer) {
    a = (a + value) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function encodeStoredZlib(buffer) {
  if (buffer.length > 0xffff) throw new Error(`Stored zlib payload is too large: ${buffer.length}`);
  const blockHeader = Buffer.alloc(5);
  blockHeader[0] = 0x01;
  blockHeader.writeUInt16LE(buffer.length, 1);
  blockHeader.writeUInt16LE((~buffer.length) & 0xffff, 3);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(adler32(buffer), 0);
  return Buffer.concat([Buffer.from([0x78, 0x01]), blockHeader, buffer, checksum]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const output = Buffer.allocUnsafe(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function makePng(width, height, pixel) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.allocUnsafe(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const rgba = pixel(x, y);
      const offset = 1 + x * 4;
      row[offset] = rgba[0];
      row[offset + 1] = rgba[1];
      row[offset + 2] = rgba[2];
      row[offset + 3] = rgba[3] ?? 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', encodeStoredZlib(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildTextures() {
  return [
    makePng(16, 16, (x, y) => {
      const seam = x % 5 === 0 || y % 7 === 0;
      const plate = (x + Math.floor(y / 2)) % 4 === 0;
      const value = seam ? 26 : plate ? 78 : 54;
      return [value + 4, value + 8, value + 10, 255];
    }),
    makePng(16, 16, (x, y) => {
      const nx = 128 + (((x * 13 + y * 7) % 7) - 3);
      const ny = 128 + (((x * 5 + y * 11) % 7) - 3);
      return [nx, ny, 252, 255];
    }),
    makePng(16, 16, (x, y) => {
      const worn = (x + y * 3) % 6 === 0;
      return [worn ? 222 : 245, worn ? 126 : 154, worn ? 84 : 112, 255];
    }),
    makePng(16, 16, (x, y) => {
      const stripe = (x + y) % 7 <= 1;
      return stripe ? [255, 116, 28, 255] : [18, 34, 38, 255];
    }),
  ];
}

function typedArrayBuffer(values, Type) {
  const array = new Type(values);
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function encodeGlb(gltf, binary) {
  const jsonRaw = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonLength = align4(jsonRaw.length);
  const binLength = align4(binary.length);
  const totalLength = 12 + 8 + jsonLength + 8 + binLength;
  const output = Buffer.alloc(totalLength, 0);
  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(GLB_VERSION, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(JSON_CHUNK_TYPE, 16);
  jsonRaw.copy(output, 20);
  output.fill(0x20, 20 + jsonRaw.length, 20 + jsonLength);
  const binHeader = 20 + jsonLength;
  output.writeUInt32LE(binLength, binHeader);
  output.writeUInt32LE(BIN_CHUNK_TYPE, binHeader + 4);
  binary.copy(output, binHeader + 8);
  return output;
}

export function buildVanguardOperatorLod0Glb() {
  const textureBuffers = buildTextures();
  const geometries = [
    ['vanguard-torso-shell', createChamferedBoxGeometry({ width: 0.66, height: 0.74, depth: 0.48, chamfer: 0.075 }), 0],
    ['vanguard-limb-shell', createCylinderGeometry({ radius: 0.15, height: 0.62, segments: 24 }), 0],
    ['vanguard-heavy-limb', createCylinderGeometry({ radius: 0.19, height: 0.42, segments: 20 }), 1],
    ['vanguard-armor-plate', createChamferedBoxGeometry({ width: 0.54, height: 0.28, depth: 0.12, chamfer: 0.035 }), 1],
    ['vanguard-shoulder', createChamferedBoxGeometry({ width: 0.34, height: 0.24, depth: 0.34, chamfer: 0.055 }), 1],
    ['vanguard-ram-wedge', createWedgeGeometry({ width: 0.58, height: 0.32, depth: 0.30 }), 1],
    ['vanguard-knee-wedge', createWedgeGeometry({ width: 0.28, height: 0.22, depth: 0.18 }), 1],
    ['vanguard-inset-brace', createInsetPanelGeometry({ width: 0.38, height: 0.42, depth: 0.12, insetWidth: 0.24, insetHeight: 0.24, recess: 0.045 }), 1],
    ['vanguard-helmet-shell', createChamferedBoxGeometry({ width: 0.43, height: 0.46, depth: 0.41, chamfer: 0.08 }), 1],
    ['vanguard-visor', createWedgeGeometry({ width: 0.32, height: 0.17, depth: 0.35 }), 2],
    ['vanguard-pack', createChamferedBoxGeometry({ width: 0.28, height: 0.48, depth: 0.42, chamfer: 0.045 }), 2],
    ['vanguard-reactor', createCylinderGeometry({ radius: 0.10, height: 0.36, segments: 18 }), 3],
    ['vanguard-utility', createChamferedBoxGeometry({ width: 0.22, height: 0.22, depth: 0.18, chamfer: 0.035 }), 2],
    ['vanguard-boot', createWedgeGeometry({ width: 0.40, height: 0.21, depth: 0.30 }), 1],
    ['vanguard-guard-light', createCylinderGeometry({ radius: 0.065, height: 0.12, segments: 16 }), 3],
    ['vanguard-belt-panel', createInsetPanelGeometry({ width: 0.30, height: 0.20, depth: 0.10, insetWidth: 0.18, insetHeight: 0.10, recess: 0.035 }), 2],
  ];

  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let byteOffset = 0;
  function appendBuffer(buffer, target) {
    const aligned = align4(byteOffset);
    if (aligned > byteOffset) chunks.push(Buffer.alloc(aligned - byteOffset));
    byteOffset = aligned;
    const index = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: buffer.length, ...(target ? { target } : {}) });
    chunks.push(buffer);
    byteOffset += buffer.length;
    return index;
  }
  function appendAccessor(buffer, target, componentType, count, type, min, max) {
    const view = appendBuffer(buffer, target);
    const index = accessors.length;
    accessors.push({ bufferView: view, componentType, count, type, ...(min ? { min } : {}), ...(max ? { max } : {}) });
    return index;
  }

  const meshAccessors = geometries.map(([, geometry]) => ({
    POSITION: appendAccessor(typedArrayBuffer(geometry.positions, Float32Array), 34962, 5126, geometry.positions.length / 3, 'VEC3', geometry.min, geometry.max),
    NORMAL: appendAccessor(typedArrayBuffer(geometry.normals, Float32Array), 34962, 5126, geometry.normals.length / 3, 'VEC3'),
    TANGENT: appendAccessor(typedArrayBuffer(geometry.tangents, Float32Array), 34962, 5126, geometry.tangents.length / 4, 'VEC4'),
    TEXCOORD_0: appendAccessor(typedArrayBuffer(geometry.uvs, Float32Array), 34962, 5126, geometry.uvs.length / 2, 'VEC2'),
    indices: appendAccessor(typedArrayBuffer(geometry.indices, Uint16Array), 34963, 5123, geometry.indices.length, 'SCALAR'),
  }));

  const imageViews = textureBuffers.map(texture => appendBuffer(texture));
  const binary = Buffer.concat([...chunks, Buffer.alloc(align4(byteOffset) - byteOffset)]);

  const meshes = geometries.map(([name, geometry, material], index) => {
    const { indices, ...attributes } = meshAccessors[index];
    return {
      name,
      primitives: [{ attributes, indices, material }],
      extras: { triangles: geometry.indices.length / 3, vertices: geometry.positions.length / 3 },
    };
  });

  const nodes = [];
  function addNode(name, parent = null, props = {}) {
    const node = { name, ...props };
    if (!node.children) node.children = [];
    const index = nodes.length;
    nodes.push(node);
    if (parent != null) nodes[parent].children.push(index);
    return index;
  }
  function addMeshNode(name, parent, mesh, translation, scale = [1, 1, 1], rotation) {
    return addNode(name, parent, { mesh, translation, scale, ...(rotation ? { rotation } : {}) });
  }

  const rig = addNode('operator-rig', null, { extras: { rig: 'operator-articulated-v1' } });
  const hip = addNode('hip', rig, { translation: [0, 0.91, 0] });
  const torso = addNode('torso', hip, { translation: [0, 0.32, 0] });
  const helmet = addNode('helmet', torso, { translation: [0.02, 0.73, 0] });
  const armLeft = addNode('arm-left', torso, { translation: [0.02, 0.42, 0.40] });
  const armRight = addNode('arm-right', torso, { translation: [0.02, 0.42, -0.40] });
  const legLeft = addNode('leg-left', hip, { translation: [0, 0, 0.18] });
  const legRight = addNode('leg-right', hip, { translation: [0, 0, -0.18] });
  const backpack = addNode('backpack', torso, { translation: [-0.18, 0.18, 0] });
  addNode('weapon-socket', torso, { translation: [0.20, 0.18, -0.24], extras: { socket: 'weapon' } });

  addMeshNode('vanguard-underlayer-torso', torso, 0, [0, 0.02, 0], [0.92, 0.92, 0.92]);
  addMeshNode('vanguard-ram-plate', torso, 5, [0.37, 0.10, 0], [1.04, 1.10, 1.08], [0, 0, 0.7071068, 0.7071068]);
  addMeshNode('vanguard-chest-upper', torso, 3, [0.32, 0.25, 0], [0.88, 0.92, 1.12]);
  addMeshNode('vanguard-chest-lower', torso, 7, [0.33, -0.12, 0], [0.94, 0.76, 1.05]);
  addMeshNode('vanguard-collar', torso, 3, [0.02, 0.42, 0], [0.76, 0.48, 1.18]);
  addMeshNode('vanguard-belt-core', hip, 3, [0.02, 0.02, 0], [0.80, 0.58, 1.22]);
  addMeshNode('vanguard-belt-left', hip, 15, [0.05, -0.04, 0.33], [0.86, 0.90, 0.84]);
  addMeshNode('vanguard-belt-right', hip, 15, [0.05, -0.04, -0.33], [0.86, 0.90, 0.84]);
  addMeshNode('vanguard-guard-light', torso, 14, [0.39, 0.18, 0.24], [1, 1, 1], [0, 0, 0.7071068, 0.7071068]);

  addMeshNode('vanguard-helmet-shell', helmet, 8, [0, 0, 0], [1, 1, 1]);
  addMeshNode('vanguard-command-visor', helmet, 9, [0.22, 0.02, 0], [1.00, 0.92, 0.96], [0, 0, 0.7071068, 0.7071068]);
  addMeshNode('vanguard-helmet-brow', helmet, 3, [0.19, 0.17, 0], [0.56, 0.32, 0.96]);
  addMeshNode('vanguard-helmet-left-guard', helmet, 12, [0.0, 0.03, 0.25], [0.65, 0.72, 0.70]);
  addMeshNode('vanguard-helmet-right-guard', helmet, 12, [0.0, 0.03, -0.25], [0.65, 0.72, 0.70]);
  addMeshNode('vanguard-helmet-beacon', helmet, 14, [0.02, 0.28, 0.12], [0.72, 0.72, 0.72]);

  for (const [arm, side] of [[armLeft, 1], [armRight, -1]]) {
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-upper-arm`, arm, 1, [0, -0.21, 0], [0.84, 0.74, 0.84]);
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-pauldron`, arm, 4, [0.02, 0.06, side * 0.03], [1.14, 1.00, 1.08]);
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-forearm`, arm, 2, [0.02, -0.53, 0], [0.84, 0.94, 0.84]);
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-breacher-brace`, arm, 7, [0.19, -0.50, 0], [0.76, 0.74, 0.78], [0, 0, 0.7071068, 0.7071068]);
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-gauntlet`, arm, 12, [0.04, -0.75, 0], [0.92, 0.92, 0.92]);
  }

  for (const [leg, side] of [[legLeft, 1], [legRight, -1]]) {
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-thigh`, leg, 1, [0, -0.24, 0], [0.96, 0.72, 0.90]);
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-thigh-plate`, leg, 3, [0.18, -0.22, 0], [0.66, 0.88, 0.88], [0, 0, 0.7071068, 0.7071068]);
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-knee`, leg, 6, [0.18, -0.49, 0], [0.84, 0.86, 0.88], [0, 0, 0.7071068, 0.7071068]);
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-shin`, leg, 2, [0, -0.62, 0], [0.70, 0.92, 0.76]);
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-shin-brace`, leg, 7, [0.17, -0.64, 0], [0.68, 0.82, 0.72], [0, 0, 0.7071068, 0.7071068]);
    addMeshNode(`vanguard-${side > 0 ? 'left' : 'right'}-boot`, leg, 13, [0.11, -0.73, 0], [0.90, 0.96, 0.90], [0, 0, 0.7071068, 0.7071068]);
  }

  addMeshNode('vanguard-reactive-pack', backpack, 10, [-0.05, 0.02, 0], [1.12, 1.02, 1.06]);
  addMeshNode('vanguard-reactive-cell-left', backpack, 11, [-0.16, 0.01, 0.18], [0.92, 1.05, 0.92]);
  addMeshNode('vanguard-reactive-cell-right', backpack, 11, [-0.16, 0.01, -0.18], [0.92, 1.05, 0.92]);
  addMeshNode('vanguard-pack-vent-left', backpack, 7, [-0.30, 0.12, 0.18], [0.58, 0.44, 0.52], [0, 0, 0.7071068, 0.7071068]);
  addMeshNode('vanguard-pack-vent-right', backpack, 7, [-0.30, 0.12, -0.18], [0.58, 0.44, 0.52], [0, 0, 0.7071068, 0.7071068]);
  addMeshNode('vanguard-pack-status', backpack, 14, [-0.34, 0.26, 0], [0.74, 0.74, 0.74], [0, 0, 0.7071068, 0.7071068]);

  const sourceTriangles = geometries.reduce((sum, [, geometry]) => sum + geometry.indices.length / 3, 0);
  const meshNodeTriangles = nodes.reduce((sum, node) => {
    if (!Number.isInteger(node.mesh)) return sum;
    return sum + geometries[node.mesh][1].indices.length / 3;
  }, 0);
  const gltf = {
    asset: { version: '2.0', generator: 'Ironshade Vector P28-D1 Vanguard LOD0 deterministic generator' },
    scene: 0,
    scenes: [{ name: 'vanguard-operator-lod0', nodes: [rig] }],
    nodes,
    meshes,
    materials: [
      {
        name: 'vanguard-suit',
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 }, metallicFactor: 0.28, roughnessFactor: 0.82 },
        normalTexture: { index: 1, scale: 0.72 },
        occlusionTexture: { index: 2, strength: 0.82 },
      },
      {
        name: 'vanguard-armor',
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 }, metallicFactor: 0.66, roughnessFactor: 0.46 },
        normalTexture: { index: 1, scale: 0.9 },
        occlusionTexture: { index: 2, strength: 0.9 },
      },
      {
        name: 'vanguard-equipment',
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 }, metallicFactor: 0.48, roughnessFactor: 0.58 },
        normalTexture: { index: 1, scale: 0.86 },
        occlusionTexture: { index: 2, strength: 0.88 },
      },
      {
        name: 'vanguard-emissive',
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 }, metallicFactor: 0.34, roughnessFactor: 0.42 },
        normalTexture: { index: 1, scale: 0.7 },
        occlusionTexture: { index: 2, strength: 0.76 },
        emissiveTexture: { index: 3 },
        emissiveFactor: [0.95, 0.32, 0.06],
      },
    ],
    textures: [{ sampler: 0, source: 0 }, { sampler: 0, source: 1 }, { sampler: 0, source: 2 }, { sampler: 0, source: 3 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    images: imageViews.map((bufferView, index) => ({ name: ['vanguard-base-color', 'vanguard-normal', 'vanguard-orm', 'vanguard-emissive'][index], mimeType: 'image/png', bufferView })),
    accessors,
    bufferViews,
    buffers: [{ byteLength: binary.length }],
    extras: {
      ironshadeP28D1VanguardLod0: {
        production: true,
        family: 'vanguard',
        lodTier: 0,
        deterministic: true,
        embeddedWeapon: false,
        hitboxOwnership: 'simulation',
        gameplayBoundsOwnership: 'simulation',
        coordinateSystem: 'right-handed-y-up',
        namedRigNodes: ['operator-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket'],
        animationHooks: ['hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack'],
        socketNodes: ['weapon-socket'],
        classSilhouetteNodes: ['vanguard-ram-plate', 'vanguard-left-pauldron', 'vanguard-right-pauldron', 'vanguard-reactive-pack', 'vanguard-command-visor', 'vanguard-guard-light'],
        geometryFeatures: ['cylindrical-limbs', 'chamfered-armor', 'wedge-ram', 'inset-braces', 'layered-helmet', 'reactive-pack'],
        textureChannels: ['base-color', 'normal', 'orm', 'emissive'],
        sourceTriangles,
        meshNodeTriangles,
        legacyLod1Asset: 'operator-vanguard-lod1',
      },
    },
  };
  return encodeGlb(gltf, binary);
}

export async function writeVanguardOperatorLod0() {
  const outputPath = resolve(OUTPUT_ROOT, VANGUARD_OPERATOR_LOD0_RELATIVE_PATH);
  const glb = buildVanguardOperatorLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] wrote ${VANGUARD_OPERATOR_LOD0_RELATIVE_PATH} (${glb.length} bytes)`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeVanguardOperatorLod0();
