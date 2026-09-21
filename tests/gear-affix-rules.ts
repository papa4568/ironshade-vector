import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gearBaseDefinitions, gearBaseDefinition } from '../src/game/gearBases';
import {
  affixGradeDefinition,
  affixesConflict,
  gearAffixDefinition,
  gearAffixDefinitions,
  gearRarityModifierBudgets,
  isAffixEligibleForRoll,
  maximumExplicitModifiersForRarity,
  validateAffixSet,
  validateGearAffixRegistry,
  weightedAffixChoice,
} from '../src/game/gearAffixes';
import { validateGearSchemaContract } from '../src/game/gearSchema';
import { affixStatProfile, gearAffixSemanticIds } from '../src/game/gearStats';
import { modifierFamilyFor, modifierGradeCeilingForRecovery, type ModifierGrade } from '../src/game/lootQuality';
import { createDefaultProfile, materializeModifier } from '../src/game/meta';
import { reconstructItem } from '../src/game/reconstruction';
import type { SalvageWallet } from '../src/game/campaign';

assert.equal(validateGearAffixRegistry(), true, 'P8.5-E affix registry must validate.');
assert.equal(validateGearSchemaContract(), true, 'Gear schema contract must include the P8.5-E affix gate.');
assert.equal(gearAffixDefinitions.length, gearAffixSemanticIds.length, 'Every semantic affix needs exactly one authored roll definition.');
assert.equal(new Set(gearAffixDefinitions.map(definition => definition.id)).size, gearAffixDefinitions.length, 'Affix IDs must be unique.');

assert.deepEqual(gearRarityModifierBudgets.Field, { minGenerated: 0, maxExplicit: 0, randomRolls: false, curatedFixedPackage: false }, 'Field must remain a clean base.');
assert.equal(gearRarityModifierBudgets.Refined.maxExplicit, 2, 'Refined must cap at two explicit modifiers.');
assert.equal(gearRarityModifierBudgets.Prototype.maxExplicit, 6, 'Prototype must cap at six explicit modifiers.');
assert.equal(gearRarityModifierBudgets.Singular.curatedFixedPackage, true, 'Singular must use a curated fixed package instead of random affixes.');

const expectedGradeFloors: Record<ModifierGrade, number> = { 1: 4, 2: 4, 3: 19, 4: 31, 5: 43 };
for (const definition of gearAffixDefinitions) {
  assert.equal(definition.family, modifierFamilyFor(definition.id), `${definition.id} family must agree with the live combat family.`);
  assert.ok(definition.weight > 0, `${definition.id} needs a positive roll weight.`);
  assert.ok(definition.group.length > 0, `${definition.id} needs a mod group.`);
  assert.ok(definition.allowedSlots.length > 0, `${definition.id} needs legal slots.`);
  assert.equal(definition.grades.length, 5, `${definition.id} needs a complete G1-G5 table.`);

  const profile = affixStatProfile(definition.id);
  const semanticStats = new Set([...profile.stats, ...profile.tradeoffs]);
  for (const gradeValue of [1, 2, 3, 4, 5] as const) {
    const table = affixGradeDefinition(definition.id, gradeValue);
    assert.equal(table.minimumRecoveryLevel, expectedGradeFloors[gradeValue], `${definition.id} G${gradeValue} Recovery Level floor drifted.`);
    assert.ok(modifierGradeCeilingForRecovery(table.minimumRecoveryLevel) >= gradeValue, `${definition.id} G${gradeValue} must be legal at its authored floor.`);
    assert.ok(Object.keys(table.stats).length > 0, `${definition.id} G${gradeValue} needs an explicit stat table.`);
    for (const statId of [...Object.keys(table.stats), ...Object.keys(table.tradeoffs ?? {})]) {
      assert.ok(semanticStats.has(statId as never), `${definition.id} G${gradeValue} references a stat outside its semantic profile: ${statId}`);
    }
  }

  for (const conflict of definition.conflicts) {
    assert.equal(affixesConflict(definition.id, conflict), true, `${definition.id}/${conflict} conflict should be enforced.`);
    assert.ok(gearAffixDefinition(conflict).conflicts.includes(definition.id), `${definition.id}/${conflict} conflict must be reciprocal.`);
  }
}

for (const base of gearBaseDefinitions) {
  for (const affixId of base.allowedAffixGroups) {
    assert.ok(gearAffixDefinition(affixId).allowedSlots.includes(base.slot), `${base.id} exposes ${affixId} on an illegal slot.`);
  }
  assert.ok(
    base.allowedAffixGroups.some(id => isAffixEligibleForRoll(id, base.slot, 4, base.allowedAffixGroups)),
    `${base.id} should have at least one early-Recovery legal modifier.`,
  );
}

const backblast = gearBaseDefinition('b4-backblast-thruster');
assert.ok(backblast, 'Backblast base is required for conflict coverage.');
assert.equal(
  isAffixEligibleForRoll('countermass', 'breacher', 12, backblast.allowedAffixGroups, ['breachPropulsion']),
  false,
  'Countermass must not roll beside Breacher propulsion on ordinary gear.',
);
const cryoBreacher = gearBaseDefinition('b4-cryo-cycle-action');
assert.ok(cryoBreacher, 'Cryo Breacher base is required for thermal conflict coverage.');
assert.equal(
  isAffixEligibleForRoll('dodgeVent', 'breacher', 12, cryoBreacher.allowedAffixGroups, ['cryoloop']),
  false,
  'Dodge vent and passive cryogenic routing must be mutually exclusive on ordinary gear.',
);

