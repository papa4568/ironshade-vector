import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const outPath = resolve(process.cwd(), 'public/assets/models/operators/operator-field-suit-lod1.glb');

const positions = new Float32Array([
  -0.5, -0.5, -0.5,
   0.5, -0.5, -0.5,
   0.5,  0.5, -0.5,
  -0.5,  0.5, -0.5,
  -0.5, -0.5,  0.5,
   0.5, -0.5,  0.5,
   0.5,  0.5,  0.5,
  -0.5,  0.5,  0.5,
]);

const invSqrt3 = 1 / Math.sqrt(3);
const normals = new Float32Array([
  -invSqrt3, -invSqrt3, -invSqrt3,
   invSqrt3, -invSqrt3, -invSqrt3,
   invSqrt3,  invSqrt3, -invSqrt3,
  -invSqrt3,  invSqrt3, -invSqrt3,
  -invSqrt3, -invSqrt3,  invSqrt3,
   invSqrt3, -invSqrt3,  invSqrt3,
   invSqrt3,  invSqrt3,  invSqrt3,
  -invSqrt3,  invSqrt3,  invSqrt3,
]);

const indices = new Uint16Array([
  0, 1, 2, 0, 2, 3,
  4, 6, 5, 4, 7, 6,
  0, 4, 5, 0, 5, 1,
  3, 2, 6, 3, 6, 7,
  1, 5, 6, 1, 6, 2,
  0, 3, 7, 0, 7, 4,
]);

