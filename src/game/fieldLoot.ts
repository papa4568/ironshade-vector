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

export function rollGroundLoot(input: GroundLootRollInput, random: () => number): GroundLootDrop | null {
  const source = sourceFor(input);
  const tier = clamp(Math.round(input.operationTier), 1, 12);
  if (source === 'standard') {
    const chance = 0.14 + tier * 0.012;
    if (random() >= chance) return null;
  } else if (source === 'enhanced') {
    const chance = 0.48 + tier * 0.018;
    if (random() >= chance) return null;
  }

  let rarity: GroundLootRarity = 'Field';
  if (source === 'boss') rarity = 'Singular';
  else if (source === 'elite') rarity = 'Prototype';
  else if (source === 'enhanced') rarity = random() < 0.18 + tier * 0.035 ? 'Prototype' : 'Refined';
  else {
    const prototypeChance = tier >= 8 ? 0.025 + (tier - 8) * 0.012 : 0;
    if (random() < prototypeChance) rarity = 'Prototype';
    else rarity = random() < 0.24 + tier * 0.025 ? 'Refined' : 'Field';
  }

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
