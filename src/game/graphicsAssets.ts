export type GraphicsAssetClass = 'operator' | 'enemy' | 'boss' | 'weapon' | 'environment-module' | 'pickup' | 'interactable';
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

export type GraphicsAssetRuntimeBudget = {
  maxCachedCompressedBytes: number;
  maxTextureAnisotropy: 1 | 2 | 4;
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
    ktx2WorkerLimit: 2,
  },
  maxTextureDimension: {
    operator: 2048,
    enemy: 1024,
    boss: 2048,
    weapon: 1024,
    'environment-module': 1024,
    pickup: 512,
    interactable: 1024,
  },
  defaultBudgets: {
    operator: { triangles: 45_000, compressedBytes: 2_500_000 },
    enemy: { triangles: 30_000, compressedBytes: 1_500_000 },
    boss: { triangles: 60_000, compressedBytes: 3_500_000 },
    weapon: { triangles: 12_000, compressedBytes: 800_000 },
    'environment-module': { triangles: 20_000, compressedBytes: 1_200_000 },
    pickup: { triangles: 4_000, compressedBytes: 240_000 },
    interactable: { triangles: 8_000, compressedBytes: 480_000 },
  },
} as const;

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
