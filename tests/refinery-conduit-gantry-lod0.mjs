import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  REFINERY_CONDUIT_GANTRY_LOD0_TARGETS,
  buildRefineryConduitGantryLod0Glb,
} from '../scripts/prepare-refinery-conduit-gantry-lod0.mjs';

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

const expected = {
  serviceConduit: {
    id: 'refinery-service-conduit-lod0',
    visualBounds: { min: [-1.4, 0, -0.24], max: [1.4, 0.89, 0.24] },
    minimumGeometryMeshes: 9,
    minimumAuthoredNodes: 11,
    detailNodes: [
      ['trunk-coupling-', 2],
      ['support-', 2],
      ['valve-', 2],
      ['junction', 1],
      ['status', 1],
    ],
    anchorNodes: [
      ['refinery-service-conduit-support-left', [-1.05, 0, 0]],
      ['refinery-service-conduit-support-right', [1.05, 0, 0]],
      ['refinery-service-conduit-trunk', [-1.4, 0.30, 0]],
    ],
    requiredFeatures: ['chamfered-solid', 'cylinder-pipe', 'inset-panel'],
  },
  gantry: {
    id: 'refinery-smelter-gantry-lod0',
    visualBounds: { min: [-2.9, 0, -0.48], max: [2.9, 3.69, 0.47] },
    minimumGeometryMeshes: 11,
    minimumAuthoredNodes: 16,
    detailNodes: [
      ['rib-', 2],
      ['foot-', 2],
      ['cap-', 2],
      ['roller-', 2],
      ['service-rail', 1],
      ['drop-line', 1],
    ],
    anchorNodes: [
      ['refinery-smelter-gantry-left', [-2.60, 0, 0]],
      ['refinery-smelter-gantry-right', [2.60, 0, 0]],
      ['refinery-smelter-gantry-beam', [0, 3.23, 0]],
      ['refinery-smelter-gantry-drop-line', [0.72, 1.51, 0]],
    ],
    requiredFeatures: ['chamfered-solid', 'cylinder-pipe', 'inset-panel'],
  },
};

assert(REFINERY_CONDUIT_GANTRY_LOD0_TARGETS.length === 2, `Expected two P28-C4 LOD0 targets, got ${REFINERY_CONDUIT_GANTRY_LOD0_TARGETS.length}`);
assert(
  JSON.stringify(REFINERY_CONDUIT_GANTRY_LOD0_TARGETS.map(target => target.family)) === JSON.stringify(['serviceConduit', 'gantry']),
  'P28-C4 family order changed',
);

const manifest = await readFile(resolve(process.cwd(), 'src/game/graphicsAssetManifest.ts'), 'utf8');
const assetContract = await readFile(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
for (const target of REFINERY_CONDUIT_GANTRY_LOD0_TARGETS) {
  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);
  const bytes = await readFile(path);
  const rebuilt = buildRefineryConduitGantryLod0Glb(target);
  assert(bytes.equals(rebuilt), `${target.relativePath}: P28-C4 authored LOD0 output is not deterministic`);
  assert(bytes.length < 1_200_000, `${target.relativePath}: P28-C4 asset exceeds the environment-module compressed-byte budget`);

  const gltf = parseGlb(bytes, target.relativePath);
  const marker = gltf.extras?.ironshadeP28C4ConduitGantryLod0;
  const familyExpected = expected[target.family];
  assert(marker?.version === 1 && marker?.family === target.family && marker?.lodTier === 0, `${target.relativePath}: P28-C4 metadata is missing`);
  assert(marker?.deterministic === true && marker?.stablePivot === 'environment-root', `${target.relativePath}: deterministic stable pivot contract changed`);
  assert(marker?.repeatedPlacementStable === true, `${target.relativePath}: repeated-placement stability marker is missing`);
  assert(marker?.gameplayBoundsChanged === false, `${target.relativePath}: P28-C4 must remain presentation-only`);
  assert(marker?.routeClearancePreserved === true, `${target.relativePath}: route-clearance preservation marker is missing`);
  assert(JSON.stringify(marker?.visualBounds) === JSON.stringify(familyExpected.visualBounds), `${target.relativePath}: legacy visual envelope changed`);
  assert(JSON.stringify(marker?.recoveryLods) === JSON.stringify([1, 2]), `${target.relativePath}: LOD1/LOD2 recovery contract changed`);
  assert(JSON.stringify(marker?.materialSlots) === JSON.stringify(expectedMaterials), `${target.relativePath}: premium surface material slots changed`);
  assert(marker?.uniqueGeometryMeshes >= familyExpected.minimumGeometryMeshes, `${target.relativePath}: LOD0 mechanical geometry mesh count is unexpectedly low`);
  assert(marker?.authoredNodeCount >= familyExpected.minimumAuthoredNodes, `${target.relativePath}: LOD0 authored node count is unexpectedly low`);
  assert(marker?.sourceTriangles > 100 && marker?.sourceVertices > 250, `${target.relativePath}: LOD0 source geometry is unexpectedly coarse`);

  const root = (gltf.nodes ?? []).find(node => node.name === 'environment-root');
  assert(root && !root.translation && !root.rotation && !root.scale, `${target.relativePath}: environment-root must remain an identity repeated-placement pivot`);
  for (const [token, minimumCount] of familyExpected.detailNodes) {
    assert((gltf.nodes ?? []).filter(node => node.name?.includes(token)).length >= minimumCount, `${target.relativePath}: required mechanical detail ${token} is missing`);
  }
  for (const [name, translation] of familyExpected.anchorNodes) {
    const node = (gltf.nodes ?? []).find(candidate => candidate.name === name);
    assert(node && JSON.stringify(node.translation) === JSON.stringify(translation), `${target.relativePath}: anchored route-clearance transform changed for ${name}`);
  }
  const features = new Set((gltf.meshes ?? []).map(mesh => mesh.extras?.ironshadeHardSurfaceFeature));
  for (const feature of familyExpected.requiredFeatures) {
    assert(features.has(feature), `${target.relativePath}: required hard-surface feature ${feature} is missing`);
  }
  for (const mesh of gltf.meshes ?? []) {
    const primitive = mesh.primitives?.[0];
    assert(Number.isInteger(primitive?.attributes?.POSITION), `${target.relativePath}:${mesh.name}: POSITION missing`);
    assert(Number.isInteger(primitive?.attributes?.NORMAL), `${target.relativePath}:${mesh.name}: NORMAL missing`);
    assert(Number.isInteger(primitive?.attributes?.TANGENT), `${target.relativePath}:${mesh.name}: TANGENT missing`);
    assert(Number.isInteger(primitive?.attributes?.TEXCOORD_0), `${target.relativePath}:${mesh.name}: UV0 missing`);
    assert(Number.isInteger(primitive?.indices), `${target.relativePath}:${mesh.name}: indices missing`);
  }

  assert(manifest.includes(`0: createGraphicsAssetSpec('${familyExpected.id}'`), `${target.relativePath}: Flagship LOD0 is not registered in the asset manifest`);
}

assert(assetContract.includes('if (detailScale >= 0.9) return 0;'), 'Flagship detail selection must request authored LOD0');
assert(assetContract.includes('0: [0, 1, 2]'), 'Flagship LOD0 selection must preserve LOD1/LOD2 recovery');

console.log(`REFINERY_CONDUIT_GANTRY_LOD0_PASS targets=${REFINERY_CONDUIT_GANTRY_LOD0_TARGETS.length} families=serviceConduit+gantry clearance=preserved pivot=stable recovery=lod1+lod2`);
