import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  REFINERY_TERMINAL_LOD0_TARGET,
  buildRefineryTerminalLod0Glb,
} from '../scripts/prepare-refinery-terminal-lod0.mjs';

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
const expectedLegacyBounds = { min: [-0.29, 0, -0.44], max: [0.59, 1.83, 0.44] };
const expectedCueAnchors = {
  screen: [0.57, 1.42, 0],
  objectiveBeaconMount: [0, 1.78, 0],
  sideLight: [0.28, 0.86, -0.38],
};
const expectedAnchors = [
  ['refinery-terminal-pedestal', [0, 0.62, 0]],
  ['refinery-terminal-console', [0.20, 1.34, 0]],
  ['refinery-terminal-screen', expectedCueAnchors.screen],
  ['objective-beacon-mount', expectedCueAnchors.objectiveBeaconMount],
  ['refinery-terminal-side-light', expectedCueAnchors.sideLight],
];
const requiredDetail = [
  ['pedestal-service-panel', 1],
  ['console-rib-', 2],
  ['keypad', 1],
  ['status-strip', 1],
  ['service-port', 1],
  ['foot-', 2],
  ['screen-shroud', 1],
];

assert(REFINERY_TERMINAL_LOD0_TARGET.family === 'terminal', 'P28-C6 target family changed');
assert(REFINERY_TERMINAL_LOD0_TARGET.relativePath === 'environments/refinery-terminal-lod0.glb', 'P28-C6 target path changed');

const assetPath = resolve(process.cwd(), 'public/assets/models', REFINERY_TERMINAL_LOD0_TARGET.relativePath);
const bytes = await readFile(assetPath);
const rebuilt = buildRefineryTerminalLod0Glb(REFINERY_TERMINAL_LOD0_TARGET);
assert(bytes.equals(rebuilt), `${REFINERY_TERMINAL_LOD0_TARGET.relativePath}: P28-C6 authored LOD0 output is not deterministic`);
assert(bytes.length < 1_200_000, `${REFINERY_TERMINAL_LOD0_TARGET.relativePath}: P28-C6 asset exceeds the environment-module compressed-byte budget`);

const gltf = parseGlb(bytes, REFINERY_TERMINAL_LOD0_TARGET.relativePath);
const marker = gltf.extras?.ironshadeP28C6TerminalLod0;
assert(marker?.version === 1 && marker?.family === 'terminal' && marker?.lodTier === 0, 'P28-C6 terminal metadata is missing');
assert(marker?.deterministic === true && marker?.stablePivot === 'environment-root', 'P28-C6 deterministic stable-pivot contract changed');
assert(JSON.stringify(marker?.legacyVisualBounds) === JSON.stringify(expectedLegacyBounds), 'P28-C6 legacy terminal envelope changed');
assert(JSON.stringify(marker?.interactionOrigin) === JSON.stringify([0, 0, 0]), 'P28-C6 terminal interaction origin changed');
assert(JSON.stringify(marker?.cueAnchors) === JSON.stringify(expectedCueAnchors), 'P28-C6 terminal cue anchors changed');
assert(marker?.gameplayCoordinatesChanged === false && marker?.gameplayBoundsChanged === false, 'P28-C6 must remain presentation-only');
assert(marker?.interactionCueAlignmentChanged === false, 'P28-C6 interaction/cue alignment must remain unchanged');
assert(JSON.stringify(marker?.recoveryLods) === JSON.stringify([1, 2]), 'P28-C6 LOD1/LOD2 recovery contract changed');
assert(JSON.stringify(marker?.materialSlots) === JSON.stringify(expectedMaterials), 'P28-C6 premium surface material slots changed');
assert(marker?.uniqueGeometryMeshes >= 12, 'P28-C6 terminal LOD0 mechanical geometry mesh count is unexpectedly low');
assert(marker?.authoredNodeCount >= 14, 'P28-C6 terminal authored node count is unexpectedly low');
assert(marker?.sourceTriangles >= 400 && marker?.sourceVertices >= 1200, 'P28-C6 terminal LOD0 source geometry is unexpectedly coarse');

