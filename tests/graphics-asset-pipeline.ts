import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GRAPHICS_ASSET_STANDARDS, createGraphicsAssetSpec, validateGraphicsAssetSpec } from '../src/game/graphicsAssets';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(GRAPHICS_ASSET_STANDARDS.runtimeFormat === 'glb', 'authored runtime models must use GLB');
assert(GRAPHICS_ASSET_STANDARDS.unitScaleMeters === 1, 'asset units must remain meter-based');
assert(GRAPHICS_ASSET_STANDARDS.upAxis === '+Y', 'authored assets must use +Y up');
assert(GRAPHICS_ASSET_STANDARDS.forwardAxis === '+X', 'authored characters and weapons must use +X forward');
assert(GRAPHICS_ASSET_STANDARDS.maxTextureDimension.operator <= 2048, 'operator texture cap must remain mobile-safe');
assert(GRAPHICS_ASSET_STANDARDS.maxTextureDimension.enemy <= 1024, 'enemy texture cap must remain mobile-safe');

const operator = createGraphicsAssetSpec('operator-meridian-lod0', 'operator', '/assets/models/operators/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(operator).length === 0, 'valid operator GLB contract rejected');
assert(operator.triangleBudget === 45_000, 'operator default triangle budget changed unexpectedly');
assert(operator.compressedByteBudget === 2_500_000, 'operator default payload budget changed unexpectedly');

const invalidName = createGraphicsAssetSpec('Operator Meridian', 'operator', '/assets/models/operators/operator-meridian.glb');
assert(validateGraphicsAssetSpec(invalidName).some(issue => issue.includes('kebab-case')), 'invalid asset id should be rejected');

const invalidRoot = createGraphicsAssetSpec('operator-meridian', 'operator', '/models/operator-meridian.glb');
assert(validateGraphicsAssetSpec(invalidRoot).some(issue => issue.includes('/assets/models/')), 'asset outside model root should be rejected');

const invalidFormat = createGraphicsAssetSpec('operator-meridian', 'operator', '/assets/models/operators/operator-meridian.fbx');
assert(validateGraphicsAssetSpec(invalidFormat).some(issue => issue.includes('.glb')), 'non-GLB runtime asset should be rejected');

const source = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
assert(source.includes("import('three/examples/jsm/loaders/GLTFLoader.js')"), 'GLTFLoader must remain a dynamic import');
assert(!source.includes("import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'"), 'GLTFLoader must not become an eager runtime import');
assert(source.includes('gltfCache.delete(spec.url)'), 'failed asset requests must be evicted so they can retry');

console.log('GRAPHICS_ASSET_PIPELINE_PASS format=glb loader=deferred cache=retry-safe operatorTriangles=45000 operatorPayload=2500000');
