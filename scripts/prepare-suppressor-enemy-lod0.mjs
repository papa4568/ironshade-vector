import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVanguardOperatorLod0Glb } from './prepare-vanguard-operator-lod0.mjs';

export const SUPPRESSOR_ENEMY_LOD0_RELATIVE_PATH = 'enemies/enemy-suppressor-lod0.glb';
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
    throw new Error('Suppressor LOD0 source must be a glTF 2.0 GLB');
  }
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('Suppressor LOD0 source GLB length is invalid');

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
  if (!gltf || !binary) throw new Error('Suppressor LOD0 source GLB is missing JSON or binary data');
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
  if (!node) throw new Error(`Suppressor LOD0 source is missing ${name}`);
  node.translation = translation;
}

function setScale(gltf, name, scale) {
  const node = nodeByName(gltf, name);
  if (!node) throw new Error(`Suppressor LOD0 source is missing ${name}`);
  node.scale = scale;
}

export function buildSuppressorEnemyLod0Glb() {
  const source = buildVanguardOperatorLod0Glb();
  const { gltf, binary } = parseGlb(source);

  gltf.asset.generator = 'Ironshade Vector P28-D5 Suppressor Enemy LOD0 deterministic generator';
  gltf.scenes[0].name = 'suppressor-enemy-lod0';

  for (const node of gltf.nodes ?? []) {
    if (node.name === 'operator-rig') {
      node.name = 'enemy-rig';
      node.extras = { rig: 'enemy-articulated-v1' };
    } else if (node.name?.startsWith('vanguard-')) {
      node.name = `suppressor-${node.name.slice('vanguard-'.length)}`;
    }
  }
  for (const mesh of gltf.meshes ?? []) {
    if (mesh.name?.startsWith('vanguard-')) mesh.name = `suppressor-${mesh.name.slice('vanguard-'.length)}`;
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

  setScale(gltf, 'suppressor-underlayer-torso', [0.82, 0.84, 0.82]);
  setScale(gltf, 'suppressor-ram-plate', [0.64, 0.58, 0.70]);
  setTranslation(gltf, 'suppressor-ram-plate', [0.31, 0.08, 0.15]);
  setScale(gltf, 'suppressor-chest-upper', [0.74, 0.78, 0.84]);
  setTranslation(gltf, 'suppressor-chest-upper', [0.31, 0.25, 0.08]);
  setScale(gltf, 'suppressor-chest-lower', [0.76, 0.68, 0.82]);
  setTranslation(gltf, 'suppressor-chest-lower', [0.32, -0.12, 0.07]);
  setScale(gltf, 'suppressor-collar', [0.70, 0.42, 0.92]);

  // Suppressors carry stabilizer armor on the positive-Z/off-weapon side so the
  // negative-Z weapon lane stays visually clear around the shared external socket.
  setScale(gltf, 'suppressor-left-pauldron', [1.26, 0.98, 1.18]);
  setScale(gltf, 'suppressor-right-pauldron', [0.82, 0.78, 0.78]);
  setScale(gltf, 'suppressor-left-forearm', [0.94, 1.02, 0.92]);
  setScale(gltf, 'suppressor-right-forearm', [0.76, 0.90, 0.76]);
  setScale(gltf, 'suppressor-left-breacher-brace', [1.10, 0.74, 0.96]);
  setScale(gltf, 'suppressor-right-breacher-brace', [0.64, 0.62, 0.66]);
  setScale(gltf, 'suppressor-left-gauntlet', [0.88, 0.92, 0.88]);
  setScale(gltf, 'suppressor-right-gauntlet', [0.74, 0.86, 0.74]);

  setScale(gltf, 'suppressor-reactive-pack', [1.28, 0.96, 1.18]);
  setScale(gltf, 'suppressor-reactive-cell-left', [1.08, 1.12, 1.00]);
  setScale(gltf, 'suppressor-reactive-cell-right', [1.08, 1.12, 1.00]);
  setScale(gltf, 'suppressor-pack-vent-left', [0.72, 0.52, 0.62]);
  setScale(gltf, 'suppressor-pack-vent-right', [0.72, 0.52, 0.62]);
  setScale(gltf, 'suppressor-command-visor', [0.84, 0.80, 0.86]);
  setScale(gltf, 'suppressor-helmet-left-guard', [0.82, 0.78, 0.78]);
  setScale(gltf, 'suppressor-helmet-right-guard', [0.56, 0.62, 0.60]);
  setTranslation(gltf, 'suppressor-guard-light', [0.39, 0.18, 0.30]);

  setScale(gltf, 'suppressor-left-thigh', [0.84, 0.70, 0.80]);
  setScale(gltf, 'suppressor-right-thigh', [0.84, 0.70, 0.80]);
  setScale(gltf, 'suppressor-left-shin', [0.62, 0.86, 0.68]);
  setScale(gltf, 'suppressor-right-shin', [0.62, 0.86, 0.68]);

  const materialNames = ['suppressor-suit', 'suppressor-armor', 'suppressor-equipment', 'suppressor-emissive'];
  const materialTints = [
    [0.10, 0.16, 0.20, 1],
    [0.22, 0.32, 0.38, 1],
    [0.12, 0.13, 0.15, 1],
    [0.12, 0.42, 0.58, 1],
  ];
  for (let index = 0; index < (gltf.materials?.length ?? 0); index += 1) {
    const material = gltf.materials[index];
    material.name = materialNames[index] ?? `suppressor-material-${index}`;
    material.pbrMetallicRoughness ??= {};
    material.pbrMetallicRoughness.baseColorFactor = materialTints[index] ?? [1, 1, 1, 1];
  }
  const emissive = gltf.materials?.[3];
  if (emissive) emissive.emissiveFactor = [0.08, 0.58, 1.0];
  const imageNames = ['suppressor-base-color', 'suppressor-normal', 'suppressor-orm', 'suppressor-emissive'];
  for (let index = 0; index < (gltf.images?.length ?? 0); index += 1) gltf.images[index].name = imageNames[index] ?? `suppressor-texture-${index}`;

  const sourceContract = gltf.extras?.ironshadeP28D1VanguardLod0;
  if (!sourceContract) throw new Error('Suppressor LOD0 source contract is missing');
  gltf.extras = {
    ironshadeP28D5SuppressorEnemyLod0: {
      production: true,
      family: 'suppressor',
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
      roleSilhouetteNodes: ['suppressor-ram-plate', 'suppressor-left-pauldron', 'suppressor-left-breacher-brace', 'suppressor-reactive-pack', 'suppressor-command-visor', 'suppressor-guard-light'],
      weaponArmorSeparation: {
        weaponSide: 'negative-z',
        armoredSide: 'positive-z',
        socket: 'weapon-socket',
        torsoArmorOffsetZ: 0.15,
      },
      geometryFeatures: ['cylindrical-limbs', 'chamfered-armor', 'asymmetric-stabilizer-armor', 'clear-external-weapon-lane', 'layered-helmet', 'recoil-pack'],
      textureChannels: ['base-color', 'normal', 'orm', 'emissive'],
      sourceTriangles: sourceContract.sourceTriangles,
      meshNodeTriangles: sourceContract.meshNodeTriangles,
      legacyLod1Asset: 'enemy-suppressor-lod1',
      legacyLod2Asset: 'enemy-suppressor-lod2',
      sourceGeometryFamily: 'ironshade-hard-surface-v1',
    },
  };

  return encodeGlb(gltf, binary);
}

export async function writeSuppressorEnemyLod0() {
  const outputPath = resolve(OUTPUT_ROOT, SUPPRESSOR_ENEMY_LOD0_RELATIVE_PATH);
  const glb = buildSuppressorEnemyLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] wrote ${SUPPRESSOR_ENEMY_LOD0_RELATIVE_PATH} (${glb.length} bytes)`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeSuppressorEnemyLod0();
