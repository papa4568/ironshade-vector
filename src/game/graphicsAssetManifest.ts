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
      2: createGraphicsAssetSpec('operator-vanguard-lod2', 'operator', '/assets/models/operators/operator-vanguard-lod2.glb', 2),
    },
  },
  vector: {
    id: 'operator-vector',
    lods: {
      1: createGraphicsAssetSpec('operator-vector-lod1', 'operator', '/assets/models/operators/operator-vector-lod1.glb', 1),
      2: createGraphicsAssetSpec('operator-vector-lod2', 'operator', '/assets/models/operators/operator-vector-lod2.glb', 2),
    },
  },
  systems: {
    id: 'operator-systems',
    lods: {
      1: createGraphicsAssetSpec('operator-systems-lod1', 'operator', '/assets/models/operators/operator-systems-lod1.glb', 1),
      2: createGraphicsAssetSpec('operator-systems-lod2', 'operator', '/assets/models/operators/operator-systems-lod2.glb', 2),
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



export const SPIN_HABITAT_ASSET_FAMILIES = {
  ringSegment: {
    id: 'spin-habitat-ring-segment',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-ring-segment-lod1', 'environment-module', '/assets/models/environments/spin-habitat-ring-segment-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-ring-segment-lod2', 'environment-module', '/assets/models/environments/spin-habitat-ring-segment-lod2.glb', 2),
    },
  },
  spokeTruss: {
    id: 'spin-habitat-spoke-truss',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-spoke-truss-lod1', 'environment-module', '/assets/models/environments/spin-habitat-spoke-truss-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-spoke-truss-lod2', 'environment-module', '/assets/models/environments/spin-habitat-spoke-truss-lod2.glb', 2),
    },
  },
  axisHub: {
    id: 'spin-habitat-axis-hub',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-axis-hub-lod1', 'environment-module', '/assets/models/environments/spin-habitat-axis-hub-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-axis-hub-lod2', 'environment-module', '/assets/models/environments/spin-habitat-axis-hub-lod2.glb', 2),
    },
  },
  serviceBay: {
    id: 'spin-habitat-service-bay',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-service-bay-lod1', 'environment-module', '/assets/models/environments/spin-habitat-service-bay-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-service-bay-lod2', 'environment-module', '/assets/models/environments/spin-habitat-service-bay-lod2.glb', 2),
    },
  },
} as const satisfies Record<'ringSegment' | 'spokeTruss' | 'axisHub' | 'serviceBay', GraphicsAssetFamily>;

export const JOVIAN_HARVESTER_ASSET_FAMILIES = {
  deckSpan: {
    id: 'jovian-harvester-deck-span',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-deck-span-lod1', 'environment-module', '/assets/models/environments/jovian-harvester-deck-span-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-deck-span-lod2', 'environment-module', '/assets/models/environments/jovian-harvester-deck-span-lod2.glb', 2),
    },
  },
  skimmerTower: {
    id: 'jovian-harvester-skimmer-tower',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-skimmer-tower-lod1', 'environment-module', '/assets/models/environments/jovian-harvester-skimmer-tower-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-skimmer-tower-lod2', 'environment-module', '/assets/models/environments/jovian-harvester-skimmer-tower-lod2.glb', 2),
    },
  },
  transferBridge: {
    id: 'jovian-harvester-transfer-bridge',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-transfer-bridge-lod1', 'environment-module', '/assets/models/environments/jovian-harvester-transfer-bridge-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-transfer-bridge-lod2', 'environment-module', '/assets/models/environments/jovian-harvester-transfer-bridge-lod2.glb', 2),
    },
  },
  ballastPod: {
    id: 'jovian-harvester-ballast-pod',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-ballast-pod-lod1', 'environment-module', '/assets/models/environments/jovian-harvester-ballast-pod-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-ballast-pod-lod2', 'environment-module', '/assets/models/environments/jovian-harvester-ballast-pod-lod2.glb', 2),
    },
  },
} as const satisfies Record<'deckSpan' | 'skimmerTower' | 'transferBridge' | 'ballastPod', GraphicsAssetFamily>;

