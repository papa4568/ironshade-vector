import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVanguardOperatorLod0Glb } from './prepare-vanguard-operator-lod0.mjs';

export const ELITE_ENEMY_LOD0_RELATIVE_PATH = 'enemies/enemy-elite-lod0.glb';
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
    throw new Error('Elite LOD0 source must be a glTF 2.0 GLB');
  }
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('Elite LOD0 source GLB length is invalid');

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
  if (!gltf || !binary) throw new Error('Elite LOD0 source GLB is missing JSON or binary data');
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
  if (!node) throw new Error(`Elite LOD0 source is missing ${name}`);
  node.translation = translation;
}

function setScale(gltf, name, scale) {
  const node = nodeByName(gltf, name);
  if (!node) throw new Error(`Elite LOD0 source is missing ${name}`);
  node.scale = scale;
}

function renameNode(gltf, from, to) {
  const node = nodeByName(gltf, from);
  if (!node) throw new Error(`Elite LOD0 source is missing ${from}`);
  node.name = to;
}

export function buildEliteEnemyLod0Glb() {
  const source = buildVanguardOperatorLod0Glb();
  const { gltf, binary } = parseGlb(source);

  gltf.asset.generator = 'Ironshade Vector P28-D7 Elite Enemy LOD0 deterministic generator';
  gltf.scenes[0].name = 'elite-enemy-lod0';

  for (const node of gltf.nodes ?? []) {
    if (node.name === 'operator-rig') {
      node.name = 'enemy-rig';
      node.extras = { rig: 'enemy-articulated-v1' };
    } else if (node.name?.startsWith('vanguard-')) {
      node.name = `elite-${node.name.slice('vanguard-'.length)}`;
    }
  }
  for (const mesh of gltf.meshes ?? []) {
    if (mesh.name?.startsWith('vanguard-')) mesh.name = `elite-${mesh.name.slice('vanguard-'.length)}`;
  }

  // Preserve the proven enemy articulation/socket ownership while matching the
  // established elite LOD1 stance: higher head line and wider arm separation.
  setTranslation(gltf, 'hip', [0, 0.92, 0]);
  setTranslation(gltf, 'torso', [0, 0.34, 0]);
  setTranslation(gltf, 'helmet', [0.02, 0.80, 0]);
  setTranslation(gltf, 'arm-left', [0.02, 0.45, 0.49]);
  setTranslation(gltf, 'arm-right', [0.02, 0.45, -0.49]);
  setTranslation(gltf, 'leg-left', [0, 0, 0.19]);
  setTranslation(gltf, 'leg-right', [0, 0, -0.19]);
  setTranslation(gltf, 'backpack', [-0.20, 0.22, 0]);
  setTranslation(gltf, 'weapon-socket', [0.22, 0.18, -0.24]);

  // Threat identity is deliberately geometric first: a broad command cuirass,
  // paired fins, tall crest, oversized forearm guards, and reinforced greaves.
  // Material tint reinforces those forms but is not required to distinguish them.
  setScale(gltf, 'elite-underlayer-torso', [1.02, 1.05, 1.02]);
  renameNode(gltf, 'elite-ram-plate', 'elite-command-cuirass');
  setScale(gltf, 'elite-command-cuirass', [1.24, 1.18, 1.24]);
  setTranslation(gltf, 'elite-command-cuirass', [0.36, 0.10, 0]);
  setScale(gltf, 'elite-chest-upper', [1.18, 1.12, 1.22]);
  setTranslation(gltf, 'elite-chest-upper', [0.31, 0.25, 0]);
  setScale(gltf, 'elite-chest-lower', [1.12, 1.04, 1.18]);
  setTranslation(gltf, 'elite-chest-lower', [0.31, -0.11, 0]);
  setScale(gltf, 'elite-collar', [1.18, 0.94, 1.34]);

  renameNode(gltf, 'elite-left-pauldron', 'elite-fin-left');
  renameNode(gltf, 'elite-right-pauldron', 'elite-fin-right');
  setScale(gltf, 'elite-fin-left', [1.30, 1.38, 1.46]);
  setScale(gltf, 'elite-fin-right', [1.30, 1.38, 1.46]);
  setScale(gltf, 'elite-left-forearm', [1.18, 1.24, 1.20]);
  setScale(gltf, 'elite-right-forearm', [1.18, 1.24, 1.20]);
  renameNode(gltf, 'elite-left-breacher-brace', 'elite-forearm-guard-left');
  renameNode(gltf, 'elite-right-breacher-brace', 'elite-forearm-guard-right');
  setScale(gltf, 'elite-forearm-guard-left', [1.28, 1.30, 1.18]);
  setScale(gltf, 'elite-forearm-guard-right', [1.28, 1.30, 1.18]);
  setScale(gltf, 'elite-left-gauntlet', [1.16, 1.12, 1.16]);
  setScale(gltf, 'elite-right-gauntlet', [1.16, 1.12, 1.16]);

  renameNode(gltf, 'elite-reactive-pack', 'elite-command-pack');
  setScale(gltf, 'elite-command-pack', [1.10, 1.24, 1.18]);
  renameNode(gltf, 'elite-reactive-cell-left', 'elite-command-cell-left');
  renameNode(gltf, 'elite-reactive-cell-right', 'elite-command-cell-right');
  setScale(gltf, 'elite-command-cell-left', [1.06, 1.30, 1.06]);
  setScale(gltf, 'elite-command-cell-right', [1.06, 1.30, 1.06]);
  renameNode(gltf, 'elite-pack-vent-left', 'elite-pack-guard-left');
  renameNode(gltf, 'elite-pack-vent-right', 'elite-pack-guard-right');
  setScale(gltf, 'elite-pack-guard-left', [1.10, 1.18, 1.18]);
  setScale(gltf, 'elite-pack-guard-right', [1.10, 1.18, 1.18]);
  renameNode(gltf, 'elite-pack-status', 'elite-command-status');
  setScale(gltf, 'elite-command-status', [1.18, 1.18, 1.18]);

  setScale(gltf, 'elite-command-visor', [1.12, 1.02, 1.18]);
  renameNode(gltf, 'elite-helmet-left-guard', 'elite-temple-guard-left');
  renameNode(gltf, 'elite-helmet-right-guard', 'elite-temple-guard-right');
  setScale(gltf, 'elite-temple-guard-left', [1.16, 1.18, 1.20]);
  setScale(gltf, 'elite-temple-guard-right', [1.16, 1.18, 1.20]);
  renameNode(gltf, 'elite-helmet-beacon', 'elite-crest');
  setScale(gltf, 'elite-crest', [1.08, 2.25, 1.08]);
  setTranslation(gltf, 'elite-crest', [0.01, 0.38, 0]);
  renameNode(gltf, 'elite-guard-light', 'elite-command-light');
  setTranslation(gltf, 'elite-command-light', [0.40, 0.18, 0]);
  setScale(gltf, 'elite-command-light', [1.12, 1.08, 1.20]);

  setScale(gltf, 'elite-left-thigh', [1.08, 1.06, 1.10]);
  setScale(gltf, 'elite-right-thigh', [1.08, 1.06, 1.10]);
  setScale(gltf, 'elite-left-shin', [1.12, 1.12, 1.16]);
  setScale(gltf, 'elite-right-shin', [1.12, 1.12, 1.16]);

  const materialNames = ['elite-suit', 'elite-armor', 'elite-equipment', 'elite-emissive'];
  const materialTints = [
    [0.11, 0.09, 0.12, 1],
    [0.34, 0.15, 0.20, 1],
    [0.24, 0.20, 0.18, 1],
    [0.48, 0.13, 0.20, 1],
  ];
  for (let index = 0; index < (gltf.materials?.length ?? 0); index += 1) {
    const material = gltf.materials[index];
    material.name = materialNames[index] ?? `elite-material-${index}`;
    material.pbrMetallicRoughness ??= {};
    material.pbrMetallicRoughness.baseColorFactor = materialTints[index] ?? [1, 1, 1, 1];
  }
  const emissive = gltf.materials?.[3];
  if (emissive) emissive.emissiveFactor = [1.0, 0.24, 0.38];
  const imageNames = ['elite-base-color', 'elite-normal', 'elite-orm', 'elite-emissive'];
  for (let index = 0; index < (gltf.images?.length ?? 0); index += 1) gltf.images[index].name = imageNames[index] ?? `elite-texture-${index}`;

  const sourceContract = gltf.extras?.ironshadeP28D1VanguardLod0;
  if (!sourceContract) throw new Error('Elite LOD0 source contract is missing');
  gltf.extras = {
    ironshadeP28D7EliteEnemyLod0: {
      production: true,
      family: 'elite',
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
      roleSilhouetteNodes: ['elite-command-cuirass', 'elite-fin-left', 'elite-fin-right', 'elite-forearm-guard-left', 'elite-forearm-guard-right', 'elite-command-pack', 'elite-crest', 'elite-command-light'],
      threatReadability: {
        basis: 'silhouette-and-material-breakup',
        pairedFins: true,
        crestScaleY: 2.25,
        armSpanZ: 0.98,
        cuirassScaleZ: 1.24,
        symmetricThreatMarkers: true,
        hueIndependent: true,
      },
      presentationOwnership: {
        telegraphs: 'simulation-read-only',
        lifecycle: 'simulation-read-only',
        protocolsAndStatuses: 'simulation-read-only',
      },
      geometryFeatures: ['cylindrical-limbs', 'chamfered-armor', 'command-cuirass', 'paired-command-fins', 'tall-command-crest', 'reinforced-forearms', 'reinforced-greaves', 'command-pack', 'clear-external-weapon-lane'],
      textureChannels: ['base-color', 'normal', 'orm', 'emissive'],
      sourceTriangles: sourceContract.sourceTriangles,
      meshNodeTriangles: sourceContract.meshNodeTriangles,
      legacyLod1Asset: 'enemy-elite-lod1',
      legacyLod2Asset: 'enemy-elite-lod2',
      sourceGeometryFamily: 'ironshade-hard-surface-v1',
    },
  };

  return encodeGlb(gltf, binary);
}

export async function writeEliteEnemyLod0() {
  const outputPath = resolve(OUTPUT_ROOT, ELITE_ENEMY_LOD0_RELATIVE_PATH);
  const glb = buildEliteEnemyLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] wrote ${ELITE_ENEMY_LOD0_RELATIVE_PATH} (${glb.length} bytes)`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeEliteEnemyLod0();
