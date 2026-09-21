import type { ItemRarity } from './rarity';
import { rarityModifierBudget } from './gearAffixes';

export type ModifierFamily = 'core' | 'systems';
export type ModifierGrade = 1 | 2 | 3 | 4 | 5;
export type RecoveryQualityGrade = 0 | 1 | 2 | 3 | 4 | 5;
export type RecoverableRarity = Exclude<ItemRarity, 'Singular'>;

export type RecoveryQualitySource = {
  operationTier: number;
  threatBudget: number;
  eliteKills: number;
  eliteProtocolCount: number;
  deep: boolean;
  optionalObjectives: number;
  environmentalComplications: number;
  boss: boolean;
  location?: string;
  faction?: string;
  factionReputation?: number;
  directiveBonus?: number;
};

const coreModifierIds = new Set(['hypervelocity', 'countermass', 'overdrive', 'cryoloop', 'extendedFeed', 'tungsten', 'vacuumSeal', 'servoWeave']);
const powerByGrade: Record<ModifierGrade, number> = { 1: 0.65, 2: 0.82, 3: 1, 4: 1.18, 5: 1.38 };
const tradeoffByGrade: Record<ModifierGrade, number> = { 1: 0.78, 2: 0.9, 3: 1, 4: 1.08, 5: 1.16 };
const qualityFloor: Record<RecoveryQualityGrade, ModifierGrade> = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 3, 5: 4 };
const qualityNames: Record<RecoveryQualityGrade, string> = { 0: 'Routine', 1: 'Screened', 2: 'Select', 3: 'High-Spec', 4: 'Exceptional', 5: 'Prime' };
const locationQuality: Record<string, number> = { 'orbital-station': 0.06, 'damaged-vessel': 0.12, 'asteroid-refinery': 0.18, 'spin-habitat': 0.14, 'jovian-harvester': 0.2, 'ice-mine': 0.14, 'solar-yard': 0.2, 'lattice-annex': 0.28 };
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function modifierFamilyFor(id: string): ModifierFamily { return coreModifierIds.has(id) ? 'core' : 'systems'; }
export function modifierPowerFactor(grade: ModifierGrade) { return powerByGrade[grade]; }
export function modifierTradeoffFactor(grade: ModifierGrade) { return tradeoffByGrade[grade]; }
export function modifierGradeCeilingForRecovery(recoveryLevel: number): ModifierGrade { if (recoveryLevel >= 43) return 5; if (recoveryLevel >= 31) return 4; if (recoveryLevel >= 19) return 3; return 2; }
export function rollModifierGrade(recoveryLevel: number, quality: RecoveryQualityGrade, random: () => number): ModifierGrade { const ceiling = modifierGradeCeilingForRecovery(recoveryLevel); const floor = Math.min(ceiling, qualityFloor[quality]) as ModifierGrade; const span = ceiling - floor + 1; if (span <= 1) return floor; const biased = Math.pow(random(), 1 / (1 + quality * 0.22)); return (floor + Math.min(span - 1, Math.floor(biased * span))) as ModifierGrade; }
export function rollRarityForQuality(random: () => number, quality: RecoveryQualityGrade): RecoverableRarity { const roll = random(); const prototypeChance = [0.08, 0.14, 0.24, 0.4, 0.6, 0.78][quality] ?? 0.08; const refinedChance = [0.52, 0.58, 0.64, 0.56, 0.4, 0.22][quality] ?? 0.52; if (roll < prototypeChance) return 'Prototype'; if (roll < prototypeChance + refinedChance) return 'Refined'; return 'Field'; }
export function modifierCountForRarity(rarity: RecoverableRarity, quality: RecoveryQualityGrade, random: () => number) { const budget = rarityModifierBudget(rarity); if (!budget.randomRolls) return 0; if (rarity === 'Refined') return Math.min(budget.maxExplicit, random() < Math.min(0.88, 0.58 + quality * 0.06) ? 2 : 1); const roll = random(); const desired = roll < 1 / 12 ? 6 : roll < 4 / 12 ? 5 : 4; return Math.min(budget.maxExplicit, desired); }
export function recoveryQualityPressure(source: RecoveryQualitySource) { const tier = clamp(source.operationTier, 1, 12) * 0.18; const threat = Math.max(0, source.threatBudget - 28) / 40; const elites = Math.min(2, Math.max(0, source.eliteKills)) * 0.4; const protocols = Math.min(4, Math.max(0, source.eliteProtocolCount)) * 0.2; const depth = source.deep ? 0.75 : 0; const optional = Math.min(3, Math.max(0, source.optionalObjectives)) * 0.22; const events = Math.min(4, Math.max(0, source.environmentalComplications)) * 0.12; const boss = source.boss ? 0.95 : 0; const location = locationQuality[source.location ?? ''] ?? 0; const sponsor = source.faction ? 0.08 + Math.min(0.12, Math.max(0, source.factionReputation ?? 0) * 0.006) : 0; const directive = clamp(source.directiveBonus ?? 0, 0, 1.8); return clamp(tier + threat + elites + protocols + depth + optional + events + boss + location + sponsor + directive, 0, 7); }
export function rollRecoveryQuality(random: () => number, source: RecoveryQualitySource): RecoveryQualityGrade { const value = recoveryQualityPressure(source) + (random() - 0.5) * 2.2; if (value >= 5.3) return 5; if (value >= 4.2) return 4; if (value >= 3.2) return 3; if (value >= 2.2) return 2; if (value >= 1.2) return 1; return 0; }
export function recoveryQualityLabel(quality: RecoveryQualityGrade) { return qualityNames[quality]; }
