import './premium-pbr-library.mjs';
import './premium-character-source.mjs';
import './vanguard-operator-lod0.mjs';
import './vector-operator-lod0.mjs';
import './systems-operator-lod0.mjs';
import './assault-enemy-lod0.mjs';
import './suppressor-enemy-lod0.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Scene } from '@babylonjs/core/scene.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import {
  buildPremiumPbrReferenceGlb,
  PREMIUM_PBR_REFERENCE_RELATIVE_PATH,
} from '../scripts/prepare-premium-pbr-reference.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(buffer) {
  assert(buffer.toString('ascii', 0, 4) === 'glTF', 'premium PBR reference must be a GLB');
  assert(buffer.readUInt32LE(4) === 2, 'premium PBR reference must use glTF 2.0');
  assert(buffer.readUInt32LE(8) === buffer.length, 'premium PBR reference GLB length is invalid');
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
  assert(json, 'premium PBR reference is missing the JSON chunk');
  return json;
}

const assetPath = resolve(process.cwd(), 'public/assets/models', PREMIUM_PBR_REFERENCE_RELATIVE_PATH);
const committed = await readFile(assetPath);
const rebuiltA = buildPremiumPbrReferenceGlb();
const rebuiltB = buildPremiumPbrReferenceGlb();
assert(rebuiltA.equals(rebuiltB), 'premium PBR reference generation is not deterministic');
assert(committed.equals(rebuiltA), 'committed premium PBR reference does not match the production generator output');

const gltf = parseGlb(committed);
assert(gltf.asset?.generator === 'Ironshade Vector deterministic premium PBR reference generator', 'premium PBR reference generator marker is missing');
assert(gltf.extras?.ironshadePremiumPbrReference?.ktx2RuntimeCompatible === true, 'premium PBR reference must remain compatible with the local KTX2 runtime path');
assert(gltf.extras?.ironshadePremiumPbrReference?.ormPacking?.occlusion === 'R', 'premium PBR reference ORM occlusion must use R');
assert(gltf.extras?.ironshadePremiumPbrReference?.ormPacking?.roughness === 'G', 'premium PBR reference ORM roughness must use G');
assert(gltf.extras?.ironshadePremiumPbrReference?.ormPacking?.metallic === 'B', 'premium PBR reference ORM metallic must use B');

const primitive = gltf.meshes?.[0]?.primitives?.[0];
assert(Number.isInteger(primitive?.attributes?.POSITION), 'premium PBR reference is missing POSITION');
assert(Number.isInteger(primitive?.attributes?.NORMAL), 'premium PBR reference is missing NORMAL');
assert(Number.isInteger(primitive?.attributes?.TANGENT), 'premium PBR reference is missing TANGENT');
assert(Number.isInteger(primitive?.attributes?.TEXCOORD_0), 'premium PBR reference is missing TEXCOORD_0');

const material = gltf.materials?.[0];
const baseTexture = material?.pbrMetallicRoughness?.baseColorTexture?.index;
const normalTexture = material?.normalTexture?.index;
const ormTexture = material?.pbrMetallicRoughness?.metallicRoughnessTexture?.index;
const occlusionTexture = material?.occlusionTexture?.index;
const emissiveTexture = material?.emissiveTexture?.index;
for (const [label, index] of [
  ['base color', baseTexture],
  ['normal', normalTexture],
  ['ORM', ormTexture],
  ['occlusion', occlusionTexture],
  ['emissive', emissiveTexture],
]) assert(Number.isInteger(index), `premium PBR reference is missing its ${label} texture binding`);
assert(ormTexture === occlusionTexture, 'premium PBR reference must share its packed ORM texture between metallic/roughness and occlusion');
assert((material.emissiveFactor ?? []).some(value => value > 0), 'premium PBR reference emissive factor must be non-zero');

assert((gltf.images?.length ?? 0) === 4, 'premium PBR reference must carry four authored texture payloads');
for (const image of gltf.images) {
  assert(Number.isInteger(image.bufferView), `${image.name ?? 'premium texture'} must be embedded in the GLB buffer`);
  assert(image.mimeType === 'image/png', `${image.name ?? 'premium texture'} must use a deterministic local image payload`);
  assert(!image.uri, `${image.name ?? 'premium texture'} must not depend on a network URI`);
}

const engine = new NullEngine();
const scene = new Scene(engine);
const bytes = new Uint8Array(committed.buffer, committed.byteOffset, committed.byteLength);
const container = await LoadAssetContainerAsync(bytes, scene, { pluginExtension: '.glb', name: PREMIUM_PBR_REFERENCE_RELATIVE_PATH });
const runtimeMesh = container.meshes.find(mesh => mesh.getTotalVertices?.() > 0);
assert(runtimeMesh, 'Babylon did not load the premium PBR reference mesh');
assert(runtimeMesh.isVerticesDataPresent(VertexBuffer.UVKind), 'Babylon premium PBR mesh is missing UV0');
assert(runtimeMesh.isVerticesDataPresent(VertexBuffer.TangentKind), 'Babylon premium PBR mesh is missing tangents');

const runtimeMaterial = container.materials.find(item => item.name === 'premium-pbr-reference');
assert(runtimeMaterial instanceof PBRMaterial, 'Babylon did not create a PBRMaterial for the premium reference');
assert(runtimeMaterial.albedoTexture, 'Babylon premium PBR material is missing its base-color texture');
assert(runtimeMaterial.bumpTexture, 'Babylon premium PBR material is missing its normal texture');
assert(runtimeMaterial.metallicTexture, 'Babylon premium PBR material is missing its metallic/roughness texture');
assert(runtimeMaterial.ambientTexture, 'Babylon premium PBR material is missing its occlusion texture');
assert(runtimeMaterial.emissiveTexture, 'Babylon premium PBR material is missing its emissive texture');
assert(runtimeMaterial.emissiveColor.r > 0 && runtimeMaterial.emissiveColor.g > 0 && runtimeMaterial.emissiveColor.b > 0, 'Babylon premium PBR emissive response is disabled');

container.dispose();
scene.dispose();
engine.dispose();
console.log('premium PBR reference asset checks passed');
