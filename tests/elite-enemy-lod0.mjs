import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Scene } from '@babylonjs/core/scene.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import {
  ELITE_ENEMY_LOD0_RELATIVE_PATH,
  buildEliteEnemyLod0Glb,
} from '../scripts/prepare-elite-enemy-lod0.mjs';
import { buildAssaultEnemyLod0Glb } from '../scripts/prepare-assault-enemy-lod0.mjs';
import { buildSuppressorEnemyLod0Glb } from '../scripts/prepare-suppressor-enemy-lod0.mjs';
import { buildTechnicianEnemyLod0Glb } from '../scripts/prepare-technician-enemy-lod0.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(buffer, label) {
  assert(buffer.toString('ascii', 0, 4) === 'glTF', `${label} must be a GLB`);
  assert(buffer.readUInt32LE(4) === 2, `${label} must use glTF 2.0`);
  assert(buffer.readUInt32LE(8) === buffer.length, `${label} GLB length is invalid`);
  let offset = 12;
  let json = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4e4f534a) json = JSON.parse(buffer.subarray(offset, offset + length).toString('utf8').replace(/[\u0000\u0020]+$/g, ''));
    offset += length;
  }
  assert(json, `${label} is missing the JSON chunk`);
  return json;
}

function nodeByName(gltf, name) {
  return gltf.nodes?.find(node => node.name === name);
}

function assertVector(actual, expected, label) {
  assert(Array.isArray(actual) && actual.length === expected.length, `${label} is missing`);
  for (let index = 0; index < expected.length; index += 1) {
    assert(Math.abs(actual[index] - expected[index]) < 1e-9, `${label}[${index}] changed: ${actual[index]} !== ${expected[index]}`);
  }
}

function sourceTriangles(gltf) {
  return (gltf.meshes ?? []).reduce((sum, mesh) => sum + (mesh.primitives ?? []).reduce((meshSum, primitive) => {
    const accessor = gltf.accessors?.[primitive.indices];
    return meshSum + (accessor?.count ?? 0) / 3;
  }, 0), 0);
}

const rebuiltA = buildEliteEnemyLod0Glb();
const rebuiltB = buildEliteEnemyLod0Glb();
assert(rebuiltA.equals(rebuiltB), 'Elite enemy LOD0 generation is not deterministic');
assert(rebuiltA.length < 1_500_000, `Elite enemy LOD0 exceeds the enemy compressed-byte budget (${rebuiltA.length})`);
const lod1 = await readFile(resolve(process.cwd(), 'public/assets/models/enemies/enemy-elite-lod1.glb'));
const lod2 = await readFile(resolve(process.cwd(), 'public/assets/models/enemies/enemy-elite-lod2.glb'));
assert(!rebuiltA.equals(lod1), 'Elite enemy LOD0 must be distinct from LOD1');
assert(!rebuiltA.equals(lod2), 'Elite enemy LOD0 must be distinct from LOD2');
assert(!rebuiltA.equals(buildAssaultEnemyLod0Glb()), 'Elite enemy LOD0 must be distinct from Assault enemy LOD0');
assert(!rebuiltA.equals(buildSuppressorEnemyLod0Glb()), 'Elite enemy LOD0 must be distinct from Suppressor enemy LOD0');
assert(!rebuiltA.equals(buildTechnicianEnemyLod0Glb()), 'Elite enemy LOD0 must be distinct from Technician enemy LOD0');

