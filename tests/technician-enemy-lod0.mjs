import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Scene } from '@babylonjs/core/scene.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import {
  TECHNICIAN_ENEMY_LOD0_RELATIVE_PATH,
  buildTechnicianEnemyLod0Glb,
} from '../scripts/prepare-technician-enemy-lod0.mjs';
import { buildAssaultEnemyLod0Glb } from '../scripts/prepare-assault-enemy-lod0.mjs';
import { buildSuppressorEnemyLod0Glb } from '../scripts/prepare-suppressor-enemy-lod0.mjs';

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

const rebuiltA = buildTechnicianEnemyLod0Glb();
const rebuiltB = buildTechnicianEnemyLod0Glb();
assert(rebuiltA.equals(rebuiltB), 'Technician enemy LOD0 generation is not deterministic');
assert(rebuiltA.length < 1_500_000, `Technician enemy LOD0 exceeds the enemy compressed-byte budget (${rebuiltA.length})`);
const lod1 = await readFile(resolve(process.cwd(), 'public/assets/models/enemies/enemy-technician-lod1.glb'));
const lod2 = await readFile(resolve(process.cwd(), 'public/assets/models/enemies/enemy-technician-lod2.glb'));
assert(!rebuiltA.equals(lod1), 'Technician enemy LOD0 must be distinct from LOD1');
assert(!rebuiltA.equals(lod2), 'Technician enemy LOD0 must be distinct from LOD2');
assert(!rebuiltA.equals(buildAssaultEnemyLod0Glb()), 'Technician enemy LOD0 must be distinct from Assault enemy LOD0');
assert(!rebuiltA.equals(buildSuppressorEnemyLod0Glb()), 'Technician enemy LOD0 must be distinct from Suppressor enemy LOD0');

const gltf = parseGlb(rebuiltA, 'Technician enemy LOD0');
assert(gltf.asset?.generator === 'Ironshade Vector P28-D6 Technician Enemy LOD0 deterministic generator', 'Technician enemy LOD0 generator marker is missing');
const contract = gltf.extras?.ironshadeP28D6TechnicianEnemyLod0;
assert(contract?.production === true && contract?.family === 'technician' && contract?.assetClass === 'enemy' && contract?.lodTier === 0, 'Technician enemy LOD0 production identity changed');
assert(contract?.deterministic === true && contract?.embeddedWeapon === false, 'Technician enemy LOD0 must stay deterministic and weapon-free');
assert(contract?.hitboxOwnership === 'simulation' && contract?.gameplayBoundsOwnership === 'simulation', 'Technician enemy LOD0 must not own gameplay collision');
assert(contract?.coordinateSystem === 'right-handed-y-up', 'Technician enemy LOD0 coordinate contract changed');
assert(!gltf.extras?.ironshadeP28D1VanguardLod0, 'Technician enemy LOD0 must not retain Vanguard production metadata');
assert(!(gltf.nodes ?? []).some(node => node.name?.startsWith('vanguard-')), 'Technician enemy LOD0 must not retain Vanguard node identity');
assert(!(gltf.meshes ?? []).some(mesh => mesh.name?.startsWith('vanguard-')), 'Technician enemy LOD0 must not retain Vanguard mesh identity');

const requiredRigNodes = ['enemy-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket'];
for (const name of requiredRigNodes) assert(nodeByName(gltf, name), `Technician enemy LOD0 is missing rig/socket node ${name}`);
assert(contract.namedRigNodes.join('|') === requiredRigNodes.join('|'), 'Technician enemy LOD0 named rig contract drifted');
for (const name of requiredRigNodes.slice(1, -1)) assert(contract.animationHooks.includes(name), `Technician enemy LOD0 animation hooks are missing ${name}`);
assert(contract.socketNodes.includes('weapon-socket'), 'Technician enemy LOD0 socket contract drifted');
assert((nodeByName(gltf, 'weapon-socket').children ?? []).length === 0, 'Technician enemy LOD0 must not embed a weapon under weapon-socket');

