import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import {
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createWedgeGeometry,
} from './lib/hard-surface-geometry.mjs';

export const VECTOR_OPERATOR_LOD0_RELATIVE_PATH = 'operators/operator-vector-lod0.glb';
const OUTPUT_ROOT = resolve(process.cwd(), 'public/assets/models');
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function align4(value) { return (value + 3) & ~3; }

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeZlib(buffer) {
  return deflateSync(buffer, { level: 9 });
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
    pngChunk('IDAT', encodeZlib(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildTextures() {
  return [
    makePng(32, 32, (x, y) => {
      const seam = x % 8 === 0 || y % 9 === 0;
      const panel = ((x >> 2) + (y >> 2)) % 3 === 0;
      const edge = (x + 2 * y) % 17 === 0;
      if (seam) return [20, 30, 36, 255];
      if (edge) return [84, 104, 111, 255];
      return panel ? [49, 65, 72, 255] : [37, 50, 58, 255];
    }),
    makePng(32, 32, (x, y) => {
      const nx = 128 + (((x * 11 + y * 3) % 9) - 4);
      const ny = 128 + (((x * 5 + y * 13) % 9) - 4);
      return [nx, ny, 252, 255];
    }),
    makePng(32, 32, (x, y) => {
      const polish = (x * 3 + y * 5) % 11 < 3;
      const occlusion = (x + y) % 13 === 0 ? 176 : 232;
      return [occlusion, polish ? 82 : 132, polish ? 214 : 174, 255];
    }),
    makePng(32, 32, (x, y) => {
      const trace = x === 8 || x === 23 || y === 12 || ((x + y) % 19 === 0);
      const pulse = (x * 7 + y * 5) % 23 === 0;
      return trace || pulse ? [32, 226, 246, 255] : [2, 10, 14, 255];
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

export function buildVectorOperatorLod0Glb() {
  const textureBuffers = buildTextures();
  const geometries = [
    ['vector-torso-shell', createChamferedBoxGeometry({ width: 0.54, height: 0.70, depth: 0.40, chamfer: 0.055 }), 0],
    ['vector-limb-shell', createCylinderGeometry({ radius: 0.115, height: 0.60, segments: 20 }), 0],
    ['vector-joint-shell', createCylinderGeometry({ radius: 0.14, height: 0.22, segments: 16 }), 1],
    ['vector-armor-panel', createChamferedBoxGeometry({ width: 0.42, height: 0.22, depth: 0.08, chamfer: 0.025 }), 1],
    ['vector-shoulder-fin', createWedgeGeometry({ width: 0.34, height: 0.18, depth: 0.25 }), 1],
    ['vector-chest-keel', createWedgeGeometry({ width: 0.46, height: 0.34, depth: 0.20 }), 1],
    ['vector-knee-fin', createWedgeGeometry({ width: 0.24, height: 0.24, depth: 0.15 }), 1],
    ['vector-rail', createChamferedBoxGeometry({ width: 0.12, height: 0.46, depth: 0.10, chamfer: 0.018 }), 2],
    ['vector-helmet-shell', createChamferedBoxGeometry({ width: 0.39, height: 0.43, depth: 0.36, chamfer: 0.065 }), 1],
    ['vector-visor', createWedgeGeometry({ width: 0.30, height: 0.14, depth: 0.31 }), 3],
    ['vector-pack', createChamferedBoxGeometry({ width: 0.24, height: 0.43, depth: 0.34, chamfer: 0.035 }), 2],
    ['vector-thruster', createCylinderGeometry({ radius: 0.072, height: 0.25, segments: 16 }), 3],
    ['vector-utility', createChamferedBoxGeometry({ width: 0.18, height: 0.18, depth: 0.15, chamfer: 0.025 }), 2],
    ['vector-boot', createWedgeGeometry({ width: 0.34, height: 0.18, depth: 0.27 }), 1],
    ['vector-phase-light', createCylinderGeometry({ radius: 0.045, height: 0.11, segments: 16 }), 3],
    ['vector-belt-panel', createChamferedBoxGeometry({ width: 0.25, height: 0.15, depth: 0.08, chamfer: 0.018 }), 2],
    ['vector-aero-vane', createWedgeGeometry({ width: 0.11, height: 0.32, depth: 0.20 }), 2],
    ['vector-sensor-pod', createCylinderGeometry({ radius: 0.06, height: 0.18, segments: 16 }), 3],
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
    return { name, primitives: [{ attributes, indices, material }], extras: { triangles: geometry.indices.length / 3, vertices: geometry.positions.length / 3 } };
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

  addMeshNode('vector-underlayer-torso', torso, 0, [0, 0.01, 0], [0.94, 0.94, 0.94]);
  addMeshNode('vector-aero-chest', torso, 5, [0.31, 0.12, 0], [0.92, 1.08, 0.92], [0, 0, 0.7071068, 0.7071068]);
  addMeshNode('vector-chest-upper', torso, 3, [0.27, 0.27, 0], [0.94, 0.88, 1.04]);
  addMeshNode('vector-chest-lower', torso, 3, [0.27, -0.13, 0], [0.78, 0.72, 0.94]);
  addMeshNode('vector-left-rail', torso, 7, [0.22, 0.04, 0.29], [0.86, 1.05, 0.82]);
  addMeshNode('vector-right-rail', torso, 7, [0.22, 0.04, -0.29], [0.86, 1.05, 0.82]);
  addMeshNode('vector-phase-light', torso, 14, [0.33, 0.22, 0], [1, 1, 1], [0, 0, 0.7071068, 0.7071068]);
  addMeshNode('vector-chest-trim-left', torso, 7, [0.29, 0.30, 0.18], [0.42, 0.54, 0.46]);
  addMeshNode('vector-chest-trim-right', torso, 7, [0.29, 0.30, -0.18], [0.42, 0.54, 0.46]);
  addMeshNode('vector-belt-core', hip, 15, [0.02, 0.01, 0], [0.92, 0.92, 1.08]);
  addMeshNode('vector-belt-left', hip, 12, [0.04, -0.04, 0.28], [0.88, 0.90, 0.86]);
  addMeshNode('vector-belt-right', hip, 12, [0.04, -0.04, -0.28], [0.88, 0.90, 0.86]);
  addMeshNode('vector-hip-panel-left', hip, 3, [0.08, -0.12, 0.27], [0.48, 0.62, 0.62]);
  addMeshNode('vector-hip-panel-right', hip, 3, [0.08, -0.12, -0.27], [0.48, 0.62, 0.62]);

  addMeshNode('vector-helmet-shell', helmet, 8, [0, 0, 0], [0.96, 1, 0.96]);
  addMeshNode('vector-targeting-visor', helmet, 9, [0.20, 0.015, 0], [1.02, 0.88, 0.96], [0, 0, 0.7071068, 0.7071068]);
  addMeshNode('vector-sensor-left', helmet, 17, [-0.08, 0.10, 0.23], [0.92, 0.92, 0.92], [0, 0, 0.7071068, 0.7071068]);
  addMeshNode('vector-sensor-right', helmet, 17, [-0.08, 0.10, -0.23], [0.92, 0.92, 0.92], [0, 0, 0.7071068, 0.7071068]);

  for (const [side, parent, sign] of [['left', armLeft, 1], ['right', armRight, -1]]) {
    addMeshNode(`vector-${side}-arm`, parent, 1, [0, -0.22, 0], [0.92, 0.94, 0.92]);
    addMeshNode(`vector-${side}-pauldron`, parent, 4, [0.01, 0.08, sign * 0.04], [0.92, 0.92, 0.92], [0, 0, sign * 0.1305262, 0.9914449]);
    addMeshNode(`vector-${side}-elbow`, parent, 2, [0, -0.34, 0], [0.86, 0.86, 0.86]);
    addMeshNode(`vector-${side}-forearm-rail`, parent, 7, [0.10, -0.28, sign * 0.10], [0.66, 0.66, 0.66]);
    addMeshNode(`vector-${side}-forearm-light`, parent, 14, [0.11, -0.18, sign * 0.11], [0.62, 0.62, 0.62], [0, 0, 0.7071068, 0.7071068]);
  }

  for (const [side, parent, sign] of [['left', legLeft, 1], ['right', legRight, -1]]) {
    addMeshNode(`vector-${side}-thigh`, parent, 1, [0, -0.23, 0], [1.04, 1.02, 1.04]);
    addMeshNode(`vector-${side}-knee-fin`, parent, 6, [0.13, -0.47, sign * 0.03], [0.90, 0.92, 0.90], [0, 0, 0.7071068, 0.7071068]);
    addMeshNode(`vector-${side}-shin`, parent, 1, [0, -0.62, 0], [0.88, 0.88, 0.88]);
    addMeshNode(`vector-${side}-calf-vane`, parent, 16, [-0.08, -0.60, sign * 0.12], [0.90, 0.90, 0.90]);
    addMeshNode(`vector-${side}-boot`, parent, 13, [0.09, -0.73, 0], [0.94, 0.96, 0.94], [0, 0, 0.7071068, 0.7071068]);
  }

  addMeshNode('vector-thruster-pack', backpack, 10, [-0.04, 0.02, 0], [0.96, 1.0, 0.96]);
  addMeshNode('vector-thruster-left', backpack, 11, [-0.18, -0.03, 0.16], [1.08, 1.18, 1.08]);
  addMeshNode('vector-thruster-right', backpack, 11, [-0.18, -0.03, -0.16], [1.08, 1.18, 1.08]);
  addMeshNode('vector-pack-vane-left', backpack, 16, [-0.18, 0.19, 0.23], [0.88, 1.08, 0.88]);
  addMeshNode('vector-pack-vane-right', backpack, 16, [-0.18, 0.19, -0.23], [0.88, 1.08, 0.88]);
  addMeshNode('vector-pack-status', backpack, 14, [-0.29, 0.24, 0], [0.82, 0.82, 0.82], [0, 0, 0.7071068, 0.7071068]);
  addMeshNode('vector-pack-rail-left', backpack, 7, [-0.24, 0.03, 0.22], [0.56, 0.72, 0.58]);
  addMeshNode('vector-pack-rail-right', backpack, 7, [-0.24, 0.03, -0.22], [0.56, 0.72, 0.58]);

  const sourceTriangles = geometries.reduce((sum, [, geometry]) => sum + geometry.indices.length / 3, 0);
  const meshNodeTriangles = nodes.reduce((sum, node) => Number.isInteger(node.mesh) ? sum + geometries[node.mesh][1].indices.length / 3 : sum, 0);
  const gltf = {
    asset: { version: '2.0', generator: 'Ironshade Vector P28-D2 Vector LOD0 deterministic generator' },
    scene: 0,
    scenes: [{ name: 'vector-operator-lod0', nodes: [rig] }],
    nodes,
    meshes,
    materials: [
      { name: 'vector-suit', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 }, metallicFactor: 0.24, roughnessFactor: 0.78 }, normalTexture: { index: 1, scale: 0.78 }, occlusionTexture: { index: 2, strength: 0.84 } },
      { name: 'vector-armor', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 }, metallicFactor: 0.72, roughnessFactor: 0.34 }, normalTexture: { index: 1, scale: 0.92 }, occlusionTexture: { index: 2, strength: 0.92 } },
      { name: 'vector-equipment', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 }, metallicFactor: 0.50, roughnessFactor: 0.48 }, normalTexture: { index: 1, scale: 0.88 }, occlusionTexture: { index: 2, strength: 0.90 } },
      { name: 'vector-emissive', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 }, metallicFactor: 0.38, roughnessFactor: 0.30 }, normalTexture: { index: 1, scale: 0.74 }, occlusionTexture: { index: 2, strength: 0.80 }, emissiveTexture: { index: 3 }, emissiveFactor: [0.08, 0.88, 1.0] },
    ],
    textures: [{ sampler: 0, source: 0 }, { sampler: 0, source: 1 }, { sampler: 0, source: 2 }, { sampler: 0, source: 3 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    images: imageViews.map((bufferView, index) => ({ name: ['vector-base-color', 'vector-normal', 'vector-orm', 'vector-emissive'][index], mimeType: 'image/png', bufferView })),
    accessors,
    bufferViews,
    buffers: [{ byteLength: binary.length }],
    extras: {
      ironshadeP28D2VectorLod0: {
        production: true,
        family: 'vector',
        lodTier: 0,
        deterministic: true,
        embeddedWeapon: false,
        hitboxOwnership: 'simulation',
        gameplayBoundsOwnership: 'simulation',
        coordinateSystem: 'right-handed-y-up',
        namedRigNodes: ['operator-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket'],
        animationHooks: ['hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack'],
        socketNodes: ['weapon-socket'],
        classSilhouetteNodes: ['vector-aero-chest', 'vector-left-rail', 'vector-right-rail', 'vector-thruster-pack', 'vector-targeting-visor', 'vector-phase-light'],
        geometryFeatures: ['tapered-limbs', 'chamfered-armor', 'aero-keel', 'paired-rails', 'sensor-visor', 'thruster-pack', 'calf-vanes'],
        textureChannels: ['base-color', 'normal', 'orm', 'emissive'],
        sourceTriangles,
        meshNodeTriangles,
        legacyLod1Asset: 'operator-vector-lod1',
      },
    },
  };
  return encodeGlb(gltf, binary);
}

export async function writeVectorOperatorLod0() {
  const outputPath = resolve(OUTPUT_ROOT, VECTOR_OPERATOR_LOD0_RELATIVE_PATH);
  const glb = buildVectorOperatorLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] wrote ${VECTOR_OPERATOR_LOD0_RELATIVE_PATH} (${glb.length} bytes)`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeVectorOperatorLod0();
