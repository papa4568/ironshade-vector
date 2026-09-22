import type { OperatorClassId } from './classSkills';
import type { SpecializationId, WeaponId } from './sim';

export const OPERATOR_NETWORK_SCHEMA_VERSION = 2 as const;

export const operatorNetworkBranches = ['Ballistics', 'Mobility', 'Systems', 'Survival', 'Engineering', 'Awareness'] as const;
export type OperatorNetworkBranch = typeof operatorNetworkBranches[number];
export type OperatorNetworkNodeKind = 'class-start' | 'travel' | 'standard' | 'notable' | 'mastery' | 'keystone' | 'capstone' | 'specialization-entry' | 'specialization-stage' | 'specialization-hook';
export type OperatorNetworkIntegrationHook = 'gear' | 'crafting' | 'faction' | 'singular';
export type OperatorNetworkSector = 'origin' | 'core' | 'outer';

export type OperatorNetworkStatId =
  | 'weapon-damage-mul'
  | 'weapon-projectile-speed-mul'
  | 'weapon-penetration-add'
  | 'weapon-recoil-mul'
  | 'weapon-heat-dissipation-mul'
  | 'weapon-heat-per-shot-mul'
  | 'weapon-health-damage-mul'
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
  exclusiveGroup?: string;
  specialization?: SpecializationId;
  minLevel?: number;
  milestone?: boolean;
  unlockKey?: string;
  unlockLabel?: string;
  integrationHooks?: OperatorNetworkIntegrationHook[];
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

