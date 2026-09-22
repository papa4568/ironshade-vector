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
    xp: 10200,
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
assert.equal(Math.round(craftingVolatileSuccessChance(stable) * 100), 90);
assert.equal(Math.round(craftingVolatileSuccessChance(item({ craftStability: 20 })) * 100), 66);
const stableRules = craftingRulesForItem(stable, 2);
assert.equal(stableRules.stability, 100);
assert.equal(Math.round(stableRules.volatileSuccessChance * 100), 90);

// Premium control: choose an exact legal modifier from the base-owned pool.
const precisionTarget = item({ modifiers: [] });
const precisionAdd: ReconstructionAction = { kind: 'add', family: 'core', targetAffixId: 'tungsten' };
assert.equal(reconstructionCost(precisionTarget, precisionAdd, 2).rareTech, 1, 'Precision Add must spend one Quarantined Trace.');
const precisionProfile = profile(precisionTarget);
const precisionResult = reconstructItem(precisionProfile, wallet, 2, precisionTarget.id, precisionAdd);
assert.deepEqual(precisionResult.profile.inventory[0].modifiers.map(modifier => modifier.id), ['tungsten'], 'Precision Add must install the named legal target.');
assert.equal(precisionResult.wallet.rareTech, wallet.rareTech - 1);

const illegalPrecision: ReconstructionAction = { kind: 'add', family: 'core', targetAffixId: 'hypervelocity' };
const illegalProfile = profile(precisionTarget);
const illegalPrecisionResult = reconstructItem(illegalProfile, wallet, 2, precisionTarget.id, illegalPrecision);
assert.equal(illegalPrecisionResult.profile, illegalProfile, 'An illegal exact target must be rejected before inventory mutation.');
assert.equal(illegalPrecisionResult.wallet, wallet, 'An illegal exact target must not spend materials.');
assert.match(illegalPrecisionResult.message, /not legal/i);

const tierOneProfile = profile(precisionTarget);
const tierOnePrecision = reconstructItem(tierOneProfile, wallet, 1, precisionTarget.id, precisionAdd);
assert.equal(tierOnePrecision.profile, tierOneProfile, 'Precision Add must remain a Microforge T2 control.');
assert.equal(tierOnePrecision.wallet, wallet);

// Family lock + exact protected replacement.
const replaceTarget = item({ craftStability: 50 });
const protectedReplace: ReconstructionAction = {
  kind: 'recalibrate',
  modifierId: 'countermass',
  lockedFamily: 'systems',
  targetAffixId: 'tungsten',
  mode: 'protected',
};
const protectedCost = reconstructionCost(replaceTarget, protectedReplace, 2);
assert.equal(protectedCost.rareTech, 1, 'Protected exact Replace must spend one Quarantined Trace.');
const protectedResult = reconstructItem(profile(replaceTarget), wallet, 2, replaceTarget.id, protectedReplace);
assert.equal(protectedResult.profile.inventory[0].modifiers[0].id, 'tungsten');
assert.equal(protectedResult.profile.inventory[0].craftStability, 62, 'Protected work should recover bounded stability.');
assert.equal(protectedResult.wallet.rareTech, wallet.rareTech - 1);

const lockedReplace: ReconstructionAction = {
  kind: 'recalibrate',
  modifierId: 'countermass',
  lockedFamily: 'core',
  targetAffixId: 'tungsten',
  mode: 'protected',
};
const lockedProfile = profile(replaceTarget);
const lockedResult = reconstructItem(lockedProfile, wallet, 2, replaceTarget.id, lockedReplace);
assert.equal(lockedResult.profile, lockedProfile, 'The selected lock family must be protected from replacement.');
assert.equal(lockedResult.wallet, wallet);
assert.match(lockedResult.message, /locked and protected/i);

// Elevation choice: jump to any legal grade while retaining Recovery/Microforge ceilings.
const elevationTarget = item({ modifiers: [materializeModifier('countermass', 3)], craftStability: 70 });
const controlledPrime: ReconstructionAction = { kind: 'grade', modifierId: 'countermass', targetGrade: 5, mode: 'controlled' };
assert.equal(reconstructionCost(elevationTarget, controlledPrime, 2).rareTech, 1, 'Any elevation path entering G5 must still spend a Quarantined Trace.');
const elevated = reconstructItem(profile(elevationTarget), wallet, 2, elevationTarget.id, controlledPrime);
assert.equal(elevated.profile.inventory[0].modifiers[0].grade, 5);
assert.equal(elevated.profile.inventory[0].craftStability, 75);
assert.equal(elevated.wallet.rareTech, wallet.rareTech - 1);

