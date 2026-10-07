import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  REFINERY_PROCESSOR_LOD0_TARGET,
  buildRefineryProcessorLod0Glb,
} from '../scripts/prepare-refinery-processor-lod0.mjs';

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
const expectedLegacyBounds = { min: [-1.73, 0, -1.39], max: [1.40, 3.77, 1.39] };
const expectedAnchors = [
  ['refinery-processor-base', [0, 0, 0]],
  ['refinery-processor-core', [0, 0.30, 0]],
  ['refinery-processor-ore-intake', [-1.34, 0.72, 0]],
  ['refinery-processor-exhaust-stack', [-0.62, 2.43, 0.54]],
  ['refinery-processor-status', [0.99, 1.72, 0]],
];
const requiredDetail = [
  ['sidecar-', 2],
  ['rib-', 2],
  ['access-panel-', 2],
  ['warning-fixture-', 2],
  ['maintenance-screen', 1],
  ['top-vent', 1],
  ['exhaust-', 2],
];

assert(REFINERY_PROCESSOR_LOD0_TARGET.family === 'processor', 'P28-C5 target family changed');
assert(REFINERY_PROCESSOR_LOD0_TARGET.relativePath === 'environments/refinery-processor-lod0.glb', 'P28-C5 target path changed');

const assetPath = resolve(process.cwd(), 'public/assets/models', REFINERY_PROCESSOR_LOD0_TARGET.relativePath);
const bytes = await readFile(assetPath);
const rebuilt = buildRefineryProcessorLod0Glb(REFINERY_PROCESSOR_LOD0_TARGET);
assert(bytes.equals(rebuilt), `${REFINERY_PROCESSOR_LOD0_TARGET.relativePath}: P28-C5 authored LOD0 output is not deterministic`);
assert(bytes.length < 1_200_000, `${REFINERY_PROCESSOR_LOD0_TARGET.relativePath}: P28-C5 asset exceeds the environment-module compressed-byte budget`);

const gltf = parseGlb(bytes, REFINERY_PROCESSOR_LOD0_TARGET.relativePath);
const marker = gltf.extras?.ironshadeP28C5ProcessorLod0;
assert(marker?.version === 1 && marker?.family === 'processor' && marker?.lodTier === 0, 'P28-C5 processor metadata is missing');
assert(marker?.deterministic === true && marker?.stablePivot === 'environment-root', 'P28-C5 deterministic stable-pivot contract changed');
assert(JSON.stringify(marker?.legacyVisualBounds) === JSON.stringify(expectedLegacyBounds), 'P28-C5 legacy processor envelope changed');
assert(JSON.stringify(marker?.interactionOrigin) === JSON.stringify([0, 0, 0]), 'P28-C5 processor interaction origin changed');
assert(marker?.gameplayCoordinatesChanged === false && marker?.gameplayBoundsChanged === false, 'P28-C5 must remain presentation-only');
assert(JSON.stringify(marker?.recoveryLods) === JSON.stringify([1, 2]), 'P28-C5 LOD1/LOD2 recovery contract changed');
assert(JSON.stringify(marker?.materialSlots) === JSON.stringify(expectedMaterials), 'P28-C5 premium surface material slots changed');
assert(marker?.uniqueGeometryMeshes >= 15, 'P28-C5 processor LOD0 mechanical geometry mesh count is unexpectedly low');
assert(marker?.authoredNodeCount >= 19, 'P28-C5 processor authored node count is unexpectedly low');
assert(marker?.sourceTriangles > 500 && marker?.sourceVertices > 1500, 'P28-C5 processor LOD0 source geometry is unexpectedly coarse');

const root = (gltf.nodes ?? []).find(node => node.name === 'environment-root');
assert(root && !root.translation && !root.rotation && !root.scale, 'P28-C5 environment-root must remain an identity interaction pivot');
for (const [token, minimumCount] of requiredDetail) {
  assert((gltf.nodes ?? []).filter(node => node.name?.includes(token)).length >= minimumCount, `P28-C5 processor detail ${token} is missing`);
}
for (const [name, translation] of expectedAnchors) {
  const node = (gltf.nodes ?? []).find(candidate => candidate.name === name);
  assert(node && JSON.stringify(node.translation) === JSON.stringify(translation), `P28-C5 processor anchor changed for ${name}`);
}

