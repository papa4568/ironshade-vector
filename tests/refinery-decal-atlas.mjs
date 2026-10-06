import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createRefineryDecalAtlasPng,
  REFINERY_DECAL_ATLAS,
  REFINERY_DECAL_TARGETS,
  upgradeRefineryDecalGlb,
} from '../scripts/prepare-refinery-decal-atlas.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(buffer, label) {
  assert(buffer.toString('ascii', 0, 4) === 'glTF', `${label}: invalid GLB magic`);
  assert(buffer.readUInt32LE(4) === 2, `${label}: expected glTF 2.0`);
  assert(buffer.readUInt32LE(8) === buffer.length, `${label}: byte length mismatch`);
  const jsonLength = buffer.readUInt32LE(12);
  assert(buffer.readUInt32LE(16) === 0x4e4f534a, `${label}: missing JSON chunk`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

const expectedDetails = ['panel-seam', 'hazard-stripe', 'service-label', 'grime', 'heat-stain', 'repair-mark'];
assert(REFINERY_DECAL_ATLAS.id === 'refinery-decal-atlas-v1', 'P28-B5 atlas identity changed');
assert(REFINERY_DECAL_ATLAS.width === 512 && REFINERY_DECAL_ATLAS.height === 512, 'P28-B5 atlas must stay 512x512');
assert(JSON.stringify(Object.keys(REFINERY_DECAL_ATLAS.details)) === JSON.stringify(expectedDetails), 'P28-B5 atlas detail vocabulary changed');
assert(REFINERY_DECAL_TARGETS.length === 6, `Expected six P28-B5 machinery LOD targets, got ${REFINERY_DECAL_TARGETS.length}`);
assert(REFINERY_DECAL_TARGETS.every(target => target.cards.every(card => card.plane === 'xy')), 'P28-B5 decal cards must stay vertical so ground combat telegraphs remain unobscured');
assert(REFINERY_DECAL_TARGETS.every(target => target.cards.every(card => card.offset >= 0.01 && card.offset <= 0.02)), 'P28-B5 decal cards need a stable anti-z-fight surface offset');
const placedDetails = [...new Set(REFINERY_DECAL_TARGETS.flatMap(target => target.cards.map(card => card.detail)))];
assert(expectedDetails.every(detail => placedDetails.includes(detail)), `P28-B5 target layouts do not exercise every atlas detail: ${placedDetails.join(',')}`);

const atlasPath = resolve(process.cwd(), 'public/assets', REFINERY_DECAL_ATLAS.relativePath);
const atlasBytes = await readFile(atlasPath);
const rebuiltAtlas = createRefineryDecalAtlasPng();
assert(atlasBytes.equals(rebuiltAtlas), 'P28-B5 refinery decal atlas is not deterministic');
assert(atlasBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'P28-B5 atlas is not a PNG');
assert(atlasBytes.readUInt32BE(16) === 512 && atlasBytes.readUInt32BE(20) === 512, 'P28-B5 atlas PNG dimensions changed');
assert(atlasBytes.length > 4000, `P28-B5 atlas is suspiciously small: ${atlasBytes.length} bytes`);

for (const target of REFINERY_DECAL_TARGETS) {
  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);
  const bytes = await readFile(path);
  const gltf = parseGlb(bytes, target.relativePath);
  const rebuilt = upgradeRefineryDecalGlb(bytes, target);
  assert(bytes.equals(rebuilt), `${target.relativePath}: P28-B5 decal upgrade is not deterministic/idempotent`);

  const marker = gltf.extras?.ironshadeP28B5DecalAtlas;
  assert(marker?.version === 1, `${target.relativePath}: P28-B5 marker is missing`);
  assert(marker?.family === target.family, `${target.relativePath}: P28-B5 marker family changed`);
  assert(marker?.atlas === REFINERY_DECAL_ATLAS.id, `${target.relativePath}: atlas identity changed`);
  assert(marker?.cardCount === target.cards.length, `${target.relativePath}: merged decal card count changed`);
  assert(marker?.batching === 'merged-card-mesh-per-asset', `${target.relativePath}: batching mode changed`);
  assert(marker?.surfaceOffset === 0.012, `${target.relativePath}: anti-z-fight offset changed`);
  assert(marker?.placement === 'vertical-only' && marker?.combatTelegraphOverlap === false, `${target.relativePath}: telegraph-safe placement contract changed`);
  assert(marker?.alphaBlend === true && marker?.emissive === false, `${target.relativePath}: decal blend/readability contract changed`);
  assert(marker?.gameplayBoundsChanged === false, `${target.relativePath}: gameplay bounds must remain unchanged`);

  const detailMeshIndex = (gltf.meshes ?? []).findIndex(mesh => mesh.name === 'p28-b5-refinery-detail-atlas');
  assert(detailMeshIndex >= 0, `${target.relativePath}: merged decal mesh is missing`);
  const detailMesh = gltf.meshes[detailMeshIndex];
  assert(detailMesh.extras?.batching === 'merged-card-mesh-per-asset', `${target.relativePath}: mesh batching metadata changed`);
  assert(detailMesh.primitives?.length === 1, `${target.relativePath}: decal cards must stay in one merged primitive`);
  const primitive = detailMesh.primitives[0];
  assert(Number.isInteger(primitive.attributes?.POSITION) && Number.isInteger(primitive.attributes?.NORMAL) && Number.isInteger(primitive.attributes?.TEXCOORD_0), `${target.relativePath}: decal geometry attributes are incomplete`);
  assert(Number.isInteger(primitive.indices), `${target.relativePath}: decal geometry indices are missing`);
  assert(primitive.attributes?.TANGENT === undefined, `${target.relativePath}: decal mesh should remain a lightweight unlit card batch`);

  const material = gltf.materials?.[primitive.material];
  assert(material?.name === 'refinery-detail-atlas', `${target.relativePath}: decal material slot changed`);
  assert(material?.alphaMode === 'BLEND' && material?.doubleSided === true, `${target.relativePath}: decal alpha blend contract changed`);
  assert(material?.extensions?.KHR_materials_unlit, `${target.relativePath}: decals must remain unlit/non-emissive`);
  assert(material?.emissiveFactor === undefined && material?.emissiveTexture === undefined, `${target.relativePath}: decals must not bloom over gameplay cues`);
  assert(material?.pbrMetallicRoughness?.baseColorFactor?.[3] <= 0.82, `${target.relativePath}: decal opacity exceeds readability budget`);
  const texture = gltf.textures?.[material.pbrMetallicRoughness.baseColorTexture.index];
  const image = gltf.images?.[texture?.source];
  assert(image?.uri === 'refinery-decal-atlas.png', `${target.relativePath}: shared atlas URI changed`);

  const sceneIndex = Number.isInteger(gltf.scene) ? gltf.scene : 0;
  const detailNode = (gltf.nodes ?? []).findIndex(node => node.mesh === detailMeshIndex);
  assert(detailNode >= 0 && gltf.scenes?.[sceneIndex]?.nodes?.includes(detailNode), `${target.relativePath}: merged decal mesh is not mounted in the authored scene`);
}

const telegraphs = await readFile(resolve(process.cwd(), 'src/game/babylonEnemyTelegraphs.ts'), 'utf8');
assert(telegraphs.includes('const FLOOR_Y = 0.045;'), 'Enemy ground-telegraph plane contract changed; re-review P28-B5 decal placement');
const atlasStat = await stat(atlasPath);
console.log(`REFINERY_DECAL_ATLAS_PASS atlas=${atlasStat.size}b targets=${REFINERY_DECAL_TARGETS.length} details=${expectedDetails.join('+')} batching=merged-card-mesh-per-asset telegraphs=vertical-only`);