export const PARALLAX_ASSET_FAMILIES = {
  pylon: {
    id: 'parallax-baseline-pylon',
    lods: {
      1: createGraphicsAssetSpec('parallax-baseline-pylon-lod1', 'environment-module', '/assets/models/environments/parallax-baseline-pylon-lod1.glb', 1),
      2: createGraphicsAssetSpec('parallax-baseline-pylon-lod2', 'environment-module', '/assets/models/environments/parallax-baseline-pylon-lod2.glb', 2),
    },
  },
  frame: {
    id: 'parallax-reference-frame',
    lods: {
      1: createGraphicsAssetSpec('parallax-reference-frame-lod1', 'environment-module', '/assets/models/environments/parallax-reference-frame-lod1.glb', 1),
      2: createGraphicsAssetSpec('parallax-reference-frame-lod2', 'environment-module', '/assets/models/environments/parallax-reference-frame-lod2.glb', 2),
    },
  },
  massCarriage: {
    id: 'parallax-mass-carriage',
    lods: {
      1: createGraphicsAssetSpec('parallax-mass-carriage-lod1', 'environment-module', '/assets/models/environments/parallax-mass-carriage-lod1.glb', 1),
      2: createGraphicsAssetSpec('parallax-mass-carriage-lod2', 'environment-module', '/assets/models/environments/parallax-mass-carriage-lod2.glb', 2),
    },
  },
  shearAnchor: {
    id: 'parallax-shear-anchor',
    lods: {
      1: createGraphicsAssetSpec('parallax-shear-anchor-lod1', 'environment-module', '/assets/models/environments/parallax-shear-anchor-lod1.glb', 1),
      2: createGraphicsAssetSpec('parallax-shear-anchor-lod2', 'environment-module', '/assets/models/environments/parallax-shear-anchor-lod2.glb', 2),
    },
  },
  console: {
    id: 'parallax-reference-console',
    lods: {
      1: createGraphicsAssetSpec('parallax-reference-console-lod1', 'environment-module', '/assets/models/environments/parallax-reference-console-lod1.glb', 1),
      2: createGraphicsAssetSpec('parallax-reference-console-lod2', 'environment-module', '/assets/models/environments/parallax-reference-console-lod2.glb', 2),
    },
  },
} as const satisfies Record<'pylon' | 'frame' | 'massCarriage' | 'shearAnchor' | 'console', GraphicsAssetFamily>;

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


export const SPIN_HABITAT_ENEMY_ASSET_FAMILIES = {
  marksman: {
    id: 'spin-habitat-spoke-marksman',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-spoke-marksman-lod1', 'enemy', '/assets/models/enemies/spin-habitat-spoke-marksman-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-spoke-marksman-lod2', 'enemy', '/assets/models/enemies/spin-habitat-spoke-marksman-lod2.glb', 2),
    },
  },
  gravitySpecialist: {
    id: 'spin-habitat-spin-trim-specialist',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-spin-trim-specialist-lod1', 'enemy', '/assets/models/enemies/spin-habitat-spin-trim-specialist-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-spin-trim-specialist-lod2', 'enemy', '/assets/models/enemies/spin-habitat-spin-trim-specialist-lod2.glb', 2),
    },
  },
  droneCarrier: {
    id: 'spin-habitat-ring-drone-carrier',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-ring-drone-carrier-lod1', 'enemy', '/assets/models/enemies/spin-habitat-ring-drone-carrier-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-ring-drone-carrier-lod2', 'enemy', '/assets/models/enemies/spin-habitat-ring-drone-carrier-lod2.glb', 2),
    },
  },
  shieldBoarder: {
    id: 'spin-habitat-axis-shield-boarder',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-axis-shield-boarder-lod1', 'enemy', '/assets/models/enemies/spin-habitat-axis-shield-boarder-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-axis-shield-boarder-lod2', 'enemy', '/assets/models/enemies/spin-habitat-axis-shield-boarder-lod2.glb', 2),
    },
  },
} as const satisfies Record<'marksman' | 'gravitySpecialist' | 'droneCarrier' | 'shieldBoarder', GraphicsAssetFamily>;


export const SPIN_HABITAT_BOSS_ASSET_FAMILY: GraphicsAssetFamily = {
  id: 'spin-habitat-sable-voss',
  lods: {
    1: createGraphicsAssetSpec('spin-habitat-sable-voss-lod1', 'enemy', '/assets/models/bosses/spin-habitat-sable-voss-lod1.glb', 1),
    2: createGraphicsAssetSpec('spin-habitat-sable-voss-lod2', 'enemy', '/assets/models/bosses/spin-habitat-sable-voss-lod2.glb', 2),
  },
};

