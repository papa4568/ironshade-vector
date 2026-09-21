import type { SalvageWallet } from './campaign';
import { availableAugments, augmentDefinition, frameImplicitDescription, resolveFrameIdentity, type AugmentId } from './gearDepth';
import { modifierFamilyFor, modifierGradeCeilingForRecovery, type ModifierFamily, type ModifierGrade } from './lootQuality';
import { affixPoolForSlot, materializeModifier, type AffixId, type Item, type PlayerProfile } from './meta';
import { affixStatProfile } from './gearStats';
import { resolveGearBase } from './gearBases';
import { gearAffixDefinition, isAffixEligibleForRoll, maximumExplicitModifiersForRarity } from './gearAffixes';

export type ReconstructionAction =
  | { kind: 'quality' }
  | { kind: 'grade'; modifierId: AffixId }
  | { kind: 'reroute'; modifierId: AffixId }
  | { kind: 'add'; family: ModifierFamily }
  | { kind: 'recalibrate'; modifierId: AffixId; lockedFamily: ModifierFamily }
  | { kind: 'installAugment'; augmentId: AugmentId }
  | { kind: 'removeAugment'; augmentId: AugmentId };

export type ReconstructionResult = {
  profile: PlayerProfile;
  wallet: SalvageWallet;
  message: string;
};

const clampFabrication = (level: number) => Math.max(0, Math.min(2, Math.round(level)));
export const reconstructionQualityCap = (fabricationLevel: number) => [10, 16, 20][clampFabrication(fabricationLevel)];
export const reconstructionGradeCap = (fabricationLevel: number) => [3, 4, 5][clampFabrication(fabricationLevel)] as ModifierGrade;
export const accessibleAugmentSlots = (item: Item, fabricationLevel: number) => Math.min(item.augmentSlots ?? 0, 1 + clampFabrication(fabricationLevel));

function discountedCredits(value: number, fabricationLevel: number) {
  return Math.max(1, Math.round(value * (1 - clampFabrication(fabricationLevel) * 0.1)));
}

