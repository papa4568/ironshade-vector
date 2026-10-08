import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Scene } from '@babylonjs/core/scene.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import {
  buildPremiumCharacterSourceGlb,
  PREMIUM_CHARACTER_SOURCE_RELATIVE_PATH,
} from '../scripts/prepare-premium-character-source.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(buffer) {
  assert(buffer.toString('ascii', 0, 4) === 'glTF', 'premium character source must be a GLB');
  assert(buffer.readUInt32LE(4) === 2, 'premium character source must use glTF 2.0');
  assert(buffer.readUInt32LE(8) === buffer.length, 'premium character source GLB length is invalid');
  let offset = 12;
  let json = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4e4f534a) json = JSON.parse(buffer.subarray(offset, offset + length).toString('utf8').replace(/[\u0000\u0020]+$/g, ''));
    offset += length;
  }
  assert(json, 'premium character source is missing the JSON chunk');
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

const assetPath = resolve(process.cwd(), 'public/assets/models', PREMIUM_CHARACTER_SOURCE_RELATIVE_PATH);
const committed = await readFile(assetPath);
const rebuiltA = buildPremiumCharacterSourceGlb();
const rebuiltB = buildPremiumCharacterSourceGlb();
assert(rebuiltA.equals(rebuiltB), 'premium character source generation is not deterministic');
assert(committed.equals(rebuiltA), 'committed premium character source does not match the production generator output');

const gltf = parseGlb(committed);
assert(gltf.asset?.generator === 'Ironshade Vector deterministic premium character source generator', 'premium character source generator marker is missing');
const contract = gltf.extras?.ironshadePremiumCharacterSource;
assert(contract?.referenceOnly === true, 'premium character source must be explicitly marked as a reference-only authoring path asset');
assert(contract?.hitboxOwnership === 'simulation', 'premium character source must preserve simulation-owned hitboxes');
assert(contract?.forwardAxis === '+X' && contract?.upAxis === '+Y' && contract?.groundPivot === true, 'premium character source coordinate contract changed');
assert(contract?.ormPacking?.occlusion === 'R' && contract?.ormPacking?.roughness === 'G' && contract?.ormPacking?.metallic === 'B', 'premium character source ORM packing contract changed');

const requiredRigNodes = ['operator-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack'];
for (const name of requiredRigNodes) assert(nodeByName(gltf, name), `premium character source is missing rig hook ${name}`);
assert(nodeByName(gltf, 'weapon-socket'), 'premium character source is missing weapon-socket');
assert(contract.namedRigNodes.join('|') === requiredRigNodes.join('|'), 'premium character source named rig contract drifted');
assert(contract.socketNodes.includes('weapon-socket'), 'premium character source socket contract drifted');
for (const name of ['torso', 'helmet', 'weapon-socket']) assert(contract.cueAttachmentNodes.includes(name), `premium character source cue attachment contract is missing ${name}`);
for (const name of requiredRigNodes.slice(1)) assert(contract.animationHooks.includes(name), `premium character source animation hook contract is missing ${name}`);

assertVector(nodeByName(gltf, 'hip').translation, [0, 0.91, 0], 'hip translation');
assertVector(nodeByName(gltf, 'torso').translation, [0, 0.32, 0], 'torso translation');
assertVector(nodeByName(gltf, 'helmet').translation, [0.02, 0.73, 0], 'helmet translation');
assertVector(nodeByName(gltf, 'arm-left').translation, [0.02, 0.42, 0.40], 'arm-left translation');
assertVector(nodeByName(gltf, 'arm-right').translation, [0.02, 0.42, -0.40], 'arm-right translation');
assertVector(nodeByName(gltf, 'leg-left').translation, [0, 0, 0.18], 'leg-left translation');
assertVector(nodeByName(gltf, 'leg-right').translation, [0, 0, -0.18], 'leg-right translation');
assertVector(nodeByName(gltf, 'backpack').translation, [-0.18, 0.18, 0], 'backpack translation');
assertVector(nodeByName(gltf, 'weapon-socket').translation, [0.20, 0.18, -0.24], 'weapon-socket translation');

const socketIndex = gltf.nodes.findIndex(node => node.name === 'weapon-socket');
const toolIndex = gltf.nodes.findIndex(node => node.name === 'source-reference-tool');
assert(socketIndex >= 0 && toolIndex >= 0 && gltf.nodes[socketIndex].children?.includes(toolIndex), 'premium character source tool is not attached through weapon-socket');

