import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  REFINERY_PREMIUM_SURFACE_TARGETS,
  upgradeRefineryPremiumSurfaceGlb,
} from '../scripts/prepare-refinery-premium-surfaces.mjs';

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
};
const expectedNodeTransforms = {
  'refinery-floor-panel': { translation: [0, 0.03, 0], scale: [3.8, 0.08, 3.8] },
  'refinery-floor-service-grate': { translation: [0, 0.035, 0], scale: [3.8, 0.07, 3.8] },
  'refinery-bulkhead-left': { translation: [0, 1.45, -1.75], scale: [0.44, 2.9, 0.38] },
  'refinery-wall-service-panel-shell': { translation: [0, 1.28, 0], scale: [0.18, 2.56, 2.75] },
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

  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      assert(primitive.attributes?.POSITION === 0, `${target.relativePath}: POSITION binding changed`);
      assert(primitive.attributes?.NORMAL === 1, `${target.relativePath}: NORMAL binding changed`);
      assert(primitive.attributes?.TANGENT === 2, `${target.relativePath}: TANGENT binding missing`);
      assert(primitive.attributes?.TEXCOORD_0 === 3, `${target.relativePath}: TEXCOORD_0 binding missing`);
      assert(primitive.indices === 4, `${target.relativePath}: index binding changed`);
    }
  }

  assert(JSON.stringify((gltf.materials ?? []).map(material => material.name)) === JSON.stringify(expectedMaterials), `${target.relativePath}: authored material slots changed`);
  const requiredName = requiredNodeByFamily[target.family];
  const requiredNode = (gltf.nodes ?? []).find(node => node.name === requiredName);
  assert(requiredNode, `${target.relativePath}: required surface node ${requiredName} is missing`);
  const expectedTransform = expectedNodeTransforms[requiredName];
  assert(JSON.stringify(requiredNode.translation) === JSON.stringify(expectedTransform.translation), `${target.relativePath}: ${requiredName} translation changed`);
  assert(JSON.stringify(requiredNode.scale) === JSON.stringify(expectedTransform.scale), `${target.relativePath}: ${requiredName} scale changed`);
}

const rendererSource = await readFile(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
const verifierSource = await readFile(resolve(process.cwd(), 'scripts/verify-authored-refinery.mjs'), 'utf8');
const expectedTelemetry = 'floor:bare-metal+deck-plate|floor-grate:bare-metal+painted-metal|bulkhead:painted-metal|wall-panel:bare-metal+painted-metal';
assert(rendererSource.includes(expectedTelemetry), 'Babylon refinery renderer is missing the B2 premium-surface telemetry contract');
for (const surface of ['deck-plate', 'bare-metal', 'painted-metal']) {
  assert(rendererSource.includes(`'${surface}'`), `Babylon refinery renderer does not bind ${surface}`);
}
assert(rendererSource.includes('normal+roughness+metalness:shared-premium-pbr'), 'Babylon refinery renderer is missing material-detail telemetry');
assert(verifierSource.includes('canvas.dataset.babylonEnvironmentPremiumSurfaces'), 'Authored-refinery live verifier does not read B2 premium-surface telemetry');
assert(verifierSource.includes(expectedTelemetry), 'Authored-refinery live verifier does not enforce the exact B2 material bindings');
assert(verifierSource.includes('normal+roughness+metalness:shared-premium-pbr'), 'Authored-refinery live verifier does not enforce B2 material-detail telemetry');

console.log(`REFINERY_PREMIUM_SURFACES_PASS targets=${REFINERY_PREMIUM_SURFACE_TARGETS.length} attributes=POSITION+NORMAL+TANGENT+TEXCOORD_0 bounds=unchanged telemetry=${expectedTelemetry}`);
