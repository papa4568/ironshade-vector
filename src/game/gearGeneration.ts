import type { AffixId, EquipmentSlot, Rarity } from './meta';
import type { EquipmentFaction } from './factionGear';
import type { GearBaseDefinition } from './gearSchema';
import type { ModifierGrade, RecoveryQualityGrade } from './lootQuality';
import type { FrameGeneration } from './scaling';
import { factionFrameIdentity, factionFrames } from './factionGear';
import { augmentSlotCount, rollEquipmentQuality } from './gearDepth';
import { gearBaseForFrameIdentity, gearBasesForSlot } from './gearBases';
import {
  affixGradeDefinition,
  gearAffixDefinition,
  isAffixEligibleForRoll,
  rarityModifierBudget,
  validateAffixSet,
  weightedAffixChoice,
} from './gearAffixes';
import {
  modifierCountForRarity,
  rollModifierGrade,
  rollRarityForQuality,
} from './lootQuality';
import { frameGenerationForRecovery } from './scaling';

export type GearGenerationOpportunity = 'standard' | 'enhanced' | 'elite' | 'boss' | 'deep';

export type GeneratedGearAffix = {
  id: AffixId;
  grade: ModifierGrade;
};

export type GeneratedGearPlan = {
  slot: EquipmentSlot;
  base: GearBaseDefinition;
  rarity: Exclude<Rarity, 'Singular'>;
  recoveryLevel: number;
  recoveryQuality: RecoveryQualityGrade;
  frameGeneration: FrameGeneration;
  equipmentQuality: number;
  augmentSlots: number;
  affixes: GeneratedGearAffix[];
  faction?: EquipmentFaction;
  source: GearGenerationOpportunity;
};

export type GenerateGearPlanInput = {
  slot: EquipmentSlot;
  recoveryLevel: number;
  recoveryQuality: RecoveryQualityGrade;
  frameOperatorLevel: number;
  random: () => number;
  forcedRarity?: Exclude<Rarity, 'Singular'>;
  forcedModifierCount?: number;
  forcedAffixes?: AffixId[];
  preferredAffixes?: AffixId[];
  faction?: EquipmentFaction;
  source?: GearGenerationOpportunity;
};

const rarityRank: Record<Exclude<Rarity, 'Singular'>, number> = {
  Field: 0,
  Refined: 1,
  Prototype: 2,
};

function clampRoll(value: number) {
  return Math.max(0, Math.min(0.999999, value));
}

function opportunityRolls(source: GearGenerationOpportunity) {
  if (source === 'boss') return 4;
  if (source === 'deep') return 3;
  if (source === 'elite') return 3;
  if (source === 'enhanced') return 2;
  return 1;
}

function maximumCompatibleAffixCount(
  slot: EquipmentSlot,
  recoveryLevel: number,
  pool: readonly AffixId[],
) {
  let best = 0;
  const visit = (index: number, chosen: AffixId[]) => {
    best = Math.max(best, chosen.length);
    for (let nextIndex = index; nextIndex < pool.length; nextIndex += 1) {
      const id = pool[nextIndex];
      if (!isAffixEligibleForRoll(id, slot, recoveryLevel, pool, chosen)) continue;
      visit(nextIndex + 1, [...chosen, id]);
    }
  };
  visit(0, []);
  return best;
}

function eligibleBasePool(
  slot: EquipmentSlot,
  frameGeneration: FrameGeneration,
  recoveryLevel: number,
  rarity: Exclude<Rarity, 'Singular'>,
  forcedAffixes: readonly AffixId[],
  faction?: EquipmentFaction,
) {
  const budget = rarityModifierBudget(rarity);
  const minimumAffixes = Math.max(forcedAffixes.length, budget.minGenerated);
  if (faction) {
    const fixed = gearBaseForFrameIdentity(slot, factionFrameIdentity(faction, slot));
    if (fixed
      && forcedAffixes.every(id => fixed.allowedAffixGroups.includes(id))
      && maximumCompatibleAffixCount(slot, recoveryLevel, fixed.allowedAffixGroups) >= minimumAffixes) {
      return [fixed];
    }
  }

  const generationPool = gearBasesForSlot(slot, frameGeneration)
    .filter(base => forcedAffixes.every(id => base.allowedAffixGroups.includes(id)));
  const antiJunkPool = generationPool.filter(base =>
    maximumCompatibleAffixCount(slot, recoveryLevel, base.allowedAffixGroups) >= minimumAffixes
  );
  return antiJunkPool.length > 0 ? antiJunkPool : generationPool;
}

