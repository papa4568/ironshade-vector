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