const root = (gltf.nodes ?? []).find(node => node.name === 'environment-root');
assert(root && !root.translation && !root.rotation && !root.scale, 'P28-C6 environment-root must remain an identity interaction pivot');
for (const [token, minimumCount] of requiredDetail) {
  assert((gltf.nodes ?? []).filter(node => node.name?.includes(token)).length >= minimumCount, `P28-C6 terminal detail ${token} is missing`);
}
for (const [name, translation] of expectedAnchors) {
  const node = (gltf.nodes ?? []).find(candidate => candidate.name === name);
  assert(node && JSON.stringify(node.translation) === JSON.stringify(translation), `P28-C6 terminal anchor changed for ${name}`);
}

const features = new Set((gltf.meshes ?? []).map(mesh => mesh.extras?.ironshadeHardSurfaceFeature));
for (const feature of ['chamfered-solid', 'cylinder-pipe', 'inset-panel']) {
  assert(features.has(feature), `P28-C6 required hard-surface feature ${feature} is missing`);
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
assert(JSON.stringify([...usedMaterials].sort()) === JSON.stringify([0, 1, 2, 3]), 'P28-C6 terminal material separation is incomplete');

const emissiveNames = marker?.emissiveNodeNames ?? [];
for (const token of ['screen', 'objective-beacon-mount', 'side-light', 'keypad', 'status-strip']) {
  const name = emissiveNames.find(candidate => candidate.includes(token));
  assert(name, `P28-C6 emissive fixture ${token} is missing from authored metadata`);
  const node = (gltf.nodes ?? []).find(candidate => candidate.name === name);
  const material = node ? gltf.meshes?.[node.mesh]?.primitives?.[0]?.material : undefined;
  assert(material === 2 || material === 3, `P28-C6 emissive fixture ${name} is not bound to an emissive slot`);
}
assert(marker?.selectiveGlowNamePrefix === 'refinery-terminal', 'P28-C6 selective glow naming contract changed');

const manifest = await readFile(resolve(process.cwd(), 'src/game/graphicsAssetManifest.ts'), 'utf8');
const assetContract = await readFile(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
const post = await readFile(resolve(process.cwd(), 'src/game/babylonRefineryPostProcessing.ts'), 'utf8');
const renderer = await readFile(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
const premiumPrep = await readFile(resolve(process.cwd(), 'scripts/prepare-refinery-premium-surfaces.mjs'), 'utf8');
const imageGrade = await readFile(resolve(process.cwd(), 'scripts/p28a5-image-grade-capture.mjs'), 'utf8');
assert(manifest.includes("0: createGraphicsAssetSpec('refinery-terminal-lod0'"), 'Flagship terminal LOD0 is not registered in the asset manifest');
assert(assetContract.includes('if (detailScale >= 0.9) return 0;'), 'Flagship detail selection must request terminal LOD0');
assert(assetContract.includes('0: [0, 1, 2]'), 'Terminal LOD0 selection must preserve LOD1/LOD2 recovery');
assert(post.includes('refinery-(terminal|processor|pipe|cable-tray|service-conduit|smelter-gantry)'), 'Selective glow no longer includes refinery terminal meshes');
assert(post.includes('excludeByDefault: true'), 'Selective glow protection contract changed');
assert(renderer.includes("'refinery-hazard-emissive': 'emissive-fixture'") && renderer.includes("'refinery-screen-emissive': 'emissive-fixture'"), 'Terminal emissive slots no longer use the selective emissive fixture material');
assert(premiumPrep.includes('writeRefineryTerminalLod0Asset'), 'Standard refinery asset preparation does not emit the terminal LOD0');
assert(imageGrade.includes("visualDetail: 'p28-c6-refinery-terminal-lod0'"), 'P28-C6 Flagship image-grade capture is not tagged for the terminal LOD0 candidate');

console.log(`REFINERY_TERMINAL_LOD0_PASS target=${REFINERY_TERMINAL_LOD0_TARGET.relativePath} meshes=${marker.uniqueGeometryMeshes} nodes=${marker.authoredNodeCount} triangles=${marker.sourceTriangles} cues=unchanged glow=selective gameplay=unchanged recovery=lod1+lod2`);
