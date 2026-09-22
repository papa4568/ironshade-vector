import assert from 'node:assert/strict';
import {
  applyShipBonuses,
  createDefaultCampaign,
  directiveTraceRecovery,
  getUpgradeCost,
  settleContract,
  shipSpecializationDefinitions,
  upgradeDefinitions,
  type OperationDirective,
  type SalvageWallet,
  type ShipUpgradeId,
} from '../src/game/campaign';
import { buildDirectiveContract, directiveRewardPreview } from '../src/game/operationDirectives';
import { operationScalingFor, withOperationScaling } from '../src/game/scaling';
import { neutralCombatBuild } from '../src/game/sim';

const systemIds: ShipUpgradeId[] = ['reactor', 'drive', 'armor', 'cargo', 'sensors', 'fabrication', 'medical', 'drones'];
const zeroWallet = (): SalvageWallet => ({ credits: 0, alloys: 0, electronics: 0, medstock: 0, components: 0, rareTech: 0 });

function addCosts(costs: Array<Partial<SalvageWallet>>) {
  const total = zeroWallet();
  for (const cost of costs) {
    for (const [key, value] of Object.entries(cost) as Array<[keyof SalvageWallet, number]>) total[key] += value;
  }
  return total;
}

function fixedDirective(tier: number, targetClass: 'elite-led' | 'command-target', archetype: OperationDirective['archetype'] = 'salvage'): OperationDirective {
  return {
    id: `p11-f-t${tier}-${targetClass}-${archetype}`,
    seed: 91000 + tier * 17 + (targetClass === 'command-target' ? 1 : 0),
    tier,
    location: 'asteroid-refinery',
    locationName: 'Asteroid Refinery',
    sponsor: archetype === 'boarding' ? 'meridian' : archetype === 'stabilization' ? 'heliostat' : 'longarc',
    archetype,
    objectiveMode: archetype === 'boarding' ? 'emergency-boarding' : archetype === 'stabilization' ? 'grid-isolation' : 'deep-salvage',
    modifierIds: [],
    targetClass,
    deepTarget: 'P11-F economy command target',
    codename: `Balance ${tier}`,
    sourceLabel: 'P11-F deterministic balance QA',
  };
}

function lateGameCampaign() {
  const base = createDefaultCampaign();
  return {
    ...base,
    contractsCompleted: 40,
    resources: { credits: 100_000, alloys: 500, electronics: 500, medstock: 500, components: 500, rareTech: 100 },
    reputation: { meridian: 14, heliostat: 14, longarc: 14 },
    shipUpgrades: { reactor: 5, drive: 5, armor: 5, cargo: 5, sensors: 5, fabrication: 5, medical: 5, drones: 5 },
    story: {
      ...base.story,
      blackLattice: { ...base.story.blackLattice, status: 'complete' as const },
      interdiction: { ...base.story.interdiction, status: 'complete' as const },
    },
    directives: { ...base.directives, unlocked: true, highestTier: 12 },
  };
}

function traceCostForTargets(targetsInput: Partial<Record<ShipUpgradeId, number>>) {
  const targets = new Map<ShipUpgradeId, number>();
  for (const [id, tier] of Object.entries(targetsInput) as Array<[ShipUpgradeId, number]>) targets.set(id, tier);

  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, targetTier] of [...targets.entries()]) {
      const definition = upgradeDefinitions.find(item => item.id === id)!;
      for (let tier = 3; tier <= targetTier; tier += 1) {
        for (const gate of definition.tiers[tier - 1]!.gates) {
          if (gate.kind !== 'dependency') continue;
          const current = targets.get(gate.system) ?? 0;
          if (current >= gate.tier) continue;
          targets.set(gate.system, gate.tier);
          changed = true;
        }
      }
    }
  }

  let rareTech = 0;
  for (const [id, targetTier] of targets) {
    const definition = upgradeDefinitions.find(item => item.id === id)!;
    for (const tier of definition.tiers.slice(0, targetTier)) rareTech += tier.cost.rareTech ?? 0;
  }
  return rareTech;
}