export function reconstructionCost(item: Item, action: ReconstructionAction, fabricationLevel: number): Partial<SalvageWallet> {
  if (action.kind === 'quality') {
    const quality = item.equipmentQuality ?? 0;
    return { credits: discountedCredits(45 + quality * 4, fabricationLevel), alloys: 1 + (quality >= 12 ? 1 : 0), components: quality >= 10 ? 1 : 0 };
  }
  if (action.kind === 'grade') {
    const modifier = item.modifiers.find(entry => entry.id === action.modifierId);
    const grade = modifier?.grade ?? 3;
    const family = modifier?.family ?? modifierFamilyFor(action.modifierId);
    return { credits: discountedCredits(70 + grade * 25, fabricationLevel), alloys: family === 'core' ? 2 : 0, electronics: family === 'systems' ? 2 : 0, components: grade >= 3 ? 1 : 0 };
  }
  if (action.kind === 'reroute') return { credits: discountedCredits(120, fabricationLevel), alloys: 1, electronics: 1, components: 1 };
  if (action.kind === 'add') return { credits: discountedCredits(130, fabricationLevel), alloys: action.family === 'core' ? 2 : 0, electronics: action.family === 'systems' ? 2 : 0, components: 1 };
  if (action.kind === 'recalibrate') return { credits: discountedCredits(95, fabricationLevel), electronics: 2, components: 1 };
  if (action.kind === 'removeAugment') return { credits: discountedCredits(20, fabricationLevel) };
  const definition = augmentDefinition(action.augmentId);
  return { ...definition.cost, credits: discountedCredits(definition.cost.credits ?? 0, fabricationLevel) };
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

function candidateAffix(item: Item, family: ModifierFamily, excludeId: AffixId | null, salt: string) {
  const occupied = item.modifiers.map(modifier => modifier.id).filter(id => id !== excludeId);
  const base = resolveGearBase(item.slot, item.baseId, item.frameIdentity);
  const pool = base?.allowedAffixGroups ?? affixPoolForSlot(item.slot);
  const recoveryLevel = item.recoveryLevel ?? 1;
  const candidates = pool.filter(id =>
    affixStatProfile(id).stats.length > 0
      && gearAffixDefinition(id).family === family
      && id !== excludeId
      && isAffixEligibleForRoll(id, item.slot, recoveryLevel, pool, occupied)
  );
  if (candidates.length === 0) return null;
  return candidates[hashText(`${item.id}:${salt}`) % candidates.length];
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
  const cost = reconstructionCost(item, action, fabrication);
  let nextItem: Item | null = null;
  let successMessage = '';

  if (action.kind === 'quality') {
    const cap = reconstructionQualityCap(fabrication);
    const quality = item.equipmentQuality ?? 0;
    if (quality >= cap) return { profile, wallet, message: `Frame quality is already at the Microforge tier-${fabrication} cap (${cap}/20).` };
    const equipmentQuality = Math.min(cap, quality + 2);
    const identity = resolveFrameIdentity(item.slot, item.frameIdentity, `${item.baseId}:${item.name}`);
    nextItem = { ...item, equipmentQuality, frameIdentity: identity, frameImplicit: frameImplicitDescription(identity, item.frameGeneration ?? 1, equipmentQuality) };
    successMessage = `${item.name} frame quality improved to ${equipmentQuality}/20.`;
  }

  if (action.kind === 'grade') {
    if (item.rarity === 'Singular') return { profile, wallet, message: 'Named Singular modifier packages are fixed. Improve frame quality or install Augments instead.' };
    const index = item.modifiers.findIndex(modifier => modifier.id === action.modifierId);
    if (index < 0) return { profile, wallet, message: 'Modifier is no longer present on this item.' };
    const current = item.modifiers[index];
    const ceiling = Math.min(modifierGradeCeilingForRecovery(item.recoveryLevel ?? 1), reconstructionGradeCap(fabrication)) as ModifierGrade;
    const grade = current.grade ?? 3;
    if (grade >= ceiling) return { profile, wallet, message: `This modifier is already at the current Recovery Level / Microforge grade ceiling (G${ceiling}).` };
    const modifiers = item.modifiers.map((modifier, modifierIndex) => modifierIndex === index ? materializeModifier(modifier.id, (grade + 1) as ModifierGrade) : modifier);
    nextItem = { ...item, modifiers };
    successMessage = `${current.label} calibrated from G${grade} to G${grade + 1}.`;
  }

  if (action.kind === 'reroute') {
    if (fabrication < 1) return { profile, wallet, message: 'Microforge tier 1 is required to reroute modifier families.' };
    if (item.rarity === 'Singular') return { profile, wallet, message: 'Named Singular modifier packages cannot be rerouted.' };
    const index = item.modifiers.findIndex(modifier => modifier.id === action.modifierId);
    if (index < 0) return { profile, wallet, message: 'Modifier is no longer present on this item.' };
    const current = item.modifiers[index];
    const currentFamily = current.family ?? modifierFamilyFor(current.id);
    const targetFamily: ModifierFamily = currentFamily === 'core' ? 'systems' : 'core';
    const replacement = candidateAffix(item, targetFamily, current.id, `reroute:${current.id}`);
    if (!replacement) return { profile, wallet, message: `No compatible ${targetFamily.toUpperCase()} modifier is available on this frame.` };
    const modifiers = item.modifiers.map((modifier, modifierIndex) => modifierIndex === index ? materializeModifier(replacement, current.grade ?? 3) : modifier);
    nextItem = { ...item, modifiers };
    successMessage = `${current.label} rerouted into a ${targetFamily.toUpperCase()} modifier at the same grade.`;
  }

  if (action.kind === 'add') {
    if (fabrication < 1) return { profile, wallet, message: 'Microforge tier 1 is required to add a targeted modifier.' };
    if (item.rarity === 'Singular') return { profile, wallet, message: 'Named Singular modifier packages are fixed and cannot accept random modifier additions.' };
    const limit = modifierLimit(item);
    if (item.modifiers.length >= limit) return { profile, wallet, message: `${item.rarity} equipment is already at its ${limit}-modifier reconstruction limit.` };
    const replacement = candidateAffix(item, action.family, null, `add:${action.family}:${item.modifiers.length}`);
    if (!replacement) return { profile, wallet, message: `No unused ${action.family.toUpperCase()} modifier is compatible with this frame.` };
    const grade = Math.min(2, modifierGradeCeilingForRecovery(item.recoveryLevel ?? 1), reconstructionGradeCap(fabrication)) as ModifierGrade;
    nextItem = { ...item, modifiers: [...item.modifiers, materializeModifier(replacement, grade)] };
    successMessage = `Added a targeted ${action.family.toUpperCase()} modifier at G${grade}.`;
  }

  if (action.kind === 'recalibrate') {
    if (fabrication < 2) return { profile, wallet, message: 'Microforge tier 2 is required for family-lock recalibration.' };
    if (item.rarity === 'Singular') return { profile, wallet, message: 'Named Singular modifier packages cannot be recalibrated.' };
    const index = item.modifiers.findIndex(modifier => modifier.id === action.modifierId);
    if (index < 0) return { profile, wallet, message: 'Modifier is no longer present on this item.' };
    const current = item.modifiers[index];
    const family = current.family ?? modifierFamilyFor(current.id);
    if (family === action.lockedFamily) return { profile, wallet, message: `${family.toUpperCase()} family is locked and protected from recalibration.` };
    const replacement = candidateAffix(item, family, current.id, `recalibrate:${current.id}:${action.lockedFamily}`);
    if (!replacement) return { profile, wallet, message: `No alternate ${family.toUpperCase()} modifier is available on this frame.` };
    const modifiers = item.modifiers.map((modifier, modifierIndex) => modifierIndex === index ? materializeModifier(replacement, current.grade ?? 3) : modifier);
    nextItem = { ...item, modifiers };
    successMessage = `${current.label} recalibrated deterministically while ${action.lockedFamily.toUpperCase()} remained locked.`;
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
