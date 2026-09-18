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

  const hipY = boss ? 0.93 : elite ? 0.92 : 0.90;
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


function weaponMaterials(accent) {
  return [
    {
      name: 'weapon-shell',
      pbrMetallicRoughness: {
        baseColorFactor: [0.34, 0.40, 0.40, 1],
        metallicFactor: 0.86,
        roughnessFactor: 0.26,
      },
    },
    {
      name: 'weapon-dark',
      pbrMetallicRoughness: {
        baseColorFactor: [0.035, 0.045, 0.052, 1],
        metallicFactor: 0.92,
        roughnessFactor: 0.22,
      },
    },
    {
      name: 'weapon-accent-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [accent[0] * 0.42, accent[1] * 0.42, accent[2] * 0.42, 1],
        metallicFactor: 0.50,
        roughnessFactor: 0.18,
      },
      emissiveFactor: accent,
    },
  ];
}

function weaponNodes(id) {
  if (id === 'carbine') {
    return [
      { name: 'carbine-receiver', mesh: 0, translation: [0.38, 0, 0], scale: [0.78, 0.20, 0.22] },
      { name: 'carbine-stock', mesh: 1, translation: [-0.28, -0.02, 0], scale: [0.48, 0.16, 0.20] },
      { name: 'carbine-barrel', mesh: 1, translation: [1.04, 0.02, 0], scale: [0.58, 0.07, 0.07] },
      { name: 'carbine-magazine', mesh: 1, translation: [0.28, -0.26, 0], scale: [0.20, 0.38, 0.18] },
      { name: 'carbine-status-rail', mesh: 2, translation: [0.48, 0.16, 0], scale: [0.46, 0.05, 0.08] },
      { name: 'muzzle-socket', translation: [1.36, 0.02, 0] },
      { name: 'weapon-root', children: [0, 1, 2, 3, 4, 5] },
    ];
  }
  if (id === 'breacher') {
    return [
      { name: 'breacher-receiver', mesh: 0, translation: [0.30, 0, 0], scale: [0.68, 0.30, 0.42] },
      { name: 'breacher-stock', mesh: 1, translation: [-0.30, -0.02, 0], scale: [0.46, 0.22, 0.30] },
      { name: 'breacher-twin-barrel', mesh: 1, translation: [0.96, 0.08, 0.12], scale: [0.72, 0.08, 0.10] },
      { name: 'breacher-barrel-lower', mesh: 1, translation: [0.96, 0.08, -0.12], scale: [0.72, 0.08, 0.10] },
      { name: 'breacher-feed', mesh: 1, translation: [0.20, -0.30, 0], scale: [0.28, 0.34, 0.34] },
      { name: 'breacher-pump-glow', mesh: 2, translation: [0.58, 0.20, 0], scale: [0.34, 0.06, 0.30] },
      { name: 'muzzle-socket', translation: [1.36, 0.08, 0] },
      { name: 'weapon-root', children: [0, 1, 2, 3, 4, 5, 6] },
    ];
  }
  return [
    { name: 'rail-receiver', mesh: 0, translation: [0.40, 0, 0], scale: [0.92, 0.22, 0.30] },
    { name: 'rail-capacitor', mesh: 1, translation: [-0.18, -0.18, 0], scale: [0.42, 0.34, 0.26] },
    { name: 'rail-upper-spine', mesh: 1, translation: [0.88, 0.16, 0.16], scale: [1.18, 0.06, 0.07] },
    { name: 'rail-lower-spine', mesh: 1, translation: [0.88, 0.16, -0.16], scale: [1.18, 0.06, 0.07] },
    { name: 'rail-coil', mesh: 2, translation: [0.54, 0.04, 0], scale: [0.56, 0.08, 0.34] },
    { name: 'rail-coil-forward', mesh: 2, translation: [1.10, 0.04, 0], scale: [0.34, 0.07, 0.30] },
    { name: 'muzzle-socket', translation: [1.52, 0.08, 0] },
    { name: 'weapon-root', children: [0, 1, 2, 3, 4, 5, 6] },
  ];
}


