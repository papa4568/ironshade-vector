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

function operatorClassNodes(operatorClass) {
  const nodes = operatorNodes();
  const root = nodes.pop();
  const torsoIndex = nodes.findIndex(node => node.name === 'torso');
  const backpackIndex = nodes.findIndex(node => node.name === 'backpack');
  const helmetIndex = nodes.findIndex(node => node.name === 'helmet');
  const leftLegIndex = nodes.findIndex(node => node.name === 'leg-left');
  const rightLegIndex = nodes.findIndex(node => node.name === 'leg-right');
  const attach = (parentIndex, node) => {
    const index = nodes.length;
    nodes.push(node);
    nodes[parentIndex].children ??= [];
    nodes[parentIndex].children.push(index);
    return index;
  };

  if (operatorClass === 'vanguard') {
    attach(torsoIndex, { name: 'vanguard-breacher-pauldrons', mesh: 1, translation: [-0.02, 0.32, 0], scale: [0.38, 0.22, 0.92] });
    attach(torsoIndex, { name: 'vanguard-ram-plate', mesh: 1, translation: [0.34, 0.08, 0], scale: [0.18, 0.52, 0.60] });
    attach(torsoIndex, { name: 'vanguard-guard-light', mesh: 4, translation: [0.44, 0.20, 0], scale: [0.05, 0.18, 0.30] });
    attach(backpackIndex, { name: 'vanguard-reactive-pack', mesh: 2, translation: [-0.16, 0.04, 0], scale: [0.34, 0.60, 0.58] });
  } else if (operatorClass === 'vector') {
    attach(torsoIndex, { name: 'vector-stabilizer-left', mesh: 1, translation: [-0.14, 0.20, 0.55], scale: [0.30, 0.08, 0.22] });
    attach(torsoIndex, { name: 'vector-stabilizer-right', mesh: 1, translation: [-0.14, 0.20, -0.55], scale: [0.30, 0.08, 0.22] });
    attach(backpackIndex, { name: 'vector-thruster-spine', mesh: 4, translation: [-0.34, 0.08, 0], scale: [0.10, 0.64, 0.18] });
    attach(leftLegIndex, { name: 'vector-calf-thruster-left', mesh: 4, translation: [-0.18, -0.42, 0], scale: [0.08, 0.28, 0.10] });
    attach(rightLegIndex, { name: 'vector-calf-thruster-right', mesh: 4, translation: [-0.18, -0.42, 0], scale: [0.08, 0.28, 0.10] });
  } else if (operatorClass === 'systems') {
    attach(backpackIndex, { name: 'systems-relay-left', mesh: 4, translation: [-0.30, 0.22, 0.28], scale: [0.09, 0.56, 0.09] });
    attach(backpackIndex, { name: 'systems-relay-right', mesh: 4, translation: [-0.30, 0.22, -0.28], scale: [0.09, 0.56, 0.09] });
    attach(backpackIndex, { name: 'systems-capacitor-bank', mesh: 2, translation: [-0.30, -0.18, 0], scale: [0.22, 0.34, 0.58] });
    attach(helmetIndex, { name: 'systems-sensor-crown', mesh: 4, translation: [-0.04, 0.38, 0], scale: [0.08, 0.28, 0.08] });
  }

  nodes.push(root);
  return nodes;
}

