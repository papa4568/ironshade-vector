export type GroundLootRarity = 'Field' | 'Refined' | 'Prototype' | 'Singular';
export type GroundLootSource = 'standard' | 'enhanced' | 'elite' | 'boss';
export type GroundLootCombatClass = 'standard' | 'enhanced' | 'elite' | 'command';
export type GroundLootQualityFloor = 0 | 1 | 2 | 3 | 4 | 5;

export type GroundLootDrop = {
  id: string;
  enemyId: number;
  enemyLabel: string;
  x: number;
  y: number;
  rarity: GroundLootRarity;
  source: GroundLootSource;
  recoveryQualityFloor: GroundLootQualityFloor;
  recoveryLevel: number;
  monsterLevel: number;
  active: boolean;
  collected: boolean;
  age: number;
};

export type GroundLootReceipt = Pick<GroundLootDrop,
  'id' | 'enemyId' | 'enemyLabel' | 'rarity' | 'source' | 'recoveryQualityFloor' | 'recoveryLevel' | 'monsterLevel'
>;

export type GroundLootRollInput = {
  enemyId: number;
  enemyLabel: string;
  role: 'assault' | 'suppressor' | 'technician' | 'elite' | 'boss';
  combatClass: GroundLootCombatClass;
  x: number;
  y: number;
  operationTier: number;
  maxRecoveryLevel: number;
  monsterLevel: number;
  sequence: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sourceFor(input: GroundLootRollInput): GroundLootSource {
  if (input.role === 'boss' || input.combatClass === 'command') return 'boss';
  if (input.role === 'elite' || input.combatClass === 'elite') return 'elite';
  if (input.combatClass === 'enhanced') return 'enhanced';
  return 'standard';
}

function qualityFloor(source: GroundLootSource, operationTier: number): GroundLootQualityFloor {
  if (source === 'boss') return operationTier >= 9 ? 5 : 4;
  if (source === 'elite') return operationTier >= 8 ? 4 : 3;
  if (source === 'enhanced') return operationTier >= 9 ? 3 : 2;
  return operationTier >= 10 ? 2 : operationTier >= 6 ? 1 : 0;
}

function recoveryPenalty(source: GroundLootSource) {
  if (source === 'boss') return 0;
  if (source === 'elite') return 2;
  if (source === 'enhanced') return 4;
  return 6;
}

function dropChance(source: GroundLootSource, tier: number) {
  if (source === 'boss') return 1;
  if (source === 'elite') return Math.min(0.98, 0.8 + tier * 0.015);
  if (source === 'enhanced') return Math.min(0.52, 0.3 + tier * 0.015);
  return Math.min(0.24, 0.12 + tier * 0.008);
}

function rarityFor(source: GroundLootSource, tier: number, roll: number): GroundLootRarity {
  if (source === 'boss') {
    const singularChance = 0.04 + tier * 0.009;
    return roll < singularChance ? 'Singular' : 'Prototype';
  }

  if (source === 'elite') {
    const singularChance = 0.006 + tier * 0.0015;
    const prototypeChance = 0.24 + tier * 0.025;
    const refinedChance = 0.6 - tier * 0.015;
    if (roll < singularChance) return 'Singular';
    if (roll < singularChance + prototypeChance) return 'Prototype';
    if (roll < singularChance + prototypeChance + refinedChance) return 'Refined';
    return 'Field';
  }

  if (source === 'enhanced') {
    const singularChance = 0.0015 + tier * 0.0005;
    const prototypeChance = 0.05 + tier * 0.012;
    const refinedChance = 0.58 + tier * 0.01;
    if (roll < singularChance) return 'Singular';
    if (roll < singularChance + prototypeChance) return 'Prototype';
    if (roll < singularChance + prototypeChance + refinedChance) return 'Refined';
    return 'Field';
  }

  const singularChance = 0.0005 + tier * 0.00025;
  const prototypeChance = tier >= 5 ? 0.015 + (tier - 5) * 0.006 : 0;
  const refinedChance = 0.26 + tier * 0.02;
  if (roll < singularChance) return 'Singular';
  if (roll < singularChance + prototypeChance) return 'Prototype';
  if (roll < singularChance + prototypeChance + refinedChance) return 'Refined';
  return 'Field';
}

export function rollGroundLoot(input: GroundLootRollInput, random: () => number): GroundLootDrop | null {
  const source = sourceFor(input);
  const tier = clamp(Math.round(input.operationTier), 1, 12);
  if (random() >= dropChance(source, tier)) return null;

  const rarity = rarityFor(source, tier, random());
  const recoveryLevel = Math.max(1, Math.round(input.maxRecoveryLevel - recoveryPenalty(source)));
  return {
    id: `ground-${input.enemyId}-${input.sequence}`,
    enemyId: input.enemyId,
    enemyLabel: input.enemyLabel,
    x: input.x,
    y: input.y,
    rarity,
    source,
    recoveryQualityFloor: qualityFloor(source, tier),
    recoveryLevel,
    monsterLevel: Math.max(1, Math.round(input.monsterLevel)),
    active: true,
    collected: false,
    age: 0,
  };
}

export function lootColor(rarity: GroundLootRarity) {
  if (rarity === 'Singular') return 0xf0a45b;
  if (rarity === 'Prototype') return 0xc47ce8;
  if (rarity === 'Refined') return 0x69aee8;
  return 0xc3d0ca;
}

export function lootLabel(rarity: GroundLootRarity) {
  if (rarity === 'Singular') return 'SINGULAR RECOVERY';
  if (rarity === 'Prototype') return 'PROTOTYPE RECOVERY';
  if (rarity === 'Refined') return 'REFINED RECOVERY';
  return 'FIELD RECOVERY';
}
