import { readFileSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import {
  BABYLON_GRAPHICS_CODEC_PATHS,
  BabylonGraphicsAssetRuntime,
  configureBabylonGraphicsDecoders,
  type BabylonGraphicsAssetContainerLoader,
} from '../src/game/babylonGraphicsAssets';
import {
  OPERATOR_ASSET_FAMILY,
  SHOWCASE_REFINERY_MODULE_FAMILY,
} from '../src/game/graphicsAssetManifest';
import { selectGraphicsAssetSpec } from '../src/game/graphicsAssets';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const runtimeSource = readFileSync(resolve(process.cwd(), 'src/game/babylonGraphicsAssets.ts'), 'utf8');
const loaderBoundarySource = readFileSync(resolve(process.cwd(), 'src/game/babylonGltfLoader.ts'), 'utf8');
const threeRuntimeSource = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
assert(!runtimeSource.includes("from 'three'") && !runtimeSource.includes('three/examples'), 'Babylon asset runtime must not depend on the Three asset loader');
assert(!threeRuntimeSource.includes('babylonGraphicsAssets'), 'Three asset runtime must remain independent of the Babylon asset path');
assert(
  runtimeSource.includes("import('./babylonGltfLoader')")
    && loaderBoundarySource.includes("import '@babylonjs/loaders/glTF/2.0/glTFLoader'")
    && !loaderBoundarySource.includes("import '@babylonjs/loaders/glTF';"),
  'Babylon GLB loader must remain deferred and restricted to the glTF 2.0 loader until authored content requires extensions',
);
assert(!runtimeSource.includes('cdn.babylonjs.com') && !runtimeSource.includes('preview.babylonjs.com'), 'Babylon asset runtime must not hard-code a decoder CDN');
assert(
  runtimeSource.includes("engine.getClassName() !== 'Engine'") && runtimeSource.includes('creationOptions.loseContextOnDispose = true'),
  'Babylon WebGL engine teardown must explicitly release its WebGL context while leaving WebGPU untouched',
);

const decoderUrls = configureBabylonGraphicsDecoders();
for (const [name, url] of Object.entries(decoderUrls)) {
  if (name === 'root') continue;
  assert(url.startsWith(BABYLON_GRAPHICS_CODEC_PATHS.root), `${name} must resolve to the packaged Babylon codec root in Node tests, got ${url}`);
}
assert(MeshoptCompression.Configuration.decoder.url === decoderUrls.meshoptDecoder, 'Meshopt must use the packaged local decoder');
assert(KhronosTextureContainer2.URLConfig.jsDecoderModule === decoderUrls.ktx2DecoderModule, 'KTX2 must use the packaged local decoder module');
assert(KhronosTextureContainer2.URLConfig.jsMSCTranscoder === decoderUrls.mscTranscoderJs, 'KTX2 MSC JS transcoder must remain local');
assert(KhronosTextureContainer2.URLConfig.wasmMSCTranscoder === decoderUrls.mscTranscoderWasm, 'KTX2 MSC WASM transcoder must remain local');
assert(KhronosTextureContainer2.URLConfig.wasmZSTDDecoder === decoderUrls.zstdDecoder, 'KTX2 ZSTD decoder must remain local');

const operatorLod1 = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, 0.72);
const operatorLod2 = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, 0.5);
const refineryLod1 = selectGraphicsAssetSpec(SHOWCASE_REFINERY_MODULE_FAMILY, 0.72);
assert(operatorLod1?.lod === 1, 'Babylon operator test must request authored LOD1');
assert(operatorLod2?.lod === 2, 'Babylon operator test must request authored LOD2');
assert(refineryLod1?.lod === 1, 'Babylon refinery test must request authored LOD1');

const engine = new NullEngine();
const scene = new Scene(engine);
const loadCounts = new Map<string, number>();
const disposeCounts = new Map<string, number>();

const loadContainer: BabylonGraphicsAssetContainerLoader = async (spec, targetScene) => {
  loadCounts.set(spec.url, (loadCounts.get(spec.url) ?? 0) + 1);
  const filePath = resolve(process.cwd(), 'public', spec.url.replace(/^\/+/, ''));
  const data = await readFileAsync(filePath);
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const container = await LoadAssetContainerAsync(bytes, targetScene, {
    pluginExtension: '.glb',
    name: spec.id,
  });
  const originalDispose = container.dispose.bind(container);
  container.dispose = () => {
    disposeCounts.set(spec.url, (disposeCounts.get(spec.url) ?? 0) + 1);
    originalDispose();
  };
  return container;
};

