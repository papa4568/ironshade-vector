import assert from 'node:assert/strict';
import { createDefaultCampaign, type Contract } from '../src/game/campaign';
import { bossPhaseMutationForecastForContract } from '../src/game/bossPhaseMutations';
import { commandTargetMutationDefinition, commandTargetMutationForecastForContract } from '../src/game/commandTargetMutations';
import { applyMissionSetup, continueIntoDeepZone, createDirector, stepMissionDirector } from '../src/game/director';
import { environmentalRiskPackageForContract } from '../src/game/environmentalRiskPackages';
import { buildDirectiveContract, generateDirective } from '../src/game/operationDirectives';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';
import { withOperationScaling } from '../src/game/scaling';
import { createSimulation, stepSimulation, type SimState } from '../src/game/sim';

const campaign = createDefaultCampaign();

function scaledDirectiveContract(tier: number, seed: number) {
  const directive = generateDirective(campaign, tier, seed, 'P6-E deterministic verification');
  return withOperationScaling(buildDirectiveContract(campaign, directive), campaign, 20);
}

function encounterSignature(contract: Contract) {
  const state = createSimulation();
  applyMissionSetup(state, contract);
  const runtime = createDirector();
  stepMissionDirector(state, runtime, contract, 0.1);
  const boss = state.enemies.find(enemy => enemy.role === 'boss');

  return {
    tier: contract.operationTier,
    targetClass: contract.directiveTargetClass,
    location: contract.location,
    objectiveMode: contract.objectiveMode,
    modifierIds: [...(contract.directiveModifierIds ?? [])],
    encounter: {
      threatBudget: contract.threatBudget,
      pattern: contract.encounterPattern,
      protocolSlots: contract.eliteProtocolSlots,
      environmentalSlots: contract.environmentalEventSlots,
      reserveCount: contract.reserveCount,
    },
    environmentalRisk: environmentalRiskPackageForContract(contract)?.id ?? null,
    environmentalPlan: runtime.environmental.plan?.map(item => [item.id, item.at]) ?? [],
    bossForecast: bossPhaseMutationForecastForContract(contract),
    commandForecast: commandTargetMutationForecastForContract(contract),
    boss: boss ? {
      maxHp: boss.maxHp,
      maxArmor: boss.maxArmor,
      commandTargetMutations: [...boss.commandTargetMutations],
      bossPhaseMutations: [...boss.bossPhaseMutations],
    } : null,
    enemies: state.enemies.map(enemy => ({
      id: enemy.id,
      active: enemy.active,
      role: enemy.role,
      variant: enemy.variant,
      combatClass: enemy.combatClass,
      maxHp: enemy.maxHp,
      maxArmor: enemy.maxArmor,
      protocols: enemy.protocols.map(protocol => ({
        id: protocol.id,
        enhanced: protocol.enhanced,
        variantId: protocol.variantId ?? null,
        combinationId: protocol.combinationId ?? null,
      })),
      mutations: [...enemy.mutations],
    })),
  };
}

function deterministicEncounterMatrix() {
  const seeds = [91001, 92003, 93007, 94009, 95101, 96103];

  for (let tier = 9; tier <= 12; tier += 1) {
    for (const seed of seeds) {
      const first = scaledDirectiveContract(tier, seed + tier * 1000);
      const second = scaledDirectiveContract(tier, seed + tier * 1000);
      const firstSignature = encounterSignature(first);
      const secondSignature = encounterSignature(second);

      assert.deepEqual(
        secondSignature,
        firstSignature,
        `T${tier} directive seed ${seed} must reproduce the same roster, protocol, mutation, event, and boss package signature`,
      );
      assert.equal(first.operationTier, tier, `T${tier} verification contract must preserve its authored directive tier`);
      assert.equal(first.environmentalEventSlots, 4, `T${tier} verification contract should exercise the full high-tier Director event budget`);
      assert.ok((first.eliteProtocolSlots ?? 0) >= 3, `T${tier} verification contract should exercise high-tier protocol density`);

      const bossPhase = bossPhaseMutationForecastForContract(first);
      assert.equal(
        bossPhase.length,
        tier === 12 ? 2 : 1,
        `T${tier} boss mutation count should match the authored high-tier phase contract`,
      );

      const risk = environmentalRiskPackageForContract(first);
      assert.ok(risk, `T${tier} directive should resolve a deterministic environmental risk package`);
      assert.equal(firstSignature.environmentalPlan.length, 4, `T${tier} Director plan should retain four scheduled events`);
      assert.deepEqual(
        firstSignature.environmentalPlan.slice(0, 2).map(item => item[0]),
        risk!.events,
        `T${tier} Director plan should lead with the disclosed paired environmental risk`,
      );

      if (first.directiveTargetClass === 'command-target') {
        assert.equal(firstSignature.commandForecast.length, 1, `T${tier} Command Target should resolve exactly one whole-fight command package`);
        assert.deepEqual(firstSignature.boss?.commandTargetMutations, firstSignature.commandForecast, `T${tier} boss runtime command package must match pre-deployment forecast`);
      } else {
        assert.deepEqual(firstSignature.commandForecast, [], `T${tier} elite-led directive must not leak a Command Target package`);
      }
      assert.deepEqual(firstSignature.boss?.bossPhaseMutations, firstSignature.bossForecast, `T${tier} boss runtime phase package must match pre-deployment forecast`);
    }
  }
}