const geometryFeatures = new Set(gltf.meshes?.map(mesh => mesh.extras?.geometryFeature));
for (const feature of ['cylindrical-limb', 'chamfered-body', 'chamfered-armor', 'wedge-armor', 'cylindrical-tool']) {
  assert(geometryFeatures.has(feature), `premium character source is missing non-box geometry feature ${feature}`);
  assert(contract.geometryFeatures.includes(feature), `premium character source metadata is missing geometry feature ${feature}`);
}
const cylinderMesh = gltf.meshes.find(mesh => mesh.extras?.geometryFeature === 'cylindrical-limb');
const cylinderAccessor = gltf.accessors[cylinderMesh.primitives[0].attributes.POSITION];
assert(cylinderAccessor.count >= 200, `premium character source cylinder tessellation is too coarse (${cylinderAccessor.count} vertices)`);
for (const mesh of gltf.meshes) {
  for (const primitive of mesh.primitives ?? []) {
    for (const attribute of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']) assert(Number.isInteger(primitive.attributes?.[attribute]), `${mesh.name} is missing ${attribute}`);
    assert(Number.isInteger(primitive.indices), `${mesh.name} is missing indexed geometry`);
  }
}

assert((gltf.materials?.length ?? 0) === 3, 'premium character source must provide suit, armor, and equipment materials');
for (const material of gltf.materials) {
  const pbr = material.pbrMetallicRoughness;
  assert(Number.isInteger(pbr?.baseColorTexture?.index), `${material.name} is missing its base-color texture`);
  assert(Number.isInteger(material.normalTexture?.index), `${material.name} is missing its normal texture`);
  assert(Number.isInteger(pbr?.metallicRoughnessTexture?.index), `${material.name} is missing its ORM texture`);
  assert(pbr.metallicRoughnessTexture.index === material.occlusionTexture?.index, `${material.name} must share its packed ORM texture with occlusion`);
}
const equipmentMaterial = gltf.materials.find(material => material.name === 'premium-character-equipment');
assert(Number.isInteger(equipmentMaterial?.emissiveTexture?.index), 'premium character equipment is missing its emissive texture');
assert((equipmentMaterial?.emissiveFactor ?? []).some(value => value > 0), 'premium character equipment emissive factor is disabled');
assert((gltf.images?.length ?? 0) === 4, 'premium character source must embed four deterministic texture payloads');
for (const image of gltf.images) {
  assert(Number.isInteger(image.bufferView), `${image.name ?? 'premium character texture'} must be embedded in the GLB`);
  assert(image.mimeType === 'image/png', `${image.name ?? 'premium character texture'} must use deterministic local PNG data`);
  assert(!image.uri, `${image.name ?? 'premium character texture'} must not depend on a network URI`);
}

const engine = new NullEngine();
const scene = new Scene(engine);
const bytes = new Uint8Array(committed.buffer, committed.byteOffset, committed.byteLength);
const container = await LoadAssetContainerAsync(bytes, scene, { pluginExtension: '.glb', name: PREMIUM_CHARACTER_SOURCE_RELATIVE_PATH });
const runtimeNames = new Set([...container.meshes, ...container.transformNodes].map(node => node.name));
for (const name of [...requiredRigNodes, 'weapon-socket', 'source-reference-tool']) assert(runtimeNames.has(name), `Babylon premium character source is missing runtime node ${name}`);
for (const name of ['premium-character-suit', 'premium-character-armor', 'premium-character-equipment']) {
  const material = container.materials.find(item => item.name === name);
  assert(material instanceof PBRMaterial, `Babylon did not create PBRMaterial ${name}`);
  assert(material.albedoTexture, `Babylon ${name} is missing base-color texture data`);
  assert(material.bumpTexture, `Babylon ${name} is missing normal texture data`);
  assert(material.metallicTexture, `Babylon ${name} is missing metallic/roughness texture data`);
  assert(material.ambientTexture, `Babylon ${name} is missing occlusion texture data`);
}
const runtimeEquipment = container.materials.find(item => item.name === 'premium-character-equipment');
assert(runtimeEquipment.emissiveTexture, 'Babylon premium-character-equipment is missing emissive texture data');

container.dispose();
scene.dispose();
engine.dispose();
console.log('premium character source path checks passed');