assertVector(nodeByName(gltf, 'hip').translation, [0, 0.90, 0], 'hip translation');
assertVector(nodeByName(gltf, 'torso').translation, [0, 0.32, 0], 'torso translation');
assertVector(nodeByName(gltf, 'helmet').translation, [0.02, 0.72, 0], 'helmet translation');
assertVector(nodeByName(gltf, 'arm-left').translation, [0.02, 0.43, 0.40], 'arm-left translation');
assertVector(nodeByName(gltf, 'arm-right').translation, [0.02, 0.43, -0.40], 'arm-right translation');
assertVector(nodeByName(gltf, 'leg-left').translation, [0, 0, 0.18], 'leg-left translation');
assertVector(nodeByName(gltf, 'leg-right').translation, [0, 0, -0.18], 'leg-right translation');
assertVector(nodeByName(gltf, 'backpack').translation, [-0.18, 0.20, 0], 'backpack translation');
assertVector(nodeByName(gltf, 'weapon-socket').translation, [0.22, 0.18, -0.24], 'weapon-socket translation');

for (const name of contract.roleSilhouetteNodes) assert(nodeByName(gltf, name), `Technician enemy LOD0 is missing role silhouette node ${name}`);
for (const name of ['technician-power-cell-left', 'technician-power-cell-right', 'technician-tool-canister-left', 'technician-tool-canister-right', 'technician-tool-gauntlet', 'technician-rack-status']) {
  assert(nodeByName(gltf, name), `Technician enemy LOD0 is missing authored hardware node ${name}`);
}
const mast = nodeByName(gltf, 'technician-mast');
const rack = nodeByName(gltf, 'technician-tool-rack');
const fieldTool = nodeByName(gltf, 'technician-field-tool');
const harness = nodeByName(gltf, 'technician-tool-harness');
const scanner = nodeByName(gltf, 'technician-scanner-module');
assert(mast.scale[1] >= 2.0 && mast.translation[1] >= 0.36, 'Technician sensor mast must remain a tall above-helmet silhouette marker');
assert(rack.scale[2] >= 1.25, 'Technician external tool rack must remain visibly deeper than the base pack');
assert(fieldTool.scale[1] >= 1.15 && fieldTool.translation[2] > 0, 'Technician field tool must remain elongated on the positive-Z utility side');
assert(harness.translation[2] >= 0.14, 'Technician tool harness must remain offset toward the utility side');
assert(scanner.scale[2] >= 1.15 && scanner.translation[2] >= 0.24, 'Technician scanner module must remain pronounced on the utility side');
assert(nodeByName(gltf, 'weapon-socket').translation[2] <= -0.20, 'Technician weapon socket must remain on the negative-Z weapon side');
assert(contract.toolHardwareReadability?.utilitySide === 'positive-z' && contract.toolHardwareReadability?.weaponSide === 'negative-z', 'Technician tool/weapon side contract drifted');
assert(contract.toolHardwareReadability?.socket === 'weapon-socket' && contract.toolHardwareReadability?.sensorMastScaleY >= 2.0 && contract.toolHardwareReadability?.toolRackScaleZ >= 1.25, 'Technician tool/hardware readability contract is incomplete');
for (const feature of ['sensor-mast', 'external-tool-rack', 'field-tool-brace', 'power-cells', 'tool-canisters', 'work-light', 'clear-external-weapon-lane']) {
  assert(contract.geometryFeatures.includes(feature), `Technician geometry feature ${feature} is missing`);
}

assert((gltf.nodes?.length ?? 0) >= 50, `Technician enemy LOD0 authored node density is too low (${gltf.nodes?.length ?? 0})`);
assert((gltf.meshes?.length ?? 0) >= 16, `Technician enemy LOD0 geometry variety is too low (${gltf.meshes?.length ?? 0})`);
assert(contract.sourceTriangles === sourceTriangles(gltf), 'Technician enemy LOD0 source triangle metadata drifted');
assert(contract.sourceTriangles >= 500, `Technician enemy LOD0 source geometry is too coarse (${contract.sourceTriangles} triangles)`);
assert(contract.meshNodeTriangles >= 1_500, `Technician enemy LOD0 instantiated detail is too low (${contract.meshNodeTriangles} triangles)`);
assert(contract.legacyLod1Asset === 'enemy-technician-lod1' && contract.legacyLod2Asset === 'enemy-technician-lod2', 'Technician enemy fallback identity changed');