const gltf = parseGlb(rebuiltA, 'Elite enemy LOD0');
assert(gltf.asset?.generator === 'Ironshade Vector P28-D7 Elite Enemy LOD0 deterministic generator', 'Elite enemy LOD0 generator marker is missing');
const contract = gltf.extras?.ironshadeP28D7EliteEnemyLod0;
assert(contract?.production === true && contract?.family === 'elite' && contract?.assetClass === 'enemy' && contract?.lodTier === 0, 'Elite enemy LOD0 production identity changed');
assert(contract?.deterministic === true && contract?.embeddedWeapon === false, 'Elite enemy LOD0 must stay deterministic and weapon-free');
assert(contract?.hitboxOwnership === 'simulation' && contract?.gameplayBoundsOwnership === 'simulation', 'Elite enemy LOD0 must not own gameplay collision');
assert(contract?.coordinateSystem === 'right-handed-y-up', 'Elite enemy LOD0 coordinate contract changed');
assert(!gltf.extras?.ironshadeP28D1VanguardLod0, 'Elite enemy LOD0 must not retain Vanguard production metadata');
assert(!(gltf.nodes ?? []).some(node => node.name?.startsWith('vanguard-')), 'Elite enemy LOD0 must not retain Vanguard node identity');
assert(!(gltf.meshes ?? []).some(mesh => mesh.name?.startsWith('vanguard-')), 'Elite enemy LOD0 must not retain Vanguard mesh identity');

const requiredRigNodes = ['enemy-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket'];
for (const name of requiredRigNodes) assert(nodeByName(gltf, name), `Elite enemy LOD0 is missing rig/socket node ${name}`);
assert(contract.namedRigNodes.join('|') === requiredRigNodes.join('|'), 'Elite enemy LOD0 named rig contract drifted');
for (const name of requiredRigNodes.slice(1, -1)) assert(contract.animationHooks.includes(name), `Elite enemy LOD0 animation hooks are missing ${name}`);
assert(contract.socketNodes.includes('weapon-socket'), 'Elite enemy LOD0 socket contract drifted');
assert((nodeByName(gltf, 'weapon-socket').children ?? []).length === 0, 'Elite enemy LOD0 must not embed a weapon under weapon-socket');

assertVector(nodeByName(gltf, 'hip').translation, [0, 0.92, 0], 'hip translation');
assertVector(nodeByName(gltf, 'torso').translation, [0, 0.34, 0], 'torso translation');
assertVector(nodeByName(gltf, 'helmet').translation, [0.02, 0.80, 0], 'helmet translation');
assertVector(nodeByName(gltf, 'arm-left').translation, [0.02, 0.45, 0.49], 'arm-left translation');
assertVector(nodeByName(gltf, 'arm-right').translation, [0.02, 0.45, -0.49], 'arm-right translation');
assertVector(nodeByName(gltf, 'leg-left').translation, [0, 0, 0.19], 'leg-left translation');
assertVector(nodeByName(gltf, 'leg-right').translation, [0, 0, -0.19], 'leg-right translation');
assertVector(nodeByName(gltf, 'backpack').translation, [-0.20, 0.22, 0], 'backpack translation');
assertVector(nodeByName(gltf, 'weapon-socket').translation, [0.22, 0.18, -0.24], 'weapon-socket translation');

