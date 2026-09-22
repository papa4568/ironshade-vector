import type { SalvageWallet } from './campaign';
import { augmentSocketCap, availableAugments, augmentDefinition, frameImplicitDescription, resolveFrameIdentity, type AugmentId } from './gearDepth';
import { modifierFamilyFor, modifierGradeCeilingForRecovery, type ModifierFamily, type ModifierGrade } from './lootQuality';
import { hasSpecializationNetworkHook, itemMatchesSpecializationGearSynergy, materializeModifier, type AffixId, type Item, type PlayerProfile } from './meta';
import { maximumExplicitModifiersForRarity } from './gearAffixes';
import { craftingAffixPool, craftingFabricationGradeCap, craftingStabilityContract, craftingStabilityForItem, craftingVolatileSuccessChance, legalCraftingAffixes } from './craftingRules';

export type ReconstructionAction =
  | { kind: 'quality' }
  | { kind: 'grade'; modifierId: AffixId; targetGrade?: ModifierGrade; mode?: 'controlled' | 'volatile' }
  | { kind: 'reroute'; modifierId: AffixId; targetAffixId?: AffixId }
  | { kind: 'add'; family: ModifierFamily; targetAffixId?: AffixId }
  | { kind: 'remove'; modifierId: AffixId }
  | { kind: 'recalibrate'; modifierId: AffixId; lockedFamily: ModifierFamily; targetAffixId?: AffixId; mode?: 'protected' | 'volatile' }
  | { kind: 'installAugment'; augmentId: AugmentId }
  | { kind: 'removeAugment'; augmentId: AugmentId };

export type ReconstructionResult = {
  profile: PlayerProfile;
  wallet: SalvageWallet;
  message: string;
};

const clampFabrication = (level: number) => Math.max(0, Math.min(2, Math.round(level)));
export const reconstructionQualityCap = (fabricationLevel: number) => [10, 16, 20][clampFabrication(fabricationLevel)];
export const reconstructionGradeCap = craftingFabricationGradeCap;
export const reconstructionStability = craftingStabilityForItem;
export const reconstructionVolatileSuccessChance = craftingVolatileSuccessChance;
export const accessibleAugmentSlots = (item: Item, fabricationLevel: number) => Math.min(item.augmentSlots ?? 0, augmentSocketCap, 1 + clampFabrication(fabricationLevel));

function discountedCredits(value: number, fabricationLevel: number) {
  return Math.max(1, Math.round(value * (1 - clampFabrication(fabricationLevel) * 0.1)));
}