function chooseWorstCaseT12() {
  let best: Contract | null = null;
  let bestScore = -Infinity;

  for (let seed = 120000; seed < 124096; seed += 1) {
    const contract = scaledDirectiveContract(12, seed);
    if (contract.directiveTargetClass !== 'command-target') continue;

    const command = commandTargetMutationForecastForContract(contract)[0];
    if (!command || !commandTargetMutationDefinition(command).pulseKind) continue;

    const score =
      (contract.threatBudget ?? 0)
      + (contract.directiveRiskScore ?? 0) * 5
      + (contract.directiveProtocolDensity ?? 0) * 8
      + (contract.directiveProtocolBonus ?? 0) * 6
      + (contract.directiveEventBonus ?? 0) * 6
      + (contract.directiveReserveBonus ?? 0) * 5;

    if (score > bestScore) {
      best = contract;
      bestScore = score;
    }
  }

  assert.ok(best, 'P6-E must find a deterministic T12 Command Target with recurring command-package pressure');
  return best;
}

function assertFiniteCombatState(state: SimState, frame: number) {
  const finite = (value: number, label: string) => {
    assert.ok(Number.isFinite(value), `T12 stress frame ${frame}: ${label} must remain finite`);
  };

  finite(state.time, 'simulation time');
  finite(state.player.x, 'player x');
  finite(state.player.y, 'player y');
  finite(state.player.hp, 'player hp');
  finite(state.player.armor, 'player armor');

  for (const sector of state.sectors) {
    finite(sector.pressure, `sector ${sector.id} pressure`);
    finite(sector.gravity, `sector ${sector.id} gravity`);
    assert.ok(sector.pressure >= 0 && sector.pressure <= 1.01, `T12 stress frame ${frame}: sector ${sector.id} pressure escaped physical bounds`);
    assert.ok(sector.gravity >= 0 && sector.gravity <= 1.21, `T12 stress frame ${frame}: sector ${sector.id} gravity escaped authored bounds`);
  }

  for (const enemy of state.enemies) {
    finite(enemy.x, `enemy ${enemy.id} x`);
    finite(enemy.y, `enemy ${enemy.id} y`);
    finite(enemy.hp, `enemy ${enemy.id} hp`);
    finite(enemy.armor, `enemy ${enemy.id} armor`);
    finite(enemy.fireCooldown, `enemy ${enemy.id} fire cooldown`);
  }

  for (const hazard of state.hazards) {
    finite(hazard.x, 'hazard x');
    finite(hazard.y, 'hazard y');
    finite(hazard.life, 'hazard life');
  }

  for (const projectile of state.projectiles) {
    finite(projectile.x, 'projectile x');
    finite(projectile.y, 'projectile y');
    finite(projectile.vx, 'projectile vx');
    finite(projectile.vy, 'projectile vy');
    finite(projectile.life, 'projectile life');
  }
}

