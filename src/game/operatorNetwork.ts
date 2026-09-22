import type { OperatorClassId } from './classSkills';
import type { WeaponId } from './sim';

export const OPERATOR_NETWORK_SCHEMA_VERSION = 1 as const;

export const operatorNetworkBranches = ['Ballistics', 'Mobility', 'Systems', 'Survival', 'Engineering', 'Awareness'] as const;
export type OperatorNetworkBranch = typeof operatorNetworkBranches[number];
export type OperatorNetworkNodeKind = 'class-start' | 'travel' | 'standard' | 'notable' | 'mastery' | 'keystone' | 'capstone';
export type OperatorNetworkSector = 'origin' | 'core' | 'outer';

export type OperatorNetworkStatId =
  | 'weapon-damage-mul'
  | 'weapon-projectile-speed-mul'
  | 'weapon-penetration-add'
  | 'weapon-recoil-mul'
  | 'weapon-heat-dissipation-mul'
  | 'weapon-magazine-add'
  | 'weapon-reload-mul'
  | 'weapon-armor-damage-mul'
  | 'weapon-knockback-mul'
  | 'player-max-hp-add'
  | 'player-max-armor-add'
  | 'player-max-cap-add'
  | 'player-move-speed-mul'
  | 'player-cap-regen-mul'
  | 'player-vacuum-resistance-add'
  | 'player-low-g-control-add'
  | 'player-vent-speed-mul'
  | 'ability-cost-mul'
  | 'ability-cooldown-mul'
  | 'ability-power-mul'
  | 'class-skill-power-mul'
  | 'class-skill-range-mul'
  | 'class-skill-control-mul'
  | 'class-skill-armor-mul'
  | 'class-skill-recovery-mul'
  | 'class-skill-cost-mul';

export type OperatorNetworkStatEffect = {
  stat: OperatorNetworkStatId;
  value: number;
  weapon?: WeaponId;
};

export type OperatorNetworkNode = {
  id: string;
  kind: OperatorNetworkNodeKind;
  branch: OperatorNetworkBranch | 'Origin';
  name: string;
  description: string;
  allocationCost: number;
  prerequisiteIds: string[];
  sector: OperatorNetworkSector;
  classStart?: OperatorClassId;
  weaponFamily?: WeaponId;
  effects?: OperatorNetworkStatEffect[];
  legacyMajor?: boolean;
  legacyRequires?: string;
};

export type OperatorNetworkEdge = {
  a: string;
  b: string;
  route: 'class-start' | 'branch' | 'outer-ring';
};

export type OperatorNetworkState = {
  schemaVersion: typeof OPERATOR_NETWORK_SCHEMA_VERSION;
  startNodeId: string;
  allocatedNodeIds: string[];
  unspentPoints: number;
};

export type OperatorNetworkRoute = {
  nodeIds: string[];
  pointCost: number;
};

const classStartNodeIds: Record<OperatorClassId, string> = {
  vanguard: 'start-vanguard',
  vector: 'start-vector',
  systems: 'start-systems',
};

