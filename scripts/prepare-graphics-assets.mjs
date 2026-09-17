import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

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

const bin = Buffer.concat([bytes(positions), bytes(normals), bytes(indices)]);

function pad(buffer, multiple, fill) {
  const remainder = buffer.length % multiple;
  if (remainder === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(multiple - remainder, fill)]);
}

function materials(primary, accent) {
  return [
    {
      name: 'suit-primary',
      pbrMetallicRoughness: {
        baseColorFactor: primary,
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
      emissiveFactor: accent,
    },
    {
      name: 'accent-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [accent[0] * 0.45, accent[1] * 0.45, accent[2] * 0.45, 1],
        metallicFactor: 0.55,
        roughnessFactor: 0.24,
      },
      emissiveFactor: accent,
    },
  ];
}

function gltfFor(name, nodes, assetMaterials) {
  const meshes = assetMaterials.map((_, material) => ({
    name: `cube-${material}`,
    primitives: [{
      attributes: { POSITION: 0, NORMAL: 1 },
      indices: 2,
      material,
    }],
  }));

  return {
    asset: {
      version: '2.0',
      generator: 'Ironshade Vector deterministic mobile graphics asset generator',
    },
    scene: 0,
    scenes: [{ name, nodes: [nodes.length - 1] }],
    nodes,
    meshes,
    materials: assetMaterials,
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
}

function encodeGlb(gltf) {
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
  return glb;
}

async function writeAsset(relativePath, name, nodes, assetMaterials) {
  const outPath = resolve(process.cwd(), 'public/assets/models', relativePath);
  const glb = encodeGlb(gltfFor(name, nodes, assetMaterials));
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, glb);
  return { relativePath, bytes: glb.length, nodes: nodes.length };
}

