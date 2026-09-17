import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

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

export const GRAPHICS_ASSET_STANDARDS = {
  runtimeFormat: 'glb',
  unitScaleMeters: 1,
  upAxis: '+Y',
  forwardAxis: '+X',
  modelRoot: '/assets/models/',
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

const gltfCache = new Map<string, Promise<GLTF>>();

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
  if (!Number.isFinite(spec.triangleBudget) || spec.triangleBudget <= 0) issues.push('triangleBudget must be positive');
  if (!Number.isFinite(spec.compressedByteBudget) || spec.compressedByteBudget <= 0) issues.push('compressedByteBudget must be positive');
  return issues;
}

export async function loadGraphicsAsset(spec: GraphicsAssetSpec): Promise<GLTF> {
  const issues = validateGraphicsAssetSpec(spec);
  if (issues.length) throw new Error(`Invalid graphics asset ${spec.id}: ${issues.join('; ')}`);

  const cached = gltfCache.get(spec.url);
  if (cached) return cached;

  const request = import('three/examples/jsm/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(spec.url))
    .catch(error => {
      gltfCache.delete(spec.url);
      throw error;
    });

  gltfCache.set(spec.url, request);
  return request;
}

export function isGraphicsAssetCached(url: string) {
  return gltfCache.has(url);
}

export function clearGraphicsAssetLoadCache() {
  gltfCache.clear();
}
