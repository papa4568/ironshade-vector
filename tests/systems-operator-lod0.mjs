import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Scene } from '@babylonjs/core/scene.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import {
  buildSystemsOperatorLod0Glb,
  SYSTEMS_OPERATOR_LOD0_RELATIVE_PATH,
} from '../scripts/prepare-systems-operator-lod0.mjs';

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

const rebuiltA = buildSystemsOperatorLod0Glb();
const rebuiltB = buildSystemsOperatorLod0Glb();
assert(rebuiltA.equals(rebuiltB), 'Systems LOD0 generation is not deterministic');
assert(rebuiltA.length < 2_500_000, `Systems LOD0 exceeds the operator compressed-byte budget (${rebuiltA.length})`);
const vector = await readFile(resolve(process.cwd(), 'public/assets/models/operators/operator-vector-lod0.glb'));
const vanguard = await readFile(resolve(process.cwd(), 'public/assets/models/operators/operator-vanguard-lod0.glb'));
assert(!rebuiltA.equals(vector), 'Systems LOD0 must be a distinct authored asset, not a Vector duplicate');
assert(!rebuiltA.equals(vanguard), 'Systems LOD0 must be a distinct authored asset, not a Vanguard duplicate');

const gltf = parseGlb(rebuiltA, 'Systems LOD0');
assert(gltf.asset?.generator === 'Ironshade Vector P28-D3 Systems LOD0 deterministic generator', 'Systems LOD0 generator marker is missing');
const contract = gltf.extras?.ironshadeP28D3SystemsLod0;
assert(contract?.production === true && contract?.family === 'systems' && contract?.lodTier === 0, 'Systems LOD0 production identity changed');
assert(contract?.deterministic === true && contract?.embeddedWeapon === false, 'Systems LOD0 must stay deterministic and weapon-free');
assert(contract?.hitboxOwnership === 'simulation' && contract?.gameplayBoundsOwnership === 'simulation', 'Systems LOD0 must not own gameplay collision');
assert(contract?.coordinateSystem === 'right-handed-y-up', 'Systems LOD0 coordinate contract changed');
assert(!gltf.extras?.ironshadeP28D2VectorLod0, 'Systems LOD0 must not retain Vector production metadata');
assert(!(gltf.nodes ?? []).some(node => node.name?.startsWith('vector-')), 'Systems LOD0 must not retain Vector node identity');

const requiredRigNodes = ['operator-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket'];
for (const name of requiredRigNodes) assert(nodeByName(gltf, name), `Systems LOD0 is missing rig/socket node ${name}`);
assert(contract.namedRigNodes.join('|') === requiredRigNodes.join('|'), 'Systems LOD0 named rig contract drifted');
for (const name of requiredRigNodes.slice(1, -1)) assert(contract.animationHooks.includes(name), `Systems LOD0 animation hooks are missing ${name}`);
assert(contract.socketNodes.includes('weapon-socket'), 'Systems LOD0 socket contract drifted');
assert((nodeByName(gltf, 'weapon-socket').children ?? []).length === 0, 'Systems LOD0 must not embed a weapon under weapon-socket');

assertVector(nodeByName(gltf, 'hip').translation, [0, 0.91, 0], 'hip translation');
assertVector(nodeByName(gltf, 'torso').translation, [0, 0.32, 0], 'torso translation');
assertVector(nodeByName(gltf, 'helmet').translation, [0.02, 0.73, 0], 'helmet translation');
assertVector(nodeByName(gltf, 'arm-left').translation, [0.02, 0.42, 0.40], 'arm-left translation');
assertVector(nodeByName(gltf, 'arm-right').translation, [0.02, 0.42, -0.40], 'arm-right translation');
assertVector(nodeByName(gltf, 'leg-left').translation, [0, 0, 0.18], 'leg-left translation');
assertVector(nodeByName(gltf, 'leg-right').translation, [0, 0, -0.18], 'leg-right translation');
assertVector(nodeByName(gltf, 'backpack').translation, [-0.18, 0.18, 0], 'backpack translation');
assertVector(nodeByName(gltf, 'weapon-socket').translation, [0.20, 0.18, -0.24], 'weapon-socket translation');

for (const name of ['systems-diagnostic-chest', 'systems-capacitor-pack', 'systems-relay-left', 'systems-relay-right', 'systems-sensor-crown', 'systems-diagnostic-visor', 'systems-core-status']) {
  assert(nodeByName(gltf, name), `Systems LOD0 is missing class silhouette node ${name}`);
  assert(contract.classSilhouetteNodes.includes(name), `Systems LOD0 metadata is missing class silhouette node ${name}`);
}
for (const name of ['systems-diagnostic-bank-left', 'systems-diagnostic-bank-right', 'systems-left-wrist-console', 'systems-right-wrist-console']) {
  assert(nodeByName(gltf, name), `Systems LOD0 is missing diagnostic detail node ${name}`);
}
assert((gltf.nodes?.length ?? 0) >= 58, `Systems LOD0 authored node density is too low (${gltf.nodes?.length ?? 0})`);
assert((gltf.meshes?.length ?? 0) >= 18, `Systems LOD0 geometry variety is too low (${gltf.meshes?.length ?? 0})`);
assert(contract.sourceTriangles === sourceTriangles(gltf), 'Systems LOD0 source triangle metadata drifted');
assert(contract.sourceTriangles >= 550, `Systems LOD0 source geometry is too coarse (${contract.sourceTriangles} triangles)`);
assert(contract.meshNodeTriangles >= 1_850, `Systems LOD0 instantiated detail is too low (${contract.meshNodeTriangles} triangles)`);

