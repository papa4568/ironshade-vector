import type { AnimationClip, BufferGeometry, Group, Material, Object3D, Skeleton, Texture, WebGLRenderer } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export type GraphicsAssetClass = 'operator' | 'enemy' | 'boss' | 'weapon' | 'environment-module';
export type GraphicsAssetLod = 0 | 1 | 2;

export type GraphicsAssetSpec = {
  id: string;
  assetClass: GraphicsAssetClass;
  url: string;
  lod: GraphicsAssetLod;
  triangleBudget: number;
  compressedByteBudget: number;
};

export type GraphicsAssetFamily = {
  id: string;
  lods: Partial<Record<GraphicsAssetLod, GraphicsAssetSpec>>;
};

export type GraphicsAssetInstance = {
  root: Group;
  animations: readonly AnimationClip[];
  release: () => void;
};

type GraphicsAssetCacheEntry = {
  promise: Promise<GLTF>;
  activeInstances: number;
  pendingDispose: boolean;
  disposePromise: Promise<void> | null;
};

export const GRAPHICS_ASSET_STANDARDS = {
  runtimeFormat: 'glb',
  unitScaleMeters: 1,
  upAxis: '+Y',
  forwardAxis: '+X',
  modelRoot: '/assets/models/',
  compression: {
    mesh: 'meshopt',
    texture: 'ktx2',
    ktx2TranscoderPath: '/assets/codecs/basis/',
    ktx2WorkerLimit: 2,
  },
  maxTextureDimension: {
    operator: 2048,
    enemy: 1024,
    boss: 2048,
    weapon: 1024,
    'environment-module': 1024,
  },
  defaultBudgets: {
    operator: { triangles: 45_000, compressedBytes: 2_500_000 },
    enemy: { triangles: 30_000, compressedBytes: 1_500_000 },
    boss: { triangles: 60_000, compressedBytes: 3_500_000 },
    weapon: { triangles: 12_000, compressedBytes: 800_000 },
    'environment-module': { triangles: 20_000, compressedBytes: 1_200_000 },
  },
} as const;

const gltfCache = new Map<string, GraphicsAssetCacheEntry>();
let graphicsRenderer: WebGLRenderer | null = null;
let rendererGeneration = 0;
let sharedKtx2Loader: KTX2Loader | null = null;
let sharedKtx2LoaderPromise: Promise<KTX2Loader> | null = null;

export function createGraphicsAssetSpec(
  id: string,
  assetClass: GraphicsAssetClass,
  url: string,
  lod: GraphicsAssetLod = 0,
): GraphicsAssetSpec {
  const budget = GRAPHICS_ASSET_STANDARDS.defaultBudgets[assetClass];
  return {
    id,
    assetClass,
    url,
    lod,
    triangleBudget: budget.triangles,
    compressedByteBudget: budget.compressedBytes,
  };
}

export function validateGraphicsAssetSpec(spec: GraphicsAssetSpec) {
  const issues: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.id)) issues.push('id must use lowercase kebab-case');
  if (!spec.url.startsWith(GRAPHICS_ASSET_STANDARDS.modelRoot)) issues.push(`url must live under ${GRAPHICS_ASSET_STANDARDS.modelRoot}`);
  if (!spec.url.toLowerCase().endsWith('.glb')) issues.push('runtime asset must be a .glb file');
  if (!spec.url.toLowerCase().endsWith(`-lod${spec.lod}.glb`)) issues.push(`url filename must end in -lod${spec.lod}.glb`);
  if (!Number.isFinite(spec.triangleBudget) || spec.triangleBudget <= 0) issues.push('triangleBudget must be positive');
  if (!Number.isFinite(spec.compressedByteBudget) || spec.compressedByteBudget <= 0) issues.push('compressedByteBudget must be positive');
  return issues;
}

export function graphicsAssetLodForDetailScale(detailScale: number): GraphicsAssetLod {
  if (!Number.isFinite(detailScale)) return 2;
  if (detailScale >= 0.9) return 0;
  if (detailScale >= 0.62) return 1;
  return 2;
}

export function selectGraphicsAssetSpec(family: GraphicsAssetFamily, detailScale: number): GraphicsAssetSpec | null {
  const preferred = graphicsAssetLodForDetailScale(detailScale);
  const order: Record<GraphicsAssetLod, GraphicsAssetLod[]> = {
    0: [0, 1, 2],
    1: [1, 2, 0],
    2: [2, 1, 0],
  };
  for (const lod of order[preferred]) {
    const spec = family.lods[lod];
    if (spec) return spec;
  }
  return null;
}

export function configureGraphicsAssetRenderer(renderer: WebGLRenderer) {
  if (graphicsRenderer === renderer) return;
  rendererGeneration += 1;
  graphicsRenderer = renderer;
  sharedKtx2Loader?.dispose();
  sharedKtx2Loader = null;
  sharedKtx2LoaderPromise = null;
}

async function getSharedKtx2Loader(renderer: WebGLRenderer) {
  if (sharedKtx2Loader) return sharedKtx2Loader;
  if (sharedKtx2LoaderPromise) return sharedKtx2LoaderPromise;

  const generation = rendererGeneration;
  const request = import('three/examples/jsm/loaders/KTX2Loader.js').then(({ KTX2Loader }) => {
    const loader = new KTX2Loader();
    loader
      .setTranscoderPath(GRAPHICS_ASSET_STANDARDS.compression.ktx2TranscoderPath)
      .setWorkerLimit(GRAPHICS_ASSET_STANDARDS.compression.ktx2WorkerLimit)
      .detectSupport(renderer);
    if (graphicsRenderer !== renderer || rendererGeneration !== generation) {
      loader.dispose();
      throw new Error('Graphics renderer changed while configuring KTX2 support');
    }
    sharedKtx2Loader = loader;
    return loader;
  });
  sharedKtx2LoaderPromise = request;
  try {
    return await request;
  } finally {
    if (sharedKtx2LoaderPromise === request) sharedKtx2LoaderPromise = null;
  }
}

