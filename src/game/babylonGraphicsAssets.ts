import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { Node } from '@babylonjs/core/node';
import type { Scene } from '@babylonjs/core/scene';
import {
  GRAPHICS_ASSET_STANDARDS,
  selectGraphicsAssetSpec,
  validateGraphicsAssetSpec,
  type GraphicsAssetFamily,
  type GraphicsAssetRuntimeBudget,
  type GraphicsAssetSpec,
} from './graphicsAssets';

export const BABYLON_GRAPHICS_CODEC_PATHS = {
  root: '/assets/codecs/babylon/',
  meshoptDecoder: '/assets/codecs/babylon/meshopt_decoder.js',
  ktx2DecoderModule: '/assets/codecs/babylon/babylon.ktx2Decoder.js',
  uastcAstc: '/assets/codecs/babylon/uastc_astc.wasm',
  uastcBc7: '/assets/codecs/babylon/uastc_bc7.wasm',
  uastcRgbaUnorm: '/assets/codecs/babylon/uastc_rgba8_unorm_v2.wasm',
  uastcRgbaSrgb: '/assets/codecs/babylon/uastc_rgba8_srgb_v2.wasm',
  uastcR8Unorm: '/assets/codecs/babylon/uastc_r8_unorm.wasm',
  uastcRg8Unorm: '/assets/codecs/babylon/uastc_rg8_unorm.wasm',
  mscTranscoderJs: '/assets/codecs/babylon/msc_basis_transcoder.js',
  mscTranscoderWasm: '/assets/codecs/babylon/msc_basis_transcoder.wasm',
  zstdDecoder: '/assets/codecs/babylon/zstddec.wasm',
} as const;

export type BabylonGraphicsAssetRuntimeBudget = GraphicsAssetRuntimeBudget & {
  maxCachedAssets: number;
};

const DEFAULT_BABYLON_GRAPHICS_ASSET_RUNTIME_BUDGET: BabylonGraphicsAssetRuntimeBudget = {
  maxCachedCompressedBytes: 64 * 1024 * 1024,
  maxTextureAnisotropy: 4,
  maxCachedAssets: 32,
};

export type BabylonGraphicsAssetInstance = {
  spec: GraphicsAssetSpec;
  rootNodes: readonly Node[];
  animationGroups: readonly AnimationGroup[];
  release: () => void;
};

export type BabylonGraphicsAssetRuntimeStats = {
  cachedAssets: number;
  activeInstances: number;
  estimatedCachedCompressedBytes: number;
  maxCachedCompressedBytes: number;
  maxCachedAssets: number;
};

export type BabylonGraphicsAssetContainerLoader = (
  spec: GraphicsAssetSpec,
  scene: Scene,
) => Promise<AssetContainer>;

type BabylonGraphicsAssetCacheEntry = {
  spec: GraphicsAssetSpec;
  promise: Promise<AssetContainer>;
  activeInstances: number;
  pendingDispose: boolean;
  disposePromise: Promise<void> | null;
  lastUsedOrdinal: number;
};

function resolveRuntimeCodecUrl(path: string) {
  const base = typeof document !== 'undefined'
    ? document.baseURI
    : typeof location !== 'undefined'
      ? location.href
      : null;
  return base ? new URL(path, base).href : path;
}

export function configureBabylonGraphicsDecoders() {
  const paths = Object.fromEntries(
    Object.entries(BABYLON_GRAPHICS_CODEC_PATHS).map(([key, value]) => [key, resolveRuntimeCodecUrl(value)]),
  ) as Record<keyof typeof BABYLON_GRAPHICS_CODEC_PATHS, string>;

  MeshoptCompression.Configuration = {
    decoder: {
      url: paths.meshoptDecoder,
    },
  };

  KhronosTextureContainer2.DefaultNumWorkers = GRAPHICS_ASSET_STANDARDS.compression.ktx2WorkerLimit;
  KhronosTextureContainer2.URLConfig = {
    jsDecoderModule: paths.ktx2DecoderModule,
    wasmUASTCToASTC: paths.uastcAstc,
    wasmUASTCToBC7: paths.uastcBc7,
    wasmUASTCToRGBA_UNORM: paths.uastcRgbaUnorm,
    wasmUASTCToRGBA_SRGB: paths.uastcRgbaSrgb,
    wasmUASTCToR8_UNORM: paths.uastcR8Unorm,
    wasmUASTCToRG8_UNORM: paths.uastcRg8Unorm,
    jsMSCTranscoder: paths.mscTranscoderJs,
    wasmMSCTranscoder: paths.mscTranscoderWasm,
    wasmZSTDDecoder: paths.zstdDecoder,
  };

  return paths;
}

let babylonGltfLoaderPromise: Promise<void> | null = null;