function environmentMaterials() {
  return [
    {
      name: 'refinery-structural',
      pbrMetallicRoughness: {
        baseColorFactor: [0.22, 0.17, 0.12, 1],
        metallicFactor: 0.88,
        roughnessFactor: 0.34,
      },
    },
    {
      name: 'refinery-shell',
      pbrMetallicRoughness: {
        baseColorFactor: [0.38, 0.30, 0.21, 1],
        metallicFactor: 0.78,
        roughnessFactor: 0.42,
      },
    },
    {
      name: 'refinery-hazard-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.54, 0.25, 0.08, 1],
        metallicFactor: 0.42,
        roughnessFactor: 0.28,
      },
      emissiveFactor: [0.95, 0.36, 0.08],
    },
    {
      name: 'refinery-screen-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.04, 0.16, 0.18, 1],
        metallicFactor: 0.28,
        roughnessFactor: 0.18,
      },
      emissiveFactor: [0.12, 0.78, 0.82],
    },
  ];
}

function refineryNodes(kind, lod) {
  const detail = lod === 1;
  if (kind === 'floor') {
    const nodes = [
      { name: 'refinery-floor-panel', mesh: 0, translation: [0, 0.03, 0], scale: [3.8, 0.08, 3.8] },
      { name: 'refinery-floor-seam', mesh: 2, translation: [0, 0.075, 0], scale: [3.2, 0.025, 0.06] },
    ];
    if (detail) {
      nodes.push(
        { name: 'refinery-floor-cross-seam', mesh: 2, translation: [0, 0.076, 0], scale: [0.06, 0.025, 3.2] },
        { name: 'refinery-floor-service-plate', mesh: 1, translation: [1.1, 0.09, -1.0], scale: [0.72, 0.035, 0.48] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'floorGrate') {
    const nodes = [
      { name: 'refinery-floor-service-grate', mesh: 0, translation: [0, 0.035, 0], scale: [3.8, 0.07, 3.8] },
      { name: 'refinery-floor-service-grate-frame-x', mesh: 1, translation: [0, 0.082, 0], scale: [3.30, 0.035, 0.12] },
      { name: 'refinery-floor-service-grate-frame-z', mesh: 1, translation: [0, 0.083, 0], scale: [0.12, 0.035, 3.30] },
      { name: 'refinery-floor-service-grate-hazard', mesh: 2, translation: [1.26, 0.088, -1.26], scale: [0.64, 0.025, 0.18] },
    ];
    if (detail) {
      nodes.push(
        { name: 'refinery-floor-service-grate-slat-a', mesh: 0, translation: [-0.80, 0.086, 0], scale: [0.10, 0.025, 2.65] },
        { name: 'refinery-floor-service-grate-slat-b', mesh: 0, translation: [0.00, 0.086, 0], scale: [0.10, 0.025, 2.65] },
        { name: 'refinery-floor-service-grate-slat-c', mesh: 0, translation: [0.80, 0.086, 0], scale: [0.10, 0.025, 2.65] },
        { name: 'refinery-floor-service-grate-service-light', mesh: 3, translation: [-1.28, 0.10, 1.22], scale: [0.22, 0.035, 0.36] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'bulkhead') {
    const nodes = [
      { name: 'refinery-bulkhead-left', mesh: 0, translation: [0, 1.45, -1.75], scale: [0.44, 2.9, 0.38] },
      { name: 'refinery-bulkhead-right', mesh: 0, translation: [0, 1.45, 1.75], scale: [0.44, 2.9, 0.38] },
      { name: 'refinery-bulkhead-cap', mesh: 1, translation: [0, 2.75, 0], scale: [0.52, 0.34, 3.8] },
      { name: 'refinery-bulkhead-hazard', mesh: 2, translation: [0.24, 1.28, 0], scale: [0.08, 0.12, 2.8] },
    ];
    if (detail) {
      nodes.push(
        { name: 'refinery-bulkhead-brace-left', mesh: 1, translation: [0.06, 1.45, -1.05], scale: [0.30, 2.0, 0.16] },
        { name: 'refinery-bulkhead-brace-right', mesh: 1, translation: [0.06, 1.45, 1.05], scale: [0.30, 2.0, 0.16] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'processor') {
    const nodes = [
      { name: 'refinery-processor-base', mesh: 0, translation: [0, 0.28, 0], scale: [2.8, 0.56, 2.2] },
      { name: 'refinery-processor-core', mesh: 1, translation: [0, 1.55, 0], scale: [1.9, 2.5, 1.55] },
      { name: 'refinery-processor-status', mesh: 3, translation: [0.98, 1.72, 0], scale: [0.08, 0.56, 0.74] },
      { name: 'refinery-processor-vent', mesh: 2, translation: [0.62, 2.55, 0], scale: [0.58, 0.10, 1.0] },
      { name: 'refinery-processor-ore-intake', mesh: 0, translation: [-1.34, 1.18, 0], scale: [0.78, 0.92, 1.02] },
      { name: 'refinery-processor-exhaust-stack', mesh: 1, translation: [-0.62, 3.10, 0.54], scale: [0.42, 1.34, 0.42] },
      { name: 'refinery-processor-hazard-band', mesh: 2, translation: [0, 0.62, 1.13], scale: [1.70, 0.16, 0.08] },
    ];
    if (detail) {
      nodes.push(
        { name: 'refinery-processor-sidecar-left', mesh: 0, translation: [-0.30, 1.25, 1.16], scale: [1.0, 1.55, 0.46] },
        { name: 'refinery-processor-sidecar-right', mesh: 0, translation: [-0.30, 1.25, -1.16], scale: [1.0, 1.55, 0.46] },
        { name: 'refinery-processor-service-line', mesh: 2, translation: [1.12, 0.66, 0], scale: [0.16, 0.16, 1.45] },
        { name: 'refinery-processor-rib-left', mesh: 0, translation: [0.28, 1.45, 0.86], scale: [0.18, 1.92, 0.12] },
        { name: 'refinery-processor-rib-right', mesh: 0, translation: [0.28, 1.45, -0.86], scale: [0.18, 1.92, 0.12] },
        { name: 'refinery-processor-maintenance-screen', mesh: 3, translation: [1.02, 1.06, -0.62], scale: [0.06, 0.34, 0.42] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'pipeRack') {
    const nodes = [
      { name: 'refinery-pipe-rack-spine', mesh: 0, translation: [0, 1.45, 0], scale: [3.8, 0.18, 0.22] },
      { name: 'refinery-pipe-main-a', mesh: 1, translation: [0, 1.12, 0.38], scale: [3.7, 0.18, 0.18] },
      { name: 'refinery-pipe-main-b', mesh: 1, translation: [0, 1.72, -0.38], scale: [3.7, 0.18, 0.18] },
      { name: 'refinery-pipe-warning', mesh: 2, translation: [0, 1.44, 0], scale: [2.2, 0.06, 0.30] },
    ];
    if (detail) {
      nodes.push(
        { name: 'refinery-pipe-support-left', mesh: 0, translation: [-1.45, 0.72, 0], scale: [0.18, 1.44, 0.82] },
        { name: 'refinery-pipe-support-right', mesh: 0, translation: [1.45, 0.72, 0], scale: [0.18, 1.44, 0.82] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'wallPanel') {
    const nodes = [
      { name: 'refinery-wall-service-panel-shell', mesh: 1, translation: [0, 1.28, 0], scale: [0.18, 2.56, 2.75] },
      { name: 'refinery-wall-service-panel-frame-left', mesh: 0, translation: [0.10, 1.28, -1.22], scale: [0.24, 2.70, 0.16] },
      { name: 'refinery-wall-service-panel-frame-right', mesh: 0, translation: [0.10, 1.28, 1.22], scale: [0.24, 2.70, 0.16] },
      { name: 'refinery-wall-service-panel-signage', mesh: 2, translation: [0.14, 1.86, 0.58], scale: [0.05, 0.28, 0.72] },
      { name: 'refinery-wall-service-panel-status', mesh: 3, translation: [0.14, 0.82, -0.68], scale: [0.05, 0.24, 0.44] },
      { name: 'refinery-wall-service-panel-vent', mesh: 0, translation: [0.14, 1.24, 0], scale: [0.06, 0.52, 0.68] },
    ];
    if (detail) {
      nodes.push(
        { name: 'refinery-wall-service-panel-vent-upper', mesh: 0, translation: [0.14, 1.48, 0], scale: [0.07, 0.07, 0.72] },
        { name: 'refinery-wall-service-panel-vent-lower', mesh: 0, translation: [0.14, 1.00, 0], scale: [0.07, 0.07, 0.72] },
        { name: 'refinery-wall-service-panel-junction', mesh: 1, translation: [0.16, 0.52, 0.62], scale: [0.10, 0.36, 0.42] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'cableTray') {
    const nodes = [
      { name: 'refinery-cable-tray-spine', mesh: 0, translation: [0, 1.34, 0], scale: [0.14, 0.16, 3.20] },
      { name: 'refinery-cable-tray-power', mesh: 2, translation: [0.13, 1.32, 0.30], scale: [0.08, 0.08, 2.92] },
      { name: 'refinery-cable-tray-data', mesh: 3, translation: [0.13, 1.50, -0.26], scale: [0.07, 0.07, 2.72] },
      { name: 'refinery-cable-tray-clamp', mesh: 1, translation: [0.08, 1.40, 0], scale: [0.20, 0.34, 0.16] },
    ];
    if (detail) {
      nodes.push(
        { name: 'refinery-cable-tray-clamp-forward', mesh: 1, translation: [0.08, 1.40, 1.18], scale: [0.20, 0.34, 0.12] },
        { name: 'refinery-cable-tray-clamp-aft', mesh: 1, translation: [0.08, 1.40, -1.18], scale: [0.20, 0.34, 0.12] },
        { name: 'refinery-cable-tray-drop', mesh: 2, translation: [0.12, 0.76, -1.08], scale: [0.08, 1.08, 0.08] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'serviceConduit') {
    const nodes = [
      { name: 'refinery-service-conduit-trunk', mesh: 0, translation: [0, 0.30, 0], scale: [2.8, 0.18, 0.22] },
      { name: 'refinery-service-conduit-upper', mesh: 1, translation: [0, 0.68, 0], scale: [2.35, 0.12, 0.16] },
      { name: 'refinery-service-conduit-valve', mesh: 2, translation: [0.72, 0.72, 0], scale: [0.14, 0.34, 0.38] },
      { name: 'refinery-service-conduit-status', mesh: 3, translation: [-0.72, 0.70, 0.18], scale: [0.18, 0.10, 0.06] },
    ];
    if (detail) {
      nodes.push(
        { name: 'refinery-service-conduit-support-left', mesh: 0, translation: [-1.05, 0.18, 0], scale: [0.16, 0.36, 0.48] },
        { name: 'refinery-service-conduit-support-right', mesh: 0, translation: [1.05, 0.18, 0], scale: [0.16, 0.36, 0.48] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'gantry') {
    const nodes = [
      { name: 'refinery-smelter-gantry-left', mesh: 0, translation: [-2.60, 1.78, 0], scale: [0.36, 3.56, 0.58] },
      { name: 'refinery-smelter-gantry-right', mesh: 0, translation: [2.60, 1.78, 0], scale: [0.36, 3.56, 0.58] },
      { name: 'refinery-smelter-gantry-beam', mesh: 1, translation: [0, 3.46, 0], scale: [5.80, 0.46, 0.82] },
      { name: 'refinery-smelter-gantry-hazard', mesh: 2, translation: [0, 3.17, 0.43], scale: [3.90, 0.10, 0.08] },
      { name: 'refinery-smelter-gantry-carriage', mesh: 1, translation: [0.72, 2.92, 0], scale: [0.92, 0.42, 0.62] },
      { name: 'refinery-smelter-gantry-status', mesh: 3, translation: [1.48, 3.45, 0.44], scale: [0.28, 0.16, 0.06] },
    ];
    if (detail) {
      nodes.push(
        { name: 'refinery-smelter-gantry-service-rail', mesh: 0, translation: [0, 3.03, -0.42], scale: [4.60, 0.12, 0.12] },
        { name: 'refinery-smelter-gantry-drop-line', mesh: 2, translation: [0.72, 2.15, 0], scale: [0.10, 1.28, 0.10] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'crate') {
    const nodes = [
      { name: 'refinery-crate-shell', mesh: 1, translation: [0, 0.42, 0], scale: [1.05, 0.84, 0.82] },
      { name: 'refinery-crate-band', mesh: 0, translation: [0.10, 0.43, 0], scale: [0.12, 0.90, 0.90] },
      { name: 'refinery-crate-marker', mesh: 2, translation: [0.54, 0.54, 0], scale: [0.04, 0.18, 0.44] },
    ];
    if (detail) nodes.push({ name: 'refinery-crate-latch', mesh: 0, translation: [0.56, 0.27, 0], scale: [0.05, 0.16, 0.20] });
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  const nodes = [
    { name: 'refinery-terminal-pedestal', mesh: 0, translation: [0, 0.62, 0], scale: [0.58, 1.24, 0.72] },
    { name: 'refinery-terminal-console', mesh: 1, translation: [0.20, 1.34, 0], scale: [0.72, 0.24, 0.88] },
    { name: 'refinery-terminal-screen', mesh: 3, translation: [0.57, 1.42, 0], scale: [0.04, 0.32, 0.62] },
    { name: 'objective-beacon-mount', mesh: 2, translation: [0, 1.78, 0], scale: [0.16, 0.10, 0.16] },
  ];
  if (detail) nodes.push({ name: 'refinery-terminal-side-light', mesh: 2, translation: [0.28, 0.86, -0.38], scale: [0.08, 0.34, 0.08] });
  nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
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

const weaponProfiles = [
  ['carbine', 'weapons/weapon-carbine-lod1.glb', [0.58, 0.90, 0.42]],
  ['breacher', 'weapons/weapon-breacher-lod1.glb', [1.00, 0.63, 0.28]],
  ['rail', 'weapons/weapon-rail-lod1.glb', [0.34, 0.78, 1.00]],
];

for (const [weapon, path, accent] of weaponProfiles) {
  outputs.push(await writeAsset(path, `weapon-${weapon}-lod1`, weaponNodes(weapon), weaponMaterials(accent)));
}


const refineryProfiles = [
  ['floor', 'refinery-floor-panel'],
  ['floorGrate', 'refinery-floor-service-grate'],
  ['bulkhead', 'refinery-bulkhead'],
  ['processor', 'refinery-processor'],
  ['pipeRack', 'refinery-pipe-rack'],
  ['wallPanel', 'refinery-wall-service-panel'],
  ['cableTray', 'refinery-cable-tray'],
  ['serviceConduit', 'refinery-service-conduit'],
  ['gantry', 'refinery-smelter-gantry'],
  ['crate', 'refinery-crate'],
  ['terminal', 'refinery-terminal'],
];

for (const [kind, id] of refineryProfiles) {
  for (const lod of [1, 2]) {
    outputs.push(await writeAsset(
      `environments/${id}-lod${lod}.glb`,
      `${id}-lod${lod}`,
      refineryNodes(kind, lod),
      environmentMaterials(),
    ));
  }
}

console.log(
  'GRAPHICS_ASSETS_READY ' +
  outputs.map(item => `${item.relativePath}=${item.bytes}b/${item.nodes}n`).join(' ')
);