function costCurveSmoke() {
  const fullFleetCost = addCosts(upgradeDefinitions.flatMap(definition => definition.tiers.map(tier => tier.cost)));
  assert.ok(fullFleetCost.credits >= 55_000, 'A fully realized eight-system fleet should remain a long-horizon credit sink.');
  assert.equal(fullFleetCost.rareTech, 48, 'Tier 4-6 completion across all eight systems should consume 48 Quarantined Traces before specialization.');

  const expectedTierSixRouteTrace: Record<ShipUpgradeId, number> = {
    reactor: 9,
    drive: 9,
    armor: 9,
    cargo: 9,
    sensors: 9,
    fabrication: 10,
    medical: 9,
    drones: 10,
  };
  for (const definition of upgradeDefinitions) {
    const lateCredits = definition.tiers.slice(2).map(tier => tier.cost.credits ?? 0);
    for (let index = 1; index < lateCredits.length; index += 1) {
      assert.ok(lateCredits[index]! >= lateCredits[index - 1]! * 1.5, `${definition.name} late-tier credits should escalate by at least 50% per tier.`);
    }
    assert.deepEqual(definition.tiers.slice(3).map(tier => tier.cost.rareTech ?? 0), [1, 2, 3], `${definition.name} Tier 4-6 should preserve the 1/2/3 Trace pressure curve.`);

    const maxRouteTrace = traceCostForTargets({ [definition.id]: 6 });
    assert.equal(maxRouteTrace, expectedTierSixRouteTrace[definition.id], `${definition.name} Tier 6 should preserve its authored dependency-route Trace pressure.`);
  }

  const specializationTraceCosts = shipSpecializationDefinitions.map(definition => {
    const targets: Partial<Record<ShipUpgradeId, number>> = {};
    for (const gate of definition.gates) if (gate.kind === 'dependency') targets[gate.system] = Math.max(targets[gate.system] ?? 0, gate.tier);
    return traceCostForTargets(targets) + (definition.cost.rareTech ?? 0);
  });
  assert.ok(specializationTraceCosts.every(cost => cost > 6), 'Every advanced package should require more than the six guaranteed baseline campaign Traces.');
  assert.ok(specializationTraceCosts.every(cost => cost <= 14), 'Advanced packages should remain reachable with a bounded number of repeatable endgame command clears.');
}

function traceRecoverySmoke() {
  assert.equal(directiveTraceRecovery({ directiveTier: 5, directiveTargetClass: 'command-target' }, 'deep'), 0, 'Pre-T6 Directives should not become a repeatable Trace farm.');
  assert.equal(directiveTraceRecovery({ directiveTier: 6, directiveTargetClass: 'elite-led' }, 'deep'), 0, 'Elite-led Directives should preserve common-material-only payout.');
  assert.equal(directiveTraceRecovery({ directiveTier: 6, directiveTargetClass: 'command-target' }, 'safe'), 0, 'Safe withdrawal should not award the dedicated command Trace.');
  assert.equal(directiveTraceRecovery({ directiveTier: 6, directiveTargetClass: 'command-target' }, 'deep'), 1, 'T6+ deep Command Target extraction should recover exactly one Trace.');
  assert.equal(directiveTraceRecovery({ directiveTier: 12, directiveTargetClass: 'command-target' }, 'deep'), 1, 'T12 should preserve one-Trace pressure rather than scaling into bulk chase currency.');

  const campaign = lateGameCampaign();
  const command = withOperationScaling(buildDirectiveContract(campaign, fixedDirective(9, 'command-target')), campaign, 18);
  const commandReward = settleContract(campaign, command, 'deep', 6).gained;
  assert.equal(commandReward.rareTech, 1, 'A live T9 deep command settlement should bank the dedicated Trace.');

  const elite = withOperationScaling(buildDirectiveContract(campaign, fixedDirective(12, 'elite-led')), campaign, 18);
  assert.equal(settleContract(campaign, elite, 'deep', 6).gained.rareTech, 0, 'A T12 elite-led settlement should not mint Trace.');

  assert.match(directiveRewardPreview(fixedDirective(6, 'command-target'), 18), /DEEP COMMAND \+1 Quarantined Trace/, 'The Directive card/brief should disclose the dedicated Trace source before deployment.');
  assert.doesNotMatch(directiveRewardPreview(fixedDirective(12, 'elite-led'), 18), /Quarantined Trace/, 'Elite-led previews should not advertise the command-only chase reward.');
}