for (const name of contract.roleSilhouetteNodes) assert(nodeByName(gltf, name), `Elite enemy LOD0 is missing role silhouette node ${name}`);
for (const name of ['elite-command-cell-left', 'elite-command-cell-right', 'elite-pack-guard-left', 'elite-pack-guard-right', 'elite-temple-guard-left', 'elite-temple-guard-right', 'elite-command-status']) {
  assert(nodeByName(gltf, name), `Elite enemy LOD0 is missing authored threat hardware node ${name}`);
}
const crest = nodeByName(gltf, 'elite-crest');
const finLeft = nodeByName(gltf, 'elite-fin-left');
const finRight = nodeByName(gltf, 'elite-fin-right');
const cuirass = nodeByName(gltf, 'elite-command-cuirass');
const guardLeft = nodeByName(gltf, 'elite-forearm-guard-left');
const guardRight = nodeByName(gltf, 'elite-forearm-guard-right');
assert(crest.scale[1] >= 2.20 && crest.translation[1] >= 0.36, 'Elite crest must remain a tall above-helmet threat marker');
assert(finLeft.scale[1] >= 1.30 && finLeft.scale[2] >= 1.40, 'Elite left fin must remain a broad silhouette marker');
assert(finRight.scale[1] >= 1.30 && finRight.scale[2] >= 1.40, 'Elite right fin must remain a broad silhouette marker');
assertVector(finLeft.scale, finRight.scale, 'paired fin symmetry');
assert(cuirass.scale[0] >= 1.20 && cuirass.scale[2] >= 1.20, 'Elite command cuirass must remain visibly heavier than the base frame');
assert(guardLeft.scale[0] >= 1.20 && guardRight.scale[0] >= 1.20, 'Elite forearm guards must preserve reinforced threat mass');
assert(Math.abs(nodeByName(gltf, 'arm-left').translation[2] - 0.49) < 1e-9 && Math.abs(nodeByName(gltf, 'arm-right').translation[2] + 0.49) < 1e-9, 'Elite arm span must remain wider than the standard enemy stance');
assert(contract.threatReadability?.basis === 'silhouette-and-material-breakup' && contract.threatReadability?.hueIndependent === true, 'Elite threat identity must not depend on hue-only recognition');
assert(contract.threatReadability?.pairedFins === true && contract.threatReadability?.symmetricThreatMarkers === true && contract.threatReadability?.armSpanZ >= 0.98, 'Elite paired threat silhouette contract is incomplete');
assert(contract.presentationOwnership?.telegraphs === 'simulation-read-only' && contract.presentationOwnership?.lifecycle === 'simulation-read-only' && contract.presentationOwnership?.protocolsAndStatuses === 'simulation-read-only', 'Elite LOD0 must preserve simulation-owned presentation alignment');
for (const feature of ['command-cuirass', 'paired-command-fins', 'tall-command-crest', 'reinforced-forearms', 'reinforced-greaves', 'command-pack', 'clear-external-weapon-lane']) {
  assert(contract.geometryFeatures.includes(feature), `Elite geometry feature ${feature} is missing`);
}

// Preserve the established fallback identity at the new hero tier so gameplay
// zoom changes do not swap to a different role language.
const lod1Gltf = parseGlb(lod1, 'Elite enemy LOD1');
for (const marker of ['elite-crest', 'elite-fin-left', 'elite-fin-right']) {
  assert(nodeByName(lod1Gltf, marker), `Elite LOD1 fallback is missing established role marker ${marker}`);
  assert(nodeByName(gltf, marker), `Elite LOD0 is missing continuity marker ${marker}`);
}

assert((gltf.nodes?.length ?? 0) >= 50, `Elite enemy LOD0 authored node density is too low (${gltf.nodes?.length ?? 0})`);
assert((gltf.meshes?.length ?? 0) >= 16, `Elite enemy LOD0 geometry variety is too low (${gltf.meshes?.length ?? 0})`);
assert(contract.sourceTriangles === sourceTriangles(gltf), 'Elite enemy LOD0 source triangle metadata drifted');
assert(contract.sourceTriangles >= 500, `Elite enemy LOD0 source geometry is too coarse (${contract.sourceTriangles} triangles)`);
assert(contract.meshNodeTriangles >= 1_500, `Elite enemy LOD0 instantiated detail is too low (${contract.meshNodeTriangles} triangles)`);
assert(contract.legacyLod1Asset === 'enemy-elite-lod1' && contract.legacyLod2Asset === 'enemy-elite-lod2', 'Elite enemy fallback identity changed');

