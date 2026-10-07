import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  REFINERY_PREMIUM_SURFACE_TARGETS,
  upgradeRefineryPremiumSurfaceGlb,
} from '../scripts/prepare-refinery-premium-surfaces.mjs';
import {
  REFINERY_FLOOR_LOD0_TARGETS,
  buildRefineryFloorLod0Glb,
} from '../scripts/prepare-refinery-floor-lod0.mjs';
import {
  REFINERY_WALL_LOD0_TARGETS,
  buildRefineryWallLod0Glb,
} from '../scripts/prepare-refinery-wall-lod0.mjs';
import {
  REFINERY_ROUTE_DECAL_TARGETS,
  upgradeRefineryRouteDecalGlb,
} from '../scripts/prepare-refinery-route-decals.mjs';

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

const expectedMaterials = [
  'refinery-structural',
  'refinery-shell',
  'refinery-hazard-emissive',
  'refinery-screen-emissive',
];
const requiredNodeByFamily = {
  floor: 'refinery-floor-panel',
  floorGrate: 'refinery-floor-service-grate',
  bulkhead: 'refinery-bulkhead-left',
  wallPanel: 'refinery-wall-service-panel-shell',
  crate: 'refinery-crate-shell',
};
const expectedNodeTransforms = {
  'refinery-floor-panel': { translation: [0, 0.03, 0], scale: [3.8, 0.08, 3.8] },
  'refinery-floor-service-grate': { translation: [0, 0.035, 0], scale: [3.8, 0.07, 3.8] },
  'refinery-bulkhead-left': { translation: [0, 1.45, -1.75], scale: [0.44, 2.9, 0.38] },
  'refinery-wall-service-panel-shell': { translation: [0, 1.28, 0], scale: [0.18, 2.56, 2.75] },
  'refinery-crate-shell': { translation: [0, 0.42, 0], scale: [1.05, 0.84, 0.82] },
};

for (const target of REFINERY_PREMIUM_SURFACE_TARGETS) {
  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);
  const bytes = await readFile(path);
  const gltf = parseGlb(bytes, target.relativePath);
  const rebuilt = upgradeRefineryPremiumSurfaceGlb(bytes, target);
  assert(bytes.equals(rebuilt), `${target.relativePath}: P28-B2 upgrade is not deterministic/idempotent`);

  assert(gltf.extras?.ironshadeP28B2SurfaceGeometry?.family === target.family, `${target.relativePath}: missing B2 geometry marker`);
  assert(gltf.extras?.ironshadeP28B2SurfaceGeometry?.gameplayBoundsChanged === false, `${target.relativePath}: gameplay-bounds invariant is missing`);
  assert(JSON.stringify(gltf.accessors?.[0]?.min) === JSON.stringify([-0.5, -0.5, -0.5]), `${target.relativePath}: position minimum changed`);
  assert(JSON.stringify(gltf.accessors?.[0]?.max) === JSON.stringify([0.5, 0.5, 0.5]), `${target.relativePath}: position maximum changed`);
  assert(gltf.accessors?.[0]?.count === 24, `${target.relativePath}: expected face-split 24-vertex geometry`);
  assert(gltf.accessors?.[2]?.type === 'VEC4' && gltf.accessors?.[2]?.count === 24, `${target.relativePath}: tangent accessor is missing`);
  assert(gltf.accessors?.[3]?.type === 'VEC2' && gltf.accessors?.[3]?.count === 24, `${target.relativePath}: UV0 accessor is missing`);
  assert(gltf.accessors?.[4]?.count === 36, `${target.relativePath}: index topology changed`);

  const baseMeshes = (gltf.meshes ?? []).filter(mesh => mesh.name !== 'p28-b6-refinery-route-detail-atlas');
  for (const mesh of baseMeshes) {
    for (const primitive of mesh.primitives ?? []) {
      assert(primitive.attributes?.POSITION === 0, `${target.relativePath}: POSITION binding changed`);
      assert(primitive.attributes?.NORMAL === 1, `${target.relativePath}: NORMAL binding changed`);
      assert(primitive.attributes?.TANGENT === 2, `${target.relativePath}: TANGENT binding missing`);
      assert(primitive.attributes?.TEXCOORD_0 === 3, `${target.relativePath}: TEXCOORD_0 binding missing`);
      assert(primitive.indices === 4, `${target.relativePath}: index binding changed`);
    }
  }

  assert(JSON.stringify((gltf.materials ?? []).slice(0, expectedMaterials.length).map(material => material.name)) === JSON.stringify(expectedMaterials), `${target.relativePath}: authored base material slots changed`);
  const requiredName = requiredNodeByFamily[target.family];
  const requiredNode = (gltf.nodes ?? []).find(node => node.name === requiredName);
  assert(requiredNode, `${target.relativePath}: required surface node ${requiredName} is missing`);
  const expectedTransform = expectedNodeTransforms[requiredName];
  assert(JSON.stringify(requiredNode.translation) === JSON.stringify(expectedTransform.translation), `${target.relativePath}: ${requiredName} translation changed`);
  assert(JSON.stringify(requiredNode.scale) === JSON.stringify(expectedTransform.scale), `${target.relativePath}: ${requiredName} scale changed`);
}

