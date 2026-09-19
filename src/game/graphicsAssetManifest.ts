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

export const OPERATOR_CLASS_ASSET_FAMILIES = {
  vanguard: {
    id: 'operator-vanguard',
    lods: {
      1: createGraphicsAssetSpec('operator-vanguard-lod1', 'operator', '/assets/models/operators/operator-vanguard-lod1.glb', 1),
      2: createGraphicsAssetSpec('operator-field-suit-lod2', 'operator', '/assets/models/operators/operator-field-suit-lod2.glb', 2),
    },
  },
  vector: {
    id: 'operator-vector',
    lods: {
      1: createGraphicsAssetSpec('operator-vector-lod1', 'operator', '/assets/models/operators/operator-vector-lod1.glb', 1),
      2: createGraphicsAssetSpec('operator-field-suit-lod2', 'operator', '/assets/models/operators/operator-field-suit-lod2.glb', 2),
    },
  },
  systems: {
    id: 'operator-systems',
    lods: {
      1: createGraphicsAssetSpec('operator-systems-lod1', 'operator', '/assets/models/operators/operator-systems-lod1.glb', 1),
      2: createGraphicsAssetSpec('operator-field-suit-lod2', 'operator', '/assets/models/operators/operator-field-suit-lod2.glb', 2),
    },
  },
} as const satisfies Record<'vanguard' | 'vector' | 'systems', GraphicsAssetFamily>;

export const DAMAGED_VESSEL_ASSET_FAMILIES = {
  rib: {
    id: 'damaged-vessel-broken-rib',
    lods: {
      1: createGraphicsAssetSpec('damaged-vessel-broken-rib-lod1', 'environment-module', '/assets/models/environments/damaged-vessel-broken-rib-lod1.glb', 1),
      2: createGraphicsAssetSpec('damaged-vessel-broken-rib-lod2', 'environment-module', '/assets/models/environments/damaged-vessel-broken-rib-lod2.glb', 2),
    },
  },
  breachFrame: {
    id: 'damaged-vessel-breach-frame',
    lods: {
      1: createGraphicsAssetSpec('damaged-vessel-breach-frame-lod1', 'environment-module', '/assets/models/environments/damaged-vessel-breach-frame-lod1.glb', 1),
      2: createGraphicsAssetSpec('damaged-vessel-breach-frame-lod2', 'environment-module', '/assets/models/environments/damaged-vessel-breach-frame-lod2.glb', 2),
    },
  },
  salvageRack: {
    id: 'damaged-vessel-salvage-rack',
    lods: {
      1: createGraphicsAssetSpec('damaged-vessel-salvage-rack-lod1', 'environment-module', '/assets/models/environments/damaged-vessel-salvage-rack-lod1.glb', 1),
      2: createGraphicsAssetSpec('damaged-vessel-salvage-rack-lod2', 'environment-module', '/assets/models/environments/damaged-vessel-salvage-rack-lod2.glb', 2),
    },
  },
  tornPlate: {
    id: 'damaged-vessel-torn-wall-plate',
    lods: {
      1: createGraphicsAssetSpec('damaged-vessel-torn-wall-plate-lod1', 'environment-module', '/assets/models/environments/damaged-vessel-torn-wall-plate-lod1.glb', 1),
      2: createGraphicsAssetSpec('damaged-vessel-torn-wall-plate-lod2', 'environment-module', '/assets/models/environments/damaged-vessel-torn-wall-plate-lod2.glb', 2),
    },
  },
  serviceBundle: {
    id: 'damaged-vessel-service-bundle',
    lods: {
      1: createGraphicsAssetSpec('damaged-vessel-service-bundle-lod1', 'environment-module', '/assets/models/environments/damaged-vessel-service-bundle-lod1.glb', 1),
      2: createGraphicsAssetSpec('damaged-vessel-service-bundle-lod2', 'environment-module', '/assets/models/environments/damaged-vessel-service-bundle-lod2.glb', 2),
    },
  },
} as const satisfies Record<'rib' | 'breachFrame' | 'salvageRack' | 'tornPlate' | 'serviceBundle', GraphicsAssetFamily>;

