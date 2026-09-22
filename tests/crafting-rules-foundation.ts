import assert from 'node:assert/strict';
import {
  craftingFamilyDefinitions,
  craftingGradeDefinitions,
  craftingRulesForItem,
  legalCraftingAffixes,
  validateCraftingRulesFoundation,
} from '../src/game/craftingRules';
import { materializeModifier, type Item } from '../src/game/meta';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'p10-a-test',
    baseId: 'm7-countermass-receiver',
    name: 'P10-A Countermass Receiver',
    slot: 'carbine',
    equipmentClass: 'Test carbine',
    rarity: 'Refined',
    levelRequirement: 1,
    core: 'Test frame',
    modifiers: [materializeModifier('countermass', 2)],
    recoveryLevel: 20,
    frameGeneration: 1,
    equipmentQuality: 0,
    augmentSlots: 1,
    augments: [],
    recoveryQuality: 2,
    ...overrides,
  };
}

assert.equal(validateCraftingRulesFoundation(), true, 'P10-A crafting contract must validate.');
assert.deepEqual(Object.keys(craftingFamilyDefinitions).sort(), ['core', 'systems']);
assert.equal(craftingGradeDefinitions.length, 5);
assert.deepEqual(craftingGradeDefinitions.map(entry => entry.minimumRecoveryLevel), [4, 4, 19, 31, 43]);

const refined = craftingRulesForItem(item(), 1);
assert.equal(refined.base?.id, 'm7-countermass-receiver', 'Base frame must be the legal-pool owner.');
assert.equal(refined.rarity.currentExplicit, 1);
assert.equal(refined.rarity.maxExplicit, 2, 'Refined rarity must cap at two explicit modifiers.');
assert.equal(refined.rarity.remainingExplicit, 1);
assert.equal(refined.recoveryGradeCap, 3);
assert.equal(refined.forgeGradeCap, 4);
assert.equal(refined.gradeCeiling, 3, 'The lower Recovery/Microforge ceiling must control grade access.');
assert.equal(refined.pool.find(entry => entry.id === 'countermass')?.status, 'installed');
assert.equal(refined.pool.find(entry => entry.id === 'tungsten')?.status, 'legal');
assert.equal(refined.pool.find(entry => entry.id === 'magRedirect')?.family, 'systems');

const lowRecovery = craftingRulesForItem(item({ recoveryLevel: 4, modifiers: [] }), 2);
assert.equal(lowRecovery.pool.find(entry => entry.id === 'tungsten')?.status, 'recovery-locked', 'High-recovery affixes must be visible but locked.');
assert.equal(lowRecovery.gradeCeiling, 2, 'Recovery Level must still cap grade access on a max-tier Microforge.');

const conflictRules = craftingRulesForItem(item({
  baseId: 'b4-backblast-thruster',
  slot: 'breacher',
  name: 'Conflict test breacher',
  modifiers: [materializeModifier('countermass', 2)],
}), 2);
assert.equal(conflictRules.pool.find(entry => entry.id === 'breachPropulsion')?.status, 'conflict', 'Mutually exclusive frame routes must surface their conflict before spending.');
assert.equal(legalCraftingAffixes(item({
  baseId: 'b4-backblast-thruster',
  slot: 'breacher',
  modifiers: [materializeModifier('countermass', 2)],
}), 2).some(entry => entry.id === 'breachPropulsion'), false, 'Runtime legal choices must exclude conflicting affixes.');

const denseFlight = craftingRulesForItem(item({ baseId: 'm7-dense-flight-receiver', modifiers: [] }), 2);
const countermass = craftingRulesForItem(item({ baseId: 'm7-countermass-receiver', modifiers: [] }), 2);
assert.notDeepEqual(
  denseFlight.pool.map(entry => entry.id).sort(),
  countermass.pool.map(entry => entry.id).sort(),
  'Different base frames must expose materially different legal modifier pools.',
);
assert.equal(denseFlight.pool.some(entry => entry.id === 'hypervelocity'), true);
assert.equal(countermass.pool.some(entry => entry.id === 'hypervelocity'), false);

const field = craftingRulesForItem(item({ rarity: 'Field', modifiers: [] }), 2);
assert.equal(field.rarity.maxExplicit, 0, 'Field gear must remain a clean base with no explicit modifier budget.');

const prototype = craftingRulesForItem(item({ rarity: 'Prototype', modifiers: [] }), 2);
assert.equal(prototype.rarity.minGenerated, 4);
assert.equal(prototype.rarity.maxExplicit, 6);

const singular = craftingRulesForItem(item({ rarity: 'Singular' }), 2);
assert.equal(singular.rarity.curatedFixedPackage, true);
assert.equal(singular.pool.every(entry => entry.status === 'fixed-package'), true, 'Singular legal pools must be reference-only.');

console.log('CRAFTING_RULES_FOUNDATION_PASS families=2 grades=5 rarity=field/refined/prototype/singular pool=base-owned compatibility=visible');
