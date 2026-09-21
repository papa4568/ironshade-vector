import type { EquipmentSlot, AffixId } from './meta';
import type { ItemRarity } from './rarity';
import type { ModifierFamily, ModifierGrade, RecoveryQualityGrade } from './lootQuality';
import type { FrameIdentityId, AugmentId } from './gearDepth';
import type { EquipmentFaction } from './factionGear';
import type { SingularTraitId } from './sim';
import { gearBuildTags, validateGearStatRegistry, type GearBuildTag, type GearStatId } from './gearStats';

export const gearSchemaVersion = 1 as const;

export { gearBuildTags, gearStatDefinitions, gearStatDefinition, validateGearStatRegistry } from './gearStats';
export type { GearBuildTag, GearStatDefinition, GearStatId, GearStatScope, GearStatValueKind } from './gearStats';

export type GearBaseDefinition = {
  id: string;
  slot: EquipmentSlot;
  name: string;
  equipmentClass: string;
  generation: number;
  generationRange: [number, number];
  frameIdentity: FrameIdentityId;
  core: string;
  tradeoff: string;
  inherentStats: GearStatId[];
  implicitStats: GearStatId[];
  allowedAffixGroups: AffixId[];
  buildTags: GearBuildTag[];
  faction?: EquipmentFaction;
};

export type GearAffixGrade = {
  grade: ModifierGrade;
  stats: Partial<Record<GearStatId, number>>;
  tradeoffs?: Partial<Record<GearStatId, number>>;
};

export type GearAffixDefinition = {
  id: AffixId;
  name: string;
  family: ModifierFamily;
  group: string;
  allowedSlots: EquipmentSlot[];
  minimumRecoveryLevel: number;
  buildTags: GearBuildTag[];
  grades: GearAffixGrade[];
  mechanicalHook?: string;
};

export type GearAugmentDefinition = {
  id: AugmentId;
  name: string;
  slots: EquipmentSlot[];
  buildTags: GearBuildTag[];
  stats: Partial<Record<GearStatId, number>>;
  tradeoffs?: Partial<Record<GearStatId, number>>;
};

export type GearSingularCategory =
  | 'skill-transformer'
  | 'resource-loop'
  | 'movement-transformer'
  | 'projectile-transformer'
  | 'defense-transformer'
  | 'conditional-engine'
  | 'build-converter'
  | 'environmental-interaction';

export type GearSingularDefinition = {
  id: string;
  baseId: string;
  name: string;
  slot: EquipmentSlot;
  category: GearSingularCategory;
  fixedAffixes: AffixId[];
  fixedFrameIdentity?: FrameIdentityId;
  singularTrait: SingularTraitId;
  buildTags: GearBuildTag[];
  opportunityCost: string;
};

export type GearItemV2 = {
  schemaVersion: typeof gearSchemaVersion;
  id: string;
  baseId: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  recoveryLevel: number;
  recoveryQuality: RecoveryQualityGrade;
  equipmentQuality: number;
  affixes: Array<{ id: AffixId; grade: ModifierGrade }>;
  augments: AugmentId[];
  singularId?: string;
  provenance?: {
    source?: string;
    faction?: EquipmentFaction;
  };
};

