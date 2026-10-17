import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEliteEnemyLod0Glb } from './prepare-elite-enemy-lod0.mjs';

export const REFINERY_BOSS_LOD0_RELATIVE_PATH = 'bosses/enemy-boss-lod0.glb';
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
    throw new Error('Refinery boss LOD0 source must be a glTF 2.0 GLB');
  }
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('Refinery boss LOD0 source GLB length is invalid');

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
  if (!gltf || !binary) throw new Error('Refinery boss LOD0 source GLB is missing JSON or binary data');
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

function nodeIndexByName(gltf, name) {
  return gltf.nodes?.findIndex(node => node.name === name) ?? -1;
}

function nodeByName(gltf, name) {
  const index = nodeIndexByName(gltf, name);
  return index >= 0 ? gltf.nodes[index] : null;
}

function setTranslation(gltf, name, translation) {
  const node = nodeByName(gltf, name);
  if (!node) throw new Error(`Refinery boss LOD0 source is missing ${name}`);
  node.translation = translation;
}

function setScale(gltf, name, scale) {
  const node = nodeByName(gltf, name);
  if (!node) throw new Error(`Refinery boss LOD0 source is missing ${name}`);
  node.scale = scale;
}

function renameNode(gltf, from, to) {
  const node = nodeByName(gltf, from);
  if (!node) throw new Error(`Refinery boss LOD0 source is missing ${from}`);
  node.name = to;
}

function cloneNodeAsChild(gltf, sourceName, parentName, name, translation, scale) {
  const source = nodeByName(gltf, sourceName);
  const parent = nodeByName(gltf, parentName);
  if (!source) throw new Error(`Refinery boss LOD0 source is missing ${sourceName}`);
  if (!parent) throw new Error(`Refinery boss LOD0 source is missing ${parentName}`);
  const clone = {
    ...source,
    name,
    translation,
    scale,
    children: source.children ? [...source.children] : undefined,
    extras: source.extras ? { ...source.extras, phaseAnchor: true } : { phaseAnchor: true },
  };
  gltf.nodes.push(clone);
  const index = gltf.nodes.length - 1;
  parent.children = [...(parent.children ?? []), index];
}