const features = new Set((gltf.meshes ?? []).map(mesh => mesh.extras?.ironshadeHardSurfaceFeature));
for (const feature of ['chamfered-solid', 'cylinder-pipe', 'wedge-extrusion', 'inset-panel']) {
  assert(features.has(feature), `P28-C5 required hard-surface feature ${feature} is missing`);
}
const usedMaterials = new Set();
for (const mesh of gltf.meshes ?? []) {
  const primitive = mesh.primitives?.[0];
  assert(Number.isInteger(primitive?.attributes?.POSITION), `${mesh.name}: POSITION missing`);
  assert(Number.isInteger(primitive?.attributes?.NORMAL), `${mesh.name}: NORMAL missing`);
  assert(Number.isInteger(primitive?.attributes?.TANGENT), `${mesh.name}: TANGENT missing`);
  assert(Number.isInteger(primitive?.attributes?.TEXCOORD_0), `${mesh.name}: UV0 missing`);
  assert(Number.isInteger(primitive?.indices), `${mesh.name}: indices missing`);
  usedMaterials.add(primitive.material);
}
assert(JSON.stringify([...usedMaterials].sort()) === JSON.stringify([0, 1, 2, 3]), 'P28-C5 processor material separation is incomplete');

const emissiveNames = marker?.emissiveNodeNames ?? [];
for (const token of ['status', 'maintenance-screen', 'hazard-band', 'warning-fixture-left', 'warning-fixture-right']) {
  const name = emissiveNames.find(candidate => candidate.includes(token));
  assert(name, `P28-C5 emissive fixture ${token} is missing from authored metadata`);
  const node = (gltf.nodes ?? []).find(candidate => candidate.name === name);
  const material = node ? gltf.meshes?.[node.mesh]?.primitives?.[0]?.material : undefined;
  assert(material === 2 || material === 3, `P28-C5 emissive fixture ${name} is not bound to an emissive slot`);
}
assert(marker?.selectiveGlowNamePrefix === 'refinery-processor', 'P28-C5 selective glow naming contract changed');

const manifest = await readFile(resolve(process.cwd(), 'src/game/graphicsAssetManifest.ts'), 'utf8');
const assetContract = await readFile(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
const post = await readFile(resolve(process.cwd(), 'src/game/babylonRefineryPostProcessing.ts'), 'utf8');
const renderer = await readFile(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
assert(manifest.includes("0: createGraphicsAssetSpec('refinery-processor-lod0'"), 'Flagship processor LOD0 is not registered in the asset manifest');
assert(assetContract.includes('if (detailScale >= 0.9) return 0;'), 'Flagship detail selection must request processor LOD0');
assert(assetContract.includes('0: [0, 1, 2]'), 'Processor LOD0 selection must preserve LOD1/LOD2 recovery');
assert(post.includes('refinery-(terminal|processor|pipe|cable-tray|service-conduit|smelter-gantry)'), 'Selective glow no longer includes refinery processor meshes');
assert(post.includes('excludeByDefault: true'), 'Selective glow protection contract changed');
assert(renderer.includes("'refinery-hazard-emissive': 'emissive-fixture'") && renderer.includes("'refinery-screen-emissive': 'emissive-fixture'"), 'Processor emissive slots no longer use the selective emissive fixture material');

console.log(`REFINERY_PROCESSOR_LOD0_PASS target=${REFINERY_PROCESSOR_LOD0_TARGET.relativePath} meshes=${marker.uniqueGeometryMeshes} nodes=${marker.authoredNodeCount} triangles=${marker.sourceTriangles} glow=selective gameplay=unchanged recovery=lod1+lod2`);