function rollAffixSet(
  base: GearBaseDefinition,
  count: number,
  input: GenerateGearPlanInput,
) {
  const chosen: AffixId[] = [];
  const forced = input.forcedAffixes ?? [];
  const preferred = input.preferredAffixes ?? [];

  for (const id of forced) {
    if (isAffixEligibleForRoll(id, input.slot, input.recoveryLevel, base.allowedAffixGroups, chosen)) chosen.push(id);
  }

  const capacity = maximumCompatibleAffixCount(input.slot, input.recoveryLevel, base.allowedAffixGroups);
  const target = Math.min(Math.max(count, chosen.length), capacity);
  while (chosen.length < target) {
    const remaining = base.allowedAffixGroups.filter(id =>
      isAffixEligibleForRoll(id, input.slot, input.recoveryLevel, base.allowedAffixGroups, chosen)
    );
    if (remaining.length === 0) break;

    const wantedFamily = chosen.length % 2 === 0 ? 'core' : 'systems';
    const familyCandidates = remaining.filter(id => gearAffixDefinition(id).family === wantedFamily);
    let candidates = familyCandidates.length > 0 ? familyCandidates : remaining;
    const preferredCandidates = candidates.filter(id => preferred.includes(id));
    if (preferredCandidates.length > 0 && input.random() < 0.78) candidates = preferredCandidates;

    const candidate = weightedAffixChoice(candidates, input.random);
    if (!candidate) break;
    chosen.push(candidate);
  }

  return chosen.map(id => ({
    id,
    grade: rollModifierGrade(input.recoveryLevel, input.recoveryQuality, input.random),
  }));
}

function candidatePriority(plan: GeneratedGearPlan, preferredAffixes: readonly AffixId[]) {
  const preferredHits = plan.affixes.filter(affix => preferredAffixes.includes(affix.id)).length;
  const gradeTotal = plan.affixes.reduce((sum, affix) => sum + affix.grade, 0);
  return [
    rarityRank[plan.rarity],
    plan.affixes.length,
    preferredHits,
    gradeTotal,
    plan.equipmentQuality,
  ];
}

function outranks(left: GeneratedGearPlan, right: GeneratedGearPlan, preferredAffixes: readonly AffixId[]) {
  const a = candidatePriority(left, preferredAffixes);
  const b = candidatePriority(right, preferredAffixes);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index];
  }
  return false;
}

function makeCandidate(input: GenerateGearPlanInput): GeneratedGearPlan {
  const source = input.source ?? 'standard';
  const frameGeneration = frameGenerationForRecovery(input.recoveryLevel, input.frameOperatorLevel);
  const rarity = input.forcedRarity ?? rollRarityForQuality(input.random, input.recoveryQuality);
  const requestedCount = input.forcedModifierCount ?? modifierCountForRarity(rarity, input.recoveryQuality, input.random);
  const bases = eligibleBasePool(
    input.slot,
    frameGeneration,
    input.recoveryLevel,
    rarity,
    input.forcedAffixes ?? [],
    input.faction,
  );
  if (bases.length === 0) throw new Error(`No eligible gear base for ${input.slot} at G${frameGeneration} / RL${input.recoveryLevel}.`);
  const base = bases[Math.min(bases.length - 1, Math.floor(clampRoll(input.random()) * bases.length))];
  const equipmentQuality = rollEquipmentQuality(input.random);
  return {
    slot: input.slot,
    base,
    rarity,
    recoveryLevel: input.recoveryLevel,
    recoveryQuality: input.recoveryQuality,
    frameGeneration,
    equipmentQuality,
    augmentSlots: augmentSlotCount(rarity, frameGeneration),
    affixes: rollAffixSet(base, requestedCount, input),
    faction: input.faction,
    source,
  };
}

export function validateGeneratedGearPlan(plan: GeneratedGearPlan) {
  if (plan.base.slot !== plan.slot) return false;
  if (plan.frameGeneration < plan.base.generationRange[0] || plan.frameGeneration > plan.base.generationRange[1]) return false;
  if (plan.augmentSlots !== augmentSlotCount(plan.rarity, plan.frameGeneration)) return false;

  const budget = rarityModifierBudget(plan.rarity);
  if (plan.affixes.length < budget.minGenerated || plan.affixes.length > budget.maxExplicit) return false;
  if (!validateAffixSet({
    slot: plan.slot,
    recoveryLevel: plan.recoveryLevel,
    rarity: plan.rarity,
    baseAllowedAffixes: plan.base.allowedAffixGroups,
    affixes: plan.affixes.map(affix => affix.id),
  })) return false;

  return plan.affixes.every(affix =>
    affixGradeDefinition(affix.id, affix.grade).minimumRecoveryLevel <= plan.recoveryLevel
  );
}

export function generateGearPlan(input: GenerateGearPlanInput) {
  const source = input.source ?? 'standard';
  const preferredAffixes = input.preferredAffixes
    ?? (input.faction ? factionFrames[input.faction][input.slot].preferredAffixes : []);
  const attempts = opportunityRolls(source);
  let best: GeneratedGearPlan | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = makeCandidate({ ...input, preferredAffixes, source });
    if (!validateGeneratedGearPlan(candidate)) continue;
    if (!best || outranks(candidate, best, preferredAffixes)) best = candidate;
  }

  if (best) return best;

  const fallback = makeCandidate({
    ...input,
    preferredAffixes,
    source,
    forcedRarity: input.forcedRarity ?? 'Refined',
    forcedModifierCount: input.forcedModifierCount ?? rarityModifierBudget(input.forcedRarity ?? 'Refined').minGenerated,
  });
  if (!validateGeneratedGearPlan(fallback)) {
    throw new Error(`Unable to generate valid ${input.slot} gear at RL${input.recoveryLevel}.`);
  }
  return fallback;
}