for (const mesh of gltf.meshes ?? []) {
  for (const primitive of mesh.primitives ?? []) {
    for (const attribute of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']) assert(Number.isInteger(primitive.attributes?.[attribute]), `${mesh.name} is missing ${attribute}`);
    assert(Number.isInteger(primitive.indices), `${mesh.name} is missing indexed geometry`);
  }
}

assert((gltf.materials?.length ?? 0) === 4, 'Technician enemy LOD0 must provide suit, armor, equipment, and emissive materials');
for (const material of gltf.materials) {
  const pbr = material.pbrMetallicRoughness;
  assert(Number.isInteger(pbr?.baseColorTexture?.index), `${material.name} is missing base color`);
  assert(Array.isArray(pbr?.baseColorFactor) && pbr.baseColorFactor.length === 4, `${material.name} is missing technician tint`);
  assert(Number.isInteger(material.normalTexture?.index), `${material.name} is missing normal data`);
  assert(Number.isInteger(pbr?.metallicRoughnessTexture?.index), `${material.name} is missing ORM data`);
  assert(pbr.metallicRoughnessTexture.index === material.occlusionTexture?.index, `${material.name} must share packed ORM data with occlusion`);
}
const emissiveMaterial = gltf.materials.find(material => material.name === 'technician-emissive');
assert(Number.isInteger(emissiveMaterial?.emissiveTexture?.index), 'Technician enemy LOD0 emissive material is missing its emissive texture');
assert((emissiveMaterial?.emissiveFactor ?? []).some(value => value > 0), 'Technician enemy LOD0 emissive response is disabled');
assert((gltf.images?.length ?? 0) === 4, 'Technician enemy LOD0 must embed four deterministic texture payloads');
for (const image of gltf.images) {
  assert(Number.isInteger(image.bufferView), `${image.name ?? 'Technician texture'} must be embedded in the GLB`);
  assert(image.mimeType === 'image/png' && !image.uri, `${image.name ?? 'Technician texture'} must use deterministic embedded PNG data`);
}

const engine = new NullEngine();
const scene = new Scene(engine);
const bytes = new Uint8Array(rebuiltA.buffer, rebuiltA.byteOffset, rebuiltA.byteLength);
const container = await LoadAssetContainerAsync(bytes, scene, { pluginExtension: '.glb', name: TECHNICIAN_ENEMY_LOD0_RELATIVE_PATH });
const runtimeNames = new Set([...container.meshes, ...container.transformNodes].map(runtimeNode => runtimeNode.name));
for (const name of [...requiredRigNodes, ...contract.roleSilhouetteNodes]) assert(runtimeNames.has(name), `Babylon Technician enemy LOD0 is missing runtime node ${name}`);
for (const name of ['technician-suit', 'technician-armor', 'technician-equipment', 'technician-emissive']) {
  const material = container.materials.find(item => item.name === name);
  assert(material instanceof PBRMaterial, `Babylon did not create PBRMaterial ${name}`);
  assert(material.albedoTexture && material.bumpTexture && material.metallicTexture && material.ambientTexture, `Babylon ${name} lost authored PBR texture bindings`);
}
const runtimeEmissive = container.materials.find(item => item.name === 'technician-emissive');
assert(runtimeEmissive.emissiveTexture, 'Babylon Technician emissive material lost its emissive texture');
container.addAllToScene();
const bounds = scene.getWorldExtends();
const height = bounds.max.y - bounds.min.y;
assert(Math.abs(bounds.min.y) <= 0.04, `Technician enemy LOD0 ground pivot drifted (${bounds.min.y.toFixed(4)}m)`);
assert(height >= 1.55 && height <= 2.65, `Technician enemy LOD0 authored height is implausible (${height.toFixed(3)}m)`);

container.dispose();
scene.dispose();
engine.dispose();
console.log(`TECHNICIAN_ENEMY_LOD0_PASS bytes=${rebuiltA.length} sourceTriangles=${contract.sourceTriangles} meshNodeTriangles=${contract.meshNodeTriangles} nodes=${gltf.nodes.length}`);
