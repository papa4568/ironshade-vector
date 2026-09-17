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

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(GRAPHICS_ASSET_STANDARDS.runtimeFormat === 'glb', 'authored runtime models must use GLB');
assert(GRAPHICS_ASSET_STANDARDS.unitScaleMeters === 1, 'asset units must remain meter-based');
assert(GRAPHICS_ASSET_STANDARDS.upAxis === '+Y', 'authored assets must use +Y up');
assert(GRAPHICS_ASSET_STANDARDS.forwardAxis === '+X', 'authored characters and weapons must use +X forward');
assert(GRAPHICS_ASSET_STANDARDS.compression.mesh === 'meshopt', 'meshopt must remain the mobile geometry compression target');
assert(GRAPHICS_ASSET_STANDARDS.compression.texture === 'ktx2', 'KTX2 must remain the mobile texture compression target');
assert(GRAPHICS_ASSET_STANDARDS.maxTextureDimension.operator <= 2048, 'operator texture cap must remain mobile-safe');
assert(GRAPHICS_ASSET_STANDARDS.maxTextureDimension.enemy <= 1024, 'enemy texture cap must remain mobile-safe');

const operator = createGraphicsAssetSpec('operator-meridian-lod0', 'operator', '/assets/models/operators/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(operator).length === 0, 'valid operator GLB contract rejected');
assert(operator.triangleBudget === 45_000, 'operator default triangle budget changed unexpectedly');
assert(operator.compressedByteBudget === 2_500_000, 'operator default payload budget changed unexpectedly');

const invalidName = createGraphicsAssetSpec('Operator Meridian', 'operator', '/assets/models/operators/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(invalidName).some(issue => issue.includes('kebab-case')), 'invalid asset id should be rejected');

const invalidRoot = createGraphicsAssetSpec('operator-meridian-lod0', 'operator', '/models/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(invalidRoot).some(issue => issue.includes('/assets/models/')), 'asset outside model root should be rejected');

const invalidFormat = createGraphicsAssetSpec('operator-meridian-lod0', 'operator', '/assets/models/operators/operator-meridian-lod0.fbx');
assert(validateGraphicsAssetSpec(invalidFormat).some(issue => issue.includes('.glb')), 'non-GLB runtime asset should be rejected');

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
assert(selectGraphicsAssetSpec(family, 1)?.lod === 0, 'high tier should choose LOD0 when available');
assert(selectGraphicsAssetSpec(family, 0.78)?.lod === 2, 'balanced tier should prefer a lower-detail fallback over LOD0');
assert(selectGraphicsAssetSpec(family, 0.5)?.lod === 2, 'performance tier should choose LOD2');

const source = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
assert(source.includes("import('three/examples/jsm/loaders/GLTFLoader.js')"), 'GLTFLoader must remain a dynamic import');
assert(source.includes("import('three/examples/jsm/libs/meshopt_decoder.module.js')"), 'Meshopt decoder must remain deferred with authored assets');
assert(source.includes("import('three/examples/jsm/loaders/KTX2Loader.js')"), 'KTX2 loader must remain deferred with authored assets');
assert(source.includes("import('three/examples/jsm/utils/SkeletonUtils.js')"), 'rigged asset cloning must use SkeletonUtils');
assert(!source.includes("import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'"), 'GLTFLoader must not become an eager runtime import');
assert(source.includes('gltfCache.delete(spec.url)'), 'failed asset requests must be evicted so they can retry');
assert(source.includes('activeInstances'), 'asset cache must track mounted instances before disposal');
assert(source.includes('texture.dispose()'), 'cached asset eviction must release textures');
assert(source.includes('skeleton.dispose()'), 'asset lifecycle must release skeleton GPU resources');

console.log('GRAPHICS_ASSET_PIPELINE_PASS format=glb mesh=meshopt textures=ktx2 loader=deferred lifecycle=leased lod=adaptive operatorTriangles=45000 operatorPayload=2500000');
