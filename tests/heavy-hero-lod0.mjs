import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { measureGlb, createHeavyManifest } from '../tools/heavy-asset-manifest.mjs';
import { buildVanguardOperatorLod0Glb, VANGUARD_OPERATOR_LOD0_RELATIVE_PATH } from '../scripts/prepare-vanguard-operator-lod0.mjs';
import { buildVectorOperatorLod0Glb, VECTOR_OPERATOR_LOD0_RELATIVE_PATH } from '../scripts/prepare-vector-operator-lod0.mjs';
import { buildSystemsOperatorLod0Glb, SYSTEMS_OPERATOR_LOD0_RELATIVE_PATH } from '../scripts/prepare-systems-operator-lod0.mjs';
import { buildAssaultEnemyLod0Glb, ASSAULT_ENEMY_LOD0_RELATIVE_PATH } from '../scripts/prepare-assault-enemy-lod0.mjs';
import { buildSuppressorEnemyLod0Glb, SUPPRESSOR_ENEMY_LOD0_RELATIVE_PATH } from '../scripts/prepare-suppressor-enemy-lod0.mjs';
import { buildTechnicianEnemyLod0Glb, TECHNICIAN_ENEMY_LOD0_RELATIVE_PATH } from '../scripts/prepare-technician-enemy-lod0.mjs';
import { buildEliteEnemyLod0Glb, ELITE_ENEMY_LOD0_RELATIVE_PATH } from '../scripts/prepare-elite-enemy-lod0.mjs';
import { buildRefineryBossLod0Glb, REFINERY_BOSS_LOD0_RELATIVE_PATH } from '../scripts/prepare-refinery-boss-lod0.mjs';

const families = [
  ['vanguard', VANGUARD_OPERATOR_LOD0_RELATIVE_PATH, buildVanguardOperatorLod0Glb, 'operator'],
  ['vector', VECTOR_OPERATOR_LOD0_RELATIVE_PATH, buildVectorOperatorLod0Glb, 'operator'],
  ['systems', SYSTEMS_OPERATOR_LOD0_RELATIVE_PATH, buildSystemsOperatorLod0Glb, 'operator'],
  ['assault', ASSAULT_ENEMY_LOD0_RELATIVE_PATH, buildAssaultEnemyLod0Glb, 'enemy'],
  ['suppressor', SUPPRESSOR_ENEMY_LOD0_RELATIVE_PATH, buildSuppressorEnemyLod0Glb, 'enemy'],
  ['technician', TECHNICIAN_ENEMY_LOD0_RELATIVE_PATH, buildTechnicianEnemyLod0Glb, 'enemy'],
  ['elite', ELITE_ENEMY_LOD0_RELATIVE_PATH, buildEliteEnemyLod0Glb, 'enemy'],
  ['boss', REFINERY_BOSS_LOD0_RELATIVE_PATH, buildRefineryBossLod0Glb, 'boss'],
];
function parseGlb(buffer) {
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + length).toString('utf8').trim());
}
const uniqueMeshFingerprints = new Set();
let shipped = 0;
let triangles = 0;
for (const [family, path, build] of families) {
  const generated = build();
  const onDisk = await readFile(resolve('public/assets/models', path));
  assert(generated.equals(onDisk), family + ': generated GLB must match packaged GLB byte-for-byte');
  assert(generated.length >= 150_000, family + ': still a lightweight placeholder payload');
  const gltf = parseGlb(generated);
  const extras = gltf.extras?.ironshadeP28F3HeavyHero;
  assert.equal(extras?.family, family, family + ': family-specific premium art contract missing');
  assert.deepEqual(extras.authoredTextureDimensions, [256, 256]);
  assert.equal(extras.placedNodes, 4);
  assert.equal(extras.hitboxOwnership, 'simulation');
  const rig = family === 'vanguard' || family === 'vector' || family === 'systems' ? 'operator-rig' : 'enemy-rig';
  for (const name of [rig, 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket']) {
    assert(gltf.nodes.some(node => node.name === name), family + ': missing animation/socket node ' + name);
  }
  const newMeshes = gltf.meshes.filter(mesh => mesh.name?.startsWith(family + '-p28f3-'));
  assert.equal(newMeshes.length, 2, family + ': both authored mesh features must ship');
  const featureNames = new Set(newMeshes.map(mesh => mesh.extras?.ironshadeHeroFeature));
  assert.deepEqual(featureNames, new Set(['machined-open-flange', 'open-machined-louver']));
  const placedNodes = gltf.nodes.filter(node => node.name?.startsWith(family + '-p28f3-detail-'));
  assert.equal(placedNodes.length, 4, family + ': detail geometry must be placed on the live rig');
  for (const mesh of newMeshes) {
    const index = gltf.meshes.indexOf(mesh);
    assert(placedNodes.some(node => node.mesh === index), family + ': mesh is not attached to runtime rig');
  }
  const newMaterial = gltf.materials.find(material => material.name === family + '-f3-authored-hardsurface');
  assert(newMaterial?.pbrMetallicRoughness?.baseColorTexture && newMaterial.normalTexture &&
    newMaterial.pbrMetallicRoughness.metallicRoughnessTexture && newMaterial.occlusionTexture &&
    newMaterial.emissiveTexture, family + ': authored PBR channels must be used by visible meshes');
  const measured = measureGlb(generated, family);
  const usedMaps = measured.embeddedTextures.filter(image => image.name?.startsWith(family + '-f3-'));
  assert.equal(usedMaps.length, 4, family + ': all four authored maps must be material-bound');
  assert(usedMaps.every(image => image.dimensions[0] === 256 && image.dimensions[1] === 256), family + ': full source texture detail missing');
  assert(!measured.legacyCube, family + ': placeholder cube LOD0 is not acceptable');
  assert.equal(measured.unusedBufferViewBytes, 0, family + ': unused source bytes cannot inflate install size');
  assert(measured.vertices > 3500 && measured.triangles > 1500, family + ': geometry has insufficient surface detail');
  const fingerprints = newMeshes.map(mesh => mesh.primitives.map(primitive => (
    gltf.accessors[primitive.attributes.POSITION].count + ':' + gltf.accessors[primitive.indices].count
  )).join('/')).join('/');
  assert(!uniqueMeshFingerprints.has(fingerprints), family + ': another hero uses identical mesh topology');
  uniqueMeshFingerprints.add(fingerprints);
  shipped += generated.length;
  triangles += measured.triangles;
  console.log('P28_F3_HERO family=' + family + ' bytes=' + generated.length + ' vertices=' + measured.vertices + ' triangles=' + measured.triangles);
}
assert(shipped >= 1_500_000 && triangles >= 20_000, 'P28-F3 requires substantial real authored mesh payload across all eight families');
const manifest = await createHeavyManifest();
let measuredBytes = 0;
for (const [family, path] of families) {
  const record = manifest.assets.find(asset => asset.path === 'assets/models/' + path);
  assert(record, family + ': not present in heavy-art manifest');
  assert(record.runtimeReferenced && record.premiumQualified, family + ': not qualified as runtime premium art');
  assert(record.uniqueMeaningfulBytes > 0, family + ': no unique authored data credited');
  measuredBytes += record.onDiskBytes;
}
assert(measuredBytes === shipped, 'manifest must account for each family exact byte count');
for (const category of ['operator', 'enemy', 'boss']) {
  assert(manifest.categories[category].uniquePremiumSourceBytes > 0, category + ': premium source accounting missing');
}
console.log('P28_F3_HEAVY_HERO_PASS families=8 sourceBytes=' + shipped + ' triangles=' + triangles + ' manifestBytes=' + measuredBytes);
