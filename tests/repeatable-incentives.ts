import assert from 'node:assert/strict';
import {
  createDefaultCampaign,
  generateStandardContracts,
  repeatableIncentivePresentation,
  repeatableIncentiveProfiles,
  repeatableRecoveryModifiers,
  settleContract,
  type Contract,
  type ContractArchetype,
} from '../src/game/campaign';
import { awardRecovery, createDefaultProfile } from '../src/game/meta';
import type { Telemetry } from '../src/game/sim';

const telemetry = {
  damageDealt: 0,
  eliteKills: 0,
  eliteProtocolsDefeated: 0,
} as Telemetry;

const baseCampaign = createDefaultCampaign();
const contracts = generateStandardContracts(baseCampaign);
const byFamily = Object.fromEntries(contracts.map(contract => [contract.archetype, contract])) as Record<ContractArchetype, Contract>;

for (const family of ['salvage', 'boarding', 'stabilization'] as const) {
  const contract = byFamily[family];
  assert.equal(contract.standardRepeatable, true, `${family} must remain a standard repeatable contract.`);
  assert.deepEqual(contract.repeatableIncentive, repeatableIncentiveProfiles[family], `${family} must carry its authored incentive profile from generation.`);
  for (const depth of ['safe', 'deep'] as const) {
    assert.equal(Object.prototype.hasOwnProperty.call(contract.repeatableIncentive?.[depth].resourceMultipliers ?? {}, 'rareTech'), false, `${family} ${depth} incentives must not encode campaign-only rareTech.`);
  }
}


const presentationByFamily = Object.fromEntries(
  (['salvage', 'boarding', 'stabilization'] as const).map(family => [family, repeatableIncentivePresentation(byFamily[family])!]),
) as Record<ContractArchetype, NonNullable<ReturnType<typeof repeatableIncentivePresentation>>>;
assert.equal(new Set(Object.values(presentationByFamily).map(presentation => presentation.chaseLabel)).size, 3, 'Repeatable card payoff labels must remain materially distinct.');
assert.match(presentationByFamily.salvage.cardLabel, /MATERIAL RECOVERY/, 'Salvage card must preview its material-recovery chase.');
assert.match(presentationByFamily.salvage.safe, /Industrial alloys \+30%/, 'Salvage safe briefing must derive its alloy bias from the authored profile.');
assert.match(presentationByFamily.salvage.deep, /Industrial alloys \+50%/, 'Salvage deep briefing must expose the stronger authored alloy chase.');
assert.match(presentationByFamily.salvage.safe, /Every 4 salvage tags: \+1 optional recovery \(max \+2\)/, 'Salvage briefing must expose tag-to-recovery pressure from the authored profile.');
assert.match(presentationByFamily.boarding.cardLabel, /SPONSORED EQUIPMENT/, 'Boarding card must preview its sponsored-equipment chase.');
assert.match(presentationByFamily.boarding.safe, /Sponsor reputation \+1/, 'Boarding safe briefing must expose its sponsor reputation incentive.');
assert.match(presentationByFamily.boarding.safe, /Sponsor gear chance \+8pp/, 'Boarding safe briefing must expose its authored sponsor-gear chance.');
assert.match(presentationByFamily.boarding.deep, /Sponsor gear chance \+18pp/, 'Boarding deep briefing must expose the stronger sponsor-gear chase.');
assert.match(presentationByFamily.stabilization.cardLabel, /TECHNICAL RECOVERY/, 'Stabilization card must preview its technical-recovery chase.');
assert.match(presentationByFamily.stabilization.safe, /Recovery quality \+0\.35/, 'Stabilization safe briefing must expose authored recovery-quality pressure.');
assert.match(presentationByFamily.stabilization.deep, /Recovery quality \+0\.85/, 'Stabilization deep briefing must expose stronger recovery-quality pressure.');
assert.match(presentationByFamily.stabilization.deep, /Recovery level \+3/, 'Stabilization deep briefing must expose the authored recovery-level chase.');

const withoutIncentive = (contract: Contract): Contract => ({ ...contract, standardRepeatable: false, repeatableIncentive: undefined });

