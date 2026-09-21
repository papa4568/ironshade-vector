import type { AffixId, EquipmentSlot, Rarity } from './meta';
import type { ModifierFamily, ModifierGrade } from './lootQuality';
import type { GearAffixDefinition, GearAffixGrade } from './gearSchema';
import { affixStatProfile, gearAffixSemanticIds, type GearStatId } from './gearStats';

export type GearRarityModifierBudget = {
  minGenerated: number;
  maxExplicit: number;
  randomRolls: boolean;
  curatedFixedPackage: boolean;
};

export const gearRarityModifierBudgets: Record<Rarity, GearRarityModifierBudget> = {
  Field: { minGenerated: 0, maxExplicit: 0, randomRolls: false, curatedFixedPackage: false },
  Refined: { minGenerated: 1, maxExplicit: 2, randomRolls: true, curatedFixedPackage: false },
  Prototype: { minGenerated: 4, maxExplicit: 6, randomRolls: true, curatedFixedPackage: false },
  Singular: { minGenerated: 0, maxExplicit: 0, randomRolls: false, curatedFixedPackage: true },
};

const gradeRecoveryFloor: Record<ModifierGrade, number> = {
  1: 4,
  2: 4,
  3: 19,
  4: 31,
  5: 43,
};

const grade = (
  gradeValue: ModifierGrade,
  stats: Partial<Record<GearStatId, number>>,
  tradeoffs: Partial<Record<GearStatId, number>> = {},
): GearAffixGrade => ({
  grade: gradeValue,
  minimumRecoveryLevel: gradeRecoveryFloor[gradeValue],
  stats,
  tradeoffs,
});

type AffixSeed = {
  id: AffixId;
  name: string;
  family: ModifierFamily;
  group: string;
  allowedSlots: EquipmentSlot[];
  minimumRecoveryLevel: number;
  weight: number;
  conflicts?: AffixId[];
  grades: GearAffixGrade[];
  mechanicalHook?: string;
};

const defineAffix = (seed: AffixSeed): GearAffixDefinition => ({
  ...seed,
  conflicts: seed.conflicts ?? [],
  buildTags: [...affixStatProfile(seed.id).buildTags],
});