function operatorNodes() {
  return [
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
}

function enemyNodes(role) {
  const boss = role === 'boss';
  const suppressor = role === 'suppressor';
  const technician = role === 'technician';
  const elite = role === 'elite';

  const hipY = boss ? 1.12 : elite ? 0.98 : 0.90;
  const legScale = boss ? [0.34, 0.92, 0.34] : suppressor ? [0.29, 0.78, 0.30] : technician ? [0.20, 0.78, 0.20] : [0.24, 0.78, 0.24];
  const torsoScale = boss ? [0.90, 0.82, 0.85] : suppressor ? [0.72, 0.70, 0.72] : technician ? [0.46, 0.64, 0.44] : elite ? [0.64, 0.73, 0.60] : [0.56, 0.64, 0.52];
  const armScale = boss ? [0.26, 0.52, 0.26] : suppressor ? [0.23, 0.46, 0.24] : technician ? [0.15, 0.42, 0.15] : [0.18, 0.42, 0.18];
  const armZ = boss ? 0.66 : suppressor ? 0.54 : technician ? 0.34 : elite ? 0.49 : 0.40;
  const helmetScale = boss ? [0.62, 0.54, 0.58] : suppressor ? [0.50, 0.46, 0.50] : technician ? [0.38, 0.52, 0.36] : elite ? [0.50, 0.52, 0.46] : [0.44, 0.46, 0.42];
  const helmetY = boss ? 0.94 : elite ? 0.80 : 0.72;
  const backpackScale = boss ? [0.44, 0.64, 0.72] : suppressor ? [0.36, 0.58, 0.64] : technician ? [0.24, 0.70, 0.36] : [0.24, 0.46, 0.44];

  const nodes = [
    { name: 'leg-left-shell', mesh: 0, translation: [0, -0.39, 0], scale: legScale },
    { name: 'boot-left', mesh: 2, translation: [0.14, -0.83, 0], scale: boss ? [0.56, 0.20, 0.42] : [0.42, 0.18, 0.30] },
    { name: 'leg-left', translation: [0, 0, boss ? 0.28 : 0.18], children: [0, 1] },
    { name: 'leg-right-shell', mesh: 0, translation: [0, -0.39, 0], scale: legScale },
    { name: 'boot-right', mesh: 2, translation: [0.14, -0.83, 0], scale: boss ? [0.56, 0.20, 0.42] : [0.42, 0.18, 0.30] },
    { name: 'leg-right', translation: [0, 0, boss ? -0.28 : -0.18], children: [3, 4] },
    { name: 'arm-left-upper', mesh: 0, translation: [0, -0.20, 0], scale: armScale },
    { name: 'gauntlet-left', mesh: 1, translation: [0.08, -0.46, 0], scale: boss ? [0.38, 0.28, 0.30] : [0.26, 0.22, 0.22] },
    { name: 'arm-left', translation: [0.02, boss ? 0.56 : 0.43, armZ], children: [6, 7] },
    { name: 'arm-right-upper', mesh: 0, translation: [0, -0.20, 0], scale: armScale },
    { name: 'gauntlet-right', mesh: 1, translation: [0.08, -0.46, 0], scale: boss ? [0.38, 0.28, 0.30] : [0.26, 0.22, 0.22] },
    { name: 'arm-right', translation: [0.02, boss ? 0.56 : 0.43, -armZ], children: [9, 10] },
    { name: 'backpack-core', mesh: 2, translation: [-0.20, 0, 0], scale: backpackScale },
    { name: 'backpack-glow', mesh: 4, translation: [-0.43, 0.08, 0], scale: boss ? [0.12, 0.38, 0.50] : [0.08, 0.26, 0.28] },
    { name: 'backpack', translation: [-0.18, boss ? 0.30 : 0.20, 0], children: [12, 13] },
    { name: 'helmet-shell', mesh: 1, translation: [0, 0, 0], scale: helmetScale },
    { name: 'helmet-visor', mesh: 3, translation: [boss ? 0.34 : 0.25, -0.02, 0], scale: boss ? [0.12, 0.22, 0.40] : [0.09, 0.18, 0.30] },
    { name: 'helmet', translation: [0.02, helmetY, 0], children: [15, 16] },
    { name: 'torso-suit', mesh: 0, translation: [0, 0, 0], scale: torsoScale },
    { name: 'chest-plate', mesh: 1, translation: [boss ? 0.38 : 0.27, 0.04, 0], scale: boss ? [0.14, 0.55, 0.64] : [0.10, 0.42, 0.40] },
    { name: 'chest-status', mesh: 4, translation: [boss ? 0.47 : 0.34, 0.12, -0.13], scale: boss ? [0.05, 0.14, 0.18] : [0.04, 0.09, 0.11] },
    { name: 'weapon-socket', translation: [boss ? 0.30 : 0.22, 0.18, -0.24] },
  ];

  const torsoChildren = [18, 19, 20, 17, 8, 11, 14, 21];

  if (role === 'assault') {
    nodes.push(
      { name: 'assault-ram-plate', mesh: 1, translation: [0.18, 0.28, 0.44], scale: [0.28, 0.16, 0.22] },
      { name: 'assault-breach-blade', mesh: 2, translation: [-0.08, -0.02, -0.48], scale: [0.40, 0.08, 0.12] },
    );
    torsoChildren.push(22, 23);
  } else if (role === 'suppressor') {
    nodes.push(
      { name: 'suppressor-shoulder-left', mesh: 1, translation: [0, 0.30, 0.58], scale: [0.50, 0.22, 0.24] },
      { name: 'suppressor-shoulder-right', mesh: 1, translation: [0, 0.30, -0.58], scale: [0.50, 0.22, 0.24] },
      { name: 'suppressor-feed-box', mesh: 2, translation: [-0.28, -0.10, 0.46], scale: [0.30, 0.32, 0.20] },
    );
    torsoChildren.push(22, 23, 24);
  } else if (role === 'technician') {
    nodes.push(
      { name: 'technician-mast', mesh: 2, translation: [-0.08, 0.78, 0], scale: [0.07, 0.54, 0.07] },
      { name: 'technician-sensor', mesh: 4, translation: [0.02, 1.06, 0], scale: [0.28, 0.05, 0.16] },
      { name: 'technician-tool-rack', mesh: 2, translation: [-0.25, 0.05, 0.34], scale: [0.18, 0.46, 0.14] },
    );
    torsoChildren.push(22, 23, 24);
  } else if (role === 'elite') {
    nodes.push(
      { name: 'elite-crest', mesh: 4, translation: [-0.02, 0.92, 0], scale: [0.12, 0.52, 0.10] },
      { name: 'elite-fin-left', mesh: 1, translation: [-0.10, 0.30, 0.60], scale: [0.30, 0.42, 0.10] },
      { name: 'elite-fin-right', mesh: 1, translation: [-0.10, 0.30, -0.60], scale: [0.30, 0.42, 0.10] },
    );
    torsoChildren.push(22, 23, 24);
  } else {
    nodes.push(
      { name: 'boss-shoulder-left', mesh: 1, translation: [-0.02, 0.44, 0.78], scale: [0.68, 0.32, 0.28] },
      { name: 'boss-shoulder-right', mesh: 1, translation: [-0.02, 0.44, -0.78], scale: [0.68, 0.32, 0.28] },
      { name: 'boss-reactor', mesh: 4, translation: [-0.54, 0.18, 0], scale: [0.16, 0.50, 0.62] },
      { name: 'boss-command-crest', mesh: 4, translation: [-0.04, 1.12, 0], scale: [0.18, 0.62, 0.12] },
    );
    torsoChildren.push(22, 23, 24, 25);
  }

  const torsoIndex = nodes.length;
  nodes.push({ name: 'torso', translation: [0, boss ? 0.44 : 0.32, 0], children: torsoChildren });
  const hipArmorIndex = nodes.length;
  nodes.push({ name: 'hip-armor', mesh: 1, translation: [0, 0, 0], scale: boss ? [0.68, 0.24, 0.68] : [0.46, 0.20, 0.46] });
  const hipIndex = nodes.length;
  nodes.push({ name: 'hip', translation: [0, hipY, 0], children: [hipArmorIndex, torsoIndex, 2, 5] });
  nodes.push({ name: 'enemy-rig', children: [hipIndex] });
  return nodes;
}

const outputs = [];
outputs.push(await writeAsset(
  'operators/operator-field-suit-lod1.glb',
  'operator-field-suit-lod1',
  operatorNodes(),
  materials([0.28, 0.45, 0.42, 1], [0.20, 0.80, 0.68]),
));

const enemyProfiles = [
  ['assault', 'enemies/enemy-assault-lod1.glb', [0.56, 0.18, 0.14, 1], [0.95, 0.33, 0.22]],
  ['suppressor', 'enemies/enemy-suppressor-lod1.glb', [0.52, 0.28, 0.15, 1], [0.95, 0.56, 0.22]],
  ['technician', 'enemies/enemy-technician-lod1.glb', [0.28, 0.24, 0.52, 1], [0.54, 0.48, 0.95]],
  ['elite', 'enemies/enemy-elite-lod1.glb', [0.58, 0.16, 0.32, 1], [0.98, 0.30, 0.58]],
  ['boss', 'bosses/enemy-boss-lod1.glb', [0.60, 0.12, 0.10, 1], [1.00, 0.24, 0.18]],
];

for (const [role, path, primary, accent] of enemyProfiles) {
  outputs.push(await writeAsset(path, `enemy-${role}-lod1`, enemyNodes(role), materials(primary, accent)));
}

console.log(
  'GRAPHICS_ASSETS_READY ' +
  outputs.map(item => `${item.relativePath}=${item.bytes}b/${item.nodes}n`).join(' ')
);