async function ensureBabylonGltfLoader() {
  configureBabylonGraphicsDecoders();
  if (babylonGltfLoaderPromise) return babylonGltfLoaderPromise;
  const request = import('./babylonGltfLoader')
    .then(() => undefined)
    .catch(error => {
      if (babylonGltfLoaderPromise === request) babylonGltfLoaderPromise = null;
      throw error;
    });
  babylonGltfLoaderPromise = request;
  return request;
}

async function loadAssetContainerFromUrl(spec: GraphicsAssetSpec, scene: Scene) {
  return LoadAssetContainerAsync(spec.url, scene, {
    pluginExtension: '.glb',
    name: spec.id,
  });
}

function assertValidSpec(spec: GraphicsAssetSpec) {
  const issues = validateGraphicsAssetSpec(spec);
  if (issues.length) throw new Error(`Invalid Babylon graphics asset ${spec.id}: ${issues.join('; ')}`);
}

function normalizeRuntimeBudget(budget: BabylonGraphicsAssetRuntimeBudget): BabylonGraphicsAssetRuntimeBudget {
  return {
    maxCachedCompressedBytes: Math.max(8 * 1024 * 1024, Math.floor(budget.maxCachedCompressedBytes)),
    maxTextureAnisotropy: budget.maxTextureAnisotropy >= 4 ? 4 : budget.maxTextureAnisotropy >= 2 ? 2 : 1,
    maxCachedAssets: Math.max(1, Math.floor(budget.maxCachedAssets)),
  };
}

export class BabylonGraphicsAssetRuntime {
  private readonly cache = new Map<string, BabylonGraphicsAssetCacheEntry>();
  private readonly scene: Scene;
  private readonly loadContainer: BabylonGraphicsAssetContainerLoader;
  private budget = { ...DEFAULT_BABYLON_GRAPHICS_ASSET_RUNTIME_BUDGET };
  private accessOrdinal = 0;
  private disposed = false;

  constructor(scene: Scene, loadContainer: BabylonGraphicsAssetContainerLoader = loadAssetContainerFromUrl) {
    this.scene = scene;
    this.loadContainer = loadContainer;
    scene.onDisposeObservable.addOnce(() => this.disposeForSceneTeardown());
  }

  private assertActive() {
    if (this.disposed || this.scene.isDisposed) throw new Error('Babylon graphics asset runtime is disposed');
  }

  private applyTextureRuntimeBudget(container: AssetContainer) {
    const engineLimit = this.scene.getEngine().getCaps().maxAnisotropy ?? this.budget.maxTextureAnisotropy;
    const anisotropy = Math.max(1, Math.min(this.budget.maxTextureAnisotropy, engineLimit));
    for (const texture of container.textures) {
      if (texture.anisotropicFilteringLevel !== anisotropy) {
        texture.anisotropicFilteringLevel = anisotropy;
      }
    }
  }

  private finalizeEntry(entry: BabylonGraphicsAssetCacheEntry) {
    if (entry.disposePromise) return entry.disposePromise;
    entry.disposePromise = entry.promise
      .then(container => {
        container.dispose();
      })
      .catch(() => undefined);
    return entry.disposePromise;
  }

  private async enforceCacheBudget() {
    let estimatedCompressedBytes = [...this.cache.values()]
      .reduce((sum, entry) => sum + entry.spec.compressedByteBudget, 0);
    if (estimatedCompressedBytes <= this.budget.maxCachedCompressedBytes && this.cache.size <= this.budget.maxCachedAssets) return;

    const idleEntries = [...this.cache.entries()]
      .filter(([, entry]) => entry.activeInstances === 0 && !entry.pendingDispose)
      .sort((a, b) => a[1].lastUsedOrdinal - b[1].lastUsedOrdinal);

    for (const [url, entry] of idleEntries) {
      if (estimatedCompressedBytes <= this.budget.maxCachedCompressedBytes && this.cache.size <= this.budget.maxCachedAssets) break;
      if (this.cache.get(url) !== entry) continue;
      this.cache.delete(url);
      entry.pendingDispose = true;
      estimatedCompressedBytes -= entry.spec.compressedByteBudget;
      await this.finalizeEntry(entry);
    }
  }

  private releaseEntry(entry: BabylonGraphicsAssetCacheEntry) {
    entry.activeInstances = Math.max(0, entry.activeInstances - 1);
    if (entry.pendingDispose && entry.activeInstances === 0) {
      void this.finalizeEntry(entry);
    } else if (entry.activeInstances === 0) {
      void this.enforceCacheBudget();
    }
  }

  private getOrCreateEntry(spec: GraphicsAssetSpec) {
    this.assertActive();
    assertValidSpec(spec);

    const cached = this.cache.get(spec.url);
    if (cached && !cached.pendingDispose) {
      cached.lastUsedOrdinal = ++this.accessOrdinal;
      return cached;
    }

    let entry: BabylonGraphicsAssetCacheEntry;
    const promise = ensureBabylonGltfLoader()
      .then(() => this.loadContainer(spec, this.scene))
      .then(container => {
        this.applyTextureRuntimeBudget(container);
        return container;
      })
      .catch(error => {
        if (this.cache.get(spec.url) === entry) this.cache.delete(spec.url);
        throw error;
      });

    entry = {
      spec,
      promise,
      activeInstances: 0,
      pendingDispose: false,
      disposePromise: null,
      lastUsedOrdinal: ++this.accessOrdinal,
    };
    this.cache.set(spec.url, entry);
    return entry;
  }

