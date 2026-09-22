import type { AffixId, Item } from './meta';
import { resolveGearBase } from './gearBases';
import {
  affixesConflict,
  gearAffixDefinition,
  gearAffixDefinitions,
  rarityModifierBudget,
  type GearRarityModifierBudget,
} from './gearAffixes';
import { modifierGradeCeilingForRecovery, type ModifierFamily, type ModifierGrade } from './lootQuality';

export type CraftingPoolStatus = 'legal' | 'installed' | 'conflict' | 'recovery-locked' | 'fixed-package';

export type CraftingPoolEntry = {
  id: AffixId;
  name: string;
  family: ModifierFamily;
  group: string;
  status: CraftingPoolStatus;
  reason: string;
  minimumRecoveryLevel: number;
  eligibleGrades: ModifierGrade[];
};

export const craftingFamilyDefinitions: Record<ModifierFamily, { label: string; role: string }> = {
  core: {
    label: 'CORE',
    role: 'Physical frame tuning: output, recoil, feed, protection, mobility, and thermal hardware.',
  },
  systems: {
    label: 'SYSTEMS',
    role: 'Rule-changing integration: targeting, capacitor loops, relay logic, and conditional combat behavior.',
  },
};

export const craftingGradeDefinitions: ReadonlyArray<{ grade: ModifierGrade; label: string; minimumRecoveryLevel: number }> = [
  { grade: 1, label: 'G1 Service', minimumRecoveryLevel: 4 },
  { grade: 2, label: 'G2 Tuned', minimumRecoveryLevel: 4 },
  { grade: 3, label: 'G3 Advanced', minimumRecoveryLevel: 19 },
  { grade: 4, label: 'G4 Prototype', minimumRecoveryLevel: 31 },
  { grade: 5, label: 'G5 Prime', minimumRecoveryLevel: 43 },
];

const clampFabrication = (level: number) => Math.max(0, Math.min(2, Math.round(level)));

export function craftingFabricationGradeCap(fabricationLevel: number) {
  return [3, 4, 5][clampFabrication(fabricationLevel)] as ModifierGrade;
}

function framePool(item: Item) {
  const base = resolveGearBase(item.slot, item.baseId, item.frameIdentity);
  if (base) return { base, ids: [...base.allowedAffixGroups] };
  return {
    base: undefined,
    ids: gearAffixDefinitions.filter(definition => definition.allowedSlots.includes(item.slot)).map(definition => definition.id),
  };
}

export function craftingAffixPool(item: Item, fabricationLevel: number, ignoreModifierId: AffixId | null = null): CraftingPoolEntry[] {
  const { ids } = framePool(item);
  const recoveryLevel = item.recoveryLevel ?? 1;
  const recoveryGradeCap = modifierGradeCeilingForRecovery(recoveryLevel);
  const forgeGradeCap = craftingFabricationGradeCap(fabricationLevel);
  const gradeCap = Math.min(recoveryGradeCap, forgeGradeCap) as ModifierGrade;
  const installed = item.modifiers.map(modifier => modifier.id).filter(id => id !== ignoreModifierId);

  return ids.map(id => {
    const definition = gearAffixDefinition(id);
    const eligibleGrades = definition.grades
      .filter(entry => entry.grade <= gradeCap && recoveryLevel >= entry.minimumRecoveryLevel)
      .map(entry => entry.grade);
    let status: CraftingPoolStatus = 'legal';
    let reason = 'Legal on this frame at the current Recovery Level.';

    if (item.rarity === 'Singular') {
      status = 'fixed-package';
      reason = 'Singular modifier packages are fixed; this pool is reference-only.';
    } else if (installed.includes(id)) {
      status = 'installed';
      reason = 'Already installed on this item.';
    } else if (recoveryLevel < definition.minimumRecoveryLevel || eligibleGrades.length === 0) {
      status = 'recovery-locked';
      reason = `Requires Recovery Level ${Math.max(definition.minimumRecoveryLevel, definition.grades[0]?.minimumRecoveryLevel ?? definition.minimumRecoveryLevel)}+.`;
    } else {
      const conflict = installed.find(chosen => affixesConflict(id, chosen));
      if (conflict) {
        status = 'conflict';
        reason = `Conflicts with ${gearAffixDefinition(conflict).name}.`;
      }
    }

    return {
      id,
      name: definition.name,
      family: definition.family,
      group: definition.group,
      status,
      reason,
      minimumRecoveryLevel: definition.minimumRecoveryLevel,
      eligibleGrades,
    };
  });
}

export function craftingRulesForItem(item: Item, fabricationLevel: number) {
  const { base } = framePool(item);
  const rarity: GearRarityModifierBudget = rarityModifierBudget(item.rarity);
  const recoveryLevel = item.recoveryLevel ?? 1;
  const recoveryGradeCap = modifierGradeCeilingForRecovery(recoveryLevel);
  const forgeGradeCap = craftingFabricationGradeCap(fabricationLevel);
  const gradeCeiling = Math.min(recoveryGradeCap, forgeGradeCap) as ModifierGrade;
  const pool = craftingAffixPool(item, fabricationLevel);
  const familyCounts: Record<ModifierFamily, number> = { core: 0, systems: 0 };
  for (const modifier of item.modifiers) familyCounts[gearAffixDefinition(modifier.id).family] += 1;

  return {
    base,
    rarity: {
      ...rarity,
      currentExplicit: item.modifiers.length,
      remainingExplicit: Math.max(0, rarity.maxExplicit - item.modifiers.length),
    },
    recoveryLevel,
    recoveryGradeCap,
    forgeGradeCap,
    gradeCeiling,
    pool,
    familyCounts,
  };
}

export function legalCraftingAffixes(item: Item, fabricationLevel: number, family?: ModifierFamily, ignoreModifierId: AffixId | null = null) {
  return craftingAffixPool(item, fabricationLevel, ignoreModifierId)
    .filter(entry => entry.status === 'legal' && (!family || entry.family === family));
}

export function validateCraftingRulesFoundation() {
  const familyIds = Object.keys(craftingFamilyDefinitions);
  const gradeIds = new Set(craftingGradeDefinitions.map(entry => entry.grade));
  const rarityContracts = {
    Field: rarityModifierBudget('Field'),
    Refined: rarityModifierBudget('Refined'),
    Prototype: rarityModifierBudget('Prototype'),
    Singular: rarityModifierBudget('Singular'),
  };

  return familyIds.length === 2
    && familyIds.includes('core')
    && familyIds.includes('systems')
    && gradeIds.size === 5
    && craftingGradeDefinitions.every((entry, index) => index === 0 || entry.minimumRecoveryLevel >= craftingGradeDefinitions[index - 1].minimumRecoveryLevel)
    && rarityContracts.Field.maxExplicit === 0
    && rarityContracts.Refined.minGenerated === 1
    && rarityContracts.Refined.maxExplicit === 2
    && rarityContracts.Prototype.minGenerated === 4
    && rarityContracts.Prototype.maxExplicit === 6
    && rarityContracts.Singular.curatedFixedPackage
    && gearAffixDefinitions.every(definition => definition.allowedSlots.length > 0 && !!craftingFamilyDefinitions[definition.family]);
}