const salvage = byFamily.salvage;
const salvageSafe = settleContract(baseCampaign, salvage, 'safe', 8);
const salvageSafeBaseline = settleContract(baseCampaign, withoutIncentive(salvage), 'safe', 8);
const salvageDeep = settleContract(baseCampaign, salvage, 'deep', 8);
const salvageSafeRecovery = repeatableRecoveryModifiers(salvage, 'safe', 8);
const salvageDeepRecovery = repeatableRecoveryModifiers(salvage, 'deep', 8);
assert.ok(salvageSafe.gained.alloys > salvageSafeBaseline.gained.alloys, 'Salvage safe settlement must bias toward material recovery.');
assert.ok(salvageSafe.gained.credits < salvageSafeBaseline.gained.credits, 'Salvage material bias must preserve a credits tradeoff instead of becoming a universal payout increase.');
assert.equal(salvageSafeRecovery.optionalObjectives, 2, 'Salvage safe extraction must convert recovery tags into optional-recovery pressure.');
assert.equal(salvageDeepRecovery.optionalObjectives, 3, 'Salvage deep extraction must add one authored optional-recovery opportunity on top of tag recovery.');
assert.ok(salvageDeep.gained.alloys > salvageSafe.gained.alloys, 'Salvage deep extraction must preserve the higher-risk material chase.');
assert.equal(salvageDeepRecovery.recoveryLevelBonus, 1, 'Salvage deep extraction must add a bounded recovery-level chase.');

const boarding = byFamily.boarding;
const boardingSafe = settleContract(baseCampaign, boarding, 'safe', 0);
const boardingSafeBaseline = settleContract(baseCampaign, withoutIncentive(boarding), 'safe', 0);
const boardingDeep = settleContract(baseCampaign, boarding, 'deep', 0);
const boardingSafeRecovery = repeatableRecoveryModifiers(boarding, 'safe', 0);
const boardingDeepRecovery = repeatableRecoveryModifiers(boarding, 'deep', 0);
assert.equal(boardingSafe.reputationDelta.meridian, (boardingSafeBaseline.reputationDelta.meridian ?? 0) + 1, 'Boarding safe settlement must add sponsor reputation.');
assert.equal(boardingDeep.reputationDelta.meridian, 5, 'Boarding deep settlement must combine base, depth, and authored sponsor reputation without replacing the existing depth reward.');
assert.equal(boardingDeep.reputationDelta.longarc, -1, 'Boarding deep settlement must preserve the existing contested-faction cost.');
assert.equal(boardingSafeRecovery.sponsoredGearChanceBonus, 0.08, 'Boarding safe extraction must add a sponsored-equipment chase.');
assert.equal(boardingDeepRecovery.sponsoredGearChanceBonus, 0.18, 'Boarding deep extraction must strengthen the sponsored-equipment chase.');

let baselineSponsored = 0;
let boardingSponsored = 0;
for (let run = 1; run <= 256; run += 1) {
  const profile = { ...createDefaultProfile(), runsCompleted: run, level: 8 };
  const source = {
    faction: 'meridian' as const,
    factionReputation: 0,
    operationTier: 4,
    maxRecoveryLevel: 28,
    actualDepth: false,
  };
  const baseline = awardRecovery(profile, telemetry, false, 0, source);
  const boosted = awardRecovery(profile, telemetry, false, 0, { ...source, sponsoredGearChanceBonus: boardingSafeRecovery.sponsoredGearChanceBonus });
  baselineSponsored += baseline.loot.filter(item => item.faction === 'meridian').length;
  boardingSponsored += boosted.loot.filter(item => item.faction === 'meridian').length;
}
assert.ok(boardingSponsored > baselineSponsored, `Boarding sponsored-equipment bonus must deterministically create more Meridian-source recoveries (baseline=${baselineSponsored}, boarding=${boardingSponsored}).`);

const stabilization = byFamily.stabilization;
const stabilizationSafe = settleContract(baseCampaign, stabilization, 'safe', 0);
const stabilizationSafeBaseline = settleContract(baseCampaign, withoutIncentive(stabilization), 'safe', 0);
const stabilizationSafeRecovery = repeatableRecoveryModifiers(stabilization, 'safe', 0);
const stabilizationDeepRecovery = repeatableRecoveryModifiers(stabilization, 'deep', 0);
assert.ok(stabilizationSafe.gained.electronics > stabilizationSafeBaseline.gained.electronics, 'Stabilization safe settlement must favor technical stock.');
assert.ok(stabilizationSafe.gained.medstock > stabilizationSafeBaseline.gained.medstock, 'Stabilization safe settlement must favor support stock.');
assert.equal(stabilizationSafeRecovery.recoveryLevelBonus, 1, 'Stabilization safe extraction must improve recovery level.');
assert.equal(stabilizationDeepRecovery.recoveryLevelBonus, 3, 'Stabilization deep extraction must strengthen the recovery-level chase.');
assert.ok(stabilizationDeepRecovery.recoveryQualityBonus > stabilizationSafeRecovery.recoveryQualityBonus, 'Stabilization deep extraction must trade safer material yield for a stronger quality chase.');