export function reconstructionCost(item: Item, action: ReconstructionAction, fabricationLevel: number, profile?: PlayerProfile): Partial<SalvageWallet> {
  const linked = !!profile && hasSpecializationNetworkHook(profile, 'crafting') && itemMatchesSpecializationGearSynergy(profile, item);
  const finalize = (cost: Partial<SalvageWallet>) => {
    if (!linked) return cost;
    const discounted: Partial<SalvageWallet> = {};
    for (const [key, value] of Object.entries(cost) as Array<[keyof SalvageWallet, number]>) discounted[key] = value > 0 ? Math.max(1, Math.round(value * 0.88)) : value;
    return discounted;
  };
  if (action.kind === 'quality') {
    const quality = item.equipmentQuality ?? 0;
    return finalize({ credits: discountedCredits(45 + quality * 4, fabricationLevel), alloys: 1 + (quality >= 12 ? 1 : 0), components: quality >= 10 ? 1 : 0 });
  }
  if (action.kind === 'grade') {
    const modifier = item.modifiers.find(entry => entry.id === action.modifierId);
    const grade = modifier?.grade ?? 3;
    const targetGrade = Math.max(grade + 1, action.targetGrade ?? grade + 1) as ModifierGrade;
    const steps = Math.max(1, targetGrade - grade);
    const family = modifier?.family ?? modifierFamilyFor(action.modifierId);
    const volatility = action.mode === 'volatile' ? 0.7 : 1;
    return finalize({
      credits: discountedCredits(Math.round((70 + grade * 25 + Math.max(0, steps - 1) * 55) * volatility), fabricationLevel),
      alloys: family === 'core' ? Math.max(1, Math.round(2 * steps * volatility)) : 0,
      electronics: family === 'systems' ? Math.max(1, Math.round(2 * steps * volatility)) : 0,
      components: targetGrade >= 4 ? Math.max(1, Math.round(steps * volatility)) : 0,
      rareTech: grade < 5 && targetGrade >= 5 ? 1 : 0,
    });
  }
  if (action.kind === 'reroute') return finalize({ credits: discountedCredits(120, fabricationLevel), alloys: 1, electronics: 1, components: 1 });
  if (action.kind === 'add') return finalize({ credits: discountedCredits(action.targetAffixId ? 180 : 130, fabricationLevel), alloys: action.family === 'core' ? 2 : 0, electronics: action.family === 'systems' ? 2 : 0, components: 1, rareTech: action.targetAffixId ? 1 : 0 });
  if (action.kind === 'remove') {
    const modifier = item.modifiers.find(entry => entry.id === action.modifierId);
    const family = modifier?.family ?? (modifier ? modifierFamilyFor(modifier.id) : 'core');
    return finalize({ credits: discountedCredits(55, fabricationLevel), alloys: family === 'core' ? 1 : 0, electronics: family === 'systems' ? 1 : 0, components: 1 });
  }
  if (action.kind === 'recalibrate') return finalize({ credits: discountedCredits(action.mode === 'volatile' ? 70 : 95, fabricationLevel), electronics: action.mode === 'volatile' ? 1 : 2, components: 1, rareTech: action.mode === 'volatile' ? 0 : 1 });
  if (action.kind === 'removeAugment') return finalize({ credits: discountedCredits(20, fabricationLevel) });
  const definition = augmentDefinition(action.augmentId);
  return finalize({ ...definition.cost, credits: discountedCredits(definition.cost.credits ?? 0, fabricationLevel) });
}

function spend(wallet: SalvageWallet, cost: Partial<SalvageWallet>) {
  for (const [key, value] of Object.entries(cost) as Array<[keyof SalvageWallet, number]>) {
    if ((wallet[key] ?? 0) < value) return null;
  }
  const next = { ...wallet };
  for (const [key, value] of Object.entries(cost) as Array<[keyof SalvageWallet, number]>) next[key] -= value;
  return next;
}

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function candidateAffix(item: Item, family: ModifierFamily, excludeId: AffixId | null, salt: string, fabricationLevel: number) {
  const candidates = legalCraftingAffixes(item, fabricationLevel, family, excludeId)
    .map(entry => entry.id)
    .filter(id => id !== excludeId);
  if (candidates.length === 0) return null;
  return candidates[hashText(`${item.id}:${salt}`) % candidates.length];
}

function applyStability(item: Item, delta: number) {
  return { ...item, craftStability: Math.max(0, Math.min(craftingStabilityContract.maximum, craftingStabilityForItem(item) + delta)) };
}

function volatileAttempt(item: Item, salt: string) {
  const stability = craftingStabilityForItem(item);
  const chance = craftingVolatileSuccessChance(item);
  const roll = (hashText(`${item.id}:${salt}:${stability}`) % 10000) / 10000;
  return {
    success: roll < chance,
    chance,
    nextStability: Math.max(0, stability - craftingStabilityContract.volatileDrain),
  };
}

function modifierLimit(item: Item) {
  return maximumExplicitModifiersForRarity(item.rarity);
}

function replaceItem(profile: PlayerProfile, itemId: string, item: Item) {
  return { ...profile, inventory: profile.inventory.map(entry => entry.id === itemId ? item : entry) };
}