const expectedRouteFamilies = ['floor', 'floorGrate', 'bulkhead', 'wallPanel', 'terminal'];
assert(REFINERY_ROUTE_DECAL_TARGETS.length === 14, `Expected fourteen P28-B6 route-decal LOD targets including P28-C1 floor and P28-C2 wall LOD0 assets, got ${REFINERY_ROUTE_DECAL_TARGETS.length}`);
assert(JSON.stringify([...new Set(REFINERY_ROUTE_DECAL_TARGETS.map(target => target.family))]) === JSON.stringify(expectedRouteFamilies), 'P28-B6 route-decal family coverage changed');
assert(REFINERY_ROUTE_DECAL_TARGETS.every(target => target.cards.length >= 1 && target.cards.length <= 3), 'P28-B6 detail batches must stay sparse enough to avoid noisy tiling');
assert(REFINERY_ROUTE_DECAL_TARGETS.every(target => target.cards.every(card => card.offset === 0.012)), 'P28-B6 cards must preserve the anti-z-fight surface offset');
assert(REFINERY_ROUTE_DECAL_TARGETS.filter(target => target.family === 'floor').every(target => target.cards.every(card => card.detail === 'panel-seam')), 'P28-B6 repeated floor modules must use structural seam rhythm instead of repeated salient marks');
assert(REFINERY_ROUTE_DECAL_TARGETS.filter(target => target.cards.some(card => card.plane === 'xz')).every(target => target.opacity <= 0.46), 'P28-B6 ground detail exceeds the gameplay-cue opacity budget');
assert(REFINERY_ROUTE_DECAL_TARGETS.filter(target => ['bulkhead', 'wallPanel', 'terminal'].includes(target.family)).every(target => target.cards.every(card => card.plane === 'yz')), 'P28-B6 focal wall/interactable detail must stay vertical');
const routeDetails = [...new Set(REFINERY_ROUTE_DECAL_TARGETS.flatMap(target => target.cards.map(card => card.detail)))];
for (const detail of ['panel-seam', 'hazard-stripe', 'service-label', 'grime', 'repair-mark']) {
  assert(routeDetails.includes(detail), `P28-B6 route art direction is missing ${detail}`);
}