export const gearAffixDefinitions: GearAffixDefinition[] = [
  defineAffix({
    id: 'hypervelocity',
    name: 'Hypervelocity rails',
    family: 'core',
    group: 'kinetic-flight',
    allowedSlots: ['carbine', 'rail'],
    minimumRecoveryLevel: 4,
    weight: 100,
    grades: [
      grade(1, { 'affix.projectile-velocity': 12, 'affix.penetration': 8 }, { 'affix.recoil-penalty': 8 }),
      grade(2, { 'affix.projectile-velocity': 15, 'affix.penetration': 10 }, { 'affix.recoil-penalty': 9 }),
      grade(3, { 'affix.projectile-velocity': 18, 'affix.penetration': 12 }, { 'affix.recoil-penalty': 10 }),
      grade(4, { 'affix.projectile-velocity': 21, 'affix.penetration': 14 }, { 'affix.recoil-penalty': 11 }),
      grade(5, { 'affix.projectile-velocity': 25, 'affix.penetration': 17 }, { 'affix.recoil-penalty': 12 }),
    ],
  }),
  defineAffix({
    id: 'countermass',
    name: 'Countermass buffer',
    family: 'core',
    group: 'recoil-routing',
    allowedSlots: ['carbine', 'breacher', 'rail'],
    minimumRecoveryLevel: 4,
    weight: 105,
    conflicts: ['breachPropulsion'],
    grades: [
      grade(1, { 'affix.recoil-absorption': 14 }, { 'affix.direct-output-penalty': 5 }),
      grade(2, { 'affix.recoil-absorption': 18 }, { 'affix.direct-output-penalty': 6 }),
      grade(3, { 'affix.recoil-absorption': 22 }, { 'affix.direct-output-penalty': 7 }),
      grade(4, { 'affix.recoil-absorption': 26 }, { 'affix.direct-output-penalty': 8 }),
      grade(5, { 'affix.recoil-absorption': 30 }, { 'affix.direct-output-penalty': 8 }),
    ],
  }),
  defineAffix({
    id: 'overdrive',
    name: 'Open-coil overdrive',
    family: 'core',
    group: 'output-driver',
    allowedSlots: ['carbine', 'breacher'],
    minimumRecoveryLevel: 4,
    weight: 85,
    grades: [
      grade(1, { 'affix.direct-output': 9 }, { 'affix.recoil-penalty': 16, 'affix.heat-per-shot-penalty': 9 }),
      grade(2, { 'affix.direct-output': 11 }, { 'affix.recoil-penalty': 18, 'affix.heat-per-shot-penalty': 11 }),
      grade(3, { 'affix.direct-output': 14 }, { 'affix.recoil-penalty': 20, 'affix.heat-per-shot-penalty': 12 }),
      grade(4, { 'affix.direct-output': 17 }, { 'affix.recoil-penalty': 22, 'affix.heat-per-shot-penalty': 13 }),
      grade(5, { 'affix.direct-output': 19 }, { 'affix.recoil-penalty': 23, 'affix.heat-per-shot-penalty': 14 }),
    ],
  }),
  defineAffix({
    id: 'cryoloop',
    name: 'Cryogenic return loop',
    family: 'core',
    group: 'thermal-routing',
    allowedSlots: ['carbine', 'breacher', 'rail', 'rig'],
    minimumRecoveryLevel: 4,
    weight: 95,
    conflicts: ['dodgeVent'],
    grades: [
      grade(1, { 'affix.heat-dissipation': 20 }, { 'affix.penetration-penalty': 6 }),
      grade(2, { 'affix.heat-dissipation': 25 }, { 'affix.penetration-penalty': 7 }),
      grade(3, { 'affix.heat-dissipation': 30 }, { 'affix.penetration-penalty': 8 }),
      grade(4, { 'affix.heat-dissipation': 35 }, { 'affix.penetration-penalty': 9 }),
      grade(5, { 'affix.heat-dissipation': 41 }, { 'affix.penetration-penalty': 9 }),
    ],
  }),
  defineAffix({
    id: 'extendedFeed',
    name: 'Extended feed geometry',
    family: 'core',
    group: 'feed-geometry',
    allowedSlots: ['carbine', 'breacher'],
    minimumRecoveryLevel: 4,
    weight: 95,
    grades: [
      grade(1, { 'affix.magazine-capacity': 4 }, { 'affix.reload-time-penalty': 9 }),
      grade(2, { 'affix.magazine-capacity': 5 }, { 'affix.reload-time-penalty': 11 }),
      grade(3, { 'affix.magazine-capacity': 6 }, { 'affix.reload-time-penalty': 12 }),
      grade(4, { 'affix.magazine-capacity': 7 }, { 'affix.reload-time-penalty': 13 }),
      grade(5, { 'affix.magazine-capacity': 8 }, { 'affix.reload-time-penalty': 14 }),
    ],
  }),
  defineAffix({
    id: 'tungsten',
    name: 'Tungsten penetrator stack',
    family: 'core',
    group: 'penetrator-stack',
    allowedSlots: ['carbine', 'breacher', 'rail'],
    minimumRecoveryLevel: 12,
    weight: 70,
    grades: [
      grade(1, { 'affix.armor-damage': 20, 'affix.penetration': 9 }, { 'affix.heat-per-shot-penalty': 6 }),
      grade(2, { 'affix.armor-damage': 25, 'affix.penetration': 11 }, { 'affix.heat-per-shot-penalty': 7 }),
      grade(3, { 'affix.armor-damage': 30, 'affix.penetration': 14 }, { 'affix.heat-per-shot-penalty': 8 }),
      grade(4, { 'affix.armor-damage': 35, 'affix.penetration': 17 }, { 'affix.heat-per-shot-penalty': 9 }),
      grade(5, { 'affix.armor-damage': 41, 'affix.penetration': 19 }, { 'affix.heat-per-shot-penalty': 9 }),
    ],
  }),
  defineAffix({
    id: 'vacuumSeal',
    name: 'Layered vacuum seal',
    family: 'core',
    group: 'pressure-seal',
    allowedSlots: ['suit'],
    minimumRecoveryLevel: 4,
    weight: 100,
    grades: [
      grade(1, { 'environment.vacuum-resistance': 36 }),
      grade(2, { 'environment.vacuum-resistance': 45 }),
      grade(3, { 'environment.vacuum-resistance': 55 }),
      grade(4, { 'environment.vacuum-resistance': 65 }),
      grade(5, { 'environment.vacuum-resistance': 76 }),
    ],
  }),
  defineAffix({
    id: 'servoWeave',
    name: 'Vector servo weave',
    family: 'core',
    group: 'servo-routing',
    allowedSlots: ['suit', 'implant'],
    minimumRecoveryLevel: 4,
    weight: 100,
    grades: [
      grade(1, { 'affix.movement-speed': 5, 'environment.low-g-control': 14 }),
      grade(2, { 'affix.movement-speed': 7, 'environment.low-g-control': 18 }),
      grade(3, { 'affix.movement-speed': 8, 'environment.low-g-control': 22 }),
      grade(4, { 'affix.movement-speed': 9, 'environment.low-g-control': 26 }),
      grade(5, { 'affix.movement-speed': 11, 'environment.low-g-control': 30 }),
    ],
  }),
  defineAffix({
    id: 'capacitorRecycler',
    name: 'Capacitor recycler',
    family: 'systems',
    group: 'capacitor-loop',
    allowedSlots: ['suit', 'rig', 'implant'],
    minimumRecoveryLevel: 4,
    weight: 90,
    grades: [
      grade(1, { 'global.capacitor-regeneration': 13, 'global.ability-cost-reduction': 7 }),
      grade(2, { 'global.capacitor-regeneration': 16, 'global.ability-cost-reduction': 8 }),
      grade(3, { 'global.capacitor-regeneration': 20, 'global.ability-cost-reduction': 10 }),
      grade(4, { 'global.capacitor-regeneration': 24, 'global.ability-cost-reduction': 12 }),
      grade(5, { 'global.capacitor-regeneration': 28, 'global.ability-cost-reduction': 14 }),
    ],
  }),
  defineAffix({
    id: 'railFracture',
    name: 'Fracture cascade',
    family: 'systems',
    group: 'projectile-transformer',
    allowedSlots: ['rail'],
    minimumRecoveryLevel: 19,
    weight: 40,
    grades: [
      grade(1, { 'affix.rail-fracture-rule': 23 }),
      grade(2, { 'affix.rail-fracture-rule': 29 }),
      grade(3, { 'affix.rail-fracture-rule': 35 }),
      grade(4, { 'affix.rail-fracture-rule': 41 }),
      grade(5, { 'affix.rail-fracture-rule': 48 }),
    ],
    mechanicalHook: 'rail-fragment-after-penetration',
  }),
  defineAffix({
    id: 'dodgeVent',
    name: 'Kinetic heat shunt',
    family: 'systems',
    group: 'thermal-routing',
    allowedSlots: ['breacher', 'suit', 'rig'],
    minimumRecoveryLevel: 4,
    weight: 65,
    conflicts: ['cryoloop'],
    grades: [
      grade(1, { 'global.dodge-vent-rule': 14 }),
      grade(2, { 'global.dodge-vent-rule': 18 }),
      grade(3, { 'global.dodge-vent-rule': 22 }),
      grade(4, { 'global.dodge-vent-rule': 26 }),
      grade(5, { 'global.dodge-vent-rule': 30 }),
    ],
    mechanicalHook: 'dodge-vents-weapon-heat',
  }),
  defineAffix({
    id: 'magRedirect',
    name: 'Revector field',
    family: 'systems',
    group: 'field-transformer',
    allowedSlots: ['carbine', 'rig', 'implant'],
    minimumRecoveryLevel: 4,
    weight: 45,
    grades: [
      grade(1, { 'skill-family.mag-redirect-rule': 65 }),
      grade(2, { 'skill-family.mag-redirect-rule': 82 }),
      grade(3, { 'skill-family.mag-redirect-rule': 100 }),
      grade(4, { 'skill-family.mag-redirect-rule': 118 }),
      grade(5, { 'skill-family.mag-redirect-rule': 138 }),
    ],
    mechanicalHook: 'magnetic-impulse-projectile-redirect',
  }),
  defineAffix({
    id: 'breachPropulsion',
    name: 'Backblast coupling',
    family: 'systems',
    group: 'recoil-routing',
    allowedSlots: ['breacher'],
    minimumRecoveryLevel: 4,
    weight: 45,
    conflicts: ['countermass'],
    grades: [
      grade(1, { 'affix.breacher-propulsion-rule': 1.39 }),
      grade(2, { 'affix.breacher-propulsion-rule': 1.49 }),
      grade(3, { 'affix.breacher-propulsion-rule': 1.6 }),
      grade(4, { 'affix.breacher-propulsion-rule': 1.71 }),
      grade(5, { 'affix.breacher-propulsion-rule': 1.83 }),
    ],
    mechanicalHook: 'breacher-recoil-to-low-g-mobility',
  }),
  defineAffix({
    id: 'markShear',
    name: 'Shear-map optics',
    family: 'systems',
    group: 'target-transformer',
    allowedSlots: ['rail', 'implant'],
    minimumRecoveryLevel: 4,
    weight: 45,
    grades: [
      grade(1, { 'skill-family.mark-armor-break-rule': 28 }),
      grade(2, { 'skill-family.mark-armor-break-rule': 31 }),
      grade(3, { 'skill-family.mark-armor-break-rule': 34 }),
      grade(4, { 'skill-family.mark-armor-break-rule': 37 }),
      grade(5, { 'skill-family.mark-armor-break-rule': 40 }),
    ],
    mechanicalHook: 'mark-exposes-armor-paths',
  }),
  defineAffix({
    id: 'arcDrone',
    name: 'Relay microdrone',
    family: 'systems',
    group: 'relay-transformer',
    allowedSlots: ['rig', 'implant'],
    minimumRecoveryLevel: 12,
    weight: 50,
    grades: [
      grade(1, { 'skill-family.relay-drone-rule': 5 }),
      grade(2, { 'skill-family.relay-drone-rule': 7 }),
      grade(3, { 'skill-family.relay-drone-rule': 8 }),
      grade(4, { 'skill-family.relay-drone-rule': 9 }),
      grade(5, { 'skill-family.relay-drone-rule': 11 }),
    ],
    mechanicalHook: 'relay-microdrone-on-disrupted-targets',
  }),
];