function bytes(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

const binParts = [bytes(positions), bytes(normals), bytes(indices)];
const bin = Buffer.concat(binParts);

const materials = [
  {
    name: 'suit-primary',
    pbrMetallicRoughness: {
      baseColorFactor: [0.28, 0.45, 0.42, 1],
      metallicFactor: 0.62,
      roughnessFactor: 0.38,
    },
  },
  {
    name: 'armor-shell',
    pbrMetallicRoughness: {
      baseColorFactor: [0.62, 0.68, 0.66, 1],
      metallicFactor: 0.78,
      roughnessFactor: 0.30,
    },
  },
  {
    name: 'tech-dark',
    pbrMetallicRoughness: {
      baseColorFactor: [0.055, 0.075, 0.082, 1],
      metallicFactor: 0.82,
      roughnessFactor: 0.28,
    },
  },
  {
    name: 'visor-emissive',
    pbrMetallicRoughness: {
      baseColorFactor: [0.04, 0.12, 0.14, 1],
      metallicFactor: 0.35,
      roughnessFactor: 0.18,
    },
    emissiveFactor: [0.18, 0.72, 0.78],
  },
  {
    name: 'accent-emissive',
    pbrMetallicRoughness: {
      baseColorFactor: [0.18, 0.34, 0.32, 1],
      metallicFactor: 0.55,
      roughnessFactor: 0.24,
    },
    emissiveFactor: [0.2, 0.8, 0.68],
  },
];

const meshes = materials.map((_, material) => ({
  name: `cube-${material}`,
  primitives: [{
    attributes: { POSITION: 0, NORMAL: 1 },
    indices: 2,
    material,
  }],
}));

const nodes = [
  { name: 'leg-left-shell', mesh: 0, translation: [0.02, -0.39, 0], scale: [0.23, 0.78, 0.24] },
  { name: 'boot-left', mesh: 2, translation: [0.13, -0.83, 0], scale: [0.44, 0.18, 0.32] },
  { name: 'leg-left', translation: [0, 0, 0.18], children: [0, 1] },

  { name: 'leg-right-shell', mesh: 0, translation: [0.02, -0.39, 0], scale: [0.23, 0.78, 0.24] },
  { name: 'boot-right', mesh: 2, translation: [0.13, -0.83, 0], scale: [0.44, 0.18, 0.32] },
  { name: 'leg-right', translation: [0, 0, -0.18], children: [3, 4] },

  { name: 'arm-left-upper', mesh: 0, translation: [0, -0.19, 0], scale: [0.18, 0.40, 0.18] },
  { name: 'gauntlet-left', mesh: 1, translation: [0.08, -0.43, 0], scale: [0.28, 0.22, 0.22] },
  { name: 'arm-left', translation: [0.02, 0.42, 0.40], children: [6, 7] },

  { name: 'arm-right-upper', mesh: 0, translation: [0, -0.19, 0], scale: [0.18, 0.40, 0.18] },
  { name: 'gauntlet-right', mesh: 1, translation: [0.08, -0.43, 0], scale: [0.28, 0.22, 0.22] },
  { name: 'arm-right', translation: [0.02, 0.42, -0.40], children: [9, 10] },

  { name: 'backpack-core', mesh: 2, translation: [-0.18, 0.02, 0], scale: [0.24, 0.48, 0.46] },
  { name: 'thruster-left', mesh: 4, translation: [-0.26, -0.22, 0.16], scale: [0.12, 0.24, 0.10] },
  { name: 'thruster-right', mesh: 4, translation: [-0.26, -0.22, -0.16], scale: [0.12, 0.24, 0.10] },
  { name: 'backpack', translation: [-0.18, 0.18, 0], children: [12, 13, 14] },

  { name: 'helmet-shell', mesh: 1, translation: [0, 0, 0], scale: [0.48, 0.50, 0.46] },
  { name: 'helmet-visor', mesh: 3, translation: [0.26, -0.02, 0], scale: [0.10, 0.20, 0.34] },
  { name: 'helmet-lamp', mesh: 4, translation: [0.08, 0.25, -0.20], scale: [0.10, 0.07, 0.07] },
  { name: 'helmet', translation: [0.02, 0.73, 0], children: [16, 17, 18] },

  { name: 'torso-suit', mesh: 0, translation: [0, 0, 0], scale: [0.56, 0.68, 0.56] },
  { name: 'chest-plate', mesh: 1, translation: [0.25, 0.05, 0], scale: [0.10, 0.44, 0.44] },
  { name: 'chest-status', mesh: 4, translation: [0.31, 0.10, -0.13], scale: [0.04, 0.09, 0.11] },
  { name: 'weapon-socket', translation: [0.20, 0.18, -0.24] },
  { name: 'torso', translation: [0, 0.32, 0], children: [20, 21, 22, 19, 8, 11, 15, 23] },

  { name: 'hip-armor', mesh: 1, translation: [0, 0, 0], scale: [0.48, 0.20, 0.48] },
  { name: 'hip', translation: [0, 0.91, 0], children: [25, 24, 2, 5] },
  { name: 'operator-rig', children: [26] },
];

const gltf = {
  asset: {
    version: '2.0',
    generator: 'Ironshade Vector articulated operator asset generator',
  },
  scene: 0,
  scenes: [{ name: 'operator-field-suit-lod1', nodes: [27] }],
  nodes,
  meshes,
  materials,
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 8,
      type: 'VEC3',
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    },
    {
      bufferView: 1,
      componentType: 5126,
      count: 8,
      type: 'VEC3',
      min: [-1, -1, -1],
      max: [1, 1, 1],
    },
    {
      bufferView: 2,
      componentType: 5123,
      count: 36,
      type: 'SCALAR',
      min: [0],
      max: [7],
    },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
    { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength, target: 34962 },
    { buffer: 0, byteOffset: positions.byteLength + normals.byteLength, byteLength: indices.byteLength, target: 34963 },
  ],
  buffers: [{ byteLength: bin.byteLength }],
};

function pad(buffer, multiple, fill) {
  const remainder = buffer.length % multiple;
  if (remainder === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(multiple - remainder, fill)]);
}

const json = pad(Buffer.from(JSON.stringify(gltf), 'utf8'), 4, 0x20);
const paddedBin = pad(bin, 4, 0);
const totalLength = 12 + 8 + json.length + 8 + paddedBin.length;
const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(json.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(paddedBin.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);

const glb = Buffer.concat([header, jsonHeader, json, binHeader, paddedBin]);
if (glb.length !== totalLength) throw new Error(`GLB length mismatch: ${glb.length} !== ${totalLength}`);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, glb);
console.log(`GRAPHICS_ASSETS_READY operator=operator-field-suit-lod1 bytes=${glb.length} nodes=${nodes.length}`);