for (const target of REFINERY_ROUTE_DECAL_TARGETS) {
  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);
  const bytes = await readFile(path);
  const gltf = parseGlb(bytes, target.relativePath);
  const rebuilt = upgradeRefineryRouteDecalGlb(bytes, target);
  assert(bytes.equals(rebuilt), `${target.relativePath}: P28-B6 route decal upgrade is not deterministic/idempotent`);

  const marker = gltf.extras?.ironshadeP28B6RouteDecals;
  assert(marker?.version === 1, `${target.relativePath}: P28-B6 route marker is missing`);
  assert(marker?.atlas === 'refinery-decal-atlas-v1', `${target.relativePath}: P28-B6 shared atlas identity changed`);
  assert(marker?.route === 'deep-salvage-refinery-showcase', `${target.relativePath}: P28-B6 route ownership changed`);
  assert(marker?.family === target.family && marker?.routeRole === target.routeRole, `${target.relativePath}: P28-B6 visual hierarchy role changed`);
  assert(marker?.cardCount === target.cards.length, `${target.relativePath}: P28-B6 merged-card count changed`);
  assert(marker?.batching === 'merged-card-mesh-per-asset', `${target.relativePath}: P28-B6 batching mode changed`);
  assert(marker?.surfaceOffset === 0.012, `${target.relativePath}: P28-B6 anti-z-fight offset changed`);
  assert(marker?.alphaBlend === true && marker?.emissive === false, `${target.relativePath}: P28-B6 readability blend contract changed`);
  assert(marker?.opacity === target.opacity && marker.opacity <= 0.76, `${target.relativePath}: P28-B6 opacity budget changed`);
  assert(marker?.gameplayBoundsChanged === false && marker?.routeLayoutChanged === false, `${target.relativePath}: P28-B6 must remain presentation-only`);
  if (target.cards.some(card => card.plane === 'xz')) {
    assert(marker?.cuePriority === 'gameplay-cues-win:low-opacity-ground-detail', `${target.relativePath}: P28-B6 ground cue-priority contract changed`);
  } else {
    assert(marker?.cuePriority === 'no-floor-cue-overlap', `${target.relativePath}: P28-B6 vertical cue-priority contract changed`);
  }
  if (target.family === 'floor') {
    assert(marker?.repeatedMarkPolicy === 'continuous-structural-seam-rhythm', `${target.relativePath}: P28-B6 anti-tiling floor policy changed`);
  } else {
    assert(marker?.repeatedMarkPolicy === 'mixed-atlas-details+authored-module-rotation', `${target.relativePath}: P28-B6 anti-tiling module policy changed`);
  }

  const detailMeshIndex = (gltf.meshes ?? []).findIndex(mesh => mesh.name === 'p28-b6-refinery-route-detail-atlas');
  assert(detailMeshIndex >= 0, `${target.relativePath}: P28-B6 merged route-detail mesh is missing`);
  const detailMesh = gltf.meshes[detailMeshIndex];
  assert(detailMesh.extras?.cardCount === target.cards.length && detailMesh.extras?.routeRole === target.routeRole, `${target.relativePath}: P28-B6 detail-mesh metadata changed`);
  assert(detailMesh.primitives?.length === 1, `${target.relativePath}: P28-B6 route cards must stay in one merged primitive`);
  const primitive = detailMesh.primitives[0];
  assert(Number.isInteger(primitive.attributes?.POSITION) && Number.isInteger(primitive.attributes?.NORMAL) && Number.isInteger(primitive.attributes?.TEXCOORD_0), `${target.relativePath}: P28-B6 route geometry attributes are incomplete`);
  assert(primitive.attributes?.TANGENT === undefined && Number.isInteger(primitive.indices), `${target.relativePath}: P28-B6 route geometry must remain a lightweight indexed card batch`);

  const material = gltf.materials?.[primitive.material];
  assert(material?.name === 'refinery-route-detail-atlas', `${target.relativePath}: P28-B6 route material slot changed`);
  assert(material?.alphaMode === 'BLEND' && material?.doubleSided === true, `${target.relativePath}: P28-B6 route alpha contract changed`);
  assert(material?.emissiveFactor === undefined && material?.emissiveTexture === undefined, `${target.relativePath}: P28-B6 route details must not bloom over gameplay cues`);
  assert(material?.pbrMetallicRoughness?.baseColorFactor?.[3] === target.opacity, `${target.relativePath}: P28-B6 route material opacity changed`);
  const texture = gltf.textures?.[material.pbrMetallicRoughness.baseColorTexture.index];
  const image = gltf.images?.[texture?.source];
  assert(image?.uri === 'refinery-decal-atlas.png', `${target.relativePath}: P28-B6 no longer uses the shared refinery atlas`);

  const sceneIndex = Number.isInteger(gltf.scene) ? gltf.scene : 0;
  const detailNode = (gltf.nodes ?? []).findIndex(node => node.mesh === detailMeshIndex);
  assert(detailNode >= 0 && gltf.scenes?.[sceneIndex]?.nodes?.includes(detailNode), `${target.relativePath}: P28-B6 route detail is not mounted in the authored scene`);
}