export function reconstructItem(profile: PlayerProfile, wallet: SalvageWallet, fabricationLevel: number, itemId: string, action: ReconstructionAction): ReconstructionResult {
  const item = profile.inventory.find(entry => entry.id === itemId);
  if (!item) return { profile, wallet, message: 'Reconstruction target is no longer in ship storage.' };
  const fabrication = clampFabrication(fabricationLevel);
  const cost = reconstructionCost(item, action, fabrication, profile);
  let nextItem: Item | null = null;
  let successMessage = '';

  if (action.kind === 'quality') {
    const cap = reconstructionQualityCap(fabrication);
    const quality = item.equipmentQuality ?? 0;
    if (quality >= cap) return { profile, wallet, message: `Frame quality is already at the Microforge tier-${fabrication} cap (${cap}/20).` };
    const equipmentQuality = Math.min(cap, quality + 2);
    const identity = resolveFrameIdentity(item.slot, item.frameIdentity, `${item.baseId}:${item.name}`);
    nextItem = applyStability({ ...item, equipmentQuality, frameIdentity: identity, frameImplicit: frameImplicitDescription(identity, item.frameGeneration ?? 1, equipmentQuality) }, 8);
    successMessage = `${item.name} frame quality improved to ${equipmentQuality}/20.`;
  }

  if (action.kind === 'grade') {
    if (item.rarity === 'Singular') return { profile, wallet, message: 'Named Singular modifier packages are fixed. Improve frame quality or install Augments instead.' };
    const index = item.modifiers.findIndex(modifier => modifier.id === action.modifierId);
    if (index < 0) return { profile, wallet, message: 'Modifier is no longer present on this item.' };
    if (action.mode === 'volatile' && fabrication < 2) return { profile, wallet, message: 'Microforge tier 2 is required for volatile elevation.' };
    const current = item.modifiers[index];
    const ceiling = Math.min(modifierGradeCeilingForRecovery(item.recoveryLevel ?? 1), reconstructionGradeCap(fabrication)) as ModifierGrade;
    const grade = current.grade ?? 3;
    const targetGrade = (action.targetGrade ?? Math.min(ceiling, grade + 1)) as ModifierGrade;
    if (targetGrade <= grade || targetGrade > ceiling) return { profile, wallet, message: `Choose an elevation grade above G${grade} and no higher than the current G${ceiling} ceiling.` };
    const affixRule = craftingAffixPool(item, fabrication, current.id).find(entry => entry.id === current.id);
    if (!affixRule?.eligibleGrades.includes(targetGrade)) return { profile, wallet, message: `${current.label} cannot legally reach G${targetGrade} at this Recovery Level.` };
    if (action.mode === 'volatile') {
      const attempt = volatileAttempt(item, `elevate:${current.id}:G${targetGrade}`);
      if (!attempt.success) {
        nextItem = { ...item, craftStability: attempt.nextStability };
        successMessage = `Volatile elevation failed at ${Math.round(attempt.chance * 100)}% success chance. ${current.label} held at G${grade}; stability fell to ${attempt.nextStability}%.`;
      } else {
        const modifiers = item.modifiers.map((modifier, modifierIndex) => modifierIndex === index ? materializeModifier(modifier.id, targetGrade) : modifier);
        nextItem = { ...item, modifiers, craftStability: attempt.nextStability };
        successMessage = `Volatile elevation landed: ${current.label} advanced from G${grade} to G${targetGrade}; stability is now ${attempt.nextStability}%.`;
      }
    } else {
      const modifiers = item.modifiers.map((modifier, modifierIndex) => modifierIndex === index ? materializeModifier(modifier.id, targetGrade) : modifier);
      nextItem = applyStability({ ...item, modifiers }, craftingStabilityContract.controlledRecovery);
      successMessage = `${current.label} calibrated from G${grade} to G${targetGrade} with controlled elevation.`;
    }
  }

  if (action.kind === 'reroute') {
    if (fabrication < 1) return { profile, wallet, message: 'Microforge tier 1 is required to reroute modifier families.' };
    if (item.rarity === 'Singular') return { profile, wallet, message: 'Named Singular modifier packages cannot be rerouted.' };
    const index = item.modifiers.findIndex(modifier => modifier.id === action.modifierId);
    if (index < 0) return { profile, wallet, message: 'Modifier is no longer present on this item.' };
    const current = item.modifiers[index];
    const currentFamily = current.family ?? modifierFamilyFor(current.id);
    const targetFamily: ModifierFamily = currentFamily === 'core' ? 'systems' : 'core';
    const legalTargets = legalCraftingAffixes(item, fabrication, targetFamily, current.id);
    const replacement = action.targetAffixId
      ? legalTargets.find(entry => entry.id === action.targetAffixId)?.id ?? null
      : candidateAffix(item, targetFamily, current.id, `reroute:${current.id}`, fabrication);
    if (!replacement) return { profile, wallet, message: action.targetAffixId ? 'Selected reroute target is not legal for this base frame, family, or Recovery Level.' : `No compatible ${targetFamily.toUpperCase()} modifier is available on this frame.` };
    const modifiers = item.modifiers.map((modifier, modifierIndex) => modifierIndex === index ? materializeModifier(replacement, current.grade ?? 3) : modifier);
    nextItem = { ...item, modifiers };
    successMessage = `${current.label} rerouted into a ${targetFamily.toUpperCase()} modifier at the same grade.`;
  }

  if (action.kind === 'add') {
    if (fabrication < 1) return { profile, wallet, message: 'Microforge tier 1 is required to add a targeted modifier.' };
    if (item.rarity === 'Singular') return { profile, wallet, message: 'Named Singular modifier packages are fixed and cannot accept random modifier additions.' };
    const limit = modifierLimit(item);
    if (item.modifiers.length >= limit) return { profile, wallet, message: `${item.rarity} equipment is already at its ${limit}-modifier reconstruction limit.` };
    if (action.targetAffixId && fabrication < 2) return { profile, wallet, message: 'Microforge tier 2 is required for precision Add.' };
    const legalTargets = legalCraftingAffixes(item, fabrication, action.family);
    const replacement = action.targetAffixId
      ? legalTargets.find(entry => entry.id === action.targetAffixId)?.id ?? null
      : candidateAffix(item, action.family, null, `add:${action.family}:${item.modifiers.length}`, fabrication);
    if (!replacement) return { profile, wallet, message: action.targetAffixId ? 'Selected precision Add target is not legal for this base frame, family, or Recovery Level.' : `No unused ${action.family.toUpperCase()} modifier is compatible with this frame.` };
    const grade = Math.min(2, modifierGradeCeilingForRecovery(item.recoveryLevel ?? 1), reconstructionGradeCap(fabrication)) as ModifierGrade;
    nextItem = { ...item, modifiers: [...item.modifiers, materializeModifier(replacement, grade)] };
    successMessage = action.targetAffixId ? `Precision Add installed the selected ${action.family.toUpperCase()} modifier at G${grade}.` : `Added a targeted ${action.family.toUpperCase()} modifier at G${grade}.`;
  }

  if (action.kind === 'remove') {
    if (item.rarity === 'Singular') return { profile, wallet, message: 'Named Singular modifier packages are fixed and cannot have explicit modifiers removed.' };
    const index = item.modifiers.findIndex(modifier => modifier.id === action.modifierId);
    if (index < 0) return { profile, wallet, message: 'Modifier is no longer present on this item.' };
    const removed = item.modifiers[index];
    nextItem = { ...item, modifiers: item.modifiers.filter((_, modifierIndex) => modifierIndex !== index) };
    successMessage = `${removed.label} removed. One explicit modifier slot is open; removal does not refund crafting materials.`;
  }

  if (action.kind === 'recalibrate') {
    if (fabrication < 2) return { profile, wallet, message: 'Microforge tier 2 is required for family-lock recalibration.' };
    if (item.rarity === 'Singular') return { profile, wallet, message: 'Named Singular modifier packages cannot be recalibrated.' };
    const index = item.modifiers.findIndex(modifier => modifier.id === action.modifierId);
    if (index < 0) return { profile, wallet, message: 'Modifier is no longer present on this item.' };
    const current = item.modifiers[index];
    const family = current.family ?? modifierFamilyFor(current.id);
    if (family === action.lockedFamily) return { profile, wallet, message: `${family.toUpperCase()} family is locked and protected from recalibration.` };
    const legalTargets = legalCraftingAffixes(item, fabrication, family, current.id);
    const replacement = action.targetAffixId
      ? legalTargets.find(entry => entry.id === action.targetAffixId)?.id ?? null
      : candidateAffix(item, family, current.id, `recalibrate:${current.id}:${action.lockedFamily}`, fabrication);
    if (!replacement) return { profile, wallet, message: action.targetAffixId ? 'Selected Replace target is not legal for this base frame, family, or Recovery Level.' : `No alternate ${family.toUpperCase()} modifier is available on this frame.` };
    if (action.mode === 'volatile') {
      const attempt = volatileAttempt(item, `replace:${current.id}:${replacement}:${action.lockedFamily}`);
      if (!attempt.success) {
        nextItem = { ...item, craftStability: attempt.nextStability };
        successMessage = `Volatile Replace failed at ${Math.round(attempt.chance * 100)}% success chance. ${current.label} stayed installed; stability fell to ${attempt.nextStability}%.`;
      } else {
        const modifiers = item.modifiers.map((modifier, modifierIndex) => modifierIndex === index ? materializeModifier(replacement, current.grade ?? 3) : modifier);
        nextItem = { ...item, modifiers, craftStability: attempt.nextStability };
        successMessage = `Volatile Replace landed the selected legal ${family.toUpperCase()} modifier while ${action.lockedFamily.toUpperCase()} remained locked; stability is ${attempt.nextStability}%.`;
      }
    } else {
      const modifiers = item.modifiers.map((modifier, modifierIndex) => modifierIndex === index ? materializeModifier(replacement, current.grade ?? 3) : modifier);
      nextItem = applyStability({ ...item, modifiers }, craftingStabilityContract.protectedRecovery);
      successMessage = `${current.label} replaced with the selected legal ${family.toUpperCase()} modifier while ${action.lockedFamily.toUpperCase()} remained locked.`;
    }
  }

  if (action.kind === 'installAugment') {
    const definition = augmentDefinition(action.augmentId);
    if (!definition.slots.includes(item.slot)) return { profile, wallet, message: `${definition.name} is not compatible with this equipment slot.` };
    const augments = item.augments ?? [];
    if (augments.includes(action.augmentId)) return { profile, wallet, message: `${definition.name} is already installed.` };
    const accessible = accessibleAugmentSlots(item, fabrication);
    if (accessible <= 0) return { profile, wallet, message: 'This frame has no accessible Augment sockets.' };
    if (augments.length >= accessible) return { profile, wallet, message: `All ${accessible} currently accessible Augment socket${accessible === 1 ? '' : 's'} are occupied.` };
    nextItem = { ...item, augments: [...augments, action.augmentId] };
    successMessage = `${definition.name} installed in ${definition.hardware.toLowerCase()} socket.`;
  }

  if (action.kind === 'removeAugment') {
    const augments = item.augments ?? [];
    if (!augments.includes(action.augmentId)) return { profile, wallet, message: 'That Augment is no longer installed.' };
    nextItem = { ...item, augments: augments.filter(id => id !== action.augmentId) };
    successMessage = `${augmentDefinition(action.augmentId).name} extracted. No materials were refunded.`;
  }

  if (!nextItem) return { profile, wallet, message: 'No reconstruction action was applied.' };
  const nextWallet = spend(wallet, cost);
  if (!nextWallet) return { profile, wallet, message: 'Insufficient salvage resources for this reconstruction action.' };
  return { profile: replaceItem(profile, itemId, nextItem), wallet: nextWallet, message: successMessage };
}

export function compatibleAugments(item: Item) {
  return availableAugments(item.slot);
}
