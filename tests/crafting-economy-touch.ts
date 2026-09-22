import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buyShipUpgrade,
  createDefaultCampaign,
  generateContracts,
  settleContract,
  type OperationDirective,
  type SalvageWallet,
} from '../src/game/campaign';
import { buildDirectiveContract } from '../src/game/operationDirectives';
import { reconstructionCost, type ReconstructionAction } from '../src/game/reconstruction';
import { withOperationScaling } from '../src/game/scaling';
import { createDefaultProfile, materializeModifier, type Item, type PlayerProfile } from '../src/game/meta';
import { storyArcDefinitions } from '../src/game/story';

function canAfford(wallet: Partial<SalvageWallet>, cost: Partial<SalvageWallet>) {
  return (Object.entries(cost) as Array<[keyof SalvageWallet, number]>).every(([key, value]) => (wallet[key] ?? 0) >= value);
}

function addCosts(costs: Array<Partial<SalvageWallet>>): SalvageWallet {
  const total: SalvageWallet = { credits: 0, alloys: 0, electronics: 0, medstock: 0, components: 0, rareTech: 0 };
  for (const cost of costs) for (const [key, value] of Object.entries(cost) as Array<[keyof SalvageWallet, number]>) total[key] += value;
  return total;
}

function economyItem(): Item {
  return {
    id: 'p10-f-economy-frame',
    baseId: 'm7-countermass-receiver',
    name: 'P10-F Economy Frame',
    slot: 'carbine',
    equipmentClass: 'Economy QA carbine',
    rarity: 'Prototype',
    levelRequirement: 1,
    core: 'Campaign-to-T12 economy fixture.',
    modifiers: [materializeModifier('countermass', 3)],
    recoveryLevel: 50,
    frameGeneration: 5,
    equipmentQuality: 10,
    augmentSlots: 2,
    augments: [],
    recoveryQuality: 4,
    recoverySource: 'P10-F deterministic economy QA',
    craftStability: 100,
  };
}

function economyProfile(item: Item): PlayerProfile {
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
  };
}

function fixedDirective(tier: number): OperationDirective {
  return {
    id: `p10-f-t${tier}`,
    seed: 88000 + tier,
    tier,
    location: 'asteroid-refinery',
    locationName: 'Asteroid Refinery',
    sponsor: 'longarc',
    archetype: 'salvage',
    objectiveMode: 'deep-salvage',
    modifierIds: [],
    targetClass: 'elite-led',
    deepTarget: 'P10-F economy target',
    codename: `Economy ${tier}`,
    sourceLabel: 'P10-F fixed-risk simulation',
  };
}

// Campaign start -> Microforge T2 -> first chase resource.
// A crafting-oriented player taking deep salvage should reach T1 after one clear and T2 after two,
// without needing to starve ordinary Reconstruction.
let campaign = createDefaultCampaign();
const campaignRewards: SalvageWallet[] = [];
for (let clear = 0; clear < 3; clear += 1) {
  const generated = generateContracts(campaign);
  const salvage = generated.find(contract => contract.archetype === 'salvage' && !contract.megastructure);
  assert.ok(salvage, `Missing rotating salvage contract at campaign clear ${clear + 1}.`);
  const scaled = withOperationScaling(salvage, campaign, 6 + clear);
  const settled = settleContract(campaign, scaled, 'deep', 6);
  campaignRewards.push(settled.gained);
  campaign = settled.campaign;

  if (clear === 0) {
    const upgraded = buyShipUpgrade(campaign, 'fabrication');
    assert.equal(upgraded.campaign.shipUpgrades.fabrication, 1, 'One deep salvage clear should fund Microforge T1.');
    campaign = upgraded.campaign;
  }
  if (clear === 1) {
    const upgraded = buyShipUpgrade(campaign, 'fabrication');
    assert.equal(upgraded.campaign.shipUpgrades.fabrication, 2, 'Two deep salvage clears should fund Microforge T2.');
    campaign = upgraded.campaign;
  }
}
assert.equal(campaign.shipUpgrades.fabrication, 2);
assert.equal(campaign.resources.rareTech, 1, 'The first eligible deep anomaly should add one Quarantined Trace.');

const postAnomalyCandidate = generateContracts(campaign).find(contract => !contract.anomalyOpportunity) ?? generateContracts(campaign)[0];
assert.ok(postAnomalyCandidate, 'Campaign must keep at least one post-anomaly contract available.');
const postAnomaly = withOperationScaling(postAnomalyCandidate, campaign, 10);
campaign = settleContract(campaign, postAnomaly, 'deep', 6).campaign;
assert.equal(campaign.resources.rareTech, 1, 'Standard salvage must not turn the chase resource into a repeatable bulk drop.');