function affordabilitySmoke() {
  const mature = lateGameCampaign();
  const tierSixCredits: number[] = [];
  for (const id of systemIds) {
    const cost = getUpgradeCost(mature, id);
    assert.ok(cost, `${id} Tier 6 should be purchasable in the mature QA state.`);
    const baseCredits = upgradeDefinitions.find(definition => definition.id === id)!.tiers[5]!.cost.credits ?? 0;
    assert.equal(cost!.credits, Math.round(baseCredits * 0.85), `${id} should keep the bounded REP12+ 15% late-game discount.`);
    tierSixCredits.push(cost!.credits ?? 0);
  }

  const rewardCampaign = { ...mature, shipUpgrades: { ...mature.shipUpgrades, cargo: 6 } };
  const command = withOperationScaling(buildDirectiveContract(rewardCampaign, fixedDirective(12, 'command-target')), rewardCampaign, 18);
  const reward = settleContract(rewardCampaign, command, 'deep', 6).gained;
  const cheapestTierSix = Math.min(...tierSixCredits);
  const priciestTierSix = Math.max(...tierSixCredits);

  assert.ok(reward.credits < cheapestTierSix, 'One T12 deep command clear should not instantly pay the credit side of any Tier 6 system.');
  assert.ok(reward.credits * 3 >= priciestTierSix, 'A small run of T12 command clears should make visible progress toward even the priciest Tier 6 credit requirement.');
  assert.equal(reward.rareTech, 1, 'The same high-risk clear should recover one, not several, chase-currency units.');
}

function identityAndDifficultySmoke() {
  const mature = lateGameCampaign();
  const maxedCampaign = {
    ...mature,
    shipUpgrades: { reactor: 6, drive: 6, armor: 6, cargo: 6, sensors: 6, fabrication: 6, medical: 6, drones: 6 },
    shipSpecialization: 'heliostat-hot-bus' as const,
  };
  const maxed = applyShipBonuses(neutralCombatBuild, maxedCampaign);

  assert.equal(maxed.operatorClass, neutralCombatBuild.operatorClass, 'Ship progression must not replace class identity.');
  assert.equal(maxed.classResonanceTier, neutralCombatBuild.classResonanceTier, 'Ship progression must not manufacture class resonance.');
  assert.deepEqual(maxed.classSkillFamily, neutralCombatBuild.classSkillFamily, 'Ship progression must not rewrite class-owned weapon/skill family binding.');
  assert.equal(maxed.specialization, neutralCombatBuild.specialization, 'Ship packages must not replace class specialization.');
  assert.equal(maxed.specializationOverclock, neutralCombatBuild.specializationOverclock, 'Ship packages must not grant class overclocks.');

  const forbiddenWeaponKeys = ['damageMul', 'recoilMul', 'heatPerShotMul', 'heatDissipationMul', 'magazineAdd', 'reloadMul', 'armorDamageMul', 'healthMultiplierMul', 'knockbackMul'] as const;
  for (const id of ['carbine', 'breacher', 'rail'] as const) {
    for (const key of forbiddenWeaponKeys) {
      assert.equal(maxed.weapon[id][key], neutralCombatBuild.weapon[id][key], `${id} ${key} should stay class/gear-owned rather than becoming ship-system power.`);
    }
  }

  const baselineMechanics = neutralCombatBuild.mechanics as unknown as Record<string, unknown>;
  const maxedMechanics = maxed.mechanics as unknown as Record<string, unknown>;
  for (const key of Object.keys(baselineMechanics)) {
    if (key === 'arcDrone' || key === 'arcDroneScale') continue;
    assert.deepEqual(maxedMechanics[key], baselineMechanics[key], `Ship progression must not unlock class mechanic ${key}.`);
  }

  const commandContract = buildDirectiveContract(mature, fixedDirective(12, 'command-target'));
  const baselineScaling = operationScalingFor(commandContract, mature, 18);
  const maxedScaling = operationScalingFor(commandContract, maxedCampaign, 18);
  assert.deepEqual(maxedScaling, baselineScaling, 'Maxed ship systems must not lower boss/encounter tier, damage, threat, protocol, event, or reserve pressure.');
}

costCurveSmoke();
traceRecoverySmoke();
affordabilitySmoke();
identityAndDifficultySmoke();

const fleetTraceCost = addCosts(upgradeDefinitions.flatMap(definition => definition.tiers.map(tier => tier.cost))).rareTech;
console.log(`SHIP_SYSTEMS_ECONOMY_BALANCE_PASS systems=${upgradeDefinitions.length} fleetTraceCost=${fleetTraceCost} commandTrace=T6+deep-only maxRouteTrace=10 specializationTrace=bounded classIdentity=preserved bossScaling=unchanged`);