const expectedLod0Nodes = {
  floor: { base: 'refinery-floor-panel', detailToken: 'refinery-floor-seam-', minimumDetailNodes: 4, minimumMeshes: 5 },
  floorGrate: { base: 'refinery-floor-service-grate', detailToken: 'refinery-floor-service-grate-slat-', minimumDetailNodes: 7, minimumMeshes: 6 },
};
for (const target of REFINERY_FLOOR_LOD0_TARGETS) {
  const routeTarget = REFINERY_ROUTE_DECAL_TARGETS.find(candidate => candidate.relativePath === target.relativePath);
  assert(routeTarget, `${target.relativePath}: route decal carry-forward target is missing`);
  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);
  const bytes = await readFile(path);
  const raw = buildRefineryFloorLod0Glb(target);
  const rebuilt = upgradeRefineryRouteDecalGlb(raw, routeTarget);
  assert(bytes.equals(rebuilt), `${target.relativePath}: P28-C1 authored LOD0 output is not deterministic`);
  assert(bytes.length < 1_200_000, `${target.relativePath}: P28-C1 asset exceeds the environment-module compressed-byte budget`);

  const gltf = parseGlb(bytes, target.relativePath);
  const marker = gltf.extras?.ironshadeP28C1FloorLod0;
  assert(marker?.version === 1 && marker?.family === target.family && marker?.lodTier === 0, `${target.relativePath}: P28-C1 LOD0 metadata is missing`);
  assert(marker?.deterministic === true && marker?.stablePivot === 'environment-root', `${target.relativePath}: deterministic pivot contract changed`);
  assert(marker?.gameplayBoundsChanged === false, `${target.relativePath}: P28-C1 must remain presentation-only`);
  assert(JSON.stringify(marker?.footprintMeters) === JSON.stringify([3.8, 3.8]), `${target.relativePath}: 3.8m refinery floor footprint changed`);
  assert(JSON.stringify(marker?.visualBounds?.min) === JSON.stringify([-1.9, 0, -1.9]), `${target.relativePath}: LOD0 visual minimum changed`);
  assert(marker?.visualBounds?.max?.[0] === 1.9 && marker?.visualBounds?.max?.[2] === 1.9, `${target.relativePath}: LOD0 visual footprint exceeds the gameplay module footprint`);
  assert(JSON.stringify(marker?.recoveryLods) === JSON.stringify([1, 2]), `${target.relativePath}: LOD1/LOD2 recovery contract changed`);
  assert(JSON.stringify(marker?.materialSlots) === JSON.stringify(['refinery-structural', 'refinery-shell']), `${target.relativePath}: premium surface material slot contract changed`);
  assert(marker?.sourceTriangles > 100 && marker?.sourceVertices > 100, `${target.relativePath}: LOD0 hard-surface geometry is unexpectedly coarse`);

  const root = (gltf.nodes ?? []).find(node => node.name === 'environment-root');
  assert(root && !root.translation && !root.rotation && !root.scale, `${target.relativePath}: environment-root must remain an identity pivot`);
  const expected = expectedLod0Nodes[target.family];
  const baseNode = (gltf.nodes ?? []).find(node => node.name === expected.base);
  assert(baseNode?.mesh === 0 && !baseNode.translation && !baseNode.rotation && !baseNode.scale, `${target.relativePath}: LOD0 base module moved off the stable pivot`);
  assert((gltf.nodes ?? []).filter(node => node.name?.includes(expected.detailToken)).length >= expected.minimumDetailNodes, `${target.relativePath}: required panel/grate depth detail is missing`);
  const baseMeshes = (gltf.meshes ?? []).filter(mesh => mesh.name !== 'p28-b6-refinery-route-detail-atlas');
  assert(baseMeshes.length >= expected.minimumMeshes, `${target.relativePath}: authored hard-surface mesh count regressed`);
  for (const mesh of baseMeshes) {
    const primitive = mesh.primitives?.[0];
    assert(Number.isInteger(primitive?.attributes?.POSITION), `${target.relativePath}:${mesh.name}: POSITION missing`);
    assert(Number.isInteger(primitive?.attributes?.NORMAL), `${target.relativePath}:${mesh.name}: NORMAL missing`);
    assert(Number.isInteger(primitive?.attributes?.TANGENT), `${target.relativePath}:${mesh.name}: TANGENT missing`);
    assert(Number.isInteger(primitive?.attributes?.TEXCOORD_0), `${target.relativePath}:${mesh.name}: UV0 missing`);
    assert(Number.isInteger(primitive?.indices), `${target.relativePath}:${mesh.name}: indices missing`);
  }
  const basePositionAccessor = gltf.accessors?.[gltf.meshes?.[0]?.primitives?.[0]?.attributes?.POSITION];
  assert(JSON.stringify(basePositionAccessor?.min) === JSON.stringify([-1.9, 0, -1.9]), `${target.relativePath}: authored base bounds minimum changed`);
  assert(basePositionAccessor?.max?.[0] === 1.9 && basePositionAccessor?.max?.[2] === 1.9, `${target.relativePath}: authored base bounds maximum changed`);
  assert(gltf.extras?.ironshadeP28B6RouteDecals?.version === 1, `${target.relativePath}: B6 route detail did not carry forward to LOD0`);
}