const affixById = new Map<AffixId, GearAffixDefinition>(gearAffixDefinitions.map(definition => [definition.id, definition]));

export function gearAffixDefinition(id: AffixId) {
  const definition = affixById.get(id);
  if (!definition) throw new Error(`Unknown gear affix: ${id}`);
  return definition;
}

export function rarityModifierBudget(rarity: Rarity) {
  return gearRarityModifierBudgets[rarity];
}

export function maximumExplicitModifiersForRarity(rarity: Rarity) {
  return rarityModifierBudget(rarity).maxExplicit;
}

export function affixesConflict(left: AffixId, right: AffixId) {
  if (left === right) return true;
  const leftDefinition = gearAffixDefinition(left);
  const rightDefinition = gearAffixDefinition(right);
  return leftDefinition.conflicts.includes(right) || rightDefinition.conflicts.includes(left);
}

export function isAffixEligibleForRoll(
  id: AffixId,
  slot: EquipmentSlot,
  recoveryLevel: number,
  baseAllowedAffixes: readonly AffixId[],
  chosenAffixes: readonly AffixId[] = [],
) {
  const definition = gearAffixDefinition(id);
  return baseAllowedAffixes.includes(id)
    && definition.allowedSlots.includes(slot)
    && recoveryLevel >= definition.minimumRecoveryLevel
    && !chosenAffixes.includes(id)
    && chosenAffixes.every(chosen => !affixesConflict(id, chosen));
}

