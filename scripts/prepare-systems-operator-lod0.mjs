import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVectorOperatorLod0Glb } from './prepare-vector-operator-lod0.mjs';

export const SYSTEMS_OPERATOR_LOD0_RELATIVE_PATH = 'operators/operator-systems-lod0.glb';
const OUTPUT_ROOT = resolve(process.cwd(), 'public/assets/models');
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

function align4(value) {
  return (value + 3) & ~3;
}

function decodeGlb(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) {
    throw new Error('Systems LOD0 source must be a glTF 2.0 GLB');
  }
  let offset = 12;
  let gltf = null;
  let binary = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const payload = buffer.subarray(offset, offset + length);
    if (type === JSON_CHUNK_TYPE) gltf = JSON.parse(payload.toString('utf8').replace(/[\u0000\u0020]+$/g, ''));
    if (type === BIN_CHUNK_TYPE) binary = Buffer.from(payload);
    offset += length;
  }
  if (!gltf || !binary) throw new Error('Systems LOD0 source is missing required GLB chunks');
  return { gltf, binary };
}

function encodeGlb(gltf, binary) {
  const jsonRaw = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonLength = align4(jsonRaw.length);
  const binLength = align4(binary.length);
  const totalLength = 12 + 8 + jsonLength + 8 + binLength;
  const output = Buffer.alloc(totalLength, 0);
  output.write('glTF', 0, 'ascii');
  output.writeUInt32LE(2, 4);
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

function replacePrefix(name) {
  return typeof name === 'string' ? name.replace(/^vector-/, 'systems-') : name;
}

export function buildSystemsOperatorLod0Glb() {
  const { gltf, binary } = decodeGlb(buildVectorOperatorLod0Glb());

  gltf.asset.generator = 'Ironshade Vector P28-D3 Systems LOD0 deterministic generator';
  gltf.scenes[0].name = 'systems-operator-lod0';
  for (const node of gltf.nodes ?? []) node.name = replacePrefix(node.name);
  for (const mesh of gltf.meshes ?? []) mesh.name = replacePrefix(mesh.name);
  for (const material of gltf.materials ?? []) material.name = replacePrefix(material.name);
  for (const image of gltf.images ?? []) image.name = replacePrefix(image.name);

  const nodeIndex = name => gltf.nodes.findIndex(node => node.name === name);
  const node = name => {
    const found = gltf.nodes[nodeIndex(name)];
    if (!found) throw new Error(`Systems LOD0 source is missing node ${name}`);
    return found;
  };
  const meshIndex = name => {
    const index = gltf.meshes.findIndex(mesh => mesh.name === name);
    if (index < 0) throw new Error(`Systems LOD0 source is missing mesh ${name}`);
    return index;
  };
  const renameNode = (from, to) => {
    node(from).name = to;
  };
  const addMeshNode = (name, parentName, meshName, translation, scale = [1, 1, 1], rotation) => {
    const parentIndex = nodeIndex(parentName);
    if (parentIndex < 0) throw new Error(`Systems LOD0 source is missing parent ${parentName}`);
    const index = gltf.nodes.length;
    gltf.nodes.push({
      name,
      mesh: meshIndex(meshName),
      translation,
      scale,
      ...(rotation ? { rotation } : {}),
      children: [],
    });
    gltf.nodes[parentIndex].children ??= [];
    gltf.nodes[parentIndex].children.push(index);
    return index;
  };

  renameNode('systems-aero-chest', 'systems-diagnostic-chest');
  renameNode('systems-left-rail', 'systems-chest-relay-left');
  renameNode('systems-right-rail', 'systems-chest-relay-right');
  renameNode('systems-phase-light', 'systems-core-status');
  renameNode('systems-targeting-visor', 'systems-diagnostic-visor');
  renameNode('systems-thruster-pack', 'systems-capacitor-pack');
  renameNode('systems-thruster-left', 'systems-capacitor-left');
  renameNode('systems-thruster-right', 'systems-capacitor-right');
  renameNode('systems-pack-vane-left', 'systems-heat-sink-left');
  renameNode('systems-pack-vane-right', 'systems-heat-sink-right');

  Object.assign(node('systems-diagnostic-chest'), {
    translation: [0.29, 0.10, 0],
    scale: [0.80, 0.96, 0.90],
  });
  Object.assign(node('systems-chest-relay-left'), {
    translation: [0.21, 0.02, 0.30],
    scale: [0.66, 0.92, 0.78],
  });
  Object.assign(node('systems-chest-relay-right'), {
    translation: [0.21, 0.02, -0.30],
    scale: [0.66, 0.92, 0.78],
  });
  Object.assign(node('systems-diagnostic-visor'), {
    translation: [0.20, 0.015, 0],
    scale: [0.98, 0.94, 0.98],
  });
  Object.assign(node('systems-capacitor-pack'), {
    translation: [-0.06, 0.01, 0],
    scale: [1.12, 1.10, 1.18],
  });
  Object.assign(node('systems-capacitor-left'), {
    translation: [-0.18, -0.05, 0.16],
    scale: [1.02, 1.04, 1.02],
  });
  Object.assign(node('systems-capacitor-right'), {
    translation: [-0.18, -0.05, -0.16],
    scale: [1.02, 1.04, 1.02],
  });

  addMeshNode('systems-relay-left', 'backpack', 'systems-rail', [-0.20, 0.31, 0.30], [0.74, 1.34, 0.74]);
  addMeshNode('systems-relay-right', 'backpack', 'systems-rail', [-0.20, 0.31, -0.30], [0.74, 1.34, 0.74]);
  addMeshNode('systems-relay-tip-left', 'backpack', 'systems-sensor-pod', [-0.20, 0.62, 0.30], [0.86, 0.94, 0.86]);
  addMeshNode('systems-relay-tip-right', 'backpack', 'systems-sensor-pod', [-0.20, 0.62, -0.30], [0.86, 0.94, 0.86]);
  addMeshNode('systems-sensor-crown', 'helmet', 'systems-sensor-pod', [-0.02, 0.31, 0], [1.05, 1.55, 1.05]);
  addMeshNode('systems-diagnostic-bank-left', 'torso', 'systems-utility', [0.16, -0.05, 0.34], [0.96, 1.12, 0.88]);
  addMeshNode('systems-diagnostic-bank-right', 'torso', 'systems-utility', [0.16, -0.05, -0.34], [0.96, 1.12, 0.88]);
  addMeshNode('systems-left-wrist-console', 'arm-left', 'systems-utility', [0.12, -0.22, 0.10], [0.82, 0.70, 0.82]);
  addMeshNode('systems-right-wrist-console', 'arm-right', 'systems-utility', [0.12, -0.22, -0.10], [0.82, 0.70, 0.82]);

  const emissive = gltf.materials.find(material => material.name === 'systems-emissive');
  if (!emissive) throw new Error('Systems LOD0 source is missing emissive material');
  emissive.emissiveFactor = [0.18, 1.0, 0.42];
  emissive.pbrMetallicRoughness.metallicFactor = 0.44;
  emissive.pbrMetallicRoughness.roughnessFactor = 0.28;

  const sourceTriangles = (gltf.meshes ?? []).reduce((sum, mesh) => sum + Number(mesh.extras?.triangles ?? 0), 0);
  const meshNodeTriangles = (gltf.nodes ?? []).reduce((sum, current) => Number.isInteger(current.mesh)
    ? sum + Number(gltf.meshes[current.mesh]?.extras?.triangles ?? 0)
    : sum, 0);

  delete gltf.extras?.ironshadeP28D2VectorLod0;
  gltf.extras = {
    ...(gltf.extras ?? {}),
    ironshadeP28D3SystemsLod0: {
      production: true,
      family: 'systems',
      lodTier: 0,
      deterministic: true,
      embeddedWeapon: false,
      hitboxOwnership: 'simulation',
      gameplayBoundsOwnership: 'simulation',
      coordinateSystem: 'right-handed-y-up',
      namedRigNodes: ['operator-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket'],
      animationHooks: ['hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack'],
      socketNodes: ['weapon-socket'],
      classSilhouetteNodes: ['systems-diagnostic-chest', 'systems-capacitor-pack', 'systems-relay-left', 'systems-relay-right', 'systems-sensor-crown', 'systems-diagnostic-visor', 'systems-core-status'],
      geometryFeatures: ['diagnostic-chest', 'twin-relay-masts', 'sensor-crown', 'capacitor-pack', 'heat-sinks', 'wrist-consoles', 'diagnostic-banks'],
      textureChannels: ['base-color', 'normal', 'orm', 'emissive'],
      sourceTriangles,
      meshNodeTriangles,
      legacyLod1Asset: 'operator-systems-lod1',
      sourceComposition: 'p28-d2-hard-surface-geometry-contract',
    },
  };

  return encodeGlb(gltf, binary);
}

export async function writeSystemsOperatorLod0() {
  const outputPath = resolve(OUTPUT_ROOT, SYSTEMS_OPERATOR_LOD0_RELATIVE_PATH);
  const glb = buildSystemsOperatorLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] wrote ${SYSTEMS_OPERATOR_LOD0_RELATIVE_PATH} (${glb.length} bytes)`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeSystemsOperatorLod0();