function t12StressVerification() {
  const contract = chooseWorstCaseT12();
  assert.equal(contract.operationTier, 12, 'worst-case verification contract must be T12');
  assert.equal(contract.directiveTargetClass, 'command-target', 'worst-case verification contract must exercise Command Target pressure');
  assert.equal(contract.environmentalEventSlots, 4, 'worst-case T12 contract must keep the four-event Director budget');
  assert.equal(contract.eliteProtocolSlots, 4, 'worst-case T12 contract must exercise the full elite protocol slot budget');
  assert.equal(bossPhaseMutationForecastForContract(contract).length, 2, 'worst-case T12 boss must combine two phase mutations');
  assert.equal(commandTargetMutationForecastForContract(contract).length, 1, 'worst-case T12 boss must carry one whole-fight command package');

  const state = createSimulation();
  applyMissionSetup(state, contract);
  const runtime = createDirector();
  continueIntoDeepZone(state, runtime);

  state.player.x = 1180;
  state.player.y = 520;
  state.player.maxHp = 1_000_000;
  state.player.hp = 1_000_000;
  state.player.maxArmor = 1_000_000;
  state.player.armor = 1_000_000;
  state.player.invulnerable = 9999;
  state.kills = 99;

  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  assert.ok(boss, 'T12 stress verification requires a command boss');
  boss!.active = true;
  boss!.dead = false;
  boss!.hp = boss!.maxHp * 0.3;
  boss!.armor = 0;
  state.bossActive = true;

  const poolSizes = {
    projectiles: state.projectiles.length,
    hazards: state.hazards.length,
    effects: state.effects.length,
    damageNumbers: state.damageNumbers.length,
    debris: state.debris.length,
  };
  let peakProjectiles = 0;
  let peakHazards = 0;
  let peakEffects = 0;

  for (let frame = 0; frame < 600; frame += 1) {
    stepMissionDirector(state, runtime, contract, 0.1);
    stepSimulation(state, 0.1);
    assertFiniteCombatState(state, frame);
    peakProjectiles = Math.max(peakProjectiles, state.projectiles.filter(item => item.active).length);
    peakHazards = Math.max(peakHazards, state.hazards.filter(item => item.active).length);
    peakEffects = Math.max(peakEffects, state.effects.filter(item => item.active).length);
  }

  assert.equal(boss!.bossPhase, 2, 'T12 stress boss should enter and remain in its phase-two mutation layer');
  assert.ok(runtime.environmental.plan, 'T12 stress run should materialize an environmental Director plan');
  assert.equal(runtime.environmental.fired.length, runtime.environmental.plan!.length, '60-second T12 stress trace should execute every scheduled Director event');
  assert.ok(peakProjectiles > 0, 'T12 stress trace should exercise hostile projectile pressure');
  assert.ok(peakHazards >= 2, 'T12 stress trace should exercise overlapping hazard pressure');
  assert.equal(state.projectiles.length, poolSizes.projectiles, 'T12 stress must not grow the fixed projectile pool');
  assert.equal(state.hazards.length, poolSizes.hazards, 'T12 stress must not grow the fixed hazard pool');
  assert.equal(state.effects.length, poolSizes.effects, 'T12 stress must not grow the fixed effect pool');
  assert.equal(state.damageNumbers.length, poolSizes.damageNumbers, 'T12 stress must not grow the fixed damage-number pool');
  assert.equal(state.debris.length, poolSizes.debris, 'T12 stress must not grow the fixed debris pool');

  assert.ok(peakProjectiles <= poolSizes.projectiles, 'active projectile pressure must remain within the authored pool');
  assert.ok(peakHazards <= poolSizes.hazards, 'active hazard pressure must remain within the authored pool');

  return {
    contract: contract.title,
    location: contract.location,
    threatBudget: contract.threatBudget,
    riskScore: contract.directiveRiskScore,
    peakProjectiles,
    peakHazards,
    poolSizes,
  };
}

function adaptiveQualityStressVerification() {
  const desktop = new AdaptiveRenderBudget(false);
  let desktopSnapshot = desktop.sample(16.7, 1);

  for (let frame = 0; frame < 180; frame += 1) {
    const stressedFrameMs = 28 + (frame % 4) * 2.5;
    desktopSnapshot = desktop.sample(stressedFrameMs, 1);
  }

  assert.equal(desktopSnapshot.tierName, 'performance', 'sustained worst-case T12 frame pressure should force desktop Performance quality');
  assert.equal(desktopSnapshot.shadowMapSize, 256, 'Performance quality should cap the shadow map at 256');
  assert.equal(desktopSnapshot.detailScale, 0.5, 'Performance quality should use the lowest authored detail tier');
  assert.equal(desktopSnapshot.vfxDensity, 0.45, 'Performance quality should reduce secondary VFX density');
  assert.equal(desktopSnapshot.transparencyScale, 0.4, 'Performance quality should reduce transparency-heavy effects');
  assert.equal(desktopSnapshot.shadows, false, 'Performance quality should disable dynamic shadows');

  for (let frame = 0; frame < 800; frame += 1) desktopSnapshot = desktop.sample(16.2, 1);
  assert.equal(desktopSnapshot.tierName, 'high', 'desktop adaptive quality should recover to High after sustained healthy frames');

  const mobile = new AdaptiveRenderBudget(true);
  let mobileSnapshot = mobile.sample(16.7, 1);
  assert.equal(mobileSnapshot.tierName, 'balanced', 'coarse/mobile rendering should start from the Balanced baseline');

  for (let frame = 0; frame < 180; frame += 1) mobileSnapshot = mobile.sample(32, 1);
  assert.equal(mobileSnapshot.tierName, 'performance', 'sustained T12 pressure should force mobile into Performance quality');

  for (let frame = 0; frame < 800; frame += 1) mobileSnapshot = mobile.sample(16.2, 1);
  assert.equal(mobileSnapshot.tierName, 'balanced', 'mobile recovery should stop at the safe Balanced baseline instead of restoring desktop High');

  return {
    desktopRecoveredTier: desktopSnapshot.tierName,
    mobileRecoveredTier: mobileSnapshot.tierName,
  };
}

deterministicEncounterMatrix();
const stress = t12StressVerification();
const adaptive = adaptiveQualityStressVerification();

console.log(
  `ENDGAME_VERIFICATION_PASS contract="${stress.contract}" location=${stress.location} threat=${stress.threatBudget} risk=${stress.riskScore} peak_projectiles=${stress.peakProjectiles}/${stress.poolSizes.projectiles} peak_hazards=${stress.peakHazards}/${stress.poolSizes.hazards} desktop_recovered=${adaptive.desktopRecoveredTier} mobile_recovered=${adaptive.mobileRecoveredTier}`,
);
