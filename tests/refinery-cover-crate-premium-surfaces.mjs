import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  REFINERY_PREMIUM_SURFACE_TARGETS,
  upgradeRefineryPremiumSurfaceGlb,
} from '../scripts/prepare-refinery-premium-surfaces.mjs';
import {
  REFINERY_CRATE_LOD0_TARGET,
  buildRefineryCrateLod0Glb,
} from '../scripts/prepare-refinery-crate-lod0.mjs';

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

const crateTargets = REFINERY_PREMIUM_SURFACE_TARGETS.filter(target => target.family === 'crate');
assert(crateTargets.length === 2, `Expected two crate premium-surface recovery targets, got ${crateTargets.length}`);
for (const target of crateTargets) {
  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);
  const bytes = await readFile(path);
  const gltf = parseGlb(bytes, target.relativePath);
  assert(bytes.equals(upgradeRefineryPremiumSurfaceGlb(bytes, target)), `${target.relativePath}: upgrade is not deterministic/idempotent`);
  assert(gltf.extras?.ironshadeP28B2SurfaceGeometry?.family === 'crate', `${target.relativePath}: premium geometry marker is missing`);
  assert(gltf.extras?.ironshadeP28B2SurfaceGeometry?.gameplayBoundsChanged === false, `${target.relativePath}: gameplay bounds must remain unchanged`);
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      assert(primitive.attributes?.TANGENT === 2, `${target.relativePath}: TANGENT is missing`);
      assert(primitive.attributes?.TEXCOORD_0 === 3, `${target.relativePath}: TEXCOORD_0 is missing`);
    }
  }
  const shell = (gltf.nodes ?? []).find(node => node.name === 'refinery-crate-shell');
  const band = (gltf.nodes ?? []).find(node => node.name === 'refinery-crate-band');
  const marker = (gltf.nodes ?? []).find(node => node.name === 'refinery-crate-marker');
  assert(JSON.stringify(shell?.scale) === JSON.stringify([1.05, 0.84, 0.82]), `${target.relativePath}: shell scale changed`);
  assert(JSON.stringify(band?.scale) === JSON.stringify([0.12, 0.90, 0.90]), `${target.relativePath}: band scale changed`);
  assert(marker?.mesh === 2, `${target.relativePath}: marker must retain the authored third material slot`);
}

assert(REFINERY_CRATE_LOD0_TARGET.family === 'crate', 'P28-C7 target family changed');
assert(REFINERY_CRATE_LOD0_TARGET.relativePath === 'environments/refinery-crate-lod0.glb', 'P28-C7 target path changed');
const lod0Path = resolve(process.cwd(), 'public/assets/models', REFINERY_CRATE_LOD0_TARGET.relativePath);
const lod0Bytes = await readFile(lod0Path);
const rebuiltLod0 = buildRefineryCrateLod0Glb(REFINERY_CRATE_LOD0_TARGET);
assert(lod0Bytes.equals(rebuiltLod0), `${REFINERY_CRATE_LOD0_TARGET.relativePath}: P28-C7 authored LOD0 output is not deterministic`);
assert(lod0Bytes.length < 1_200_000, `${REFINERY_CRATE_LOD0_TARGET.relativePath}: P28-C7 asset exceeds the environment-module compressed-byte budget`);

const lod0 = parseGlb(lod0Bytes, REFINERY_CRATE_LOD0_TARGET.relativePath);
const lod0Marker = lod0.extras?.ironshadeP28C7CrateLod0;
const expectedMaterials = ['refinery-structural', 'refinery-shell', 'refinery-hazard-emissive', 'refinery-screen-emissive'];
const expectedGameplayDimensions = [1.05, 0.84, 0.82];
const expectedLegacyBounds = { min: [-0.525, -0.02, -0.45], max: [0.585, 0.88, 0.45] };
const expectedAuthoredBounds = { min: [-0.525, 0, -0.41], max: [0.585, 0.84, 0.41] };
assert(lod0Marker?.version === 1 && lod0Marker?.family === 'crate' && lod0Marker?.lodTier === 0, 'P28-C7 crate metadata is missing');
assert(lod0Marker?.deterministic === true && lod0Marker?.stablePivot === 'environment-root', 'P28-C7 deterministic stable-pivot contract changed');
assert(JSON.stringify(lod0Marker?.gameplayDimensions) === JSON.stringify(expectedGameplayDimensions), 'P28-C7 crate gameplay dimensions changed');
assert(JSON.stringify(lod0Marker?.legacyVisualBounds) === JSON.stringify(expectedLegacyBounds), 'P28-C7 legacy visual envelope changed');
assert(JSON.stringify(lod0Marker?.authoredVisualBounds) === JSON.stringify(expectedAuthoredBounds), 'P28-C7 authored visual envelope changed');
assert(lod0Marker?.gameplayCoordinatesChanged === false && lod0Marker?.gameplayDimensionsChanged === false && lod0Marker?.collisionDimensionsChanged === false, 'P28-C7 must remain presentation-only with simulation-owned dimensions');
assert(JSON.stringify(lod0Marker?.recoveryLods) === JSON.stringify([1, 2]), 'P28-C7 LOD1/LOD2 recovery contract changed');
assert(JSON.stringify(lod0Marker?.materialSlots) === JSON.stringify(expectedMaterials), 'P28-C7 premium surface material slots changed');
assert(lod0Marker?.premiumSurfaceBinding === 'refinery-structural:bare-metal|refinery-shell:painted-metal|refinery-hazard-emissive:polymer-rubber', 'P28-C7 premium material binding changed');
assert(lod0Marker?.uniqueGeometryMeshes >= 11, 'P28-C7 crate LOD0 hard-surface mesh count is unexpectedly low');
assert(lod0Marker?.authoredNodeCount >= 21, 'P28-C7 crate authored node count is unexpectedly low');
assert(lod0Marker?.sourceTriangles >= 340 && lod0Marker?.sourceVertices >= 1000, 'P28-C7 crate LOD0 source geometry is unexpectedly coarse');