export type OperatorNetworkUnlockContext = {
  level: number;
  specialization?: SpecializationId | null;
  unlockKeys?: readonly string[];
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

const buildDefiningNodes: OperatorNetworkNode[] = [
  { id: 'ballistics-terminal-mastery', kind: 'mastery', branch: 'Ballistics', name: 'Terminal Calculus', description: '+8 penetration and +8% armor damage. Opens one mutually exclusive Ballistics Keystone.', allocationCost: 1, prerequisiteIds: ['ballistics-3'], sector: 'outer', effects: [{ stat: 'weapon-penetration-add', value: 8 }, { stat: 'weapon-armor-damage-mul', value: 1.08 }] },
  { id: 'ballistics-overpenetration-keystone', kind: 'keystone', branch: 'Ballistics', name: 'Overpenetration Doctrine', description: 'Projectiles gain +18% velocity and +18 penetration, but recoil and heat per shot rise by 16% and 12%.', allocationCost: 2, prerequisiteIds: ['ballistics-terminal-mastery'], sector: 'outer', exclusiveGroup: 'ballistics-keystone', effects: [{ stat: 'weapon-projectile-speed-mul', value: 1.18 }, { stat: 'weapon-penetration-add', value: 18 }, { stat: 'weapon-recoil-mul', value: 1.16 }, { stat: 'weapon-heat-per-shot-mul', value: 1.12 }] },
  { id: 'ballistics-breach-economy-keystone', kind: 'keystone', branch: 'Ballistics', name: 'Breach Economy', description: '+30% armor damage and +10% class-skill armor pressure, but direct health damage is reduced by 12%.', allocationCost: 2, prerequisiteIds: ['ballistics-terminal-mastery'], sector: 'outer', exclusiveGroup: 'ballistics-keystone', effects: [{ stat: 'weapon-armor-damage-mul', value: 1.30 }, { stat: 'class-skill-armor-mul', value: 1.10 }, { stat: 'weapon-health-damage-mul', value: 0.88 }] },
  { id: 'ballistics-terminal-collapse-capstone', kind: 'capstone', branch: 'Ballistics', name: 'Terminal Collapse', description: '+10% weapon damage, +10 penetration, and +12% class-skill armor pressure after committing to a Ballistics Keystone.', allocationCost: 2, prerequisiteIds: [], sector: 'outer', effects: [{ stat: 'weapon-damage-mul', value: 1.10 }, { stat: 'weapon-penetration-add', value: 10 }, { stat: 'class-skill-armor-mul', value: 1.12 }] },

  { id: 'mobility-inertial-mastery', kind: 'mastery', branch: 'Mobility', name: 'Inertial Authority', description: '+4% movement speed, +10% low-g control, and 6% less recoil. Opens one mutually exclusive Mobility Keystone.', allocationCost: 1, prerequisiteIds: ['mobility-3'], sector: 'outer', effects: [{ stat: 'player-move-speed-mul', value: 1.04 }, { stat: 'player-low-g-control-add', value: 0.10 }, { stat: 'weapon-recoil-mul', value: 0.94 }] },
  { id: 'mobility-redline-keystone', kind: 'keystone', branch: 'Mobility', name: 'Redline Transit', description: '+12% movement speed and 8% faster reloads, but maximum armor is reduced by 16.', allocationCost: 2, prerequisiteIds: ['mobility-inertial-mastery'], sector: 'outer', exclusiveGroup: 'mobility-keystone', effects: [{ stat: 'player-move-speed-mul', value: 1.12 }, { stat: 'weapon-reload-mul', value: 0.92 }, { stat: 'player-max-armor-add', value: -16 }] },
  { id: 'mobility-countermass-keystone', kind: 'keystone', branch: 'Mobility', name: 'Countermass Priority', description: '28% less recoil and +22% low-g control, but weapon damage is reduced by 8%.', allocationCost: 2, prerequisiteIds: ['mobility-inertial-mastery'], sector: 'outer', exclusiveGroup: 'mobility-keystone', effects: [{ stat: 'weapon-recoil-mul', value: 0.72 }, { stat: 'player-low-g-control-add', value: 0.22 }, { stat: 'weapon-damage-mul', value: 0.92 }] },
  { id: 'mobility-vector-priority-capstone', kind: 'capstone', branch: 'Mobility', name: 'Vector Priority', description: '+7% movement speed, 6% faster ability recovery, and +10% class-skill control after committing to a Mobility Keystone.', allocationCost: 2, prerequisiteIds: [], sector: 'outer', effects: [{ stat: 'player-move-speed-mul', value: 1.07 }, { stat: 'ability-cooldown-mul', value: 0.94 }, { stat: 'class-skill-control-mul', value: 1.10 }] },

  { id: 'systems-power-mastery', kind: 'mastery', branch: 'Systems', name: 'Power Budget Authority', description: '+6 maximum capacitor and +10% capacitor regeneration. Opens one mutually exclusive Systems Keystone.', allocationCost: 1, prerequisiteIds: ['systems-3'], sector: 'outer', effects: [{ stat: 'player-max-cap-add', value: 6 }, { stat: 'player-cap-regen-mul', value: 1.10 }] },
  { id: 'systems-open-bus-keystone', kind: 'keystone', branch: 'Systems', name: 'Open Bus', description: 'Abilities cost 20% less capacitor, but their cooldowns are 14% longer.', allocationCost: 2, prerequisiteIds: ['systems-power-mastery'], sector: 'outer', exclusiveGroup: 'systems-keystone', effects: [{ stat: 'ability-cost-mul', value: 0.80 }, { stat: 'ability-cooldown-mul', value: 1.14 }] },
  { id: 'systems-burst-conduction-keystone', kind: 'keystone', branch: 'Systems', name: 'Burst Conduction', description: '+24% ability power, but abilities cost 16% more capacitor.', allocationCost: 2, prerequisiteIds: ['systems-power-mastery'], sector: 'outer', exclusiveGroup: 'systems-keystone', effects: [{ stat: 'ability-power-mul', value: 1.24 }, { stat: 'ability-cost-mul', value: 1.16 }] },
  { id: 'systems-closed-loop-capstone', kind: 'capstone', branch: 'Systems', name: 'Closed Loop Authority', description: '8% faster ability recovery, +10% class-skill recovery, and +10% capacitor regeneration after committing to a Systems Keystone.', allocationCost: 2, prerequisiteIds: [], sector: 'outer', effects: [{ stat: 'ability-cooldown-mul', value: 0.92 }, { stat: 'class-skill-recovery-mul', value: 1.10 }, { stat: 'player-cap-regen-mul', value: 1.10 }] },

  { id: 'survival-shell-mastery', kind: 'mastery', branch: 'Survival', name: 'Layered Survival Authority', description: '+12 maximum health and +10 maximum armor. Opens one mutually exclusive Survival Keystone.', allocationCost: 1, prerequisiteIds: ['survival-3'], sector: 'outer', effects: [{ stat: 'player-max-hp-add', value: 12 }, { stat: 'player-max-armor-add', value: 10 }] },
  { id: 'survival-pressure-fortress-keystone', kind: 'keystone', branch: 'Survival', name: 'Pressure Fortress', description: '+28 maximum armor and +15% vacuum resistance, but movement speed is reduced by 8%.', allocationCost: 2, prerequisiteIds: ['survival-shell-mastery'], sector: 'outer', exclusiveGroup: 'survival-keystone', effects: [{ stat: 'player-max-armor-add', value: 28 }, { stat: 'player-vacuum-resistance-add', value: 0.15 }, { stat: 'player-move-speed-mul', value: 0.92 }] },
  { id: 'survival-ablative-reserve-keystone', kind: 'keystone', branch: 'Survival', name: 'Ablative Reserve', description: '+34 maximum health, but maximum armor is reduced by 16.', allocationCost: 2, prerequisiteIds: ['survival-shell-mastery'], sector: 'outer', exclusiveGroup: 'survival-keystone', effects: [{ stat: 'player-max-hp-add', value: 34 }, { stat: 'player-max-armor-add', value: -16 }] },
  { id: 'survival-redundant-life-support-capstone', kind: 'capstone', branch: 'Survival', name: 'Redundant Life Support', description: '+18 maximum health, +16 maximum armor, and +10% vacuum resistance after committing to a Survival Keystone.', allocationCost: 2, prerequisiteIds: [], sector: 'outer', effects: [{ stat: 'player-max-hp-add', value: 18 }, { stat: 'player-max-armor-add', value: 16 }, { stat: 'player-vacuum-resistance-add', value: 0.10 }] },

  { id: 'engineering-service-mastery', kind: 'mastery', branch: 'Engineering', name: 'Service Authority', description: '+12% heat dissipation and +12% manual vent speed. Opens one mutually exclusive Engineering Keystone.', allocationCost: 1, prerequisiteIds: ['engineering-3'], sector: 'outer', effects: [{ stat: 'weapon-heat-dissipation-mul', value: 1.12 }, { stat: 'player-vent-speed-mul', value: 1.12 }] },
  { id: 'engineering-hot-feed-keystone', kind: 'keystone', branch: 'Engineering', name: 'Hot Feed', description: '+4 magazine capacity and +14% weapon damage, but heat per shot rises 20% and reloads are 8% slower.', allocationCost: 2, prerequisiteIds: ['engineering-service-mastery'], sector: 'outer', exclusiveGroup: 'engineering-keystone', effects: [{ stat: 'weapon-magazine-add', value: 4 }, { stat: 'weapon-damage-mul', value: 1.14 }, { stat: 'weapon-heat-per-shot-mul', value: 1.20 }, { stat: 'weapon-reload-mul', value: 1.08 }] },
  { id: 'engineering-cold-cycle-keystone', kind: 'keystone', branch: 'Engineering', name: 'Cold Cycle', description: '+35% heat dissipation and +25% manual vent speed, but weapon damage is reduced by 10%.', allocationCost: 2, prerequisiteIds: ['engineering-service-mastery'], sector: 'outer', exclusiveGroup: 'engineering-keystone', effects: [{ stat: 'weapon-heat-dissipation-mul', value: 1.35 }, { stat: 'player-vent-speed-mul', value: 1.25 }, { stat: 'weapon-damage-mul', value: 0.90 }] },
  { id: 'engineering-service-supremacy-capstone', kind: 'capstone', branch: 'Engineering', name: 'Service Supremacy', description: '+3 magazine capacity, 10% faster reloads, and +15% heat dissipation after committing to an Engineering Keystone.', allocationCost: 2, prerequisiteIds: [], sector: 'outer', effects: [{ stat: 'weapon-magazine-add', value: 3 }, { stat: 'weapon-reload-mul', value: 0.90 }, { stat: 'weapon-heat-dissipation-mul', value: 1.15 }] },

  { id: 'awareness-solution-mastery', kind: 'mastery', branch: 'Awareness', name: 'Solution Authority', description: '+10% projectile velocity and +10 penetration. Opens one mutually exclusive Awareness Keystone.', allocationCost: 1, prerequisiteIds: ['awareness-3'], sector: 'outer', effects: [{ stat: 'weapon-projectile-speed-mul', value: 1.10 }, { stat: 'weapon-penetration-add', value: 10 }] },
  { id: 'awareness-perfect-solution-keystone', kind: 'keystone', branch: 'Awareness', name: 'Perfect Solution', description: '+22% projectile velocity and +24 penetration, but reloads are 14% slower.', allocationCost: 2, prerequisiteIds: ['awareness-solution-mastery'], sector: 'outer', exclusiveGroup: 'awareness-keystone', effects: [{ stat: 'weapon-projectile-speed-mul', value: 1.22 }, { stat: 'weapon-penetration-add', value: 24 }, { stat: 'weapon-reload-mul', value: 1.14 }] },
  { id: 'awareness-wide-mesh-keystone', kind: 'keystone', branch: 'Awareness', name: 'Wide Mesh', description: '+18% class-skill range and +12% class-skill control, but weapon damage is reduced by 8%.', allocationCost: 2, prerequisiteIds: ['awareness-solution-mastery'], sector: 'outer', exclusiveGroup: 'awareness-keystone', effects: [{ stat: 'class-skill-range-mul', value: 1.18 }, { stat: 'class-skill-control-mul', value: 1.12 }, { stat: 'weapon-damage-mul', value: 0.92 }] },
  { id: 'awareness-predictive-dominance-capstone', kind: 'capstone', branch: 'Awareness', name: 'Predictive Dominance', description: '+8% weapon damage, +10% class-skill range, and +8% class-skill control after committing to an Awareness Keystone.', allocationCost: 2, prerequisiteIds: [], sector: 'outer', effects: [{ stat: 'weapon-damage-mul', value: 1.08 }, { stat: 'class-skill-range-mul', value: 1.10 }, { stat: 'class-skill-control-mul', value: 1.08 }] },
];

export const operatorNetworkBuildDefiningNodes = buildDefiningNodes;


type SpecializationNetworkDefinition = {
  specialization: SpecializationId;
  branch: OperatorNetworkBranch;
  anchorNodeId: string;
  idPrefix: string;
  entryName: string;
  stageName: string;
  hookName: string;
  unlockKey: string;
  unlockLabel: string;
  hookDescription: string;
  effects: OperatorNetworkStatEffect[];
};

const specializationNetworkDefinitions: SpecializationNetworkDefinition[] = [
  { specialization: 'pressure-diver', branch: 'Survival', anchorNodeId: 'survival-shell-mastery', idPrefix: 'pressure-diver', entryName: 'Pressure Diver Route', stageName: 'Pressure Diver Integration', hookName: 'Abyssal Recirculation', unlockKey: 'boss:khepri', unlockLabel: 'Defeat Survey Custodian Veyra Senn / Khepri deep command target', hookDescription: 'Links pressure-rated gear, reconstruction, faction doctrine, and Singular hardware into the Diver loop.', effects: [{ stat: 'player-vacuum-resistance-add', value: 0.08 }, { stat: 'class-skill-recovery-mul', value: 1.05 }] },
  { specialization: 'breach-vanguard', branch: 'Ballistics', anchorNodeId: 'ballistics-terminal-mastery', idPrefix: 'breach-vanguard', entryName: 'Breach Vanguard Route', stageName: 'Breach Vanguard Integration', hookName: 'Custody Breach Doctrine', unlockKey: 'campaign:dead-reckoning', unlockLabel: 'Complete Dead Reckoning', hookDescription: 'Turns recovered breach geometry into one shared gear, reconstruction, faction, and Singular pressure route.', effects: [{ stat: 'weapon-armor-damage-mul', value: 1.12, weapon: 'breacher' }, { stat: 'weapon-penetration-add', value: 8, weapon: 'breacher' }] },
  { specialization: 'bulkhead-warden', branch: 'Survival', anchorNodeId: 'survival-shell-mastery', idPrefix: 'bulkhead-warden', entryName: 'Bulkhead Warden Route', stageName: 'Bulkhead Warden Integration', hookName: 'Meridian Counterfort', unlockKey: 'faction:meridian:6', unlockLabel: 'Reach Meridian Compact reputation 6', hookDescription: 'Binds Meridian pressure hardware and reconstruction into the Warden defense loop while preserving Singular behavior.', effects: [{ stat: 'player-max-armor-add', value: 10 }, { stat: 'class-skill-armor-mul', value: 1.06 }] },
  { specialization: 'momentum-broker', branch: 'Mobility', anchorNodeId: 'mobility-inertial-mastery', idPrefix: 'momentum-broker', entryName: 'Momentum Broker Route', stageName: 'Momentum Broker Integration', hookName: 'ORO-7 Reaction Ledger', unlockKey: 'boss:oro-7', unlockLabel: 'Defeat Cascade Custodian ORO-7 in Escalation III', hookDescription: 'Connects reaction-control gear, reconstruction, faction sets, and Singular recoil hardware to the Broker ledger.', effects: [{ stat: 'player-move-speed-mul', value: 1.03 }, { stat: 'player-cap-regen-mul', value: 1.08 }] },
  { specialization: 'survey-deadeye', branch: 'Awareness', anchorNodeId: 'awareness-solution-mastery', idPrefix: 'survey-deadeye', entryName: 'Survey Deadeye Route', stageName: 'Survey Deadeye Integration', hookName: 'Interdiction Reference Solution', unlockKey: 'campaign:interdiction', unlockLabel: 'Complete Dead Reckoning: Interdiction', hookDescription: 'Feeds survey gear and reconstruction telemetry into faction optics and Singular reference hardware.', effects: [{ stat: 'weapon-penetration-add', value: 14, weapon: 'rail' }, { stat: 'class-skill-range-mul', value: 1.06 }] },
  { specialization: 'redline-pilot', branch: 'Mobility', anchorNodeId: 'mobility-inertial-mastery', idPrefix: 'redline-pilot', entryName: 'Redline Pilot Route', stageName: 'Redline Pilot Integration', hookName: 'Long Arc Thermal Slip', unlockKey: 'faction:longarc:6', unlockLabel: 'Reach Long Arc Assembly reputation 6', hookDescription: 'Couples Long Arc maneuver gear, reconstruction, faction doctrine, and Singular thermal hardware to the redline route.', effects: [{ stat: 'player-move-speed-mul', value: 1.03 }, { stat: 'weapon-heat-dissipation-mul', value: 1.12 }] },
  { specialization: 'grid-weaver', branch: 'Systems', anchorNodeId: 'systems-power-mastery', idPrefix: 'grid-weaver', entryName: 'Grid Weaver Route', stageName: 'Grid Weaver Integration', hookName: 'Teth Custody Mesh', unlockKey: 'boss:teth', unlockLabel: 'Complete the Interdiction command-target finale', hookDescription: 'Makes relay gear, reconstruction, faction electronics, and Singular network hardware part of one persistent mesh.', effects: [{ stat: 'ability-power-mul', value: 1.06 }, { stat: 'class-skill-control-mul', value: 1.06 }] },
  { specialization: 'capacitor-conductor', branch: 'Systems', anchorNodeId: 'systems-power-mastery', idPrefix: 'capacitor-conductor', entryName: 'Capacitor Conductor Route', stageName: 'Capacitor Conductor Integration', hookName: 'Parallax Bus Harmonics', unlockKey: 'campaign:parallax-debt', unlockLabel: 'Complete Parallax Debt', hookDescription: 'Routes late-campaign bus telemetry through gear, reconstruction, faction electronics, and Singular capacitor hardware.', effects: [{ stat: 'player-max-cap-add', value: 6 }, { stat: 'class-skill-cost-mul', value: 0.95 }] },
  { specialization: 'thermal-shunter', branch: 'Engineering', anchorNodeId: 'engineering-service-mastery', idPrefix: 'thermal-shunter', entryName: 'Thermal Shunter Route', stageName: 'Thermal Shunter Integration', hookName: 'Heliostat Heat Exchange', unlockKey: 'faction:heliostat:6', unlockLabel: 'Reach Heliostat League reputation 6', hookDescription: 'Binds Heliostat thermal gear, reconstruction, faction doctrine, and Singular heat hardware into the Shunter exchange.', effects: [{ stat: 'weapon-heat-dissipation-mul', value: 1.15 }, { stat: 'player-vent-speed-mul', value: 1.12 }] },
];

const specializationIntegrationNodes: OperatorNetworkNode[] = specializationNetworkDefinitions.flatMap(definition => {
  const entryId = `${definition.idPrefix}-network-entry`;
  const stageId = `${definition.idPrefix}-network-stage`;
  const hookId = `${definition.idPrefix}-network-hook`;
  return [
    { id: entryId, kind: 'specialization-entry', branch: definition.branch, name: definition.entryName, description: 'LV15 specialization milestone. Active when this specialization is selected and its anchor Mastery is allocated.', allocationCost: 0, prerequisiteIds: [definition.anchorNodeId], sector: 'outer', specialization: definition.specialization, minLevel: 15, milestone: true },
    { id: stageId, kind: 'specialization-stage', branch: definition.branch, name: definition.stageName, description: 'LV16 specialization milestone. Opens the late-route field integration node without consuming a progression point.', allocationCost: 0, prerequisiteIds: [entryId], sector: 'outer', specialization: definition.specialization, minLevel: 16, milestone: true },
    { id: hookId, kind: 'specialization-hook', branch: definition.branch, name: definition.hookName, description: definition.hookDescription, allocationCost: 1, prerequisiteIds: [stageId], sector: 'outer', specialization: definition.specialization, minLevel: 16, unlockKey: definition.unlockKey, unlockLabel: definition.unlockLabel, integrationHooks: ['gear', 'crafting', 'faction', 'singular'], effects: definition.effects },
  ];
});

export const operatorNetworkSpecializationNodes = specializationIntegrationNodes;

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
  ...buildDefiningNodes,
  ...specializationIntegrationNodes,
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

const specializationIntegrationEdges: OperatorNetworkEdge[] = specializationNetworkDefinitions.flatMap(definition => {
  const entryId = `${definition.idPrefix}-network-entry`;
  const stageId = `${definition.idPrefix}-network-stage`;
  const hookId = `${definition.idPrefix}-network-hook`;
  return [
    { a: definition.anchorNodeId, b: entryId, route: 'branch' as const },
    { a: entryId, b: stageId, route: 'branch' as const },
    { a: stageId, b: hookId, route: 'branch' as const },
  ];
});

const buildDefiningEdges: OperatorNetworkEdge[] = [
  { a: 'ballistics-3', b: 'ballistics-terminal-mastery', route: 'branch' },
  { a: 'ballistics-terminal-mastery', b: 'ballistics-overpenetration-keystone', route: 'branch' },
  { a: 'ballistics-terminal-mastery', b: 'ballistics-breach-economy-keystone', route: 'branch' },
  { a: 'ballistics-overpenetration-keystone', b: 'ballistics-terminal-collapse-capstone', route: 'branch' },
  { a: 'ballistics-breach-economy-keystone', b: 'ballistics-terminal-collapse-capstone', route: 'branch' },

  { a: 'mobility-3', b: 'mobility-inertial-mastery', route: 'branch' },
  { a: 'mobility-inertial-mastery', b: 'mobility-redline-keystone', route: 'branch' },
  { a: 'mobility-inertial-mastery', b: 'mobility-countermass-keystone', route: 'branch' },
  { a: 'mobility-redline-keystone', b: 'mobility-vector-priority-capstone', route: 'branch' },
  { a: 'mobility-countermass-keystone', b: 'mobility-vector-priority-capstone', route: 'branch' },

  { a: 'systems-3', b: 'systems-power-mastery', route: 'branch' },
  { a: 'systems-power-mastery', b: 'systems-open-bus-keystone', route: 'branch' },
  { a: 'systems-power-mastery', b: 'systems-burst-conduction-keystone', route: 'branch' },
  { a: 'systems-open-bus-keystone', b: 'systems-closed-loop-capstone', route: 'branch' },
  { a: 'systems-burst-conduction-keystone', b: 'systems-closed-loop-capstone', route: 'branch' },

  { a: 'survival-3', b: 'survival-shell-mastery', route: 'branch' },
  { a: 'survival-shell-mastery', b: 'survival-pressure-fortress-keystone', route: 'branch' },
  { a: 'survival-shell-mastery', b: 'survival-ablative-reserve-keystone', route: 'branch' },
  { a: 'survival-pressure-fortress-keystone', b: 'survival-redundant-life-support-capstone', route: 'branch' },
  { a: 'survival-ablative-reserve-keystone', b: 'survival-redundant-life-support-capstone', route: 'branch' },

  { a: 'engineering-3', b: 'engineering-service-mastery', route: 'branch' },
  { a: 'engineering-service-mastery', b: 'engineering-hot-feed-keystone', route: 'branch' },
  { a: 'engineering-service-mastery', b: 'engineering-cold-cycle-keystone', route: 'branch' },
  { a: 'engineering-hot-feed-keystone', b: 'engineering-service-supremacy-capstone', route: 'branch' },
  { a: 'engineering-cold-cycle-keystone', b: 'engineering-service-supremacy-capstone', route: 'branch' },

  { a: 'awareness-3', b: 'awareness-solution-mastery', route: 'branch' },
  { a: 'awareness-solution-mastery', b: 'awareness-perfect-solution-keystone', route: 'branch' },
  { a: 'awareness-solution-mastery', b: 'awareness-wide-mesh-keystone', route: 'branch' },
  { a: 'awareness-perfect-solution-keystone', b: 'awareness-predictive-dominance-capstone', route: 'branch' },
  { a: 'awareness-wide-mesh-keystone', b: 'awareness-predictive-dominance-capstone', route: 'branch' },
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
  ...buildDefiningEdges,
  ...specializationIntegrationEdges,
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
    return !!node && node.kind !== 'class-start' && !node.milestone;
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
  reason: 'allocated' | 'unknown-node' | 'class-start' | 'milestone-managed' | 'already-allocated' | 'insufficient-points' | 'missing-prerequisite' | 'not-connected' | 'wrong-arsenal' | 'exclusive-choice' | 'level-gate' | 'specialization-gate' | 'external-gate';
};

function operatorNetworkContextReason(node: OperatorNetworkNode, context?: OperatorNetworkUnlockContext) {
  if (node.specialization && context?.specialization !== node.specialization) return 'specialization-gate' as const;
  if (node.minLevel && (context?.level ?? 0) < node.minLevel) return 'level-gate' as const;
  if (node.unlockKey && !context?.unlockKeys?.includes(node.unlockKey)) return 'external-gate' as const;
  return null;
}

function milestoneActiveInternal(state: OperatorNetworkState, nodeId: string, context: OperatorNetworkUnlockContext | undefined, visiting: Set<string>): boolean {
  const node = operatorNetworkNode(nodeId);
  if (!node?.milestone || visiting.has(nodeId) || operatorNetworkContextReason(node, context)) return false;
  visiting.add(nodeId);
  const satisfied = node.prerequisiteIds.every(requiredId => {
    if (state.allocatedNodeIds.includes(requiredId) || requiredId === state.startNodeId) return true;
    return milestoneActiveInternal(state, requiredId, context, visiting);
  });
  visiting.delete(nodeId);
  return satisfied;
}

export function operatorNetworkMilestoneActive(state: OperatorNetworkState, nodeId: string, context?: OperatorNetworkUnlockContext) {
  return milestoneActiveInternal(state, nodeId, context, new Set());
}

export function operatorNetworkNodeGateReason(state: OperatorNetworkState, nodeId: string, context?: OperatorNetworkUnlockContext) {
  const node = operatorNetworkNode(nodeId);
  if (!node) return 'unknown-node' as const;
  const contextReason = operatorNetworkContextReason(node, context);
  if (contextReason) return contextReason;
  if (node.milestone) return operatorNetworkMilestoneActive(state, nodeId, context) ? null : 'missing-prerequisite' as const;
  const owned = operatorNetworkOwnedNodeIds(state, context);
  if (node.prerequisiteIds.some(requiredId => !owned.has(requiredId))) return 'missing-prerequisite' as const;
  return null;
}

function operatorNetworkOwnedNodeIds(state: OperatorNetworkState, context?: OperatorNetworkUnlockContext) {
  const owned = new Set([state.startNodeId, ...state.allocatedNodeIds]);
  for (const node of operatorNetworkNodes) if (node.milestone && operatorNetworkMilestoneActive(state, node.id, context)) owned.add(node.id);
  return owned;
}

export function allocateOperatorNetworkNode(state: OperatorNetworkState, nodeId: string, context?: OperatorNetworkUnlockContext): OperatorNetworkAllocationResult {
  const node = operatorNetworkNode(nodeId);
  if (!node) return { state, allocated: false, reason: 'unknown-node' };
  if (node.kind === 'class-start') return { state, allocated: false, reason: 'class-start' };
  if (node.milestone) return { state, allocated: false, reason: 'milestone-managed' };
  if (node.weaponFamily && weaponFamilyByStartNodeId[state.startNodeId] !== node.weaponFamily) return { state, allocated: false, reason: 'wrong-arsenal' };
  if (state.allocatedNodeIds.includes(nodeId)) return { state, allocated: false, reason: 'already-allocated' };
  const contextReason = operatorNetworkContextReason(node, context);
  if (contextReason) return { state, allocated: false, reason: contextReason };
  if (node.exclusiveGroup && state.allocatedNodeIds.some(id => id !== nodeId && operatorNetworkNode(id)?.exclusiveGroup === node.exclusiveGroup)) return { state, allocated: false, reason: 'exclusive-choice' };
  if (state.unspentPoints < node.allocationCost) return { state, allocated: false, reason: 'insufficient-points' };

  const owned = operatorNetworkOwnedNodeIds(state, context);
  if (node.prerequisiteIds.some(requiredId => !owned.has(requiredId))) return { state, allocated: false, reason: 'missing-prerequisite' };
  const connected = operatorNetworkNeighbors(nodeId).some(neighborId => owned.has(neighborId));
  if (!connected) return { state, allocated: false, reason: 'not-connected' };

  return { allocated: true, reason: 'allocated', state: { ...state, allocatedNodeIds: [...state.allocatedNodeIds, nodeId], unspentPoints: state.unspentPoints - node.allocationCost } };
}

export function operatorNetworkRouteToNode(state: OperatorNetworkState, targetNodeId: string, context?: OperatorNetworkUnlockContext): OperatorNetworkRoute | null {
  const target = operatorNetworkNode(targetNodeId);
  if (!target || target.kind === 'class-start') return null;
  if (target.milestone) return operatorNetworkMilestoneActive(state, targetNodeId, context) ? { nodeIds: [], pointCost: 0 } : null;
  if (operatorNetworkContextReason(target, context)) return null;
  if (state.allocatedNodeIds.includes(targetNodeId)) return { nodeIds: [], pointCost: 0 };
  if (target.exclusiveGroup && state.allocatedNodeIds.some(id => id !== targetNodeId && operatorNetworkNode(id)?.exclusiveGroup === target.exclusiveGroup)) return null;

  const allocated = new Set(state.allocatedNodeIds);
  const owned = operatorNetworkOwnedNodeIds(state, context);
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
      if (operatorNetworkContextReason(neighbor, context)) continue;
      if (neighbor.milestone && !owned.has(neighborId)) continue;

      const pathSet = new Set([...allocated, ...owned, ...current.path]);
      if (neighbor.exclusiveGroup && [...pathSet].some(id => id !== neighborId && operatorNetworkNode(id)?.exclusiveGroup === neighbor.exclusiveGroup)) continue;
      if (neighbor.kind !== 'class-start' && neighbor.prerequisiteIds.some(requiredId => !pathSet.has(requiredId))) continue;

      const alreadyOwned = owned.has(neighborId);
      const alreadyInPath = current.path.includes(neighborId);
      const nextPath = neighbor.kind === 'class-start' || neighbor.milestone || alreadyOwned || alreadyInPath ? current.path : [...current.path, neighborId];
      const nextCost = current.cost + (neighbor.kind === 'class-start' || neighbor.milestone || alreadyOwned || alreadyInPath ? 0 : neighbor.allocationCost);
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