export const gearPowerAxisAudit = [
  {
    id: 'recovery-level',
    currentOwners: ['scaling.ts', 'meta.ts', 'lootQuality.ts', 'reconstruction.ts'],
    currentRole: 'Eligibility, equip level, generation access, modifier-grade ceiling, and reconstruction constraints.',
    targetOwner: 'item.recoveryLevel',
    targetRole: 'Eligibility gate only: which bases, affix grades, and content can appear.',
    implementationBatch: 'P8.5-B',
  },
  {
    id: 'recovery-quality',
    currentOwners: ['lootQuality.ts', 'meta.ts', 'gearDepth.ts'],
    currentRole: 'Drop provenance pressure that also biases rarity, modifier grade floors, and Equipment Quality.',
    targetOwner: 'item.recoveryQuality + provenance',
    targetRole: 'Original-drop quality/provenance bias; not a persistent combat multiplier.',
    implementationBatch: 'P8.5-B',
  },
  {
    id: 'frame-generation',
    currentOwners: ['scaling.ts', 'meta.ts', 'gearDepth.ts'],
    currentRole: 'Naming, frame implicit magnitude, equipment-quality derivation, and augment socket growth.',
    targetOwner: 'base.generation',
    targetRole: 'Base-frame progression and eligibility; strategic base identity must remain more important than generation alone.',
    implementationBatch: 'P8.5-B/P8.5-C',
  },
  {
    id: 'equipment-quality',
    currentOwners: ['gearDepth.ts', 'meta.ts', 'reconstruction.ts'],
    currentRole: 'Scales frame implicit effects and can be raised through Reconstruction.',
    targetOwner: 'item.equipmentQuality',
    targetRole: 'Limited improvement to base/inherent properties only.',
    implementationBatch: 'P8.5-B/P8.5-H',
  },
  {
    id: 'modifier-grade',
    currentOwners: ['lootQuality.ts', 'meta.ts', 'reconstruction.ts'],
    currentRole: 'Scales affix upside and tradeoff magnitude.',
    targetOwner: 'item.affixes[].grade',
    targetRole: 'Single source of affix strength.',
    implementationBatch: 'P8.5-B/P8.5-E',
  },
  {
    id: 'rarity',
    currentOwners: ['rarity.ts', 'lootQuality.ts', 'meta.ts', 'reconstruction.ts'],
    currentRole: 'Controls rolled modifier count, presentation, and augment potential.',
    targetOwner: 'item.rarity',
    targetRole: 'Explicit-mod budget and item identity: Field 0, Refined up to 2, Prototype up to 6, Singular fixed curated package.',
    implementationBatch: 'P8.5-E',
  },
  {
    id: 'frame-identity',
    currentOwners: ['gearDepth.ts', 'meta.ts', 'factionGear.ts'],
    currentRole: 'Adds another implicit stat/tradeoff layer beside the base frame.',
    targetOwner: 'base.inherentStats + base.implicitStats',
    targetRole: 'Fold strategic frame identity into meaningful base definitions.',
    implementationBatch: 'P8.5-C',
  },
  {
    id: 'augments',
    currentOwners: ['gearDepth.ts', 'reconstruction.ts', 'meta.ts'],
    currentRole: 'Adds controlled extra stats/tradeoffs through sockets whose count also grows with rarity/generation.',
    targetOwner: 'item.augments',
    targetRole: 'Bounded utility/specialization customization, normally 0–2 sockets.',
    implementationBatch: 'P8.5-H',
  },
  {
    id: 'faction',
    currentOwners: ['factionGear.ts', 'meta.ts'],
    currentRole: 'Alternate frames, preferred affix bias, and multi-piece global set bonuses.',
    targetOwner: 'base.faction + provenance.faction + buildTags',
    targetRole: 'Source/base identity and tag bias; avoid hidden universal score stacking.',
    implementationBatch: 'P8.5-C/P8.5-G',
  },
  {
    id: 'singular',
    currentOwners: ['meta.ts', 'sim.ts', 'gearDepth.ts'],
    currentRole: 'Named fixed packages combine base/frame identity, fixed affixes, and a unique simulation trait.',
    targetOwner: 'singular registry',
    targetRole: 'Curated rule-changing package with category, fixed rule, build tags, and explicit opportunity cost.',
    implementationBatch: 'P8.5-I',
  },
] as const;

export const gearContentSourceAudit = {
  bases: ['meta.ts/baseNames', 'meta.ts/starterItems', 'factionGear.ts/factionFrames', 'gearDepth.ts/frameIdentityDefinitions'],
  stats: ['meta.ts/applyAffix', 'gearDepth.ts/applyFrameIdentity', 'gearDepth.ts/applyAugments', 'meta.ts/deriveCombatBuild', 'factionGear.ts/factionSetDefinitions'],
  affixes: ['meta.ts/affixes', 'meta.ts/baseNames[].affixes', 'lootQuality.ts/modifier grade tables', 'reconstruction.ts/candidateAffix'],
  augments: ['gearDepth.ts/augmentDefinitions', 'gearDepth.ts/applyAugments', 'reconstruction.ts/install/remove augment'],
  singulars: ['meta.ts/bossSingularPools', 'meta.ts/location/directive Singular pools', 'sim.ts/SingularTraitId runtime hooks'],
  buildTags: ['meta.ts/itemBuildAffinities', 'meta.ts/specialization gear links', 'classSkills.ts/class family ownership', 'meta.ts/progressionNodes'],
} as const;

export const gearTargetOwnership = {
  bases: 'GearBaseDefinition',
  stats: 'GearStatDefinition',
  affixes: 'GearAffixDefinition',
  augments: 'GearAugmentDefinition',
  singulars: 'GearSingularDefinition',
  buildTags: 'GearBuildTag',
  item: 'GearItemV2',
} as const;

export function validateGearSchemaContract() {
  const tags = new Set(gearBuildTags);
  if (tags.size !== gearBuildTags.length) return false;
  const axes = new Set(gearPowerAxisAudit.map(axis => axis.id));
  if (axes.size !== gearPowerAxisAudit.length) return false;
  return validateGearStatRegistry()
    && Object.values(gearTargetOwnership).every(Boolean)
    && gearPowerAxisAudit.every(axis => axis.currentOwners.length > 0 && axis.targetOwner && axis.targetRole);
}