async function run() {
  const runtime = new BabylonGraphicsAssetRuntime(scene, loadContainer);
  
  const operatorA = await runtime.instantiate(operatorLod1);
  assert(operatorA.spec.lod === 1, 'operator instance must retain requested LOD1 spec');
  assert(operatorA.rootNodes.length > 0, 'Babylon operator LOD1 must instantiate scene roots');
  assert(operatorA.rootNodes.some(root => root.getChildMeshes(false).length > 0), 'Babylon operator LOD1 must contain renderable meshes');
  
  const operatorB = await runtime.instantiate(operatorLod1);
  assert(loadCounts.get(operatorLod1.url) === 1, 'same Babylon GLB URL must be loaded once and served from cache');
  assert(operatorA.rootNodes[0] !== operatorB.rootNodes[0], 'Babylon instances must own distinct cloned root nodes');
  operatorA.release();
  
  const operatorC = await runtime.instantiate(operatorLod1);
  assert(loadCounts.get(operatorLod1.url) === 1, 'releasing one clone must keep shared cached resources usable');
  assert(operatorC.rootNodes.length > 0, 'cached source container must remain instantiable after another clone releases');
  operatorB.release();
  operatorC.release();
  
  const operatorLow = await runtime.instantiate(operatorLod2);
  assert(operatorLow.spec.lod === 2 && operatorLow.rootNodes.length > 0, 'Babylon operator LOD2 must load and instantiate at reduced detail');
  operatorLow.release();
  
  const refinery = await runtime.instantiate(refineryLod1);
  assert(refinery.spec.lod === 1, 'refinery instance must retain requested LOD1 spec');
  assert(refinery.rootNodes.length > 0, 'Babylon Asteroid Refinery module must instantiate scene roots');
  assert(refinery.rootNodes.some(root => root.getChildMeshes(false).length > 0), 'Babylon refinery module must contain renderable meshes');
  
  const refineryShared = await runtime.instantiate(refineryLod1);
  const sharedStaticMeshes = refineryShared.rootNodes.flatMap(root => root.getChildMeshes(false)).filter(mesh => mesh.isAnInstance);
  assert(sharedStaticMeshes.length > 0, 'repeated static Babylon GLB geometry must use native InstancedMesh reuse');
  refineryShared.release();

  const statsWithRefinery = runtime.stats();
  assert(statsWithRefinery.cachedAssets === 3, `expected three cached representative assets, got ${statsWithRefinery.cachedAssets}`);
  assert(
    statsWithRefinery.estimatedCachedCompressedBytes
      === operatorLod1.compressedByteBudget + operatorLod2.compressedByteBudget + refineryLod1.compressedByteBudget,
    'Babylon cache accounting must reuse manifest compressed-byte budgets',
  );
  
  runtime.configureBudget({
    maxCachedCompressedBytes: 64 * 1024 * 1024,
    maxTextureAnisotropy: 4,
    maxCachedAssets: 2,
  });
  assert(runtime.stats().cachedAssets <= 2, 'Babylon resource tier must trim least-recently-used idle cache entries by count as well as bytes');

  const heldRefinery = refinery;
  const evictedWhileMounted = await runtime.evict(refineryLod1.url);
  assert(evictedWhileMounted, 'mounted refinery cache entry should be evictable into pending-dispose state');
  assert((disposeCounts.get(refineryLod1.url) ?? 0) === 0, 'shared refinery resources must stay alive while a clone is mounted');
  heldRefinery.release();
  await Promise.resolve();
  await Promise.resolve();
  assert((disposeCounts.get(refineryLod1.url) ?? 0) === 1, 'shared refinery resources must dispose exactly once after the last mounted clone releases');
  
  const reloadedRefinery = await runtime.instantiate(refineryLod1);
  assert(loadCounts.get(refineryLod1.url) === 2, 'evicted refinery GLB must reload on the next request');
  reloadedRefinery.release();
  
  await runtime.dispose();
  await Promise.resolve();
  assert((disposeCounts.get(operatorLod1.url) ?? 0) === 1, 'operator LOD1 source resources must dispose once with the runtime');
  assert((disposeCounts.get(operatorLod2.url) ?? 0) === 1, 'operator LOD2 source resources must dispose once with the runtime');
  assert((disposeCounts.get(refineryLod1.url) ?? 0) === 2, 'reloaded refinery source resources must dispose once with the runtime');
  
  scene.dispose();
  engine.dispose();

  const teardownEngine = new NullEngine();
  const teardownScene = new Scene(teardownEngine);
  let teardownDisposeCount = 0;
  const teardownLoader: BabylonGraphicsAssetContainerLoader = async (spec, targetScene) => {
    const filePath = resolve(process.cwd(), 'public', spec.url.replace(/^\/+/, ''));
    const data = await readFileAsync(filePath);
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const container = await LoadAssetContainerAsync(bytes, targetScene, {
      pluginExtension: '.glb',
      name: `${spec.id}-teardown`,
    });
    const originalDispose = container.dispose.bind(container);
    container.dispose = () => {
      teardownDisposeCount += 1;
      originalDispose();
    };
    return container;
  };
  const teardownRuntime = new BabylonGraphicsAssetRuntime(teardownScene, teardownLoader);
  await teardownRuntime.instantiate(operatorLod1);
  teardownRuntime.disposeForSceneTeardown();
  assert(teardownRuntime.stats().cachedAssets === 0, 'renderer teardown must synchronously drop Babylon runtime cache references before scene disposal');
  teardownScene.dispose();
  await Promise.resolve();
  assert(teardownDisposeCount === 1, `renderer teardown must leave source-container ownership to Babylon scene disposal, got ${teardownDisposeCount} disposals`);
  teardownEngine.dispose();
  
  console.log(
    `BABYLON_GRAPHICS_ASSETS_PASS operatorLod1=${operatorLod1.id} operatorLod2=${operatorLod2.id} refinery=${refineryLod1.id} localCodecs=true instancing=static-native cacheTrim=count+bytes cacheLoads=${[...loadCounts.values()].reduce((sum, count) => sum + count, 0)} teardownDispose=${teardownDisposeCount} webglContextRelease=true`,
  );
  
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});