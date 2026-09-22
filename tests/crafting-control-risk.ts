import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  craftingRulesForItem,
  craftingStabilityForItem,
  craftingVolatileSuccessChance,
  validateCraftingRulesFoundation,
} from '../src/game/craftingRules';
import {
  reconstructItem,
  reconstructionCost,
  type ReconstructionAction,
} from '../src/game/reconstruction';
import {
  materializeModifier,
  normalizeStoredProfile,
  type Item,
  type PlayerProfile,
} from '../src/game/meta';
import type { SalvageWallet } from '../src/game/campaign';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'p10-c-test',
    baseId: 'm7-countermass-receiver',
    name: 'P10-C Countermass Receiver',
    slot: 'carbine',
    equipmentClass: 'Test carbine',
    rarity: 'Prototype',
    levelRequirement: 1,
    core: 'Test frame',
    modifiers: [materializeModifier('countermass', 3)],
    recoveryLevel: 50,
    frameGeneration: 1,
    equipmentQuality: 0,
    augmentSlots: 1,
    augments: [],
    recoveryQuality: 2,
    craftStability: 100,
    ...overrides,
  };
}

function profile(target: Item): PlayerProfile {
  return {
    version: 3,
    xp: 11340,
    level: 18,
    progressionPoints: 0,
    allocatedNodes: [],
    abilityMods: { mag: null, mark: null, arc: null },
    operatorClass: 'systems',
    classSelectionComplete: true,
    specialization: null,
    specializationOverclock: false,
    inventory: [target],
    equipped: { carbine: target.id, breacher: null, rail: null, suit: null, rig: null, implant: null },
    settings: {
      aimAssist: 'balanced',
      rightStickFire: false,
      screenShake: true,
      effectIntensity: 'full',
      effectsVolume: 1,
      uiVolume: 1,
      haptics: true,
      telemetrySharing: false,
      tutorialComplete: true,
    },
    runsCompleted: 0,
  };
}

const wallet: SalvageWallet = {
  credits: 5000,
  alloys: 20,
  electronics: 20,
  medstock: 0,
  components: 20,
  rareTech: 5,
};

assert.equal(validateCraftingRulesFoundation(), true, 'P10-C must preserve the P10-A/P10-B crafting contract.');

const stable = item();
assert.equal(craftingStabilityForItem(stable), 100);
assert.equal(craftingVolatileSuccessChance(stable), 0.9);
assert.equal(craftingVolatileSuccessChance(item({ craftStability: 20 })), 0.66);
const stableRules = craftingRulesForItem(stable, 2);
assert.equal(stableRules.stability, 100);
assert.equal(stableRules.volatileSuccessChance, 0.9);

// Premium control: choose an exact legal modifier from the base-owned pool.
const precisionTarget = item({ modifiers: [] });
const precisionAdd: ReconstructionAction = { kind: 'add', family: 'core', targetAffixId: 'tungsten' };
assert.equal(reconstructionCost(precisionTarget, precisionAdd, 2).rareTech, 1, 'Precision Add must spend one Quarantined Trace.');
const precisionResult = reconstructItem(profile(precisionTarget), wallet, 2, precisionTarget.id, precisionAdd);
assert.deepEqual(precisionResult.profile.inventory[0].modifiers.map(modifier => modifier.id), ['tungsten'], 'Precision Add must install the named legal target.');
assert.equal(precisionResult.wallet.rareTech, wallet.rareTech - 1);

const illegalPrecision: ReconstructionAction = { kind: 'add', family: 'core', targetAffixId: 'hypervelocity' };
const illegalPrecisionResult = reconstructItem(profile(precisionTarget), wallet, 2, precisionTarget.id, illegalPrecision);
assert.equal(illegalPrecisionResult.profile, profile(precisionTarget), 'Sanity placeholder should never be reached.');