export const REFINERY_ASSET_FAMILIES = {
  floor: {
    id: 'refinery-floor-panel',
    lods: {
      1: createGraphicsAssetSpec('refinery-floor-panel-lod1', 'environment-module', '/assets/models/environments/refinery-floor-panel-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-floor-panel-lod2', 'environment-module', '/assets/models/environments/refinery-floor-panel-lod2.glb', 2),
    },
  },
  floorGrate: {
    id: 'refinery-floor-service-grate',
    lods: {
      1: createGraphicsAssetSpec('refinery-floor-service-grate-lod1', 'environment-module', '/assets/models/environments/refinery-floor-service-grate-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-floor-service-grate-lod2', 'environment-module', '/assets/models/environments/refinery-floor-service-grate-lod2.glb', 2),
    },
  },
  bulkhead: {
    id: 'refinery-bulkhead',
    lods: {
      1: createGraphicsAssetSpec('refinery-bulkhead-lod1', 'environment-module', '/assets/models/environments/refinery-bulkhead-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-bulkhead-lod2', 'environment-module', '/assets/models/environments/refinery-bulkhead-lod2.glb', 2),
    },
  },
  processor: {
    id: 'refinery-processor',
    lods: {
      1: createGraphicsAssetSpec('refinery-processor-lod1', 'environment-module', '/assets/models/environments/refinery-processor-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-processor-lod2', 'environment-module', '/assets/models/environments/refinery-processor-lod2.glb', 2),
    },
  },
  pipeRack: {
    id: 'refinery-pipe-rack',
    lods: {
      1: createGraphicsAssetSpec('refinery-pipe-rack-lod1', 'environment-module', '/assets/models/environments/refinery-pipe-rack-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-pipe-rack-lod2', 'environment-module', '/assets/models/environments/refinery-pipe-rack-lod2.glb', 2),
    },
  },
  wallPanel: {
    id: 'refinery-wall-service-panel',
    lods: {
      1: createGraphicsAssetSpec('refinery-wall-service-panel-lod1', 'environment-module', '/assets/models/environments/refinery-wall-service-panel-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-wall-service-panel-lod2', 'environment-module', '/assets/models/environments/refinery-wall-service-panel-lod2.glb', 2),
    },
  },
  cableTray: {
    id: 'refinery-cable-tray',
    lods: {
      1: createGraphicsAssetSpec('refinery-cable-tray-lod1', 'environment-module', '/assets/models/environments/refinery-cable-tray-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-cable-tray-lod2', 'environment-module', '/assets/models/environments/refinery-cable-tray-lod2.glb', 2),
    },
  },
  serviceConduit: {
    id: 'refinery-service-conduit',
    lods: {
      1: createGraphicsAssetSpec('refinery-service-conduit-lod1', 'environment-module', '/assets/models/environments/refinery-service-conduit-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-service-conduit-lod2', 'environment-module', '/assets/models/environments/refinery-service-conduit-lod2.glb', 2),
    },
  },
  gantry: {
    id: 'refinery-smelter-gantry',
    lods: {
      1: createGraphicsAssetSpec('refinery-smelter-gantry-lod1', 'environment-module', '/assets/models/environments/refinery-smelter-gantry-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-smelter-gantry-lod2', 'environment-module', '/assets/models/environments/refinery-smelter-gantry-lod2.glb', 2),
    },
  },
  crate: {
    id: 'refinery-crate',
    lods: {
      1: createGraphicsAssetSpec('refinery-crate-lod1', 'environment-module', '/assets/models/environments/refinery-crate-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-crate-lod2', 'environment-module', '/assets/models/environments/refinery-crate-lod2.glb', 2),
    },
  },
  terminal: {
    id: 'refinery-terminal',
    lods: {
      1: createGraphicsAssetSpec('refinery-terminal-lod1', 'environment-module', '/assets/models/environments/refinery-terminal-lod1.glb', 1),
      2: createGraphicsAssetSpec('refinery-terminal-lod2', 'environment-module', '/assets/models/environments/refinery-terminal-lod2.glb', 2),
    },
  },
} as const satisfies Record<'floor' | 'floorGrate' | 'bulkhead' | 'processor' | 'pipeRack' | 'wallPanel' | 'cableTray' | 'serviceConduit' | 'gantry' | 'crate' | 'terminal', GraphicsAssetFamily>;

export const SHOWCASE_REFINERY_MODULE_FAMILY: GraphicsAssetFamily = REFINERY_ASSET_FAMILIES.processor;


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