for (const mesh of gltf.meshes ?? []) {
  for (const primitive of mesh.primitives ?? []) {
    for (const attribute of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']) assert(Number.isInteger(primitive.attributes?.[attribute]), `${mesh.name} is missing ${attribute}`);
    assert(Number.isInteger(primitive.indices), `${mesh.name} is missing indexed geometry`);
  }
}

assert((gltf.materials?.length ?? 0) === 4, 'Elite enemy LOD0 must provide suit, armor, equipment, and emissive materials');
for (const material of gltf.materials) {
  const pbr = material.pbrMetallicRoughness;
  assert(Number.isInteger(pbr?.baseColorTexture?.index), `${material.name} is missing base color`);
  assert(Array.isArray(pbr?.baseColorFactor) && pbr.baseColorFactor.length === 4, `${material.name} is missing elite material tint`);
  assert(Number.isInteger(material.normalTexture?.index), `${material.name} is missing normal data`);
  assert(Number.isInteger(pbr?.metallicRoughnessTexture?.index), `${material.name} is missing ORM data`);
  assert(pbr.metallicRoughnessTexture.index === material.occlusionTexture?.index, `${material.name} must share packed ORM data with occlusion`);
}
const emissiveMaterial = gltf.materials.find(material => material.name === 'elite-emissive');
assert(Number.isInteger(emissiveMaterial?.emissiveTexture?.index), 'Elite enemy LOD0 emissive material is missing its emissive texture');
assert((emissiveMaterial?.emissiveFactor ?? []).some(value => value > 0), 'Elite enemy LOD0 emissive response is disabled');
assert((gltf.images?.length ?? 0) === 4, 'Elite enemy LOD0 must embed four deterministic texture payloads');
for (const image of gltf.images) {
  assert(Number.isInteger(image.bufferView), `${image.name ?? 'Elite texture'} must be embedded in the GLB`);
  assert(image.mimeType === 'image/png' && !image.uri, `${image.name ?? 'Elite texture'} must use deterministic embedded PNG data`);
}

const engine = new NullEngine();
const scene = new Scene(engine);
const bytes = new Uint8Array(rebuiltA.buffer, rebuiltA.byteOffset, rebuiltA.byteLength);
const container = await LoadAssetContainerAsync(bytes, scene, { pluginExtension: '.glb', name: ELITE_ENEMY_LOD0_RELATIVE_PATH });
const runtimeNames = new Set([...container.meshes, ...container.transformNodes].map(runtimeNode => runtimeNode.name));
for (const name of [...requiredRigNodes, ...contract.roleSilhouetteNodes]) assert(runtimeNames.has(name), `Babylon Elite enemy LOD0 is missing runtime node ${name}`);
for (const name of ['elite-suit', 'elite-armor', 'elite-equipment', 'elite-emissive']) {
  const material = container.materials.find(item => item.name === name);
  assert(material instanceof PBRMaterial, `Babylon did not create PBRMaterial ${name}`);
  assert(material.albedoTexture && material.bumpTexture && material.metallicTexture && material.ambientTexture, `Babylon ${name} lost authored PBR texture bindings`);
}
const runtimeEmissive = container.materials.find(item => item.name === 'elite-emissive');
assert(runtimeEmissive.emissiveTexture, 'Babylon Elite emissive material lost its emissive texture');
container.addAllToScene();
const bounds = scene.getWorldExtends();
const height = bounds.max.y - bounds.min.y;
const widthZ = bounds.max.z - bounds.min.z;
assert(Math.abs(bounds.min.y) <= 0.06, `Elite enemy LOD0 ground pivot drifted (${bounds.min.y.toFixed(4)}m)`);
assert(height >= 1.75 && height <= 2.90, `Elite enemy LOD0 authored height is implausible (${height.toFixed(3)}m)`);
assert(widthZ >= 1.05, `Elite enemy LOD0 must retain a visibly broad threat silhouette (${widthZ.toFixed(3)}m)`);

container.dispose();
scene.dispose();
engine.dispose();
console.log(`ELITE_ENEMY_LOD0_PASS bytes=${rebuiltA.length} sourceTriangles=${contract.sourceTriangles} meshNodeTriangles=${contract.meshNodeTriangles} nodes=${gltf.nodes.length}`);