export function eligibleAffixesForRoll(
  slot: EquipmentSlot,
  recoveryLevel: number,
  baseAllowedAffixes: readonly AffixId[],
  chosenAffixes: readonly AffixId[] = [],
) {
  return baseAllowedAffixes.filter(id => isAffixEligibleForRoll(id, slot, recoveryLevel, baseAllowedAffixes, chosenAffixes));
}

export function weightedAffixChoice(candidates: readonly AffixId[], random: () => number) {
  if (candidates.length === 0) return null;
  const totalWeight = candidates.reduce((sum, id) => sum + gearAffixDefinition(id).weight, 0);
  if (totalWeight <= 0) return candidates[0] ?? null;
  let roll = Math.max(0, Math.min(0.999999, random())) * totalWeight;
  for (const id of candidates) {
    roll -= gearAffixDefinition(id).weight;
    if (roll < 0) return id;
  }
  return candidates[candidates.length - 1] ?? null;
}

export function affixGradeDefinition(id: AffixId, gradeValue: ModifierGrade) {
  const definition = gearAffixDefinition(id);
  const gradeDefinition = definition.grades.find(entry => entry.grade === gradeValue);
  if (!gradeDefinition) throw new Error(`Missing G${gradeValue} table for ${id}`);
  return gradeDefinition;
}