// Fixed-risk Operation Directives isolate tier scaling from random modifier packages.
// Common material yield should rise through T12 while Trace remains outside the normal material multiplier.
const tierRewards: SalvageWallet[] = [];
for (let tier = 1; tier <= 12; tier += 1) {
  const contract = withOperationScaling(buildDirectiveContract(campaign, fixedDirective(tier)), campaign, 20);
  assert.equal(contract.operationTier, tier);
  const reward = settleContract(campaign, contract, 'deep', 6).gained;
  tierRewards.push(reward);
  assert.equal(reward.rareTech, 0, `T${tier} common material scaling must not mint Quarantined Trace.`);
}
for (const key of ['credits', 'alloys', 'electronics', 'components'] as const) {
  for (let index = 1; index < tierRewards.length; index += 1) {
    assert.ok(tierRewards[index][key] >= tierRewards[index - 1][key], `${key} regressed from T${index} to T${index + 1}.`);
  }
  assert.ok(tierRewards[11][key] > tierRewards[0][key], `${key} must improve from T1 to T12.`);
}
assert.ok(tierRewards[11].credits >= tierRewards[0].credits * 1.35, 'T12 credit yield should materially exceed T1 at the same risk profile.');

// Representative ordinary Reconstruction should remain affordable from operation rewards,
// while deterministic premium control continues to consume authored chase currency.
const frame = economyItem();
const profile = economyProfile(frame);
const quality: ReconstructionAction = { kind: 'quality' };
const g4: ReconstructionAction = { kind: 'grade', modifierId: 'countermass', targetGrade: 4, mode: 'controlled' };
const addCore: ReconstructionAction = { kind: 'add', family: 'core' };
const ordinaryPackage = addCosts([
  reconstructionCost(frame, quality, 2, profile),
  reconstructionCost(frame, g4, 2, profile),
  reconstructionCost(frame, addCore, 2, profile),
]);
assert.equal(canAfford(tierRewards[0], reconstructionCost(frame, quality, 2, profile)), true, 'A T1 deep directive should fund at least one meaningful ordinary craft.');
assert.equal(canAfford(tierRewards[11], ordinaryPackage), true, 'A T12 deep directive should fund the representative three-action common-material package.');

const precisionAdd: ReconstructionAction = { kind: 'add', family: 'core', targetAffixId: 'tungsten' };
const primeElevation: ReconstructionAction = { kind: 'grade', modifierId: 'countermass', targetGrade: 5, mode: 'controlled' };
const protectedReplace: ReconstructionAction = { kind: 'recalibrate', modifierId: 'countermass', lockedFamily: 'systems', targetAffixId: 'tungsten', mode: 'protected' };
const premiumSample = addCosts([
  reconstructionCost(frame, precisionAdd, 2, profile),
  reconstructionCost(frame, primeElevation, 2, profile),
  reconstructionCost(frame, protectedReplace, 2, profile),
]);
assert.equal(premiumSample.rareTech, 3, 'Three premium deterministic controls should consume three Traces.');

const storySource = readFileSync(new URL('../src/game/story.ts', import.meta.url), 'utf8');
const latticeSource = readFileSync(new URL('../src/game/blackLattice.ts', import.meta.url), 'utf8');
assert.match(storySource, /if \(complete\) resources\.rareTech \+= 1/);
assert.match(latticeSource, /if \(complete\) resources\.rareTech \+= 2/);
const authoredGuaranteedTraceBudget = 1 + storyArcDefinitions.length + 2;
assert.equal(storyArcDefinitions.length, 3);
assert.equal(authoredGuaranteedTraceBudget, 6, 'Baseline campaign guarantees should expose six deliberate Trace opportunities: anomaly + three story finales + Black Lattice.');
assert.equal(authoredGuaranteedTraceBudget, premiumSample.rareTech * 2, 'Two three-control premium packages should consume the full guaranteed baseline, preserving chase-resource pressure.');

// Input QA: native buttons stay touch/keyboard friendly, while the reconstruction surface adds
// explicit gamepad focus/activate/back behavior. Browser mobile-landscape and Android emulator
// workflows exercise the same production bundle after this deterministic contract passes.
const armory = readFileSync(new URL('../src/components/Armory.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/classBuilds.css', import.meta.url), 'utf8');
for (const required of [
  'data-crafting-surface="true"',
  'P10-F // TOUCH + CONTROLLER',
  'focusCraftControlByOffset',
  "pad?.buttons[0]?.pressed",
  "pad?.buttons[1]?.pressed",
  'data-crafting-confirm="true"',
  'data-crafting-back="true"',
]) assert.ok(armory.includes(required), `Missing P10-F controller workflow contract: ${required}`);
for (const required of [
  '/* P10-F // economy + touch QA */',
  '.reconstruction-bench button:focus-visible',
  '@media (pointer: coarse)',
  'min-height: 48px',
  'touch-action: manipulation',
]) assert.ok(css.includes(required), `Missing P10-F touch contract: ${required}`);

console.log(`CRAFTING_ECONOMY_TOUCH_PASS microforge=T${campaign.shipUpgrades.fabrication} campaignTrace=${campaign.resources.rareTech} guaranteedTraceBudget=${authoredGuaranteedTraceBudget} t1Credits=${tierRewards[0].credits} t12Credits=${tierRewards[11].credits} ordinaryPackage=${ordinaryPackage.credits}cr input=dpad+a+b touch=48px`);