export const ENEMY_ASSET_FAMILIES = {
  assault: {
    id: 'enemy-assault',
    lods: {
      1: createGraphicsAssetSpec('enemy-assault-lod1', 'enemy', '/assets/models/enemies/enemy-assault-lod1.glb', 1),
      2: createGraphicsAssetSpec('enemy-assault-lod2', 'enemy', '/assets/models/enemies/enemy-assault-lod2.glb', 2),
    },
  },
  suppressor: {
    id: 'enemy-suppressor',
    lods: {
      1: createGraphicsAssetSpec('enemy-suppressor-lod1', 'enemy', '/assets/models/enemies/enemy-suppressor-lod1.glb', 1),
      2: createGraphicsAssetSpec('enemy-suppressor-lod2', 'enemy', '/assets/models/enemies/enemy-suppressor-lod2.glb', 2),
    },
  },
  technician: {
    id: 'enemy-technician',
    lods: {
      1: createGraphicsAssetSpec('enemy-technician-lod1', 'enemy', '/assets/models/enemies/enemy-technician-lod1.glb', 1),
      2: createGraphicsAssetSpec('enemy-technician-lod2', 'enemy', '/assets/models/enemies/enemy-technician-lod2.glb', 2),
    },
  },
  elite: {
    id: 'enemy-elite',
    lods: {
      1: createGraphicsAssetSpec('enemy-elite-lod1', 'enemy', '/assets/models/enemies/enemy-elite-lod1.glb', 1),
      2: createGraphicsAssetSpec('enemy-elite-lod2', 'enemy', '/assets/models/enemies/enemy-elite-lod2.glb', 2),
    },
  },
  boss: {
    id: 'enemy-boss',
    lods: {
      1: createGraphicsAssetSpec('enemy-boss-lod1', 'boss', '/assets/models/bosses/enemy-boss-lod1.glb', 1),
      2: createGraphicsAssetSpec('enemy-boss-lod2', 'boss', '/assets/models/bosses/enemy-boss-lod2.glb', 2),
    },
  },
} as const satisfies Record<'assault' | 'suppressor' | 'technician' | 'elite' | 'boss', GraphicsAssetFamily>;

export const WEAPON_ASSET_FAMILIES = {
  carbine: {
    id: 'weapon-carbine',
    lods: {
      1: createGraphicsAssetSpec('weapon-carbine-lod1', 'weapon', '/assets/models/weapons/weapon-carbine-lod1.glb', 1),
      2: createGraphicsAssetSpec('weapon-carbine-lod2', 'weapon', '/assets/models/weapons/weapon-carbine-lod2.glb', 2),
    },
  },
  breacher: {
    id: 'weapon-breacher',
    lods: {
      1: createGraphicsAssetSpec('weapon-breacher-lod1', 'weapon', '/assets/models/weapons/weapon-breacher-lod1.glb', 1),
      2: createGraphicsAssetSpec('weapon-breacher-lod2', 'weapon', '/assets/models/weapons/weapon-breacher-lod2.glb', 2),
    },
  },
  rail: {
    id: 'weapon-rail',
    lods: {
      1: createGraphicsAssetSpec('weapon-rail-lod1', 'weapon', '/assets/models/weapons/weapon-rail-lod1.glb', 1),
      2: createGraphicsAssetSpec('weapon-rail-lod2', 'weapon', '/assets/models/weapons/weapon-rail-lod2.glb', 2),
    },
  },
} as const satisfies Record<'carbine' | 'breacher' | 'rail', GraphicsAssetFamily>;



export const PICKUP_ASSET_FAMILY: GraphicsAssetFamily = {
  id: 'pickup-recovery-capsule',
  lods: {
    1: createGraphicsAssetSpec('pickup-recovery-capsule-lod1', 'pickup', '/assets/models/pickups/pickup-recovery-capsule-lod1.glb', 1),
    2: createGraphicsAssetSpec('pickup-recovery-capsule-lod2', 'pickup', '/assets/models/pickups/pickup-recovery-capsule-lod2.glb', 2),
  },
};

