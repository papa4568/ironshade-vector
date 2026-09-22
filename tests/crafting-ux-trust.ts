import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SalvageWallet } from '../src/game/campaign';
import {
  reconstructItem,
  reconstructionCost,
  reconstructionPreview,
  type ReconstructionAction,
} from '../src/game/reconstruction';
import {
  createDefaultProfile,
  materializeModifier,
  normalizeStoredProfile,
  type Item,
  type PlayerProfile,
} from '../src/game/meta';

const wallet: SalvageWallet = {
  credits: 5000,
  alloys: 30,
  electronics: 30,
  medstock: 0,
  components: 30,
  rareTech: 8,
};

function testItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'p10-e-test',
    baseId: 'm7-countermass-receiver',
    name: 'P10-E Trust Frame',
    slot: 'carbine',
    equipmentClass: 'Test carbine',
    rarity: 'Prototype',
    levelRequirement: 1,
    core: 'Crafting trust fixture.',
    modifiers: [materializeModifier('countermass', 3)],
    recoveryLevel: 50,
    frameGeneration: 5,
    equipmentQuality: 4,
    augmentSlots: 2,
    augments: [],
    recoveryQuality: 4,
    recoverySource: 'P10-E regression',
    craftStability: 80,
    ...overrides,
  };
}

function profileFor(item: Item): PlayerProfile {
  const base = createDefaultProfile();
  return {
    ...base,
    level: 18,
    xp: 10200,
    operatorClass: 'systems',
    classSelectionComplete: true,
    specialization: null,
    allocatedNodes: [],
    inventory: [item],
    equipped: { carbine: item.id, breacher: null, rail: null, suit: null, rig: null, implant: null },
    craftHistory: [],
  };
}

const frame = testItem();
const profile = profileFor(frame);

const qualityAction: ReconstructionAction = { kind: 'quality' };
const qualityPreview = reconstructionPreview(profile, wallet, 2, frame, qualityAction);
assert.equal(qualityPreview.blockedReason, null);
assert.equal(qualityPreview.canAfford, true);
assert.deepEqual(qualityPreview.cost, reconstructionCost(frame, qualityAction, 2, profile));
assert.match(qualityPreview.guaranteed.join(' '), /Frame Quality 4 → 6/);
assert.match(qualityPreview.before, /Q4\/20/);
assert.match(qualityPreview.after, /Q6\/20/);
assert.equal(qualityPreview.possible.length, 0, 'Controlled Improve should not invent random outcomes.');

const emptyWallet: SalvageWallet = { credits: 0, alloys: 0, electronics: 0, medstock: 0, components: 0, rareTech: 0 };
const poorPreview = reconstructionPreview(profile, emptyWallet, 2, frame, qualityAction);
assert.equal(poorPreview.canAfford, false);
assert.match(poorPreview.exclusions.join(' '), /Insufficient salvage/i);

const volatileAction: ReconstructionAction = { kind: 'grade', modifierId: 'countermass', targetGrade: 4, mode: 'volatile' };
const volatilePreview = reconstructionPreview(profile, wallet, 2, frame, volatileAction);
assert.equal(volatilePreview.blockedReason, null);
assert.equal(volatilePreview.volatile, true);
assert.equal(volatilePreview.possible.length, 2);
assert.match(volatilePreview.possible[0], /Success \(84%\)/);
assert.match(volatilePreview.possible[1], /Failure \(16%\)/);
assert.match(volatilePreview.risk.join(' '), /falls by 20/i);
assert.match(volatilePreview.after, /Success: G4 .* Failure: G3 .* stability 60%/);
assert.doesNotMatch(volatilePreview.after, /landed|failed/i, 'Preview must show the result space, not disclose the deterministic volatile roll.');

const singular = testItem({
  id: 'p10-e-singular',
  rarity: 'Singular',
  modifiers: [materializeModifier('countermass', 5)],
  singularTrait: 'nullpoint',
  singularEffect: 'Fixed P10-E package.',
  singularRule: 'Fixed authored package.',
  singularOpportunityCost: 'No explicit package edits.',
});
const singularProfile = profileFor(singular);
const blockedAdd: ReconstructionAction = { kind: 'add', family: 'core', targetAffixId: 'tungsten' };
const singularPreview = reconstructionPreview(singularProfile, wallet, 2, singular, blockedAdd);
assert.ok(singularPreview.blockedReason);
assert.match(singularPreview.blockedReason ?? '', /fixed/i);
assert.match(singularPreview.exclusions.join(' '), /Singular signature/i);

const crafted = reconstructItem(profile, wallet, 2, frame.id, qualityAction);
assert.equal(crafted.profile.inventory[0].equipmentQuality, 6);
assert.equal(crafted.profile.craftHistory?.length, 1);
const receipt = crafted.profile.craftHistory?.[0];
assert.ok(receipt);
assert.equal(receipt?.itemId, frame.id);
assert.match(receipt?.action ?? '', /Improve frame quality/);
assert.match(receipt?.cost ?? '', /Credits/);
assert.match(receipt?.before ?? '', /Q4\/20/);
assert.match(receipt?.after ?? '', /Q6\/20/);
assert.match(receipt?.outcome ?? '', /improved to 6\/20/i);

const seededHistory = Array.from({ length: 12 }, (_, index) => ({
  id: `old-${index}`,
  createdAt: index + 1,
  itemId: frame.id,
  itemName: frame.name,
  action: 'Old craft',
  cost: '1 Credits',
  outcome: 'Old receipt',
  before: 'before',
  after: 'after',
  volatile: false,
}));
const boundedProfile = { ...profile, craftHistory: seededHistory };
const boundedResult = reconstructItem(boundedProfile, wallet, 2, frame.id, qualityAction);
assert.equal(boundedResult.profile.craftHistory?.length, 12);
assert.notEqual(boundedResult.profile.craftHistory?.[0].id, 'old-0');
assert.equal(boundedResult.profile.craftHistory?.some(entry => entry.id === 'old-11'), false, 'History must remain bounded to the 12 newest receipts.');

const persisted = normalizeStoredProfile(crafted.profile);
assert.equal(persisted.craftHistory?.length, 1);
assert.equal(persisted.craftHistory?.[0].outcome, receipt?.outcome);

const armory = readFileSync(new URL('../src/components/Armory.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/classBuilds.css', import.meta.url), 'utf8');
for (const required of [
  'P10-E // CRAFT REVIEW',
  'EXACT COST',
  'GUARANTEED',
  'POSSIBLE',
  'EXCLUSIONS / RISK',
  'BEFORE',
  'AFTER',
  'Confirm craft',
  'P10-E // SALVAGE LOOP',
  'P10-E // CRAFT HISTORY',
  'Quarantined Trace',
]) {
  assert.ok(armory.includes(required), `Missing P10-E trust UI contract: ${required}`);
}
assert.ok(css.includes('P10-E // crafting UX trust'));
assert.ok(css.includes('@media (max-width: 900px)'), 'P10-E must retain a touch/mobile layout.');

console.log('CRAFTING_UX_TRUST_PASS preview=confirm-first exact-cost=result-space before-after history=12 salvage-loop=visible');
