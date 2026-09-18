import { createGraphicsAssetSpec, type GraphicsAssetFamily } from './graphicsAssets';

// LOD1 is the articulated mobile gameplay model; LOD2 remains the ultra-light fallback.
// Hero-quality LOD0 will be added after the animation and socket contract is proven.
// Keeping only shipped files in the family guarantees adaptive selection falls back to a real asset.
export const OPERATOR_ASSET_FAMILY: GraphicsAssetFamily = {
  id: 'operator-field-suit',
  lods: {
    1: createGraphicsAssetSpec('operator-field-suit-lod1', 'operator', '/assets/models/operators/operator-field-suit-lod1.glb', 1),
    2: createGraphicsAssetSpec('operator-field-suit-lod2', 'operator', '/assets/models/operators/operator-field-suit-lod2.glb', 2),
  },
};

export const SHOWCASE_REFINERY_MODULE_FAMILY: GraphicsAssetFamily = {
  id: 'refinery-processing-module-a',
  lods: {
    0: createGraphicsAssetSpec('refinery-processing-module-a-lod0', 'environment-module', '/assets/models/environments/refinery-processing-module-a-lod0.glb', 0),
    1: createGraphicsAssetSpec('refinery-processing-module-a-lod1', 'environment-module', '/assets/models/environments/refinery-processing-module-a-lod1.glb', 1),
    2: createGraphicsAssetSpec('refinery-processing-module-a-lod2', 'environment-module', '/assets/models/environments/refinery-processing-module-a-lod2.glb', 2),
  },
};


export const ENEMY_ASSET_FAMILIES = {
  assault: {
    id: 'enemy-assault',
    lods: {
      1: createGraphicsAssetSpec('enemy-assault-lod1', 'enemy', '/assets/models/enemies/enemy-assault-lod1.glb', 1),
    },
  },
  suppressor: {
    id: 'enemy-suppressor',
    lods: {
      1: createGraphicsAssetSpec('enemy-suppressor-lod1', 'enemy', '/assets/models/enemies/enemy-suppressor-lod1.glb', 1),
    },
  },
  technician: {
    id: 'enemy-technician',
    lods: {
      1: createGraphicsAssetSpec('enemy-technician-lod1', 'enemy', '/assets/models/enemies/enemy-technician-lod1.glb', 1),
    },
  },
  elite: {
    id: 'enemy-elite',
    lods: {
      1: createGraphicsAssetSpec('enemy-elite-lod1', 'enemy', '/assets/models/enemies/enemy-elite-lod1.glb', 1),
    },
  },
  boss: {
    id: 'enemy-boss',
    lods: {
      1: createGraphicsAssetSpec('enemy-boss-lod1', 'boss', '/assets/models/bosses/enemy-boss-lod1.glb', 1),
    },
  },
} as const satisfies Record<'assault' | 'suppressor' | 'technician' | 'elite' | 'boss', GraphicsAssetFamily>;

export const WEAPON_ASSET_FAMILIES = {
  carbine: {
    id: 'weapon-carbine',
    lods: {
      1: createGraphicsAssetSpec('weapon-carbine-lod1', 'weapon', '/assets/models/weapons/weapon-carbine-lod1.glb', 1),
    },
  },
  breacher: {
    id: 'weapon-breacher',
    lods: {
      1: createGraphicsAssetSpec('weapon-breacher-lod1', 'weapon', '/assets/models/weapons/weapon-breacher-lod1.glb', 1),
    },
  },
  rail: {
    id: 'weapon-rail',
    lods: {
      1: createGraphicsAssetSpec('weapon-rail-lod1', 'weapon', '/assets/models/weapons/weapon-rail-lod1.glb', 1),
    },
  },
} as const satisfies Record<'carbine' | 'breacher' | 'rail', GraphicsAssetFamily>;

