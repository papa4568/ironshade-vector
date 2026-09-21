export type OperatorClassId = 'vanguard' | 'vector' | 'systems';

export type AbilityMeta = {
  name: string;
  shortName: string;
  cost: number;
  cooldown: number;
  description: string;
};

export const abilityMeta: readonly [AbilityMeta, AbilityMeta, AbilityMeta] = [
  { name: 'Magnetic Impulse', shortName: 'MAG', cost: 24, cooldown: 5.6, description: 'Displace nearby threats and hostile projectiles.' },
  { name: 'Sensor Spike', shortName: 'MARK', cost: 18, cooldown: 6.8, description: 'Mark a priority target for follow-up fire.' },
  { name: 'Arc Tap', shortName: 'ARC', cost: 30, cooldown: 7.5, description: 'Disrupt a target or exposed machinery with an electrical strike.' },
];

export const classAbilityKits: Record<OperatorClassId, readonly [AbilityMeta, AbilityMeta, AbilityMeta]> = {
  vanguard: [
    { name: 'Breach Rush', shortName: 'RUSH', cost: 18, cooldown: 4.8, description: 'Drive forward behind a magnetic ram, stagger the lane, and immediately raise Breach Guard.' },
    { name: 'Fracture Tag', shortName: 'BREAK', cost: 20, cooldown: 6.2, description: 'Tag one target, tear open its armor path, and drag it toward Breacher range.' },
    { name: 'Bulwark Pulse', shortName: 'GUARD', cost: 28, cooldown: 8.2, description: 'Brace the suit and detonate a close defensive shockwave that staggers enemies around you.' },
  ],
  vector: [
    { name: 'Vector Shift', shortName: 'SHIFT', cost: 15, cooldown: 4.0, description: 'Burst along your aim vector and prime Slipstream without spending the dodge charge.' },
    { name: 'Deadeye Lock', shortName: 'LOCK', cost: 18, cooldown: 5.8, description: 'Acquire a long-range precision lock and prime the next stabilized shot.' },
    { name: 'Splitshot', shortName: 'SPLIT', cost: 24, cooldown: 6.5, description: 'Launch a three-lane high-velocity kinetic fan for mobile ranged pressure.' },
  ],
  systems: [
    { name: 'Polarity Well', shortName: 'WELL', cost: 22, cooldown: 5.2, description: 'Collapse nearby targets toward a projected mass point and disrupt their formation.' },
    { name: 'Relay Hack', shortName: 'HACK', cost: 20, cooldown: 6.3, description: 'Hack a priority target and propagate marks and disruption through nearby hostiles.' },
    { name: 'Cascade Arc', shortName: 'CHAIN', cost: 28, cooldown: 7.0, description: 'Route an electrical cascade through enemies or machinery to keep Closed Loop cycling.' },
  ],
};

export type OperatorWeaponFamily = 'carbine' | 'breacher' | 'rail';

export const operatorWeaponFamilyByClass: Record<OperatorClassId, OperatorWeaponFamily> = {
  vanguard: 'breacher',
  vector: 'rail',
  systems: 'carbine',
};

export function operatorWeaponFamilyForClass(operatorClass: OperatorClassId | null): OperatorWeaponFamily {
  return operatorClass ? operatorWeaponFamilyByClass[operatorClass] : 'carbine';
}

export function getAbilityKitForClass(operatorClass: OperatorClassId | null) {
  return operatorClass ? classAbilityKits[operatorClass] : abilityMeta;
}
