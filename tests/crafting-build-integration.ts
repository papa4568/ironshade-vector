import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { craftingRulesForItem } from '../src/game/craftingRules';
import { craftingBuildIntegration, reconstructItem, reconstructionCost, type ReconstructionAction } from '../src/game/reconstruction';
import { createDefaultProfile, materializeModifier, type Item, type PlayerProfile } from '../src/game/meta';
import type { SalvageWallet } from '../src/game/campaign';

const wallet: SalvageWallet = { credits: 5000, alloys: 30, electronics: 30, medstock: 0, components: 30, rareTech: 10 };

function railItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'p10-d-rail',
    baseId: 'r2-hypervelocity-bed',
    name: 'P10-D Rail',
    slot: 'rail',
    equipmentClass: 'Rail assembly',
    rarity: 'Refined',
    levelRequirement: 1,
    core: 'P10-D fixture.',
    modifiers: [],
    recoveryLevel: 50,
    frameGeneration: 5,
    frameIdentity: 'rail-hypervelocity',
    equipmentQuality: 0,
    augmentSlots: 2,
    augments: [],
    recoveryQuality: 4,
    recoverySource: 'P10-D regression',
    craftStability: 100,
    ...overrides,
  };
}

function profileFor(item: Item, operatorClass: 'vanguard' | 'vector' = 'vector'): PlayerProfile {
  const base = createDefaultProfile();
  return {
    ...base,
    level: 18,
    xp: 10200,
    operatorClass,
    classSelectionComplete: true,
    specialization: operatorClass === 'vector' ? 'survey-deadeye' : null,
    specializationOverclock: false,
    allocatedNodes: operatorClass === 'vector' ? ['survey-deadeye-network-hook'] : [],
    inventory: [item],
    equipped: { carbine: null, breacher: null, rail: operatorClass === 'vector' ? item.id : null, suit: null, rig: null, implant: null },
  };
}

const owned = railItem();
const vector = profileFor(owned);
const rules = craftingRulesForItem(owned, 2, vector);
assert.equal(rules.classOwnership.owned, true);
assert.ok(rules.pool.some(entry => entry.status === 'legal'));

const vanguard = profileFor(owned, 'vanguard');
const locked = craftingRulesForItem(owned, 2, vanguard);
assert.equal(locked.classOwnership.owned, false);
assert.ok(locked.pool.length > 0 && locked.pool.every(entry => entry.status === 'class-locked'));
const rejected = reconstructItem(vanguard, wallet, 2, owned.id, { kind: 'quality' });
assert.equal(rejected.profile, vanguard);
assert.equal(rejected.wallet, wallet);
assert.match(rejected.message, /class-family lock/i);

const integration = craftingBuildIntegration(vector, owned, 2);
assert.equal(integration.specializationHookActive, true);
assert.equal(integration.recipeName, 'Survey Ballistics');
assert.ok(integration.recipeAffixIds.length > 0);
for (const id of integration.recipeAffixIds) assert.ok(rules.pool.some(entry => entry.id === id && entry.status === 'legal'));

const recipeTarget = integration.recipeAffixIds[0]!;
const recipeFamily = rules.pool.find(entry => entry.id === recipeTarget)!.family;
const recipeAction: ReconstructionAction = { kind: 'add', family: recipeFamily, targetAffixId: recipeTarget };
const unlinked = { ...vector, allocatedNodes: [] };
assert.ok((reconstructionCost(owned, recipeAction, 2, vector).credits ?? 0) < (reconstructionCost(owned, recipeAction, 2, unlinked).credits ?? 0));
const crafted = reconstructItem(vector, wallet, 2, owned.id, recipeAction);
assert.ok(crafted.profile.inventory[0].modifiers.some(modifier => modifier.id === recipeTarget));

assert.ok(integration.recipeAugmentIds.includes('ferrite-coupler'));
const socketAction: ReconstructionAction = { kind: 'installAugment', augmentId: 'ferrite-coupler' };
assert.ok((reconstructionCost(owned, socketAction, 2, vector).credits ?? 0) < (reconstructionCost(owned, socketAction, 2, unlinked).credits ?? 0));

const singular = railItem({
  id: 'p10-d-singular',
  rarity: 'Singular',
  modifiers: [materializeModifier('hypervelocity', 5)],
  singularTrait: 'nullpoint',
  singularEffect: 'Fixed P10-D rule.',
  singularRule: 'Fixed authored package.',
  singularOpportunityCost: 'No random explicit edits.',
});
const singularProfile = profileFor(singular);
const singularIntegration = craftingBuildIntegration(singularProfile, singular, 2);
assert.deepEqual(singularIntegration.recipeAffixIds, []);
assert.match(singularIntegration.singularRule ?? '', /fixed singular/i);

const qualityResult = reconstructItem(singularProfile, wallet, 2, singular.id, { kind: 'quality' });
assert.equal(qualityResult.profile.inventory[0].equipmentQuality, 2);
assert.deepEqual(qualityResult.profile.inventory[0].modifiers.map(modifier => [modifier.id, modifier.grade]), [['hypervelocity', 5]]);

const singularAdd = reconstructItem(singularProfile, wallet, 2, singular.id, { kind: 'add', family: 'core', targetAffixId: 'tungsten' });
assert.equal(singularAdd.profile, singularProfile);
assert.equal(singularAdd.wallet, wallet);

const singularSocket = reconstructItem(singularProfile, wallet, 2, singular.id, socketAction);
assert.ok(singularSocket.profile.inventory[0].augments?.includes('ferrite-coupler'));

const stored = railItem({ augments: ['ferrite-coupler'] });
const switched = profileFor(stored, 'vanguard');
const extracted = reconstructItem(switched, wallet, 2, stored.id, { kind: 'removeAugment', augmentId: 'ferrite-coupler' });
assert.deepEqual(extracted.profile.inventory[0].augments, []);

const armory = readFileSync(new URL('../src/components/Armory.tsx', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../src/game/guideContent.ts', import.meta.url), 'utf8');
for (const required of ['SPECIALIZATION RECIPE LINK', 'FIXED SINGULAR PACKAGE', 'CLASS-FAMILY RECONSTRUCTION LOCK', 'Base frame + class-family ownership decide this list.']) {
  assert.ok(armory.includes(required), `Missing decision-critical P10-D UI contract: ${required}`);
}
assert.ok(guide.includes('active specialization field-integration links can discount matching legal recipe targets'), 'P19-C Guide must own reusable crafting/build-integration teaching.');
assert.equal(armory.includes('P10-D // BUILD INTEGRATION'), false, 'P19-C must not duplicate migrated build-integration teaching in Armory.');

console.log(`CRAFTING_BUILD_INTEGRATION_PASS class=owned recipes=${integration.recipeAffixIds.length} augments=${integration.recipeAugmentIds.length} quality=frame singular=fixed`);
