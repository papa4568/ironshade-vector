import assert from 'node:assert/strict';
import { createDefaultCampaign, settleContract, type CampaignState, type Contract } from '../src/game/campaign';
import { awardRecovery, createDefaultProfile, type PlayerProfile } from '../src/game/meta';
import {
  advanceParallaxDebtAfterContract,
  chooseParallaxDebtBranch,
  getParallaxDebtChoicePrompt,
  getParallaxDebtContract,
  parallaxDebtChapter,
  parallaxDebtEvidence,
  parallaxDebtNextRequiredLevel,
  syncParallaxDebtAccess,
} from '../src/game/parallaxDebt';
import { applyEncounterLayout } from '../src/game/encounters';
import { operationScalingFor } from '../src/game/scaling';
import { createSimulation, type Telemetry } from '../src/game/sim';

type RouteChoice = 'expose-route' | 'hold-route';

const commonTitles = [
  'Parallax Debt // Baseline Zero',
  'Parallax Debt // Return Vector',
  'Parallax Debt // Blind Meridian',
  'Parallax Debt // Kepler Wake',
  'Parallax Debt // Ledger of Least Action',
  'Parallax Debt // Residual Frame',
  'Parallax Debt // Null Transit',
  'Parallax Debt // Counterfactual Burn',
  'Parallax Debt // False Horizon',
];

const expectedPressure = [0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8] as const;
const expectedRewardMultiplier = [1.00, 1.03, 1.08, 1.05, 1.07, 1.10, 1.10, 1.12, 1.16, 1.14, 1.17, 1.24] as const;

const routeTitles: Record<RouteChoice, string[]> = {
  'expose-route': [
    'Parallax Debt // Common Reference',
    'Parallax Debt // Witness Transit',
    'Parallax Debt // Released Vector',
  ],
  'hold-route': [
    'Parallax Debt // Dark Baseline',
    'Parallax Debt // Ghost Transit',
    'Parallax Debt // Private Vector',
  ],
};

function telemetryFor(step: number): Telemetry {
  return {
    damageDealt: 1600 + step * 75,
    damageTaken: 220 + step * 15,
    deaths: 0,
    kills: 8,
    eliteKills: 1,
    eliteProtocolsDefeated: step >= 6 ? 2 : 1,
    killIntervalTotal: 28,
    killIntervalSamples: 7,
    lastKillAt: 52,
    protocolCombinations: {},
    weaponShots: { carbine: 30, breacher: 12, rail: 7 },
    abilityUses: [3, 3, 3],
    encounterStart: 0,
    bossStart: 0,
    duration: 85,
    trace: [],
    nextTraceAt: 0,
  };
}

function startChapter3() {
  let campaign = createDefaultCampaign();
  campaign.story.interdiction.status = 'complete';
  campaign = syncParallaxDebtAccess(campaign, 15);
  const profile = {
    ...createDefaultProfile(),
    xp: 7140,
    level: 15,
    runsCompleted: 18,
    operatorClass: 'vanguard' as const,
    classSelectionComplete: true,
  };
  assert.equal(campaign.story.parallaxDebt.status, 'active');
  assert.equal(campaign.story.parallaxDebt.step, 0);
  return { campaign, profile };
}

function bankOperation(
  campaign: CampaignState,
  profile: PlayerProfile,
  expectedTitle: string,
  step: number,
) {
  const contract = getParallaxDebtContract(campaign, profile.level);
  assert.ok(contract, `Chapter 3 operation ${step + 1} should be available at LV${profile.level}`);
  assert.equal(contract.campaignChapter, 'parallax-debt');
  assert.equal(contract.campaignStep, step);
  assert.equal(contract.title, expectedTitle);
  assert.equal(contract.encounterPressureBonus, expectedPressure[step], `${contract.title} should use the tuned Chapter 3 pressure curve`);
  assert.equal(contract.chapterRewardMultiplier, expectedRewardMultiplier[step], `${contract.title} should use the tuned Chapter 3 reward curve`);

  const scaledContract = { ...contract, ...operationScalingFor(contract, campaign, profile.level) };
  assert.ok((scaledContract.operationRewardMultiplier ?? 1) >= (contract.chapterRewardMultiplier ?? 1), `${contract.title} should apply its Chapter 3 reward premium to scaled operation rewards`);

  if (contract.campaignFinale) {
    const encounter = createSimulation();
    applyEncounterLayout(encounter, scaledContract);
    const boss = encounter.enemies.find(enemy => enemy.role === 'boss');
    assert.ok(boss, `${contract.title} should stage a Parallax command target`);
    const anchors = encounter.objects.filter(object => object.id.startsWith('baseline-anchor-'));
    assert.equal(anchors.length, 2, `${contract.title} should stage both baseline servos`);
    if (step === 2) {
      assert.equal(boss.maxHp, 680, 'Blind Meridian should use the tuned opening-finale health budget');
      assert.equal(boss.maxArmor, 220, 'Blind Meridian should use the tuned opening-finale armor budget');
      assert.ok(anchors.every(anchor => anchor.maxHp === 64), 'Blind Meridian baseline servos should use the opening-finale durability budget');
    }
    if (step === 11) {
      assert.equal(boss.maxHp, 820, 'Chapter 3 closing bosses should use the tuned final health budget');
      assert.equal(boss.maxArmor, 270, 'Chapter 3 closing bosses should use the tuned final armor budget');
      assert.ok(anchors.every(anchor => anchor.maxHp === 76), 'Chapter 3 closing servos should use the final durability budget');
    }
  }

  const campaignReward = settleContract(campaign, scaledContract, 'safe', 4);
  const lootReward = awardRecovery(profile, telemetryFor(step), false, campaign.shipUpgrades.fabrication, {
    deepTarget: scaledContract.deepTarget,
    location: scaledContract.location,
    locationName: scaledContract.locationName,
    campaignChapter: scaledContract.campaignChapter,
    faction: scaledContract.sponsor,
    factionReputation: campaignReward.campaign.reputation[scaledContract.sponsor],
    operationTier: scaledContract.operationTier,
    maxRecoveryLevel: scaledContract.maxRecoveryLevel,
    combatEffectiveness: scaledContract.combatEffectiveness,
    threatBudget: scaledContract.threatBudget,
    eliteProtocolCount: telemetryFor(step).eliteProtocolsDefeated,
    environmentalComplications: scaledContract.environmentalEventSlots,
    actualDepth: false,
    xpFloor: scaledContract.xpFloor,
  });
  assert.ok(lootReward.xpGained >= (scaledContract.xpFloor ?? 0), `${scaledContract.title} should honor its authored XP floor`);

  const advanced = advanceParallaxDebtAfterContract(campaignReward.campaign, scaledContract);
  assert.ok(advanced.note, `${scaledContract.title} should produce a Chapter 3 campaign note`);
  return { campaign: advanced.campaign, profile: lootReward.profile, contract: scaledContract };
}