const recoveryLocked = item({ recoveryLevel: 30, modifiers: [materializeModifier('countermass', 3)] });
const recoveryLockedProfile = profile(recoveryLocked);
const blockedPrime = reconstructItem(recoveryLockedProfile, wallet, 2, recoveryLocked.id, controlledPrime);
assert.equal(blockedPrime.profile, recoveryLockedProfile, 'Elevation choices must not bypass the Recovery Level ceiling.');
assert.equal(blockedPrime.wallet, wallet);
assert.match(blockedPrime.message, /no higher than/i);

// Volatile work is deterministic, spends stability on success or failure, and never bypasses legality.
const volatileElevationTarget = item({ craftStability: 100, modifiers: [materializeModifier('countermass', 3)] });
const volatileElevation: ReconstructionAction = { kind: 'grade', modifierId: 'countermass', targetGrade: 4, mode: 'volatile' };
assert.equal(reconstructionCost(volatileElevationTarget, volatileElevation, 2).rareTech ?? 0, 0, 'Sub-Prime volatile elevation must stay on ordinary salvage.');
const volatileElevationResult = reconstructItem(profile(volatileElevationTarget), wallet, 2, volatileElevationTarget.id, volatileElevation);
assert.equal(volatileElevationResult.profile.inventory[0].craftStability, 80, 'Volatile attempts must drain 20 stability whether they land or fail.');
assert.ok([3, 4].includes(volatileElevationResult.profile.inventory[0].modifiers[0].grade ?? 3));
assert.equal(volatileElevationResult.wallet.rareTech, wallet.rareTech);

const volatilePrimeTarget = item({ modifiers: [materializeModifier('countermass', 4)] });
const volatilePrime: ReconstructionAction = { kind: 'grade', modifierId: 'countermass', targetGrade: 5, mode: 'volatile' };
assert.equal(reconstructionCost(volatilePrimeTarget, volatilePrime, 2).rareTech, 1, 'Volatile mode must not bypass the G5 Trace requirement.');

const volatileReplaceTarget = item({ craftStability: 60 });
const volatileReplace: ReconstructionAction = {
  kind: 'recalibrate',
  modifierId: 'countermass',
  lockedFamily: 'systems',
  targetAffixId: 'tungsten',
  mode: 'volatile',
};
assert.equal(reconstructionCost(volatileReplaceTarget, volatileReplace, 2).rareTech ?? 0, 0, 'Volatile Replace may trade certainty for stability instead of a Trace.');
const volatileReplaceResult = reconstructItem(profile(volatileReplaceTarget), wallet, 2, volatileReplaceTarget.id, volatileReplace);
assert.equal(volatileReplaceResult.profile.inventory[0].craftStability, 40);
assert.ok(['countermass', 'tungsten'].includes(volatileReplaceResult.profile.inventory[0].modifiers[0].id), 'Volatile Replace may fail, but it may never produce an illegal modifier.');
assert.equal(volatileReplaceResult.wallet.rareTech, wallet.rareTech);

// Stability is save-compatible: legacy items default to 100 and new values survive normalization.
const persisted = normalizeStoredProfile(profile(item({ craftStability: 37 })));
assert.equal(persisted.inventory.find(entry => entry.id === 'p10-c-test')?.craftStability, 37);
const legacyItem = item();
delete legacyItem.craftStability;
const legacyNormalized = normalizeStoredProfile(profile(legacyItem));
assert.equal(legacyNormalized.inventory.find(entry => entry.id === 'p10-c-test')?.craftStability, 100);

const armorySource = readFileSync(new URL('../src/components/Armory.tsx', import.meta.url), 'utf8');
const craftingCss = readFileSync(new URL('../src/classBuilds.css', import.meta.url), 'utf8');
for (const label of ['P10-C // CONTROL VS RISK', 'Precision Add', 'ELEVATION CHOICE', 'Protected', 'Risk Replace', 'VOLATILE SUCCESS']) {
  assert.equal(armorySource.includes(label), true, `Crafting UI must expose P10-C control: ${label}.`);
}
assert.equal(craftingCss.includes('P10-C // control vs risk'), true);
assert.equal(craftingCss.includes('@media (max-width: 900px)'), true, 'P10-C controls must retain a mobile layout.');

console.log('CRAFTING_CONTROL_RISK_PASS targets=legal lock=protected elevation=choice volatile=stability save=persisted');