export const SPIN_HABITAT_INTERACTABLE_ASSET_FAMILIES = {
  spinBusIsolator: {
    id: 'spin-habitat-spin-bus-isolator',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-spin-bus-isolator-lod1', 'interactable', '/assets/models/interactables/spin-habitat-spin-bus-isolator-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-spin-bus-isolator-lod2', 'interactable', '/assets/models/interactables/spin-habitat-spin-bus-isolator-lod2.glb', 2),
    },
  },
  gravityTrim: {
    id: 'spin-habitat-gravity-trim',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-gravity-trim-lod1', 'interactable', '/assets/models/interactables/spin-habitat-gravity-trim-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-gravity-trim-lod2', 'interactable', '/assets/models/interactables/spin-habitat-gravity-trim-lod2.glb', 2),
    },
  },
  bearingControl: {
    id: 'spin-habitat-bearing-control',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-bearing-control-lod1', 'interactable', '/assets/models/interactables/spin-habitat-bearing-control-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-bearing-control-lod2', 'interactable', '/assets/models/interactables/spin-habitat-bearing-control-lod2.glb', 2),
    },
  },
  attitudeFlywheel: {
    id: 'spin-habitat-attitude-flywheel',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-attitude-flywheel-lod1', 'interactable', '/assets/models/interactables/spin-habitat-attitude-flywheel-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-attitude-flywheel-lod2', 'interactable', '/assets/models/interactables/spin-habitat-attitude-flywheel-lod2.glb', 2),
    },
  },
  pressureLock: {
    id: 'spin-habitat-pressure-lock',
    lods: {
      1: createGraphicsAssetSpec('spin-habitat-pressure-lock-lod1', 'interactable', '/assets/models/interactables/spin-habitat-pressure-lock-lod1.glb', 1),
      2: createGraphicsAssetSpec('spin-habitat-pressure-lock-lod2', 'interactable', '/assets/models/interactables/spin-habitat-pressure-lock-lod2.glb', 2),
    },
  },
} as const satisfies Record<'spinBusIsolator' | 'gravityTrim' | 'bearingControl' | 'attitudeFlywheel' | 'pressureLock', GraphicsAssetFamily>;

export const JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES = {
  stormBusIsolator: {
    id: 'jovian-harvester-storm-bus-isolator',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-storm-bus-isolator-lod1', 'interactable', '/assets/models/interactables/jovian-harvester-storm-bus-isolator-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-storm-bus-isolator-lod2', 'interactable', '/assets/models/interactables/jovian-harvester-storm-bus-isolator-lod2.glb', 2),
    },
  },
  deckMassTrim: {
    id: 'jovian-harvester-deck-mass-trim',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-deck-mass-trim-lod1', 'interactable', '/assets/models/interactables/jovian-harvester-deck-mass-trim-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-deck-mass-trim-lod2', 'interactable', '/assets/models/interactables/jovian-harvester-deck-mass-trim-lod2.glb', 2),
    },
  },
  skimmerCompressor: {
    id: 'jovian-harvester-skimmer-compressor',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-skimmer-compressor-lod1', 'interactable', '/assets/models/interactables/jovian-harvester-skimmer-compressor-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-skimmer-compressor-lod2', 'interactable', '/assets/models/interactables/jovian-harvester-skimmer-compressor-lod2.glb', 2),
    },
  },
  separatorPackage: {
    id: 'jovian-harvester-separator-package',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-separator-package-lod1', 'interactable', '/assets/models/interactables/jovian-harvester-separator-package-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-separator-package-lod2', 'interactable', '/assets/models/interactables/jovian-harvester-separator-package-lod2.glb', 2),
    },
  },
} as const satisfies Record<'stormBusIsolator' | 'deckMassTrim' | 'skimmerCompressor' | 'separatorPackage', GraphicsAssetFamily>;

export const INTERACTABLE_ASSET_FAMILIES = {
  control: {
    id: 'interactable-control-terminal',
    lods: {
      1: createGraphicsAssetSpec('interactable-control-terminal-lod1', 'interactable', '/assets/models/interactables/interactable-control-terminal-lod1.glb', 1),
      2: createGraphicsAssetSpec('interactable-control-terminal-lod2', 'interactable', '/assets/models/interactables/interactable-control-terminal-lod2.glb', 2),
    },
  },
  salvage: {
    id: 'interactable-salvage-tag-node',
    lods: {
      1: createGraphicsAssetSpec('interactable-salvage-tag-node-lod1', 'interactable', '/assets/models/interactables/interactable-salvage-tag-node-lod1.glb', 1),
      2: createGraphicsAssetSpec('interactable-salvage-tag-node-lod2', 'interactable', '/assets/models/interactables/interactable-salvage-tag-node-lod2.glb', 2),
    },
  },
} as const satisfies Record<'control' | 'salvage', GraphicsAssetFamily>;
