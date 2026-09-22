import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  craftingMaterialDefinitions,
  craftingMaterialsByTier,
  craftingVerbDefinitions,
  validateCraftingRulesFoundation,
} from '../src/game/craftingRules';
import { reconstructItem, reconstructionCost, type ReconstructionAction } from '../src/game/reconstruction';
import { materializeModifier, type Item, type PlayerProfile } from '../src/game/meta';
import type { SalvageWallet } from '../src/game/campaign';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'p10-b-test',
    baseId: 'm7-countermass-receiver',
    name: 'P10-B Countermass Receiver',
    slot: 'carbine',
    equipmentClass: 'Test carbine',
    rarity: 'Refined',
    levelRequirement: 1,
    core: 'Test frame',
    modifiers: [materializeModifier('countermass', 4)],
    recoveryLevel: 50,
    frameGeneration: 1,
    equipmentQuality: 0,
    augmentSlots: 1,
    augments: [],
    recoveryQuality: 2,
    ...overrides,
  };
}

function profile(target: Item): PlayerProfile {
  return {
    version: 3,
    xp: 0,
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
  rareTech: 3,
};

assert.equal(validateCraftingRulesFoundation(), true, 'P10-A/P10-B combined crafting contract must validate.');

const expectedVerbs = ['add', 'elevate', 'extract', 'improve', 'lock', 'remove', 'replace', 'reroute', 'socket'];
assert.deepEqual(Object.keys(craftingVerbDefinitions).sort(), expectedVerbs, 'P10-B must expose exactly nine Reconstruction verbs.');
assert.equal(craftingMaterialDefinitions.length, 4);
assert.deepEqual(craftingMaterialsByTier('common').map(material => material.resource).sort(), ['alloys', 'components', 'electronics']);
assert.deepEqual(craftingMaterialsByTier('chase').map(material => material.resource), ['rareTech']);
assert.deepEqual(craftingVerbDefinitions.replace.chaseMaterials, ['rareTech']);
assert.deepEqual(craftingVerbDefinitions.lock.chaseMaterials, ['rareTech']);
assert.deepEqual(craftingVerbDefinitions.elevate.chaseMaterials, ['rareTech']);

const target = item();
const primeElevation: ReconstructionAction = { kind: 'grade', modifierId: 'countermass' };
assert.equal(reconstructionCost(target, primeElevation, 2).rareTech, 1, 'G4 → G5 elevation must spend one chase Trace.');

const ordinaryElevationTarget = item({ modifiers: [materializeModifier('countermass', 3)] });
assert.equal(reconstructionCost(ordinaryElevationTarget, primeElevation, 2).rareTech ?? 0, 0, 'Sub-Prime elevation must remain on common salvage.');

const protectedReplace: ReconstructionAction = { kind: 'recalibrate', modifierId: 'countermass', lockedFamily: 'systems' };
assert.equal(reconstructionCost(target, protectedReplace, 2).rareTech, 1, 'Protected Replace must spend one chase Trace.');

const remove: ReconstructionAction = { kind: 'remove', modifierId: 'countermass' };
const removed = reconstructItem(profile(target), wallet, 2, target.id, remove);
assert.equal(removed.profile.inventory[0].modifiers.length, 0, 'Remove must reopen an explicit modifier slot.');
assert.match(removed.message, /removed/i);
assert.equal(removed.wallet.rareTech, wallet.rareTech, 'Remove must not consume chase material.');
assert.ok(removed.wallet.components < wallet.components, 'Remove must consume ordinary Reconstruction stock.');

const singular = item({ rarity: 'Singular' });
const singularRemoval = reconstructItem(profile(singular), wallet, 2, singular.id, remove);
assert.equal(singularRemoval.profile.inventory[0].modifiers.length, singular.modifiers.length, 'Fixed Singular packages must reject Remove.');
assert.equal(singularRemoval.wallet.components, wallet.components, 'Rejected Singular Remove must not spend materials.');

const armorySource = readFileSync(new URL('../src/components/Armory.tsx', import.meta.url), 'utf8');
const craftingCss = readFileSync(new URL('../src/classBuilds.css', import.meta.url), 'utf8');
for (const label of ['Improve +2', 'Elevate', 'Reroute', 'Replace', 'Remove', 'Lock Core', 'Lock Systems', 'SOCKET', 'Extract']) {
  assert.equal(armorySource.includes(label), true, `Crafting UI must expose the ${label} verb.`);
}
assert.equal(armorySource.includes('COMMON // ORDINARY SALVAGE'), true);
assert.equal(armorySource.includes('CHASE // PROTECTED CONTROL'), true);
assert.equal(armorySource.includes('Quarantined Trace'), true);
assert.equal(craftingCss.includes('P10-B // Reconstruction verbs + material tiers'), true);
assert.equal(craftingCss.includes('@media (max-width: 900px)'), true, 'P10-B contract must retain a mobile single-column layout.');

console.log('CRAFTING_VERBS_MATERIALS_PASS verbs=9 common=3 chase=trace remove=runtime prime=elevation replace=protected');