async function createConfiguredGltfLoader() {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const renderer = graphicsRenderer;
  if (renderer) loader.setKTX2Loader(await getSharedKtx2Loader(renderer));
  return loader;
}

function assertValidSpec(spec: GraphicsAssetSpec) {
  const issues = validateGraphicsAssetSpec(spec);
  if (issues.length) throw new Error(`Invalid graphics asset ${spec.id}: ${issues.join('; ')}`);
}

function getOrCreateCacheEntry(spec: GraphicsAssetSpec) {
  assertValidSpec(spec);
  const cached = gltfCache.get(spec.url);
  if (cached && !cached.pendingDispose) return cached;

  let entry: GraphicsAssetCacheEntry;
  const promise = createConfiguredGltfLoader()
    .then(loader => loader.loadAsync(spec.url))
    .catch(error => {
      if (gltfCache.get(spec.url) === entry) gltfCache.delete(spec.url);
      throw error;
    });
  entry = {
    promise,
    activeInstances: 0,
    pendingDispose: false,
    disposePromise: null,
  };
  gltfCache.set(spec.url, entry);
  return entry;
}

function collectMaterialTextures(material: Material, textures: Set<Texture>) {
  for (const value of Object.values(material)) {
    if (!value || typeof value !== 'object') continue;
    const texture = value as Texture;
    if (texture.isTexture) textures.add(texture);
  }
}

function disposeLoadedGltf(gltf: GLTF) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<Skeleton>();
  const roots: Object3D[] = gltf.scenes.length > 0 ? gltf.scenes : [gltf.scene];

  for (const root of roots) {
    root.traverse(child => {
      const renderable = child as Object3D & {
        geometry?: BufferGeometry;
        material?: Material | Material[];
        skeleton?: Skeleton;
      };
      if (renderable.geometry) geometries.add(renderable.geometry);
      const material = renderable.material;
      if (Array.isArray(material)) material.forEach(item => materials.add(item));
      else if (material) materials.add(material);
      if (renderable.skeleton) skeletons.add(renderable.skeleton);
    });
  }

  materials.forEach(material => collectMaterialTextures(material, textures));
  skeletons.forEach(skeleton => skeleton.dispose());
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => {
    const image = texture.image as { close?: () => void } | undefined;
    if (typeof image?.close === 'function') image.close();
    texture.dispose();
  });
}

function disposeInstanceSkeletons(root: Object3D) {
  const skeletons = new Set<Skeleton>();
  root.traverse(child => {
    const skeleton = (child as Object3D & { skeleton?: Skeleton }).skeleton;
    if (skeleton) skeletons.add(skeleton);
  });
  skeletons.forEach(skeleton => skeleton.dispose());
}

function finalizeCacheEntry(entry: GraphicsAssetCacheEntry) {
  if (entry.disposePromise) return entry.disposePromise;
  entry.disposePromise = entry.promise.then(disposeLoadedGltf).catch(() => undefined);
  return entry.disposePromise;
}

function releaseCacheEntry(entry: GraphicsAssetCacheEntry) {
  entry.activeInstances = Math.max(0, entry.activeInstances - 1);
  if (entry.pendingDispose && entry.activeInstances === 0) void finalizeCacheEntry(entry);
}

export async function loadGraphicsAsset(spec: GraphicsAssetSpec): Promise<GLTF> {
  return getOrCreateCacheEntry(spec).promise;
}

export async function instantiateGraphicsAsset(spec: GraphicsAssetSpec): Promise<GraphicsAssetInstance> {
  const entry = getOrCreateCacheEntry(spec);
  entry.activeInstances += 1;
  try {
    const [gltf, { clone }] = await Promise.all([
      entry.promise,
      import('three/examples/jsm/utils/SkeletonUtils.js'),
    ]);
    const root = clone(gltf.scene) as Group;
    root.name = spec.id;
    let released = false;
    return {
      root,
      animations: gltf.animations,
      release: () => {
        if (released) return;
        released = true;
        root.removeFromParent();
        disposeInstanceSkeletons(root);
        releaseCacheEntry(entry);
      },
    };
  } catch (error) {
    releaseCacheEntry(entry);
    throw error;
  }
}

export function isGraphicsAssetCached(url: string) {
  const entry = gltfCache.get(url);
  return !!entry && !entry.pendingDispose;
}

export async function evictGraphicsAsset(url: string) {
  const entry = gltfCache.get(url);
  if (!entry) return false;
  gltfCache.delete(url);
  entry.pendingDispose = true;
  if (entry.activeInstances === 0) await finalizeCacheEntry(entry);
  return true;
}

export async function clearGraphicsAssetLoadCache() {
  const entries = [...gltfCache.values()];
  gltfCache.clear();
  await Promise.all(entries.map(entry => {
    entry.pendingDispose = true;
    return entry.activeInstances === 0 ? finalizeCacheEntry(entry) : Promise.resolve();
  }));
}

export async function disposeGraphicsAssetRuntime() {
  await clearGraphicsAssetLoadCache();
  rendererGeneration += 1;
  graphicsRenderer = null;
  sharedKtx2Loader?.dispose();
  sharedKtx2Loader = null;
  sharedKtx2LoaderPromise = null;
}