export function validateAffixSet(input: {
  slot: EquipmentSlot;
  recoveryLevel: number;
  rarity: Rarity;
  baseAllowedAffixes: readonly AffixId[];
  affixes: readonly AffixId[];
  curatedSingular?: boolean;
}) {
  if (input.rarity === 'Singular') return input.curatedSingular === true;
  const budget = rarityModifierBudget(input.rarity);
  if (input.affixes.length > budget.maxExplicit) return false;
  return input.affixes.every((id, index) => isAffixEligibleForRoll(
    id,
    input.slot,
    input.recoveryLevel,
    input.baseAllowedAffixes,
    input.affixes.slice(0, index),
  ));
}

export function validateGearAffixRegistry() {
  const semanticIds = new Set<AffixId>(gearAffixSemanticIds);
  const definitionIds = new Set(gearAffixDefinitions.map(definition => definition.id));
  const validGrades = new Set<ModifierGrade>([1, 2, 3, 4, 5]);

  return definitionIds.size === gearAffixDefinitions.length
    && definitionIds.size === semanticIds.size
    && [...semanticIds].every(id => definitionIds.has(id))
    && gearAffixDefinitions.every(definition => {
      const profile = affixStatProfile(definition.id);
      const gradeIds = new Set(definition.grades.map(entry => entry.grade));
      const stats = new Set<GearStatId>([...profile.stats, ...profile.tradeoffs]);
      return definition.name.length > 0
        && definition.group.length > 0
        && definition.allowedSlots.length > 0
        && definition.minimumRecoveryLevel >= 1
        && definition.weight > 0
        && definition.buildTags.length > 0
        && definition.conflicts.every(id => semanticIds.has(id) && id !== definition.id && gearAffixDefinition(id).conflicts.includes(definition.id))
        && gradeIds.size === 5
        && [...validGrades].every(value => gradeIds.has(value))
        && definition.grades.every(entry => entry.minimumRecoveryLevel >= definition.minimumRecoveryLevel
          && Object.keys(entry.stats).length > 0
          && [...Object.keys(entry.stats), ...Object.keys(entry.tradeoffs ?? {})].every(id => stats.has(id as GearStatId)));
    });
}
