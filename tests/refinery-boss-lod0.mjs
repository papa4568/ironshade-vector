import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Scene } from '@babylonjs/core/scene.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import {
  buildRefineryBossLod0Glb,
  REFINERY_BOSS_LOD0_RELATIVE_PATH,
} from '../scripts/prepare-refinery-boss-lod0.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(buffer) {
  assert(buffer.toString('ascii', 0, 4) === 'glTF', 'refinery boss LOD0 must be a GLB');
  assert(buffer.readUInt32LE(4) === 2, 'refinery boss LOD0 must use glTF 2.0');
  assert(buffer.readUInt32LE(8) === buffer.length, 'refinery boss LOD0 GLB length is invalid');
  let offset = 12;
  let json = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4e4f534a) {
      json = JSON.parse(buffer.subarray(offset, offset + length).toString('utf8').replace(/[\u0000\u0020]+$/g, ''));
    }
    offset += length;
  }
  assert(json, 'refinery boss LOD0 is missing the JSON chunk');
  return json;
}

function profileNumber(source, key) {
  const bossStart = source.indexOf('boss: {');
  assert(bossStart >= 0, 'boss animation profile is missing');
  const bossEnd = source.indexOf('\n  },\n};', bossStart);
  assert(bossEnd > bossStart, 'boss animation profile terminator is missing');
  const block = source.slice(bossStart, bossEnd);
  const match = block.match(new RegExp(`${key}:\\s*([0-9.]+)`));
  assert(match, `boss animation profile is missing ${key}`);
  return Number(match[1]);
}

const outputPath = resolve(process.cwd(), 'public/assets/models', REFINERY_BOSS_LOD0_RELATIVE_PATH);
const committed = await readFile(outputPath);
const rebuiltA = buildRefineryBossLod0Glb();
const rebuiltB = buildRefineryBossLod0Glb();
assert(rebuiltA.equals(rebuiltB), 'refinery boss LOD0 generation must remain deterministic');
assert(committed.equals(rebuiltA), 'generated refinery boss LOD0 does not match the production generator output');
assert(committed.length < 3_500_000, `refinery boss LOD0 exceeds the boss compressed-byte budget: ${committed.length}`);

const lod1 = await readFile(resolve(process.cwd(), 'public/assets/models/bosses/enemy-boss-lod1.glb'));
const gltf = parseGlb(committed);
const lod1Gltf = parseGlb(lod1);
const contract = gltf.extras?.ironshadeP28D8RefineryBossLod0;
assert(contract?.production === true, 'refinery boss LOD0 production marker is missing');
assert(contract?.assetClass === 'boss' && contract?.family === 'boss' && contract?.lodTier === 0, 'refinery boss LOD0 identity contract drifted');
assert(contract?.bossMechanicsOwnership === 'simulation' && contract?.gameplayBoundsOwnership === 'simulation', 'refinery boss asset must remain presentation-only');
assert(contract?.cueTimingOwnership === 'enemyBossAnimation', 'refinery boss phase timing must stay owned by enemyBossAnimation');
assert(contract?.phaseReadability?.hueIndependent === true && contract?.phaseReadability?.symmetricPhaseAnchors === true, 'refinery boss phase readability must remain geometric and hue-independent');
assert(contract?.legacyLod1Asset === 'enemy-boss-lod1' && contract?.legacyLod2Asset === 'enemy-boss-lod2', 'refinery boss LOD continuity markers drifted');

const nodeNames = new Set((gltf.nodes ?? []).map(node => node.name));
for (const name of ['enemy-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket']) {
  assert(nodeNames.has(name), `refinery boss LOD0 is missing shared rig/socket node ${name}`);
}
for (const name of ['boss-command-cuirass', 'boss-shoulder-left', 'boss-shoulder-right', 'boss-reactor-housing', 'boss-command-crest']) {
  assert(nodeNames.has(name), `refinery boss LOD0 is missing hard-surface silhouette node ${name}`);
}
for (const name of ['boss-reactor', 'boss-command-crest', 'boss-phase-anchor-left', 'boss-phase-anchor-right']) {
  assert(nodeNames.has(name), `refinery boss LOD0 is missing authored phase cue node ${name}`);
  assert(contract.phaseCueNodes.includes(name), `refinery boss phase cue contract is missing ${name}`);
}
assert((gltf.nodes?.length ?? 0) >= (lod1Gltf.nodes?.length ?? 0) + 12, 'refinery boss LOD0 must materially exceed LOD1 node detail');
assert(committed.length >= lod1.length * 4, 'refinery boss LOD0 must materially exceed the legacy LOD1 authored payload');

const materialNames = new Set((gltf.materials ?? []).map(material => material.name));
for (const name of ['boss-suit', 'boss-armor', 'boss-equipment', 'boss-emissive']) {
  assert(materialNames.has(name), `refinery boss LOD0 is missing premium material ${name}`);
}
const emissive = (gltf.materials ?? []).find(material => material.name === 'boss-emissive');
assert((emissive?.emissiveFactor ?? []).some(value => value >= 0.6), 'refinery boss emissive anchors are not strong enough for phase readability');
assert((gltf.images?.length ?? 0) >= 4, 'refinery boss LOD0 must retain the premium base/normal/ORM/emissive texture set');
for (const image of gltf.images ?? []) {
  assert(Number.isInteger(image.bufferView), `${image.name ?? 'boss texture'} must remain embedded in the GLB`);
  assert(!image.uri, `${image.name ?? 'boss texture'} must not depend on a network URI`);
}

const animationSource = await readFile(resolve(process.cwd(), 'src/game/enemyBossAnimation.ts'), 'utf8');
assert(profileNumber(animationSource, 'phaseDuration') === contract.phaseCueTiming.phaseDuration, 'authored boss phase duration no longer aligns with enemyBossAnimation');
assert(profileNumber(animationSource, 'phaseRise') === contract.phaseCueTiming.phaseRise, 'authored boss phase rise no longer aligns with enemyBossAnimation');
assert(profileNumber(animationSource, 'telegraphWindow') === contract.phaseCueTiming.telegraphWindow, 'authored boss telegraph window no longer aligns with enemyBossAnimation');

const engine = new NullEngine();
const scene = new Scene(engine);
const bytes = new Uint8Array(committed.buffer, committed.byteOffset, committed.byteLength);
const container = await LoadAssetContainerAsync(bytes, scene, { pluginExtension: '.glb', name: REFINERY_BOSS_LOD0_RELATIVE_PATH });
const runtimeMeshes = container.meshes.filter(mesh => mesh.getTotalVertices?.() > 0);
assert(runtimeMeshes.length >= 10, 'Babylon did not load the refinery boss hard-surface mesh hierarchy');
const runtimeMaterials = container.materials.filter(material => material instanceof PBRMaterial);
assert(runtimeMaterials.length >= 4, 'Babylon did not load the refinery boss premium PBR material set');
const runtimeEmissive = runtimeMaterials.find(material => material.name === 'boss-emissive');
assert(runtimeEmissive?.emissiveTexture, 'Babylon refinery boss emissive material is missing its authored emissive texture');
assert(runtimeEmissive?.emissiveColor.r > 0.5, 'Babylon refinery boss emissive response is too weak');

container.dispose();
scene.dispose();
engine.dispose();
console.log(`P28-D8 refinery boss LOD0 checks passed bytes=${committed.length} nodes=${gltf.nodes?.length ?? 0} lod1-bytes=${lod1.length}`);