const expectedWallLod0 = {
  bulkhead: {
    minimumMeshes: 6,
    visualBounds: { min: [-0.26, 0, -1.94], max: [0.28, 2.92, 1.94] },
    detailTokens: [
      ['refinery-bulkhead-inset-', 2],
      ['refinery-bulkhead-gusset-', 2],
      ['refinery-bulkhead-cap-rib-', 5],
    ],
  },
  wallPanel: {
    minimumMeshes: 8,
    visualBounds: { min: [-0.09, -0.07, -1.375], max: [0.22, 2.63, 1.375] },
    detailTokens: [
      ['refinery-wall-service-panel-fastener-', 4],
      ['refinery-wall-service-panel-vent-', 2],
      ['refinery-wall-service-panel-junction', 1],
    ],
  },
};
for (const target of REFINERY_WALL_LOD0_TARGETS) {
  const routeTarget = REFINERY_ROUTE_DECAL_TARGETS.find(candidate => candidate.relativePath === target.relativePath);
  assert(routeTarget, `${target.relativePath}: route decal carry-forward target is missing`);
  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);
  const bytes = await readFile(path);
  const raw = buildRefineryWallLod0Glb(target);
  const rebuilt = upgradeRefineryRouteDecalGlb(raw, routeTarget);
  assert(bytes.equals(rebuilt), `${target.relativePath}: P28-C2 authored LOD0 output is not deterministic`);
  assert(bytes.length < 1_200_000, `${target.relativePath}: P28-C2 asset exceeds the environment-module compressed-byte budget`);

  const gltf = parseGlb(bytes, target.relativePath);
  const marker = gltf.extras?.ironshadeP28C2WallLod0;
  const expected = expectedWallLod0[target.family];
  assert(marker?.version === 1 && marker?.family === target.family && marker?.lodTier === 0, `${target.relativePath}: P28-C2 LOD0 metadata is missing`);
  assert(marker?.deterministic === true && marker?.stablePivot === 'environment-root', `${target.relativePath}: deterministic pivot contract changed`);
  assert(marker?.gameplayBoundsChanged === false, `${target.relativePath}: P28-C2 must remain presentation-only`);
  assert(JSON.stringify(marker?.visualBounds) === JSON.stringify(expected.visualBounds), `${target.relativePath}: wall visual bounds changed`);
  assert(JSON.stringify(marker?.recoveryLods) === JSON.stringify([1, 2]), `${target.relativePath}: LOD1/LOD2 recovery contract changed`);
  assert(JSON.stringify(marker?.materialSlots) === JSON.stringify(expectedMaterials), `${target.relativePath}: premium surface material slot contract changed`);
  assert(marker?.sourceTriangles > 100 && marker?.sourceVertices > 100, `${target.relativePath}: LOD0 hard-surface geometry is unexpectedly coarse`);

  const root = (gltf.nodes ?? []).find(node => node.name === 'environment-root');
  assert(root && !root.translation && !root.rotation && !root.scale, `${target.relativePath}: environment-root must remain an identity pivot`);
  for (const [token, minimumCount] of expected.detailTokens) {
    assert((gltf.nodes ?? []).filter(node => node.name?.includes(token)).length >= minimumCount, `${target.relativePath}: required wall depth detail ${token} is missing`);
  }
  const baseMeshes = (gltf.meshes ?? []).filter(mesh => mesh.name !== 'p28-b6-refinery-route-detail-atlas');
  assert(baseMeshes.length >= expected.minimumMeshes, `${target.relativePath}: authored hard-surface mesh count regressed`);
  const features = new Set(baseMeshes.map(mesh => mesh.extras?.ironshadeHardSurfaceFeature));
  assert(features.has('inset-panel'), `${target.relativePath}: recessed wall/panel geometry is missing`);
  if (target.family === 'bulkhead') assert(features.has('wedge-extrusion'), `${target.relativePath}: bulkhead silhouette gussets are missing`);
  for (const mesh of baseMeshes) {
    const primitive = mesh.primitives?.[0];
    assert(Number.isInteger(primitive?.attributes?.POSITION), `${target.relativePath}:${mesh.name}: POSITION missing`);
    assert(Number.isInteger(primitive?.attributes?.NORMAL), `${target.relativePath}:${mesh.name}: NORMAL missing`);
    assert(Number.isInteger(primitive?.attributes?.TANGENT), `${target.relativePath}:${mesh.name}: TANGENT missing`);
    assert(Number.isInteger(primitive?.attributes?.TEXCOORD_0), `${target.relativePath}:${mesh.name}: UV0 missing`);
    assert(Number.isInteger(primitive?.indices), `${target.relativePath}:${mesh.name}: indices missing`);
  }
  assert(gltf.extras?.ironshadeP28B6RouteDecals?.version === 1, `${target.relativePath}: B6 route detail did not carry forward to LOD0`);
}