const referencePath = resolve(process.cwd(), 'public/assets/models/operators/operator-premium-source-reference-lod0.glb');
const reference = parseGlb(await readFile(referencePath), 'premium character source reference');
const referenceTriangles = sourceTriangles(reference);
assert(contract.sourceTriangles > referenceTriangles * 1.5, `Systems LOD0 must materially exceed the D0 source geometry baseline (${contract.sourceTriangles} <= ${referenceTriangles} * 1.5)`);

for (const mesh of gltf.meshes ?? []) {
  for (const primitive of mesh.primitives ?? []) {
    for (const attribute of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']) assert(Number.isInteger(primitive.attributes?.[attribute]), `${mesh.name} is missing ${attribute}`);
    assert(Object.keys(primitive.attributes ?? {}).every(attribute => ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'].includes(attribute)), `${mesh.name} carries an invalid glTF vertex semantic`);
    assert(Number.isInteger(primitive.indices), `${mesh.name} is missing indexed geometry`);
  }
}

assert((gltf.materials?.length ?? 0) === 4, 'Systems LOD0 must provide suit, armor, equipment, and emissive materials');
for (const material of gltf.materials) {
  const pbr = material.pbrMetallicRoughness;
  assert(Number.isInteger(pbr?.baseColorTexture?.index), `${material.name} is missing base color`);
  assert(Number.isInteger(material.normalTexture?.index), `${material.name} is missing normal data`);
  assert(Number.isInteger(pbr?.metallicRoughnessTexture?.index), `${material.name} is missing ORM data`);
  assert(pbr.metallicRoughnessTexture.index === material.occlusionTexture?.index, `${material.name} must share packed ORM data with occlusion`);
}
const emissiveMaterial = gltf.materials.find(material => material.name === 'systems-emissive');
assert(Number.isInteger(emissiveMaterial?.emissiveTexture?.index), 'Systems LOD0 emissive material is missing its emissive texture');
assert((emissiveMaterial?.emissiveFactor ?? []).some(value => value > 0), 'Systems LOD0 emissive response is disabled');
assert((gltf.images?.length ?? 0) === 4, 'Systems LOD0 must embed four deterministic texture payloads');
for (const image of gltf.images) {
  assert(Number.isInteger(image.bufferView), `${image.name ?? 'Systems texture'} must be embedded in the GLB`);
  assert(image.mimeType === 'image/png' && !image.uri, `${image.name ?? 'Systems texture'} must use deterministic embedded PNG data`);
}

const engine = new NullEngine();
const scene = new Scene(engine);
const bytes = new Uint8Array(rebuiltA.buffer, rebuiltA.byteOffset, rebuiltA.byteLength);
const container = await LoadAssetContainerAsync(bytes, scene, { pluginExtension: '.glb', name: SYSTEMS_OPERATOR_LOD0_RELATIVE_PATH });
const runtimeNames = new Set([...container.meshes, ...container.transformNodes].map(runtimeNode => runtimeNode.name));
for (const name of [...requiredRigNodes, ...contract.classSilhouetteNodes]) assert(runtimeNames.has(name), `Babylon Systems LOD0 is missing runtime node ${name}`);
for (const name of ['systems-suit', 'systems-armor', 'systems-equipment', 'systems-emissive']) {
  const material = container.materials.find(item => item.name === name);
  assert(material instanceof PBRMaterial, `Babylon did not create PBRMaterial ${name}`);
  assert(material.albedoTexture && material.bumpTexture && material.metallicTexture && material.ambientTexture, `Babylon ${name} lost authored PBR texture bindings`);
}
const runtimeEmissive = container.materials.find(item => item.name === 'systems-emissive');
assert(runtimeEmissive.emissiveTexture, 'Babylon Systems emissive material lost its emissive texture');
container.addAllToScene();
const bounds = scene.getWorldExtends();
const height = bounds.max.y - bounds.min.y;
assert(Math.abs(bounds.min.y) <= 0.03, `Systems LOD0 ground pivot drifted (${bounds.min.y.toFixed(4)}m)`);
assert(height >= 1.5 && height <= 2.6, `Systems LOD0 authored height is implausible (${height.toFixed(3)}m)`);

container.dispose();
scene.dispose();
engine.dispose();
console.log(`SYSTEMS_OPERATOR_LOD0_PASS bytes=${rebuiltA.length} sourceTriangles=${contract.sourceTriangles} meshNodeTriangles=${contract.meshNodeTriangles} nodes=${gltf.nodes.length}`);
