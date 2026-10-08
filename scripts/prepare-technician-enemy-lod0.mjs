import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVanguardOperatorLod0Glb } from './prepare-vanguard-operator-lod0.mjs';

export const TECHNICIAN_ENEMY_LOD0_RELATIVE_PATH = 'enemies/enemy-technician-lod0.glb';
const OUTPUT_ROOT = resolve(process.cwd(), 'public/assets/models');
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

function align4(value) {
  return (value + 3) & ~3;
}

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC || buffer.readUInt32LE(4) !== GLB_VERSION) {
    throw new Error('Technician LOD0 source must be a glTF 2.0 GLB');
  }
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('Technician LOD0 source GLB length is invalid');

  let offset = 12;
  let gltf = null;
  let binary = null;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    if (chunkType === JSON_CHUNK_TYPE) {
      gltf = JSON.parse(chunk.toString('utf8').replace(/[\u0000\u0020]+$/g, ''));
    } else if (chunkType === BIN_CHUNK_TYPE) {
      binary = Buffer.from(chunk);
    }
    offset += chunkLength;
  }
  if (!gltf || !binary) throw new Error('Technician LOD0 source GLB is missing JSON or binary data');
  return { gltf, binary };
}

function encodeGlb(gltf, binary) {
  const jsonRaw = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonLength = align4(jsonRaw.length);
  const binaryLength = align4(binary.length);
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const output = Buffer.alloc(totalLength, 0);
  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(GLB_VERSION, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(JSON_CHUNK_TYPE, 16);
  jsonRaw.copy(output, 20);
  output.fill(0x20, 20 + jsonRaw.length, 20 + jsonLength);
  const binaryHeader = 20 + jsonLength;
  output.writeUInt32LE(binaryLength, binaryHeader);
  output.writeUInt32LE(BIN_CHUNK_TYPE, binaryHeader + 4);
  binary.copy(output, binaryHeader + 8);
  return output;
}

function nodeByName(gltf, name) {
  return gltf.nodes?.find(node => node.name === name);
}

function setTranslation(gltf, name, translation) {
  const node = nodeByName(gltf, name);
  if (!node) throw new Error(`Technician LOD0 source is missing ${name}`);
  node.translation = translation;
}

function setScale(gltf, name, scale) {
  const node = nodeByName(gltf, name);
  if (!node) throw new Error(`Technician LOD0 source is missing ${name}`);
  node.scale = scale;
}

function renameNode(gltf, from, to) {
  const node = nodeByName(gltf, from);
  if (!node) throw new Error(`Technician LOD0 source is missing ${from}`);
  node.name = to;
}

export function buildTechnicianEnemyLod0Glb() {
  const source = buildVanguardOperatorLod0Glb();
  const { gltf, binary } = parseGlb(source);

  gltf.asset.generator = 'Ironshade Vector P28-D6 Technician Enemy LOD0 deterministic generator';
  gltf.scenes[0].name = 'technician-enemy-lod0';

  for (const node of gltf.nodes ?? []) {
    if (node.name === 'operator-rig') {
      node.name = 'enemy-rig';
      node.extras = { rig: 'enemy-articulated-v1' };
    } else if (node.name?.startsWith('vanguard-')) {
      node.name = `technician-${node.name.slice('vanguard-'.length)}`;
    }
  }
  for (const mesh of gltf.meshes ?? []) {
    if (mesh.name?.startsWith('vanguard-')) mesh.name = `technician-${mesh.name.slice('vanguard-'.length)}`;
  }

  setTranslation(gltf, 'hip', [0, 0.90, 0]);
  setTranslation(gltf, 'torso', [0, 0.32, 0]);
  setTranslation(gltf, 'helmet', [0.02, 0.72, 0]);
  setTranslation(gltf, 'arm-left', [0.02, 0.43, 0.40]);
  setTranslation(gltf, 'arm-right', [0.02, 0.43, -0.40]);
  setTranslation(gltf, 'leg-left', [0, 0, 0.18]);
  setTranslation(gltf, 'leg-right', [0, 0, -0.18]);
  setTranslation(gltf, 'backpack', [-0.18, 0.20, 0]);
  setTranslation(gltf, 'weapon-socket', [0.22, 0.18, -0.24]);

  // Keep the core frame visibly lighter than assault/suppressor while moving the
  // technician's identity into external tools, sensors, power cells, and rack hardware.
  setScale(gltf, 'technician-underlayer-torso', [0.76, 0.84, 0.78]);
  renameNode(gltf, 'technician-ram-plate', 'technician-tool-harness');
  setScale(gltf, 'technician-tool-harness', [0.58, 0.70, 0.82]);
  setTranslation(gltf, 'technician-tool-harness', [0.31, 0.05, 0.17]);
  setScale(gltf, 'technician-chest-upper', [0.68, 0.72, 0.80]);
  setTranslation(gltf, 'technician-chest-upper', [0.30, 0.24, 0.05]);
  setScale(gltf, 'technician-chest-lower', [0.66, 0.62, 0.76]);
  setTranslation(gltf, 'technician-chest-lower', [0.30, -0.12, 0.04]);
  setScale(gltf, 'technician-collar', [0.62, 0.38, 0.82]);

  renameNode(gltf, 'technician-left-pauldron', 'technician-sensor-shoulder');
  setScale(gltf, 'technician-sensor-shoulder', [0.92, 0.78, 0.88]);
  setScale(gltf, 'technician-right-pauldron', [0.66, 0.68, 0.64]);
  setScale(gltf, 'technician-left-forearm', [0.78, 0.92, 0.74]);
  setScale(gltf, 'technician-right-forearm', [0.64, 0.82, 0.62]);
  renameNode(gltf, 'technician-left-breacher-brace', 'technician-field-tool');
  setScale(gltf, 'technician-field-tool', [0.70, 1.22, 0.58]);
  setTranslation(gltf, 'technician-field-tool', [0.20, -0.52, 0.09]);
  setScale(gltf, 'technician-right-breacher-brace', [0.48, 0.56, 0.50]);
  renameNode(gltf, 'technician-left-gauntlet', 'technician-tool-gauntlet');
  setScale(gltf, 'technician-tool-gauntlet', [0.92, 0.96, 0.88]);
  setScale(gltf, 'technician-right-gauntlet', [0.68, 0.80, 0.66]);

  renameNode(gltf, 'technician-reactive-pack', 'technician-tool-rack');
  setScale(gltf, 'technician-tool-rack', [0.88, 1.02, 1.34]);
  renameNode(gltf, 'technician-reactive-cell-left', 'technician-power-cell-left');
  renameNode(gltf, 'technician-reactive-cell-right', 'technician-power-cell-right');
  setScale(gltf, 'technician-power-cell-left', [0.72, 1.24, 0.72]);
  setScale(gltf, 'technician-power-cell-right', [0.72, 1.24, 0.72]);
  renameNode(gltf, 'technician-pack-vent-left', 'technician-tool-canister-left');
  renameNode(gltf, 'technician-pack-vent-right', 'technician-tool-canister-right');
  setScale(gltf, 'technician-tool-canister-left', [0.50, 0.92, 0.48]);
  setScale(gltf, 'technician-tool-canister-right', [0.50, 0.92, 0.48]);
  renameNode(gltf, 'technician-pack-status', 'technician-rack-status');
  setScale(gltf, 'technician-rack-status', [0.74, 0.74, 0.74]);

  setScale(gltf, 'technician-command-visor', [0.88, 0.76, 0.82]);
  renameNode(gltf, 'technician-helmet-left-guard', 'technician-scanner-module');
  setScale(gltf, 'technician-scanner-module', [1.10, 0.86, 1.22]);
  setTranslation(gltf, 'technician-scanner-module', [0.01, 0.05, 0.26]);
  setScale(gltf, 'technician-helmet-right-guard', [0.48, 0.58, 0.52]);
  renameNode(gltf, 'technician-helmet-beacon', 'technician-mast');
  setScale(gltf, 'technician-mast', [0.66, 2.20, 0.66]);
  setTranslation(gltf, 'technician-mast', [0.02, 0.39, 0.13]);
  renameNode(gltf, 'technician-guard-light', 'technician-work-light');
  setTranslation(gltf, 'technician-work-light', [0.38, 0.17, 0.26]);
  setScale(gltf, 'technician-work-light', [0.88, 0.88, 0.88]);

  setScale(gltf, 'technician-left-thigh', [0.72, 0.68, 0.70]);
  setScale(gltf, 'technician-right-thigh', [0.72, 0.68, 0.70]);
  setScale(gltf, 'technician-left-shin', [0.54, 0.80, 0.58]);
  setScale(gltf, 'technician-right-shin', [0.54, 0.80, 0.58]);

  const materialNames = ['technician-suit', 'technician-armor', 'technician-equipment', 'technician-emissive'];
  const materialTints = [
    [0.10, 0.18, 0.17, 1],
    [0.22, 0.40, 0.36, 1],
    [0.30, 0.25, 0.15, 1],
    [0.10, 0.50, 0.46, 1],
  ];
  for (let index = 0; index < (gltf.materials?.length ?? 0); index += 1) {
    const material = gltf.materials[index];
    material.name = materialNames[index] ?? `technician-material-${index}`;
    material.pbrMetallicRoughness ??= {};
    material.pbrMetallicRoughness.baseColorFactor = materialTints[index] ?? [1, 1, 1, 1];
  }
  const emissive = gltf.materials?.[3];
  if (emissive) emissive.emissiveFactor = [0.08, 0.84, 0.70];
  const imageNames = ['technician-base-color', 'technician-normal', 'technician-orm', 'technician-emissive'];
  for (let index = 0; index < (gltf.images?.length ?? 0); index += 1) gltf.images[index].name = imageNames[index] ?? `technician-texture-${index}`;

  const sourceContract = gltf.extras?.ironshadeP28D1VanguardLod0;
  if (!sourceContract) throw new Error('Technician LOD0 source contract is missing');
  gltf.extras = {
    ironshadeP28D6TechnicianEnemyLod0: {
      production: true,
      family: 'technician',
      assetClass: 'enemy',
      lodTier: 0,
      deterministic: true,
      embeddedWeapon: false,
      hitboxOwnership: 'simulation',
      gameplayBoundsOwnership: 'simulation',
      coordinateSystem: 'right-handed-y-up',
      namedRigNodes: ['enemy-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket'],
      animationHooks: ['hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack'],
      socketNodes: ['weapon-socket'],
      roleSilhouetteNodes: ['technician-tool-harness', 'technician-sensor-shoulder', 'technician-field-tool', 'technician-tool-rack', 'technician-scanner-module', 'technician-mast', 'technician-work-light'],
      toolHardwareReadability: {
        utilitySide: 'positive-z',
        weaponSide: 'negative-z',
        socket: 'weapon-socket',
        sensorMastScaleY: 2.20,
        toolRackScaleZ: 1.34,
        harnessOffsetZ: 0.17,
      },
      geometryFeatures: ['cylindrical-limbs', 'chamfered-armor', 'sensor-mast', 'external-tool-rack', 'field-tool-brace', 'power-cells', 'tool-canisters', 'work-light', 'clear-external-weapon-lane'],
      textureChannels: ['base-color', 'normal', 'orm', 'emissive'],
      sourceTriangles: sourceContract.sourceTriangles,
      meshNodeTriangles: sourceContract.meshNodeTriangles,
      legacyLod1Asset: 'enemy-technician-lod1',
      legacyLod2Asset: 'enemy-technician-lod2',
      sourceGeometryFamily: 'ironshade-hard-surface-v1',
    },
  };

  return encodeGlb(gltf, binary);
}

export async function writeTechnicianEnemyLod0() {
  const outputPath = resolve(OUTPUT_ROOT, TECHNICIAN_ENEMY_LOD0_RELATIVE_PATH);
  const glb = buildTechnicianEnemyLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] wrote ${TECHNICIAN_ENEMY_LOD0_RELATIVE_PATH} (${glb.length} bytes)`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeTechnicianEnemyLod0();