const root = (lod0.nodes ?? []).find(node => node.name === 'environment-root');
assert(root && !root.translation && !root.rotation && !root.scale, 'P28-C7 environment-root must remain an identity placement pivot');
for (const [token, minimumCount] of [
  ['refinery-crate-lid', 1],
  ['refinery-crate-band', 1],
  ['corner-brace-', 4],
  ['side-panel-', 2],
  ['handle-front-', 3],
  ['handle-rear-', 3],
  ['top-rail-', 2],
  ['base-skid-', 2],
  ['refinery-crate-marker', 1],
  ['refinery-crate-latch', 1],
]) {
  assert((lod0.nodes ?? []).filter(node => node.name?.includes(token)).length >= minimumCount, `P28-C7 crate detail ${token} is missing`);
}

const features = new Set((lod0.meshes ?? []).map(mesh => mesh.extras?.ironshadeHardSurfaceFeature));
for (const feature of ['chamfered-solid', 'inset-panel']) {
  assert(features.has(feature), `P28-C7 required hard-surface feature ${feature} is missing`);
}
const usedMaterials = new Set();
for (const mesh of lod0.meshes ?? []) {
  const primitive = mesh.primitives?.[0];
  assert(Number.isInteger(primitive?.attributes?.POSITION), `${mesh.name}: POSITION missing`);
  assert(Number.isInteger(primitive?.attributes?.NORMAL), `${mesh.name}: NORMAL missing`);
  assert(Number.isInteger(primitive?.attributes?.TANGENT), `${mesh.name}: TANGENT missing`);
  assert(Number.isInteger(primitive?.attributes?.TEXCOORD_0), `${mesh.name}: UV0 missing`);
  assert(Number.isInteger(primitive?.indices), `${mesh.name}: indices missing`);
  usedMaterials.add(primitive.material);
}
assert(JSON.stringify([...usedMaterials].sort()) === JSON.stringify([0, 1, 2]), 'P28-C7 crate painted/bare/polymer material separation is incomplete');

const renderer = await readFile(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
const world = await readFile(resolve(process.cwd(), 'src/game/babylonWorldPresentation.ts'), 'utf8');
const verifier = await readFile(resolve(process.cwd(), 'scripts/verify-authored-refinery.mjs'), 'utf8');
const manifest = await readFile(resolve(process.cwd(), 'src/game/graphicsAssetManifest.ts'), 'utf8');
const assetContract = await readFile(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
const premiumPrep = await readFile(resolve(process.cwd(), 'scripts/prepare-refinery-premium-surfaces.mjs'), 'utf8');
const imageGrade = await readFile(resolve(process.cwd(), 'scripts/p28a5-image-grade-capture.mjs'), 'utf8');
const telemetry = 'crate:bare-metal+painted-metal+polymer-rubber';
assert(renderer.includes("'refinery-hazard-emissive': 'polymer-rubber'"), 'Crate marker/grip slot is not bound to polymer/rubber');
assert(renderer.includes(telemetry), 'Crate premium-surface telemetry is missing');
for (const surface of ['painted-metal', 'bare-metal', 'polymer-rubber']) {
  assert(world.includes(`surfaces.get('${surface}')`), `Premium refinery cover does not use ${surface}`);
}
assert(world.includes("mission.location === 'asteroid-refinery'"), 'Premium cover treatment is not scoped to the refinery');
assert(world.includes('coverVisibility'), 'Cover readability transparency contract was not preserved');
assert(world.includes('Math.max(0.15, scaled(object.w))') && world.includes('Math.max(0.15, scaled(object.h))'), 'Cover simulation footprint sizing changed');
assert(verifier.includes('canvas.dataset.babylonCoverPremiumSurfaces'), 'Live verifier does not inspect premium cover surfaces');
assert(verifier.includes('lastState.coverPremiumCount < 1'), 'Live verifier does not require a rendered premium cover');
assert(manifest.includes("0: createGraphicsAssetSpec('refinery-crate-lod0'"), 'Flagship crate LOD0 is not registered in the asset manifest');
assert(assetContract.includes('if (detailScale >= 0.9) return 0;'), 'Flagship detail selection must request crate LOD0');
assert(assetContract.includes('0: [0, 1, 2]'), 'Crate LOD0 selection must preserve LOD1/LOD2 recovery');
assert(premiumPrep.includes('writeRefineryCrateLod0Asset'), 'Standard refinery asset preparation does not emit the crate LOD0');
assert(imageGrade.includes("visualDetail: 'p28-c7-refinery-crate-lod0'"), 'P28-C7 Flagship image-grade capture is not tagged for the crate LOD0 candidate');

console.log(`REFINERY_COVER_CRATE_PREMIUM_SURFACES_PASS crate-lods=3 lod0=authored meshes=${lod0Marker.uniqueGeometryMeshes} nodes=${lod0Marker.authoredNodeCount} triangles=${lod0Marker.sourceTriangles} cover=painted-metal+bare-metal+polymer-rubber dimensions=simulation-owned recovery=lod1+lod2`);