function operatorClassMobileNodes(operatorClass) {
  const marker = operatorClass === 'vanguard'
    ? { name: 'vanguard-ram-plate', mesh: 1, translation: [0.34, 0.05, 0], scale: [0.18, 0.50, 0.62] }
    : operatorClass === 'vector'
      ? { name: 'vector-stabilizer-left', mesh: 4, translation: [-0.24, 0.11, 0], scale: [0.10, 0.58, 0.34] }
      : { name: 'systems-relay-left', mesh: 4, translation: [-0.30, 0.16, 0], scale: [0.08, 0.54, 0.50] };

  return [
    { name: 'leg-left', mesh: 0, translation: [0, -0.455, 0.18], scale: [0.22, 0.91, 0.24] },
    { name: 'leg-right', mesh: 0, translation: [0, -0.455, -0.18], scale: [0.22, 0.91, 0.24] },
    { name: 'arm-left', mesh: 0, translation: [0.01, 0.08, 0.42], scale: [0.18, 0.48, 0.18] },
    { name: 'arm-right', mesh: 0, translation: [0.01, 0.08, -0.42], scale: [0.18, 0.48, 0.18] },
    { name: 'helmet', mesh: 1, translation: [0.02, 0.43, 0], scale: [0.42, 0.44, 0.40] },
    { name: 'backpack', mesh: 2, translation: [-0.22, 0.05, 0], scale: operatorClass === 'vanguard' ? [0.28, 0.52, 0.50] : operatorClass === 'systems' ? [0.24, 0.56, 0.48] : [0.20, 0.46, 0.36] },
    { name: 'weapon-socket', translation: [0.20, 0.08, -0.24] },
    marker,
    { name: 'torso-shell-mobile', mesh: 0, translation: [0, 0, 0], scale: operatorClass === 'vanguard' ? [0.62, 0.70, 0.62] : operatorClass === 'vector' ? [0.50, 0.64, 0.48] : [0.54, 0.66, 0.54] },
    { name: 'torso', translation: [0, 0.33, 0], children: [8, 2, 3, 4, 5, 6, 7] },
    { name: 'hip-shell-mobile', mesh: 1, translation: [0, 0, 0], scale: [0.46, 0.20, 0.46] },
    { name: 'hip', translation: [0, 0.91, 0], children: [10, 9, 0, 1] },
    { name: 'operator-rig', children: [11] },
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



function enemyMobileNodes(role) {
  const boss = role === 'boss';
  const suppressor = role === 'suppressor';
  const technician = role === 'technician';
  const elite = role === 'elite';

  const marker = role === 'assault'
    ? { name: 'assault-ram-plate', mesh: 1, translation: [0.31, 0.08, 0], scale: [0.18, 0.42, 0.54] }
    : role === 'suppressor'
      ? { name: 'suppressor-shoulder-left', mesh: 1, translation: [-0.02, 0.27, 0], scale: [0.42, 0.20, 0.96] }
      : role === 'technician'
        ? { name: 'technician-mast', mesh: 4, translation: [-0.08, 0.58, 0], scale: [0.07, 0.48, 0.07] }
        : role === 'elite'
          ? { name: 'elite-crest', mesh: 4, translation: [-0.02, 0.61, 0], scale: [0.10, 0.44, 0.09] }
          : { name: 'boss-command-crest', mesh: 4, translation: [-0.04, 0.78, 0], scale: [0.16, 0.58, 0.11] };

  const hipY = boss ? 1.03 : 0.91;
  const legScale = boss ? [0.31, 1.03, 0.32] : suppressor ? [0.28, 0.91, 0.29] : technician ? [0.20, 0.91, 0.20] : [0.24, 0.91, 0.24];
  const torsoScale = boss ? [0.88, 0.82, 0.84] : suppressor ? [0.70, 0.68, 0.70] : technician ? [0.44, 0.62, 0.42] : elite ? [0.62, 0.70, 0.58] : [0.56, 0.64, 0.52];
  const armZ = boss ? 0.64 : suppressor ? 0.53 : technician ? 0.34 : elite ? 0.48 : 0.40;
  const armScale = boss ? [0.25, 0.54, 0.25] : suppressor ? [0.23, 0.48, 0.23] : technician ? [0.15, 0.44, 0.15] : [0.18, 0.46, 0.18];

  return [
    { name: 'leg-left', mesh: 0, translation: [0, -hipY / 2, boss ? 0.28 : 0.18], scale: legScale },
    { name: 'leg-right', mesh: 0, translation: [0, -hipY / 2, boss ? -0.28 : -0.18], scale: legScale },
    { name: 'arm-left', mesh: 0, translation: [0.02, boss ? 0.10 : 0.07, armZ], scale: armScale },
    { name: 'arm-right', mesh: 0, translation: [0.02, boss ? 0.10 : 0.07, -armZ], scale: armScale },
    { name: 'helmet', mesh: 1, translation: [0.02, boss ? 0.56 : 0.43, 0], scale: boss ? [0.58, 0.54, 0.56] : suppressor ? [0.49, 0.46, 0.49] : technician ? [0.37, 0.50, 0.35] : [0.45, 0.47, 0.42] },
    { name: 'backpack', mesh: 2, translation: [-0.22, 0.05, 0], scale: boss ? [0.42, 0.60, 0.68] : suppressor ? [0.35, 0.55, 0.60] : technician ? [0.23, 0.62, 0.34] : [0.23, 0.45, 0.42] },
    { name: 'weapon-socket', translation: [0.22, 0.08, -0.24] },
    marker,
    { name: 'torso-shell-mobile', mesh: 0, translation: [0, 0, 0], scale: torsoScale },
    { name: 'torso', translation: [0, boss ? 0.42 : 0.32, 0], children: [8, 2, 3, 4, 5, 6, 7] },
    { name: 'hip-shell-mobile', mesh: 1, translation: [0, 0, 0], scale: boss ? [0.66, 0.24, 0.66] : [0.46, 0.20, 0.46] },
    { name: 'hip', translation: [0, hipY, 0], children: [10, 9, 0, 1] },
    { name: 'enemy-rig', children: [11] },
  ];
}

function spinHabitatEnemyRole(identity) {
  if (identity === 'spokeMarksman') return 'suppressor';
  if (identity === 'axisShieldBoarder') return 'assault';
  return 'technician';
}

function spinHabitatEnemyMarker(identity, lod) {
  const mobile = lod === 2;
  if (identity === 'spokeMarksman') {
    return mobile
      ? [
          { name: 'spin-habitat-spoke-marksman-brace', mesh: 1, translation: [-0.08, 0.28, 0], scale: [0.40, 0.18, 1.10] },
          { name: 'spin-habitat-spoke-marksman-optic', mesh: 4, translation: [0.08, 0.62, 0], scale: [0.10, 0.34, 0.10] },
        ]
      : [
          { name: 'spin-habitat-spoke-marksman-brace', mesh: 1, translation: [-0.14, 0.30, 0], scale: [0.54, 0.16, 1.18] },
          { name: 'spin-habitat-spoke-marksman-optic', mesh: 4, translation: [0.04, 0.82, 0], scale: [0.08, 0.50, 0.08] },
          { name: 'spin-habitat-spoke-marksman-counterweight', mesh: 2, translation: [-0.38, 0.04, 0], scale: [0.22, 0.36, 0.62] },
        ];
  }
  if (identity === 'spinTrimSpecialist') {
    return mobile
      ? [
          { name: 'spin-habitat-spin-trim-gyro', mesh: 4, translation: [-0.24, 0.24, 0], scale: [0.12, 0.70, 0.54] },
          { name: 'spin-habitat-spin-trim-index', mesh: 4, translation: [0.32, 0.16, 0], scale: [0.05, 0.34, 0.30] },
        ]
      : [
          { name: 'spin-habitat-spin-trim-gyro-left', mesh: 4, translation: [-0.30, 0.24, 0.30], scale: [0.10, 0.72, 0.12] },
          { name: 'spin-habitat-spin-trim-gyro-right', mesh: 4, translation: [-0.30, 0.24, -0.30], scale: [0.10, 0.72, 0.12] },
          { name: 'spin-habitat-spin-trim-index', mesh: 4, translation: [0.34, 0.16, 0], scale: [0.05, 0.38, 0.34] },
        ];
  }
  if (identity === 'ringDroneCarrier') {
    return mobile
      ? [
          { name: 'spin-habitat-ring-drone-rack', mesh: 2, translation: [-0.28, 0.20, 0], scale: [0.24, 0.56, 1.02] },
          { name: 'spin-habitat-ring-drone-beacon', mesh: 4, translation: [-0.34, 0.56, 0], scale: [0.08, 0.20, 0.54] },
        ]
      : [
          { name: 'spin-habitat-ring-drone-rack', mesh: 2, translation: [-0.32, 0.18, 0], scale: [0.28, 0.56, 1.08] },
          { name: 'spin-habitat-ring-drone-pod-left', mesh: 1, translation: [-0.34, 0.18, 0.54], scale: [0.24, 0.30, 0.30] },
          { name: 'spin-habitat-ring-drone-pod-right', mesh: 1, translation: [-0.34, 0.18, -0.54], scale: [0.24, 0.30, 0.30] },
          { name: 'spin-habitat-ring-drone-beacon', mesh: 4, translation: [-0.38, 0.58, 0], scale: [0.08, 0.18, 0.58] },
        ];
  }
  return mobile
    ? [
        { name: 'spin-habitat-axis-shield', mesh: 1, translation: [0.28, 0.12, 0.52], scale: [0.16, 0.76, 0.62] },
        { name: 'spin-habitat-axis-stabilizer', mesh: 4, translation: [-0.26, 0.16, 0], scale: [0.10, 0.62, 0.52] },
      ]
    : [
        { name: 'spin-habitat-axis-shield', mesh: 1, translation: [0.34, 0.10, 0.56], scale: [0.16, 0.86, 0.68] },
        { name: 'spin-habitat-axis-shield-rim', mesh: 4, translation: [0.43, 0.12, 0.56], scale: [0.04, 0.70, 0.54] },
        { name: 'spin-habitat-axis-stabilizer', mesh: 4, translation: [-0.30, 0.18, 0], scale: [0.10, 0.66, 0.56] },
      ];
}

function spinHabitatEnemyNodes(identity, lod) {
  const nodes = lod === 2 ? enemyMobileNodes(spinHabitatEnemyRole(identity)) : enemyNodes(spinHabitatEnemyRole(identity));
  const root = nodes.pop();
  const torsoIndex = nodes.findIndex(node => node.name === 'torso');
  const backpackIndex = nodes.findIndex(node => node.name === 'backpack');
  const helmetIndex = nodes.findIndex(node => node.name === 'helmet');
  const markers = spinHabitatEnemyMarker(identity, lod);
  for (const marker of markers) {
    const index = nodes.length;
    nodes.push(marker);
    const parentIndex = marker.name.includes('optic') ? helmetIndex : marker.name.includes('drone') || marker.name.includes('gyro') || marker.name.includes('stabilizer') ? backpackIndex : torsoIndex;
    nodes[parentIndex].children ??= [];
    nodes[parentIndex].children.push(index);
  }
  nodes.push(root);
  return nodes;
}


function weaponMobileNodes(id) {
  if (id === 'carbine') {
    return [
      { name: 'carbine-receiver', mesh: 0, translation: [0.38, 0, 0], scale: [0.78, 0.20, 0.22] },
      { name: 'carbine-magazine', mesh: 1, translation: [0.24, -0.25, 0], scale: [0.18, 0.34, 0.17] },
      { name: 'carbine-barrel', mesh: 1, translation: [1.03, 0.02, 0], scale: [0.56, 0.07, 0.07] },
      { name: 'muzzle-socket', translation: [1.34, 0.02, 0] },
      { name: 'weapon-root', children: [0, 1, 2, 3] },
    ];
  }
  if (id === 'breacher') {
    return [
      { name: 'breacher-receiver', mesh: 0, translation: [0.30, 0, 0], scale: [0.66, 0.28, 0.40] },
      { name: 'breacher-twin-barrel', mesh: 1, translation: [0.96, 0.08, 0], scale: [0.70, 0.09, 0.24] },
      { name: 'breacher-feed', mesh: 2, translation: [0.18, -0.28, 0], scale: [0.25, 0.30, 0.30] },
      { name: 'muzzle-socket', translation: [1.34, 0.08, 0] },
      { name: 'weapon-root', children: [0, 1, 2, 3] },
    ];
  }
  return [
    { name: 'rail-receiver', mesh: 0, translation: [0.40, 0, 0], scale: [0.90, 0.20, 0.28] },
    { name: 'rail-coil', mesh: 2, translation: [0.70, 0.07, 0], scale: [0.92, 0.07, 0.30] },
    { name: 'rail-spine', mesh: 1, translation: [1.14, 0.12, 0], scale: [0.80, 0.05, 0.10] },
    { name: 'muzzle-socket', translation: [1.54, 0.08, 0] },
    { name: 'weapon-root', children: [0, 1, 2, 3] },
  ];
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

function damagedVesselMaterials() {
  return [
    {
      name: 'damaged-vessel-hull',
      pbrMetallicRoughness: {
        baseColorFactor: [0.24, 0.22, 0.20, 1],
        metallicFactor: 0.84,
        roughnessFactor: 0.46,
      },
    },
    {
      name: 'damaged-vessel-scarred-dark',
      pbrMetallicRoughness: {
        baseColorFactor: [0.075, 0.065, 0.062, 1],
        metallicFactor: 0.78,
        roughnessFactor: 0.58,
      },
    },
    {
      name: 'damaged-vessel-warning-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.38, 0.10, 0.05, 1],
        metallicFactor: 0.42,
        roughnessFactor: 0.32,
      },
      emissiveFactor: [0.92, 0.24, 0.10],
    },
    {
      name: 'damaged-vessel-salvage-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.04, 0.14, 0.16, 1],
        metallicFactor: 0.32,
        roughnessFactor: 0.24,
      },
      emissiveFactor: [0.10, 0.62, 0.66],
    },
  ];
}


function parallaxMaterials() {
  return [
    {
      name: 'parallax-structural',
      pbrMetallicRoughness: {
        baseColorFactor: [0.14, 0.15, 0.20, 1],
        metallicFactor: 0.90,
        roughnessFactor: 0.32,
      },
    },
    {
      name: 'parallax-reference-shell',
      pbrMetallicRoughness: {
        baseColorFactor: [0.34, 0.35, 0.43, 1],
        metallicFactor: 0.72,
        roughnessFactor: 0.38,
      },
    },
    {
      name: 'parallax-alignment-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.22, 0.15, 0.42, 1],
        metallicFactor: 0.48,
        roughnessFactor: 0.24,
      },
      emissiveFactor: [0.58, 0.42, 0.96],
    },
    {
      name: 'parallax-reference-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.04, 0.16, 0.20, 1],
        metallicFactor: 0.36,
        roughnessFactor: 0.20,
      },
      emissiveFactor: [0.18, 0.76, 0.88],
    },
  ];
}