const stabilizationProfile = { ...createDefaultProfile(), runsCompleted: 7, level: 8 };
const stabilizationSource = {
  faction: 'heliostat' as const,
  factionReputation: 0,
  operationTier: 4,
  maxRecoveryLevel: 28,
  actualDepth: false,
};
const stabilizationBaselineLoot = awardRecovery(stabilizationProfile, telemetry, false, 0, stabilizationSource).loot;
const stabilizationLoot = awardRecovery(stabilizationProfile, telemetry, false, 0, {
  ...stabilizationSource,
  recoveryQualityBonus: stabilizationSafeRecovery.recoveryQualityBonus,
  recoveryLevelBonus: stabilizationSafeRecovery.recoveryLevelBonus,
}).loot;
assert.equal(stabilizationBaselineLoot.length, stabilizationLoot.length, 'Stabilization incentive must use the existing recovery pipeline rather than add extra item-count inflation.');
assert.ok(stabilizationLoot.every((item, index) => (item.recoveryLevel ?? 0) === (stabilizationBaselineLoot[index]?.recoveryLevel ?? 0) + 1), 'Stabilization safe incentive must raise recovery level through the existing bounded recovery source.');

const rareTechProbe = {
  ...stabilization,
  rewardBase: { ...stabilization.rewardBase, rareTech: 99 },
};
const rareTechSettlement = settleContract(baseCampaign, rareTechProbe, 'deep', 10);
assert.equal(rareTechSettlement.gained.rareTech, 0, 'Repeatable resource settlement must never leak campaign-only rareTech even if it appears in rewardBase.');
assert.equal(rareTechSettlement.campaign.resources.rareTech, baseCampaign.resources.rareTech, 'Campaign-only rareTech must remain unchanged by ordinary repeatable incentive settlement.');


const balanceFamilies = ['salvage', 'boarding', 'stabilization'] as const;
const progressionStages = [
  { name: 'early', cycle: 0, contractsCompleted: 0, cargoTier: 0, reputation: 0, salvageTags: 4 },
  { name: 'mid', cycle: 8, contractsCompleted: 8, cargoTier: 2, reputation: 8, salvageTags: 6 },
  { name: 'late', cycle: 18, contractsCompleted: 18, cargoTier: 4, reputation: 12, salvageTags: 8 },
] as const;

type BalanceRow = {
  materialStock: number;
  credits: number;
  technicalStock: number;
  sponsorReputation: number;
  sponsoredGearChance: number;
  recoveryQuality: number;
  recoveryLevel: number;
  optionalRecovery: number;
};

function strictBalanceWinner(
  rows: Record<ContractArchetype, BalanceRow>,
  metric: keyof BalanceRow,
  stage: string,
  depth: 'safe' | 'deep',
): ContractArchetype {
  const ranked = balanceFamilies
    .map(family => ({ family, value: rows[family][metric] }))
    .sort((left, right) => right.value - left.value);
  assert.ok(
    ranked[0]!.value > ranked[1]!.value,
    `Balance matrix must have a strict ${metric} leader at ${stage}/${depth}: ${ranked.map(entry => `${entry.family}=${entry.value}`).join(', ')}`,
  );
  return ranked[0]!.family;
}