const denseCarbine = gearBaseDefinition('m7-dense-flight-receiver');
assert.ok(denseCarbine, 'Dense-flight Carbine base is required for Recovery Level coverage.');
assert.equal(isAffixEligibleForRoll('tungsten', 'carbine', 4, denseCarbine.allowedAffixGroups), false, 'Tungsten must stay Recovery Level gated.');
assert.equal(isAffixEligibleForRoll('tungsten', 'carbine', 12, denseCarbine.allowedAffixGroups), true, 'Tungsten should unlock at RL12.');
assert.equal(isAffixEligibleForRoll('railFracture', 'carbine', 56, denseCarbine.allowedAffixGroups), false, 'Rail-only transformers must never leak onto Carbines.');

assert.equal(weightedAffixChoice(['hypervelocity', 'tungsten'], () => 0), 'hypervelocity', 'Weighted selection should be deterministic at the low edge.');
assert.equal(weightedAffixChoice(['hypervelocity', 'tungsten'], () => 0.999999), 'tungsten', 'Weighted selection should cover the full candidate range.');

assert.equal(validateAffixSet({
  slot: 'carbine',
  recoveryLevel: 12,
  rarity: 'Field',
  baseAllowedAffixes: denseCarbine.allowedAffixGroups,
  affixes: ['hypervelocity'],
}), false, 'Field items cannot carry random explicit modifiers.');
assert.equal(validateAffixSet({
  slot: 'carbine',
  recoveryLevel: 12,
  rarity: 'Refined',
  baseAllowedAffixes: denseCarbine.allowedAffixGroups,
  affixes: ['hypervelocity', 'tungsten', 'overdrive'],
}), false, 'Refined items cannot exceed two explicit modifiers.');
assert.equal(validateAffixSet({
  slot: 'carbine',
  recoveryLevel: 12,
  rarity: 'Prototype',
  baseAllowedAffixes: denseCarbine.allowedAffixGroups,
  affixes: ['hypervelocity', 'tungsten', 'overdrive'],
}), true, 'Prototype should accept a legal multi-mod package within its budget.');
assert.equal(validateAffixSet({
  slot: 'rail',
  recoveryLevel: 56,
  rarity: 'Singular',
  baseAllowedAffixes: [],
  affixes: ['railFracture', 'hypervelocity', 'cryoloop'],
  curatedSingular: true,
}), true, 'Curated Singular packages may intentionally bypass ordinary base/conflict rules.');

const gradeTwo = materializeModifier('overdrive', 2);
assert.equal(gradeTwo.label, gearAffixDefinition('overdrive').name, 'Live modifier labels must come from the affix registry.');
assert.equal(gradeTwo.family, gearAffixDefinition('overdrive').family, 'Live modifier family must come from the affix registry.');

const wallet: SalvageWallet = { credits: 9999, alloys: 999, electronics: 999, medstock: 999, components: 999, rareTech: 999 };
const profile = createDefaultProfile();
const fieldResult = reconstructItem(profile, wallet, 2, 'starter-suit', { kind: 'add', family: 'core' });
assert.deepEqual(fieldResult.profile, profile, 'Reconstruction must not add random affixes to Field gear.');
assert.ok(fieldResult.message.includes('0-modifier reconstruction limit'), 'Field reconstruction should explain its zero-modifier budget.');

const refinedSuit = profile.inventory.find(item => item.id === 'starter-suit');
assert.ok(refinedSuit, 'Starter suit is required for rarity-budget reconstruction coverage.');
const refinedProfile = {
  ...profile,
  inventory: profile.inventory.map(item => item.id === refinedSuit.id ? {
    ...item,
    rarity: 'Refined' as const,
    modifiers: [materializeModifier('vacuumSeal', 2), materializeModifier('capacitorRecycler', 2)],
  } : item),
};
const refinedResult = reconstructItem(refinedProfile, wallet, 2, refinedSuit.id, { kind: 'add', family: 'core' });
assert.deepEqual(refinedResult.profile, refinedProfile, 'Reconstruction must not exceed the Refined two-modifier budget.');
assert.ok(refinedResult.message.includes('2-modifier reconstruction limit'), 'Refined reconstruction should expose the shared two-modifier budget.');
assert.equal(maximumExplicitModifiersForRarity('Prototype'), 6, 'Reconstruction and loot must share the Prototype six-modifier ceiling.');

const metaSource = readFileSync('src/game/meta.ts', 'utf8');
const reconstructionSource = readFileSync('src/game/reconstruction.ts', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');
assert.ok(metaSource.includes('isAffixEligibleForRoll') && metaSource.includes('weightedAffixChoice'), 'Live loot must consume legality, conflicts, Recovery Level gates, and weights.');
assert.ok(metaSource.includes('gearAffixDefinitions.map'), 'Singular and live modifier metadata should be sourced from the shared affix registry.');
assert.ok(reconstructionSource.includes('maximumExplicitModifiersForRarity') && reconstructionSource.includes('resolveGearBase'), 'Reconstruction must share rarity budgets and base-aware legal pools.');
assert.ok(packageSource.includes('test:gear-affix-rules'), 'Production build must gate on the P8.5-E affix regression.');

console.log(`GEAR_AFFIX_RULES_PASS affixes=${gearAffixDefinitions.length} field=0 refined=2 prototype=6 conflicts=2`);