export function buildRefineryBossLod0Glb() {
  const source = buildEliteEnemyLod0Glb();
  const { gltf, binary } = parseGlb(source);

  gltf.asset.generator = 'Ironshade Vector P28-D8 Refinery Boss LOD0 deterministic generator';
  gltf.scenes[0].name = 'refinery-boss-lod0';

  for (const node of gltf.nodes ?? []) {
    if (node.name?.startsWith('elite-')) node.name = `boss-${node.name.slice('elite-'.length)}`;
  }
  for (const mesh of gltf.meshes ?? []) {
    if (mesh.name?.startsWith('elite-')) mesh.name = `boss-${mesh.name.slice('elite-'.length)}`;
  }

  // Match the established boss LOD1 articulation contract so existing animation
  // hooks and sockets remain presentation-only and do not alter simulation bounds.
  setTranslation(gltf, 'hip', [0, 0.93, 0]);
  setTranslation(gltf, 'torso', [0, 0.44, 0]);
  setTranslation(gltf, 'helmet', [0.02, 0.94, 0]);
  setTranslation(gltf, 'arm-left', [0.02, 0.56, 0.66]);
  setTranslation(gltf, 'arm-right', [0.02, 0.56, -0.66]);
  setTranslation(gltf, 'leg-left', [0, 0, 0.28]);
  setTranslation(gltf, 'leg-right', [0, 0, -0.28]);
  setTranslation(gltf, 'backpack', [-0.18, 0.30, 0]);
  setTranslation(gltf, 'weapon-socket', [0.30, 0.18, -0.24]);

  // Boss-quality hard-surface hierarchy: broad cuirass, heavy bastions, reactor
  // housing, reinforced limbs, and a tall command crest. These geometric reads
  // remain recognizable when emissive color is reduced or unavailable.
  setScale(gltf, 'boss-underlayer-torso', [1.10, 1.12, 1.12]);
  setScale(gltf, 'boss-command-cuirass', [1.42, 1.34, 1.46]);
  setTranslation(gltf, 'boss-command-cuirass', [0.39, 0.10, 0]);
  setScale(gltf, 'boss-chest-upper', [1.34, 1.26, 1.38]);
  setTranslation(gltf, 'boss-chest-upper', [0.34, 0.28, 0]);
  setScale(gltf, 'boss-chest-lower', [1.28, 1.18, 1.32]);
  setTranslation(gltf, 'boss-chest-lower', [0.34, -0.12, 0]);
  setScale(gltf, 'boss-collar', [1.32, 1.02, 1.52]);

  renameNode(gltf, 'boss-fin-left', 'boss-shoulder-left');
  renameNode(gltf, 'boss-fin-right', 'boss-shoulder-right');
  setScale(gltf, 'boss-shoulder-left', [1.52, 1.58, 1.70]);
  setScale(gltf, 'boss-shoulder-right', [1.52, 1.58, 1.70]);
  setTranslation(gltf, 'boss-shoulder-left', [0.02, 0.16, 0.08]);
  setTranslation(gltf, 'boss-shoulder-right', [0.02, 0.16, -0.08]);
  setScale(gltf, 'boss-left-forearm', [1.32, 1.38, 1.34]);
  setScale(gltf, 'boss-right-forearm', [1.32, 1.38, 1.34]);
  setScale(gltf, 'boss-forearm-guard-left', [1.48, 1.50, 1.34]);
  setScale(gltf, 'boss-forearm-guard-right', [1.48, 1.50, 1.34]);
  setScale(gltf, 'boss-left-gauntlet', [1.26, 1.22, 1.26]);
  setScale(gltf, 'boss-right-gauntlet', [1.26, 1.22, 1.26]);

  renameNode(gltf, 'boss-command-pack', 'boss-reactor-housing');
  setScale(gltf, 'boss-reactor-housing', [1.26, 1.42, 1.38]);
  renameNode(gltf, 'boss-command-cell-left', 'boss-reactor-cell-left');
  renameNode(gltf, 'boss-command-cell-right', 'boss-reactor-cell-right');
  setScale(gltf, 'boss-reactor-cell-left', [1.18, 1.52, 1.18]);
  setScale(gltf, 'boss-reactor-cell-right', [1.18, 1.52, 1.18]);
  setScale(gltf, 'boss-pack-guard-left', [1.22, 1.34, 1.34]);
  setScale(gltf, 'boss-pack-guard-right', [1.22, 1.34, 1.34]);

  renameNode(gltf, 'boss-crest', 'boss-command-crest');
  setScale(gltf, 'boss-command-crest', [1.24, 2.78, 1.24]);
  setTranslation(gltf, 'boss-command-crest', [0.01, 0.42, 0]);
  renameNode(gltf, 'boss-command-light', 'boss-reactor');
  setTranslation(gltf, 'boss-reactor', [0.43, 0.18, 0]);
  setScale(gltf, 'boss-reactor', [1.34, 1.26, 1.42]);

  // Two symmetric emissive anchors reuse the premium emissive mesh/material and
  // are animated from the existing boss phase signal. They do not own timing.
  cloneNodeAsChild(gltf, 'boss-reactor', 'torso', 'boss-phase-anchor-left', [0.34, 0.28, 0.34], [0.72, 0.92, 0.72]);
  cloneNodeAsChild(gltf, 'boss-reactor', 'torso', 'boss-phase-anchor-right', [0.34, 0.28, -0.34], [0.72, 0.92, 0.72]);

  setScale(gltf, 'boss-left-thigh', [1.18, 1.16, 1.22]);
  setScale(gltf, 'boss-right-thigh', [1.18, 1.16, 1.22]);
  setScale(gltf, 'boss-left-shin', [1.26, 1.28, 1.32]);
  setScale(gltf, 'boss-right-shin', [1.26, 1.28, 1.32]);

  const materialNames = ['boss-suit', 'boss-armor', 'boss-equipment', 'boss-emissive'];
  const materialTints = [
    [0.08, 0.075, 0.08, 1],
    [0.31, 0.12, 0.10, 1],
    [0.25, 0.20, 0.16, 1],
    [0.62, 0.12, 0.07, 1],
  ];
  for (let index = 0; index < (gltf.materials?.length ?? 0); index += 1) {
    const material = gltf.materials[index];
    material.name = materialNames[index] ?? `boss-material-${index}`;
    material.pbrMetallicRoughness ??= {};
    material.pbrMetallicRoughness.baseColorFactor = materialTints[index] ?? [1, 1, 1, 1];
  }
  const emissive = gltf.materials?.[3];
  if (emissive) emissive.emissiveFactor = [1.0, 0.22, 0.10];
  const imageNames = ['boss-base-color', 'boss-normal', 'boss-orm', 'boss-emissive'];
  for (let index = 0; index < (gltf.images?.length ?? 0); index += 1) gltf.images[index].name = imageNames[index] ?? `boss-texture-${index}`;

  const sourceContract = gltf.extras?.ironshadeP28D7EliteEnemyLod0;
  if (!sourceContract) throw new Error('Refinery boss LOD0 source contract is missing');
  gltf.extras = {
    ironshadeP28D8RefineryBossLod0: {
      production: true,
      family: 'boss',
      assetClass: 'boss',
      lodTier: 0,
      deterministic: true,
      embeddedWeapon: false,
      hitboxOwnership: 'simulation',
      gameplayBoundsOwnership: 'simulation',
      bossMechanicsOwnership: 'simulation',
      cueTimingOwnership: 'enemyBossAnimation',
      coordinateSystem: 'right-handed-y-up',
      namedRigNodes: ['enemy-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket'],
      animationHooks: ['hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack'],
      socketNodes: ['weapon-socket'],
      roleSilhouetteNodes: ['boss-command-cuirass', 'boss-shoulder-left', 'boss-shoulder-right', 'boss-reactor-housing', 'boss-command-crest'],
      phaseCueNodes: ['boss-reactor', 'boss-command-crest', 'boss-phase-anchor-left', 'boss-phase-anchor-right'],
      phaseCueTiming: {
        source: 'enemyAnimationProfiles.boss',
        phaseDuration: 0.96,
        phaseRise: 0.24,
        telegraphWindow: 1.18,
      },
      phaseReadability: {
        basis: 'hard-surface-silhouette-and-emissive-anchors',
        pairedShoulderBastions: true,
        crestScaleY: 2.78,
        armSpanZ: 1.32,
        cuirassScaleZ: 1.46,
        symmetricPhaseAnchors: true,
        hueIndependent: true,
      },
      presentationOwnership: {
        telegraphs: 'simulation-read-only',
        lifecycle: 'simulation-read-only',
        protocolsAndStatuses: 'simulation-read-only',
        phaseAnimation: 'simulation-read-only',
      },
      geometryFeatures: ['cylindrical-limbs', 'chamfered-armor', 'boss-command-cuirass', 'paired-shoulder-bastions', 'reactor-housing', 'tall-command-crest', 'reinforced-forearms', 'reinforced-greaves', 'symmetric-phase-anchors', 'clear-external-weapon-lane'],
      textureChannels: ['base-color', 'normal', 'orm', 'emissive'],
      sourceTriangles: sourceContract.sourceTriangles,
      meshNodeTriangles: sourceContract.meshNodeTriangles,
      legacyLod1Asset: 'enemy-boss-lod1',
      legacyLod2Asset: 'enemy-boss-lod2',
      sourceGeometryFamily: 'ironshade-hard-surface-v1',
    },
  };

  return encodeGlb(gltf, binary);
}

export async function writeRefineryBossLod0() {
  const outputPath = resolve(OUTPUT_ROOT, REFINERY_BOSS_LOD0_RELATIVE_PATH);
  const glb = buildRefineryBossLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] wrote ${REFINERY_BOSS_LOD0_RELATIVE_PATH} (${glb.length} bytes)`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryBossLod0();