function parallaxNodes(kind, lod) {
  const detail = lod === 1;

  if (kind === 'pylon') {
    const nodes = [
      { name: 'parallax-baseline-pylon-base', mesh: 0, translation: [0, 0.22, 0], scale: [1.45, 0.44, 1.45] },
      { name: 'parallax-baseline-pylon-spine', mesh: 1, translation: [0, 2.28, 0], scale: [0.42, 4.10, 0.42] },
      { name: 'parallax-baseline-pylon-cap', mesh: 2, translation: [0, 4.42, 0], scale: [0.96, 0.18, 0.96] },
      { name: 'parallax-baseline-pylon-reference-strip', mesh: 3, translation: [0.24, 2.30, 0], scale: [0.08, 2.48, 0.18] },
    ];
    if (detail) {
      nodes.push(
        { name: 'parallax-baseline-pylon-ring-a', mesh: 2, translation: [0, 1.32, 0], scale: [1.08, 0.12, 1.08] },
        { name: 'parallax-baseline-pylon-ring-b', mesh: 2, translation: [0, 3.22, 0], scale: [1.08, 0.12, 1.08] },
        { name: 'parallax-baseline-pylon-calibration-fin', mesh: 1, translation: [-0.38, 2.48, 0], scale: [0.18, 1.42, 0.82] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'frame') {
    const nodes = [
      { name: 'parallax-reference-frame-left', mesh: 0, translation: [0, 1.90, -2.25], scale: [0.40, 3.80, 0.40] },
      { name: 'parallax-reference-frame-right', mesh: 0, translation: [0, 1.90, 2.25], scale: [0.40, 3.80, 0.40] },
      { name: 'parallax-reference-frame-crown', mesh: 1, translation: [0, 3.64, 0], scale: [0.50, 0.34, 5.00] },
      { name: 'parallax-reference-frame-baseline', mesh: 2, translation: [0.28, 2.10, 0], scale: [0.08, 0.12, 3.86] },
    ];
    if (detail) {
      nodes.push(
        { name: 'parallax-reference-frame-lattice-left', mesh: 1, translation: [0.12, 1.92, -1.42], scale: [0.18, 2.78, 0.18] },
        { name: 'parallax-reference-frame-lattice-right', mesh: 1, translation: [0.12, 1.92, 1.42], scale: [0.18, 2.78, 0.18] },
        { name: 'parallax-reference-frame-readout', mesh: 3, translation: [0.31, 3.16, 1.52], scale: [0.06, 0.34, 0.62] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'massCarriage') {
    const nodes = [
      { name: 'parallax-mass-carriage-body', mesh: 1, translation: [0, 0.58, 0], scale: [3.50, 0.92, 1.64] },
      { name: 'parallax-mass-carriage-rail-left', mesh: 0, translation: [0, 0.10, -0.98], scale: [4.30, 0.16, 0.20] },
      { name: 'parallax-mass-carriage-rail-right', mesh: 0, translation: [0, 0.10, 0.98], scale: [4.30, 0.16, 0.20] },
      { name: 'parallax-mass-carriage-trim', mesh: 2, translation: [1.22, 0.78, 0], scale: [0.34, 0.18, 1.22] },
    ];
    if (detail) {
      nodes.push(
        { name: 'parallax-mass-carriage-counterweight', mesh: 0, translation: [-1.28, 1.28, 0], scale: [0.74, 1.64, 1.22] },
        { name: 'parallax-mass-carriage-reference-cell', mesh: 3, translation: [0.58, 1.18, 0.58], scale: [0.42, 0.46, 0.28] },
        { name: 'parallax-mass-carriage-service-spine', mesh: 0, translation: [0.20, 1.38, -0.58], scale: [1.90, 0.18, 0.18] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'shearAnchor') {
    const nodes = [
      { name: 'parallax-shear-anchor-foot', mesh: 0, translation: [0, 0.18, 0], scale: [1.70, 0.36, 1.34] },
      { name: 'parallax-shear-anchor-spine', mesh: 1, translation: [-0.34, 1.65, 0], scale: [0.42, 2.95, 0.50] },
      { name: 'parallax-shear-anchor-cantilever', mesh: 1, translation: [0.64, 2.68, 0], scale: [2.28, 0.28, 0.44] },
      { name: 'parallax-shear-anchor-field-band', mesh: 2, translation: [1.56, 2.68, 0], scale: [0.18, 0.56, 0.86] },
    ];
    if (detail) {
      nodes.push(
        { name: 'parallax-shear-anchor-brace-upper', mesh: 0, translation: [0.06, 2.22, 0.42], scale: [1.32, 0.16, 0.16] },
        { name: 'parallax-shear-anchor-brace-lower', mesh: 0, translation: [0.06, 1.36, -0.42], scale: [1.32, 0.16, 0.16] },
        { name: 'parallax-shear-anchor-sensor', mesh: 3, translation: [1.64, 2.95, 0], scale: [0.24, 0.24, 0.24] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  const nodes = [
    { name: 'parallax-reference-console-base', mesh: 0, translation: [0, 0.28, 0], scale: [1.50, 0.56, 1.12] },
    { name: 'parallax-reference-console-mast', mesh: 1, translation: [-0.18, 1.05, 0], scale: [0.42, 1.30, 0.52] },
    { name: 'parallax-reference-console-screen', mesh: 3, translation: [0.18, 1.42, 0], scale: [0.12, 0.52, 0.82] },
    { name: 'parallax-reference-console-status', mesh: 2, translation: [0.26, 0.72, 0.34], scale: [0.10, 0.22, 0.28] },
  ];
  if (detail) {
    nodes.push(
      { name: 'parallax-reference-console-sidecar', mesh: 1, translation: [-0.42, 0.72, -0.50], scale: [0.48, 0.66, 0.42] },
      { name: 'parallax-reference-console-calibration-bar', mesh: 2, translation: [0.14, 1.68, 0], scale: [0.10, 0.10, 0.92] },
    );
  }
  nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
  return nodes;
}


function spinHabitatMaterials() {
  return [
    {
      name: 'spin-habitat-structure',
      pbrMetallicRoughness: {
        baseColorFactor: [0.12, 0.16, 0.16, 1],
        metallicFactor: 0.88,
        roughnessFactor: 0.34,
      },
    },
    {
      name: 'spin-habitat-alloy',
      pbrMetallicRoughness: {
        baseColorFactor: [0.34, 0.42, 0.40, 1],
        metallicFactor: 0.62,
        roughnessFactor: 0.42,
      },
    },
    {
      name: 'spin-habitat-green-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.06, 0.24, 0.14, 1],
        metallicFactor: 0.28,
        roughnessFactor: 0.22,
      },
      emissiveFactor: [0.20, 0.82, 0.42],
    },
    {
      name: 'spin-habitat-service-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.34, 0.20, 0.06, 1],
        metallicFactor: 0.36,
        roughnessFactor: 0.26,
      },
      emissiveFactor: [0.92, 0.52, 0.14],
    },
    {
      name: 'spin-habitat-rim-plating',
      pbrMetallicRoughness: {
        baseColorFactor: [0.31, 0.44, 0.37, 1],
        metallicFactor: 0.68,
        roughnessFactor: 0.48,
      },
    },
    {
      name: 'spin-habitat-spoke-structure',
      pbrMetallicRoughness: {
        baseColorFactor: [0.055, 0.095, 0.11, 1],
        metallicFactor: 0.92,
        roughnessFactor: 0.30,
      },
    },
    {
      name: 'spin-habitat-spoke-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.035, 0.18, 0.24, 1],
        metallicFactor: 0.38,
        roughnessFactor: 0.18,
      },
      emissiveFactor: [0.12, 0.72, 0.90],
    },
    {
      name: 'spin-habitat-axis-shell',
      pbrMetallicRoughness: {
        baseColorFactor: [0.62, 0.71, 0.69, 1],
        metallicFactor: 0.76,
        roughnessFactor: 0.30,
      },
    },
    {
      name: 'spin-habitat-axis-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.12, 0.28, 0.30, 1],
        metallicFactor: 0.34,
        roughnessFactor: 0.16,
      },
      emissiveFactor: [0.52, 0.92, 0.96],
    },
  ];
}

function spinHabitatNodes(kind, lod) {
  const detail = lod === 1;

  if (kind === 'ringSegment') {
    const nodes = [
      { name: 'spin-habitat-ring-segment-deck', mesh: 4, translation: [0, 0.30, 0], scale: [3.40, 0.60, 1.30] },
      { name: 'spin-habitat-ring-segment-inner-rail', mesh: 0, translation: [0, 0.86, -1.06], scale: [3.15, 0.30, 0.18] },
      { name: 'spin-habitat-ring-segment-outer-rail', mesh: 0, translation: [0, 0.86, 1.06], scale: [3.15, 0.30, 0.18] },
      { name: 'spin-habitat-ring-segment-wayfinding', mesh: 2, translation: [0, 0.64, 1.31], scale: [2.45, 0.08, 0.06] },
    ];
    if (detail) {
      nodes.push(
        { name: 'spin-habitat-ring-segment-rib-left', mesh: 4, translation: [-2.28, 1.06, 0], scale: [0.20, 1.52, 1.28] },
        { name: 'spin-habitat-ring-segment-rib-right', mesh: 4, translation: [2.28, 1.06, 0], scale: [0.20, 1.52, 1.28] },
        { name: 'spin-habitat-ring-segment-service-strip', mesh: 3, translation: [1.18, 0.72, -1.30], scale: [0.92, 0.08, 0.06] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'spokeTruss') {
    const nodes = [
      { name: 'spin-habitat-spoke-truss-main', mesh: 5, translation: [0, 1.16, 0], scale: [4.50, 0.28, 0.34] },
      { name: 'spin-habitat-spoke-truss-upper', mesh: 5, translation: [0, 1.74, 0], scale: [4.05, 0.14, 0.18] },
      { name: 'spin-habitat-spoke-truss-lower', mesh: 5, translation: [0, 0.58, 0], scale: [4.05, 0.14, 0.18] },
      { name: 'spin-habitat-spoke-truss-status', mesh: 6, translation: [1.55, 1.16, 0.23], scale: [0.70, 0.08, 0.05] },
    ];
    if (detail) {
      nodes.push(
        { name: 'spin-habitat-spoke-truss-cross-brace-a', mesh: 5, translation: [-1.46, 1.16, 0], scale: [0.14, 1.52, 0.34] },
        { name: 'spin-habitat-spoke-truss-cross-brace-b', mesh: 5, translation: [1.46, 1.16, 0], scale: [0.14, 1.52, 0.34] },
        { name: 'spin-habitat-spoke-truss-service-light', mesh: 6, translation: [-1.52, 1.40, -0.22], scale: [0.38, 0.06, 0.05] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'axisHub') {
    const nodes = [
      { name: 'spin-habitat-axis-hub-foot', mesh: 7, translation: [0, 0.24, 0], scale: [2.30, 0.48, 2.30] },
      { name: 'spin-habitat-axis-hub-core', mesh: 7, translation: [0, 1.52, 0], scale: [1.18, 2.74, 1.18] },
      { name: 'spin-habitat-axis-hub-collar', mesh: 8, translation: [0, 2.92, 0], scale: [1.92, 0.20, 1.92] },
      { name: 'spin-habitat-axis-hub-beacon', mesh: 8, translation: [0, 3.42, 0], scale: [0.36, 0.70, 0.36] },
    ];
    if (detail) {
      nodes.push(
        { name: 'spin-habitat-axis-hub-service-ring', mesh: 8, translation: [0, 1.30, 0], scale: [1.66, 0.12, 1.66] },
        { name: 'spin-habitat-axis-hub-control-bank', mesh: 1, translation: [0.78, 1.12, 0], scale: [0.46, 0.72, 0.82] },
        { name: 'spin-habitat-axis-hub-control-screen', mesh: 8, translation: [1.03, 1.34, 0], scale: [0.06, 0.34, 0.54] },
        { name: 'spin-habitat-axis-hub-fin-left', mesh: 7, translation: [0, 2.08, -1.28], scale: [0.22, 1.18, 0.52] },
        { name: 'spin-habitat-axis-hub-fin-right', mesh: 7, translation: [0, 2.08, 1.28], scale: [0.22, 1.18, 0.52] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  const nodes = [
    { name: 'spin-habitat-service-bay-base', mesh: 0, translation: [0, 0.22, 0], scale: [1.72, 0.44, 1.34] },
    { name: 'spin-habitat-service-bay-shell', mesh: 1, translation: [-0.16, 1.02, 0], scale: [1.22, 1.30, 1.08] },
    { name: 'spin-habitat-service-bay-screen', mesh: 2, translation: [0.48, 1.22, 0.54], scale: [0.08, 0.42, 0.46] },
    { name: 'spin-habitat-service-bay-marker', mesh: 3, translation: [0.16, 1.74, -0.44], scale: [0.54, 0.10, 0.08] },
  ];
  if (detail) {
    nodes.push(
      { name: 'spin-habitat-service-bay-canister', mesh: 0, translation: [-0.56, 1.28, -0.54], scale: [0.34, 0.82, 0.34] },
      { name: 'spin-habitat-service-bay-utility-arm', mesh: 1, translation: [0.42, 1.62, -0.42], scale: [0.74, 0.14, 0.14] },
    );
  }
  nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
  return nodes;
}

function damagedVesselNodes(kind, lod) {
  const detail = lod === 1;
  if (kind === 'rib') {
    const nodes = [
      { name: 'damaged-vessel-broken-rib-spine', mesh: 0, translation: [0, 1.65, 0], scale: [0.34, 3.30, 0.46] },
      { name: 'damaged-vessel-broken-rib-shoulder', mesh: 0, translation: [0.58, 3.02, 0], scale: [1.50, 0.28, 0.50] },
      { name: 'damaged-vessel-broken-rib-scar', mesh: 2, translation: [0.12, 1.88, 0.27], scale: [0.08, 1.10, 0.08] },
      { name: 'damaged-vessel-broken-rib-foot', mesh: 1, translation: [0.42, 0.28, 0], scale: [1.18, 0.56, 0.82] },
    ];
    if (detail) {
      nodes.push(
        { name: 'damaged-vessel-broken-rib-splinter-upper', mesh: 1, translation: [1.32, 3.18, 0], scale: [0.72, 0.18, 0.30] },
        { name: 'damaged-vessel-broken-rib-cable', mesh: 3, translation: [0.38, 1.22, 0.34], scale: [0.08, 1.28, 0.08] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'breachFrame') {
    const nodes = [
      { name: 'damaged-vessel-breach-frame-left', mesh: 0, translation: [0, 1.95, -2.35], scale: [0.42, 3.90, 0.46] },
      { name: 'damaged-vessel-breach-frame-right', mesh: 0, translation: [0, 1.95, 2.35], scale: [0.42, 3.90, 0.46] },
      { name: 'damaged-vessel-breach-frame-crown', mesh: 1, translation: [0, 3.66, 0], scale: [0.54, 0.46, 5.20] },
      { name: 'damaged-vessel-breach-frame-warning', mesh: 2, translation: [0.29, 2.02, 2.05], scale: [0.08, 2.42, 0.12] },
      { name: 'damaged-vessel-breach-frame-jagged', mesh: 1, translation: [0.34, 0.58, -1.58], scale: [0.28, 1.16, 0.88] },
    ];
    if (detail) {
      nodes.push(
        { name: 'damaged-vessel-breach-frame-cable-a', mesh: 3, translation: [0.42, 2.52, -1.42], scale: [0.08, 1.72, 0.08] },
        { name: 'damaged-vessel-breach-frame-cable-b', mesh: 3, translation: [0.42, 1.42, 1.52], scale: [0.08, 1.12, 0.08] },
        { name: 'damaged-vessel-breach-frame-scar-cap', mesh: 2, translation: [0.30, 3.38, -0.72], scale: [0.08, 0.12, 1.38] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'tornPlate') {
    const nodes = [
      { name: 'damaged-vessel-torn-wall-plate-shell', mesh: 0, translation: [0, 1.20, 0], scale: [2.80, 2.40, 0.18] },
      { name: 'damaged-vessel-torn-wall-plate-cut-edge', mesh: 2, translation: [-0.34, 1.34, 0.16], scale: [0.08, 1.72, 0.08] },
      { name: 'damaged-vessel-torn-wall-plate-lower-flap', mesh: 1, translation: [0.58, 0.42, 0.19], scale: [1.42, 0.54, 0.22] },
    ];
    if (detail) {
      nodes.push(
        { name: 'damaged-vessel-torn-wall-plate-reinforcement', mesh: 1, translation: [-0.10, 1.95, 0.17], scale: [2.10, 0.12, 0.12] },
        { name: 'damaged-vessel-torn-wall-plate-tooth', mesh: 1, translation: [1.12, 0.82, 0.28], scale: [0.36, 0.82, 0.16] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'serviceBundle') {
    const nodes = [
      { name: 'damaged-vessel-service-bundle-trunk', mesh: 1, translation: [0, 1.45, 0], scale: [0.32, 2.90, 0.34] },
      { name: 'damaged-vessel-service-bundle-junction', mesh: 0, translation: [0.08, 1.66, 0.30], scale: [0.84, 0.72, 0.42] },
      { name: 'damaged-vessel-service-bundle-status', mesh: 3, translation: [0.50, 1.76, 0.54], scale: [0.12, 0.18, 0.06] },
    ];
    if (detail) {
      nodes.push(
        { name: 'damaged-vessel-service-bundle-conduit-a', mesh: 1, translation: [-0.26, 1.18, 0.31], scale: [0.10, 2.16, 0.10] },
        { name: 'damaged-vessel-service-bundle-conduit-b', mesh: 1, translation: [0.28, 1.02, 0.31], scale: [0.10, 1.82, 0.10] },
        { name: 'damaged-vessel-service-bundle-drop', mesh: 3, translation: [0.46, 0.48, 0.36], scale: [0.08, 0.82, 0.08] },
      );
    }
    nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  const nodes = [
    { name: 'damaged-vessel-salvage-rack-shell', mesh: 0, translation: [0, 0.88, 0], scale: [2.30, 1.76, 0.76] },
    { name: 'damaged-vessel-salvage-rack-shelf', mesh: 1, translation: [0.08, 1.08, 0], scale: [2.02, 0.12, 0.82] },
    { name: 'damaged-vessel-salvage-rack-status', mesh: 3, translation: [0.82, 1.48, 0.42], scale: [0.28, 0.20, 0.06] },
    { name: 'damaged-vessel-salvage-rack-warning', mesh: 2, translation: [-0.72, 0.42, 0.42], scale: [0.46, 0.16, 0.06] },
  ];
  if (detail) {
    nodes.push(
      { name: 'damaged-vessel-salvage-rack-bin-left', mesh: 1, translation: [-0.58, 0.62, 0.46], scale: [0.62, 0.54, 0.40] },
      { name: 'damaged-vessel-salvage-rack-bin-right', mesh: 1, translation: [0.34, 0.62, 0.46], scale: [0.72, 0.54, 0.40] },
      { name: 'damaged-vessel-salvage-rack-tag', mesh: 3, translation: [-0.12, 1.34, 0.44], scale: [0.40, 0.14, 0.05] },
    );
  }
  nodes.push({ name: 'environment-root', children: nodes.map((_, index) => index) });
  return nodes;
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


function pickupMaterials() {
  return [
    {
      name: 'pickup-shell',
      pbrMetallicRoughness: {
        baseColorFactor: [0.28, 0.33, 0.33, 1],
        metallicFactor: 0.82,
        roughnessFactor: 0.30,
      },
    },
    {
      name: 'pickup-dark',
      pbrMetallicRoughness: {
        baseColorFactor: [0.045, 0.060, 0.064, 1],
        metallicFactor: 0.72,
        roughnessFactor: 0.34,
      },
    },
    {
      name: 'pickup-accent-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.18, 0.34, 0.31, 1],
        metallicFactor: 0.38,
        roughnessFactor: 0.20,
      },
      emissiveFactor: [0.40, 0.92, 0.78],
    },
  ];
}

function pickupNodes(lod) {
  const nodes = [
    { name: 'pickup-recovery-shell', mesh: 0, translation: [0, 0.24, 0], scale: [0.72, 0.34, 0.46] },
    { name: 'pickup-recovery-core', mesh: 2, translation: [0.38, 0.25, 0], scale: [0.08, 0.22, 0.30] },
    { name: 'pickup-recovery-beacon', mesh: 2, translation: [0, 0.56, 0], scale: [0.12, 0.22, 0.12] },
    { name: 'pickup-recovery-skid', mesh: 1, translation: [0, 0.07, 0], scale: [0.54, 0.10, 0.34] },
  ];
  if (lod === 1) {
    nodes.push(
      { name: 'pickup-recovery-rail-left', mesh: 1, translation: [-0.04, 0.38, 0.27], scale: [0.46, 0.08, 0.08] },
      { name: 'pickup-recovery-rail-right', mesh: 1, translation: [-0.04, 0.38, -0.27], scale: [0.46, 0.08, 0.08] },
      { name: 'pickup-recovery-tag', mesh: 2, translation: [-0.32, 0.25, 0], scale: [0.08, 0.16, 0.22] },
    );
  }
  nodes.push({ name: 'pickup-root', children: nodes.map((_, index) => index) });
  return nodes;
}

function interactableMaterials() {
  return [
    {
      name: 'interactable-shell',
      pbrMetallicRoughness: {
        baseColorFactor: [0.24, 0.29, 0.29, 1],
        metallicFactor: 0.78,
        roughnessFactor: 0.36,
      },
    },
    {
      name: 'interactable-dark',
      pbrMetallicRoughness: {
        baseColorFactor: [0.050, 0.065, 0.070, 1],
        metallicFactor: 0.84,
        roughnessFactor: 0.30,
      },
    },
    {
      name: 'interactable-warning',
      pbrMetallicRoughness: {
        baseColorFactor: [0.42, 0.22, 0.08, 1],
        metallicFactor: 0.46,
        roughnessFactor: 0.32,
      },
      emissiveFactor: [0.62, 0.24, 0.06],
    },
    {
      name: 'interactable-status-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.04, 0.18, 0.17, 1],
        metallicFactor: 0.30,
        roughnessFactor: 0.18,
      },
      emissiveFactor: [0.25, 0.86, 0.75],
    },
  ];
}

function interactableNodes(kind, lod) {
  if (kind === 'control') {
    const nodes = [
      { name: 'interactable-control-base', mesh: 1, translation: [0, 0.10, 0], scale: [0.66, 0.20, 0.70] },
      { name: 'interactable-control-column', mesh: 0, translation: [-0.10, 0.64, 0], scale: [0.42, 1.08, 0.52] },
      { name: 'interactable-control-console', mesh: 0, translation: [0.22, 1.14, 0], scale: [0.58, 0.24, 0.74] },
      { name: 'interactable-control-screen', mesh: 3, translation: [0.52, 1.19, 0], scale: [0.05, 0.18, 0.54] },
    ];
    if (lod === 1) {
      nodes.push(
        { name: 'interactable-control-hazard-band', mesh: 2, translation: [-0.32, 0.34, 0], scale: [0.06, 0.12, 0.46] },
        { name: 'interactable-control-side-status', mesh: 3, translation: [0.04, 0.74, 0.29], scale: [0.18, 0.30, 0.05] },
        { name: 'objective-beacon-mount', mesh: 1, translation: [0, 1.48, 0], scale: [0.18, 0.08, 0.18] },
      );
    }
    nodes.push({ name: 'interactable-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  const nodes = [
    { name: 'interactable-salvage-base', mesh: 1, translation: [0, 0.09, 0], scale: [0.92, 0.18, 0.72] },
    { name: 'interactable-salvage-case', mesh: 0, translation: [0, 0.38, 0], scale: [0.78, 0.48, 0.58] },
    { name: 'interactable-salvage-tag-emitter', mesh: 3, translation: [0.43, 0.45, 0], scale: [0.08, 0.24, 0.34] },
    { name: 'interactable-salvage-beacon', mesh: 3, translation: [-0.22, 0.82, 0], scale: [0.12, 0.28, 0.12] },
  ];
  if (lod === 1) {
    nodes.push(
      { name: 'interactable-salvage-restraint-left', mesh: 1, translation: [0, 0.42, 0.32], scale: [0.62, 0.10, 0.08] },
      { name: 'interactable-salvage-restraint-right', mesh: 1, translation: [0, 0.42, -0.32], scale: [0.62, 0.10, 0.08] },
      { name: 'interactable-salvage-tag-plate', mesh: 2, translation: [-0.40, 0.38, 0], scale: [0.06, 0.20, 0.34] },
    );
  }
  nodes.push({ name: 'interactable-root', children: nodes.map((_, index) => index) });
  return nodes;
}

function spinHabitatInteractableNodes(kind, lod) {
  const detail = lod === 1;

  if (kind === 'spinBusIsolator') {
    const nodes = [
      { name: 'spin-habitat-spin-bus-isolator-base', mesh: 1, translation: [0, 0.10, 0], scale: [0.82, 0.20, 0.70] },
      { name: 'spin-habitat-spin-bus-isolator-housing', mesh: 0, translation: [-0.08, 0.64, 0], scale: [0.52, 1.08, 0.54] },
      { name: 'spin-habitat-spin-bus-isolator-knife', mesh: 2, translation: [0.27, 0.88, 0], scale: [0.10, 0.52, 0.18] },
      { name: 'spin-habitat-interactable-status', mesh: 3, translation: [0.30, 1.18, 0], scale: [0.06, 0.20, 0.36] },
    ];
    if (detail) nodes.push(
      { name: 'spin-habitat-spin-bus-isolator-brace', mesh: 1, translation: [-0.12, 1.20, 0], scale: [0.48, 0.12, 0.62] },
      { name: 'objective-beacon-mount', mesh: 1, translation: [0, 1.48, 0], scale: [0.18, 0.08, 0.18] },
    );
    nodes.push({ name: 'interactable-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'gravityTrim') {
    const nodes = [
      { name: 'spin-habitat-gravity-trim-base', mesh: 1, translation: [0, 0.10, 0], scale: [0.86, 0.20, 0.68] },
      { name: 'spin-habitat-gravity-trim-column', mesh: 0, translation: [-0.10, 0.62, 0], scale: [0.46, 1.04, 0.48] },
      { name: 'spin-habitat-gravity-trim-yoke', mesh: 0, translation: [0.18, 1.08, 0], scale: [0.58, 0.22, 0.64] },
      { name: 'spin-habitat-interactable-status', mesh: 3, translation: [0.48, 1.12, 0], scale: [0.05, 0.18, 0.46] },
    ];
    if (detail) nodes.push(
      { name: 'spin-habitat-gravity-trim-index', mesh: 2, translation: [-0.35, 0.58, 0.27], scale: [0.06, 0.46, 0.06] },
      { name: 'objective-beacon-mount', mesh: 1, translation: [0, 1.46, 0], scale: [0.18, 0.08, 0.18] },
    );
    nodes.push({ name: 'interactable-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'bearingControl') {
    const nodes = [
      { name: 'spin-habitat-bearing-control-skid', mesh: 1, translation: [0, 0.10, 0], scale: [1.30, 0.20, 0.84] },
      { name: 'spin-habitat-bearing-control-cradle', mesh: 0, translation: [-0.12, 0.48, 0], scale: [1.08, 0.56, 0.66] },
      { name: 'spin-habitat-bearing-control-spindle', mesh: 1, translation: [0.24, 0.82, 0], scale: [0.56, 0.22, 0.72] },
      { name: 'spin-habitat-interactable-status', mesh: 3, translation: [0.62, 0.58, 0], scale: [0.06, 0.24, 0.42] },
    ];
    if (detail) nodes.push(
      { name: 'spin-habitat-bearing-control-restraint', mesh: 2, translation: [-0.22, 0.82, 0], scale: [0.70, 0.10, 0.76] },
      { name: 'objective-beacon-mount', mesh: 1, translation: [0, 1.18, 0], scale: [0.18, 0.08, 0.18] },
    );
    nodes.push({ name: 'interactable-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  if (kind === 'attitudeFlywheel') {
    const nodes = [
      { name: 'spin-habitat-attitude-flywheel-skid', mesh: 1, translation: [0, 0.10, 0], scale: [1.34, 0.20, 0.86] },
      { name: 'spin-habitat-attitude-flywheel-cage', mesh: 0, translation: [-0.08, 0.54, 0], scale: [0.86, 0.76, 0.78] },
      { name: 'spin-habitat-attitude-flywheel-axle', mesh: 2, translation: [0.28, 0.56, 0], scale: [0.66, 0.18, 0.18] },
      { name: 'spin-habitat-interactable-status', mesh: 3, translation: [0.62, 0.62, 0], scale: [0.06, 0.24, 0.42] },
    ];
    if (detail) nodes.push(
      { name: 'spin-habitat-attitude-flywheel-guard', mesh: 1, translation: [-0.16, 0.98, 0], scale: [0.76, 0.10, 0.82] },
      { name: 'objective-beacon-mount', mesh: 1, translation: [0, 1.24, 0], scale: [0.18, 0.08, 0.18] },
    );
    nodes.push({ name: 'interactable-root', children: nodes.map((_, index) => index) });
    return nodes;
  }

  const nodes = [
    { name: 'spin-habitat-pressure-lock-base', mesh: 1, translation: [0, 0.10, 0], scale: [0.78, 0.20, 0.68] },
    { name: 'spin-habitat-pressure-lock-column', mesh: 0, translation: [-0.08, 0.70, 0], scale: [0.48, 1.20, 0.50] },
    { name: 'spin-habitat-pressure-lock-wheel', mesh: 2, translation: [0.24, 0.84, 0], scale: [0.16, 0.46, 0.46] },
    { name: 'spin-habitat-interactable-status', mesh: 3, translation: [0.22, 1.28, 0], scale: [0.06, 0.22, 0.38] },
  ];
  if (detail) nodes.push(
    { name: 'spin-habitat-pressure-lock-guard', mesh: 1, translation: [-0.12, 1.34, 0], scale: [0.46, 0.12, 0.58] },
    { name: 'objective-beacon-mount', mesh: 1, translation: [0, 1.60, 0], scale: [0.18, 0.08, 0.18] },
  );
  nodes.push({ name: 'interactable-root', children: nodes.map((_, index) => index) });
  return nodes;
}

const outputs = [];
outputs.push(await writeAsset(
  'operators/operator-field-suit-lod1.glb',
  'operator-field-suit-lod1',
  operatorNodes(),
  materials([0.28, 0.45, 0.42, 1], [0.20, 0.80, 0.68]),
));

const operatorClassProfiles = [
  ['vanguard', [0.34, 0.31, 0.28, 1], [0.95, 0.50, 0.24]],
  ['vector', [0.24, 0.34, 0.40, 1], [0.34, 0.78, 1.00]],
  ['systems', [0.30, 0.26, 0.40, 1], [0.66, 0.50, 0.92]],
];

for (const [operatorClass, primary, accent] of operatorClassProfiles) {
  outputs.push(await writeAsset(
    `operators/operator-${operatorClass}-lod1.glb`,
    `operator-${operatorClass}-lod1`,
    operatorClassNodes(operatorClass),
    materials(primary, accent),
  ));
  outputs.push(await writeAsset(
    `operators/operator-${operatorClass}-lod2.glb`,
    `operator-${operatorClass}-lod2`,
    operatorClassMobileNodes(operatorClass),
    materials(primary, accent),
  ));
}

const enemyProfiles = [
  ['assault', 'enemies', [0.56, 0.18, 0.14, 1], [0.95, 0.33, 0.22]],
  ['suppressor', 'enemies', [0.52, 0.28, 0.15, 1], [0.95, 0.56, 0.22]],
  ['technician', 'enemies', [0.28, 0.24, 0.52, 1], [0.54, 0.48, 0.95]],
  ['elite', 'enemies', [0.58, 0.16, 0.32, 1], [0.98, 0.30, 0.58]],
  ['boss', 'bosses', [0.60, 0.12, 0.10, 1], [1.00, 0.24, 0.18]],
];

for (const [role, folder, primary, accent] of enemyProfiles) {
  outputs.push(await writeAsset(`${folder}/enemy-${role}-lod1.glb`, `enemy-${role}-lod1`, enemyNodes(role), materials(primary, accent)));
  outputs.push(await writeAsset(`${folder}/enemy-${role}-lod2.glb`, `enemy-${role}-lod2`, enemyMobileNodes(role), materials(primary, accent)));
}

const spinHabitatEnemyProfiles = [
  ['spokeMarksman', 'spin-habitat-spoke-marksman', [0.24, 0.38, 0.35, 1], [0.50, 0.88, 0.78]],
  ['spinTrimSpecialist', 'spin-habitat-spin-trim-specialist', [0.25, 0.33, 0.36, 1], [0.45, 0.86, 0.92]],
  ['ringDroneCarrier', 'spin-habitat-ring-drone-carrier', [0.28, 0.36, 0.33, 1], [0.56, 0.94, 0.76]],
  ['axisShieldBoarder', 'spin-habitat-axis-shield-boarder', [0.31, 0.38, 0.34, 1], [0.62, 0.90, 0.72]],
];

for (const [identity, id, primary, accent] of spinHabitatEnemyProfiles) {
  outputs.push(await writeAsset(`enemies/${id}-lod1.glb`, `${id}-lod1`, spinHabitatEnemyNodes(identity, 1), materials(primary, accent)));
  outputs.push(await writeAsset(`enemies/${id}-lod2.glb`, `${id}-lod2`, spinHabitatEnemyNodes(identity, 2), materials(primary, accent)));
}

const weaponProfiles = [
  ['carbine', [0.58, 0.90, 0.42]],
  ['breacher', [1.00, 0.63, 0.28]],
  ['rail', [0.34, 0.78, 1.00]],
];

for (const [weapon, accent] of weaponProfiles) {
  outputs.push(await writeAsset(`weapons/weapon-${weapon}-lod1.glb`, `weapon-${weapon}-lod1`, weaponNodes(weapon), weaponMaterials(accent)));
  outputs.push(await writeAsset(`weapons/weapon-${weapon}-lod2.glb`, `weapon-${weapon}-lod2`, weaponMobileNodes(weapon), weaponMaterials(accent)));
}



for (const lod of [1, 2]) {
  outputs.push(await writeAsset(
    `pickups/pickup-recovery-capsule-lod${lod}.glb`,
    `pickup-recovery-capsule-lod${lod}`,
    pickupNodes(lod),
    pickupMaterials(),
  ));
}

for (const [kind, id] of [['control', 'interactable-control-terminal'], ['salvage', 'interactable-salvage-tag-node']]) {
  for (const lod of [1, 2]) {
    outputs.push(await writeAsset(
      `interactables/${id}-lod${lod}.glb`,
      `${id}-lod${lod}`,
      interactableNodes(kind, lod),
      interactableMaterials(),
    ));
  }
}

const spinHabitatInteractableProfiles = [
  ['spinBusIsolator', 'spin-habitat-spin-bus-isolator'],
  ['gravityTrim', 'spin-habitat-gravity-trim'],
  ['bearingControl', 'spin-habitat-bearing-control'],
  ['attitudeFlywheel', 'spin-habitat-attitude-flywheel'],
  ['pressureLock', 'spin-habitat-pressure-lock'],
];

for (const [kind, id] of spinHabitatInteractableProfiles) {
  for (const lod of [1, 2]) {
    outputs.push(await writeAsset(
      `interactables/${id}-lod${lod}.glb`,
      `${id}-lod${lod}`,
      spinHabitatInteractableNodes(kind, lod),
      interactableMaterials(),
    ));
  }
}

const damagedVesselProfiles = [
  ['rib', 'damaged-vessel-broken-rib'],
  ['breachFrame', 'damaged-vessel-breach-frame'],
  ['salvageRack', 'damaged-vessel-salvage-rack'],
  ['tornPlate', 'damaged-vessel-torn-wall-plate'],
  ['serviceBundle', 'damaged-vessel-service-bundle'],
];

for (const [kind, id] of damagedVesselProfiles) {
  for (const lod of [1, 2]) {
    outputs.push(await writeAsset(
      `environments/${id}-lod${lod}.glb`,
      `${id}-lod${lod}`,
      damagedVesselNodes(kind, lod),
      damagedVesselMaterials(),
    ));
  }
}



const spinHabitatProfiles = [
  ['ringSegment', 'spin-habitat-ring-segment'],
  ['spokeTruss', 'spin-habitat-spoke-truss'],
  ['axisHub', 'spin-habitat-axis-hub'],
  ['serviceBay', 'spin-habitat-service-bay'],
];

for (const [kind, id] of spinHabitatProfiles) {
  for (const lod of [1, 2]) {
    outputs.push(await writeAsset(
      `environments/${id}-lod${lod}.glb`,
      `${id}-lod${lod}`,
      spinHabitatNodes(kind, lod),
      spinHabitatMaterials(),
    ));
  }
}

const parallaxProfiles = [
  ['pylon', 'parallax-baseline-pylon'],
  ['frame', 'parallax-reference-frame'],
  ['massCarriage', 'parallax-mass-carriage'],
  ['shearAnchor', 'parallax-shear-anchor'],
  ['console', 'parallax-reference-console'],
];

for (const [kind, id] of parallaxProfiles) {
  for (const lod of [1, 2]) {
    outputs.push(await writeAsset(
      `environments/${id}-lod${lod}.glb`,
      `${id}-lod${lod}`,
      parallaxNodes(kind, lod),
      parallaxMaterials(),
    ));
  }
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