  configureBudget(budget: BabylonGraphicsAssetRuntimeBudget) {
    this.assertActive();
    this.budget = normalizeRuntimeBudget(budget);
    for (const entry of this.cache.values()) {
      void entry.promise.then(container => this.applyTextureRuntimeBudget(container)).catch(() => undefined);
    }
    void this.enforceCacheBudget();
  }

  stats(): BabylonGraphicsAssetRuntimeStats {
    return {
      cachedAssets: this.cache.size,
      activeInstances: [...this.cache.values()].reduce((sum, entry) => sum + entry.activeInstances, 0),
      estimatedCachedCompressedBytes: [...this.cache.values()]
        .reduce((sum, entry) => sum + entry.spec.compressedByteBudget, 0),
      maxCachedCompressedBytes: this.budget.maxCachedCompressedBytes,
      maxCachedAssets: this.budget.maxCachedAssets,
    };
  }

  isCached(url: string) {
    const entry = this.cache.get(url);
    return !!entry && !entry.pendingDispose;
  }

  async load(spec: GraphicsAssetSpec): Promise<AssetContainer> {
    const entry = this.getOrCreateEntry(spec);
    const container = await entry.promise;
    await this.enforceCacheBudget();
    return container;
  }

  async preload(specs: readonly GraphicsAssetSpec[], maxConcurrency = 2) {
    const uniqueSpecs = [...new Map(specs.map(spec => [spec.url, spec])).values()];
    const workerCount = Math.min(uniqueSpecs.length, Math.max(1, Math.min(4, Math.floor(maxConcurrency) || 1)));
    let cursor = 0;
    let loaded = 0;
    let failed = 0;

    const worker = async () => {
      while (cursor < uniqueSpecs.length) {
        const spec = uniqueSpecs[cursor++];
        if (!spec) continue;
        try {
          await this.load(spec);
          loaded += 1;
        } catch {
          failed += 1;
        }
      }
    };

    if (workerCount > 0) await Promise.all(Array.from({ length: workerCount }, () => worker()));
    await this.enforceCacheBudget();
    return { requested: uniqueSpecs.length, loaded, failed, workerCount };
  }

  async instantiate(spec: GraphicsAssetSpec): Promise<BabylonGraphicsAssetInstance> {
    const entry = this.getOrCreateEntry(spec);
    entry.activeInstances += 1;
    try {
      const container = await entry.promise;
      const instantiated = container.instantiateModelsToScene(
        sourceName => `${spec.id}:${sourceName}`,
        false,
        { doNotInstantiate: false },
      );
      let released = false;
      return {
        spec,
        rootNodes: instantiated.rootNodes,
        animationGroups: instantiated.animationGroups,
        release: () => {
          if (released) return;
          released = true;
          instantiated.dispose();
          this.releaseEntry(entry);
        },
      };
    } catch (error) {
      this.releaseEntry(entry);
      throw error;
    }
  }

  async instantiateFamily(family: GraphicsAssetFamily, detailScale: number) {
    const spec = selectGraphicsAssetSpec(family, detailScale);
    if (!spec) return null;
    return this.instantiate(spec);
  }

  async evict(url: string) {
    const entry = this.cache.get(url);
    if (!entry) return false;
    this.cache.delete(url);
    entry.pendingDispose = true;
    if (entry.activeInstances === 0) await this.finalizeEntry(entry);
    return true;
  }

  async clear() {
    const entries = [...this.cache.values()];
    this.cache.clear();
    await Promise.all(entries.map(entry => {
      entry.pendingDispose = true;
      return entry.activeInstances === 0 ? this.finalizeEntry(entry) : Promise.resolve();
    }));
  }

  disposeForSceneTeardown() {
    if (this.disposed) return;
    this.disposed = true;
    this.cache.clear();
  }

  async dispose() {
    if (this.disposed) return;
    await this.clear();
    this.disposed = true;
  }
}

const runtimesByScene = new WeakMap<Scene, BabylonGraphicsAssetRuntime>();

export function getBabylonGraphicsAssetRuntime(scene: Scene) {
  let runtime = runtimesByScene.get(scene);
  if (!runtime) {
    runtime = new BabylonGraphicsAssetRuntime(scene);
    runtimesByScene.set(scene, runtime);
  }
  return runtime;
}

export async function disposeBabylonGraphicsAssetRuntime(scene: Scene) {
  const runtime = runtimesByScene.get(scene);
  if (!runtime) return;
  runtimesByScene.delete(scene);
  runtime.disposeForSceneTeardown();
}