function assertGate(campaign: CampaignState, currentLevel: number, requiredLevel: number) {
  assert.equal(parallaxDebtNextRequiredLevel(campaign), requiredLevel);
  assert.equal(getParallaxDebtContract(campaign, currentLevel), null, `LV${currentLevel} should not bypass the LV${requiredLevel} gate`);
  assert.ok(getParallaxDebtContract(campaign, requiredLevel), `LV${requiredLevel} should unlock the next Chapter 3 operation`);
}

function runRoute(route: RouteChoice) {
  let { campaign, profile } = startChapter3();
  const played: Contract[] = [];

  for (let step = 0; step < commonTitles.length; step += 1) {
    const result = bankOperation(campaign, profile, commonTitles[step], step);
    campaign = result.campaign;
    profile = result.profile;
    played.push(result.contract);

    if (step === 2) {
      assert.equal(profile.level, 16, 'Three LV15 operations should fund the LV16 gate on safe extraction');
      const gateProfile = { ...profile, xp: 7140, level: 15 };
      assertGate(campaign, gateProfile.level, 16);
    }
    if (step === 5) {
      assert.equal(profile.level, 17, 'Three LV16 operations should fund the LV17 gate on safe extraction');
      assert.equal(getParallaxDebtContract(campaign, 16), null, 'LV16 should remain blocked at the LV17 gate');
      assert.ok(getParallaxDebtContract(campaign, 17));
    }
    if (step === 7) {
      assert.equal(profile.level, 18, 'The two LV17 operations should fund the LV18 gate on safe extraction');
      assert.equal(getParallaxDebtContract(campaign, 17), null, 'LV17 should remain blocked at the LV18 gate');
      assert.ok(getParallaxDebtContract(campaign, 18));
    }
  }

  assert.equal(campaign.story.parallaxDebt.step, 9);
  assert.equal(campaign.story.parallaxDebt.evidence.length, 9);
  assert.equal(getParallaxDebtContract(campaign, profile.level), null, 'The closing route must remain blocked until the player makes the campaign decision');
  const choice = getParallaxDebtChoicePrompt(campaign);
  assert.ok(choice, 'False Horizon should open the route decision');
  assert.deepEqual(choice.choices.map(item => item.id), ['expose-route', 'hold-route']);

  campaign = chooseParallaxDebtBranch(campaign, route);
  assert.equal(campaign.story.parallaxDebt.choiceA, route);
  for (let offset = 0; offset < routeTitles[route].length; offset += 1) {
    const step = 9 + offset;
    const result = bankOperation(campaign, profile, routeTitles[route][offset], step);
    campaign = result.campaign;
    profile = result.profile;
    played.push(result.contract);
  }

  assert.equal(played.length, parallaxDebtChapter.totalContracts);
  assert.deepEqual(played.map(contract => contract.title), [...commonTitles, ...routeTitles[route]]);
  assert.equal(campaign.contractsCompleted, 12, 'The dedicated playthrough should settle every Chapter 3 operation through normal campaign rewards');
  assert.equal(campaign.story.parallaxDebt.status, 'complete');
  assert.equal(campaign.story.parallaxDebt.step, 12);
  assert.equal(campaign.story.parallaxDebt.completed.length, 12);
  assert.equal(campaign.story.parallaxDebt.evidence.length, 12);
  assert.equal(parallaxDebtEvidence(campaign).length, 12);
  assert.ok(profile.level >= 18);
  assert.equal(getParallaxDebtContract(campaign, profile.level), null);
  assert.match(
    campaign.story.parallaxDebt.lastBeat,
    route === 'expose-route' ? /OPEN REFERENCE/ : /QUIET CUSTODY/,
  );

  console.log(
    `CHAPTER3_PLAYTHROUGH_PASS route=${route} operations=${played.length} evidence=${campaign.story.parallaxDebt.evidence.length} level=${profile.level} contracts=${campaign.contractsCompleted}`,
  );
}

runRoute('expose-route');
runRoute('hold-route');
console.log('CHAPTER3_PLAYTHROUGH_COMPLETE routes=2 operations=24 result=PASS');