const balanceMatrixSummary: string[] = [];
for (const stage of progressionStages) {
  const defaultStageCampaign = createDefaultCampaign();
  const campaign = {
    ...defaultStageCampaign,
    cycle: stage.cycle,
    contractsCompleted: stage.contractsCompleted,
    reputation: { meridian: stage.reputation, heliostat: stage.reputation, longarc: stage.reputation },
    shipUpgrades: { ...defaultStageCampaign.shipUpgrades, cargo: stage.cargoTier },
  };
  const stageContracts = generateStandardContracts(campaign);
  const stageByFamily = Object.fromEntries(stageContracts.map(contract => [contract.archetype, contract])) as Record<ContractArchetype, Contract>;

  for (const depth of ['safe', 'deep'] as const) {
    const rows = Object.fromEntries(balanceFamilies.map(family => {
      const contract = stageByFamily[family];
      const settlement = settleContract(campaign, contract, depth, stage.salvageTags);
      const modifiers = repeatableRecoveryModifiers(contract, depth, stage.salvageTags);
      return [family, {
        materialStock: settlement.gained.alloys + settlement.gained.components,
        credits: settlement.gained.credits,
        technicalStock: settlement.gained.electronics + settlement.gained.medstock + settlement.gained.components,
        sponsorReputation: settlement.reputationDelta[contract.sponsor] ?? 0,
        sponsoredGearChance: modifiers.sponsoredGearChanceBonus,
        recoveryQuality: modifiers.recoveryQualityBonus,
        recoveryLevel: modifiers.recoveryLevelBonus,
        optionalRecovery: modifiers.optionalObjectives,
      } satisfies BalanceRow];
    })) as Record<ContractArchetype, BalanceRow>;

    const winners = {
      materialStock: strictBalanceWinner(rows, 'materialStock', stage.name, depth),
      credits: strictBalanceWinner(rows, 'credits', stage.name, depth),
      technicalStock: strictBalanceWinner(rows, 'technicalStock', stage.name, depth),
      sponsorReputation: strictBalanceWinner(rows, 'sponsorReputation', stage.name, depth),
      sponsoredGearChance: strictBalanceWinner(rows, 'sponsoredGearChance', stage.name, depth),
      recoveryQuality: strictBalanceWinner(rows, 'recoveryQuality', stage.name, depth),
      recoveryLevel: strictBalanceWinner(rows, 'recoveryLevel', stage.name, depth),
      optionalRecovery: strictBalanceWinner(rows, 'optionalRecovery', stage.name, depth),
    };

    assert.equal(winners.materialStock, 'salvage', `Salvage must remain the material-stock specialist at ${stage.name}/${depth}.`);
    assert.equal(winners.optionalRecovery, 'salvage', `Salvage must remain the optional-recovery specialist at ${stage.name}/${depth}.`);
    assert.equal(winners.credits, 'boarding', `Boarding must remain the liquid-credit specialist at ${stage.name}/${depth}.`);
    assert.equal(winners.sponsorReputation, 'boarding', `Boarding must remain the sponsor-progression specialist at ${stage.name}/${depth}.`);
    assert.equal(winners.sponsoredGearChance, 'boarding', `Boarding must remain the sponsored-equipment specialist at ${stage.name}/${depth}.`);
    assert.equal(winners.technicalStock, 'stabilization', `Stabilization must remain the technical-stock specialist at ${stage.name}/${depth}.`);
    assert.equal(winners.recoveryQuality, 'stabilization', `Stabilization must remain the recovery-quality specialist at ${stage.name}/${depth}.`);
    assert.equal(winners.recoveryLevel, 'stabilization', `Stabilization must remain the recovery-level specialist at ${stage.name}/${depth}.`);

    const representedFamilies = new Set(Object.values(winners));
    assert.deepEqual(
      [...representedFamilies].sort(),
      [...balanceFamilies].sort(),
      `Every repeatable family must own at least one progression need at ${stage.name}/${depth}.`,
    );
    const winnerCounts = Object.fromEntries(balanceFamilies.map(family => [
      family,
      Object.values(winners).filter(winner => winner === family).length,
    ])) as Record<ContractArchetype, number>;
    assert.ok(
      Math.max(...Object.values(winnerCounts)) < Object.keys(winners).length,
      `No repeatable family may dominate every progression need at ${stage.name}/${depth}: ${JSON.stringify(winnerCounts)}`,
    );

    balanceMatrixSummary.push(
      `${stage.name}/${depth}=salvage(material+optional),boarding(credits+rep+gear),stabilization(technical+quality+level)`,
    );
  }
}

console.log(`REPEATABLE_INCENTIVE_BALANCE_MATRIX_PASS ${balanceMatrixSummary.join(' | ')} tuning=not-required`);

console.log(
  `REPEATABLE_INCENTIVES_PASS salvage=safe-materials+deep-optional boarding=rep+faction-gear(${baselineSponsored}->${boardingSponsored}) stabilization=quality+recovery-level rareTech=protected presentation=distinct-safe-deep`,
);
