import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GRAPHICS_ASSET_STANDARDS,
  createGraphicsAssetSpec,
  graphicsAssetLodForDetailScale,
  selectGraphicsAssetSpec,
  validateGraphicsAssetSpec,
  type GraphicsAssetFamily,
} from '../src/game/graphicsAssets';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(GRAPHICS_ASSET_STANDARDS.runtimeFormat === 'glb', 'authored runtime models must use GLB');
assert(GRAPHICS_ASSET_STANDARDS.unitScaleMeters === 1, 'asset units must remain meter-based');
assert(GRAPHICS_ASSET_STANDARDS.upAxis === '+Y', 'authored assets must use +Y up');
assert(GRAPHICS_ASSET_STANDARDS.forwardAxis === '+X', 'authored characters and weapons must use +X forward');
assert(GRAPHICS_ASSET_STANDARDS.compression.mesh === 'meshopt', 'Meshopt must remain the mobile geometry compression target');
assert(GRAPHICS_ASSET_STANDARDS.compression.texture === 'ktx2', 'KTX2 must remain the mobile texture compression target');
assert(GRAPHICS_ASSET_STANDARDS.compression.ktx2WorkerLimit === 2, 'KTX2 worker budget must remain bounded');
assert(GRAPHICS_ASSET_STANDARDS.maxTextureDimension.operator <= 2048, 'operator texture cap must remain mobile-safe');
assert(GRAPHICS_ASSET_STANDARDS.maxTextureDimension.enemy <= 1024, 'enemy texture cap must remain mobile-safe');

const operator = createGraphicsAssetSpec('operator-meridian-lod0', 'operator', '/assets/models/operators/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(operator).length === 0, 'valid operator GLB contract rejected');
assert(operator.triangleBudget === 45_000, 'operator default triangle budget changed unexpectedly');
assert(operator.compressedByteBudget === 2_500_000, 'operator default payload budget changed unexpectedly');
const pickup = createGraphicsAssetSpec('pickup-recovery-capsule-lod1', 'pickup', '/assets/models/pickups/pickup-recovery-capsule-lod1.glb', 1);
assert(pickup.triangleBudget === 4_000 && pickup.compressedByteBudget === 240_000, 'pickup budget must remain lightweight for mobile');
const invalidRoot = createGraphicsAssetSpec('operator-meridian-lod0', 'operator', '/models/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(invalidRoot).some(issue => issue.includes('/assets/models/')), 'asset outside model root should be rejected');
const mismatchedLod = createGraphicsAssetSpec('operator-meridian-lod1', 'operator', '/assets/models/operators/operator-meridian-lod0.glb', 1);
assert(validateGraphicsAssetSpec(mismatchedLod).some(issue => issue.includes('-lod1.glb')), 'LOD filename mismatch should be rejected');

assert(graphicsAssetLodForDetailScale(1) === 0, 'high detail should request LOD0');
assert(graphicsAssetLodForDetailScale(0.78) === 1, 'balanced detail should request LOD1');
assert(graphicsAssetLodForDetailScale(0.5) === 2, 'performance detail should request LOD2');
assert(graphicsAssetLodForDetailScale(Number.NaN) === 2, 'invalid detail scale should fail safe to LOD2');
const family: GraphicsAssetFamily = {
  id: 'operator-meridian',
  lods: {
    0: operator,
    2: createGraphicsAssetSpec('operator-meridian-lod2', 'operator', '/assets/models/operators/operator-meridian-lod2.glb', 2),
  },
};
assert(selectGraphicsAssetSpec(family, 0.78)?.lod === 2, 'balanced tier should prefer a lower-detail fallback over LOD0');

const contractSource = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
const runtimeSource = readFileSync(resolve(process.cwd(), 'src/game/babylonGraphicsAssets.ts'), 'utf8');
const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
const manifestSource = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssetManifest.ts'), 'utf8');
assert(!contractSource.includes("from 'three'") && !contractSource.includes('three/examples') && !contractSource.includes('three/webgpu'), 'shared asset contract must be renderer-neutral');
assert(runtimeSource.includes("import('./babylonGltfLoader')"), 'Babylon glTF loader must stay deferred behind authored asset use');
assert(runtimeSource.includes('configureBabylonGraphicsDecoders()'), 'Babylon asset runtime must configure local Meshopt/KTX2 decoders');
assert(runtimeSource.includes('AssetContainer') && runtimeSource.includes('instantiateModelsToScene'), 'Babylon runtime must own source containers and scene instantiation');
assert(rendererSource.includes('BabylonGraphicsAssetRuntime'), 'production renderer must own the Babylon authored-asset runtime');
assert(rendererSource.includes('selectGraphicsAssetSpec'), 'production renderer must use the shared adaptive LOD contract');
for (const role of ['assault', 'suppressor', 'technician', 'elite']) {
  assert(manifestSource.includes(`enemy-${role}-lod1.glb`) && manifestSource.includes(`enemy-${role}-lod2.glb`), `enemy manifest must include ${role} LOD1/LOD2`);
}
for (const weapon of ['carbine', 'breacher', 'rail']) {
  assert(manifestSource.includes(`weapon-${weapon}-lod1.glb`) && manifestSource.includes(`weapon-${weapon}-lod2.glb`), `weapon manifest must include ${weapon} LOD1/LOD2`);
}
for (const operatorClass of ['vanguard', 'vector', 'systems']) {
  assert(manifestSource.includes(`operator-${operatorClass}-lod1.glb`) && manifestSource.includes(`operator-${operatorClass}-lod2.glb`), `operator manifest must preserve ${operatorClass} LOD coverage`);
}
for (const asset of ['floor-panel', 'bulkhead', 'processor', 'pipe-rack', 'crate', 'terminal']) {
  assert(manifestSource.includes(`refinery-${asset}-lod1.glb`) && manifestSource.includes(`refinery-${asset}-lod2.glb`), `refinery manifest must include ${asset} adaptive LOD coverage`);
}
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
assert(!packageJson.dependencies?.three && !packageJson.devDependencies?.['@types/three'], 'retired Three dependencies must stay absent');
console.log('GRAPHICS_ASSET_PIPELINE_PASS contract=renderer-neutral runtime=babylon-only codecs=local lod=0+1+2 manifests=validated three=retired');
