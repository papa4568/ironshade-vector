import { activeWeaponFamilyForProfile, type AffixId, type Item, type PlayerProfile } from './meta';
import { resolveGearBase } from './gearBases';
import {
  affixesConflict,
  gearAffixDefinition,
  gearAffixDefinitions,
  rarityModifierBudget,
  type GearRarityModifierBudget,
} from './gearAffixes';
import { modifierGradeCeilingForRecovery, type ModifierFamily, type ModifierGrade } from './lootQuality';
import { affixStatProfile } from './gearStats';
import type { ResourceId } from './campaign';

export type CraftingPoolStatus = 'legal' | 'installed' | 'conflict' | 'recovery-locked' | 'fixed-package' | 'class-locked';

export type CraftingProfileContext = Pick<PlayerProfile, 'operatorClass' | 'specialization' | 'allocatedNodes'>;

const craftingWeaponFamilies = ['carbine', 'breacher', 'rail'] as const;

export function craftingClassFamilyAccess(item: Item, profile?: CraftingProfileContext) {
  const weaponFamily = craftingWeaponFamilies.includes(item.slot as typeof craftingWeaponFamilies[number])
    ? item.slot as typeof craftingWeaponFamilies[number]
    : null;
  const activeWeaponFamily = profile ? activeWeaponFamilyForProfile(profile) : null;
  const owned = !weaponFamily || !activeWeaponFamily || weaponFamily === activeWeaponFamily;
  return {
    weaponFamily,
    activeWeaponFamily,
    owned,
    reason: owned
      ? weaponFamily ? `${activeWeaponFamily?.toUpperCase() ?? weaponFamily.toUpperCase()} arsenal ownership permits reconstruction on this weapon family.` : 'Universal support hardware is craftable by every operator class.'
      : `${activeWeaponFamily!.toUpperCase()} is the active class weapon family; ${weaponFamily!.toUpperCase()} reconstruction is class-locked.`,
  };
}

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

export type CraftingVerbId = 'improve' | 'add' | 'remove' | 'reroute' | 'replace' | 'lock' | 'elevate' | 'socket' | 'extract';
export type CraftingMaterialTier = 'common' | 'chase';
export type CraftingControlMode = 'standard' | 'protected' | 'volatile';

export const craftingStabilityContract = {
  maximum: 100,
  volatileDrain: 20,
  controlledRecovery: 5,
  protectedRecovery: 12,
} as const;

export function craftingStabilityForItem(item: Item) {
  const value = item.craftStability ?? craftingStabilityContract.maximum;
  return Math.max(0, Math.min(craftingStabilityContract.maximum, Math.round(value)));
}

export function craftingVolatileSuccessChance(item: Item) {
  return Math.min(0.9, Math.max(0.6, 0.6 + craftingStabilityForItem(item) * 0.003));
}

export type CraftingMaterialDefinition = {
  resource: ResourceId;
  label: string;
  tier: CraftingMaterialTier;
  role: string;
};

export type CraftingVerbDefinition = {
  id: CraftingVerbId;
  label: string;
  role: string;
  commonMaterials: ResourceId[];
  chaseMaterials: ResourceId[];
  gate: string;
};

export const craftingMaterialDefinitions: CraftingMaterialDefinition[] = [
  { resource: 'alloys', label: 'Frame Alloy', tier: 'common', role: 'Ordinary structural salvage for frame and Core-family work.' },
  { resource: 'electronics', label: 'Circuit Stock', tier: 'common', role: 'Ordinary electronic salvage for Systems-family routing and control work.' },
  { resource: 'components', label: 'Precision Components', tier: 'common', role: 'Scarcer ordinary salvage used when Reconstruction needs calibrated hardware.' },
  { resource: 'rareTech', label: 'Quarantined Trace', tier: 'chase', role: 'Chase material for precision targeting, protected replacement, and Prime-grade elevation.' },
];