const coreWaveNodes: OperatorNetworkNode[] = [
  { id: 'ballistics-vectoring-lane', kind: 'travel', branch: 'Ballistics', name: 'Vectoring Lane', description: '+4 projectile penetration across the active arsenal.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'weapon-penetration-add', value: 4 }] },
  { id: 'ballistics-bore-map', kind: 'standard', branch: 'Ballistics', name: 'Bore Map', description: '+3% weapon damage from tighter terminal calibration.', allocationCost: 1, prerequisiteIds: ['ballistics-vectoring-lane'], sector: 'core', effects: [{ stat: 'weapon-damage-mul', value: 1.03 }] },
  { id: 'ballistics-terminal-geometry', kind: 'notable', branch: 'Ballistics', name: 'Terminal Geometry', description: '+6% projectile velocity and +6% armor damage.', allocationCost: 1, prerequisiteIds: ['ballistics-bore-map'], sector: 'core', effects: [{ stat: 'weapon-projectile-speed-mul', value: 1.06 }, { stat: 'weapon-armor-damage-mul', value: 1.06 }] },
  { id: 'ballistics-impact-lane', kind: 'travel', branch: 'Ballistics', name: 'Impact Lane', description: '+4% armor damage through denser impact planning.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'weapon-armor-damage-mul', value: 1.04 }] },
  { id: 'ballistics-kinetic-budget', kind: 'standard', branch: 'Ballistics', name: 'Kinetic Budget', description: '+4% weapon damage.', allocationCost: 1, prerequisiteIds: ['ballistics-impact-lane'], sector: 'core', effects: [{ stat: 'weapon-damage-mul', value: 1.04 }] },
  { id: 'ballistics-dense-salvo', kind: 'notable', branch: 'Ballistics', name: 'Dense Salvo', description: '+8 penetration and +5% weapon damage.', allocationCost: 1, prerequisiteIds: ['ballistics-kinetic-budget'], sector: 'core', effects: [{ stat: 'weapon-penetration-add', value: 8 }, { stat: 'weapon-damage-mul', value: 1.05 }] },

  { id: 'mobility-servo-lane', kind: 'travel', branch: 'Mobility', name: 'Servo Lane', description: '+2% movement speed.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'player-move-speed-mul', value: 1.02 }] },
  { id: 'mobility-countermass-timing', kind: 'standard', branch: 'Mobility', name: 'Countermass Timing', description: '-4% weapon recoil.', allocationCost: 1, prerequisiteIds: ['mobility-servo-lane'], sector: 'core', effects: [{ stat: 'weapon-recoil-mul', value: 0.96 }] },
  { id: 'mobility-vector-recovery', kind: 'notable', branch: 'Mobility', name: 'Vector Recovery', description: '+3% movement speed and 6% faster reloads.', allocationCost: 1, prerequisiteIds: ['mobility-countermass-timing'], sector: 'core', effects: [{ stat: 'player-move-speed-mul', value: 1.03 }, { stat: 'weapon-reload-mul', value: 0.94 }] },
  { id: 'mobility-impulse-lane', kind: 'travel', branch: 'Mobility', name: 'Impulse Lane', description: '+0.06 low-g control.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'player-low-g-control-add', value: 0.06 }] },
  { id: 'mobility-brake-sense', kind: 'standard', branch: 'Mobility', name: 'Brake Sense', description: '-4% weapon recoil and +0.05 low-g control.', allocationCost: 1, prerequisiteIds: ['mobility-impulse-lane'], sector: 'core', effects: [{ stat: 'weapon-recoil-mul', value: 0.96 }, { stat: 'player-low-g-control-add', value: 0.05 }] },
  { id: 'mobility-transit-window', kind: 'notable', branch: 'Mobility', name: 'Transit Window', description: '+3% movement speed and +4% class-skill recovery.', allocationCost: 1, prerequisiteIds: ['mobility-brake-sense'], sector: 'core', effects: [{ stat: 'player-move-speed-mul', value: 1.03 }, { stat: 'class-skill-recovery-mul', value: 1.04 }] },

  { id: 'systems-capacitor-lane', kind: 'travel', branch: 'Systems', name: 'Capacitor Lane', description: '+3 maximum capacitor.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'player-max-cap-add', value: 3 }] },
  { id: 'systems-charge-recovery', kind: 'standard', branch: 'Systems', name: 'Charge Recovery', description: '+5% capacitor regeneration.', allocationCost: 1, prerequisiteIds: ['systems-capacitor-lane'], sector: 'core', effects: [{ stat: 'player-cap-regen-mul', value: 1.05 }] },
  { id: 'systems-closed-budget', kind: 'notable', branch: 'Systems', name: 'Closed Budget', description: '-4% ability capacitor cost.', allocationCost: 1, prerequisiteIds: ['systems-charge-recovery'], sector: 'core', effects: [{ stat: 'ability-cost-mul', value: 0.96 }] },
  { id: 'systems-cycle-lane', kind: 'travel', branch: 'Systems', name: 'Cycle Lane', description: '+2 maximum capacitor.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'player-max-cap-add', value: 2 }] },
  { id: 'systems-fast-switching', kind: 'standard', branch: 'Systems', name: 'Fast Switching', description: '4% faster ability recovery.', allocationCost: 1, prerequisiteIds: ['systems-cycle-lane'], sector: 'core', effects: [{ stat: 'ability-cooldown-mul', value: 0.96 }] },
  { id: 'systems-reserve-loop', kind: 'notable', branch: 'Systems', name: 'Reserve Loop', description: '+6% capacitor regeneration and +3% class-skill recovery.', allocationCost: 1, prerequisiteIds: ['systems-fast-switching'], sector: 'core', effects: [{ stat: 'player-cap-regen-mul', value: 1.06 }, { stat: 'class-skill-recovery-mul', value: 1.03 }] },

  { id: 'survival-plating-lane', kind: 'travel', branch: 'Survival', name: 'Plating Lane', description: '+4 maximum health.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'player-max-hp-add', value: 4 }] },
  { id: 'survival-spall-layer', kind: 'standard', branch: 'Survival', name: 'Spall Layer', description: '+6 maximum armor.', allocationCost: 1, prerequisiteIds: ['survival-plating-lane'], sector: 'core', effects: [{ stat: 'player-max-armor-add', value: 6 }] },
  { id: 'survival-deep-shell', kind: 'notable', branch: 'Survival', name: 'Deep Shell', description: '+8 maximum health and +4 maximum armor.', allocationCost: 1, prerequisiteIds: ['survival-spall-layer'], sector: 'core', effects: [{ stat: 'player-max-hp-add', value: 8 }, { stat: 'player-max-armor-add', value: 4 }] },
  { id: 'survival-seal-lane', kind: 'travel', branch: 'Survival', name: 'Seal Lane', description: '+5% vacuum resistance.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'player-vacuum-resistance-add', value: 0.05 }] },
  { id: 'survival-pressure-rib', kind: 'standard', branch: 'Survival', name: 'Pressure Rib', description: '+5 maximum armor.', allocationCost: 1, prerequisiteIds: ['survival-seal-lane'], sector: 'core', effects: [{ stat: 'player-max-armor-add', value: 5 }] },
  { id: 'survival-closed-suit', kind: 'notable', branch: 'Survival', name: 'Closed Suit', description: '+10 maximum armor and +5% vacuum resistance.', allocationCost: 1, prerequisiteIds: ['survival-pressure-rib'], sector: 'core', effects: [{ stat: 'player-max-armor-add', value: 10 }, { stat: 'player-vacuum-resistance-add', value: 0.05 }] },

  { id: 'engineering-thermal-lane', kind: 'travel', branch: 'Engineering', name: 'Thermal Lane', description: '+5% weapon heat dissipation.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'weapon-heat-dissipation-mul', value: 1.05 }] },
  { id: 'engineering-feed-service', kind: 'standard', branch: 'Engineering', name: 'Feed Service', description: '5% faster reloads.', allocationCost: 1, prerequisiteIds: ['engineering-thermal-lane'], sector: 'core', effects: [{ stat: 'weapon-reload-mul', value: 0.95 }] },
  { id: 'engineering-radiator-bank', kind: 'notable', branch: 'Engineering', name: 'Radiator Bank', description: '+8% heat dissipation and +8% manual vent speed.', allocationCost: 1, prerequisiteIds: ['engineering-feed-service'], sector: 'core', effects: [{ stat: 'weapon-heat-dissipation-mul', value: 1.08 }, { stat: 'player-vent-speed-mul', value: 1.08 }] },
  { id: 'engineering-feed-lane', kind: 'travel', branch: 'Engineering', name: 'Feed Lane', description: '+1 magazine capacity to all weapons.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'weapon-magazine-add', value: 1 }] },
  { id: 'engineering-vent-actuator', kind: 'standard', branch: 'Engineering', name: 'Vent Actuator', description: '+6% manual vent speed.', allocationCost: 1, prerequisiteIds: ['engineering-feed-lane'], sector: 'core', effects: [{ stat: 'player-vent-speed-mul', value: 1.06 }] },
  { id: 'engineering-service-window', kind: 'notable', branch: 'Engineering', name: 'Service Window', description: '+2 magazine capacity and 6% faster reloads.', allocationCost: 1, prerequisiteIds: ['engineering-vent-actuator'], sector: 'core', effects: [{ stat: 'weapon-magazine-add', value: 2 }, { stat: 'weapon-reload-mul', value: 0.94 }] },

  { id: 'awareness-trace-lane', kind: 'travel', branch: 'Awareness', name: 'Trace Lane', description: '+4% projectile velocity.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'weapon-projectile-speed-mul', value: 1.04 }] },
  { id: 'awareness-fire-solution', kind: 'standard', branch: 'Awareness', name: 'Fire Solution', description: '+3% ability power.', allocationCost: 1, prerequisiteIds: ['awareness-trace-lane'], sector: 'core', effects: [{ stat: 'ability-power-mul', value: 1.03 }] },
  { id: 'awareness-range-table', kind: 'notable', branch: 'Awareness', name: 'Range Table', description: '+6 penetration and +3% class-skill range.', allocationCost: 1, prerequisiteIds: ['awareness-fire-solution'], sector: 'core', effects: [{ stat: 'weapon-penetration-add', value: 6 }, { stat: 'class-skill-range-mul', value: 1.03 }] },
  { id: 'awareness-sensor-lane', kind: 'travel', branch: 'Awareness', name: 'Sensor Lane', description: '+4 projectile penetration.', allocationCost: 1, prerequisiteIds: [], sector: 'core', effects: [{ stat: 'weapon-penetration-add', value: 4 }] },
  { id: 'awareness-track-fusion', kind: 'standard', branch: 'Awareness', name: 'Track Fusion', description: '+3% class-skill control.', allocationCost: 1, prerequisiteIds: ['awareness-sensor-lane'], sector: 'core', effects: [{ stat: 'class-skill-control-mul', value: 1.03 }] },
  { id: 'awareness-predictive-window', kind: 'notable', branch: 'Awareness', name: 'Predictive Window', description: '+6% projectile velocity and +4% class-skill power.', allocationCost: 1, prerequisiteIds: ['awareness-track-fusion'], sector: 'core', effects: [{ stat: 'weapon-projectile-speed-mul', value: 1.06 }, { stat: 'class-skill-power-mul', value: 1.04 }] },
];

export const operatorNetworkCoreWaveNodes = coreWaveNodes;

const classWeaponNodes: OperatorNetworkNode[] = [
  { id: 'vanguard-breach-entry', kind: 'travel', branch: 'Ballistics', name: 'Breacher Entry', description: '+3% Breacher damage.', allocationCost: 1, prerequisiteIds: [], sector: 'core', weaponFamily: 'breacher', effects: [{ stat: 'weapon-damage-mul', value: 1.03, weapon: 'breacher' }] },
  { id: 'vanguard-breach-pressure', kind: 'standard', branch: 'Ballistics', name: 'Breach Pressure', description: '+7% Breacher armor damage.', allocationCost: 1, prerequisiteIds: ['vanguard-breach-entry'], sector: 'core', weaponFamily: 'breacher', effects: [{ stat: 'weapon-armor-damage-mul', value: 1.07, weapon: 'breacher' }] },
  { id: 'vanguard-breach-impulse', kind: 'standard', branch: 'Ballistics', name: 'Breach Impulse', description: '+8% Breacher knockback.', allocationCost: 1, prerequisiteIds: ['vanguard-breach-pressure'], sector: 'core', weaponFamily: 'breacher', effects: [{ stat: 'weapon-knockback-mul', value: 1.08, weapon: 'breacher' }] },
  { id: 'vanguard-breach-telemetry', kind: 'notable', branch: 'Ballistics', name: 'Breach Telemetry', description: '8% faster Breacher reload and +5% Breacher-class skill armor pressure.', allocationCost: 1, prerequisiteIds: ['vanguard-breach-impulse'], sector: 'core', weaponFamily: 'breacher', effects: [{ stat: 'weapon-reload-mul', value: 0.92, weapon: 'breacher' }, { stat: 'class-skill-armor-mul', value: 1.05 }] },

  { id: 'vector-rail-entry', kind: 'travel', branch: 'Awareness', name: 'Rail Entry', description: '+5% Rail Lance projectile velocity.', allocationCost: 1, prerequisiteIds: [], sector: 'core', weaponFamily: 'rail', effects: [{ stat: 'weapon-projectile-speed-mul', value: 1.05, weapon: 'rail' }] },
  { id: 'vector-rail-brace', kind: 'standard', branch: 'Awareness', name: 'Rail Brace', description: '-6% Rail Lance recoil.', allocationCost: 1, prerequisiteIds: ['vector-rail-entry'], sector: 'core', weaponFamily: 'rail', effects: [{ stat: 'weapon-recoil-mul', value: 0.94, weapon: 'rail' }] },
  { id: 'vector-rail-bore', kind: 'standard', branch: 'Awareness', name: 'Rail Bore', description: '+10 Rail Lance penetration.', allocationCost: 1, prerequisiteIds: ['vector-rail-brace'], sector: 'core', weaponFamily: 'rail', effects: [{ stat: 'weapon-penetration-add', value: 10, weapon: 'rail' }] },
  { id: 'vector-rail-solution', kind: 'notable', branch: 'Awareness', name: 'Rail Solution', description: '6% faster Rail Lance reload and +5% Rail-class skill range.', allocationCost: 1, prerequisiteIds: ['vector-rail-bore'], sector: 'core', weaponFamily: 'rail', effects: [{ stat: 'weapon-reload-mul', value: 0.94, weapon: 'rail' }, { stat: 'class-skill-range-mul', value: 1.05 }] },

  { id: 'systems-carbine-entry', kind: 'travel', branch: 'Systems', name: 'Carbine Entry', description: '+2 Carbine magazine capacity.', allocationCost: 1, prerequisiteIds: [], sector: 'core', weaponFamily: 'carbine', effects: [{ stat: 'weapon-magazine-add', value: 2, weapon: 'carbine' }] },
  { id: 'systems-carbine-thermal', kind: 'standard', branch: 'Systems', name: 'Carbine Thermal Bus', description: '+7% Carbine heat dissipation.', allocationCost: 1, prerequisiteIds: ['systems-carbine-entry'], sector: 'core', weaponFamily: 'carbine', effects: [{ stat: 'weapon-heat-dissipation-mul', value: 1.07, weapon: 'carbine' }] },
  { id: 'systems-carbine-drive', kind: 'standard', branch: 'Systems', name: 'Carbine Drive', description: '+4% Carbine damage.', allocationCost: 1, prerequisiteIds: ['systems-carbine-thermal'], sector: 'core', weaponFamily: 'carbine', effects: [{ stat: 'weapon-damage-mul', value: 1.04, weapon: 'carbine' }] },
  { id: 'systems-carbine-loop', kind: 'notable', branch: 'Systems', name: 'Carbine Loop', description: '-3% ability capacitor cost and +5% Carbine-class skill recovery.', allocationCost: 1, prerequisiteIds: ['systems-carbine-drive'], sector: 'core', weaponFamily: 'carbine', effects: [{ stat: 'ability-cost-mul', value: 0.97 }, { stat: 'class-skill-recovery-mul', value: 1.05 }] },
];

export const operatorNetworkClassWeaponNodes = classWeaponNodes;

const legacyNodes: OperatorNetworkNode[] = [
  { id: 'ballistics-1', kind: 'standard', branch: 'Ballistics', name: 'Dense Flight', description: '+8 penetration to all player projectiles.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'ballistics-2', kind: 'standard', branch: 'Ballistics', name: 'Armor Work', description: '+15% armor damage.', allocationCost: 1, prerequisiteIds: ['ballistics-1'], sector: 'core', legacyRequires: 'ballistics-1' },
  { id: 'ballistics-3', kind: 'notable', branch: 'Ballistics', name: 'Breach Doctrine', description: 'Armor Breach lasts longer, but direct health damage is slightly reduced.', allocationCost: 1, prerequisiteIds: ['ballistics-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'ballistics-2' },

  { id: 'mobility-1', kind: 'standard', branch: 'Mobility', name: 'Servo Timing', description: '+6% movement speed.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'mobility-2', kind: 'standard', branch: 'Mobility', name: 'Low-G Footwork', description: 'Improved stopping control below 0.35g.', allocationCost: 1, prerequisiteIds: ['mobility-1'], sector: 'core', legacyRequires: 'mobility-1' },
  { id: 'mobility-3', kind: 'notable', branch: 'Mobility', name: 'Recoil Vectoring', description: 'While moving, 35% of weapon recoil is redirected into your chosen movement vector.', allocationCost: 1, prerequisiteIds: ['mobility-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'mobility-2' },

  { id: 'systems-1', kind: 'standard', branch: 'Systems', name: 'Efficient Bus', description: '+12% capacitor regeneration.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'systems-2', kind: 'standard', branch: 'Systems', name: 'Signal Compression', description: '-8% ability capacitor cost.', allocationCost: 1, prerequisiteIds: ['systems-1'], sector: 'core', legacyRequires: 'systems-1' },
  { id: 'systems-3', kind: 'notable', branch: 'Systems', name: 'Disruption Relay', description: 'Electronically disrupted targets can be serviced by a relay microdrone.', allocationCost: 1, prerequisiteIds: ['systems-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'systems-2' },

  { id: 'survival-1', kind: 'standard', branch: 'Survival', name: 'Layered Plate', description: '+12 maximum armor.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'survival-2', kind: 'standard', branch: 'Survival', name: 'Pressure Discipline', description: 'Vacuum exposure builds more slowly.', allocationCost: 1, prerequisiteIds: ['survival-1'], sector: 'core', legacyRequires: 'survival-1' },
  { id: 'survival-3', kind: 'notable', branch: 'Survival', name: 'Hard Vacuum Familiarity', description: 'Greatly reduces vacuum damage and decompression pull.', allocationCost: 1, prerequisiteIds: ['survival-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'survival-2' },

  { id: 'engineering-1', kind: 'standard', branch: 'Engineering', name: 'Thermal Routing', description: '+12% weapon heat dissipation.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'engineering-2', kind: 'standard', branch: 'Engineering', name: 'Quick Vent', description: 'Manual vent cycles complete faster.', allocationCost: 1, prerequisiteIds: ['engineering-1'], sector: 'core', legacyRequires: 'engineering-1' },
  { id: 'engineering-3', kind: 'notable', branch: 'Engineering', name: 'Dodge Heat Shunt', description: 'Dodging vents weapon heat.', allocationCost: 1, prerequisiteIds: ['engineering-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'engineering-2' },

  { id: 'awareness-1', kind: 'standard', branch: 'Awareness', name: 'Predictive Lead', description: '+8% projectile velocity.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'awareness-2', kind: 'standard', branch: 'Awareness', name: 'Weak-Path Telemetry', description: 'Marked targets take more armor damage.', allocationCost: 1, prerequisiteIds: ['awareness-1'], sector: 'core', legacyRequires: 'awareness-1' },
  { id: 'awareness-3', kind: 'notable', branch: 'Awareness', name: 'Penetration Optics', description: 'Sensor-marked targets expose penetration paths to all weapons.', allocationCost: 1, prerequisiteIds: ['awareness-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'awareness-2' },
];

export const operatorNetworkNodes: OperatorNetworkNode[] = [
  { id: 'start-vanguard', kind: 'class-start', branch: 'Origin', name: 'Vanguard Origin', description: 'Breach / armor-control entry point.', allocationCost: 0, prerequisiteIds: [], sector: 'origin', classStart: 'vanguard' },
  { id: 'start-vector', kind: 'class-start', branch: 'Origin', name: 'Vector Origin', description: 'Mobility / precision-routing entry point.', allocationCost: 0, prerequisiteIds: [], sector: 'origin', classStart: 'vector' },
  { id: 'start-systems', kind: 'class-start', branch: 'Origin', name: 'Systems Origin', description: 'Capacitor / thermal-network entry point.', allocationCost: 0, prerequisiteIds: [], sector: 'origin', classStart: 'systems' },
  ...legacyNodes,
  ...coreWaveNodes,
  ...classWeaponNodes,
];

const coreWaveEdges: OperatorNetworkEdge[] = [
  { a: 'ballistics-1', b: 'ballistics-vectoring-lane', route: 'branch' },
  { a: 'ballistics-vectoring-lane', b: 'ballistics-bore-map', route: 'branch' },
  { a: 'ballistics-bore-map', b: 'ballistics-terminal-geometry', route: 'branch' },
  { a: 'ballistics-2', b: 'ballistics-impact-lane', route: 'branch' },
  { a: 'ballistics-impact-lane', b: 'ballistics-kinetic-budget', route: 'branch' },
  { a: 'ballistics-kinetic-budget', b: 'ballistics-dense-salvo', route: 'branch' },

  { a: 'mobility-1', b: 'mobility-servo-lane', route: 'branch' },
  { a: 'mobility-servo-lane', b: 'mobility-countermass-timing', route: 'branch' },
  { a: 'mobility-countermass-timing', b: 'mobility-vector-recovery', route: 'branch' },
  { a: 'mobility-2', b: 'mobility-impulse-lane', route: 'branch' },
  { a: 'mobility-impulse-lane', b: 'mobility-brake-sense', route: 'branch' },
  { a: 'mobility-brake-sense', b: 'mobility-transit-window', route: 'branch' },

  { a: 'systems-1', b: 'systems-capacitor-lane', route: 'branch' },
  { a: 'systems-capacitor-lane', b: 'systems-charge-recovery', route: 'branch' },
  { a: 'systems-charge-recovery', b: 'systems-closed-budget', route: 'branch' },
  { a: 'systems-2', b: 'systems-cycle-lane', route: 'branch' },
  { a: 'systems-cycle-lane', b: 'systems-fast-switching', route: 'branch' },
  { a: 'systems-fast-switching', b: 'systems-reserve-loop', route: 'branch' },

  { a: 'survival-1', b: 'survival-plating-lane', route: 'branch' },
  { a: 'survival-plating-lane', b: 'survival-spall-layer', route: 'branch' },
  { a: 'survival-spall-layer', b: 'survival-deep-shell', route: 'branch' },
  { a: 'survival-2', b: 'survival-seal-lane', route: 'branch' },
  { a: 'survival-seal-lane', b: 'survival-pressure-rib', route: 'branch' },
  { a: 'survival-pressure-rib', b: 'survival-closed-suit', route: 'branch' },

  { a: 'engineering-1', b: 'engineering-thermal-lane', route: 'branch' },
  { a: 'engineering-thermal-lane', b: 'engineering-feed-service', route: 'branch' },
  { a: 'engineering-feed-service', b: 'engineering-radiator-bank', route: 'branch' },
  { a: 'engineering-2', b: 'engineering-feed-lane', route: 'branch' },
  { a: 'engineering-feed-lane', b: 'engineering-vent-actuator', route: 'branch' },
  { a: 'engineering-vent-actuator', b: 'engineering-service-window', route: 'branch' },

  { a: 'awareness-1', b: 'awareness-trace-lane', route: 'branch' },
  { a: 'awareness-trace-lane', b: 'awareness-fire-solution', route: 'branch' },
  { a: 'awareness-fire-solution', b: 'awareness-range-table', route: 'branch' },
  { a: 'awareness-2', b: 'awareness-sensor-lane', route: 'branch' },
  { a: 'awareness-sensor-lane', b: 'awareness-track-fusion', route: 'branch' },
  { a: 'awareness-track-fusion', b: 'awareness-predictive-window', route: 'branch' },
];

const classWeaponEdges: OperatorNetworkEdge[] = [
  { a: 'start-vanguard', b: 'vanguard-breach-entry', route: 'class-start' },
  { a: 'vanguard-breach-entry', b: 'vanguard-breach-pressure', route: 'branch' },
  { a: 'vanguard-breach-pressure', b: 'vanguard-breach-impulse', route: 'branch' },
  { a: 'vanguard-breach-impulse', b: 'vanguard-breach-telemetry', route: 'branch' },
  { a: 'vanguard-breach-telemetry', b: 'ballistics-2', route: 'branch' },

  { a: 'start-vector', b: 'vector-rail-entry', route: 'class-start' },
  { a: 'vector-rail-entry', b: 'vector-rail-brace', route: 'branch' },
  { a: 'vector-rail-brace', b: 'vector-rail-bore', route: 'branch' },
  { a: 'vector-rail-bore', b: 'vector-rail-solution', route: 'branch' },
  { a: 'vector-rail-solution', b: 'awareness-2', route: 'branch' },

  { a: 'start-systems', b: 'systems-carbine-entry', route: 'class-start' },
  { a: 'systems-carbine-entry', b: 'systems-carbine-thermal', route: 'branch' },
  { a: 'systems-carbine-thermal', b: 'systems-carbine-drive', route: 'branch' },
  { a: 'systems-carbine-drive', b: 'systems-carbine-loop', route: 'branch' },
  { a: 'systems-carbine-loop', b: 'systems-2', route: 'branch' },
];

export const operatorNetworkEdges: OperatorNetworkEdge[] = [
  { a: 'start-vanguard', b: 'ballistics-1', route: 'class-start' },
  { a: 'start-vanguard', b: 'survival-1', route: 'class-start' },
  { a: 'start-vector', b: 'mobility-1', route: 'class-start' },
  { a: 'start-vector', b: 'awareness-1', route: 'class-start' },
  { a: 'start-systems', b: 'systems-1', route: 'class-start' },
  { a: 'start-systems', b: 'engineering-1', route: 'class-start' },

  { a: 'ballistics-1', b: 'ballistics-2', route: 'branch' },
  { a: 'ballistics-2', b: 'ballistics-3', route: 'branch' },
  { a: 'mobility-1', b: 'mobility-2', route: 'branch' },
  { a: 'mobility-2', b: 'mobility-3', route: 'branch' },
  { a: 'systems-1', b: 'systems-2', route: 'branch' },
  { a: 'systems-2', b: 'systems-3', route: 'branch' },
  { a: 'survival-1', b: 'survival-2', route: 'branch' },
  { a: 'survival-2', b: 'survival-3', route: 'branch' },
  { a: 'engineering-1', b: 'engineering-2', route: 'branch' },
  { a: 'engineering-2', b: 'engineering-3', route: 'branch' },
  { a: 'awareness-1', b: 'awareness-2', route: 'branch' },
  { a: 'awareness-2', b: 'awareness-3', route: 'branch' },

  { a: 'ballistics-3', b: 'mobility-1', route: 'outer-ring' },
  { a: 'mobility-3', b: 'awareness-1', route: 'outer-ring' },
  { a: 'awareness-3', b: 'systems-1', route: 'outer-ring' },
  { a: 'systems-3', b: 'engineering-1', route: 'outer-ring' },
  { a: 'engineering-3', b: 'survival-1', route: 'outer-ring' },
  { a: 'survival-3', b: 'ballistics-1', route: 'outer-ring' },
  ...coreWaveEdges,
  ...classWeaponEdges,
];

const weaponFamilyByStartNodeId: Record<string, WeaponId> = {
  'start-vanguard': 'breacher',
  'start-vector': 'rail',
  'start-systems': 'carbine',
};

const nodeById = new Map(operatorNetworkNodes.map(node => [node.id, node]));
const neighborsById = new Map<string, string[]>();
for (const node of operatorNetworkNodes) neighborsById.set(node.id, []);
for (const edge of operatorNetworkEdges) {
  neighborsById.get(edge.a)?.push(edge.b);
  neighborsById.get(edge.b)?.push(edge.a);
}

function normalizedPointCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function operatorNetworkStartNodeForClass(operatorClass: OperatorClassId) {
  return classStartNodeIds[operatorClass];
}

export function operatorNetworkNode(nodeId: string) {
  return nodeById.get(nodeId);
}

export function isOperatorNetworkNodeId(nodeId: unknown): nodeId is string {
  return typeof nodeId === 'string' && nodeById.has(nodeId);
}

export function operatorNetworkNeighbors(nodeId: string) {
  return [...(neighborsById.get(nodeId) ?? [])];
}

export function createOperatorNetworkState(operatorClass: OperatorClassId, unspentPoints = 0): OperatorNetworkState {
  return {
    schemaVersion: OPERATOR_NETWORK_SCHEMA_VERSION,
    startNodeId: operatorNetworkStartNodeForClass(operatorClass),
    allocatedNodeIds: [],
    unspentPoints: normalizedPointCount(unspentPoints),
  };
}

export function normalizeOperatorNetworkState(input: {
  operatorClass: OperatorClassId;
  level: number;
  state?: Partial<OperatorNetworkState> | null;
  legacyAllocatedNodes?: readonly string[];
  legacyUnspentPoints?: number;
}): OperatorNetworkState {
  const sourceAllocated = input.state?.schemaVersion === OPERATOR_NETWORK_SCHEMA_VERSION && Array.isArray(input.state.allocatedNodeIds)
    ? input.state.allocatedNodeIds
    : input.legacyAllocatedNodes ?? [];
  const allocatedNodeIds = [...new Set(sourceAllocated.filter(id => {
    const node = operatorNetworkNode(id);
    return !!node && node.kind !== 'class-start';
  }))];

  const usedPoints = allocatedNodeIds.reduce((total, id) => total + (operatorNetworkNode(id)?.allocationCost ?? 0), 0);
  const earnedLevelPoints = Math.max(0, Math.floor(input.level) - 1);
  const storedUnspent = input.state?.schemaVersion === OPERATOR_NETWORK_SCHEMA_VERSION
    ? normalizedPointCount(input.state.unspentPoints)
    : normalizedPointCount(input.legacyUnspentPoints);
  const minimumUnspent = Math.max(0, earnedLevelPoints - usedPoints);

  return {
    schemaVersion: OPERATOR_NETWORK_SCHEMA_VERSION,
    startNodeId: operatorNetworkStartNodeForClass(input.operatorClass),
    allocatedNodeIds,
    unspentPoints: Math.max(storedUnspent, minimumUnspent),
  };
}

export function operatorNetworkLegacyMirror(state: OperatorNetworkState) {
  return {
    allocatedNodes: [...state.allocatedNodeIds],
    progressionPoints: state.unspentPoints,
  };
}

export type OperatorNetworkAllocationResult = {
  state: OperatorNetworkState;
  allocated: boolean;
  reason: 'allocated' | 'unknown-node' | 'class-start' | 'already-allocated' | 'insufficient-points' | 'missing-prerequisite' | 'not-connected' | 'wrong-arsenal';
};

export function allocateOperatorNetworkNode(state: OperatorNetworkState, nodeId: string): OperatorNetworkAllocationResult {
  const node = operatorNetworkNode(nodeId);
  if (!node) return { state, allocated: false, reason: 'unknown-node' };
  if (node.kind === 'class-start') return { state, allocated: false, reason: 'class-start' };
  if (node.weaponFamily && weaponFamilyByStartNodeId[state.startNodeId] !== node.weaponFamily) return { state, allocated: false, reason: 'wrong-arsenal' };
  if (state.allocatedNodeIds.includes(nodeId)) return { state, allocated: false, reason: 'already-allocated' };
  if (state.unspentPoints < node.allocationCost) return { state, allocated: false, reason: 'insufficient-points' };

  const allocated = new Set(state.allocatedNodeIds);
  if (node.prerequisiteIds.some(requiredId => !allocated.has(requiredId))) {
    return { state, allocated: false, reason: 'missing-prerequisite' };
  }

  const connectedIds = new Set([state.startNodeId, ...state.allocatedNodeIds]);
  const connected = operatorNetworkNeighbors(nodeId).some(neighborId => connectedIds.has(neighborId));
  if (!connected) return { state, allocated: false, reason: 'not-connected' };

  return {
    allocated: true,
    reason: 'allocated',
    state: {
      ...state,
      allocatedNodeIds: [...state.allocatedNodeIds, nodeId],
      unspentPoints: state.unspentPoints - node.allocationCost,
    },
  };
}

export function operatorNetworkRouteToNode(state: OperatorNetworkState, targetNodeId: string): OperatorNetworkRoute | null {
  const target = operatorNetworkNode(targetNodeId);
  if (!target || target.kind === 'class-start') return null;
  if (state.allocatedNodeIds.includes(targetNodeId)) return { nodeIds: [], pointCost: 0 };

  const allocated = new Set(state.allocatedNodeIds);
  const owned = new Set([state.startNodeId, ...state.allocatedNodeIds]);
  const frontier: Array<{ nodeId: string; path: string[]; cost: number }> = [...owned].map(nodeId => ({ nodeId, path: [], cost: 0 }));
  const bestCost = new Map<string, number>([...owned].map(nodeId => [nodeId, 0]));

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.cost - right.cost || left.path.length - right.path.length);
    const current = frontier.shift()!;

    for (const neighborId of operatorNetworkNeighbors(current.nodeId)) {
      const neighbor = operatorNetworkNode(neighborId);
      if (!neighbor) continue;
      if (neighbor.kind === 'class-start' && neighborId !== state.startNodeId) continue;
      if (neighbor.weaponFamily && weaponFamilyByStartNodeId[state.startNodeId] !== neighbor.weaponFamily) continue;

      const pathSet = new Set([...allocated, ...current.path]);
      if (neighbor.kind !== 'class-start' && neighbor.prerequisiteIds.some(requiredId => !pathSet.has(requiredId))) continue;

      const alreadyOwned = owned.has(neighborId);
      const alreadyInPath = current.path.includes(neighborId);
      const nextPath = neighbor.kind === 'class-start' || alreadyOwned || alreadyInPath ? current.path : [...current.path, neighborId];
      const nextCost = current.cost + (neighbor.kind === 'class-start' || alreadyOwned || alreadyInPath ? 0 : neighbor.allocationCost);

      if (neighborId === targetNodeId) return { nodeIds: nextPath, pointCost: nextCost };

      const priorCost = bestCost.get(neighborId);
      if (priorCost !== undefined && priorCost <= nextCost) continue;
      bestCost.set(neighborId, nextCost);
      frontier.push({ nodeId: neighborId, path: nextPath, cost: nextCost });
    }
  }

  return null;
}

export const legacyProgressionNodes = legacyNodes.map(node => ({
  id: node.id,
  branch: node.branch as OperatorNetworkBranch,
  name: node.name,
  description: node.description,
  major: node.legacyMajor || undefined,
  requires: node.legacyRequires,
}));
