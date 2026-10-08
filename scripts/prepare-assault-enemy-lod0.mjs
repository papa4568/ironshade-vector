import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVanguardOperatorLod0Glb } from './prepare-vanguard-operator-lod0.mjs';

export const ASSAULT_ENEMY_LOD0_RELATIVE_PATH = 'enemies/enemy-assault-lod0.glb';
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
    throw new Error('Assault LOD0 source must be a glTF 2.0 GLB');
  }
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('Assault LOD0 source GLB length is invalid');

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
  if (!gltf || !binary) throw new Error('Assault LOD0 source GLB is missing JSON or binary data');
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
  if (!node) throw new Error(`Assault LOD0 source is missing ${name}`);
  node.translation = translation;
}

function setScale(gltf, name, scale) {
  const node = nodeByName(gltf, name);
  if (!node) throw new Error(`Assault LOD0 source is missing ${name}`);
  node.scale = scale;
}

export function buildAssaultEnemyLod0Glb() {
  const source = buildVanguardOperatorLod0Glb();
  const { gltf, binary } = parseGlb(source);

  gltf.asset.generator = 'Ironshade Vector P28-D4 Assault Enemy LOD0 deterministic generator';
  gltf.scenes[0].name = 'assault-enemy-lod0';

  for (const node of gltf.nodes ?? []) {
    if (node.name === 'operator-rig') {
      node.name = 'enemy-rig';
      node.extras = { rig: 'enemy-articulated-v1' };
    } else if (node.name?.startsWith('vanguard-')) {
      node.name = `assault-${node.name.slice('vanguard-'.length)}`;
    }
  }
  for (const mesh of gltf.meshes ?? []) {
    if (mesh.name?.startsWith('vanguard-')) mesh.name = `assault-${mesh.name.slice('vanguard-'.length)}`;
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

  setScale(gltf, 'assault-underlayer-torso', [0.84, 0.86, 0.86]);
  setScale(gltf, 'assault-ram-plate', [0.86, 0.82, 0.90]);
  setTranslation(gltf, 'assault-ram-plate', [0.35, 0.08, 0.20]);
  setScale(gltf, 'assault-chest-upper', [0.80, 0.82, 0.98]);
  setScale(gltf, 'assault-chest-lower', [0.84, 0.72, 0.94]);
  setScale(gltf, 'assault-collar', [0.70, 0.44, 1.00]);
  setScale(gltf, 'assault-left-pauldron', [0.94, 0.88, 0.92]);
  setScale(gltf, 'assault-right-pauldron', [0.94, 0.88, 0.92]);
  setScale(gltf, 'assault-reactive-pack', [0.88, 0.92, 0.88]);
  setScale(gltf, 'assault-command-visor', [0.94, 0.86, 0.90]);
  setScale(gltf, 'assault-left-breacher-brace', [0.68, 0.70, 0.72]);
  setScale(gltf, 'assault-right-breacher-brace', [0.68, 0.70, 0.72]);
  setScale(gltf, 'assault-left-thigh', [0.86, 0.70, 0.82]);
  setScale(gltf, 'assault-right-thigh', [0.86, 0.70, 0.82]);
  setScale(gltf, 'assault-left-shin', [0.64, 0.88, 0.70]);
  setScale(gltf, 'assault-right-shin', [0.64, 0.88, 0.70]);

  const materialNames = ['assault-suit', 'assault-armor', 'assault-equipment', 'assault-emissive'];
  const materialTints = [
    [0.54, 0.20, 0.16, 1],
    [0.72, 0.30, 0.22, 1],
    [0.15, 0.17, 0.18, 1],
    [0.65, 0.22, 0.16, 1],
  ];
  for (let index = 0; index < (gltf.materials?.length ?? 0); index += 1) {
    const material = gltf.materials[index];
    material.name = materialNames[index] ?? `assault-material-${index}`;
    material.pbrMetallicRoughness ??= {};
    material.pbrMetallicRoughness.baseColorFactor = materialTints[index] ?? [1, 1, 1, 1];
  }
  const emissive = gltf.materials?.[3];
  if (emissive) emissive.emissiveFactor = [1.0, 0.18, 0.06];
  const imageNames = ['assault-base-color', 'assault-normal', 'assault-orm', 'assault-emissive'];
  for (let index = 0; index < (gltf.images?.length ?? 0); index += 1) gltf.images[index].name = imageNames[index] ?? `assault-texture-${index}`;

  const sourceContract = gltf.extras?.ironshadeP28D1VanguardLod0;
  if (!sourceContract) throw new Error('Assault LOD0 source contract is missing');
  gltf.extras = {
    ironshadeP28D4AssaultEnemyLod0: {
      production: true,
      family: 'assault',
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
      roleSilhouetteNodes: ['assault-ram-plate', 'assault-left-pauldron', 'assault-right-pauldron', 'assault-reactive-pack', 'assault-command-visor', 'assault-guard-light'],
      geometryFeatures: ['cylindrical-limbs', 'chamfered-armor', 'wedge-ram', 'inset-braces', 'layered-helmet', 'reactive-pack'],
      textureChannels: ['base-color', 'normal', 'orm', 'emissive'],
      sourceTriangles: sourceContract.sourceTriangles,
      meshNodeTriangles: sourceContract.meshNodeTriangles,
      legacyLod1Asset: 'enemy-assault-lod1',
      legacyLod2Asset: 'enemy-assault-lod2',
      sourceGeometryFamily: 'ironshade-hard-surface-v1',
    },
  };

  return encodeGlb(gltf, binary);
}

export async function writeAssaultEnemyLod0() {
  const outputPath = resolve(OUTPUT_ROOT, ASSAULT_ENEMY_LOD0_RELATIVE_PATH);
  const glb = buildAssaultEnemyLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] wrote ${ASSAULT_ENEMY_LOD0_RELATIVE_PATH} (${glb.length} bytes)`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeAssaultEnemyLod0();
