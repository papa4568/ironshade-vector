var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { LoadAssetContainerAsync, SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
import { KhronosTextureContainer2 } from "@babylonjs/core/Misc/khronosTextureContainer2.js";
import { MeshoptCompression } from "@babylonjs/core/Meshes/Compression/meshoptCompression.js";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
const GRAPHICS_ASSET_STANDARDS = {
  modelRoot: "/assets/models/",
  compression: {
    ktx2WorkerLimit: 2
  },
  defaultBudgets: {
    operator: { triangles: 45e3, compressedBytes: 25e5 },
    enemy: { triangles: 3e4, compressedBytes: 15e5 },
    boss: { triangles: 6e4, compressedBytes: 35e5 },
    weapon: { triangles: 12e3, compressedBytes: 8e5 },
    "environment-module": { triangles: 2e4, compressedBytes: 12e5 },
    pickup: { triangles: 4e3, compressedBytes: 24e4 },
    interactable: { triangles: 8e3, compressedBytes: 48e4 }
  }
};
function createGraphicsAssetSpec(id, assetClass, url, lod = 0) {
  const budget = GRAPHICS_ASSET_STANDARDS.defaultBudgets[assetClass];
  return {
    id,
    assetClass,
    url,
    lod,
    triangleBudget: budget.triangles,
    compressedByteBudget: budget.compressedBytes
  };
}
function validateGraphicsAssetSpec(spec) {
  const issues = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.id)) issues.push("id must use lowercase kebab-case");
  if (!spec.url.startsWith(GRAPHICS_ASSET_STANDARDS.modelRoot)) issues.push(`url must live under ${GRAPHICS_ASSET_STANDARDS.modelRoot}`);
  if (!spec.url.toLowerCase().endsWith(".glb")) issues.push("runtime asset must be a .glb file");
  if (!spec.url.toLowerCase().endsWith(`-lod${spec.lod}.glb`)) issues.push(`url filename must end in -lod${spec.lod}.glb`);
  if (!Number.isFinite(spec.triangleBudget) || spec.triangleBudget <= 0) issues.push("triangleBudget must be positive");
  if (!Number.isFinite(spec.compressedByteBudget) || spec.compressedByteBudget <= 0) issues.push("compressedByteBudget must be positive");
  return issues;
}
function graphicsAssetLodForDetailScale(detailScale) {
  if (!Number.isFinite(detailScale)) return 2;
  if (detailScale >= 0.9) return 0;
  if (detailScale >= 0.62) return 1;
  return 2;
}
function selectGraphicsAssetSpec(family, detailScale) {
  const preferred = graphicsAssetLodForDetailScale(detailScale);
  const order = {
    0: [0, 1, 2],
    1: [1, 2, 0],
    2: [2, 1, 0]
  };
  for (const lod of order[preferred]) {
    const spec = family.lods[lod];
    if (spec) return spec;
  }
  return null;
}
const BABYLON_GRAPHICS_CODEC_PATHS = {
  root: "/assets/codecs/babylon/",
  meshoptDecoder: "/assets/codecs/babylon/meshopt_decoder.js",
  ktx2DecoderModule: "/assets/codecs/babylon/babylon.ktx2Decoder.js",
  uastcAstc: "/assets/codecs/babylon/uastc_astc.wasm",
  uastcBc7: "/assets/codecs/babylon/uastc_bc7.wasm",
  uastcRgbaUnorm: "/assets/codecs/babylon/uastc_rgba8_unorm_v2.wasm",
  uastcRgbaSrgb: "/assets/codecs/babylon/uastc_rgba8_srgb_v2.wasm",
  uastcR8Unorm: "/assets/codecs/babylon/uastc_r8_unorm.wasm",
  uastcRg8Unorm: "/assets/codecs/babylon/uastc_rg8_unorm.wasm",
  mscTranscoderJs: "/assets/codecs/babylon/msc_basis_transcoder.js",
  mscTranscoderWasm: "/assets/codecs/babylon/msc_basis_transcoder.wasm",
  zstdDecoder: "/assets/codecs/babylon/zstddec.wasm"
};
const DEFAULT_BABYLON_GRAPHICS_ASSET_RUNTIME_BUDGET = {
  maxCachedCompressedBytes: 64 * 1024 * 1024,
  maxTextureAnisotropy: 4,
  maxCachedAssets: 32
};
function registerP27D6BabylonPrototype(name, value) {
  if (typeof location === "undefined" || new URLSearchParams(location.search).get("p27d6Soak") !== "1") return;
  const scope = globalThis;
  const prototype = Object.getPrototypeOf(value);
  if (!prototype) return;
  const registry = scope.__ironshadeP27D6BabylonPrototypes ?? (scope.__ironshadeP27D6BabylonPrototypes = {});
  registry[name] ?? (registry[name] = prototype);
}
function configureBabylonWebGlContextDisposal(scene2) {
  const engine2 = scene2.getEngine();
  if (engine2.getClassName() !== "Engine") return;
  const creationOptions = engine2._creationOptions;
  if (creationOptions) creationOptions.loseContextOnDispose = true;
}
function resolveRuntimeCodecUrl(path) {
  const base = typeof document !== "undefined" ? document.baseURI : typeof location !== "undefined" ? location.href : null;
  return base ? new URL(path, base).href : path;
}
function configureBabylonGraphicsDecoders() {
  const paths = Object.fromEntries(
    Object.entries(BABYLON_GRAPHICS_CODEC_PATHS).map(([key, value]) => [key, resolveRuntimeCodecUrl(value)])
  );
  MeshoptCompression.Configuration = {
    decoder: {
      url: paths.meshoptDecoder
    }
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
    wasmZSTDDecoder: paths.zstdDecoder
  };
  return paths;
}
let babylonGltfLoaderPromise = null;
async function ensureBabylonGltfLoader() {
  configureBabylonGraphicsDecoders();
  if (babylonGltfLoaderPromise) return babylonGltfLoaderPromise;
  const request = import("./assets/babylonGltfLoader-CpD6dkH-.js").then(() => void 0).catch((error) => {
    if (babylonGltfLoaderPromise === request) babylonGltfLoaderPromise = null;
    throw error;
  });
  babylonGltfLoaderPromise = request;
  return request;
}
async function loadAssetContainerFromUrl(spec, scene2) {
  return LoadAssetContainerAsync(spec.url, scene2, {
    pluginExtension: ".glb",
    name: spec.id
  });
}
function assertValidSpec(spec) {
  const issues = validateGraphicsAssetSpec(spec);
  if (issues.length) throw new Error(`Invalid Babylon graphics asset ${spec.id}: ${issues.join("; ")}`);
}
function normalizeRuntimeBudget(budget) {
  return {
    maxCachedCompressedBytes: Math.max(8 * 1024 * 1024, Math.floor(budget.maxCachedCompressedBytes)),
    maxTextureAnisotropy: budget.maxTextureAnisotropy >= 4 ? 4 : budget.maxTextureAnisotropy >= 2 ? 2 : 1,
    maxCachedAssets: Math.max(1, Math.floor(budget.maxCachedAssets))
  };
}
class BabylonGraphicsAssetRuntime {
  constructor(scene2, loadContainer2 = loadAssetContainerFromUrl) {
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "scene");
    __publicField(this, "loadContainer");
    __publicField(this, "budget", { ...DEFAULT_BABYLON_GRAPHICS_ASSET_RUNTIME_BUDGET });
    __publicField(this, "accessOrdinal", 0);
    __publicField(this, "disposed", false);
    this.scene = scene2;
    this.loadContainer = loadContainer2;
    configureBabylonWebGlContextDisposal(scene2);
    registerP27D6BabylonPrototype("assetRuntime", this);
    registerP27D6BabylonPrototype("scene", scene2);
    registerP27D6BabylonPrototype("engine", scene2.getEngine());
    scene2.onDisposeObservable.addOnce(() => this.disposeForSceneTeardown());
  }
  assertActive() {
    if (this.disposed || this.scene.isDisposed) throw new Error("Babylon graphics asset runtime is disposed");
  }
  applyTextureRuntimeBudget(container) {
    const engineLimit = this.scene.getEngine().getCaps().maxAnisotropy ?? this.budget.maxTextureAnisotropy;
    const anisotropy = Math.max(1, Math.min(this.budget.maxTextureAnisotropy, engineLimit));
    for (const texture of container.textures) {
      if (texture.anisotropicFilteringLevel !== anisotropy) {
        texture.anisotropicFilteringLevel = anisotropy;
      }
    }
  }
  finalizeEntry(entry) {
    if (entry.disposePromise) return entry.disposePromise;
    entry.disposePromise = entry.promise.then((container) => {
      container.dispose();
    }).catch(() => void 0);
    return entry.disposePromise;
  }
  async enforceCacheBudget() {
    let estimatedCompressedBytes = [...this.cache.values()].reduce((sum, entry) => sum + entry.spec.compressedByteBudget, 0);
    if (estimatedCompressedBytes <= this.budget.maxCachedCompressedBytes && this.cache.size <= this.budget.maxCachedAssets) return;
    const idleEntries = [...this.cache.entries()].filter(([, entry]) => entry.activeInstances === 0 && !entry.pendingDispose).sort((a, b) => a[1].lastUsedOrdinal - b[1].lastUsedOrdinal);
    for (const [url, entry] of idleEntries) {
      if (estimatedCompressedBytes <= this.budget.maxCachedCompressedBytes && this.cache.size <= this.budget.maxCachedAssets) break;
      if (this.cache.get(url) !== entry) continue;
      this.cache.delete(url);
      entry.pendingDispose = true;
      estimatedCompressedBytes -= entry.spec.compressedByteBudget;
      await this.finalizeEntry(entry);
    }
  }
  releaseEntry(entry) {
    entry.activeInstances = Math.max(0, entry.activeInstances - 1);
    if (entry.pendingDispose && entry.activeInstances === 0) {
      void this.finalizeEntry(entry);
    } else if (entry.activeInstances === 0) {
      void this.enforceCacheBudget();
    }
  }
  getOrCreateEntry(spec) {
    this.assertActive();
    assertValidSpec(spec);
    const cached = this.cache.get(spec.url);
    if (cached && !cached.pendingDispose) {
      cached.lastUsedOrdinal = ++this.accessOrdinal;
      return cached;
    }
    let entry;
    const promise = ensureBabylonGltfLoader().then(() => this.loadContainer(spec, this.scene)).then((container) => {
      registerP27D6BabylonPrototype("assetContainer", container);
      this.applyTextureRuntimeBudget(container);
      return container;
    }).catch((error) => {
      if (this.cache.get(spec.url) === entry) this.cache.delete(spec.url);
      throw error;
    });
    entry = {
      spec,
      promise,
      activeInstances: 0,
      pendingDispose: false,
      disposePromise: null,
      lastUsedOrdinal: ++this.accessOrdinal
    };
    this.cache.set(spec.url, entry);
    return entry;
  }
  configureBudget(budget) {
    this.assertActive();
    this.budget = normalizeRuntimeBudget(budget);
    for (const entry of this.cache.values()) {
      void entry.promise.then((container) => this.applyTextureRuntimeBudget(container)).catch(() => void 0);
    }
    void this.enforceCacheBudget();
  }
  stats() {
    return {
      cachedAssets: this.cache.size,
      activeInstances: [...this.cache.values()].reduce((sum, entry) => sum + entry.activeInstances, 0),
      estimatedCachedCompressedBytes: [...this.cache.values()].reduce((sum, entry) => sum + entry.spec.compressedByteBudget, 0),
      maxCachedCompressedBytes: this.budget.maxCachedCompressedBytes,
      maxCachedAssets: this.budget.maxCachedAssets
    };
  }
  isCached(url) {
    const entry = this.cache.get(url);
    return !!entry && !entry.pendingDispose;
  }
  async load(spec) {
    const entry = this.getOrCreateEntry(spec);
    const container = await entry.promise;
    await this.enforceCacheBudget();
    return container;
  }
  async preload(specs, maxConcurrency = 2) {
    const uniqueSpecs = [...new Map(specs.map((spec) => [spec.url, spec])).values()];
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
  async instantiate(spec) {
    const entry = this.getOrCreateEntry(spec);
    entry.activeInstances += 1;
    try {
      const container = await entry.promise;
      const instantiated = container.instantiateModelsToScene(
        (sourceName) => `${spec.id}:${sourceName}`,
        false,
        { doNotInstantiate: false }
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
        }
      };
    } catch (error) {
      this.releaseEntry(entry);
      throw error;
    }
  }
  async instantiateFamily(family, detailScale) {
    const spec = selectGraphicsAssetSpec(family, detailScale);
    if (!spec) return null;
    return this.instantiate(spec);
  }
  async evict(url) {
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
    await Promise.all(entries.map((entry) => {
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
const OPERATOR_ASSET_FAMILY = {
  lods: {
    1: createGraphicsAssetSpec("operator-field-suit-lod1", "operator", "/assets/models/operators/operator-field-suit-lod1.glb", 1),
    2: createGraphicsAssetSpec("operator-field-suit-lod2", "operator", "/assets/models/operators/operator-field-suit-lod2.glb", 2)
  }
};
({
  vanguard: {
    lods: {
      1: createGraphicsAssetSpec("operator-vanguard-lod1", "operator", "/assets/models/operators/operator-vanguard-lod1.glb", 1),
      2: createGraphicsAssetSpec("operator-vanguard-lod2", "operator", "/assets/models/operators/operator-vanguard-lod2.glb", 2)
    }
  },
  vector: {
    lods: {
      1: createGraphicsAssetSpec("operator-vector-lod1", "operator", "/assets/models/operators/operator-vector-lod1.glb", 1),
      2: createGraphicsAssetSpec("operator-vector-lod2", "operator", "/assets/models/operators/operator-vector-lod2.glb", 2)
    }
  },
  systems: {
    lods: {
      1: createGraphicsAssetSpec("operator-systems-lod1", "operator", "/assets/models/operators/operator-systems-lod1.glb", 1),
      2: createGraphicsAssetSpec("operator-systems-lod2", "operator", "/assets/models/operators/operator-systems-lod2.glb", 2)
    }
  }
});
({
  rib: {
    lods: {
      1: createGraphicsAssetSpec("damaged-vessel-broken-rib-lod1", "environment-module", "/assets/models/environments/damaged-vessel-broken-rib-lod1.glb", 1),
      2: createGraphicsAssetSpec("damaged-vessel-broken-rib-lod2", "environment-module", "/assets/models/environments/damaged-vessel-broken-rib-lod2.glb", 2)
    }
  },
  breachFrame: {
    lods: {
      1: createGraphicsAssetSpec("damaged-vessel-breach-frame-lod1", "environment-module", "/assets/models/environments/damaged-vessel-breach-frame-lod1.glb", 1),
      2: createGraphicsAssetSpec("damaged-vessel-breach-frame-lod2", "environment-module", "/assets/models/environments/damaged-vessel-breach-frame-lod2.glb", 2)
    }
  },
  salvageRack: {
    lods: {
      1: createGraphicsAssetSpec("damaged-vessel-salvage-rack-lod1", "environment-module", "/assets/models/environments/damaged-vessel-salvage-rack-lod1.glb", 1),
      2: createGraphicsAssetSpec("damaged-vessel-salvage-rack-lod2", "environment-module", "/assets/models/environments/damaged-vessel-salvage-rack-lod2.glb", 2)
    }
  },
  tornPlate: {
    lods: {
      1: createGraphicsAssetSpec("damaged-vessel-torn-wall-plate-lod1", "environment-module", "/assets/models/environments/damaged-vessel-torn-wall-plate-lod1.glb", 1),
      2: createGraphicsAssetSpec("damaged-vessel-torn-wall-plate-lod2", "environment-module", "/assets/models/environments/damaged-vessel-torn-wall-plate-lod2.glb", 2)
    }
  },
  serviceBundle: {
    lods: {
      1: createGraphicsAssetSpec("damaged-vessel-service-bundle-lod1", "environment-module", "/assets/models/environments/damaged-vessel-service-bundle-lod1.glb", 1),
      2: createGraphicsAssetSpec("damaged-vessel-service-bundle-lod2", "environment-module", "/assets/models/environments/damaged-vessel-service-bundle-lod2.glb", 2)
    }
  }
});
({
  ringSegment: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-ring-segment-lod1", "environment-module", "/assets/models/environments/spin-habitat-ring-segment-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-ring-segment-lod2", "environment-module", "/assets/models/environments/spin-habitat-ring-segment-lod2.glb", 2)
    }
  },
  spokeTruss: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-spoke-truss-lod1", "environment-module", "/assets/models/environments/spin-habitat-spoke-truss-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-spoke-truss-lod2", "environment-module", "/assets/models/environments/spin-habitat-spoke-truss-lod2.glb", 2)
    }
  },
  axisHub: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-axis-hub-lod1", "environment-module", "/assets/models/environments/spin-habitat-axis-hub-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-axis-hub-lod2", "environment-module", "/assets/models/environments/spin-habitat-axis-hub-lod2.glb", 2)
    }
  },
  serviceBay: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-service-bay-lod1", "environment-module", "/assets/models/environments/spin-habitat-service-bay-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-service-bay-lod2", "environment-module", "/assets/models/environments/spin-habitat-service-bay-lod2.glb", 2)
    }
  }
});
({
  deckSpan: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-deck-span-lod1", "environment-module", "/assets/models/environments/jovian-harvester-deck-span-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-deck-span-lod2", "environment-module", "/assets/models/environments/jovian-harvester-deck-span-lod2.glb", 2)
    }
  },
  skimmerTower: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-skimmer-tower-lod1", "environment-module", "/assets/models/environments/jovian-harvester-skimmer-tower-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-skimmer-tower-lod2", "environment-module", "/assets/models/environments/jovian-harvester-skimmer-tower-lod2.glb", 2)
    }
  },
  transferBridge: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-transfer-bridge-lod1", "environment-module", "/assets/models/environments/jovian-harvester-transfer-bridge-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-transfer-bridge-lod2", "environment-module", "/assets/models/environments/jovian-harvester-transfer-bridge-lod2.glb", 2)
    }
  },
  ballastPod: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-ballast-pod-lod1", "environment-module", "/assets/models/environments/jovian-harvester-ballast-pod-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-ballast-pod-lod2", "environment-module", "/assets/models/environments/jovian-harvester-ballast-pod-lod2.glb", 2)
    }
  }
});
({
  frostWall: {
    lods: {
      1: createGraphicsAssetSpec("ice-mine-frost-wall-lod1", "environment-module", "/assets/models/environments/ice-mine-frost-wall-lod1.glb", 1),
      2: createGraphicsAssetSpec("ice-mine-frost-wall-lod2", "environment-module", "/assets/models/environments/ice-mine-frost-wall-lod2.glb", 2)
    }
  },
  supportFrame: {
    lods: {
      1: createGraphicsAssetSpec("ice-mine-support-frame-lod1", "environment-module", "/assets/models/environments/ice-mine-support-frame-lod1.glb", 1),
      2: createGraphicsAssetSpec("ice-mine-support-frame-lod2", "environment-module", "/assets/models/environments/ice-mine-support-frame-lod2.glb", 2)
    }
  },
  serviceDeck: {
    lods: {
      1: createGraphicsAssetSpec("ice-mine-service-deck-lod1", "environment-module", "/assets/models/environments/ice-mine-service-deck-lod1.glb", 1),
      2: createGraphicsAssetSpec("ice-mine-service-deck-lod2", "environment-module", "/assets/models/environments/ice-mine-service-deck-lod2.glb", 2)
    }
  },
  icePillar: {
    lods: {
      1: createGraphicsAssetSpec("ice-mine-ice-pillar-lod1", "environment-module", "/assets/models/environments/ice-mine-ice-pillar-lod1.glb", 1),
      2: createGraphicsAssetSpec("ice-mine-ice-pillar-lod2", "environment-module", "/assets/models/environments/ice-mine-ice-pillar-lod2.glb", 2)
    }
  },
  cryoPump: {
    lods: {
      1: createGraphicsAssetSpec("ice-mine-cryo-pump-lod1", "environment-module", "/assets/models/environments/ice-mine-cryo-pump-lod1.glb", 1),
      2: createGraphicsAssetSpec("ice-mine-cryo-pump-lod2", "environment-module", "/assets/models/environments/ice-mine-cryo-pump-lod2.glb", 2)
    }
  },
  coolantManifold: {
    lods: {
      1: createGraphicsAssetSpec("ice-mine-coolant-manifold-lod1", "environment-module", "/assets/models/environments/ice-mine-coolant-manifold-lod1.glb", 1),
      2: createGraphicsAssetSpec("ice-mine-coolant-manifold-lod2", "environment-module", "/assets/models/environments/ice-mine-coolant-manifold-lod2.glb", 2)
    }
  },
  freezeCompressor: {
    lods: {
      1: createGraphicsAssetSpec("ice-mine-freeze-compressor-lod1", "environment-module", "/assets/models/environments/ice-mine-freeze-compressor-lod1.glb", 1),
      2: createGraphicsAssetSpec("ice-mine-freeze-compressor-lod2", "environment-module", "/assets/models/environments/ice-mine-freeze-compressor-lod2.glb", 2)
    }
  }
});
({
  ceramicDeck: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-ceramic-deck-lod1", "environment-module", "/assets/models/environments/solar-yard-ceramic-deck-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-ceramic-deck-lod2", "environment-module", "/assets/models/environments/solar-yard-ceramic-deck-lod2.glb", 2)
    }
  },
  trussFrame: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-truss-frame-lod1", "environment-module", "/assets/models/environments/solar-yard-truss-frame-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-truss-frame-lod2", "environment-module", "/assets/models/environments/solar-yard-truss-frame-lod2.glb", 2)
    }
  },
  radiatorTower: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-radiator-tower-lod1", "environment-module", "/assets/models/environments/solar-yard-radiator-tower-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-radiator-tower-lod2", "environment-module", "/assets/models/environments/solar-yard-radiator-tower-lod2.glb", 2)
    }
  },
  reflectorPylon: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-reflector-pylon-lod1", "environment-module", "/assets/models/environments/solar-yard-reflector-pylon-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-reflector-pylon-lod2", "environment-module", "/assets/models/environments/solar-yard-reflector-pylon-lod2.glb", 2)
    }
  },
  sinterForge: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-sinter-forge-lod1", "environment-module", "/assets/models/environments/solar-yard-sinter-forge-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-sinter-forge-lod2", "environment-module", "/assets/models/environments/solar-yard-sinter-forge-lod2.glb", 2)
    }
  },
  printerSpindle: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-printer-spindle-lod1", "environment-module", "/assets/models/environments/solar-yard-printer-spindle-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-printer-spindle-lod2", "environment-module", "/assets/models/environments/solar-yard-printer-spindle-lod2.glb", 2)
    }
  },
  feedstockPress: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-feedstock-press-lod1", "environment-module", "/assets/models/environments/solar-yard-feedstock-press-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-feedstock-press-lod2", "environment-module", "/assets/models/environments/solar-yard-feedstock-press-lod2.glb", 2)
    }
  },
  transferRail: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-transfer-rail-lod1", "environment-module", "/assets/models/environments/solar-yard-transfer-rail-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-transfer-rail-lod2", "environment-module", "/assets/models/environments/solar-yard-transfer-rail-lod2.glb", 2)
    }
  },
  gantryCrane: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-gantry-crane-lod1", "environment-module", "/assets/models/environments/solar-yard-gantry-crane-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-gantry-crane-lod2", "environment-module", "/assets/models/environments/solar-yard-gantry-crane-lod2.glb", 2)
    }
  },
  thermalShutter: {
    lods: {
      1: createGraphicsAssetSpec("solar-yard-thermal-shutter-lod1", "environment-module", "/assets/models/environments/solar-yard-thermal-shutter-lod1.glb", 1),
      2: createGraphicsAssetSpec("solar-yard-thermal-shutter-lod2", "environment-module", "/assets/models/environments/solar-yard-thermal-shutter-lod2.glb", 2)
    }
  }
});
({
  pylon: {
    lods: {
      1: createGraphicsAssetSpec("parallax-baseline-pylon-lod1", "environment-module", "/assets/models/environments/parallax-baseline-pylon-lod1.glb", 1),
      2: createGraphicsAssetSpec("parallax-baseline-pylon-lod2", "environment-module", "/assets/models/environments/parallax-baseline-pylon-lod2.glb", 2)
    }
  },
  frame: {
    lods: {
      1: createGraphicsAssetSpec("parallax-reference-frame-lod1", "environment-module", "/assets/models/environments/parallax-reference-frame-lod1.glb", 1),
      2: createGraphicsAssetSpec("parallax-reference-frame-lod2", "environment-module", "/assets/models/environments/parallax-reference-frame-lod2.glb", 2)
    }
  },
  massCarriage: {
    lods: {
      1: createGraphicsAssetSpec("parallax-mass-carriage-lod1", "environment-module", "/assets/models/environments/parallax-mass-carriage-lod1.glb", 1),
      2: createGraphicsAssetSpec("parallax-mass-carriage-lod2", "environment-module", "/assets/models/environments/parallax-mass-carriage-lod2.glb", 2)
    }
  },
  shearAnchor: {
    lods: {
      1: createGraphicsAssetSpec("parallax-shear-anchor-lod1", "environment-module", "/assets/models/environments/parallax-shear-anchor-lod1.glb", 1),
      2: createGraphicsAssetSpec("parallax-shear-anchor-lod2", "environment-module", "/assets/models/environments/parallax-shear-anchor-lod2.glb", 2)
    }
  },
  console: {
    lods: {
      1: createGraphicsAssetSpec("parallax-reference-console-lod1", "environment-module", "/assets/models/environments/parallax-reference-console-lod1.glb", 1),
      2: createGraphicsAssetSpec("parallax-reference-console-lod2", "environment-module", "/assets/models/environments/parallax-reference-console-lod2.glb", 2)
    }
  }
});
const REFINERY_ASSET_FAMILIES = {
  floor: {
    lods: {
      0: createGraphicsAssetSpec("refinery-floor-panel-lod0", "environment-module", "/assets/models/environments/refinery-floor-panel-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-floor-panel-lod1", "environment-module", "/assets/models/environments/refinery-floor-panel-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-floor-panel-lod2", "environment-module", "/assets/models/environments/refinery-floor-panel-lod2.glb", 2)
    }
  },
  floorGrate: {
    lods: {
      0: createGraphicsAssetSpec("refinery-floor-service-grate-lod0", "environment-module", "/assets/models/environments/refinery-floor-service-grate-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-floor-service-grate-lod1", "environment-module", "/assets/models/environments/refinery-floor-service-grate-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-floor-service-grate-lod2", "environment-module", "/assets/models/environments/refinery-floor-service-grate-lod2.glb", 2)
    }
  },
  bulkhead: {
    lods: {
      0: createGraphicsAssetSpec("refinery-bulkhead-lod0", "environment-module", "/assets/models/environments/refinery-bulkhead-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-bulkhead-lod1", "environment-module", "/assets/models/environments/refinery-bulkhead-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-bulkhead-lod2", "environment-module", "/assets/models/environments/refinery-bulkhead-lod2.glb", 2)
    }
  },
  processor: {
    lods: {
      0: createGraphicsAssetSpec("refinery-processor-lod0", "environment-module", "/assets/models/environments/refinery-processor-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-processor-lod1", "environment-module", "/assets/models/environments/refinery-processor-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-processor-lod2", "environment-module", "/assets/models/environments/refinery-processor-lod2.glb", 2)
    }
  },
  pipeRack: {
    lods: {
      0: createGraphicsAssetSpec("refinery-pipe-rack-lod0", "environment-module", "/assets/models/environments/refinery-pipe-rack-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-pipe-rack-lod1", "environment-module", "/assets/models/environments/refinery-pipe-rack-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-pipe-rack-lod2", "environment-module", "/assets/models/environments/refinery-pipe-rack-lod2.glb", 2)
    }
  },
  wallPanel: {
    lods: {
      0: createGraphicsAssetSpec("refinery-wall-service-panel-lod0", "environment-module", "/assets/models/environments/refinery-wall-service-panel-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-wall-service-panel-lod1", "environment-module", "/assets/models/environments/refinery-wall-service-panel-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-wall-service-panel-lod2", "environment-module", "/assets/models/environments/refinery-wall-service-panel-lod2.glb", 2)
    }
  },
  cableTray: {
    lods: {
      0: createGraphicsAssetSpec("refinery-cable-tray-lod0", "environment-module", "/assets/models/environments/refinery-cable-tray-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-cable-tray-lod1", "environment-module", "/assets/models/environments/refinery-cable-tray-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-cable-tray-lod2", "environment-module", "/assets/models/environments/refinery-cable-tray-lod2.glb", 2)
    }
  },
  serviceConduit: {
    lods: {
      0: createGraphicsAssetSpec("refinery-service-conduit-lod0", "environment-module", "/assets/models/environments/refinery-service-conduit-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-service-conduit-lod1", "environment-module", "/assets/models/environments/refinery-service-conduit-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-service-conduit-lod2", "environment-module", "/assets/models/environments/refinery-service-conduit-lod2.glb", 2)
    }
  },
  gantry: {
    lods: {
      0: createGraphicsAssetSpec("refinery-smelter-gantry-lod0", "environment-module", "/assets/models/environments/refinery-smelter-gantry-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-smelter-gantry-lod1", "environment-module", "/assets/models/environments/refinery-smelter-gantry-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-smelter-gantry-lod2", "environment-module", "/assets/models/environments/refinery-smelter-gantry-lod2.glb", 2)
    }
  },
  crate: {
    lods: {
      0: createGraphicsAssetSpec("refinery-crate-lod0", "environment-module", "/assets/models/environments/refinery-crate-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-crate-lod1", "environment-module", "/assets/models/environments/refinery-crate-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-crate-lod2", "environment-module", "/assets/models/environments/refinery-crate-lod2.glb", 2)
    }
  },
  terminal: {
    lods: {
      0: createGraphicsAssetSpec("refinery-terminal-lod0", "environment-module", "/assets/models/environments/refinery-terminal-lod0.glb", 0),
      1: createGraphicsAssetSpec("refinery-terminal-lod1", "environment-module", "/assets/models/environments/refinery-terminal-lod1.glb", 1),
      2: createGraphicsAssetSpec("refinery-terminal-lod2", "environment-module", "/assets/models/environments/refinery-terminal-lod2.glb", 2)
    }
  }
};
const SHOWCASE_REFINERY_MODULE_FAMILY = REFINERY_ASSET_FAMILIES.processor;
({
  marksman: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-spoke-marksman-lod1", "enemy", "/assets/models/enemies/spin-habitat-spoke-marksman-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-spoke-marksman-lod2", "enemy", "/assets/models/enemies/spin-habitat-spoke-marksman-lod2.glb", 2)
    }
  },
  gravitySpecialist: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-spin-trim-specialist-lod1", "enemy", "/assets/models/enemies/spin-habitat-spin-trim-specialist-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-spin-trim-specialist-lod2", "enemy", "/assets/models/enemies/spin-habitat-spin-trim-specialist-lod2.glb", 2)
    }
  },
  droneCarrier: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-ring-drone-carrier-lod1", "enemy", "/assets/models/enemies/spin-habitat-ring-drone-carrier-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-ring-drone-carrier-lod2", "enemy", "/assets/models/enemies/spin-habitat-ring-drone-carrier-lod2.glb", 2)
    }
  },
  shieldBoarder: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-axis-shield-boarder-lod1", "enemy", "/assets/models/enemies/spin-habitat-axis-shield-boarder-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-axis-shield-boarder-lod2", "enemy", "/assets/models/enemies/spin-habitat-axis-shield-boarder-lod2.glb", 2)
    }
  }
});
({
  lods: {
    1: createGraphicsAssetSpec("spin-habitat-sable-voss-lod1", "enemy", "/assets/models/bosses/spin-habitat-sable-voss-lod1.glb", 1),
    2: createGraphicsAssetSpec("spin-habitat-sable-voss-lod2", "enemy", "/assets/models/bosses/spin-habitat-sable-voss-lod2.glb", 2)
  }
});
({
  lods: {
    1: createGraphicsAssetSpec("jovian-harvester-stormline-foreman-lod1", "enemy", "/assets/models/bosses/jovian-harvester-stormline-foreman-lod1.glb", 1),
    2: createGraphicsAssetSpec("jovian-harvester-stormline-foreman-lod2", "enemy", "/assets/models/bosses/jovian-harvester-stormline-foreman-lod2.glb", 2)
  }
});
({
  lods: {
    1: createGraphicsAssetSpec("ice-mine-rhea-kade-lod1", "enemy", "/assets/models/bosses/ice-mine-rhea-kade-lod1.glb", 1),
    2: createGraphicsAssetSpec("ice-mine-rhea-kade-lod2", "enemy", "/assets/models/bosses/ice-mine-rhea-kade-lod2.glb", 2)
  }
});
({
  lods: {
    1: createGraphicsAssetSpec("solar-yard-helios-9-lod1", "enemy", "/assets/models/bosses/solar-yard-helios-9-lod1.glb", 1),
    2: createGraphicsAssetSpec("solar-yard-helios-9-lod2", "enemy", "/assets/models/bosses/solar-yard-helios-9-lod2.glb", 2)
  }
});
({
  assault: {
    lods: {
      1: createGraphicsAssetSpec("enemy-assault-lod1", "enemy", "/assets/models/enemies/enemy-assault-lod1.glb", 1),
      2: createGraphicsAssetSpec("enemy-assault-lod2", "enemy", "/assets/models/enemies/enemy-assault-lod2.glb", 2)
    }
  },
  suppressor: {
    lods: {
      1: createGraphicsAssetSpec("enemy-suppressor-lod1", "enemy", "/assets/models/enemies/enemy-suppressor-lod1.glb", 1),
      2: createGraphicsAssetSpec("enemy-suppressor-lod2", "enemy", "/assets/models/enemies/enemy-suppressor-lod2.glb", 2)
    }
  },
  technician: {
    lods: {
      1: createGraphicsAssetSpec("enemy-technician-lod1", "enemy", "/assets/models/enemies/enemy-technician-lod1.glb", 1),
      2: createGraphicsAssetSpec("enemy-technician-lod2", "enemy", "/assets/models/enemies/enemy-technician-lod2.glb", 2)
    }
  },
  elite: {
    lods: {
      1: createGraphicsAssetSpec("enemy-elite-lod1", "enemy", "/assets/models/enemies/enemy-elite-lod1.glb", 1),
      2: createGraphicsAssetSpec("enemy-elite-lod2", "enemy", "/assets/models/enemies/enemy-elite-lod2.glb", 2)
    }
  },
  boss: {
    lods: {
      1: createGraphicsAssetSpec("enemy-boss-lod1", "boss", "/assets/models/bosses/enemy-boss-lod1.glb", 1),
      2: createGraphicsAssetSpec("enemy-boss-lod2", "boss", "/assets/models/bosses/enemy-boss-lod2.glb", 2)
    }
  }
});
({
  carbine: {
    lods: {
      1: createGraphicsAssetSpec("weapon-carbine-lod1", "weapon", "/assets/models/weapons/weapon-carbine-lod1.glb", 1),
      2: createGraphicsAssetSpec("weapon-carbine-lod2", "weapon", "/assets/models/weapons/weapon-carbine-lod2.glb", 2)
    }
  },
  breacher: {
    lods: {
      1: createGraphicsAssetSpec("weapon-breacher-lod1", "weapon", "/assets/models/weapons/weapon-breacher-lod1.glb", 1),
      2: createGraphicsAssetSpec("weapon-breacher-lod2", "weapon", "/assets/models/weapons/weapon-breacher-lod2.glb", 2)
    }
  },
  rail: {
    lods: {
      1: createGraphicsAssetSpec("weapon-rail-lod1", "weapon", "/assets/models/weapons/weapon-rail-lod1.glb", 1),
      2: createGraphicsAssetSpec("weapon-rail-lod2", "weapon", "/assets/models/weapons/weapon-rail-lod2.glb", 2)
    }
  }
});
({
  lods: {
    1: createGraphicsAssetSpec("pickup-recovery-capsule-lod1", "pickup", "/assets/models/pickups/pickup-recovery-capsule-lod1.glb", 1),
    2: createGraphicsAssetSpec("pickup-recovery-capsule-lod2", "pickup", "/assets/models/pickups/pickup-recovery-capsule-lod2.glb", 2)
  }
});
({
  spinBusIsolator: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-spin-bus-isolator-lod1", "interactable", "/assets/models/interactables/spin-habitat-spin-bus-isolator-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-spin-bus-isolator-lod2", "interactable", "/assets/models/interactables/spin-habitat-spin-bus-isolator-lod2.glb", 2)
    }
  },
  gravityTrim: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-gravity-trim-lod1", "interactable", "/assets/models/interactables/spin-habitat-gravity-trim-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-gravity-trim-lod2", "interactable", "/assets/models/interactables/spin-habitat-gravity-trim-lod2.glb", 2)
    }
  },
  bearingControl: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-bearing-control-lod1", "interactable", "/assets/models/interactables/spin-habitat-bearing-control-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-bearing-control-lod2", "interactable", "/assets/models/interactables/spin-habitat-bearing-control-lod2.glb", 2)
    }
  },
  attitudeFlywheel: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-attitude-flywheel-lod1", "interactable", "/assets/models/interactables/spin-habitat-attitude-flywheel-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-attitude-flywheel-lod2", "interactable", "/assets/models/interactables/spin-habitat-attitude-flywheel-lod2.glb", 2)
    }
  },
  pressureLock: {
    lods: {
      1: createGraphicsAssetSpec("spin-habitat-pressure-lock-lod1", "interactable", "/assets/models/interactables/spin-habitat-pressure-lock-lod1.glb", 1),
      2: createGraphicsAssetSpec("spin-habitat-pressure-lock-lod2", "interactable", "/assets/models/interactables/spin-habitat-pressure-lock-lod2.glb", 2)
    }
  }
});
({
  stormBusIsolator: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-storm-bus-isolator-lod1", "interactable", "/assets/models/interactables/jovian-harvester-storm-bus-isolator-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-storm-bus-isolator-lod2", "interactable", "/assets/models/interactables/jovian-harvester-storm-bus-isolator-lod2.glb", 2)
    }
  },
  deckMassTrim: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-deck-mass-trim-lod1", "interactable", "/assets/models/interactables/jovian-harvester-deck-mass-trim-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-deck-mass-trim-lod2", "interactable", "/assets/models/interactables/jovian-harvester-deck-mass-trim-lod2.glb", 2)
    }
  },
  skimmerCompressor: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-skimmer-compressor-lod1", "interactable", "/assets/models/interactables/jovian-harvester-skimmer-compressor-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-skimmer-compressor-lod2", "interactable", "/assets/models/interactables/jovian-harvester-skimmer-compressor-lod2.glb", 2)
    }
  },
  separatorPackage: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-separator-package-lod1", "interactable", "/assets/models/interactables/jovian-harvester-separator-package-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-separator-package-lod2", "interactable", "/assets/models/interactables/jovian-harvester-separator-package-lod2.glb", 2)
    }
  },
  stormPressureLock: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-storm-pressure-lock-lod1", "interactable", "/assets/models/interactables/jovian-harvester-storm-pressure-lock-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-storm-pressure-lock-lod2", "interactable", "/assets/models/interactables/jovian-harvester-storm-pressure-lock-lod2.glb", 2)
    }
  },
  reliefManifold: {
    lods: {
      1: createGraphicsAssetSpec("jovian-harvester-relief-manifold-lod1", "interactable", "/assets/models/interactables/jovian-harvester-relief-manifold-lod1.glb", 1),
      2: createGraphicsAssetSpec("jovian-harvester-relief-manifold-lod2", "interactable", "/assets/models/interactables/jovian-harvester-relief-manifold-lod2.glb", 2)
    }
  }
});
({
  control: {
    lods: {
      1: createGraphicsAssetSpec("interactable-control-terminal-lod1", "interactable", "/assets/models/interactables/interactable-control-terminal-lod1.glb", 1),
      2: createGraphicsAssetSpec("interactable-control-terminal-lod2", "interactable", "/assets/models/interactables/interactable-control-terminal-lod2.glb", 2)
    }
  },
  salvage: {
    lods: {
      1: createGraphicsAssetSpec("interactable-salvage-tag-node-lod1", "interactable", "/assets/models/interactables/interactable-salvage-tag-node-lod1.glb", 1),
      2: createGraphicsAssetSpec("interactable-salvage-tag-node-lod2", "interactable", "/assets/models/interactables/interactable-salvage-tag-node-lod2.glb", 2)
    }
  }
});
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const runtimeSource = readFileSync(resolve(process.cwd(), "src/game/babylonGraphicsAssets.ts"), "utf8");
const loaderBoundarySource = readFileSync(resolve(process.cwd(), "src/game/babylonGltfLoader.ts"), "utf8");
const assetContractSource = readFileSync(resolve(process.cwd(), "src/game/graphicsAssets.ts"), "utf8");
assert(!runtimeSource.includes("from 'three'") && !runtimeSource.includes("three/examples"), "Babylon asset runtime must not depend on the Three asset loader");
assert(!assetContractSource.includes("from 'three'") && !assetContractSource.includes("@babylonjs/"), "shared graphics asset contract must remain renderer-neutral");
assert(
  runtimeSource.includes("import('./babylonGltfLoader')") && loaderBoundarySource.includes("import '@babylonjs/loaders/glTF/2.0/glTFLoader'") && !loaderBoundarySource.includes("import '@babylonjs/loaders/glTF';"),
  "Babylon GLB loader must remain deferred and restricted to the glTF 2.0 loader until authored content requires extensions"
);
assert(!runtimeSource.includes("cdn.babylonjs.com") && !runtimeSource.includes("preview.babylonjs.com"), "Babylon asset runtime must not hard-code a decoder CDN");
assert(
  runtimeSource.includes("engine.getClassName() !== 'Engine'") && runtimeSource.includes("creationOptions.loseContextOnDispose = true"),
  "Babylon WebGL engine teardown must explicitly release its WebGL context while leaving WebGPU untouched"
);
const decoderUrls = configureBabylonGraphicsDecoders();
for (const [name, url] of Object.entries(decoderUrls)) {
  if (name === "root") continue;
  assert(url.startsWith(BABYLON_GRAPHICS_CODEC_PATHS.root), `${name} must resolve to the packaged Babylon codec root in Node tests, got ${url}`);
}
assert(MeshoptCompression.Configuration.decoder.url === decoderUrls.meshoptDecoder, "Meshopt must use the packaged local decoder");
assert(KhronosTextureContainer2.URLConfig.jsDecoderModule === decoderUrls.ktx2DecoderModule, "KTX2 must use the packaged local decoder module");
assert(KhronosTextureContainer2.URLConfig.jsMSCTranscoder === decoderUrls.mscTranscoderJs, "KTX2 MSC JS transcoder must remain local");
assert(KhronosTextureContainer2.URLConfig.wasmMSCTranscoder === decoderUrls.mscTranscoderWasm, "KTX2 MSC WASM transcoder must remain local");
assert(KhronosTextureContainer2.URLConfig.wasmZSTDDecoder === decoderUrls.zstdDecoder, "KTX2 ZSTD decoder must remain local");
const operatorLod1 = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, 0.72);
const operatorLod2 = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, 0.5);
const refineryLod1 = selectGraphicsAssetSpec(SHOWCASE_REFINERY_MODULE_FAMILY, 0.72);
const refineryFloorLod0 = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES.floor, 1);
const refineryGrateLod0 = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES.floorGrate, 1);
const refineryBulkheadLod0 = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES.bulkhead, 1);
const refineryWallPanelLod0 = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES.wallPanel, 1);
const refineryPipeRackLod0 = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES.pipeRack, 1);
const refineryCableTrayLod0 = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES.cableTray, 1);
assert((operatorLod1 == null ? void 0 : operatorLod1.lod) === 1, "Babylon operator test must request authored LOD1");
assert((operatorLod2 == null ? void 0 : operatorLod2.lod) === 2, "Babylon operator test must request authored LOD2");
assert((refineryLod1 == null ? void 0 : refineryLod1.lod) === 1, "Babylon refinery test must request authored LOD1");
assert((refineryFloorLod0 == null ? void 0 : refineryFloorLod0.lod) === 0, "Flagship refinery floor must select authored LOD0");
assert((refineryGrateLod0 == null ? void 0 : refineryGrateLod0.lod) === 0, "Flagship refinery service grate must select authored LOD0");
assert((refineryBulkheadLod0 == null ? void 0 : refineryBulkheadLod0.lod) === 0, "Flagship refinery bulkhead must select authored LOD0");
assert((refineryWallPanelLod0 == null ? void 0 : refineryWallPanelLod0.lod) === 0, "Flagship refinery wall service panel must select authored LOD0");
assert((refineryPipeRackLod0 == null ? void 0 : refineryPipeRackLod0.lod) === 0, "Flagship refinery pipe rack must select authored LOD0");
assert((refineryCableTrayLod0 == null ? void 0 : refineryCableTrayLod0.lod) === 0, "Flagship refinery cable tray must select authored LOD0");
const engine = new NullEngine();
const scene = new Scene(engine);
const loadCounts = /* @__PURE__ */ new Map();
const disposeCounts = /* @__PURE__ */ new Map();
let externalAtlasLoads = 0;
async function loadLocalGlb(spec, targetScene, name) {
  const filePath = resolve(process.cwd(), "public", spec.url.replace(/^\/+/, ""));
  const data = await readFile(filePath);
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const observer = SceneLoader.OnPluginActivatedObservable.add((plugin) => {
    if (plugin.name !== "gltf" || !("preprocessUrlAsync" in plugin)) return;
    const gltfPlugin = plugin;
    const originalPreprocessUrlAsync = gltfPlugin.preprocessUrlAsync.bind(gltfPlugin);
    gltfPlugin.preprocessUrlAsync = async (url) => {
      if (!url.endsWith("refinery-decal-atlas.png")) return originalPreprocessUrlAsync(url);
      const atlas = await readFile(resolve(dirname(filePath), "refinery-decal-atlas.png"));
      externalAtlasLoads += 1;
      return `data:image/png;base64,${atlas.toString("base64")}`;
    };
  });
  try {
    return await LoadAssetContainerAsync(bytes, targetScene, {
      pluginExtension: ".glb",
      name
    });
  } finally {
    SceneLoader.OnPluginActivatedObservable.remove(observer);
  }
}
const loadContainer = async (spec, targetScene) => {
  loadCounts.set(spec.url, (loadCounts.get(spec.url) ?? 0) + 1);
  const container = await loadLocalGlb(spec, targetScene, spec.id);
  const originalDispose = container.dispose.bind(container);
  container.dispose = () => {
    disposeCounts.set(spec.url, (disposeCounts.get(spec.url) ?? 0) + 1);
    originalDispose();
  };
  return container;
};
async function run() {
  await import("./assets/babylonGltfLoader-CpD6dkH-.js");
  const flagshipEngine = new NullEngine();
  const flagshipScene = new Scene(flagshipEngine);
  const floorContainer = await loadLocalGlb(refineryFloorLod0, flagshipScene, `${refineryFloorLod0.id}-flagship`);
  const grateContainer = await loadLocalGlb(refineryGrateLod0, flagshipScene, `${refineryGrateLod0.id}-flagship`);
  const bulkheadContainer = await loadLocalGlb(refineryBulkheadLod0, flagshipScene, `${refineryBulkheadLod0.id}-flagship`);
  const wallPanelContainer = await loadLocalGlb(refineryWallPanelLod0, flagshipScene, `${refineryWallPanelLod0.id}-flagship`);
  const pipeRackContainer = await loadLocalGlb(refineryPipeRackLod0, flagshipScene, `${refineryPipeRackLod0.id}-flagship`);
  const cableTrayContainer = await loadLocalGlb(refineryCableTrayLod0, flagshipScene, `${refineryCableTrayLod0.id}-flagship`);
  assert(floorContainer.meshes.length >= 6, `Flagship refinery floor LOD0 must load authored bevel/detail meshes, got ${floorContainer.meshes.length}`);
  assert(grateContainer.meshes.length >= 7, `Flagship refinery service grate LOD0 must load authored frame/slat meshes, got ${grateContainer.meshes.length}`);
  assert(bulkheadContainer.meshes.length >= 7, `Flagship refinery bulkhead LOD0 must load authored inset/gusset meshes, got ${bulkheadContainer.meshes.length}`);
  assert(wallPanelContainer.meshes.length >= 9, `Flagship refinery wall panel LOD0 must load authored inset/service meshes, got ${wallPanelContainer.meshes.length}`);
  assert(pipeRackContainer.meshes.length >= 8, `Flagship refinery pipe rack LOD0 must load authored round-pipe/support meshes, got ${pipeRackContainer.meshes.length}`);
  assert(cableTrayContainer.meshes.length >= 8, `Flagship refinery cable tray LOD0 must load authored rail/rung/cable meshes, got ${cableTrayContainer.meshes.length}`);
  assert(externalAtlasLoads === 4, `Flagship route-detailed LOD0 refinery assets must resolve the shared refinery route atlas, got ${externalAtlasLoads}`);
  floorContainer.dispose();
  grateContainer.dispose();
  bulkheadContainer.dispose();
  wallPanelContainer.dispose();
  pipeRackContainer.dispose();
  cableTrayContainer.dispose();
  flagshipScene.dispose();
  flagshipEngine.dispose();
  externalAtlasLoads = 0;
  const runtime = new BabylonGraphicsAssetRuntime(scene, loadContainer);
  const operatorA = await runtime.instantiate(operatorLod1);
  assert(operatorA.spec.lod === 1, "operator instance must retain requested LOD1 spec");
  assert(operatorA.rootNodes.length > 0, "Babylon operator LOD1 must instantiate scene roots");
  assert(operatorA.rootNodes.some((root) => root.getChildMeshes(false).length > 0), "Babylon operator LOD1 must contain renderable meshes");
  const operatorB = await runtime.instantiate(operatorLod1);
  assert(loadCounts.get(operatorLod1.url) === 1, "same Babylon GLB URL must be loaded once and served from cache");
  assert(operatorA.rootNodes[0] !== operatorB.rootNodes[0], "Babylon instances must own distinct cloned root nodes");
  operatorA.release();
  const operatorC = await runtime.instantiate(operatorLod1);
  assert(loadCounts.get(operatorLod1.url) === 1, "releasing one clone must keep shared cached resources usable");
  assert(operatorC.rootNodes.length > 0, "cached source container must remain instantiable after another clone releases");
  operatorB.release();
  operatorC.release();
  const operatorLow = await runtime.instantiate(operatorLod2);
  assert(operatorLow.spec.lod === 2 && operatorLow.rootNodes.length > 0, "Babylon operator LOD2 must load and instantiate at reduced detail");
  operatorLow.release();
  const refinery = await runtime.instantiate(refineryLod1);
  assert(refinery.spec.lod === 1, "refinery instance must retain requested LOD1 spec");
  assert(refinery.rootNodes.length > 0, "Babylon Asteroid Refinery module must instantiate scene roots");
  assert(refinery.rootNodes.some((root) => root.getChildMeshes(false).length > 0), "Babylon refinery module must contain renderable meshes");
  assert(externalAtlasLoads === 1, `Babylon NullEngine harness must resolve the refinery external decal atlas once, got ${externalAtlasLoads}`);
  const refineryShared = await runtime.instantiate(refineryLod1);
  const sharedStaticMeshes = refineryShared.rootNodes.flatMap((root) => root.getChildMeshes(false)).filter((mesh) => mesh.isAnInstance);
  assert(sharedStaticMeshes.length > 0, "repeated static Babylon GLB geometry must use native InstancedMesh reuse");
  refineryShared.release();
  const statsWithRefinery = runtime.stats();
  assert(statsWithRefinery.cachedAssets === 3, `expected three cached representative assets, got ${statsWithRefinery.cachedAssets}`);
  assert(
    statsWithRefinery.estimatedCachedCompressedBytes === operatorLod1.compressedByteBudget + operatorLod2.compressedByteBudget + refineryLod1.compressedByteBudget,
    "Babylon cache accounting must reuse manifest compressed-byte budgets"
  );
  runtime.configureBudget({
    maxCachedCompressedBytes: 64 * 1024 * 1024,
    maxTextureAnisotropy: 4,
    maxCachedAssets: 2
  });
  assert(runtime.stats().cachedAssets <= 2, "Babylon resource tier must trim least-recently-used idle cache entries by count as well as bytes");
  const heldRefinery = refinery;
  const evictedWhileMounted = await runtime.evict(refineryLod1.url);
  assert(evictedWhileMounted, "mounted refinery cache entry should be evictable into pending-dispose state");
  assert((disposeCounts.get(refineryLod1.url) ?? 0) === 0, "shared refinery resources must stay alive while a clone is mounted");
  heldRefinery.release();
  await Promise.resolve();
  await Promise.resolve();
  assert((disposeCounts.get(refineryLod1.url) ?? 0) === 1, "shared refinery resources must dispose exactly once after the last mounted clone releases");
  const reloadedRefinery = await runtime.instantiate(refineryLod1);
  assert(loadCounts.get(refineryLod1.url) === 2, "evicted refinery GLB must reload on the next request");
  assert(externalAtlasLoads === 2, `reloaded refinery GLB must resolve the external atlas again in the NullEngine harness, got ${externalAtlasLoads}`);
  reloadedRefinery.release();
  await runtime.dispose();
  await Promise.resolve();
  assert((disposeCounts.get(operatorLod1.url) ?? 0) === 1, "operator LOD1 source resources must dispose once with the runtime");
  assert((disposeCounts.get(operatorLod2.url) ?? 0) === 1, "operator LOD2 source resources must dispose once with the runtime");
  assert((disposeCounts.get(refineryLod1.url) ?? 0) === 2, "reloaded refinery source resources must dispose once with the runtime");
  scene.dispose();
  engine.dispose();
  const teardownEngine = new NullEngine();
  const teardownScene = new Scene(teardownEngine);
  let teardownDisposeCount = 0;
  const teardownLoader = async (spec, targetScene) => {
    const container = await loadLocalGlb(spec, targetScene, `${spec.id}-teardown`);
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
  assert(teardownRuntime.stats().cachedAssets === 0, "renderer teardown must synchronously drop Babylon runtime cache references before scene disposal");
  teardownScene.dispose();
  await Promise.resolve();
  assert(teardownDisposeCount === 1, `renderer teardown must leave source-container ownership to Babylon scene disposal, got ${teardownDisposeCount} disposals`);
  teardownEngine.dispose();
  console.log(
    `BABYLON_GRAPHICS_ASSETS_PASS operatorLod1=${operatorLod1.id} operatorLod2=${operatorLod2.id} refinery=${refineryLod1.id} flagshipFloor=${refineryFloorLod0.id} flagshipGrate=${refineryGrateLod0.id} flagshipBulkhead=${refineryBulkheadLod0.id} flagshipWall=${refineryWallPanelLod0.id} flagshipPipe=${refineryPipeRackLod0.id} flagshipCable=${refineryCableTrayLod0.id} localCodecs=true externalAtlas=${externalAtlasLoads} instancing=static-native cacheTrim=count+bytes cacheLoads=${[...loadCounts.values()].reduce((sum, count) => sum + count, 0)} teardownDispose=${teardownDisposeCount} webglContextRelease=true`
  );
}
void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