export const craftingVerbDefinitions: Record<CraftingVerbId, CraftingVerbDefinition> = {
  improve: {
    id: 'improve',
    label: 'IMPROVE',
    role: 'Raise base-frame Equipment Quality without changing explicit modifiers.',
    commonMaterials: ['alloys', 'components'],
    chaseMaterials: [],
    gate: 'Bounded by the current Microforge quality cap.',
  },
  add: {
    id: 'add',
    label: 'ADD',
    role: 'Install one legal Core or Systems modifier from the base-owned pool; precision targeting can name the exact legal modifier.',
    commonMaterials: ['alloys', 'electronics', 'components'],
    chaseMaterials: ['rareTech'],
    gate: 'Standard family Add requires Microforge T1. Precision Add requires T2 + one Quarantined Trace, an open rarity slot, Recovery access, and a legal frame target.',
  },
  remove: {
    id: 'remove',
    label: 'REMOVE',
    role: 'Delete one explicit modifier to reopen rarity budget and resolve a build conflict.',
    commonMaterials: ['components'],
    chaseMaterials: [],
    gate: 'Unavailable on fixed Singular packages. Removed modifiers do not refund crafting materials.',
  },
  reroute: {
    id: 'reroute',
    label: 'REROUTE',
    role: 'Move one modifier into the opposite Core/Systems family while preserving grade.',
    commonMaterials: ['alloys', 'electronics', 'components'],
    chaseMaterials: [],
    gate: 'Requires Microforge T1 and a legal opposite-family candidate on the same base frame.',
  },
  replace: {
    id: 'replace',
    label: 'REPLACE',
    role: 'Swap one modifier for another legal modifier in the same family while the selected family lock is respected; protected mode guarantees the named legal target.',
    commonMaterials: ['electronics', 'components'],
    chaseMaterials: ['rareTech'],
    gate: 'Requires Microforge T2. Protected replacement spends one Quarantined Trace; volatile replacement can waive the Trace but drains stability and can fail.',
  },
  lock: {
    id: 'lock',
    label: 'LOCK',
    role: 'Select the Core or Systems family protected during a Replace operation.',
    commonMaterials: [],
    chaseMaterials: ['rareTech'],
    gate: 'Requires Microforge T2. The Trace is spent by Replace, not when changing the selected lock.',
  },
  elevate: {
    id: 'elevate',
    label: 'ELEVATE',
    role: 'Raise one modifier without changing its identity; choose any legal grade up to the current ceiling.',
    commonMaterials: ['alloys', 'electronics', 'components'],
    chaseMaterials: ['rareTech'],
    gate: 'Recovery Level and Microforge ceilings both apply; entering G5 Prime spends one Quarantined Trace. Volatile elevation is optional at T2 and drains stability.',
  },
  socket: {
    id: 'socket',
    label: 'SOCKET',
    role: 'Install a compatible fixed-utility Augment into an accessible hardware socket.',
    commonMaterials: ['alloys', 'electronics', 'components'],
    chaseMaterials: [],
    gate: 'Requires an accessible socket and the Augment-specific material cost.',
  },
  extract: {
    id: 'extract',
    label: 'EXTRACT',
    role: 'Remove an installed Augment intact from the frame.',
    commonMaterials: [],
    chaseMaterials: [],
    gate: 'No crafting-material refund; only the extraction service cost is charged.',
  },
};

export const craftingMaterialsByTier = (tier: CraftingMaterialTier) =>
  craftingMaterialDefinitions.filter(material => material.tier === tier);

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

export function craftingAffixPool(item: Item, fabricationLevel: number, ignoreModifierId: AffixId | null = null, profile?: CraftingProfileContext): CraftingPoolEntry[] {
  const { ids } = framePool(item);
  const classAccess = craftingClassFamilyAccess(item, profile);
  const recoveryLevel = item.recoveryLevel ?? 1;
  const recoveryGradeCap = modifierGradeCeilingForRecovery(recoveryLevel);
  const forgeGradeCap = craftingFabricationGradeCap(fabricationLevel);
  const gradeCap = Math.min(recoveryGradeCap, forgeGradeCap) as ModifierGrade;
  const installed = item.modifiers.map(modifier => modifier.id).filter(id => id !== ignoreModifierId);

  return ids.filter(id => affixStatProfile(id).stats.length > 0).map(id => {
    const definition = gearAffixDefinition(id);
    const eligibleGrades = definition.grades
      .filter(entry => entry.grade <= gradeCap && recoveryLevel >= entry.minimumRecoveryLevel)
      .map(entry => entry.grade);
    let status: CraftingPoolStatus = 'legal';
    let reason = 'Legal on this frame at the current Recovery Level.';

    if (!classAccess.owned) {
      status = 'class-locked';
      reason = classAccess.reason;
    } else if (item.rarity === 'Singular') {
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

export function craftingRulesForItem(item: Item, fabricationLevel: number, profile?: CraftingProfileContext) {
  const { base } = framePool(item);
  const rarity: GearRarityModifierBudget = rarityModifierBudget(item.rarity);
  const recoveryLevel = item.recoveryLevel ?? 1;
  const recoveryGradeCap = modifierGradeCeilingForRecovery(recoveryLevel);
  const forgeGradeCap = craftingFabricationGradeCap(fabricationLevel);
  const gradeCeiling = Math.min(recoveryGradeCap, forgeGradeCap) as ModifierGrade;
  const classOwnership = craftingClassFamilyAccess(item, profile);
  const pool = craftingAffixPool(item, fabricationLevel, null, profile);
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
    classOwnership,
    familyCounts,
    stability: craftingStabilityForItem(item),
    volatileSuccessChance: craftingVolatileSuccessChance(item),
  };
}

export function legalCraftingAffixes(item: Item, fabricationLevel: number, family?: ModifierFamily, ignoreModifierId: AffixId | null = null, profile?: CraftingProfileContext) {
  return craftingAffixPool(item, fabricationLevel, ignoreModifierId, profile)
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

  const verbIds = Object.keys(craftingVerbDefinitions);
  const commonMaterials = craftingMaterialsByTier('common');
  const chaseMaterials = craftingMaterialsByTier('chase');

  return verbIds.length === 9
    && ['improve', 'add', 'remove', 'reroute', 'replace', 'lock', 'elevate', 'socket', 'extract'].every(id => verbIds.includes(id))
    && commonMaterials.length === 3
    && chaseMaterials.length === 1
    && chaseMaterials[0]?.resource === 'rareTech'
    && craftingVerbDefinitions.add.chaseMaterials.includes('rareTech')
    && craftingVerbDefinitions.replace.chaseMaterials.includes('rareTech')
    && craftingVerbDefinitions.elevate.chaseMaterials.includes('rareTech')
    && familyIds.length === 2
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