const rendererSource = await readFile(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
const verifierSource = await readFile(resolve(process.cwd(), 'scripts/verify-authored-refinery.mjs'), 'utf8');
const imageGradeSource = await readFile(resolve(process.cwd(), 'scripts/p28a5-image-grade-capture.mjs'), 'utf8');
const telegraphSource = await readFile(resolve(process.cwd(), 'src/game/babylonEnemyTelegraphs.ts'), 'utf8');
const manifestSource = await readFile(resolve(process.cwd(), 'src/game/graphicsAssetManifest.ts'), 'utf8');
const assetContractSource = await readFile(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
const expectedTelemetrySegments = [
  'floor:bare-metal+deck-plate',
  'floor-grate:bare-metal+painted-metal',
  'bulkhead:painted-metal',
  'wall-panel:bare-metal+painted-metal',
  'crate:bare-metal+painted-metal+polymer-rubber',
];
for (const segment of expectedTelemetrySegments) {
  assert(rendererSource.includes(segment), `Babylon refinery renderer is missing premium-surface telemetry segment ${segment}`);
  assert(verifierSource.includes(segment), `Authored-refinery live verifier does not enforce premium-surface telemetry segment ${segment}`);
}
for (const surface of ['deck-plate', 'bare-metal', 'painted-metal', 'polymer-rubber']) {
  assert(rendererSource.includes(`'${surface}'`), `Babylon refinery renderer does not bind ${surface}`);
}
assert(rendererSource.includes('normal+roughness+metalness:shared-premium-pbr'), 'Babylon refinery renderer is missing material-detail telemetry');
assert(verifierSource.includes('canvas.dataset.babylonEnvironmentPremiumSurfaces'), 'Authored-refinery live verifier does not read B2 premium-surface telemetry');
assert(verifierSource.includes('normal+roughness+metalness:shared-premium-pbr'), 'Authored-refinery live verifier does not enforce B2 material-detail telemetry');
assert(telegraphSource.includes('const FLOOR_Y = 0.045;'), 'Enemy ground-telegraph height changed; re-review P28-B6 low-opacity floor detail');
assert(manifestSource.includes("0: createGraphicsAssetSpec('refinery-floor-panel-lod0'"), 'P28-C1 refinery floor LOD0 is not registered in the asset manifest');
assert(manifestSource.includes("0: createGraphicsAssetSpec('refinery-floor-service-grate-lod0'"), 'P28-C1 refinery grate LOD0 is not registered in the asset manifest');
assert(manifestSource.includes("0: createGraphicsAssetSpec('refinery-bulkhead-lod0'"), 'P28-C2 refinery bulkhead LOD0 is not registered in the asset manifest');
assert(manifestSource.includes("0: createGraphicsAssetSpec('refinery-wall-service-panel-lod0'"), 'P28-C2 refinery wall-panel LOD0 is not registered in the asset manifest');
assert(assetContractSource.includes('if (detailScale >= 0.9) return 0;') && assetContractSource.includes('0: [0, 1, 2]'), 'Flagship detail selection must prefer LOD0 then recover to LOD1/LOD2');
assert(imageGradeSource.includes("visualDetail: 'p28-c2-refinery-wall-lod0'"), 'P28-C2 Flagship image-grade capture is not tagged for the LOD0 wall candidate');

const lod0TargetCount = REFINERY_FLOOR_LOD0_TARGETS.length + REFINERY_WALL_LOD0_TARGETS.length;
console.log(`REFINERY_PREMIUM_SURFACES_PASS targets=${REFINERY_PREMIUM_SURFACE_TARGETS.length} routeTargets=${REFINERY_ROUTE_DECAL_TARGETS.length} lod0Targets=${lod0TargetCount} attributes=POSITION+NORMAL+TANGENT+TEXCOORD_0 bounds=unchanged route=${expectedRouteFamilies.join('+')} detail=${routeDetails.join('+')}`);
