import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyShipBonuses, buildMegastructureDebrief, buyConsumable, createDefaultCampaign, deepTargetForLocation, generateContracts, generateStandardContracts, getMegastructureStageContract, loadCampaign, locationNameFor, missionObjectiveFor, saveCampaign, type Contract } from '../src/game/campaign';
import { abilityUsesTargetAcquisition, acquireCombatTarget, aimAtMobileTarget, applyPlayerDamage, createSimulation, createTargetControlMemory, cycleWeapon, getAbilityConfig, resetTargetControlMemory, selectWeapon, stepSimulation, triggerAbility, triggerConsumable, triggerDodge, triggerFire, triggerReload, triggerVent, updateMobileTargetControl, weaponConfigs, weaponHandlingProfiles, type Telemetry } from '../src/game/sim';
import { applyMissionSetup, continueIntoDeepZone, createDirector, stepMissionDirector } from '../src/game/director';
import { findNavigationPath } from '../src/game/mapPathfinding';
import { activeWeaponFamilyForProfile, awardRecovery, awardVictory, buildIdentity, capstoneInteractionFor, createDefaultProfile, deriveCombatBuild, equipItem, isItemClassCompatible, loadProfile, materializeModifier, normalizeClassArmament, saveProfile, setAbilityMod, setOperatorClass, setSpecialization, setSpecializationOverclock, specializationGearSynergyDefinitions, specializationGearSynergyForProfile, systemsCapstoneInteractionFor, vanguardCapstoneInteractionFor, vectorCapstoneInteractionFor } from '../src/game/meta';
import { CAMPAIGN_STORAGE_KEY, GAME_STATE_STORAGE_KEY, prepareSaveRecovery, PROFILE_STORAGE_KEY } from '../src/game/saveRecovery';
import { loadGameState, saveGameState } from '../src/game/gamePersistence';
import { carryExpeditionLoot } from '../src/game/expeditionCarry';
import { advanceParallaxDebtAfterContract, chooseParallaxDebtBranch, getParallaxDebtChoicePrompt, getParallaxDebtContract, parallaxDebtChapter, parallaxDebtIntel, parallaxDebtNextRequiredLevel, syncParallaxDebtAccess } from '../src/game/parallaxDebt';
import { applyThreatBudget, operationScalingFor } from '../src/game/scaling';
import { classAbilityKits, operatorWeaponFamilyByClass, type OperatorClassId } from '../src/game/classSkills';
import { gearBaseDefinitions } from '../src/game/gearBases';
import { gearAffixDefinition } from '../src/game/gearAffixes';
import { chooseEnemyProtocols, enhancedProtocolVariantForecastForContract, exclusiveProtocolCombinationForEnemy, exclusiveProtocolCombinationForInstances, exclusiveProtocolCombinationForecastForContract, protocolDefinition, protocolRewardValue, protocolThreatCost, type EnhancedProtocolVariantId, type EnemyProtocolId } from '../src/game/eliteProtocols';
import { enhancedProtocolVariantPresentationFor } from '../src/game/enhancedProtocolVariantPresentation';
import { applyEnemyMutations, mutationFireCadenceScale, mutationHazardCadenceScale, mutationMobilityScale, mutationThreatCostForEnemy } from '../src/game/t9Mutations';
import { mutationForecastForContract, mutationPresentationFor } from '../src/game/t9MutationPresentation';
import { bossPhaseFireCadenceScale, bossPhaseMutationForecastForContract, bossPhaseMutationMinTier, chooseBossPhaseMutations, type BossPhaseMutationId } from '../src/game/bossPhaseMutations';
import { commandTargetFireCadenceScale, commandTargetMutationForecastForContract, commandTargetMutationMinTier, chooseCommandTargetMutations } from '../src/game/commandTargetMutations';
import { createEnvironmentalEventRuntime, getEnvironmentalEventForecast, stepEnvironmentalEvents } from '../src/game/environmentalEvents';
import { environmentalRiskPackageForContract, environmentalRiskRewardMultiplierForContract } from '../src/game/environmentalRiskPackages';

function exclusiveProtocolCombinationSmoke() {
  const baseContract = generateContracts(createDefaultCampaign())[0]!;
  const t8Contract = {
    ...baseContract,
    seed: 61091,
    location: 'lattice-annex' as const,
    objectiveMode: 'gravity-stabilization' as const,
    operationTier: 8,
    eliteProtocolSlots: 3,
    directiveProtocolBias: ['breachmaker', 'magneticLock'],
  };
  const preT9 = chooseEnemyProtocols(t8Contract, 'elite', 'standard', 3, 6);
  assert.equal(preT9.some(protocol => !!protocol.combinationId), false, 'exclusive protocol packages must remain locked below T9');
  assert.deepEqual(exclusiveProtocolCombinationForecastForContract(t8Contract), [], 'pre-T9 tactical forecast must not advertise exclusive packages');

  const breachLockContract = { ...t8Contract, operationTier: 9 };
  const breachLock = exclusiveProtocolCombinationForEnemy(breachLockContract, 'elite', 'standard', 3, 6);
  assert.equal(breachLock?.id, 'breach-lock', 'directive-biased T9 Lattice Annex elites should resolve the authored Breach Lock package');
  const breachProtocols = chooseEnemyProtocols(breachLockContract, 'elite', 'standard', 3, 6);
  assert.deepEqual(
    breachProtocols.filter(protocol => protocol.combinationId === 'breach-lock').map(protocol => protocol.id),
    ['breachmaker', 'magneticLock'],
    'Breach Lock should land atomically before any ordinary filler protocol',
  );
  assert.ok(exclusiveProtocolCombinationForecastForContract(breachLockContract).includes('Breach Lock'), 'T9 tactical forecast should surface the legal exclusive package by name');

  const recoveryContract = {
    ...baseContract,
    seed: 77123,
    location: 'orbital-station' as const,
    objectiveMode: 'machinery-recovery' as const,
    operationTier: 9,
    eliteProtocolSlots: 3,
    directiveProtocolBias: ['salvageInterdictor', 'recoveryDenial'],
  };
  const recoveryLock = exclusiveProtocolCombinationForEnemy(recoveryContract, 'elite', 'standard', 3, 6);
  assert.equal(recoveryLock?.id, 'recovery-lockdown', 'recovery directives should resolve the authored same-family Recovery Lockdown package');
  const recoveryProtocols = chooseEnemyProtocols(recoveryContract, 'elite', 'standard', 3, 6);
  const recoveryBundle = recoveryProtocols.filter(protocol => protocol.combinationId === 'recovery-lockdown');
  assert.deepEqual(recoveryBundle.map(protocol => protocol.id), ['salvageInterdictor', 'recoveryDenial'], 'exclusive bundles should permit authored same-family pairings that ordinary protocol selection forbids');

  const state = createSimulation();
  const budgetedContract = {
    ...breachLockContract,
    threatBudget: 84,
    encounterPattern: 'elite-led' as const,
    reserveCount: 1,
    environmentalEventSlots: 2,
    combatEffectiveness: 1,
  };
  applyThreatBudget(state.enemies, budgetedContract);
  const packagedEnemy = state.enemies.find(enemy => enemy.active && exclusiveProtocolCombinationForInstances(enemy.protocols));
  assert.ok(packagedEnemy, 'T9 threat budgeting should preserve at least one authored exclusive elite package');
  const packageDefinition = exclusiveProtocolCombinationForInstances(packagedEnemy!.protocols)!;
  const acceptedBundle = packagedEnemy!.protocols.filter(protocol => protocol.combinationId === packageDefinition.id);
  assert.equal(acceptedBundle.length, packageDefinition.protocols.length, 'threat budgeting must accept or reject an exclusive package atomically instead of silently truncating it');

  const combatSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');
  const hubSource = readFileSync('src/components/ShipHub.tsx', 'utf8');
  assert.match(combatSource, /packageDefinition\.shortName/, 'combat HUD should identify named exclusive protocol packages above elite enemies');
  assert.match(hubSource, /PACKAGE \/\//, 'contract tactical forecast should identify exclusive package names before deployment');
}
exclusiveProtocolCombinationSmoke();

function enhancedProtocolVariantSmoke() {
  const variantProtocols: Record<EnhancedProtocolVariantId, EnemyProtocolId> = {
    'ablative-bloom': 'reactivePlating', 'cutline-pair': 'breachmaker', 'twin-well-lock': 'magneticLock', 'anchor-singularity': 'gravityAnchor', 'wake-anchor': 'countermassMobility',
    'cascade-grid': 'arcConduit', 'overlink-mesh': 'repairMesh', 'dual-rack': 'droneEscort', 'cross-shutter': 'emergencyShutters', 'capacitor-scramble': 'signalJammer',
    'coolant-redline': 'thermalOverrun', 'tech-bus-sync': 'suppressionCoordinator', 'cross-fan-volley': 'penetratorVolley', 'mass-theft': 'salvageInterdictor', 'hard-lock-grid': 'recoveryDenial',
  };
  const baseContract = generateContracts(createDefaultCampaign())[0]!;
  const base = {
    ...baseContract,
    seed: 82177,
    location: 'lattice-annex' as const,
    objectiveMode: 'gravity-stabilization' as const,
    eliteProtocolSlots: 3,
    directiveProtocolBias: ['breachmaker', 'magneticLock'],
  };
  const t9Contract = { ...base, operationTier: 9 };
  assert.deepEqual(enhancedProtocolVariantForecastForContract(t9Contract), [], 'named enhanced protocol variants must remain locked below T10');
  for (let enemyId = 1; enemyId <= 48; enemyId += 1) {
    const protocols = chooseEnemyProtocols(t9Contract, 'elite', 'standard', 3, enemyId);
    assert.equal(protocols.some(protocol => protocol.enhanced || !!protocol.variantId), false, 'T9 enemies must not roll enhanced variants early');
  }

  const t10Contract = { ...base, operationTier: 10 };
  const forecast = enhancedProtocolVariantForecastForContract(t10Contract);
  assert.ok(forecast.includes('cutline-pair'), 'T10 Lattice Annex forecast should surface the Breachmaker enhanced variant');
  assert.ok(forecast.includes('twin-well-lock'), 'T10 Lattice Annex forecast should surface the Magnetic Lock enhanced variant');
  assert.equal(enhancedProtocolVariantPresentationFor('cutline-pair').name, 'Cutline Pair', 'lazy presentation metadata should resolve the authored full variant name');

  const enhancedInstances = [];
  for (let enemyId = 1; enemyId <= 96; enemyId += 1) {
    enhancedInstances.push(...chooseEnemyProtocols(t10Contract, 'elite', 'standard', 3, enemyId).filter(protocol => protocol.enhanced));
  }
  assert.ok(enhancedInstances.length > 0, 'deterministic T10 sampling should produce named enhanced protocol variants');
  for (const protocol of enhancedInstances) {
    assert.ok(protocol.variantId, 'every enhanced protocol instance must carry an authored variant identity');
    assert.equal(variantProtocols[protocol.variantId!], protocol.id, 'enhanced variant identity must belong to the protocol that rolled it');
    assert.ok(enhancedProtocolVariantPresentationFor(protocol.variantId!).name.length > 0, 'enhanced variant identity must resolve to authored presentation metadata');
    assert.equal(protocolThreatCost(protocol), protocolDefinition(protocol.id).threatCost + 1, 'enhanced variants must retain the existing +1 threat-budget premium');
    assert.equal(protocolRewardValue(protocol), protocolDefinition(protocol.id).rewardWeight + 1, 'enhanced variants must retain the existing +1 reward premium');
  }

  const t12Contract = { ...base, operationTier: 12 };
  const t12Enhanced = Array.from({ length: 96 }, (_, index) => chooseEnemyProtocols(t12Contract, 'elite', 'standard', 3, index + 1)).flat().filter(protocol => protocol.enhanced);
  assert.ok(t12Enhanced.length > enhancedInstances.length, 'T12 deterministic sampling should use the higher authored enhanced-variant chance');

  const runtimeSource = readFileSync('src/game/eliteProtocolRuntime.ts', 'utf8');
  assert.match(runtimeSource, /protocol\.enhanced[\s\S]*ALLY PATCH/, 'named Reactive Plating variant must retain its ally-patch mechanical upgrade');
  assert.match(runtimeSource, /protocol\.enhanced[\s\S]*PAIRED/, 'named Magnetic Lock variant must retain its paired gravity-well mechanical upgrade');
  assert.match(runtimeSource, /protocol\.enhanced[\s\S]*CROSS-FAN/, 'named Penetrator Volley variant must retain its widened volley mechanical upgrade');
  const combatSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');
  const hubSource = readFileSync('src/components/ShipHub.tsx', 'utf8');
  assert.match(combatSource, /variantPresentation\?\.shortName/, 'combat HUD should render the authored enhanced variant short name instead of only a generic marker');
  assert.match(hubSource, /VARIANT \/\//, 'contract tactical forecast should name legal enhanced variants before deployment');
}
enhancedProtocolVariantSmoke();

function t9MutationSmoke() {
  const baseContract = generateContracts(createDefaultCampaign())[0]!;
  const base = {
    ...baseContract,
    seed: 93461,
    location: 'lattice-annex' as const,
    objectiveMode: 'gravity-stabilization' as const,
    threatBudget: 92,
    encounterPattern: 'elite-led' as const,
    eliteProtocolSlots: 3,
    reserveCount: 1,
    environmentalEventSlots: 2,
    combatEffectiveness: 1,
    directiveProtocolBias: ['breachmaker', 'magneticLock'],
  };

  const t8Contract = { ...base, operationTier: 8 };
  assert.deepEqual(mutationForecastForContract(t8Contract), [], 'T9+ elite mutations must remain locked below T9');
  const t8State = createSimulation();
  applyThreatBudget(t8State.enemies, t8Contract);
  assert.equal(t8State.enemies.some(enemy => enemy.mutations.length > 0), false, 'T8 encounters must not receive elite mutations');

  const t9Contract = { ...base, operationTier: 9 };
  const t9Forecast = mutationForecastForContract(t9Contract);
  assert.ok(t9Forecast.length >= 3, 'T9 tactical forecast should disclose the legal mutation pool');
  assert.ok(t9Forecast.every(id => mutationPresentationFor(id).minTier <= 9), 'T9 forecast must not leak later-tier mutation identities');

  const first = createSimulation();
  applyThreatBudget(first.enemies, t9Contract);
  const mutated = first.enemies.filter(enemy => enemy.mutations.length > 0);
  assert.ok(mutated.length > 0, 'T9 elite-led encounters should assign at least one mutation from the reserved mutation budget');
  assert.ok(mutated.every(enemy => enemy.role !== 'boss' && (enemy.combatClass === 'elite' || enemy.combatClass === 'enhanced')), 'P6.3 mutations must stay on non-boss elite/enhanced enemies');
  assert.equal(first.enemies.find(enemy => enemy.role === 'boss')?.mutations.length ?? 0, 0, 'bosses must remain outside the elite mutation namespace');
  const t9MutationCost = mutated.reduce((total, enemy) => total + mutationThreatCostForEnemy(enemy), 0);
  assert.ok(t9MutationCost > 0 && t9MutationCost <= 2, 'T9 mutations must consume only the explicit two-point mutation commitment');

  const second = createSimulation();
  applyThreatBudget(second.enemies, t9Contract);
  assert.deepEqual(
    first.enemies.map(enemy => [enemy.id, enemy.mutations]),
    second.enemies.map(enemy => [enemy.id, enemy.mutations]),
    'T9 mutation assignment must be deterministic for the same contract seed and encounter roster',
  );

  const statSample = createSimulation().enemies.find(enemy => enemy.role === 'elite');
  assert.ok(statSample, 'mutation stat regression requires an authored elite sample');
  const hpBefore = statSample!.maxHp;
  const armorBefore = statSample!.maxArmor;
  applyEnemyMutations(statSample!, ['reinforced-core', 'ablative-mantle']);
  assert.ok(statSample!.maxHp > hpBefore, 'Reinforced Core must materially increase elite durability');
  assert.ok(statSample!.maxArmor > armorBefore, 'Ablative Mantle must materially increase elite armor');
  assert.equal(mutationMobilityScale({ mutations: ['hunter-servo'] } as any), 1.14, 'Hunter Servo must materially increase movement cadence');
  assert.equal(mutationFireCadenceScale({ mutations: ['redline-bus'] } as any), 1.18, 'Redline Bus must materially increase firing cadence');
  assert.equal(mutationHazardCadenceScale({ mutations: ['relay-reflex'] } as any), 1.22, 'Relay Reflex must materially increase technician/protocol cadence');

  const t11Contract = { ...base, operationTier: 11 };
  const t11State = createSimulation();
  applyThreatBudget(t11State.enemies, t11Contract);
  const t11MutationCost = t11State.enemies.reduce((total, enemy) => total + mutationThreatCostForEnemy(enemy), 0);
  assert.ok(t11MutationCost > 0 && t11MutationCost <= 6, 'T11 mutation assignment must stay inside the six-point mutation commitment');
  assert.ok(mutationForecastForContract(t11Contract).includes('relay-reflex'), 'T11 forecast should unlock the Relay Reflex mutation layer');

  const combatSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');
  const hubSource = readFileSync('src/components/ShipHub.tsx', 'utf8');
  assert.match(combatSource, /mutationTag\(enemy\)/, 'combat HUD should surface compact mutation identities above affected elites');
  assert.match(hubSource, /MUTATION \/\//, 'Tactical Forecast should disclose legal T9+ mutations before deployment');
}
t9MutationSmoke();

function bossPhaseMutationSmoke() {
  const baseContract = generateContracts(createDefaultCampaign())[0]!;
  const base = {
    ...baseContract,
    seed: 771923,
    location: 'lattice-annex' as const,
    objectiveMode: 'gravity-stabilization' as const,
    threatBudget: 96,
    encounterPattern: 'elite-led' as const,
    eliteProtocolSlots: 4,
    reserveCount: 1,
    environmentalEventSlots: 3,
    combatEffectiveness: 1,
  };

  const t8Contract = { ...base, operationTier: 8 };
  assert.deepEqual(bossPhaseMutationForecastForContract(t8Contract), [], 'boss phase mutations must remain locked below T9');

  const t9Contract = { ...base, operationTier: 9 };
  const t9Forecast = bossPhaseMutationForecastForContract(t9Contract);
  assert.equal(t9Forecast.length, 1, 'T9-T11 bosses should arm exactly one phase mutation');
  assert.deepEqual(t9Forecast, chooseBossPhaseMutations(t9Contract), 'boss mutation forecast and runtime selection must use the same deterministic resolver');
  assert.ok(t9Forecast.every(id => bossPhaseMutationMinTier(id) <= 9), 'T9 boss forecast must not leak later-tier identities');
  assert.deepEqual(chooseBossPhaseMutations(t9Contract), chooseBossPhaseMutations(t9Contract), 'same seed and tier must always resolve the same phase mutation');

  const t9State = createSimulation();
  applyThreatBudget(t9State.enemies, t9Contract);
  const t9Boss = t9State.enemies.find(enemy => enemy.role === 'boss');
  assert.ok(t9Boss, 'boss phase mutation regression requires an authored command target');
  assert.deepEqual(t9Boss!.bossPhaseMutations, t9Forecast, 'threat scaling should assign the exact mutation disclosed in Tactical Forecast');
  assert.equal(t9Boss!.mutations.length, 0, 'boss phase mutations must stay separate from elite mutations');

  const t12Contract = { ...base, operationTier: 12 };
  const t12Forecast = bossPhaseMutationForecastForContract(t12Contract);
  assert.equal(t12Forecast.length, 2, 'T12 bosses should combine two distinct phase mutations');
  assert.equal(new Set(t12Forecast).size, t12Forecast.length, 'T12 phase mutations must not duplicate the same identity');

  const cadence = bossPhaseFireCadenceScale({ bossPhase: 2, bossPhaseMutations: ['redline-sequence'] });
  assert.ok(cadence >= 1.2, 'Redline Sequence must materially accelerate phase-two attack recovery');
  assert.equal(bossPhaseFireCadenceScale({ bossPhase: 1, bossPhaseMutations: ['redline-sequence'] }), 1, 'boss mutations must not change phase-one cadence');

  const transitionState = (id: BossPhaseMutationId) => {
    const state = createSimulation();
    for (const enemy of state.enemies) if (enemy.role !== 'boss') enemy.active = false;
    const boss = state.enemies.find(enemy => enemy.role === 'boss')!;
    boss.active = true;
    boss.bossPhaseMutations = [id];
    boss.bossMutationCooldown = 0;
    boss.fireCooldown = 2;
    boss.hp = boss.maxHp * 0.5;
    state.bossActive = true;
    stepSimulation(state, 0.1);
    assert.equal(boss.bossPhase, 2, `${id} test target should cross into phase two`);
    assert.match(state.eventText, /PHASE MUTATION/, `${id} transition should announce the armed phase mutation`);
    return { state, boss };
  };

  const phaseOne = createSimulation();
  for (const enemy of phaseOne.enemies) if (enemy.role !== 'boss') enemy.active = false;
  const phaseOneBoss = phaseOne.enemies.find(enemy => enemy.role === 'boss')!;
  phaseOneBoss.active = true;
  phaseOneBoss.bossPhaseMutations = ['countermass-halo'];
  phaseOneBoss.bossMutationCooldown = 0;
  phaseOne.bossActive = true;
  stepSimulation(phaseOne, 0.1);
  assert.equal(phaseOneBoss.bossPhase, 1, 'healthy boss should remain in phase one');
  assert.equal(phaseOne.hazards.some(hazard => hazard.active && hazard.kind === 'gravityWell'), false, 'phase mutations must remain dormant before the phase transition');

  const rupture = transitionState('rupture-crown');
  assert.ok(rupture.state.sectors.find(sector => sector.id === 'C')!.pressure <= 0.8, 'Rupture Crown should create an immediate pressure break on transition');
  assert.ok(rupture.state.hazards.some(hazard => hazard.active && hazard.kind === 'vectorWash'), 'Rupture Crown should project countermass wash denial');

  const redline = transitionState('redline-sequence');
  assert.ok(redline.boss.fireCooldown <= 0.42, 'Redline Sequence should immediately compress the boss recovery window');

  const halo = transitionState('countermass-halo');
  assert.ok(halo.state.hazards.some(hazard => hazard.active && hazard.kind === 'gravityWell'), 'Countermass Halo should project a phase-transition mass well');
  for (const hazard of halo.state.hazards) hazard.active = false;
  halo.boss.bossMutationCooldown = 0;
  stepSimulation(halo.state, 0.1);
  assert.ok(halo.state.hazards.some(hazard => hazard.active && hazard.kind === 'gravityWell'), 'Countermass Halo should continue pulsing during phase two');

  const tempest = transitionState('relay-tempest');
  assert.ok(tempest.state.hazards.filter(hazard => hazard.active && hazard.kind === 'shockGrid').length >= 1, 'Relay Tempest should seed arc denial on phase transition');

  const combatSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');
  const hubSource = readFileSync('src/components/ShipHub.tsx', 'utf8');
  assert.match(combatSource, /PHASE MUTATION \/\//, 'boss HUD should identify armed and active phase mutations');
  assert.match(hubSource, /BOSS PHASE \/\//, 'Tactical Forecast should disclose the deterministic boss phase mutation before deployment');
}
bossPhaseMutationSmoke();

function commandTargetMutationSmoke() {
  const baseContract = generateContracts(createDefaultCampaign())[0]!;
  const base = {
    ...baseContract,
    seed: 926311,
    location: 'lattice-annex' as const,
    objectiveMode: 'gravity-stabilization' as const,
    threatBudget: 82,
    encounterPattern: 'elite-led' as const,
    eliteProtocolSlots: 3,
    reserveCount: 1,
    environmentalEventSlots: 2,
    combatEffectiveness: 1,
  };

  const eliteLed = { ...base, operationTier: 10, directiveTier: 10, directiveTargetClass: 'elite-led' as const };
  assert.deepEqual(commandTargetMutationForecastForContract(eliteLed), [], 'elite-led directives must never receive whole-target command packages');

  const t8Command = { ...base, operationTier: 8, directiveTier: 8, directiveTargetClass: 'command-target' as const };
  assert.deepEqual(commandTargetMutationForecastForContract(t8Command), [], 'whole-target command packages must remain locked below T9');

  const t9Command = { ...base, operationTier: 9, directiveTier: 9, directiveTargetClass: 'command-target' as const };
  const t9Forecast = commandTargetMutationForecastForContract(t9Command);
  assert.equal(t9Forecast.length, 1, 'T9 command directives should arm one deterministic whole-target package');
  assert.deepEqual(t9Forecast, chooseCommandTargetMutations(t9Command), 'command package forecast and runtime assignment must use the same resolver');
  assert.ok(t9Forecast.every(id => commandTargetMutationMinTier(id) <= 9), 'command package resolver must respect tier legality');
  assert.deepEqual(chooseCommandTargetMutations(t9Command), chooseCommandTargetMutations(t9Command), 'same command directive seed and tier must resolve the same package');

  const commandContract = { ...base, operationTier: 10, directiveTier: 10, directiveTargetClass: 'command-target' as const };
  const commandForecast = commandTargetMutationForecastForContract(commandContract);
  const commandState = createSimulation();
  applyThreatBudget(commandState.enemies, commandContract);
  const commandBoss = commandState.enemies.find(enemy => enemy.role === 'boss')!;
  assert.deepEqual(commandBoss.commandTargetMutations, commandForecast, 'threat scaling should assign the exact command package disclosed before deployment');
  assert.equal(commandBoss.mutations.length, 0, 'command packages must stay separate from elite mutation storage');
  assert.ok(commandBoss.bossPhaseMutations.length > 0, 'T9+ Command Targets may also carry the separate boss phase mutation layer');
  assert.notDeepEqual(commandBoss.commandTargetMutations, commandBoss.bossPhaseMutations, 'whole-target packages and boss phase mutations must retain distinct identities and storage');

  const plainState = createSimulation();
  applyThreatBudget(plainState.enemies, eliteLed);
  const plainBoss = plainState.enemies.find(enemy => enemy.role === 'boss')!;
  assert.ok(commandBoss.maxHp > plainBoss.maxHp || commandBoss.maxArmor > plainBoss.maxArmor, 'whole-target command packages should materially reinforce target durability');

  assert.ok(commandTargetFireCadenceScale({ commandTargetMutations: ['pursuit-governor'] } as any) >= 1.12, 'Pursuit Governor should accelerate command attacks for the whole fight');

  const pulseState = createSimulation();
  for (const enemy of pulseState.enemies) if (enemy.role !== 'boss') enemy.active = false;
  const pulseBoss = pulseState.enemies.find(enemy => enemy.role === 'boss')!;
  pulseBoss.active = true;
  pulseBoss.commandTargetMutations = ['countermass-interlock'];
  pulseBoss.commandMutationCooldown = 0;
  pulseBoss.fireCooldown = 2;
  pulseState.bossActive = true;
  stepSimulation(pulseState, 0.1);
  assert.equal(pulseBoss.bossPhase, 1, 'command package regression should prove the package is active before phase two');
  assert.ok(pulseState.hazards.some(hazard => hazard.active && hazard.kind === 'gravityWell'), 'Countermass Interlock should project recurring whole-fight mass denial');
  assert.match(pulseState.eventText, /COMMAND PACKAGE/, 'whole-fight command package pulse should announce itself distinctly from phase mutations');

  const combatSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');
  const hubSource = readFileSync('src/components/ShipHub.tsx', 'utf8');
  const directiveSource = readFileSync('src/components/DirectivePanel.tsx', 'utf8');
  assert.match(combatSource, /COMMAND PACKAGE \/\//, 'boss HUD should identify the active whole-fight command package');
  assert.match(hubSource, /COMMAND PACKAGE \/\//, 'Tactical Forecast should disclose command packages before deployment');
  assert.match(directiveSource, /COMMAND PACKAGE \/\//, 'Directive cards should preview command packages before preparation');
}
commandTargetMutationSmoke();

function environmentalRiskPackageSmoke() {
  const baseContract = generateContracts(createDefaultCampaign())[0]!;
  const base = {
    ...baseContract,
    seed: 481516,
    location: 'orbital-station' as const,
    objectiveMode: 'gravity-stabilization' as const,
    environmentalEventSlots: 4,
    directiveMaterialMultiplier: 1.2,
  };

  const t8 = { ...base, operationTier: 8, directiveTier: 8 };
  assert.equal(environmentalRiskPackageForContract(t8), null, 'environment risk packages must remain locked below T9');

  const t9 = { ...base, operationTier: 9, directiveTier: 9 };
  const risk = environmentalRiskPackageForContract(t9);
  assert.ok(risk, 'T9 directives should arm one deterministic environmental risk package');
  assert.deepEqual(environmentalRiskPackageForContract(t9), risk, 'same directive seed and tier must resolve the same environmental risk package');
  assert.equal(risk!.events.length, 2, 'environmental risk packages should combine exactly two authored Director events');
  assert.ok(risk!.rewardMultiplier > 1, 'environmental risk packages must carry an explicit extraction-yield premium');
  assert.equal(environmentalRiskRewardMultiplierForContract(t9), risk!.rewardMultiplier, 'reward scaling must resolve from the same package disclosed before deployment');

  const forecast = getEnvironmentalEventForecast(t9);
  assert.equal(forecast.length, 4, 'T9 environmental scheduling should preserve the four-event high-tier budget');

  const runtime = createEnvironmentalEventRuntime();
  const state = createSimulation();
  stepEnvironmentalEvents(state, runtime, t9, 0.1, 20);
  assert.ok(runtime.plan, 'environmental event runtime should materialize a deterministic plan');
  assert.deepEqual(runtime.plan!.slice(0, 2).map(item => item.id), risk!.events, 'risk package events must be the first paired events in the Director plan');
  assert.ok(runtime.plan![1]!.at - runtime.plan![0]!.at <= 3, 'risk package events should overlap inside one dangerous Director window');
  assert.ok(risk!.events.every(id => runtime.fired.includes(id)), 'both environmental risk events should execute when their shared window is reached');

  const scaling = operationScalingFor(t9, createDefaultCampaign(), 20);
  const expectedReward = (1 + (9 - 1) * 0.04) * 1.2 * risk!.rewardMultiplier;
  assert.ok(Math.abs(scaling.operationRewardMultiplier - expectedReward) < 1e-9, 'operation settlement multiplier must include the disclosed environmental risk premium');

  const hubSource = readFileSync('src/components/ShipHub.tsx', 'utf8');
  const directiveSource = readFileSync('src/components/DirectivePanel.tsx', 'utf8');
  assert.match(hubSource, /ENV RISK \/\//, 'Tactical Forecast should disclose the environmental package and yield premium before deployment');
  assert.match(directiveSource, /ENV RISK \/\//, 'Directive cards should disclose the environmental package and yield premium before preparation');
  assert.match(hubSource, /CHASE POOL \/\/ DIRECTIVE-ONLY SINGULAR/, 'contract inspection should disclose the exclusive high-tier Singular pool before deployment');
  assert.match(directiveSource, /CHASE POOL \/\/ DIRECTIVE-ONLY SINGULAR/, 'Directive cards should disclose the exclusive high-tier Singular pool before preparation');
}
environmentalRiskPackageSmoke();

function parallaxPacingTelemetry(): Telemetry {
  return {
    damageDealt: 0,
    damageTaken: 0,
    deaths: 0,
    kills: 6,
    eliteKills: 1,
    eliteProtocolsDefeated: 1,
    killIntervalTotal: 18,
    killIntervalSamples: 5,
    lastKillAt: 38,
    protocolCombinations: {},
    weaponShots: { carbine: 12, breacher: 4, rail: 3 },
    abilityUses: [1, 1, 1],
    encounterStart: 0,
    bossStart: 0,
    duration: 55,
    trace: [],
    nextTraceAt: 0,
  };
}

const storage = new Map<string, string>();
let failStorageWrites = false;
let failBackupWrites = false;
const localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (failStorageWrites || (failBackupWrites && key.includes('-recovery-'))) throw new Error('storage blocked');
    storage.set(key, String(value));
  },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
};
(globalThis as unknown as { window: { localStorage: typeof localStorage } }).window = { localStorage };

const migratedSource = createDefaultCampaign();
const { consumables: _oldConsumables, ...legacyCampaign } = migratedSource;
localStorage.setItem('ironshade-vector-campaign-v1', JSON.stringify(legacyCampaign));
const migrated = loadCampaign();
assert.deepEqual(migrated.consumables, { medGel: 1, armorPatch: 0, capacitorCell: 0 }, 'existing saves should receive compatible default consumable storage');

let campaign = createDefaultCampaign();
const creditsBefore = campaign.resources.credits;
const stockBefore = campaign.consumables.medGel;
const purchase = buyConsumable(campaign, 'medGel');
campaign = purchase.campaign;
assert.equal(campaign.resources.credits, creditsBefore - 45, 'Trauma Gel should cost Credits');
assert.equal(campaign.consumables.medGel, stockBefore + 1, 'purchase should increase persistent stock');
saveCampaign(campaign);
assert.equal(loadCampaign().consumables.medGel, stockBefore + 1, 'consumable stock should round-trip through campaign save');

let parallaxCampaign = createDefaultCampaign();
parallaxCampaign.story.interdiction.status = 'complete';
parallaxCampaign = syncParallaxDebtAccess(parallaxCampaign, 15);
assert.equal(parallaxCampaign.story.parallaxDebt.status, 'active', 'LV15 + completed Interdiction should open Parallax Debt');
assert.equal(parallaxDebtChapter.totalContracts, 12, 'Parallax Debt should contain a full 12-contract Chapter 3 arc.');
assert.equal(parallaxDebtChapter.authoredContracts, 12, 'All twelve Chapter 3 contracts should now be authored.');
const openingIntel = parallaxDebtIntel(parallaxCampaign);
assert.deepEqual(openingIntel.phases.map(phase => phase.minimumLevel), [15, 16, 17, 18], 'Parallax Intel phases should mirror the LV15-LV18 progression gates.');
assert.deepEqual(openingIntel.phases.map(phase => phase.operations.length), [3, 3, 2, 1], 'Parallax Intel should present the nine pre-decision operations in their authored phase groups.');
assert.deepEqual(openingIntel.branches.map(branch => branch.operations.length), [3, 3], 'Parallax Intel should present three closing operations for each route decision.');

let pacingCampaign = createDefaultCampaign();
pacingCampaign.story.interdiction.status = 'complete';
pacingCampaign = syncParallaxDebtAccess(pacingCampaign, 15);
let pacingProfile = { ...createDefaultProfile(), xp: 7140, level: 15, runsCompleted: 20, classSelectionComplete: true };
for (let step = 0; step < 8; step += 1) {
  const contract = getParallaxDebtContract(pacingCampaign, pacingProfile.level);
  assert.ok(contract, `Parallax pacing contract ${step + 1} should unlock from campaign-earned XP without side grinding.`);
  const scaling = operationScalingFor(contract, pacingCampaign, pacingProfile.level);
  const recovery = awardRecovery(pacingProfile, parallaxPacingTelemetry(), false, 0, {
    operationTier: scaling.operationTier,
    maxRecoveryLevel: scaling.maxRecoveryLevel,
    combatEffectiveness: scaling.combatEffectiveness,
    xpFloor: contract.xpFloor,
  });
  assert.ok(recovery.xpGained >= (contract.xpFloor ?? 0), `Parallax operation ${step + 1} should honor its authored XP floor.`);
  pacingProfile = recovery.profile;
  pacingCampaign = advanceParallaxDebtAfterContract(pacingCampaign, contract).campaign;
  if (step === 2) assert.equal(pacingProfile.level, 16, 'Three LV15 Parallax operations should fund the LV16 continuation gate on safe extraction.');
  if (step === 5) assert.equal(pacingProfile.level, 17, 'Three LV16 Parallax operations should fund the LV17 continuation gate on safe extraction.');
}
assert.equal(pacingProfile.level, 18, 'Null Transit and Counterfactual Burn should fund the LV18 False Horizon gate on safe extraction.');
assert.ok(getParallaxDebtContract(pacingCampaign, pacingProfile.level), 'False Horizon should unlock without requiring unrelated side-contract XP.');


for (let step = 0; step < 3; step += 1) {
  const contract = getParallaxDebtContract(parallaxCampaign, 15);
  assert.ok(contract, `Parallax Debt opening contract ${step + 1} should exist at LV15`);
  if (step === 0) {
    assert.equal(contract.location, 'parallax-array');
    assert.equal(contract.objectiveMode, 'reference-alignment');
    const openingScaling = operationScalingFor(contract, parallaxCampaign, 15);
    assert.equal(openingScaling.operationTier, 9, 'Opening Parallax work should start at T9 / LV15 pressure.');
    assert.equal(openingScaling.encounterPattern, 'swarm', 'Opening Parallax pressure should preserve the authored swarm pattern.');
    assert.equal(openingScaling.reserveCount, 1, 'Opening Parallax pressure should preserve the authored single reserve instead of generic T9 reserves.');
    assert.equal(contract.xpFloor, 320, 'LV15 Parallax operations should carry the gate-safe XP floor.');
  }
  parallaxCampaign = advanceParallaxDebtAfterContract(parallaxCampaign, contract).campaign;
}
assert.equal(parallaxCampaign.story.parallaxDebt.status, 'active', 'Blind Meridian should finish only the opening phase.');
assert.equal(parallaxCampaign.story.parallaxDebt.evidence.length, 3, 'Opening Parallax Debt should bank its original three evidence records.');
assert.equal(parallaxDebtNextRequiredLevel(parallaxCampaign), 16, 'The first continuation phase should require LV16.');
assert.equal(getParallaxDebtContract(parallaxCampaign, 15), null, 'LV15 should not bypass the LV16 Parallax continuation gate.');

let migratedLegacyParallax = createDefaultCampaign();
migratedLegacyParallax.story.interdiction.status = 'complete';
migratedLegacyParallax.story.parallaxDebt = {
  status: 'complete',
  step: 3,
  choiceA: null,
  completed: ['parallax-debt-0', 'parallax-debt-1', 'parallax-debt-2'],
  evidence: ['baseline-offset', 'return-vector', 'blind-meridian'],
  lastBeat: 'Legacy opening sequence complete.',
};
migratedLegacyParallax = syncParallaxDebtAccess(migratedLegacyParallax, 15);
assert.equal(migratedLegacyParallax.story.parallaxDebt.status, 'active', 'Legacy saves that completed the three-contract opening must reopen safely into the expanded chapter.');
assert.equal(migratedLegacyParallax.story.parallaxDebt.step, 3, 'Legacy Parallax migration must preserve the completed opening step.');
assert.equal(migratedLegacyParallax.story.parallaxDebt.choiceA, null, 'Legacy saves should migrate with no Parallax branch selected.');

for (let step = 3; step < 6; step += 1) {
  const contract = getParallaxDebtContract(parallaxCampaign, 16);
  assert.ok(contract, `Parallax Debt LV16 contract ${step + 1} should exist`);
  if (step === 3) {
    assert.equal(contract.title, 'Parallax Debt // Kepler Wake');
    const continuationScaling = operationScalingFor(contract, parallaxCampaign, 16);
    assert.equal(continuationScaling.operationTier, 10, 'LV16 continuation should move Parallax Debt to T10 pressure.');
    assert.equal(continuationScaling.reserveCount, 2, 'LV16 continuation should commit both authored reserve waves.');
    assert.equal(contract.xpFloor, 340, 'LV16 Parallax operations should carry the gate-safe XP floor.');
  }
  parallaxCampaign = advanceParallaxDebtAfterContract(parallaxCampaign, contract).campaign;
}
assert.equal(parallaxDebtNextRequiredLevel(parallaxCampaign), 17, 'Residual Frame should hand the campaign into an LV17 gate.');
assert.equal(getParallaxDebtContract(parallaxCampaign, 16), null, 'LV16 should not bypass the LV17 Parallax continuation gate.');

for (let step = 6; step < 8; step += 1) {
  const contract = getParallaxDebtContract(parallaxCampaign, 17);
  assert.ok(contract, `Parallax Debt LV17 contract ${step + 1} should exist`);
  if (step === 6) {
    assert.equal(contract.title, 'Parallax Debt // Null Transit');
    const lateScaling = operationScalingFor(contract, parallaxCampaign, 17);
    assert.equal(lateScaling.operationTier, 11, 'LV17 continuation should move Parallax Debt to T11 pressure.');
    assert.equal(lateScaling.encounterPattern, 'elite-led', 'LV17 Parallax operations should use the authored elite-led pressure profile.');
    assert.equal(lateScaling.reserveCount, 2, 'LV17 Parallax operations should retain two reserve commitments.');
    assert.equal(contract.xpFloor, 540, 'The two LV17 operations should each cover half of the LV18 gate requirement.');
  }
  parallaxCampaign = advanceParallaxDebtAfterContract(parallaxCampaign, contract).campaign;
}
assert.equal(parallaxDebtNextRequiredLevel(parallaxCampaign), 18, 'False Horizon should be the LV18 gate.');
assert.equal(getParallaxDebtContract(parallaxCampaign, 17), null, 'LV17 should not bypass the LV18 False Horizon gate.');

const falseHorizon = getParallaxDebtContract(parallaxCampaign, 18);
assert.ok(falseHorizon, 'False Horizon should unlock at LV18.');
assert.equal(falseHorizon.title, 'Parallax Debt // False Horizon');
assert.equal(falseHorizon.xpFloor, 380, 'LV18 campaign operations should continue meaningful progression after the final level gate.');
assert.ok((falseHorizon.chapterRewardMultiplier ?? 1) > 1, 'Late Chapter 3 operations should carry an authored material-reward premium.');
parallaxCampaign = advanceParallaxDebtAfterContract(parallaxCampaign, falseHorizon).campaign;
assert.equal(parallaxCampaign.story.parallaxDebt.status, 'active', 'False Horizon should hand off to the final campaign decision.');
assert.equal(parallaxCampaign.story.parallaxDebt.step, 9, 'False Horizon should bank the ninth Chapter 3 contract.');
assert.equal(parallaxCampaign.story.parallaxDebt.evidence.length, 9, 'False Horizon should leave nine distinct evidence records banked.');
const parallaxChoice = getParallaxDebtChoicePrompt(parallaxCampaign);
assert.ok(parallaxChoice, 'False Horizon should open the Parallax route decision.');
assert.deepEqual(parallaxChoice.choices.map(choice => choice.id), ['expose-route', 'hold-route'], 'The Parallax decision should expose both meaningful route strategies.');
assert.equal(getParallaxDebtContract(parallaxCampaign, 20), null, 'No closing contract should appear until the Parallax decision is made.');

const preDecisionParallax = JSON.parse(JSON.stringify(parallaxCampaign)) as typeof parallaxCampaign;
const meridianBefore = parallaxCampaign.reputation.meridian;
parallaxCampaign = chooseParallaxDebtBranch(parallaxCampaign, 'expose-route');
assert.equal(parallaxCampaign.story.parallaxDebt.choiceA, 'expose-route');
assert.equal(parallaxDebtIntel(parallaxCampaign).selectedBranch?.id, 'expose-route', 'Parallax Intel should follow the exposed-route campaign decision.');
assert.equal(parallaxCampaign.reputation.meridian, meridianBefore + 1, 'Exposing the route should bank the documented Meridian reputation consequence.');
for (let step = 9; step < 12; step += 1) {
  const contract = getParallaxDebtContract(parallaxCampaign, 18);
  assert.ok(contract, `Exposed-route closing operation ${step + 1} should exist`);
  if (step === 9) {
    assert.equal(contract.title, 'Parallax Debt // Common Reference');
    assert.equal(operationScalingFor(contract, parallaxCampaign, 18).operationTier, 12, 'The final branch should run at T12 pressure.');
  }
  if (step === 11) assert.equal(contract.title, 'Parallax Debt // Released Vector');
  parallaxCampaign = advanceParallaxDebtAfterContract(parallaxCampaign, contract).campaign;
}
assert.equal(parallaxCampaign.story.parallaxDebt.status, 'complete', 'The exposed-route branch should complete Chapter 3 after twelve contracts.');
assert.equal(parallaxCampaign.story.parallaxDebt.evidence.length, 12, 'The exposed-route branch should bank three new closing evidence records.');
assert.match(parallaxCampaign.story.parallaxDebt.lastBeat, /OPEN REFERENCE/, 'The exposed-route outcome should persist its distinct campaign resolution.');

let heldParallax = chooseParallaxDebtBranch(preDecisionParallax, 'hold-route');
const longArcBefore = preDecisionParallax.reputation.longarc;
assert.equal(heldParallax.story.parallaxDebt.choiceA, 'hold-route');
assert.equal(parallaxDebtIntel(heldParallax).selectedBranch?.id, 'hold-route', 'Parallax Intel should follow the quiet-custody campaign decision.');
assert.equal(heldParallax.reputation.longarc, longArcBefore + 1, 'Keeping the route dark should bank the documented Long Arc reputation consequence.');
for (let step = 9; step < 12; step += 1) {
  const contract = getParallaxDebtContract(heldParallax, 18);
  assert.ok(contract, `Held-route closing operation ${step + 1} should exist`);
  if (step === 9) assert.equal(contract.title, 'Parallax Debt // Dark Baseline');
  if (step === 10) assert.equal(contract.title, 'Parallax Debt // Ghost Transit');
  if (step === 11) assert.equal(contract.title, 'Parallax Debt // Private Vector');
  heldParallax = advanceParallaxDebtAfterContract(heldParallax, contract).campaign;
}
assert.equal(heldParallax.story.parallaxDebt.status, 'complete', 'The held-route branch should complete Chapter 3 after twelve contracts.');
assert.equal(heldParallax.story.parallaxDebt.evidence.length, 12, 'The held-route branch should bank three new closing evidence records.');
assert.match(heldParallax.story.parallaxDebt.lastBeat, /QUIET CUSTODY/, 'The held-route outcome should persist its distinct campaign resolution.');



function hardArsenalLockSmoke() {
  const defaultProfile = createDefaultProfile();
  assert.equal(activeWeaponFamilyForProfile(defaultProfile), 'breacher', 'Fresh Vanguard profiles should own the Breacher family.');
  assert.equal(defaultProfile.equipped.breacher, 'starter-breacher');
  assert.equal(defaultProfile.equipped.carbine, null);
  assert.equal(defaultProfile.equipped.rail, null);

  const legacyVector = {
    ...defaultProfile,
    operatorClass: 'vector' as const,
    classSelectionComplete: true,
    equipped: { ...defaultProfile.equipped, carbine: 'starter-carbine', breacher: 'starter-breacher', rail: 'starter-rail' },
  };
  const migratedVector = normalizeClassArmament(legacyVector);
  assert.equal(migratedVector.equipped.rail, 'starter-rail', 'Vector migration should keep its Rail Lance equipped.');
  assert.equal(migratedVector.equipped.carbine, null, 'Vector migration should move Carbines to storage.');
  assert.equal(migratedVector.equipped.breacher, null, 'Vector migration should move Breachers to storage.');
  assert.ok(migratedVector.inventory.some(item => item.id === 'starter-carbine'), 'Migrated off-class weapons must remain in ship storage.');
  assert.ok(migratedVector.inventory.some(item => item.id === 'starter-breacher'), 'Migration must never discard incompatible equipped weapons.');

  const systemsWithoutCarbine = {
    ...defaultProfile,
    operatorClass: 'systems' as const,
    classSelectionComplete: true,
    inventory: defaultProfile.inventory.filter(item => item.slot !== 'carbine'),
    equipped: { ...defaultProfile.equipped, carbine: null, breacher: null, rail: null },
  };
  const restoredSystems = normalizeClassArmament(systemsWithoutCarbine);
  assert.equal(restoredSystems.equipped.carbine, 'starter-carbine', 'Systems migration should restore a valid starter Carbine when none exists.');
  assert.ok(restoredSystems.inventory.some(item => item.id === 'starter-carbine'), 'Restored starter armaments must be persisted in inventory.');

  const offClassBreacher = restoredSystems.inventory.find(item => item.id === 'starter-breacher')!;
  const rejected = equipItem(restoredSystems, offClassBreacher.id);
  assert.equal(rejected.profile, restoredSystems, 'Off-class weapon equip attempts should not mutate the profile.');
  assert.match(rejected.message, /locked to CARBINE/, 'Off-class equip rejection should explain the owned arsenal family.');
  const carbine = restoredSystems.inventory.find(item => item.id === 'starter-carbine')!;
  assert.equal(equipItem(restoredSystems, carbine.id).profile.equipped.carbine, carbine.id, 'Owned-family weapon equips should remain valid.');

  const switchedVector = setOperatorClass(defaultProfile, 'vector').profile;
  assert.equal(switchedVector.equipped.rail, 'starter-rail', 'Class recalibration should equip the new class starter family.');
  assert.equal(switchedVector.equipped.breacher, null, 'Class recalibration should stow the previous class weapon.');
  assert.ok(switchedVector.inventory.some(item => item.id === 'starter-breacher'), 'Class recalibration must preserve the old weapon in storage.');

  const vectorState = createSimulation(deriveCombatBuild(switchedVector));
  assert.equal(vectorState.player.currentWeapon, 'rail', 'Vector combat should boot directly into its Rail Lance.');
  assert.equal(selectWeapon(vectorState, 'carbine'), false, 'Class combat should reject cross-family direct weapon selection.');
  assert.equal(vectorState.player.currentWeapon, 'rail', 'Rejected selection must not change the active weapon.');
  assert.equal(cycleWeapon(vectorState), false, 'Class combat should have no cross-family cycle target.');
  assert.equal(vectorState.player.currentWeapon, 'rail', 'Weapon cycling must leave the class armament active.');

  const malformedVanguard = {
    ...defaultProfile,
    classSelectionComplete: true,
    equipped: { ...defaultProfile.equipped, carbine: 'starter-carbine' },
    inventory: defaultProfile.inventory.map(item => item.id === 'starter-carbine' ? { ...item, modifiers: [materializeModifier('overdrive', 5)] } : item),
  };
  const cleanBuild = deriveCombatBuild({ ...defaultProfile, classSelectionComplete: true });
  const malformedBuild = deriveCombatBuild(malformedVanguard);
  assert.equal(malformedBuild.weapon.carbine.damageMul, cleanBuild.weapon.carbine.damageMul, 'Direct malformed profiles must not apply off-class weapon modifiers to combat builds.');
}
hardArsenalLockSmoke();

function classOwnedRecoverySmoke() {
  const telemetry = parallaxPacingTelemetry();
  const cases = [
    { operatorClass: 'vanguard' as const, weapon: 'breacher' as const },
    { operatorClass: 'vector' as const, weapon: 'rail' as const },
    { operatorClass: 'systems' as const, weapon: 'carbine' as const },
  ];

  for (const testCase of cases) {
    const selected = setOperatorClass(createDefaultProfile(), testCase.operatorClass).profile;
    const onboardingProfile = { ...selected, runsCompleted: 0 };
    const onboarding = awardRecovery(onboardingProfile, telemetry, false, 0, {
      location: 'ice-mine',
      locationName: 'Ice Mine',
      operationTier: 1,
      maxRecoveryLevel: 12,
    });
    assert.ok(onboarding.loot.some(item => item.slot === testCase.weapon), `${testCase.operatorClass} onboarding should recover its owned weapon family.`);
    assert.ok(onboarding.loot.every(item => isItemClassCompatible(onboardingProfile, item)), `${testCase.operatorClass} onboarding should never produce an off-class weapon.`);

    const legacyVictory = awardVictory({ ...selected, runsCompleted: 4 }, telemetry);
    assert.ok(legacyVictory.loot.every(item => isItemClassCompatible(selected, item)), `${testCase.operatorClass} legacy victory recovery should respect class ownership.`);

    for (let run = 1; run <= 8; run += 1) {
      const profile = { ...selected, runsCompleted: run };
      const deep = run % 2 === 0;
      const recovery = awardRecovery(profile, telemetry, deep, 0, {
        deepTarget: 'Recovery Commander Sable Voss',
        location: 'spin-habitat',
        locationName: 'Spin Habitat',
        operationTier: 9,
        maxRecoveryLevel: 40,
        directiveTier: 9,
        threatBudget: 96,
        eliteProtocolCount: 3,
        environmentalComplications: 2,
        optionalObjectives: 1,
        actualDepth: deep,
      });
      assert.ok(recovery.loot.length > 0, `${testCase.operatorClass} recovery should still award equipment.`);
      assert.ok(recovery.loot.every(item => isItemClassCompatible(profile, item)), `${testCase.operatorClass} run ${run} produced an off-class weapon: ${recovery.loot.map(item => item.slot).join(', ')}`);
    }
  }
}
classOwnedRecoverySmoke();

function parallaxBaseClassCounterSmoke() {
  const classProfile = (operatorClass: 'vanguard' | 'vector' | 'systems') => ({
    ...createDefaultProfile(),
    xp: 7140,
    level: 15,
    operatorClass,
    classSelectionComplete: true,
    specialization: null,
    specializationOverclock: false,
  });

  const vanguardState = createSimulation(deriveCombatBuild(classProfile('vanguard')));
  for (const enemy of vanguardState.enemies) enemy.active = false;
  const runner = vanguardState.enemies[0];
  Object.assign(runner, {
    active: true,
    dead: false,
    role: 'assault' as const,
    variant: 'parallaxSkirmisher' as const,
    label: 'Parallax Shear Runner',
    x: vanguardState.player.x + 120,
    y: vanguardState.player.y,
    hazardCooldown: 0,
  });
  runner.statuses.disrupted = 0;
  runner.statuses.stagger = 0;
  vanguardState.player.aim = { x: 1, y: 0 };
  assert.equal(triggerAbility(vanguardState, 0), true, 'Vanguard should be able to Breach Rush a Parallax Shear Runner.');
  assert.ok(runner.hazardCooldown >= 5.8, 'Vanguard Breach Rush should delay the Shear Runner reference-wash counterstep.');
  assert.ok(runner.statuses.disrupted >= 2.2, 'Vanguard Breach Rush should disrupt the Shear Runner reference package.');
  assert.match(vanguardState.eventText, /VANGUARD INTERCEPT/, 'Vanguard counterplay should have explicit combat feedback.');

  const vectorState = createSimulation(deriveCombatBuild(classProfile('vector')));
  for (const enemy of vectorState.enemies) enemy.active = false;
  const marksman = vectorState.enemies[0];
  Object.assign(marksman, {
    active: true,
    dead: false,
    role: 'suppressor' as const,
    variant: 'baselineMarksman' as const,
    label: 'Long-Baseline Marksman',
    x: vectorState.player.x + 150,
    y: vectorState.player.y,
    telegraph: 0.9,
    fireCooldown: 0,
  });
  marksman.statuses.disrupted = 0;
  vectorState.player.aim = { x: 1, y: 0 };
  assert.equal(triggerAbility(vectorState, 1), true, 'Vector should be able to Deadeye Lock a Long-Baseline Marksman.');
  assert.equal(marksman.telegraph, 0, 'Vector Deadeye Lock should cancel the Long-Baseline firing solution.');
  assert.ok(marksman.fireCooldown >= 3.2, 'Vector counter-snipe should force the Marksman to reacquire the baseline.');
  assert.match(vectorState.eventText, /VECTOR COUNTER-SNIPE/, 'Vector counterplay should have explicit combat feedback.');

  const systemsState = createSimulation(deriveCombatBuild(classProfile('systems')));
  for (const enemy of systemsState.enemies) enemy.active = false;
  const technician = systemsState.enemies[0];
  Object.assign(technician, {
    active: true,
    dead: false,
    role: 'technician' as const,
    variant: 'referenceTech' as const,
    label: 'Reference Shear Technician',
    x: systemsState.player.x + 120,
    y: systemsState.player.y,
    hazardCooldown: 0,
  });
  technician.statuses.disrupted = 0;
  technician.statuses.conductive = 0;
  systemsState.player.aim = { x: 1, y: 0 };
  systemsState.player.abilityCooldowns[2] = 5;
  assert.equal(triggerAbility(systemsState, 1), true, 'Systems should be able to Relay Hack a Reference Shear Technician.');
  assert.ok(technician.hazardCooldown >= 8.4, 'Systems Relay Hack should delay the Technician reference-field projection.');
  assert.ok(technician.statuses.conductive >= 8, 'Systems Relay Hack should overload the Technician bus for Arc follow-up.');
  assert.ok(systemsState.player.abilityCooldowns[2] <= 2.2, 'Systems counterplay should pull Cascade Arc toward an immediate follow-up.');
  assert.match(systemsState.eventText, /SYSTEMS BASELINE SPOOF/, 'Systems counterplay should have explicit combat feedback.');
}
parallaxBaseClassCounterSmoke();

function parallaxSpecializationSmoke() {
  const pressureProfile = { ...createDefaultProfile(), xp: 8100, level: 16, operatorClass: 'vanguard' as const, classSelectionComplete: true, specialization: 'pressure-diver' as const, specializationOverclock: true };
  const pressureState = createSimulation(deriveCombatBuild(pressureProfile));
  const pressureShear = pressureState.hazards[0];
  Object.assign(pressureShear, { active: true, x: pressureState.player.x + 90, y: pressureState.player.y, radius: 210, life: 5, kind: 'vectorWash' as const, owner: 'enemy' as const });
  assert.equal(triggerAbility(pressureState, 0), true, 'Pressure Diver should be able to cast into a live Parallax shear field.');
  assert.equal(pressureState.hazards.some(hazard => hazard.active && hazard.owner !== 'player' && hazard.kind === 'vectorWash'), false, 'Pressure Diver should collapse the hostile Parallax shear field.');
  assert.ok(pressureState.hazards.some(hazard => hazard.active && hazard.kind === 'vacuumWake' && hazard.owner === 'player'), 'Pressure Diver should convert collapsed shear into a player-owned vacuum wake.');

  const momentumProfile = { ...createDefaultProfile(), xp: 8100, level: 16, operatorClass: 'vector' as const, classSelectionComplete: true, specialization: 'momentum-broker' as const, specializationOverclock: true };
  const momentumBaseline = createSimulation(deriveCombatBuild(momentumProfile));
  momentumBaseline.player.currentWeapon = 'rail';
  momentumBaseline.player.capacitor = 70;
  const baselineBefore = momentumBaseline.player.capacitor;
  assert.equal(triggerFire(momentumBaseline), true);
  const baselineReturn = momentumBaseline.player.capacitor - (baselineBefore - momentumBaseline.weapons.rail.capacitorCost);
  const momentumField = createSimulation(deriveCombatBuild(momentumProfile));
  momentumField.player.currentWeapon = 'rail';
  momentumField.player.capacitor = 70;
  Object.assign(momentumField.hazards[0], { active: true, x: momentumField.player.x + 80, y: momentumField.player.y, radius: 185, life: 5, kind: 'gravityWell' as const, owner: 'enemy' as const });
  const fieldBefore = momentumField.player.capacitor;
  assert.equal(triggerFire(momentumField), true);
  const fieldReturn = momentumField.player.capacitor - (fieldBefore - momentumField.weapons.rail.capacitorCost);
  assert.ok(fieldReturn > baselineReturn + 1.5, 'Momentum Broker should harvest extra recoil energy while fighting inside Parallax reference fields.');

  const gridProfile = { ...createDefaultProfile(), xp: 8100, level: 16, operatorClass: 'systems' as const, classSelectionComplete: true, specialization: 'grid-weaver' as const, specializationOverclock: true };
  const gridState = createSimulation(deriveCombatBuild(gridProfile));
  const conduit = gridState.objects.find(object => object.kind === 'conduit')!;
  conduit.active = true;
  conduit.exposed = true;
  conduit.x = gridState.player.x + 140;
  conduit.y = gridState.player.y - conduit.h / 2;
  Object.assign(gridState.hazards[0], { active: true, x: conduit.x + conduit.w / 2 + 40, y: conduit.y + conduit.h / 2, radius: 185, life: 5, kind: 'gravityWell' as const, owner: 'enemy' as const });
  assert.equal(triggerAbility(gridState, 2), true, 'Grid Weaver should route Cascade Arc through nearby machinery.');
  assert.equal(gridState.hazards[0].active, false, 'Grid Weaver machinery routing should collapse nearby Parallax reference shear.');

  const redlineProfile = { ...createDefaultProfile(), xp: 8100, level: 16, operatorClass: 'vector' as const, classSelectionComplete: true, specialization: 'redline-pilot' as const, specializationOverclock: true };
  const redlineState = createSimulation(deriveCombatBuild(redlineProfile));
  redlineState.player.currentWeapon = 'rail';
  redlineState.player.weaponHeat.rail = 0.82;
  Object.assign(redlineState.hazards[0], { active: true, x: redlineState.player.x + 70, y: redlineState.player.y, radius: 210, life: 5, kind: 'vectorWash' as const, owner: 'enemy' as const });
  assert.equal(triggerDodge(redlineState), true);
  assert.equal(redlineState.hazards[0].active, false, 'Redline Pilot overclock dodge should punch through nearby Parallax shear.');

  const conductorProfile = { ...createDefaultProfile(), xp: 8100, level: 16, operatorClass: 'systems' as const, classSelectionComplete: true, specialization: 'capacitor-conductor' as const, specializationOverclock: true };
  const conductorState = createSimulation(deriveCombatBuild(conductorProfile));
  Object.assign(conductorState.hazards[0], { active: true, x: conductorState.player.x + 85, y: conductorState.player.y, radius: 185, life: 5, kind: 'gravityWell' as const, owner: 'enemy' as const });
  assert.equal(triggerAbility(conductorState, 0), true);
  conductorState.player.abilityCooldowns = [0, 0, 0];
  assert.equal(triggerAbility(conductorState, 1), true);
  conductorState.player.abilityCooldowns = [0, 0, 0];
  assert.equal(triggerAbility(conductorState, 2), true);
  assert.equal(conductorState.hazards[0].active, false, 'Capacitor Conductor three-link sequence should short a nearby Parallax reference field.');
}
parallaxSpecializationSmoke();

function vectorSpecializationDepthSmoke() {
  const baseProfile = {
    ...createDefaultProfile(),
    xp: 8100,
    level: 16,
    operatorClass: 'vector' as const,
    classSelectionComplete: true,
    specializationOverclock: true,
  };

  const momentumState = createSimulation(deriveCombatBuild({ ...baseProfile, specialization: 'momentum-broker' as const }));
  for (const enemy of momentumState.enemies) enemy.active = false;
  momentumState.player.currentWeapon = 'rail';
  momentumState.player.capacitor = 70;
  momentumState.player.abilityCooldowns[0] = 3;
  momentumState.player.dodgeCooldown = 1;
  momentumState.classState.vectorWindow = 1;
  assert.equal(triggerFire(momentumState), true, 'Momentum Broker should be able to spend a primed Slipstream shot.');
  assert.ok(momentumState.player.abilityCooldowns[0] < 3, 'Momentum Broker Slipstream should recycle Vector Shift recovery from banked recoil.');
  assert.ok(momentumState.player.dodgeCooldown < 1, 'Momentum Broker Slipstream should recycle dodge recovery from banked recoil.');
  assert.match(momentumState.eventText, /MOMENTUM DIVIDEND/, 'Momentum Broker should expose its recoil-recovery loop in combat feedback.');

  const surveyState = createSimulation(deriveCombatBuild({ ...baseProfile, specialization: 'survey-deadeye' as const }));
  for (const enemy of surveyState.enemies) enemy.active = false;
  const surveyTarget = surveyState.enemies[0];
  Object.assign(surveyTarget, {
    active: true,
    dead: false,
    x: surveyState.player.x + 130,
    y: surveyState.player.y,
    hp: 500,
    maxHp: 500,
    armor: 180,
    maxArmor: 180,
    telegraph: 1,
  });
  surveyTarget.statuses.marked = 4;
  surveyTarget.statuses.stagger = 4;
  surveyState.player.currentWeapon = 'rail';
  surveyState.player.aim = { x: 1, y: 0 };
  surveyState.player.abilityCooldowns[1] = 5;
  surveyState.classState.vectorWindow = 0;
  assert.equal(triggerFire(surveyState), true, 'Survey Deadeye should be able to cash a marked rail firing solution.');
  for (let tick = 0; tick < 20; tick += 1) stepSimulation(surveyState, 0.01);
  assert.equal(surveyTarget.statuses.marked, 0, 'Survey Deadeye precision rail hit should consume the mark.');
  assert.equal(surveyTarget.telegraph, 0, 'Survey Deadeye precision rail hit should break a committed attack.');
  assert.ok(surveyTarget.statuses.armorBreach > 0, 'Survey Deadeye precision rail hit should open Armor Breach.');
  assert.ok(surveyState.classState.vectorWindow > 1, 'Survey Deadeye precision trace should re-prime a meaningful Slipstream follow-through window.');
  assert.ok(surveyState.player.abilityCooldowns[1] < 2, 'Survey Deadeye overclock should pull Deadeye Lock toward the 1.6 second recovery target.');
  assert.match(surveyState.eventText, /SURVEY FOLLOWTHROUGH/, 'Survey Deadeye should expose the follow-through loop in combat feedback.');

  const neutralState = createSimulation(deriveCombatBuild({ ...baseProfile, specialization: null, specializationOverclock: false }));
  const redlineState = createSimulation(deriveCombatBuild({ ...baseProfile, specialization: 'redline-pilot' as const }));
  for (const state of [neutralState, redlineState]) {
    for (const enemy of state.enemies) enemy.active = false;
    state.player.currentWeapon = 'rail';
    state.player.weaponHeat.rail = 0.8;
    state.player.dodgeCooldown = 0.8;
    state.classState.vectorWindow = 1;
  }
  assert.equal(triggerFire(neutralState), true);
  assert.equal(triggerFire(redlineState), true, 'Redline Pilot should be able to discharge a hot Slipstream shot.');
  const neutralRail = neutralState.projectiles.find(projectile => projectile.active && projectile.owner === 'player' && projectile.weapon === 'rail')!;
  const redlineRail = redlineState.projectiles.find(projectile => projectile.active && projectile.owner === 'player' && projectile.weapon === 'rail')!;
  assert.ok(redlineRail.damage > neutralRail.damage * 1.1, 'Redline Pilot hot Slipstream should gain a material damage bonus.');
  assert.ok(Math.hypot(redlineRail.vx, redlineRail.vy) > Math.hypot(neutralRail.vx, neutralRail.vy) * 1.07, 'Redline Pilot hot Slipstream should gain projectile velocity.');
  assert.ok(redlineRail.penetration >= neutralRail.penetration + 12, 'Redline Pilot hot Slipstream should gain the authored penetration bonus.');
  assert.ok(redlineState.player.dodgeCooldown < 0.8, 'Redline Pilot overclock hot Slipstream should recycle dodge recovery.');
  assert.match(redlineState.eventText, /REDLINE VECTOR/, 'Redline Pilot should expose the hot-Slipstream loop in combat feedback.');
}
vectorSpecializationDepthSmoke();

function vectorSkillEvolutionSmoke() {
  const level15 = {
    ...createDefaultProfile(),
    xp: 7140,
    level: 15,
    operatorClass: 'vector' as const,
    classSelectionComplete: true,
    specialization: null,
    specializationOverclock: false,
  };
  const level16 = { ...level15, xp: 8100, level: 16 };

  const locked = setAbilityMod(level15, 'mag', 'vector-slingshot-shift');
  assert.equal(locked.abilityMods.mag, null, 'Vector skill evolutions should remain locked before LV16.');

  const slingshotProfile = setAbilityMod(level16, 'mag', 'vector-slingshot-shift');
  const slingshotBuild = deriveCombatBuild(slingshotProfile);
  assert.equal(slingshotBuild.mechanics.vectorSlingshotShift, true);
  assert.ok(slingshotBuild.abilities[0].costMul > 1, 'Slingshot Shift should pay its capacitor tradeoff.');
  const slingshotState = createSimulation(slingshotBuild);
  for (const enemy of slingshotState.enemies) enemy.active = false;
  slingshotState.player.aim = { x: 1, y: 0 };
  slingshotState.player.dodgeCooldown = 1;
  assert.equal(triggerAbility(slingshotState, 0), true, 'Slingshot Shift should cast through the Vector first-skill slot.');
  assert.ok(slingshotState.player.vx > 700, 'Slingshot Shift should produce a materially longer Vector Shift impulse.');
  assert.ok(slingshotState.classState.vectorWindow >= 2.6, 'Slingshot Shift should bank an extended Slipstream window.');
  assert.ok(slingshotState.player.dodgeCooldown < 1, 'Slingshot Shift should pull dodge recovery forward.');
  assert.match(slingshotState.eventText, /SLINGSHOT SHIFT/, 'Slingshot Shift needs explicit combat feedback.');

  const triangulationProfile = setAbilityMod(level16, 'mark', 'vector-triangulation-lock');
  const triangulationBuild = deriveCombatBuild(triangulationProfile);
  assert.equal(triangulationBuild.mechanics.vectorTriangulationLock, true);
  assert.ok(triangulationBuild.abilities[1].cooldownMul > 1, 'Triangulation Lock should pay its cooldown tradeoff.');
  const triangulationState = createSimulation(triangulationBuild);
  for (const enemy of triangulationState.enemies) enemy.active = false;
  const lockTarget = triangulationState.enemies[0];
  Object.assign(lockTarget, {
    active: true,
    dead: false,
    variant: 'standard' as const,
    role: 'assault' as const,
    combatClass: 'standard' as const,
    x: triangulationState.player.x + 360,
    y: triangulationState.player.y,
  });
  lockTarget.statuses.armorBreach = 0;
  triangulationState.player.aim = { x: 1, y: 0 };
  triangulationState.player.abilityCooldowns[2] = 5;
  assert.equal(triggerAbility(triangulationState, 1), true, 'Triangulation Lock should cast through the Vector second-skill slot.');
  assert.ok(lockTarget.statuses.armorBreach >= 2.7, 'Triangulation Lock should open a short Armor Breach firing window.');
  assert.ok(triangulationState.player.abilityCooldowns[2] <= 3.8, 'Triangulation Lock should advance Splitshot recovery.');
  assert.match(triangulationState.eventText, /TRIANGULATION LOCK/, 'Triangulation Lock needs explicit combat feedback.');

  const needleProfile = setAbilityMod(level16, 'arc', 'vector-needle-fan');
  const needleBuild = deriveCombatBuild(needleProfile);
  assert.equal(needleBuild.mechanics.vectorNeedleFan, true);
  assert.ok(needleBuild.abilities[2].cooldownMul > 1, 'Needle Fan should pay its Splitshot cooldown tradeoff.');
  const needleState = createSimulation(needleBuild);
  for (const enemy of needleState.enemies) enemy.active = false;
  needleState.player.aim = { x: 1, y: 0 };
  assert.equal(triggerAbility(needleState, 2), true, 'Needle Fan should cast through the Vector third-skill slot.');
  const needleShots = needleState.projectiles.filter(projectile => projectile.active && projectile.owner === 'player' && projectile.weapon === 'rail');
  assert.equal(needleShots.length, 3, 'Needle Fan should preserve the three-lane Splitshot identity.');
  assert.ok(needleShots.every(projectile => Math.hypot(projectile.vx, projectile.vy) >= 1699), 'Needle Fan should convert all three lanes to hypervelocity rounds.');
  assert.ok(needleShots.every(projectile => projectile.penetration >= 88), 'Needle Fan should add the authored penetration bonus.');
  assert.ok(Math.max(...needleShots.map(projectile => projectile.damage)) > Math.min(...needleShots.map(projectile => projectile.damage)) * 1.25, 'Needle Fan centerline should carry a meaningful precision damage premium.');
  const fanAngles = needleShots.map(projectile => Math.atan2(projectile.vy, projectile.vx));
  assert.ok(Math.max(...fanAngles) - Math.min(...fanAngles) < 0.16, 'Needle Fan should compress Splitshot into a tighter firing fan.');
  assert.match(needleState.eventText, /NEEDLE FAN/, 'Needle Fan needs explicit combat feedback.');

  const switched = setOperatorClass(slingshotProfile, 'vanguard').profile;
  assert.equal(switched.abilityMods.mag, null, 'Switching class should clear an incompatible Vector evolution.');
  const genericLens = setAbilityMod(level16, 'mark', 'mark-wideband');
  const genericSwitched = setOperatorClass(genericLens, 'vanguard').profile;
  assert.equal(genericSwitched.abilityMods.mark, 'mark-wideband', 'Switching class should preserve shared Skill Lenses after Vector evolution support.');
}
vectorSkillEvolutionSmoke();

function sameClassBuildDiversitySmoke() {
  const level16 = {
    ...createDefaultProfile(),
    xp: 8100,
    level: 16,
    operatorClass: 'vector' as const,
    classSelectionComplete: true,
    specializationOverclock: true,
  };

  const momentumProfile = setAbilityMod({ ...level16, specialization: 'momentum-broker' as const }, 'mag', 'vector-slingshot-shift');
  const surveyProfile = setAbilityMod({ ...level16, specialization: 'survey-deadeye' as const }, 'mark', 'vector-triangulation-lock');
  const redlineProfile = setAbilityMod({ ...level16, specialization: 'redline-pilot' as const }, 'arc', 'vector-needle-fan');

  assert.equal(vectorCapstoneInteractionFor(momentumProfile, momentumProfile.abilityMods.mag)?.name, 'Inertial Dividend');
  assert.equal(vectorCapstoneInteractionFor(surveyProfile, surveyProfile.abilityMods.mark)?.name, 'Reference Solution');
  assert.equal(vectorCapstoneInteractionFor(redlineProfile, redlineProfile.abilityMods.arc)?.name, 'Redline Needle');

  const identities = [buildIdentity(momentumProfile), buildIdentity(surveyProfile), buildIdentity(redlineProfile)];
  assert.equal(new Set(identities).size, 3, 'LV16 Vector branches should expose distinct same-class build identities.');
  assert.match(identities[0], /INERTIAL DIVIDEND/i);
  assert.match(identities[1], /REFERENCE SOLUTION/i);
  assert.match(identities[2], /REDLINE NEEDLE/i);

  const momentumState = createSimulation(deriveCombatBuild(momentumProfile));
  for (const enemy of momentumState.enemies) enemy.active = false;
  momentumState.player.aim = { x: 1, y: 0 };
  momentumState.player.currentWeapon = 'rail';
  momentumState.player.dodgeCooldown = 1.2;
  momentumState.player.capacitor = Math.max(0, momentumState.player.maxCapacitor - 20);
  assert.equal(triggerAbility(momentumState, 0), true);
  const momentumShiftCooldown = momentumState.player.abilityCooldowns[0];
  const momentumDodgeCooldown = momentumState.player.dodgeCooldown;
  const momentumCapBeforeShot = momentumState.player.capacitor;
  const momentumRailCost = momentumState.weapons.rail.capacitorCost;
  assert.equal(triggerFire(momentumState), true);
  assert.ok(momentumState.player.abilityCooldowns[0] < momentumShiftCooldown, 'Inertial Dividend should deepen Vector Shift recovery after spending Slingshot Slipstream.');
  assert.ok(momentumState.player.dodgeCooldown < momentumDodgeCooldown, 'Inertial Dividend should deepen dodge recovery after the recoil route resolves.');
  assert.ok(momentumState.player.capacitor > momentumCapBeforeShot - momentumRailCost, 'Inertial Dividend should return capacitor beyond the Rail Lance shot cost.');
  assert.match(momentumState.eventText, /INERTIAL DIVIDEND/, 'Momentum Broker + Slingshot Shift needs its own capstone feedback.');
  assert.ok(momentumState.effects.some(effect => effect.active && effect.kind === 'vector'), 'Inertial Dividend should emit the Vector capstone world cue.');

  const surveyState = createSimulation(deriveCombatBuild(surveyProfile));
  for (const enemy of surveyState.enemies) enemy.active = false;
  const surveyTarget = surveyState.enemies[0];
  Object.assign(surveyTarget, {
    active: true,
    dead: false,
    variant: 'standard' as const,
    role: 'assault' as const,
    combatClass: 'standard' as const,
    x: surveyState.player.x + 360,
    y: surveyState.player.y,
  });
  surveyTarget.statuses.armorBreach = 0;
  surveyState.player.aim = { x: 1, y: 0 };
  surveyState.player.weaponHeat.rail = 0.22;
  surveyState.player.abilityCooldowns[2] = 5;
  assert.equal(triggerAbility(surveyState, 1), true);
  assert.ok(surveyTarget.statuses.armorBreach >= 4.4, 'Reference Solution should deepen the Triangulation armor-breach window.');
  assert.ok(surveyState.classState.vectorWindow >= 3.15, 'Reference Solution should hold a longer surveyed Slipstream firing solution.');
  assert.ok(surveyState.player.abilityCooldowns[2] <= 3.2, 'Reference Solution should recycle Splitshot more aggressively than base Triangulation Lock.');
  assert.match(surveyState.eventText, /REFERENCE SOLUTION/, 'Survey Deadeye + Triangulation Lock needs its own capstone feedback.');
  surveyState.player.currentWeapon = 'rail';
  surveyState.player.capacitor = surveyState.player.maxCapacitor;
  surveyState.player.abilityCooldowns[2] = 4;
  assert.equal(triggerFire(surveyState), true);
  const referenceShot = surveyState.projectiles.find(projectile => projectile.active && projectile.owner === 'player' && projectile.weapon === 'rail')!;
  assert.ok(referenceShot.penetration >= 165, 'Reference Solution should add meaningful precision penetration to the marked Slipstream shot.');
  assert.ok(surveyState.player.abilityCooldowns[2] < 4, 'Reference Solution should recycle Splitshot when the marked firing solution is committed.');
  assert.match(surveyState.eventText, /REFERENCE SOLUTION/, 'Reference Solution should remain readable when the precision shot is spent.');
  assert.ok(surveyState.effects.some(effect => effect.active && effect.kind === 'vector'), 'Reference Solution should emit the Vector capstone world cue.');

  const redlineState = createSimulation(deriveCombatBuild(redlineProfile));
  for (const enemy of redlineState.enemies) enemy.active = false;
  redlineState.player.aim = { x: 1, y: 0 };
  redlineState.player.currentWeapon = 'rail';
  redlineState.player.weaponHeat.rail = 0.82;
  redlineState.player.dodgeCooldown = 1;
  assert.equal(triggerAbility(redlineState, 2), true);
  const redlineFan = redlineState.projectiles.filter(projectile => projectile.active && projectile.owner === 'player' && projectile.weapon === 'rail');
  assert.equal(redlineFan.length, 3, 'Redline Needle should retain the authored three-lane Vector fan.');
  assert.ok(redlineFan.every(projectile => Math.hypot(projectile.vx, projectile.vy) >= 1849), 'Redline Needle should push all three lanes beyond standard Needle Fan velocity.');
  assert.ok(redlineFan.every(projectile => projectile.penetration >= 102), 'Redline Needle should add the hot-bus penetration premium.');
  assert.ok(redlineState.player.weaponHeat.rail <= 0.66, 'Redline Needle overclock should vent the active hot class weapon bus.');
  assert.ok(redlineState.player.dodgeCooldown <= 0.62, 'Redline Needle overclock should pull dodge recovery forward.');
  assert.match(redlineState.eventText, /REDLINE NEEDLE/, 'Redline Pilot + Needle Fan needs its own capstone feedback.');
  assert.ok(redlineState.effects.some(effect => effect.active && effect.kind === 'vector'), 'Redline Needle should emit the Vector capstone world cue.');
}
sameClassBuildDiversitySmoke();

function specializationGearSynergySmoke() {
  const cases = [
    { specialization: 'pressure-diver', operatorClass: 'vanguard', slot: 'suit', fixtureAffix: 'servoWeave', name: 'Pressure Recirculator' },
    { specialization: 'breach-vanguard', operatorClass: 'vanguard', slot: 'breacher', fixtureAffix: 'countermass', name: 'Breach Stack' },
    { specialization: 'bulkhead-warden', operatorClass: 'vanguard', slot: 'breacher', fixtureAffix: 'tungsten', name: 'Counterfort Bracing' },
    { specialization: 'momentum-broker', operatorClass: 'vector', slot: 'suit', fixtureAffix: 'servoWeave', name: 'Reaction Ledger' },
    { specialization: 'survey-deadeye', operatorClass: 'vector', slot: 'rail', fixtureAffix: 'countermass', name: 'Survey Ballistics' },
    { specialization: 'redline-pilot', operatorClass: 'vector', slot: 'suit', fixtureAffix: 'servoWeave', name: 'Thermal Slip' },
    { specialization: 'grid-weaver', operatorClass: 'systems', slot: 'implant', fixtureAffix: 'markShear', name: 'Mesh Orchestra' },
    { specialization: 'capacitor-conductor', operatorClass: 'systems', slot: 'rig', fixtureAffix: 'cryoloop', name: 'Bus Harmonics' },
    { specialization: 'thermal-shunter', operatorClass: 'systems', slot: 'rig', fixtureAffix: 'cryoloop', name: 'Heat Exchange' },
  ] as const;
  assert.equal(specializationGearSynergyDefinitions.length, 9, 'Every class specialization should have one authored gear link.');
  const classWeaponSlots = { vanguard: 'breacher', vector: 'rail', systems: 'carbine' } as const;
  const supportSlots = new Set(['suit', 'rig', 'implant']);

  const activeProfiles = new Map<string, ReturnType<typeof createDefaultProfile>>();
  for (const entry of cases) {
    const definition = specializationGearSynergyDefinitions.find(item => item.specialization === entry.specialization)!;
    assert.ok(definition.preferredTags.length >= 3, `${entry.name} should advertise a meaningful build-tag cluster.`);
    assert.ok(definition.minimumTagMatches >= 2 && definition.minimumTagMatches < definition.preferredTags.length, `${entry.name} should use a partial tag threshold instead of an all-or-nothing exact requirement.`);
    assert.equal(definition.exoticAffix, undefined, `${entry.name} should not retain a hard exact-affix gate without an exotic interaction.`);

    const validSlots = new Set([classWeaponSlots[entry.operatorClass], ...supportSlots]);
    const realRoutes = new Set<string>();
    for (const baseDefinition of gearBaseDefinitions.filter(base => validSlots.has(base.slot))) {
      const baseTags = new Set(baseDefinition.buildTags);
      const baseMatches = definition.preferredTags.filter(tag => baseTags.has(tag)).length;
      if (baseMatches >= definition.minimumTagMatches) realRoutes.add(baseDefinition.id);
      for (const affixId of baseDefinition.allowedAffixGroups) {
        const routeTags = new Set([...baseDefinition.buildTags, ...gearAffixDefinition(affixId).buildTags]);
        const routeMatches = definition.preferredTags.filter(tag => routeTags.has(tag)).length;
        if (routeMatches >= definition.minimumTagMatches) realRoutes.add(`${baseDefinition.id}+${affixId}`);
      }
    }
    assert.ok(realRoutes.size >= 2, `${entry.name} should have at least two class-equippable base/affix routes; found ${[...realRoutes].join(', ') || 'none'}.`);

    const base = normalizeClassArmament({
      ...createDefaultProfile(),
      xp: 8100,
      level: 16,
      operatorClass: entry.operatorClass,
      classSelectionComplete: true,
      specialization: entry.specialization,
      specializationOverclock: true,
    });
    const equippedIds = new Set(Object.values(base.equipped).filter((id): id is string => !!id));
    const neutral = {
      ...base,
      inventory: base.inventory.map(item => equippedIds.has(item.id)
        ? { ...item, baseId: `neutral-${item.slot}`, frameIdentity: undefined, faction: undefined, modifiers: [] }
        : item),
    };
    const unlinked = specializationGearSynergyForProfile(neutral);
    assert.equal(unlinked?.active, false, `${entry.name} must not activate from specialization and resonance without a matching tag route.`);
    assert.ok((unlinked?.resonanceTier ?? 0) >= 1, `${entry.name} fixture should already satisfy Tier I class resonance.`);

    const sourceId = neutral.equipped[entry.slot]!;
    const source = neutral.inventory.find(item => item.id === sourceId)!;
    const linkedId = `p8-5-g-${entry.specialization}-${entry.slot}`;
    const semanticOnlyModifier = {
      ...materializeModifier(entry.fixtureAffix, 3),
      buildTags: [...definition.preferredTags],
    };
    const linked = { ...source, id: linkedId, rarity: 'Refined' as const, modifiers: [...source.modifiers, semanticOnlyModifier] };
    const profile = {
      ...neutral,
      inventory: neutral.inventory.map(item => item.id === source.id ? linked : item),
      equipped: { ...neutral.equipped, [entry.slot]: linkedId },
    };
    const state = specializationGearSynergyForProfile(profile);
    assert.equal(state?.active, true, `${entry.name} should activate from Tier I class resonance plus its tag threshold.`);
    assert.equal(state?.definition.name, entry.name);
    assert.ok(state?.matchingItemIds.includes(linkedId), `${entry.name} should report the equipped tag-matched frame.`);

    for (const rarity of ['Refined', 'Prototype', 'Singular'] as const) {
      const rarityProfile = {
        ...profile,
        inventory: profile.inventory.map(item => item.id === linkedId ? { ...item, rarity } : item),
      };
      assert.equal(specializationGearSynergyForProfile(rarityProfile)?.active, true, `${entry.name} should remain viable on ${rarity} gear when the same semantic tags are present.`);
    }
    activeProfiles.set(entry.specialization, profile);
  }

  const breachBase = normalizeClassArmament({ ...createDefaultProfile(), xp: 8100, level: 16, operatorClass: 'vanguard' as const, classSelectionComplete: true, specialization: 'breach-vanguard' as const, specializationOverclock: true });
  const breachEquipped = new Set(Object.values(breachBase.equipped).filter((id): id is string => !!id));
  const breachBaselineProfile = { ...breachBase, inventory: breachBase.inventory.map(item => breachEquipped.has(item.id) ? { ...item, baseId: `neutral-${item.slot}`, frameIdentity: undefined, faction: undefined, modifiers: [] } : item) };
  const breachBaseline = deriveCombatBuild(breachBaselineProfile);
  const breachLinked = deriveCombatBuild(activeProfiles.get('breach-vanguard')!);
  assert.ok(breachLinked.weapon.breacher.armorDamageMul > breachBaseline.weapon.breacher.armorDamageMul, 'Breach Stack should deepen Breacher armor pressure.');
  assert.ok(breachLinked.weapon.breacher.penetrationAdd >= breachBaseline.weapon.breacher.penetrationAdd + 8, 'Breach Stack should add the authored penetration bonus.');

  const momentumBase = normalizeClassArmament({ ...createDefaultProfile(), xp: 8100, level: 16, operatorClass: 'vector' as const, classSelectionComplete: true, specialization: 'momentum-broker' as const, specializationOverclock: true });
  const momentumEquipped = new Set(Object.values(momentumBase.equipped).filter((id): id is string => !!id));
  const momentumBaselineProfile = { ...momentumBase, inventory: momentumBase.inventory.map(item => momentumEquipped.has(item.id) ? { ...item, baseId: `neutral-${item.slot}`, frameIdentity: undefined, faction: undefined, modifiers: [] } : item) };
  const momentumBaseline = deriveCombatBuild(momentumBaselineProfile);
  const momentumLinked = deriveCombatBuild(activeProfiles.get('momentum-broker')!);
  assert.ok(momentumLinked.player.maxCapAdd >= momentumBaseline.player.maxCapAdd + 6, 'Reaction Ledger should expand the capacitor bank.');
  assert.ok(momentumLinked.player.capRegenMul > momentumBaseline.player.capRegenMul, 'Reaction Ledger should improve capacitor recovery.');
  assert.ok(momentumLinked.abilities[0].cooldownMul < momentumBaseline.abilities[0].cooldownMul, 'Reaction Ledger should accelerate Vector Shift recovery.');
  assert.match(buildIdentity(activeProfiles.get('momentum-broker')!), /REACTION LEDGER/i, 'Active specialization gear links should surface in build identity.');

  const conductorBase = normalizeClassArmament({ ...createDefaultProfile(), xp: 8100, level: 16, operatorClass: 'systems' as const, classSelectionComplete: true, specialization: 'capacitor-conductor' as const, specializationOverclock: true });
  const conductorEquipped = new Set(Object.values(conductorBase.equipped).filter((id): id is string => !!id));
  const conductorBaselineProfile = { ...conductorBase, inventory: conductorBase.inventory.map(item => conductorEquipped.has(item.id) ? { ...item, baseId: `neutral-${item.slot}`, frameIdentity: undefined, faction: undefined, modifiers: [] } : item) };
  const conductorBaseline = deriveCombatBuild(conductorBaselineProfile);
  const conductorLinked = deriveCombatBuild(activeProfiles.get('capacitor-conductor')!);
  assert.ok(conductorLinked.player.maxCapAdd >= conductorBaseline.player.maxCapAdd + 8, 'Bus Harmonics should expand the Systems capacitor bank.');
  assert.ok(conductorLinked.abilities.every((ability, index) => ability.costMul < conductorBaseline.abilities[index].costMul), 'Bus Harmonics should reduce all class-skill capacitor costs.');
}
specializationGearSynergySmoke();

const capstoneRendererSource = readFileSync('src/game/threeCombatRenderer.ts', 'utf8');
assert.match(capstoneRendererSource, /effect\.kind === 'vanguard'[\s\S]*0xbd8a64/, 'Vanguard capstone feedback should retain its authored warm class color.');
assert.match(capstoneRendererSource, /effect\.kind === 'vector'[\s\S]*0x74a6c7/, 'Vector capstone feedback should retain its authored blue class color.');
assert.match(capstoneRendererSource, /effect\.kind === 'systems'[\s\S]*0x9b87bd/, 'Systems capstone feedback should retain its authored violet class color.');
assert.match(capstoneRendererSource, /dataset\.capstoneFx = lastCapstoneFx \|\| 'idle'/, 'Renderer QA telemetry should expose the active class capstone effect.');
assert.match(capstoneRendererSource, /class-capstones/, 'Combat VFX telemetry should advertise class-capstone feedback support.');

function systemsSkillEvolutionSmoke() {
  const level15 = {
    ...createDefaultProfile(),
    xp: 7140,
    level: 15,
    operatorClass: 'systems' as const,
    classSelectionComplete: true,
    specialization: null,
    specializationOverclock: false,
  };
  const level16 = { ...level15, xp: 8100, level: 16 };

  const locked = setAbilityMod(level15, 'mag', 'systems-anchor-lattice');
  assert.equal(locked.abilityMods.mag, null, 'Systems skill evolutions should remain locked before LV16.');

  const anchorProfile = setAbilityMod(level16, 'mag', 'systems-anchor-lattice');
  const anchorBuild = deriveCombatBuild(anchorProfile);
  assert.equal(anchorBuild.mechanics.systemsAnchorLattice, true);
  assert.ok(anchorBuild.abilities[0].cooldownMul > 1, 'Anchor Lattice should pay its Polarity Well cooldown tradeoff.');
  const anchorState = createSimulation(anchorBuild);
  for (const enemy of anchorState.enemies) enemy.active = false;
  for (const [index, enemy] of anchorState.enemies.slice(0, 2).entries()) {
    Object.assign(enemy, {
      active: true,
      dead: false,
      variant: 'standard' as const,
      role: 'assault' as const,
      combatClass: 'standard' as const,
      x: anchorState.player.x + 150 + index * 80,
      y: anchorState.player.y + (index === 0 ? -20 : 24),
    });
    enemy.statuses.conductive = 0;
  }
  anchorState.player.aim = { x: 1, y: 0 };
  anchorState.player.abilityCooldowns[1] = 5;
  assert.equal(triggerAbility(anchorState, 0), true, 'Anchor Lattice should cast through the Systems first-skill slot.');
  assert.ok(anchorState.enemies.slice(0, 2).every(enemy => enemy.statuses.conductive >= 4.7), 'Anchor Lattice should latch collapsed targets into a conductive cluster.');
  assert.ok(anchorState.player.abilityCooldowns[1] <= 4.3, 'Anchor Lattice should recycle Relay Hack recovery for caught nodes.');
  assert.match(anchorState.eventText, /ANCHOR LATTICE/, 'Anchor Lattice needs explicit combat feedback.');

  const recursiveProfile = setAbilityMod(level16, 'mark', 'systems-recursive-intrusion');
  const recursiveBuild = deriveCombatBuild(recursiveProfile);
  assert.equal(recursiveBuild.mechanics.systemsRecursiveIntrusion, true);
  assert.ok(recursiveBuild.abilities[1].costMul > 1, 'Recursive Intrusion should pay its Relay Hack capacitor tradeoff.');
  const recursiveState = createSimulation(recursiveBuild);
  for (const enemy of recursiveState.enemies) enemy.active = false;
  for (const [index, enemy] of recursiveState.enemies.slice(0, 4).entries()) {
    Object.assign(enemy, {
      active: true,
      dead: false,
      variant: 'standard' as const,
      role: 'assault' as const,
      combatClass: 'standard' as const,
      x: recursiveState.player.x + 220 + index * 70,
      y: recursiveState.player.y + (index % 2 === 0 ? -24 : 24),
    });
    enemy.statuses.marked = 0;
    enemy.statuses.disrupted = 0;
    enemy.statuses.conductive = 0;
  }
  recursiveState.player.aim = { x: 1, y: 0 };
  recursiveState.player.abilityCooldowns[2] = 5;
  assert.equal(triggerAbility(recursiveState, 1), true, 'Recursive Intrusion should cast through the Systems second-skill slot.');
  const recursiveRelays = recursiveState.enemies.filter(enemy => enemy.active && enemy.statuses.conductive >= 4.7);
  assert.ok(recursiveRelays.length >= 3, 'Recursive Intrusion should add an extra conductive relay beyond the base Relay Hack spread.');
  assert.ok(recursiveState.player.abilityCooldowns[2] <= 3.65, 'Recursive Intrusion should recycle Cascade Arc recovery from the propagated intrusion.');
  assert.match(recursiveState.eventText, /RECURSIVE INTRUSION/, 'Recursive Intrusion needs explicit combat feedback.');

  const returnProfile = setAbilityMod(level16, 'arc', 'systems-return-current');
  const returnBuild = deriveCombatBuild(returnProfile);
  assert.equal(returnBuild.mechanics.systemsReturnCurrent, true);
  assert.ok(returnBuild.abilities[2].cooldownMul > 1, 'Return Current should pay its Cascade Arc cooldown tradeoff.');
  const returnState = createSimulation(returnBuild);
  for (const enemy of returnState.enemies) enemy.active = false;
  for (const object of returnState.objects) if (object.kind === 'conduit' || object.kind === 'anchorNode') object.active = false;
  for (const [index, enemy] of returnState.enemies.slice(0, 2).entries()) {
    Object.assign(enemy, {
      active: true,
      dead: false,
      variant: 'standard' as const,
      role: 'assault' as const,
      combatClass: 'standard' as const,
      x: returnState.player.x + 230 + index * 80,
      y: returnState.player.y + (index === 0 ? 0 : 18),
    });
    enemy.statuses.marked = index === 0 ? 3 : 0;
    enemy.statuses.conductive = 0;
  }
  returnState.player.aim = { x: 1, y: 0 };
  returnState.player.capacitor = 40;
  returnState.player.abilityCooldowns[0] = 4;
  assert.equal(triggerAbility(returnState, 2), true, 'Return Current should cast through the Systems third-skill slot.');
  assert.ok(returnState.player.capacitor >= 20, 'Return Current should return capacitor from the live Cascade Arc network.');
  assert.ok(returnState.player.abilityCooldowns[0] <= 3.3, 'Return Current should recycle Polarity Well recovery from network contacts.');
  assert.match(returnState.eventText, /RETURN CURRENT/, 'Return Current needs explicit combat feedback.');

  const switched = setOperatorClass(anchorProfile, 'vector').profile;
  assert.equal(switched.abilityMods.mag, null, 'Switching class should clear an incompatible Systems evolution.');
  const genericLens = setAbilityMod(level16, 'arc', 'arc-ground');
  const genericSwitched = setOperatorClass(genericLens, 'vector').profile;
  assert.equal(genericSwitched.abilityMods.arc, 'arc-ground', 'Switching class should preserve shared Skill Lenses after Systems evolution support.');
}
systemsSkillEvolutionSmoke();

function systemsCapstoneInteractionSmoke() {
  const baseProfile = {
    ...createDefaultProfile(),
    xp: 8100,
    level: 16,
    operatorClass: 'systems' as const,
    classSelectionComplete: true,
    specializationOverclock: true,
  };

  const inductionProfile = setAbilityMod({ ...baseProfile, specialization: 'thermal-shunter' as const }, 'mag', 'systems-anchor-lattice');
  assert.equal(systemsCapstoneInteractionFor(inductionProfile, inductionProfile.abilityMods.mag)?.name, 'Induction Sink');
  const inductionState = createSimulation(deriveCombatBuild(inductionProfile));
  for (const enemy of inductionState.enemies) enemy.active = false;
  for (const [index, enemy] of inductionState.enemies.slice(0, 2).entries()) {
    Object.assign(enemy, {
      active: true,
      dead: false,
      variant: 'standard' as const,
      role: 'assault' as const,
      combatClass: 'standard' as const,
      x: inductionState.player.x + 150 + index * 80,
      y: inductionState.player.y + (index === 0 ? -18 : 22),
    });
  }
  inductionState.player.currentWeapon = 'carbine';
  inductionState.player.weaponHeat.carbine = 0.62;
  inductionState.player.aim = { x: 1, y: 0 };
  assert.equal(triggerAbility(inductionState, 0), true, 'Induction Sink should arm from a hot Anchor Lattice cast.');
  assert.ok(inductionState.classState.systemsCrossfeed >= 3.9, 'Induction Sink should create the extended overcharged crossfire bank.');
  assert.ok(inductionState.player.weaponHeat.carbine <= 0.48, 'Induction Sink should route additional heat for multiple lattice contacts.');
  assert.match(inductionState.eventText, /INDUCTION SINK/, 'Induction Sink needs explicit arming feedback.');
  inductionState.player.capacitor = 40;
  const inductionCooldownBefore = inductionState.player.abilityCooldowns[0];
  assert.equal(triggerFire(inductionState), true, 'Induction Sink should discharge through the next weapon shot.');
  const inductionShot = inductionState.projectiles.find(projectile => projectile.active && projectile.owner === 'player' && projectile.weapon === 'carbine');
  assert.ok(inductionShot, 'Induction Sink should produce the expected weapon projectile.');
  assert.ok(Math.hypot(inductionShot.vx, inductionShot.vy) >= inductionState.weapons.carbine.projectileSpeed * 1.19, 'Induction Sink should exceed normal Thermal Crossfire projectile velocity.');
  assert.ok(inductionShot.damage >= inductionState.weapons.carbine.damage * 1.18, 'Induction Sink should materially deepen the crossfed shot damage.');
  assert.ok(inductionShot.penetration >= inductionState.weapons.carbine.penetration + 18, 'Induction Sink should add the combined penetration bonus.');
  assert.ok(inductionState.player.capacitor >= 46, 'Induction Sink discharge should recycle six capacitor.');
  assert.ok(inductionState.player.abilityCooldowns[0] <= inductionCooldownBefore - 0.69, 'Induction Sink overclock discharge should advance the arming ability further.');
  assert.match(inductionState.eventText, /INDUCTION SINK/, 'Induction Sink needs explicit discharge feedback.');
  assert.ok(inductionState.effects.some(effect => effect.active && effect.kind === 'systems'), 'Induction Sink should emit the Systems capstone world cue.');

  const conductorBaseProfile = { ...baseProfile, specialization: 'capacitor-conductor' as const };
  const recursiveProfile = setAbilityMod(conductorBaseProfile, 'mark', 'systems-recursive-intrusion');
  assert.equal(systemsCapstoneInteractionFor(recursiveProfile, recursiveProfile.abilityMods.mark)?.name, 'Recursive Bus');
  const conductorBaseline = createSimulation(deriveCombatBuild(conductorBaseProfile));
  const recursiveState = createSimulation(deriveCombatBuild(recursiveProfile));
  for (const state of [conductorBaseline, recursiveState]) {
    for (const enemy of state.enemies) enemy.active = false;
    for (const [index, enemy] of state.enemies.slice(0, 4).entries()) {
      Object.assign(enemy, {
        active: true,
        dead: false,
        variant: 'standard' as const,
        role: 'assault' as const,
        combatClass: 'standard' as const,
        x: state.player.x + 220 + index * 70,
        y: state.player.y + (index % 2 === 0 ? -24 : 24),
      });
      enemy.statuses.marked = 0;
      enemy.statuses.disrupted = 0;
      enemy.statuses.conductive = 0;
    }
    state.player.currentWeapon = 'carbine';
    state.player.weaponHeat.carbine = 0.5;
    state.player.capacitor = 70;
    state.player.aim = { x: 1, y: 0 };
  }
  assert.equal(triggerAbility(conductorBaseline, 1), true, 'Capacitor Conductor baseline Relay Hack should cast.');
  assert.equal(triggerAbility(recursiveState, 1), true, 'Recursive Bus should cast through Recursive Intrusion.');
  assert.ok(recursiveState.player.capacitor > conductorBaseline.player.capacitor, 'Recursive Bus should convert propagated relays into additional capacitor recovery.');
  assert.ok(recursiveState.player.weaponHeat.carbine < conductorBaseline.player.weaponHeat.carbine, 'Capacitor Conductor overclock should cool the weapon bus as Recursive Bus spreads.');
  assert.match(recursiveState.eventText, /RECURSIVE BUS/, 'Recursive Bus needs explicit combat feedback.');
  assert.ok(recursiveState.effects.some(effect => effect.active && effect.kind === 'systems'), 'Recursive Bus should emit the Systems capstone world cue.');

  const meshProfile = setAbilityMod({ ...baseProfile, specialization: 'grid-weaver' as const }, 'arc', 'systems-return-current');
  assert.equal(systemsCapstoneInteractionFor(meshProfile, meshProfile.abilityMods.arc)?.name, 'Mesh Reflux');
  const meshState = createSimulation(deriveCombatBuild(meshProfile));
  for (const enemy of meshState.enemies) enemy.active = false;
  const conduit = meshState.objects.find(object => object.kind === 'conduit' || object.kind === 'anchorNode');
  assert.ok(conduit, 'Mesh Reflux regression needs an available conduit or anchor node.');
  for (const object of meshState.objects) if (object.kind === 'conduit' || object.kind === 'anchorNode') object.active = false;
  Object.assign(conduit, {
    active: true,
    exposed: true,
    x: meshState.player.x + 180,
    y: meshState.player.y - conduit.h / 2,
  });
  const conduitX = conduit.x + conduit.w / 2;
  const conduitY = conduit.y + conduit.h / 2;
  const nearNode = meshState.enemies[0];
  const remoteNode = meshState.enemies[1];
  Object.assign(nearNode, { active: true, dead: false, x: conduitX + 80, y: conduitY, variant: 'standard' as const, role: 'assault' as const, combatClass: 'standard' as const });
  Object.assign(remoteNode, { active: true, dead: false, x: conduitX + 360, y: conduitY + 20, variant: 'standard' as const, role: 'assault' as const, combatClass: 'standard' as const });
  remoteNode.statuses.marked = 0;
  remoteNode.statuses.conductive = 0;
  meshState.player.aim = { x: 1, y: 0 };
  meshState.player.abilityCooldowns[1] = 5;
  meshState.player.capacitor = 40;
  assert.equal(triggerAbility(meshState, 2), true, 'Mesh Reflux should cast Return Current through machinery.');
  assert.ok(remoteNode.statuses.marked >= 4.1 && remoteNode.statuses.conductive >= 4.7, 'Mesh Reflux should wire the Grid Weaver remote mark into the conductive return network.');
  assert.ok(meshState.player.abilityCooldowns[1] <= 4.5, 'Mesh Reflux should recycle Relay Hack recovery from the remote return node.');
  assert.match(meshState.eventText, /MESH REFLUX/, 'Mesh Reflux needs explicit combat feedback.');
  assert.ok(meshState.effects.some(effect => effect.active && effect.kind === 'systems'), 'Mesh Reflux should emit the Systems capstone world cue.');
}
systemsCapstoneInteractionSmoke();

function bulkheadWardenSpecializationSmoke() {
  const baseProfile = {
    ...createDefaultProfile(),
    xp: 8100,
    level: 16,
    operatorClass: 'vanguard' as const,
    classSelectionComplete: true,
    specialization: null,
    specializationOverclock: false,
  };
  const wardenProfile = {
    ...baseProfile,
    specialization: 'bulkhead-warden' as const,
    specializationOverclock: true,
  };
  const baseBuild = deriveCombatBuild(baseProfile);
  const wardenBuild = deriveCombatBuild(wardenProfile);
  assert.equal(wardenBuild.specialization, 'bulkhead-warden');
  assert.equal(wardenBuild.specializationOverclock, true);
  assert.ok(wardenBuild.weapon.breacher.damageMul < baseBuild.weapon.breacher.damageMul, 'Bulkhead Warden should pay an offensive output tradeoff.');
  assert.ok(wardenBuild.abilities[2].costMul > baseBuild.abilities[2].costMul, 'Bulkhead Warden overclock should increase Bulwark Pulse capacitor cost.');

  const baselineState = createSimulation(baseBuild);
  const wardenState = createSimulation(wardenBuild);
  baselineState.classState.vanguardGuard = 5;
  wardenState.classState.vanguardGuard = 5;
  baselineState.player.abilityCooldowns[2] = 7;
  wardenState.player.abilityCooldowns[2] = 7;
  wardenState.player.capacitor = 40;
  const baselineArmorBefore = baselineState.player.armor;
  const wardenArmorBefore = wardenState.player.armor;
  applyPlayerDamage(baselineState, 24, 0);
  applyPlayerDamage(wardenState, 24, 0);
  assert.ok(wardenArmorBefore - wardenState.player.armor < baselineArmorBefore - baselineState.player.armor, 'Bulkhead Warden should absorb more blockable damage while Breach Guard is active.');
  assert.ok(wardenState.player.abilityCooldowns[2] < 7, 'Guarded impacts should recycle Bulwark Pulse recovery.');
  assert.ok(wardenState.player.capacitor > 40, 'Bulkhead Warden overclock should return capacitor from recycled guarded impact.');

  for (const enemy of wardenState.enemies) enemy.active = false;
  const contacts = wardenState.enemies.slice(0, 3);
  for (const [index, enemy] of contacts.entries()) {
    Object.assign(enemy, {
      active: true,
      dead: false,
      x: wardenState.player.x + 110 + index * 45,
      y: wardenState.player.y + (index - 1) * 40,
    });
  }
  wardenState.player.armor = Math.max(1, wardenState.player.maxArmor - 24);
  wardenState.player.capacitor = wardenState.player.maxCapacitor;
  wardenState.player.abilityCooldowns[2] = 0;
  const armorBeforePulse = wardenState.player.armor;
  assert.equal(triggerAbility(wardenState, 2), true, 'Bulkhead Warden should be able to cast Bulwark Pulse.');
  assert.ok(wardenState.player.armor > armorBeforePulse, 'Bulkhead Warden Bulwark Pulse should repair armor when it catches enemies.');
  assert.ok(wardenState.classState.vanguardGuard >= 6.9, 'Bulkhead Warden overclock should extend the Breach Guard window after Bulwark Pulse.');
  assert.match(wardenState.eventText, /BULKHEAD WARDEN/, 'Bulkhead Warden should expose explicit combat feedback.');
}
bulkheadWardenSpecializationSmoke();

function thermalShunterSpecializationSmoke() {
  const baseProfile = {
    ...createDefaultProfile(),
    xp: 8100,
    level: 16,
    operatorClass: 'systems' as const,
    classSelectionComplete: true,
    specialization: null,
    specializationOverclock: false,
  };
  const baseShunterProfile = {
    ...baseProfile,
    specialization: 'thermal-shunter' as const,
  };
  const shunterProfile = {
    ...baseShunterProfile,
    specializationOverclock: true,
  };
  const baseBuild = deriveCombatBuild(baseProfile);
  const baseShunterBuild = deriveCombatBuild(baseShunterProfile);
  const shunterBuild = deriveCombatBuild(shunterProfile);
  assert.equal(shunterBuild.specialization, 'thermal-shunter');
  assert.equal(shunterBuild.specializationOverclock, true);
  assert.equal(shunterBuild.player.maxArmorAdd, baseBuild.player.maxArmorAdd - 10, 'Thermal Shunter should pay the authored maximum-armor tradeoff.');
  assert.ok(shunterBuild.weapon.carbine.heatPerShotMul > baseBuild.weapon.carbine.heatPerShotMul, 'Thermal Shunter overclock should increase weapon heat per shot.');

  const baseState = createSimulation(baseShunterBuild);
  for (const enemy of baseState.enemies) enemy.active = false;
  baseState.player.currentWeapon = 'carbine';
  baseState.player.weaponHeat.carbine = 0.5;
  assert.equal(triggerAbility(baseState, 0), true);
  assert.ok(baseState.player.weaponHeat.carbine <= 0.42, 'Base Thermal Shunter should route eight percent active-weapon heat on a warm cast.');
  assert.ok(baseState.classState.systemsCrossfeed >= 2.59 && baseState.classState.systemsCrossfeed <= 2.61, 'Base Thermal Shunter should arm the authored 2.6-second crossfire bank.');

  const state = createSimulation(shunterBuild);
  for (const enemy of state.enemies) enemy.active = false;
  state.player.currentWeapon = 'carbine';
  state.player.weaponHeat.carbine = 0.62;
  state.player.capacitor = 70;
  assert.equal(triggerAbility(state, 0), true, 'Thermal Shunter should cast Polarity Well from a warm weapon state.');
  assert.ok(state.player.weaponHeat.carbine <= 0.52, 'A warm Systems ability cast should shunt active-weapon heat out of the weapon bus.');
  assert.ok(state.classState.systemsCrossfeed >= 2.9, 'Thermal Shunter overclock should arm a three-second crossfire bank.');
  assert.match(state.eventText, /THERMAL SHUNTER/, 'Thermal Shunter should expose heat-routing feedback when the bank is armed.');

  state.player.capacitor = 40;
  const cooldownBeforeShot = state.player.abilityCooldowns[0];
  assert.equal(triggerFire(state), true, 'Thermal Shunter should discharge the armed bank through the next weapon shot.');
  const crossfedShot = state.projectiles.find(projectile => projectile.active && projectile.owner === 'player' && projectile.weapon === 'carbine');
  assert.ok(crossfedShot, 'Thermal Shunter crossfire should create the expected weapon projectile.');
  assert.ok(Math.hypot(crossfedShot.vx, crossfedShot.vy) >= state.weapons.carbine.projectileSpeed * 1.11, 'Thermal crossfire should materially increase projectile velocity.');
  assert.ok(crossfedShot.damage >= state.weapons.carbine.damage * 1.09, 'Thermal crossfire should materially increase shot damage.');
  assert.ok(crossfedShot.penetration >= state.weapons.carbine.penetration + 10, 'Thermal crossfire should add the authored penetration bonus.');
  assert.ok(state.player.capacitor >= 44, 'Thermal crossfire should recycle four capacitor on discharge.');
  assert.ok(state.player.abilityCooldowns[0] <= cooldownBeforeShot - 0.49, 'Thermal Shunter overclock should advance the ability that armed the bank.');
  assert.equal(state.classState.systemsCrossfeed, 0, 'Thermal crossfire should be consumed by one weapon shot.');
  assert.match(state.eventText, /THERMAL CROSSFIRE/, 'Thermal Shunter should expose explicit discharge feedback.');

  const coldState = createSimulation(shunterBuild);
  for (const enemy of coldState.enemies) enemy.active = false;
  coldState.player.currentWeapon = 'carbine';
  coldState.player.weaponHeat.carbine = 0.2;
  assert.equal(triggerAbility(coldState, 0), true);
  assert.equal(coldState.classState.systemsCrossfeed, 0, 'Cold weapons should not arm Thermal Shunter crossfire for free.');
}
thermalShunterSpecializationSmoke();

function vanguardSkillEvolutionSmoke() {
  const level15 = {
    ...createDefaultProfile(),
    xp: 7140,
    level: 15,
    operatorClass: 'vanguard' as const,
    classSelectionComplete: true,
    specialization: null,
    specializationOverclock: false,
  };
  const level16 = { ...level15, xp: 8100, level: 16 };

  const locked = setAbilityMod(level15, 'mag', 'vanguard-siege-ram');
  assert.equal(locked.abilityMods.mag, null, 'Vanguard skill evolutions should remain locked before LV16.');

  const siegeProfile = setAbilityMod(level16, 'mag', 'vanguard-siege-ram');
  const siegeBuild = deriveCombatBuild(siegeProfile);
  assert.equal(siegeBuild.mechanics.vanguardSiegeRam, true);
  assert.ok(siegeBuild.abilities[0].cooldownMul > 1, 'Siege Ram should pay its Breach Rush cooldown tradeoff.');
  const siegeState = createSimulation(siegeBuild);
  for (const enemy of siegeState.enemies) enemy.active = false;
  for (const [index, enemy] of siegeState.enemies.slice(0, 2).entries()) {
    Object.assign(enemy, {
      active: true,
      dead: false,
      variant: 'standard' as const,
      role: 'assault' as const,
      combatClass: 'standard' as const,
      x: siegeState.player.x + 150 + index * 85,
      y: siegeState.player.y + (index === 0 ? -22 : 26),
    });
    enemy.statuses.armorBreach = 0;
  }
  siegeState.player.aim = { x: 1, y: 0 };
  assert.equal(triggerAbility(siegeState, 0), true, 'Siege Ram should cast through the Vanguard first-skill slot.');
  assert.ok(siegeState.enemies.slice(0, 2).every(enemy => enemy.statuses.armorBreach >= 3.5), 'Siege Ram should open armor paths on contacts in the ram line.');
  assert.ok(siegeState.classState.vanguardGuard > 4, 'Multiple Siege Ram contacts should extend Breach Guard beyond the standard window.');
  assert.match(siegeState.eventText, /SIEGE RAM/, 'Siege Ram needs explicit combat feedback.');

  const faultlineProfile = setAbilityMod(level16, 'mark', 'vanguard-faultline-tag');
  const faultlineBuild = deriveCombatBuild(faultlineProfile);
  assert.equal(faultlineBuild.mechanics.vanguardFaultlineTag, true);
  assert.ok(faultlineBuild.abilities[1].costMul > 1, 'Faultline Tag should pay its capacitor tradeoff.');
  const faultlineState = createSimulation(faultlineBuild);
  for (const enemy of faultlineState.enemies) enemy.active = false;
  const primary = faultlineState.enemies[0];
  const relay = faultlineState.enemies[1];
  Object.assign(primary, { active: true, dead: false, variant: 'standard' as const, role: 'assault' as const, combatClass: 'standard' as const, x: faultlineState.player.x + 230, y: faultlineState.player.y });
  Object.assign(relay, { active: true, dead: false, variant: 'standard' as const, role: 'assault' as const, combatClass: 'standard' as const, x: faultlineState.player.x + 230, y: faultlineState.player.y + 170 });
  primary.statuses.armorBreach = 0;
  relay.statuses.armorBreach = 0;
  const relayArmorBefore = relay.armor;
  faultlineState.player.aim = { x: 1, y: 0 };
  assert.equal(triggerAbility(faultlineState, 1), true, 'Faultline Tag should cast through the Vanguard second-skill slot.');
  assert.ok(primary.statuses.armorBreach >= 4.7, 'Faultline Tag should preserve the primary Fracture Tag breach.');
  assert.ok(relay.statuses.armorBreach >= 3.7 && relay.armor < relayArmorBefore, 'Faultline Tag should fracture a nearby secondary hostile.');
  assert.match(faultlineState.eventText, /FAULTLINE TAG/, 'Faultline Tag needs explicit combat feedback.');

  const reprisalProfile = setAbilityMod(level16, 'arc', 'vanguard-reprisal-pulse');
  const reprisalBuild = deriveCombatBuild(reprisalProfile);
  assert.equal(reprisalBuild.mechanics.vanguardReprisalPulse, true);
  assert.ok(reprisalBuild.abilities[2].cooldownMul > 1, 'Reprisal Pulse should pay its Bulwark Pulse cooldown tradeoff.');
  const reprisalState = createSimulation(reprisalBuild);
  for (const enemy of reprisalState.enemies) enemy.active = false;
  const breached = reprisalState.enemies[0];
  Object.assign(breached, { active: true, dead: false, variant: 'standard' as const, role: 'assault' as const, combatClass: 'standard' as const, x: reprisalState.player.x + 130, y: reprisalState.player.y });
  breached.statuses.armorBreach = 4;
  reprisalState.player.abilityCooldowns[0] = 3;
  const breachedArmorBefore = breached.armor;
  assert.equal(triggerAbility(reprisalState, 2), true, 'Reprisal Pulse should cast through the Vanguard third-skill slot.');
  assert.ok(breached.armor < breachedArmorBefore, 'Reprisal Pulse should strip additional armor from already-breached contacts.');
  assert.ok(reprisalState.player.abilityCooldowns[0] < 3, 'Reprisal Pulse contacts should advance Breach Rush recovery.');
  assert.match(reprisalState.eventText, /REPRISAL PULSE/, 'Reprisal Pulse needs explicit combat feedback.');

  const switched = setOperatorClass(siegeProfile, 'vector').profile;
  assert.equal(switched.abilityMods.mag, null, 'Switching class should clear an incompatible Vanguard evolution.');
  const genericLens = setAbilityMod(level16, 'mark', 'mark-wideband');
  const genericSwitched = setOperatorClass(genericLens, 'vector').profile;
  assert.equal(genericSwitched.abilityMods.mark, 'mark-wideband', 'Switching class should preserve shared Skill Lenses.');
}
vanguardSkillEvolutionSmoke();

function vanguardCapstoneInteractionSmoke() {
  const baseProfile = {
    ...createDefaultProfile(),
    xp: 8100,
    level: 16,
    operatorClass: 'vanguard' as const,
    classSelectionComplete: true,
    specializationOverclock: true,
  };

  const pressureProfile = setAbilityMod({ ...baseProfile, specialization: 'pressure-diver' as const }, 'mag', 'vanguard-siege-ram');
  assert.equal(vanguardCapstoneInteractionFor(pressureProfile, pressureProfile.abilityMods.mag)?.name, 'Void Ram');
  const pressureState = createSimulation(deriveCombatBuild(pressureProfile));
  for (const enemy of pressureState.enemies) enemy.active = false;
  const pressureTarget = pressureState.enemies[0];
  Object.assign(pressureTarget, { active: true, dead: false, x: pressureState.player.x + 170, y: pressureState.player.y, armor: 60, maxArmor: 60 });
  pressureTarget.statuses.vacuum = 0;
  pressureState.player.aim = { x: 1, y: 0 };
  pressureState.player.vacuumExposure = 1.2;
  assert.equal(triggerAbility(pressureState, 0), true, 'Void Ram should cast through Siege Ram.');
  assert.ok(pressureTarget.statuses.vacuum >= 2.9, 'Void Ram should vacuum the ram contact.');
  assert.ok(pressureState.hazards.some(hazard => hazard.active && hazard.kind === 'vacuumWake' && hazard.owner === 'player' && Math.hypot(hazard.x - pressureTarget.x, hazard.y - pressureTarget.y) < 20), 'Void Ram should seed a player-owned vacuum wake at the breach contact.');
  assert.ok(pressureState.player.vacuumExposure < 1.2, 'Void Ram should recycle Pressure Diver exposure on contact.');
  assert.match(pressureState.eventText, /VOID RAM/, 'Void Ram needs explicit combat feedback.');
  assert.ok(pressureState.effects.some(effect => effect.active && effect.kind === 'vanguard'), 'Void Ram should emit the Vanguard capstone world cue.');

  const breachProfile = setAbilityMod({ ...baseProfile, specialization: 'breach-vanguard' as const }, 'mark', 'vanguard-faultline-tag');
  assert.equal(vanguardCapstoneInteractionFor(breachProfile, breachProfile.abilityMods.mark)?.name, 'Breach Cascade');
  const breachState = createSimulation(deriveCombatBuild(breachProfile));
  for (const enemy of breachState.enemies) enemy.active = false;
  const breachPrimary = breachState.enemies[0];
  const breachRelay = breachState.enemies[1];
  Object.assign(breachPrimary, { active: true, dead: false, x: breachState.player.x + 220, y: breachState.player.y, armor: 20, maxArmor: 20 });
  Object.assign(breachRelay, { active: true, dead: false, x: breachState.player.x + 220, y: breachState.player.y + 150, armor: 20, maxArmor: 20 });
  breachState.player.aim = { x: 1, y: 0 };
  breachState.player.armor = Math.max(1, breachState.player.maxArmor - 20);
  const breachArmorBefore = breachState.player.armor;
  assert.equal(triggerAbility(breachState, 1), true, 'Breach Cascade should cast through Faultline Tag.');
  assert.equal(breachPrimary.armor, 0, 'Breach Cascade should finish the primary armor break.');
  assert.equal(breachRelay.armor, 0, 'Breach Cascade should finish the relayed armor break.');
  assert.ok(breachState.classState.vanguardGuard >= 4.9, 'Breach Cascade armor breaks should feed Breach Guard.');
  assert.ok(breachState.player.armor > breachArmorBefore, 'Breach Vanguard overclock should repair armor from capstone-tag armor breaks.');
  assert.match(breachState.eventText, /BREACH CASCADE.*2 ARMOR BREAKS/, 'Breach Cascade needs explicit multi-break feedback.');
  assert.ok(breachState.effects.some(effect => effect.active && effect.kind === 'vanguard'), 'Breach Cascade should emit the Vanguard capstone world cue.');

  const standardWardenProfile = { ...baseProfile, specialization: 'bulkhead-warden' as const };
  const counterfortProfile = setAbilityMod(standardWardenProfile, 'arc', 'vanguard-reprisal-pulse');
  assert.equal(vanguardCapstoneInteractionFor(counterfortProfile, counterfortProfile.abilityMods.arc)?.name, 'Counterfort');
  const baselineState = createSimulation(deriveCombatBuild(standardWardenProfile));
  const counterfortState = createSimulation(deriveCombatBuild(counterfortProfile));
  for (const state of [baselineState, counterfortState]) {
    for (const enemy of state.enemies) enemy.active = false;
    for (const [index, enemy] of state.enemies.slice(0, 2).entries()) {
      Object.assign(enemy, { active: true, dead: false, x: state.player.x + 120 + index * 60, y: state.player.y + (index === 0 ? -35 : 35), armor: 42, maxArmor: 42 });
      enemy.statuses.armorBreach = 4;
    }
    state.player.armor = Math.max(1, state.player.maxArmor - 36);
    state.player.capacitor = 70;
  }
  assert.equal(triggerAbility(baselineState, 2), true, 'Bulkhead Warden baseline pulse should cast.');
  assert.equal(triggerAbility(counterfortState, 2), true, 'Counterfort should cast through Reprisal Pulse.');
  assert.ok(counterfortState.player.armor > baselineState.player.armor, 'Counterfort should repair additional armor beyond the normal Bulkhead Warden pulse.');
  assert.ok(counterfortState.classState.vanguardGuard > baselineState.classState.vanguardGuard, 'Counterfort reprisal contacts should reinforce Breach Guard.');
  assert.ok(counterfortState.player.capacitor > baselineState.player.capacitor, 'Bulkhead Warden overclock should recycle capacitor from Counterfort reprisal contacts.');
  assert.match(counterfortState.eventText, /COUNTERFORT/, 'Counterfort needs explicit combat feedback.');
  assert.ok(counterfortState.effects.some(effect => effect.active && effect.kind === 'vanguard'), 'Counterfort should emit the Vanguard capstone world cue.');
}
vanguardCapstoneInteractionSmoke();

function iceMineBrittleSupportSmoke() {
  const campaign = createDefaultCampaign();
  campaign.cycle = 3;
  const contract = generateContracts(campaign).find(candidate => candidate.location === 'ice-mine');
  assert.ok(contract, 'Cycle 3 should expose an Ice Mine contract for brittle-support regression coverage.');

  const playerOpened = createSimulation();
  applyMissionSetup(playerOpened, contract);
  const supportA = playerOpened.objects.find(object => object.id === 'ice-brittle-gate-a');
  const supportB = playerOpened.objects.find(object => object.id === 'ice-brittle-gate-b');
  assert.ok(supportA && supportB, 'Ice Mine must spawn both brittle support gates.');
  assert.equal(supportA.material, 'light');
  assert.equal(supportA.destructible, true);
  assert.equal(supportA.active, true);
  assert.equal(supportA.hp, 68);

  for (const enemy of playerOpened.enemies) enemy.active = false;
  for (const object of playerOpened.objects) object.active = object.id === supportA.id;
  playerOpened.player.currentWeapon = 'rail';
  for (let shot = 0; shot < 2; shot += 1) {
    playerOpened.player.x = supportA.x - 160;
    playerOpened.player.y = supportA.y + supportA.h / 2;
    playerOpened.player.vx = 0;
    playerOpened.player.vy = 0;
    playerOpened.player.aim = { x: 1, y: 0 };
    playerOpened.player.fireCooldown = 0;
    playerOpened.player.reloadT = 0;
    playerOpened.player.ventT = 0;
    playerOpened.player.capacitor = playerOpened.player.maxCapacitor;
    playerOpened.player.weaponHeat.rail = 0;
    playerOpened.player.mags.rail = Math.max(1, playerOpened.player.mags.rail);
    assert.equal(triggerFire(playerOpened), true, 'Rail fire should be able to damage an Ice Mine brittle support.');
    for (let tick = 0; tick < 30; tick += 1) stepSimulation(playerOpened, 0.01);
  }
  assert.equal(supportA.hp, 0, 'Two direct rail impacts should fracture the light Ice Mine support.');
  assert.equal(supportA.active, false, 'Player destruction must remove brittle support collision and open the firing lane.');
  assert.match(playerOpened.eventText, /LINE OF FIRE OPEN/, 'Player-opened brittle support lane needs explicit combat feedback.');

  const timedShear = createSimulation();
  applyMissionSetup(timedShear, contract);
  const timedSupports = timedShear.objects.filter(object => object.id === 'ice-brittle-gate-a' || object.id === 'ice-brittle-gate-b');
  assert.equal(timedSupports.length, 2, 'Timed Ice Mine shear must address both brittle supports.');
  timedSupports[0].active = false;
  timedSupports[0].hp = 0;
  const runtime = createDirector();
  stepMissionDirector(timedShear, runtime, contract, 14);
  assert.equal(runtime.locationEventA, true, 'Ice Mine shear event should fire at the authored 14 second mark.');
  assert.equal(timedSupports.every(object => !object.active), true, 'Timed shear must collapse every brittle support that remains standing.');
  assert.equal(timedSupports.every(object => object.hp === 0), true, 'Timed shear collapse must leave brittle support durability fully fractured for visual/state consistency.');
  assert.equal(timedSupports.filter(object => object.active).length, 0, 'Timed shear must deterministically leave both authored support lanes open even if a later director event replaces the HUD message.');
}
iceMineBrittleSupportSmoke();

const healState = createSimulation();
healState.player.hp = 25;
assert.equal(triggerConsumable(healState, 'medGel'), true);
assert.equal(healState.player.hp, 65);
assert.equal(triggerConsumable(healState, 'medGel'), false, 'consumables should respect the shared use cooldown');
healState.player.consumableCooldown = 0;
healState.player.armor = 10;
assert.equal(triggerConsumable(healState, 'armorPatch'), true);
assert.equal(healState.player.armor, 45);
healState.player.consumableCooldown = 0;
healState.player.capacitor = 20;
healState.player.weaponHeat.carbine = 0.8;
assert.equal(triggerConsumable(healState, 'capacitorCell'), true);
assert.equal(healState.player.capacitor, 65);
assert.ok(Math.abs(healState.player.weaponHeat.carbine - 0.56) < 0.0001);

assert.equal(weaponConfigs.carbine.damage, 13.5, 'carbine base damage should be reduced by exactly 25% from 18');
assert.equal(weaponConfigs.breacher.damage, 8.25, 'breacher base damage should be reduced by exactly 25% from 11');
assert.equal(weaponConfigs.rail.damage, 36, 'rail base damage should be reduced by exactly 25% from 48');
const neutralDamageState = createSimulation();
assert.equal(neutralDamageState.weapons.carbine.damage, weaponConfigs.carbine.damage, 'neutral build should preserve reduced carbine base damage');
assert.equal(neutralDamageState.weapons.breacher.damage, weaponConfigs.breacher.damage, 'neutral build should preserve reduced breacher base damage');
assert.equal(neutralDamageState.weapons.rail.damage, weaponConfigs.rail.damage, 'neutral build should preserve reduced rail base damage');

const deathState = createSimulation();
deathState.player.hp = 1;
deathState.player.armor = deathState.player.maxArmor;
applyPlayerDamage(deathState, 5, 0);
assert.equal(deathState.player.dead, true, 'a real damaging hit at displayed 1 HP must be lethal');
assert.equal(deathState.player.hp, 0);
assert.equal(deathState.telemetry.deaths, 1);

const aimState = createSimulation();
aimState.player.x = 1000;
aimState.player.y = 500;
aimState.player.aim = { x: 1, y: 0 };
for (const enemy of aimState.enemies) enemy.active = false;
const target = aimState.enemies.find(enemy => enemy.id === 1)!;
target.active = true;
target.dead = false;
target.x = 700;
target.y = 500;
assert.equal(aimAtMobileTarget(aimState, 'balanced', target.id), target.id);
assert.ok(aimState.player.aim.x > 0.95, 'first target-switch frame should turn toward the new target instead of snapping 180 degrees');
for (let i = 0; i < 30; i += 1) aimAtMobileTarget(aimState, 'balanced', target.id);
assert.ok(aimState.player.aim.x < -0.95, 'assisted aim should still converge fully on the target');

function prepareAcquisitionState() {
  const state = createSimulation();
  state.player.x = 1000;
  state.player.y = 500;
  state.player.aim = { x: 1, y: 0 };
  state.squadSuppressing = false;
  state.bossActive = false;
  for (const enemy of state.enemies) {
    enemy.active = false;
    enemy.dead = false;
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.telegraph = 0;
    enemy.hazardCooldown = 9;
    enemy.statuses.marked = 0;
    enemy.protocols = [];
  }
  for (const object of state.objects) object.active = false;
  return state;
}

const neutralCadenceState = createSimulation();
assert.equal(neutralCadenceState.build.attackSpeedMul, 1, 'neutral combat builds must keep Attack Speed at the canonical 1.0x baseline');
assert.equal(neutralCadenceState.weapons.carbine.rate, weaponConfigs.carbine.rate, '1.0x Attack Speed must preserve authored weapon cadence');

const attackSpeedBaselineProfile = createDefaultProfile();
const attackSpeedBaselineBuild = deriveCombatBuild(attackSpeedBaselineProfile);
const attackSpeedBaselineState = createSimulation(attackSpeedBaselineBuild);
const attackSpeedProfile = createDefaultProfile();
attackSpeedProfile.allocatedNodes = ['awareness-track-fusion'];
const attackSpeedBuild = deriveCombatBuild(attackSpeedProfile);
assert.ok(Math.abs(attackSpeedBuild.attackSpeedMul - 1.03) < 1e-9, 'Track Fusion should author an attainable +3% Attack Speed source through the Operator Network');
const attackSpeedFireState = createSimulation(attackSpeedBuild);
assert.ok(Math.abs(attackSpeedFireState.weapons.breacher.rate / attackSpeedBaselineState.weapons.breacher.rate - attackSpeedBuild.attackSpeedMul / attackSpeedBaselineBuild.attackSpeedMul) < 1e-9, 'Attack Speed must multiply weapon shots-per-second directly without conflating weapon-variant cadence');
attackSpeedFireState.player.currentWeapon = 'breacher';
assert.equal(triggerFire(attackSpeedFireState), true, 'Attack Speed cadence test should fire the class-owned Breacher');
assert.ok(Math.abs(attackSpeedFireState.player.fireCooldown - 1 / attackSpeedFireState.weapons.breacher.rate) < 1e-9, 'shot cooldown must be derived from the Attack Speed-adjusted weapon rate');

function assistedTurnAfterOneStep(mode: 'light' | 'balanced', attackSpeedMul: number, unrelatedTuning = false) {
  const state = prepareAcquisitionState();
  state.build.attackSpeedMul = attackSpeedMul;
  state.player.currentWeapon = 'breacher';
  if (unrelatedTuning) {
    state.weapons.breacher.projectileSpeed *= 2.5;
    state.weapons.breacher.reloadSeconds *= 0.4;
  }
  const target = state.enemies[0]!;
  Object.assign(target, {
    active: true,
    id: 199,
    x: state.player.x + Math.cos(0.4) * 240,
    y: state.player.y + Math.sin(0.4) * 240,
    role: 'suppressor' as const,
  });
  const memory = createTargetControlMemory();
  assert.equal(updateMobileTargetControl(state, mode, memory), 199, `${mode} assist should acquire the cadence test target`);
  return Math.abs(Math.atan2(state.player.aim.y, state.player.aim.x));
}

const balancedBaselineTurn = assistedTurnAfterOneStep('balanced', 1);
const lightBaselineTurn = assistedTurnAfterOneStep('light', 1);
const attackSpeedTurn = assistedTurnAfterOneStep('balanced', attackSpeedBuild.attackSpeedMul);
const unrelatedTurn = assistedTurnAfterOneStep('balanced', 1, true);
assert.ok(Math.abs(balancedBaselineTurn - lightBaselineTurn) < 1e-9, 'Light and Balanced assist may change target selection, but not assisted tracking turn speed');
assert.ok(Math.abs(unrelatedTurn - balancedBaselineTurn) < 1e-9, 'projectile velocity and reload tuning must not speed up assisted tracking');
assert.ok(Math.abs(attackSpeedTurn / balancedBaselineTurn - attackSpeedBuild.attackSpeedMul) < 1e-9, 'Attack Speed must scale assisted lock-on rotation by the same multiplier used for firing cadence');

const stickyTargetState = prepareAcquisitionState();
const stickyPrimary = stickyTargetState.enemies[0]!;
const stickyChallenger = stickyTargetState.enemies[1]!;
Object.assign(stickyPrimary, { active: true, id: 201, x: 1240, y: 500, role: 'suppressor' as const });
Object.assign(stickyChallenger, { active: true, id: 202, x: 1260, y: 535, role: 'suppressor' as const });
const stickyMemory = createTargetControlMemory();
assert.equal(updateMobileTargetControl(stickyTargetState, 'balanced', stickyMemory), 201, 'target control should acquire the best initial hostile');
stickyChallenger.statuses.marked = 4;
assert.equal(updateMobileTargetControl(stickyTargetState, 'balanced', stickyMemory), 201, 'a small score improvement should not steal a sticky lock');
stickyChallenger.telegraph = 0.9;
assert.equal(updateMobileTargetControl(stickyTargetState, 'balanced', stickyMemory), 202, 'a materially higher-priority challenger should still be allowed to steal the lock');

const occlusionControlState = prepareAcquisitionState();
const occlusionPrimary = occlusionControlState.enemies[0]!;
const occlusionChallenger = occlusionControlState.enemies[1]!;
Object.assign(occlusionPrimary, { active: true, id: 211, x: 1240, y: 500, role: 'suppressor' as const });
Object.assign(occlusionChallenger, { active: true, id: 212, x: 1260, y: 620, role: 'suppressor' as const });
const occlusionMemory = createTargetControlMemory();
assert.equal(updateMobileTargetControl(occlusionControlState, 'balanced', occlusionMemory), 211, 'occlusion test should begin with the centerline target locked');
const occlusionCover = occlusionControlState.objects[0]!;
Object.assign(occlusionCover, { active: true, kind: 'cover' as const, x: 1080, y: 480, w: 55, h: 42 });
occlusionControlState.time += 0.2;
assert.equal(updateMobileTargetControl(occlusionControlState, 'balanced', occlusionMemory), 211, 'brief LOS loss should preserve the current lock inside the balanced occlusion grace window');
occlusionControlState.time += 0.5;
assert.equal(updateMobileTargetControl(occlusionControlState, 'balanced', occlusionMemory), 212, 'a visible challenger should take over after the occlusion grace window expires');

const occlusionDropState = prepareAcquisitionState();
const occlusionDropTarget = occlusionDropState.enemies[0]!;
Object.assign(occlusionDropTarget, { active: true, id: 213, x: 1240, y: 500, role: 'suppressor' as const });
const occlusionDropMemory = createTargetControlMemory();
assert.equal(updateMobileTargetControl(occlusionDropState, 'balanced', occlusionDropMemory), 213);
const occlusionDropCover = occlusionDropState.objects[0]!;
Object.assign(occlusionDropCover, { active: true, kind: 'cover' as const, x: 1080, y: 480, w: 55, h: 42 });
occlusionDropState.time += 0.2;
assert.equal(updateMobileTargetControl(occlusionDropState, 'balanced', occlusionDropMemory), 213, 'brief cover should retain the lock even when no alternative is visible');
occlusionDropState.time += 0.5;
assert.equal(updateMobileTargetControl(occlusionDropState, 'balanced', occlusionDropMemory), null, 'an occluded hostile must be released after grace instead of being tracked through cover indefinitely');

const invalidationControlState = prepareAcquisitionState();
const invalidPrimary = invalidationControlState.enemies[0]!;
const invalidFallback = invalidationControlState.enemies[1]!;
Object.assign(invalidPrimary, { active: true, id: 221, x: 1220, y: 500, role: 'suppressor' as const });
Object.assign(invalidFallback, { active: true, id: 222, x: 1260, y: 560, role: 'suppressor' as const });
const invalidMemory = createTargetControlMemory();
assert.equal(updateMobileTargetControl(invalidationControlState, 'balanced', invalidMemory), 221);
invalidPrimary.dead = true;
assert.equal(updateMobileTargetControl(invalidationControlState, 'balanced', invalidMemory), 222, 'dead targets must invalidate immediately without consuming occlusion grace');
invalidFallback.x = invalidationControlState.player.x + 1200;
assert.equal(updateMobileTargetControl(invalidationControlState, 'balanced', invalidMemory), null, 'out-of-range targets must invalidate the lock immediately');
assert.equal(invalidMemory.targetId, null);

const manualResetMemory = createTargetControlMemory();
manualResetMemory.targetId = 777;
manualResetMemory.lastVisibleAt = 12;
manualResetMemory.acquiredAt = 10;
resetTargetControlMemory(manualResetMemory);
assert.equal(manualResetMemory.targetId, null, 'manual override reset must clear the retained target id');
assert.equal(manualResetMemory.lastVisibleAt, Number.NEGATIVE_INFINITY, 'manual override reset must clear LOS grace history');
assert.equal(manualResetMemory.acquiredAt, Number.NEGATIVE_INFINITY, 'manual override reset must clear acquisition history');

const authoritativeFireState = prepareAcquisitionState();
const authoritativeFireLock = authoritativeFireState.enemies[0]!;
const authoritativeFireChallenger = authoritativeFireState.enemies[1]!;
Object.assign(authoritativeFireLock, { active: true, id: 231, x: 1240, y: 500, role: 'suppressor' as const });
Object.assign(authoritativeFireChallenger, { active: true, id: 232, x: 1210, y: 555, role: 'suppressor' as const, telegraph: 0.9 });
authoritativeFireChallenger.statuses.marked = 5;
authoritativeFireState.player.aim = { x: 1, y: 0 };
assert.equal(triggerFire(authoritativeFireState, 'acquire', 231), true, 'FIRE should accept the retained target-control id');
assert.ok(Math.abs(authoritativeFireState.player.aim.y) < 0.02 && authoritativeFireState.player.aim.x > 0.99, 'FIRE execution must keep the retained lock even when a challenger has a better fresh acquisition score');

const authoritativeSkillState = prepareAcquisitionState();
const authoritativeSkillLock = authoritativeSkillState.enemies[0]!;
const authoritativeSkillChallenger = authoritativeSkillState.enemies[1]!;
Object.assign(authoritativeSkillLock, { active: true, id: 241, x: 1240, y: 500, role: 'suppressor' as const });
Object.assign(authoritativeSkillChallenger, { active: true, id: 242, x: 1200, y: 540, role: 'suppressor' as const, telegraph: 0.9 });
authoritativeSkillChallenger.statuses.marked = 5;
assert.equal(triggerAbility(authoritativeSkillState, 1, 'acquire', 241), true, 'targeted skills should accept the retained target-control id');
assert.ok(authoritativeSkillLock.statuses.marked > 0, 'retained target should receive the targeted skill');
assert.equal(authoritativeSkillChallenger.statuses.marked, 5, 'targeted skill must not silently reacquire the higher-scoring challenger');

const legalTargetState = prepareAcquisitionState();
const deadTarget = legalTargetState.enemies[0]!;
const outOfRangeTarget = legalTargetState.enemies[1]!;
const legalTarget = legalTargetState.enemies[2]!;
Object.assign(deadTarget, { active: true, dead: true, x: 1120, y: 500 });
Object.assign(outOfRangeTarget, { active: true, dead: false, x: 1720, y: 500 });
Object.assign(legalTarget, { active: true, dead: false, x: 1260, y: 500 });
assert.equal(acquireCombatTarget(legalTargetState, { maxDistance: 520 })?.enemy.id, legalTarget.id, 'target acquisition must reject dead and out-of-range hostiles');
legalTarget.active = false;
assert.equal(acquireCombatTarget(legalTargetState, { maxDistance: 520 }), null, 'target acquisition should return null when no legal hostile exists');

const visibilityTargetState = prepareAcquisitionState();
const occludedTarget = visibilityTargetState.enemies[0]!;
const visibleTarget = visibilityTargetState.enemies[1]!;
Object.assign(occludedTarget, { active: true, x: 1200, y: 500, role: 'suppressor' as const });
Object.assign(visibleTarget, { active: true, x: 1220, y: 620, role: 'suppressor' as const });
const acquisitionCover = visibilityTargetState.objects[0]!;
Object.assign(acquisitionCover, { active: true, kind: 'cover' as const, x: 1080, y: 480, w: 50, h: 40 });
const visibilityPick = acquireCombatTarget(visibilityTargetState, { maxDistance: 520 });
assert.equal(visibilityPick?.enemy.id, visibleTarget.id, 'visibility penalty should prefer a clear firing solution over a slightly better occluded aim line');
assert.equal(visibilityPick?.visible, true, 'selected clear firing solution should expose visible=true');

const markTargetState = prepareAcquisitionState();
const unmarkedTarget = markTargetState.enemies[0]!;
const markedTargetPriority = markTargetState.enemies[1]!;
Object.assign(unmarkedTarget, { active: true, id: 40, x: 1240, y: 460, role: 'suppressor' as const });
Object.assign(markedTargetPriority, { active: true, id: 50, x: 1240, y: 540, role: 'suppressor' as const });
markedTargetPriority.statuses.marked = 4;
assert.equal(acquireCombatTarget(markTargetState, { maxDistance: 520 })?.enemy.id, 50, 'marked hostiles should win otherwise equivalent acquisition scoring');

const threatTargetState = prepareAcquisitionState();
const quietTarget = threatTargetState.enemies[0]!;
const telegraphTarget = threatTargetState.enemies[1]!;
Object.assign(quietTarget, { active: true, id: 60, x: 1240, y: 460, role: 'suppressor' as const });
Object.assign(telegraphTarget, { active: true, id: 70, x: 1240, y: 540, role: 'suppressor' as const, telegraph: 0.8 });
assert.equal(acquireCombatTarget(threatTargetState, { maxDistance: 520 })?.enemy.id, 70, 'an actively telegraphing threat should outrank an otherwise equivalent idle hostile');

const bossTargetState = prepareAcquisitionState();
bossTargetState.bossActive = true;
const standardTarget = bossTargetState.enemies[0]!;
const bossTargetPriority = bossTargetState.enemies[1]!;
Object.assign(standardTarget, { active: true, id: 80, x: 1240, y: 460, role: 'suppressor' as const });
Object.assign(bossTargetPriority, { active: true, id: 90, x: 1240, y: 540, role: 'boss' as const });
assert.equal(acquireCombatTarget(bossTargetState, { maxDistance: 520 })?.enemy.id, 90, 'an active boss should receive the authored acquisition priority bonus');

const deterministicTargetState = prepareAcquisitionState();
const deterministicHigh = deterministicTargetState.enemies[0]!;
const deterministicLow = deterministicTargetState.enemies[1]!;
Object.assign(deterministicHigh, { active: true, id: 120, x: 1240, y: 460, role: 'suppressor' as const });
Object.assign(deterministicLow, { active: true, id: 110, x: 1240, y: 540, role: 'suppressor' as const });
assert.equal(acquireCombatTarget(deterministicTargetState, { maxDistance: 520 })?.enemy.id, 110, 'equal-score acquisition must use stable enemy id as the final tie-breaker');
deterministicTargetState.enemies.reverse();
assert.equal(acquireCombatTarget(deterministicTargetState, { maxDistance: 520 })?.enemy.id, 110, 'target resolution must not depend on enemy array order');

const acquiredFireState = prepareAcquisitionState();
const acquiredFireTarget = acquiredFireState.enemies[0]!;
Object.assign(acquiredFireTarget, { active: true, x: 1240, y: 500 });
acquiredFireState.player.aim = { x: -1, y: 0 };
const acquiredFireMemory = createTargetControlMemory();
assert.equal(updateMobileTargetControl(acquiredFireState, 'balanced', acquiredFireMemory), acquiredFireTarget.id, 'assisted FIRE should first acquire through smooth target control');
const earlyAssistedAim = { ...acquiredFireState.player.aim };
assert.ok(earlyAssistedAim.x < -0.95, 'first assisted target-control step must not snap a 180-degree aim change');
assert.equal(triggerFire(acquiredFireState, 'acquire', acquiredFireTarget.id), false, 'assisted FIRE must wait until the retained target-control solution converges');
assert.deepEqual(acquiredFireState.player.aim, earlyAssistedAim, 'blocked assisted FIRE must not mutate aim at shot time');
assert.equal(acquiredFireState.projectiles.some(projectile => projectile.active && projectile.owner === 'player'), false, 'an unconverged assisted shot must not create a projectile');
for (let i = 0; i < 30; i += 1) updateMobileTargetControl(acquiredFireState, 'balanced', acquiredFireMemory);
const convergedAssistedAim = { ...acquiredFireState.player.aim };
assert.equal(triggerFire(acquiredFireState, 'acquire', acquiredFireTarget.id), true, 'assisted FIRE should execute once smooth target control has converged');
assert.deepEqual(acquiredFireState.player.aim, convergedAssistedAim, 'assisted FIRE must preserve the smoothly converged aim instead of assigning a shot-time vector');
assert.ok(acquiredFireState.projectiles.some(projectile => projectile.active && projectile.owner === 'player' && projectile.vx > 0), 'converged assisted FIRE projectile should travel toward the retained hostile');

const assistedOcclusionFireState = prepareAcquisitionState();
const assistedOcclusionTarget = assistedOcclusionFireState.enemies[0]!;
Object.assign(assistedOcclusionTarget, { active: true, id: 251, x: 1240, y: 500, role: 'suppressor' as const });
const assistedOcclusionMemory = createTargetControlMemory();
assert.equal(updateMobileTargetControl(assistedOcclusionFireState, 'balanced', assistedOcclusionMemory), 251);
const assistedOcclusionCover = assistedOcclusionFireState.objects[0]!;
Object.assign(assistedOcclusionCover, { active: true, kind: 'cover' as const, x: 1080, y: 480, w: 55, h: 42 });
assistedOcclusionFireState.time += 0.2;
assert.equal(updateMobileTargetControl(assistedOcclusionFireState, 'balanced', assistedOcclusionMemory), 251, 'brief LOS loss may retain the visual lock during occlusion grace');
assert.equal(triggerFire(assistedOcclusionFireState, 'acquire', 251), false, 'assisted FIRE must not commit through cover even while the visual lock is still inside occlusion grace');

const bossGateTargetState = prepareAcquisitionState();
const gatedBoss = bossGateTargetState.enemies.find(enemy => enemy.role === 'boss')!;
Object.assign(gatedBoss, { active: true, dead: false, x: 1240, y: 500 });
bossGateTargetState.bossGateHold = true;
bossGateTargetState.bossActive = false;
const bossGateMemory = createTargetControlMemory();
bossGateMemory.targetId = gatedBoss.id;
bossGateMemory.lastVisibleAt = bossGateTargetState.time;
assert.equal(updateMobileTargetControl(bossGateTargetState, 'balanced', bossGateMemory), null, 'boss locks must be released while the deep-zone gate is unavailable');
assert.equal(bossGateMemory.targetId, null, 'boss-gate invalidation must clear retained target memory');
assert.equal(triggerFire(bossGateTargetState, 'acquire', gatedBoss.id), false, 'assisted FIRE must reject a stale boss id while the boss gate is held');

const manualFireState = prepareAcquisitionState();
const manualFireTarget = manualFireState.enemies[0]!;
Object.assign(manualFireTarget, { active: true, x: 1240, y: 500 });
manualFireState.player.aim = { x: -1, y: 0 };
assert.equal(triggerFire(manualFireState, 'manual'), true, 'manual FIRE should remain valid without acquisition');
assert.ok(manualFireState.player.aim.x < -0.99, 'manual FIRE must preserve explicit player aim');
assert.ok(manualFireState.projectiles.some(projectile => projectile.active && projectile.owner === 'player' && projectile.vx < 0), 'manual FIRE projectile should preserve the explicit firing vector');

const acquiredSkillState = prepareAcquisitionState();
const acquiredSkillTarget = acquiredSkillState.enemies[0]!;
Object.assign(acquiredSkillTarget, { active: true, x: 1240, y: 500 });
acquiredSkillState.player.aim = { x: -1, y: 0 };
assert.equal(triggerAbility(acquiredSkillState, 1, 'acquire'), true, 'targeted skills should be able to acquire before execution');
assert.ok(acquiredSkillTarget.statuses.marked > 0, 'Sensor Spike should apply to the newly acquired hostile even when the previous aim vector pointed away');
assert.ok(acquiredSkillState.player.aim.x > 0.99, 'targeted skill execution should focus the selected hostile');

const vanguardExceptionProfile = createDefaultProfile();
vanguardExceptionProfile.operatorClass = 'vanguard';
vanguardExceptionProfile.classSelectionComplete = true;
const vanguardExceptionState = createSimulation(deriveCombatBuild(vanguardExceptionProfile));
for (const enemy of vanguardExceptionState.enemies) enemy.active = false;
const vanguardExceptionTarget = vanguardExceptionState.enemies[0]!;
Object.assign(vanguardExceptionTarget, { active: true, dead: false, x: vanguardExceptionState.player.x + 180, y: vanguardExceptionState.player.y });
vanguardExceptionState.player.aim = { x: -1, y: 0 };
assert.equal(triggerAbility(vanguardExceptionState, 0, 'acquire'), true, 'mobility skills should remain executable while acquisition is enabled');
assert.ok(vanguardExceptionState.player.aim.x < -0.99 && vanguardExceptionState.player.vx < 0, 'Breach Rush must keep explicit directional aim instead of acquiring a hostile');

const guardExceptionState = createSimulation(deriveCombatBuild(vanguardExceptionProfile));
for (const enemy of guardExceptionState.enemies) enemy.active = false;
const guardExceptionTarget = guardExceptionState.enemies[0]!;
Object.assign(guardExceptionTarget, { active: true, dead: false, x: guardExceptionState.player.x + 180, y: guardExceptionState.player.y });
guardExceptionState.player.aim = { x: -1, y: 0 };
assert.equal(triggerAbility(guardExceptionState, 2, 'acquire'), true, 'self-centered skills should remain executable while acquisition is enabled');
assert.ok(guardExceptionState.player.aim.x < -0.99, 'Bulwark Pulse must not steal aim from the player');

const systemsExceptionProfile = createDefaultProfile();
systemsExceptionProfile.operatorClass = 'systems';
systemsExceptionProfile.classSelectionComplete = true;
const systemsExceptionState = createSimulation(deriveCombatBuild(systemsExceptionProfile));
for (const enemy of systemsExceptionState.enemies) enemy.active = false;
const systemsExceptionTarget = systemsExceptionState.enemies[0]!;
Object.assign(systemsExceptionTarget, { active: true, dead: false, x: systemsExceptionState.player.x + 180, y: systemsExceptionState.player.y });
systemsExceptionState.player.aim = { x: -1, y: 0 };
assert.equal(triggerAbility(systemsExceptionState, 0, 'acquire'), true, 'ground/formation skills should remain executable while acquisition is enabled');
assert.ok(systemsExceptionState.player.aim.x < -0.99, 'Polarity Well must preserve its explicit projected direction instead of snapping to a hostile');

assert.equal(abilityUsesTargetAcquisition(vanguardExceptionState, 0), false, 'Vanguard Rush is an explicit mobility action, not a targeted acquisition action');
assert.equal(abilityUsesTargetAcquisition(vanguardExceptionState, 1), true, 'Vanguard Fracture Tag should acquire a hostile');
assert.equal(abilityUsesTargetAcquisition(vanguardExceptionState, 2), false, 'Vanguard Bulwark Pulse is self-centered and must not acquire');
assert.equal(abilityUsesTargetAcquisition(systemsExceptionState, 0), false, 'Systems Polarity Well is projected explicitly and must not acquire');
assert.equal(abilityUsesTargetAcquisition(systemsExceptionState, 1), true, 'Systems Relay Hack should acquire a hostile');
assert.equal(abilityUsesTargetAcquisition(systemsExceptionState, 2), true, 'Systems Cascade Arc should acquire a hostile before routing the arc');
const neutralTargetPolicyState = createSimulation();
assert.equal(abilityUsesTargetAcquisition(neutralTargetPolicyState, 0), false, 'neutral Magnetic Impulse should remain directional');
assert.equal(abilityUsesTargetAcquisition(neutralTargetPolicyState, 1), true, 'neutral Sensor Spike should acquire');
assert.equal(abilityUsesTargetAcquisition(neutralTargetPolicyState, 2), true, 'neutral Arc Tap should acquire');
const targetingCanvasSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');
const targetingFeedbackSource = readFileSync('src/game/feedback.ts', 'utf8');
const targetingRendererSource = readFileSync('src/game/threeCombatRenderer.ts', 'utf8');
assert.match(targetingCanvasSource, /const assistedTargeting = !manualTargeting && abilityUsesTargetAcquisition\(state, index\)/, 'targeted-skill routing must still gate acquisition through the explicit targeted-skill policy');
assert.match(targetingCanvasSource, /triggerAbility\(state, index, assistedTargeting \? 'acquire' : 'manual', targetId\)/, 'targeted-skill execution must preserve manual intent while passing the retained id only for targeted abilities');
assert.match(targetingCanvasSource, /const updateAssistedTarget = useCallback[\s\S]*updateMobileTargetControl\(state, aimAssist, mobileTargetControlRef\.current\)/, 'touch and controller acquisition should share the retained target-control helper');
assert.match(targetingCanvasSource, /feedback\.cue\('targetLock'\)/, 'a real target acquisition or switch must emit the dedicated target-lock cue');
assert.match(targetingCanvasSource, /Assisted target locked:/, 'assisted target changes need a screen-reader-safe lock announcement');
assert.match(targetingCanvasSource, /className="combat-sr-status" role="status" aria-live="polite"/, 'combat must expose lock-state changes through a polite live region without making health updates live');
assert.match(targetingCanvasSource, /data-target-id=\{focusEnemy\.id\}/, 'the visible target readout must identify the same retained target used for execution');
assert.match(targetingCanvasSource, /fireCurrent\(manualTargeting \? 'manual' : 'acquire', targetId\)/, 'assisted FIRE must pass the retained target id into execution');
assert.match(targetingCanvasSource, /checkpoint && mobileTargetControlRef\.current\.targetId != null[\s\S]*Boss gate locked; assisted target released\./, 'boss-gate checkpoint transitions must release any retained assisted target instead of leaving a stale lock');
assert.match(targetingCanvasSource, /gamepadTriggerFire[\s\S]*updateAssistedTarget\(state, profileSettingsRef\.current\.aimAssist\)/, 'controller RT should share assisted acquisition when manual aim is inactive');
assert.match(targetingCanvasSource, /gamepadAimActive[\s\S]*clearAssistedTarget\('Manual controller aim active; assisted target released\.'\)/, 'controller right-stick takeover must invalidate assisted target control immediately');
assert.match(targetingCanvasSource, /canvas\.dataset\.controllerInput = gamepad \? 'connected' : 'none'/, 'browser QA must be able to observe controller activation deterministically');
assert.match(targetingCanvasSource, /targetFeedbackMotion = profileSettingsRef\.current\.effectIntensity === 'reduced' \|\| profileSettingsRef\.current\.reducedMotion \? 'reduced' : 'full'/, 'combat should expose reduced target-feedback motion for either reduced-effects or reduced-motion accessibility modes');
assert.match(targetingFeedbackSource, /targetLock: \{ frequency: 520, duration: \.065, type: 'triangle', sweep: 1\.16 \}/, 'target acquisition needs its own short audio cue');
assert.match(targetingFeedbackSource, /cue === 'targetLock' \? 8/, 'target acquisition needs a short phone haptic when haptics are enabled');
assert.match(targetingFeedbackSource, /playEffect\('dual-rumble'/, 'supported controllers should receive target feedback through their rumble actuator');
assert.match(targetingRendererSource, /reducedTargetMotion \? 1 : 1 \+ Math\.sin\(state\.time \* 8\) \* 0\.08/, 'reduced effects must freeze the 3D target-ring scale while full effects retain restrained motion');
assert.match(targetingCanvasSource, /const pulse = reducedMotion \? 0\.9 : 0\.78 \+ Math\.sin\(time \* 8\) \* 0\.1/, 'Canvas target feedback must also remove pulsing in reduced-effects mode');

function spinHabitatAssistedFireReliabilitySmoke() {
  const objective = missionObjectiveFor('gravity-stabilization', 'spin-habitat');
  const contract: Contract = {
    id: 'p18-a-spin-habitat',
    sponsor: 'longarc',
    archetype: 'stabilization',
    location: 'spin-habitat',
    locationName: locationNameFor('spin-habitat'),
    title: 'P18-A rotating habitat targeting audit',
    objective: objective.objective,
    objectiveMode: 'gravity-stabilization',
    objectiveSteps: objective.steps,
    briefing: 'Deterministic assisted-fire reliability audit.',
    conditions: [],
    conditionLabels: [],
    directorPreview: '',
    deepTarget: deepTargetForLocation('spin-habitat'),
    rewardBase: { credits: 100 },
    reputationGain: 1,
    priority: false,
    anomalyOpportunity: false,
    seed: 1818,
  };
  const state = createSimulation();
  applyMissionSetup(state, contract);
  const director = createDirector();
  for (const enemy of state.enemies) {
    enemy.active = false;
    enemy.dead = false;
    enemy.vx = 0;
    enemy.vy = 0;
  }
  const assistedMemory = createTargetControlMemory();

  const fireAndDamage = (enemyId: number, playerX: number, playerY: number, enemyX: number, enemyY: number, label: string) => {
    const enemy = state.enemies.find(candidate => candidate.id === enemyId)!;
    state.player.x = playerX;
    state.player.y = playerY;
    state.player.vx = 0;
    state.player.vy = 0;
    const dx = enemyX - playerX;
    const dy = enemyY - playerY;
    const distance = Math.hypot(dx, dy);
    state.player.aim = { x: dx / distance, y: dy / distance };
    state.player.fireCooldown = 0;
    state.player.reloadT = 0;
    state.player.ventT = 0;
    state.player.mags[state.player.currentWeapon] = Math.max(3, state.player.mags[state.player.currentWeapon]);
    Object.assign(enemy, { active: true, dead: false, x: enemyX, y: enemyY, vx: 0, vy: 0, anchored: true });
    resetTargetControlMemory(assistedMemory);
    assert.equal(updateMobileTargetControl(state, 'balanced', assistedMemory), enemy.id, label + ' should acquire a visible retained target');
    const aimBeforeShot = { ...state.player.aim };
    const durabilityBefore = enemy.hp + enemy.armor;
    assert.equal(triggerFire(state, 'acquire', enemy.id), true, label + ' should commit an aligned assisted shot');
    assert.deepEqual(state.player.aim, aimBeforeShot, label + ' should not receive a shot-time aim assignment');
    assert.ok(state.projectiles.some(projectile => projectile.active && projectile.owner === 'player'), label + ' should create a player projectile');
    for (let step = 0; step < 90 && enemy.hp + enemy.armor >= durabilityBefore; step += 1) stepSimulation(state, 1 / 120);
    assert.ok(enemy.hp + enemy.armor < durabilityBefore, label + ' projectile should damage the retained hostile');
    enemy.active = false;
    enemy.dead = true;
    for (const projectile of state.projectiles) if (projectile.owner === 'player') projectile.active = false;
  };

  assert.deepEqual(state.sectors.map(sector => sector.label), ['RIM HAB', 'SPOKE TRANSIT', 'AXIS HUB'], 'Spin Habitat must expose the authored rim/spoke/axis route');
  fireAndDamage(6, 420, 590, 610, 590, 'Rim pre-spindown fire');

  director.elapsed = 9.99;
  stepMissionDirector(state, director, contract, 0.02);
  assert.deepEqual(state.sectors.map(sector => sector.gravity), [0.08, 0.03, 0.01], '10s emergency spindown must apply the deterministic rim/spoke/axis gravity state');
  fireAndDamage(5, 900, 590, 1090, 590, 'Spoke emergency-spindown fire');

  director.elapsed = 21.99;
  stepMissionDirector(state, director, contract, 0.02);
  assert.deepEqual(state.sectors.map(sector => sector.gravity), [0.86, 0.36, 0.05], '22s recovery must restore the deterministic Spin Habitat gravity state');
  fireAndDamage(2, 1260, 700, 1430, 700, 'Spoke recovery fire');

  for (const enemy of state.enemies) {
    if (enemy.role !== 'boss') {
      enemy.active = false;
      enemy.dead = true;
    }
  }
  for (const object of state.objects) {
    if (object.id === 'gravity-control-a' || object.id === 'gravity-control-b') object.exposed = true;
  }
  state.player.x = 420;
  state.player.y = 590;
  continueIntoDeepZone(state, director);
  const boss = state.enemies.find(enemy => enemy.role === 'boss')!;
  assert.equal(state.bossGateHold, false, 'deep-zone transition must release the Spin Habitat boss gate');
  assert.equal(state.bossActive, true, 'Spin Habitat boss should become available after the deep-zone transition');
  assert.equal(boss.active, true, 'boss entity should be active once the gate opens');

  const axisRoute = findNavigationPath(state, { x: boss.x, y: boss.y });
  assert.equal(axisRoute.complete, true, 'opened Spin Habitat must expose a complete rim-to-axis navigation route');
  const routeCrossesSector = (sectorLabel: string) => {
    const sector = state.sectors.find(candidate => candidate.label === sectorLabel)!;
    return axisRoute.points.some((point, index) => {
      const next = axisRoute.points[index + 1] ?? point;
      const minX = Math.min(point.x, next.x);
      const maxX = Math.max(point.x, next.x);
      const minY = Math.min(point.y, next.y);
      const maxY = Math.max(point.y, next.y);
      return maxX >= sector.x && minX <= sector.x + sector.w && maxY >= sector.y && minY <= sector.y + sector.h;
    });
  };
  assert.ok(routeCrossesSector('RIM HAB') && routeCrossesSector('SPOKE TRANSIT') && routeCrossesSector('AXIS HUB'), 'rim-to-boss route segments must cross the rim, spoke, and axis spaces');

  let bossLockPoint = axisRoute.points[0]!;
  let bossLocked = false;
  for (let index = axisRoute.points.length - 2; index >= 0; index -= 1) {
    const point = axisRoute.points[index]!;
    state.player.x = point.x;
    state.player.y = point.y;
    const dx = boss.x - point.x;
    const dy = boss.y - point.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) continue;
    state.player.aim = { x: dx / distance, y: dy / distance };
    resetTargetControlMemory(assistedMemory);
    if (updateMobileTargetControl(state, 'balanced', assistedMemory) === boss.id) {
      bossLockPoint = point;
      bossLocked = true;
      break;
    }
  }
  assert.equal(bossLocked, true, 'assisted targeting should reacquire the boss only after the gate opens');
  const bossDurabilityBefore = boss.hp + boss.armor;
  state.player.x = bossLockPoint.x;
  state.player.y = bossLockPoint.y;
  state.player.fireCooldown = 0;
  const bossAimBefore = { ...state.player.aim };
  assert.equal(triggerFire(state, 'acquire', boss.id), true, 'aligned assisted FIRE should remain reliable after boss availability');
  assert.deepEqual(state.player.aim, bossAimBefore, 'post-gate boss fire must preserve smooth target-control aim');
  assert.ok(state.projectiles.some(projectile => projectile.active && projectile.owner === 'player'), 'post-gate boss fire should create a player projectile');
  for (let step = 0; step < 120 && boss.hp + boss.armor >= bossDurabilityBefore; step += 1) stepSimulation(state, 1 / 120);
  assert.ok(boss.hp + boss.armor < bossDurabilityBefore, 'post-gate assisted projectile should damage the Spin Habitat boss');
}
spinHabitatAssistedFireReliabilitySmoke();

const damageNumberState = createSimulation();
for (const enemy of damageNumberState.enemies) enemy.active = false;
const damageTarget = damageNumberState.enemies.find(enemy => enemy.id === 1)!;
damageTarget.active = true;
damageTarget.dead = false;
damageTarget.x = damageNumberState.player.x + 120;
damageTarget.y = damageNumberState.player.y;
damageTarget.armor = 38;
damageTarget.hp = 76;
damageNumberState.player.aim = { x: 1, y: 0 };
assert.equal(triggerAbility(damageNumberState, 0), true, 'Magnetic Impulse should provide a deterministic enemy hit for damage-number coverage');
const armorPopup = damageNumberState.damageNumbers.find(item => item.active);
assert.ok(armorPopup, 'enemy damage should spawn a floating damage number');
assert.equal(armorPopup.kind, 'armor', 'armored hits should use the armor damage-number treatment');
assert.ok(armorPopup.value >= 1, 'damage number should report actual applied durability loss');
for (let index = 0; index < 50; index += 1) stepSimulation(damageNumberState, 1 / 60);
assert.equal(damageNumberState.damageNumbers.some(item => item.active), false, 'floating damage numbers should expire instead of accumulating');

const perseidCampaign = { ...createDefaultCampaign(), cycle: 3, contractsCompleted: 3 };
const perseidContract = generateContracts(perseidCampaign).find(contract => contract.megastructure === 'generation-ship');
assert.ok(perseidContract, 'P4 Perseid must remain available as the first rare megastructure rotation.');
assert.deepEqual(perseidContract.megastructureZoneNames, ['Docking Spine', 'Agricultural Drum', 'Cryogenic Service Deck', 'Reactor Choir'], 'Perseid must preserve its authored four-space traverse.');
const perseidPartialDebrief = buildMegastructureDebrief(perseidContract, { zonesCompleted: 2, optionalRecovered: 1 }, 'safe');
assert.ok(perseidPartialDebrief, 'P4.17 must derive a megastructure after-action report from existing expedition state.');
assert.equal(perseidPartialDebrief.completion, 'partial', 'A checkpoint extraction must remain visibly distinct from a full megastructure traverse.');
assert.deepEqual(perseidPartialDebrief.stages.map(stage => stage.secured), [true, true, false, false], 'P4.17 route recap must show exactly which connected spaces were secured.');
assert.match(perseidPartialDebrief.continuityNotes[0]?.detail ?? '', /pressure debt follows/i, 'P4.17 debrief must retain authored environmental continuity consequences.');
assert.equal(perseidPartialDebrief.optionalRecovered, 1, 'P4.17 debrief must report banked optional recovery count without inventing per-stage recovery state.');

const perseidSafeDebrief = buildMegastructureDebrief(perseidContract, { zonesCompleted: 4, optionalRecovered: 3 }, 'safe');
assert.equal(perseidSafeDebrief?.finaleLabel, 'COMMAND ZONE LEFT SEALED', 'A full safe Perseid traverse must not imply that the optional boss was defeated.');
const perseidDeepDebrief = buildMegastructureDebrief(perseidContract, { zonesCompleted: 4, optionalRecovered: 4 }, 'deep');
assert.equal(perseidDeepDebrief?.completion, 'deep', 'A completed command-zone breach must receive the deep expedition outcome.');
assert.equal(perseidDeepDebrief?.finaleLabel, 'PERSEID STEWARD CORE', 'Deep megastructure debrief must identify the defeated authored command target.');

const perseidBuild = deriveCombatBuild({ ...createDefaultProfile(), operatorClass: 'vanguard', classSelectionComplete: true });
const perseidStage1 = getMegastructureStageContract(perseidContract, 0);
const perseidStage1State = createSimulation(perseidBuild);
applyMissionSetup(perseidStage1State, perseidStage1);
assert.deepEqual(perseidStage1State.sectors.map(sector => sector.label), ['BERTH COLLAR', 'DOCKING SPINE', 'INNER AIRLOCK'], 'Perseid stage 1 must override the reused vessel labels with generation-ship compartments.');
assert.equal(perseidStage1State.objects.find(object => object.id === 'mega-optional-cache')?.label, 'Crew archive canister', 'Perseid stage 1 must retain its bespoke optional recovery.');

const perseidStage2 = getMegastructureStageContract(perseidContract, 1);
const perseidStage2State = createSimulation(perseidBuild);
applyMissionSetup(perseidStage2State, perseidStage2);
assert.deepEqual(perseidStage2State.sectors.map(sector => sector.label), ['OUTER DRUM', 'AGRICULTURAL RING', 'SEED VAULT'], 'Perseid stage 2 must read as the agricultural drum rather than generic Spin Habitat.');
assert.equal(perseidStage2State.enemies.find(enemy => enemy.id === 6)?.label, 'Perseid Drum Warder', 'Perseid stage 2 must keep its guaranteed ship-specific elite.');
assert.match(perseidStage2.megastructureTransitionRoute ?? '', /KEEL TRAM/, 'Perseid stage 2 must expose the authored physical transit route from the docking spine.');
assert.match(perseidStage2.megastructureArrivalCue ?? '', /ROTATION SYNCED/, 'Perseid stage 2 must expose a destination-specific arrival cue.');

const perseidStage3 = getMegastructureStageContract(perseidContract, 2);
const perseidStage3State = createSimulation(perseidBuild);
applyMissionSetup(perseidStage3State, perseidStage3);
assert.deepEqual(perseidStage3State.sectors.map(sector => sector.label), ['CRYOBANK FORE', 'SERVICE DECK', 'REGISTRY VAULT'], 'Perseid stage 3 must read as a cryogenic service deck.');

const perseidStage4 = getMegastructureStageContract(perseidContract, 3);
const perseidStage4State = createSimulation(perseidBuild);
applyMissionSetup(perseidStage4State, perseidStage4);
assert.deepEqual(perseidStage4State.sectors.map(sector => sector.label), ['REACTOR NAVE', 'CHOIR BUS', 'STEWARD APSE'], 'Perseid stage 4 must read as the Reactor Choir.');
const perseidSteward = perseidStage4State.enemies.find(enemy => enemy.role === 'boss');
assert.equal(perseidSteward?.label, 'Perseid Steward Core', 'Perseid final deep target must retain its authored identity.');
assert.equal(perseidSteward?.variant, 'perseidSteward', 'Perseid Steward Core must use its dedicated boss behavior.');
assert.equal(perseidSteward?.maxHp, 790, 'Perseid Steward Core must retain its capstone durability budget.');

const perseidDirector = createDirector();
stepMissionDirector(perseidStage1State, perseidDirector, perseidStage1, 7.1);
assert.equal(perseidDirector.megastructureEventA, true, 'Perseid stage events must run independently of reused biome event slots.');
assert.ok(perseidStage1State.hazards.some(hazard => hazard.active), 'An unresolved Perseid stage event must produce a physical local hazard.');

const k91Campaign = { ...createDefaultCampaign(), cycle: 8, contractsCompleted: 3 };
const k91Contract = generateContracts(k91Campaign).find(contract => contract.megastructure === 'counterweight');
assert.ok(k91Contract, 'P4 K-91 must remain available as the second rare megastructure rotation.');
assert.deepEqual(k91Contract.megastructureZoneNames, ['Capture Collar', 'Mass Transit Spine', 'Power Transfer Gallery', 'Ballast Vault'], 'K-91 must preserve its authored four-space counterweight traverse.');
assert.equal(k91Contract.megastructureBossTarget, undefined, 'K-91 must remain a bossless survival traverse rather than inheriting a generic command target.');
const k91Debrief = buildMegastructureDebrief(k91Contract, { zonesCompleted: 4, optionalRecovered: 2 }, 'safe');
assert.equal(k91Debrief?.outcomeLabel, 'BOSSLESS TRAVERSE COMPLETE', 'P4.17 must describe K-91 as a survival/recovery capstone rather than imply a missing boss.');
assert.equal(k91Debrief?.finaleLabel, 'FINAL RECOVERY SPACE SECURED', 'K-91 debrief must resolve the authored Ballast Vault finale cleanly.');

const k91Stage1 = getMegastructureStageContract(k91Contract, 0);
const k91Stage1State = createSimulation(perseidBuild);
applyMissionSetup(k91Stage1State, k91Stage1);
assert.deepEqual(k91Stage1State.sectors.map(sector => sector.label), ['CAPTURE RIM', 'TETHER THROAT', 'COLLAR LOCK'], 'K-91 stage 1 must read as a counterweight capture collar.');
assert.equal(k91Stage1State.objects.find(object => object.id === 'mega-optional-cache')?.label, 'Tether-load recorder', 'K-91 stage 1 must retain its bespoke optional recovery.');

const k91Stage2 = getMegastructureStageContract(k91Contract, 1);
const k91Stage2State = createSimulation(perseidBuild);
applyMissionSetup(k91Stage2State, k91Stage2);
assert.deepEqual(k91Stage2State.sectors.map(sector => sector.label), ['FORE MASS RAIL', 'TRANSIT SPINE', 'COUNTERMASS BAY'], 'K-91 stage 2 must read as the mass transit spine rather than generic Spin Habitat.');
assert.equal(k91Stage2State.enemies.find(enemy => enemy.id === 6)?.label, 'K-91 Mass-Transit Warden', 'K-91 stage 2 must keep a counterweight-specific guaranteed elite.');

const k91Stage3 = getMegastructureStageContract(k91Contract, 2);
const k91Stage3State = createSimulation(perseidBuild);
applyMissionSetup(k91Stage3State, k91Stage3);
assert.deepEqual(k91Stage3State.sectors.map(sector => sector.label), ['LIFT BUS FORE', 'POWER TRANSFER', 'ISOLATION GALLERY'], 'K-91 stage 3 must read as the power transfer gallery.');

const k91Stage4 = getMegastructureStageContract(k91Contract, 3);
const k91Stage4State = createSimulation(perseidBuild);
applyMissionSetup(k91Stage4State, k91Stage4);
assert.deepEqual(k91Stage4State.sectors.map(sector => sector.label), ['BALLAST APPROACH', 'MASS VAULT', 'BLACKBOX WELL'], 'K-91 stage 4 must read as the ballast vault.');
assert.match(k91Stage4.megastructureTransitionRoute ?? '', /BALLAST SERVICE TRUNK/, 'K-91 final transition must preserve the counterweight physical route into the ballast vault.');
assert.equal(k91Stage4.megastructureBossTarget, undefined, 'K-91 Ballast Vault must finish through traversal and recovery, not an optional boss breach.');

const k91Director = createDirector();
stepMissionDirector(k91Stage1State, k91Director, k91Stage1, 7.1);
assert.equal(k91Director.megastructureEventA, true, 'K-91 stage events must run independently of reused biome event slots.');
assert.match(k91Stage1State.eventText, /K-91 TUMBLE SOLUTION/, 'K-91 stage 1 must announce its counterweight tumble event.');
assert.ok(k91Stage1State.hazards.some(hazard => hazard.active), 'An unresolved K-91 stage event must produce a physical inertial hazard.');

const k91FinalDirector = createDirector();
// Asteroid Refinery may publish its own forecast after the K-91 event, so assert durable runtime state rather than the last alert string.
stepMissionDirector(k91Stage4State, k91FinalDirector, k91Stage4, 7.1);
assert.equal(k91FinalDirector.megastructureEventA, true, 'K-91 Ballast Vault must trigger its dedicated capstone event even when biome forecast text follows it.');
assert.ok(k91Stage4State.hazards.some(hazard => hazard.active && hazard.kind === 'gravityWell'), 'K-91 final stage must preserve a bossless ballast-shift gravity hazard.');

const orphelineCampaign = { ...createDefaultCampaign(), cycle: 13, contractsCompleted: 3 };
const orphelineContract = generateContracts(orphelineCampaign).find(contract => contract.megastructure === 'hidden-habitat');
assert.ok(orphelineContract, 'P4 Orpheline must remain available as the third rare megastructure rotation.');
assert.deepEqual(orphelineContract.megastructureZoneNames, ['Ice Access Bore', 'Industrial Commons', 'Residential Spin Ring', 'Buried Control Vault'], 'Orpheline must preserve its authored four-space hidden-habitat traverse.');
assert.equal(orphelineContract.megastructureBossTarget, 'Orpheline Habitat Warden', 'Orpheline must retain the Habitat Warden as its deep finale.');

const orphelineStage1 = getMegastructureStageContract(orphelineContract, 0);
const orphelineStage1State = createSimulation(perseidBuild);
applyMissionSetup(orphelineStage1State, orphelineStage1);
assert.deepEqual(orphelineStage1State.sectors.map(sector => sector.label), ['SHADOW BORE', 'CUT TUNNEL', 'HABITAT HATCH'], 'Orpheline stage 1 must read as a concealed habitat access route rather than a generic ice mine.');
assert.equal(orphelineStage1State.objects.find(object => object.id === 'mega-optional-cache')?.label, 'Unregistered transit ledger', 'Orpheline stage 1 must retain its bespoke optional recovery.');

const orphelineStage2 = getMegastructureStageContract(orphelineContract, 1);
const orphelineStage2State = createSimulation(perseidBuild);
applyMissionSetup(orphelineStage2State, orphelineStage2);
assert.deepEqual(orphelineStage2State.sectors.map(sector => sector.label), ['FABRICATOR ROW', 'INDUSTRIAL COMMONS', 'SERVICE MARKET'], 'Orpheline stage 2 must read as the improvised Industrial Commons.');
assert.equal(orphelineStage2State.enemies.find(enemy => enemy.id === 6)?.label, 'Orpheline Commons Custodian', 'Orpheline stage 2 must keep a habitat-specific guaranteed elite.');

const orphelineStage3 = getMegastructureStageContract(orphelineContract, 2);
const orphelineStage3State = createSimulation(perseidBuild);
applyMissionSetup(orphelineStage3State, orphelineStage3);
assert.deepEqual(orphelineStage3State.sectors.map(sector => sector.label), ['OUTER HAB RING', 'RESIDENTIAL SPIN', 'SHELTER SPOKE'], 'Orpheline stage 3 must read as an occupied-scale residential ring.');

const orphelineStage4 = getMegastructureStageContract(orphelineContract, 3);
const orphelineStage4State = createSimulation(perseidBuild);
applyMissionSetup(orphelineStage4State, orphelineStage4);
assert.deepEqual(orphelineStage4State.sectors.map(sector => sector.label), ['FOUNDERS APPROACH', 'CONTROL VAULT', 'WARDEN CHAMBER'], 'Orpheline stage 4 must read as the buried founding control vault.');
assert.match(orphelineStage4.megastructureTransitionDetail ?? '', /founder shaft/i, 'Orpheline final transition must explain how the residential ring physically connects to the buried vault.');
const orphelineWarden = orphelineStage4State.enemies.find(enemy => enemy.role === 'boss');
assert.equal(orphelineWarden?.label, 'Orpheline Habitat Warden', 'Orpheline final deep target must retain its authored identity.');
assert.equal(orphelineWarden?.variant, 'orphelineWarden', 'Orpheline Habitat Warden must use its dedicated boss behavior.');
assert.equal(orphelineWarden?.maxHp, 770, 'Orpheline Habitat Warden must retain its capstone durability budget.');

const orphelineDirector = createDirector();
stepMissionDirector(orphelineStage1State, orphelineDirector, orphelineStage1, 7.1);
assert.equal(orphelineDirector.megastructureEventA, true, 'Orpheline stage events must run independently of reused biome event slots.');
// Ice Mine may publish its own forecast after the Orpheline event, so assert durable runtime state instead of the last alert string.
assert.ok(orphelineStage1State.hazards.some(hazard => hazard.active && hazard.kind === 'vectorWash'), 'An unresolved Orpheline access event must produce a physical venting hazard.');

const hecateCampaign = { ...createDefaultCampaign(), cycle: 18, contractsCompleted: 3 };
const hecateContract = generateContracts(hecateCampaign).find(contract => contract.megastructure === 'shipbreaking-yard');
assert.ok(hecateContract, 'P4 Hecate must remain available as the fourth rare megastructure rotation.');
assert.deepEqual(hecateContract.megastructureZoneNames, ['Sunward Clamp Field', 'Crusher Causeway', 'Wreck Transit', 'Yard Control Crown'], 'Hecate must preserve its authored four-space shipbreaking-yard traverse.');
assert.equal(hecateContract.megastructureBossTarget, 'Hecate Yardmaster Null', 'Hecate must retain Yardmaster Null as its deep finale.');

const hecateStage1 = getMegastructureStageContract(hecateContract, 0);
const hecateStage1State = createSimulation(perseidBuild);
applyMissionSetup(hecateStage1State, hecateStage1);
assert.deepEqual(hecateStage1State.sectors.map(sector => sector.label), ['CLAMP APPROACH', 'SUNWARD FIELD', 'HULL CRADLE'], 'Hecate stage 1 must read as the sunward clamp field rather than generic Solar Yard.');
assert.equal(hecateStage1State.objects.find(object => object.id === 'mega-optional-cache')?.label, 'Clamp-control spindle', 'Hecate stage 1 must retain its bespoke optional recovery.');

const hecateStage2 = getMegastructureStageContract(hecateContract, 1);
const hecateStage2State = createSimulation(perseidBuild);
applyMissionSetup(hecateStage2State, hecateStage2);
assert.deepEqual(hecateStage2State.sectors.map(sector => sector.label), ['CUTTER RUN', 'CRUSHER CAUSEWAY', 'SCRAP PRESS'], 'Hecate stage 2 must read as the live crusher causeway.');
assert.equal(hecateStage2State.enemies.find(enemy => enemy.id === 6)?.label, 'Hecate Crusher Foreman', 'Hecate stage 2 must keep a shipbreaking-specific guaranteed elite.');

const hecateStage3 = getMegastructureStageContract(hecateContract, 2);
const hecateStage3State = createSimulation(perseidBuild);
applyMissionSetup(hecateStage3State, hecateStage3);
assert.deepEqual(hecateStage3State.sectors.map(sector => sector.label), ['WRECK FORE', 'OPEN TRANSIT', 'PRESSURE HULKS'], 'Hecate stage 3 must read as an exposed wreck-transit chain.');
assert.match(hecateStage3.megastructureTransitionRoute ?? '', /OPEN PRESSURE BRIDGE/, 'Hecate stage 3 must expose the physical bridge from the cutter line into the wreck chain.');

const hecateStage4 = getMegastructureStageContract(hecateContract, 3);
const hecateStage4State = createSimulation(perseidBuild);
applyMissionSetup(hecateStage4State, hecateStage4);
assert.deepEqual(hecateStage4State.sectors.map(sector => sector.label), ['CROWN APPROACH', 'YARD CONTROL', 'NULL GANTRY'], 'Hecate stage 4 must read as the yard control crown.');
const hecateYardmaster = hecateStage4State.enemies.find(enemy => enemy.role === 'boss');
assert.equal(hecateYardmaster?.label, 'Hecate Yardmaster Null', 'Hecate final deep target must retain its authored identity.');
assert.equal(hecateYardmaster?.variant, 'hecateYardmaster', 'Hecate Yardmaster Null must use its dedicated boss behavior.');
assert.equal(hecateYardmaster?.maxHp, 790, 'Hecate Yardmaster Null must retain its capstone durability budget.');

const hecateDirector = createDirector();
stepMissionDirector(hecateStage1State, hecateDirector, hecateStage1, 7.1);
assert.equal(hecateDirector.megastructureEventA, true, 'Hecate stage events must run independently of reused biome event slots.');
assert.ok(hecateStage1State.hazards.some(hazard => hazard.active && hazard.kind === 'vectorWash'), 'An unresolved Hecate clamp-field event must produce a physical hull-cradle sweep.');

const hecateWreckDirector = createDirector();
stepMissionDirector(hecateStage3State, hecateWreckDirector, hecateStage3, 7.1);
assert.ok(hecateStage3State.breaches.some(breach => breach.id === 'service-breach' && breach.active), 'Hecate Wreck Transit must open a physical pressure breach.');
assert.ok(hecateStage3State.hazards.some(hazard => hazard.active && hazard.kind === 'vectorWash'), 'Hecate Wreck Transit must expose a decompression vector across the wreck chain.');

if (!hecateYardmaster) throw new Error('Hecate Yardmaster Null missing from final stage setup.');
hecateYardmaster.active = true;
hecateStage4State.bossActive = true;
hecateYardmaster.hp = hecateYardmaster.maxHp * 0.49;
stepSimulation(hecateStage4State, 0.1);
assert.equal(hecateYardmaster.bossPhase, 2, 'Hecate Yardmaster Null must enter its dedicated cutter-grid phase at half health.');
assert.ok(hecateStage4State.hazards.some(hazard => hazard.active && (hazard.kind === 'shockGrid' || hazard.kind === 'vectorWash')), 'Hecate Yardmaster phase two must reshape the control crown with live shipbreaking hazards.');

const expeditionLootSource = [{ id: 'stage-1-drop', enemyId: 7, enemyLabel: 'Stage One Elite', rarity: 'Prototype' as const, source: 'elite' as const, recoveryQualityFloor: 3 as const, recoveryLevel: 24, monsterLevel: 8 }];
const expeditionLootCarry = carryExpeditionLoot(expeditionLootSource);
assert.deepEqual(expeditionLootCarry, expeditionLootSource, 'megastructure stage transit should preserve every collected field-loot receipt');
assert.notEqual(expeditionLootCarry, expeditionLootSource, 'stage transit should copy the receipt list instead of sharing the mutable array');
assert.notEqual(expeditionLootCarry[0], expeditionLootSource[0], 'stage transit should copy individual receipts so later mutation cannot rewrite earlier-stage recovery data');
const appSource = readFileSync('src/App.tsx', 'utf8');
assert.match(appSource, /MEGASTRUCTURE EXPEDITION \/\/ AFTER-ACTION/, 'P4.17 must render a dedicated megastructure after-action surface in the mission debrief.');
assert.match(appSource, /ENVIRONMENTAL CONTINUITY OBSERVED/, 'P4.17 debrief must expose inherited environmental consequences instead of reducing the expedition to a zone count.');
const debriefCssSource = readFileSync('src/part4.css', 'utf8');
assert.match(debriefCssSource, /\.expedition-route/, 'P4.17 must provide a responsive route recap layout for the megastructure debrief.');
assert.match(debriefCssSource, /@media \(max-width: 520px\)[\s\S]*\.expedition-route \{ grid-template-columns: 1fr 1fr; \}/, 'P4.17 route recap must collapse for narrow mobile surfaces.');
const gameCanvasSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');
assert.match(gameCanvasSource, /state\.collectedLoot = carryExpeditionLoot\(carry\.collectedLoot\);/, 'GameCanvas must carry collected expedition loot into each new megastructure stage');
assert.match(gameCanvasSource, /const \[pendingTransit, setPendingTransit\] = useState<PendingMegastructureTransit>/, 'GameCanvas must stage megastructure travel through an explicit transit briefing instead of teleporting immediately.');
assert.match(gameCanvasSource, /megastructureTransitionRoute/, 'The transit briefing must render authored physical route metadata.');
assert.match(gameCanvasSource, /megastructureArrivalCue/, 'The transit briefing must render the destination arrival cue.');
assert.match(gameCanvasSource, /completeMegastructureTransit/, 'The player must explicitly commit the staged transit before the next combat space is created.');

failStorageWrites = true;
assert.equal(saveCampaign(campaign), false, 'campaign persistence should report blocked storage without throwing');
assert.equal(saveProfile(createDefaultProfile()), false, 'profile persistence should report blocked storage without throwing');
failStorageWrites = false;

storage.clear();
const atomicProfile = createDefaultProfile();
assert.equal(atomicProfile.classSelectionComplete, false, 'Only truly fresh profiles should start before class intake.');
atomicProfile.xp = 111;
const atomicCampaign = createDefaultCampaign();
atomicCampaign.resources.credits = 777;
assert.equal(saveGameState(atomicProfile, atomicCampaign, localStorage), true, 'combined game state should commit profile and campaign in one storage write');
const committedEnvelope = localStorage.getItem(GAME_STATE_STORAGE_KEY);
assert.ok(committedEnvelope, 'combined persistence should create a versioned game-state envelope');
const nextAtomicProfile = { ...atomicProfile, xp: 222 };
const nextAtomicCampaign = { ...atomicCampaign, resources: { ...atomicCampaign.resources, credits: 888 } };
failStorageWrites = true;
assert.equal(saveGameState(nextAtomicProfile, nextAtomicCampaign, localStorage), false, 'failed combined persistence should report the failed transaction');
failStorageWrites = false;
assert.equal(localStorage.getItem(GAME_STATE_STORAGE_KEY), committedEnvelope, 'a failed transaction must leave the previous committed envelope byte-for-byte intact');
const reloadedAtomic = loadGameState(localStorage);
assert.equal(reloadedAtomic.profile.xp, 111, 'failed persistence must not expose the newer profile without its matching campaign');
assert.equal(reloadedAtomic.campaign.resources.credits, 777, 'failed persistence must not expose the newer campaign without its matching profile');

storage.clear();
const preClassProfile = createDefaultProfile();
delete preClassProfile.operatorClass;
delete preClassProfile.classSelectionComplete;
preClassProfile.level = 15;
preClassProfile.xp = 7140;
preClassProfile.specialization = 'grid-weaver';
const preClassCampaign = createDefaultCampaign();
preClassProfile.equipped = { ...preClassProfile.equipped, carbine: 'starter-carbine', breacher: 'starter-breacher', rail: 'starter-rail' };
localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify({ version: 1, profile: preClassProfile, campaign: preClassCampaign, savedAt: '2026-09-18T00:00:00.000Z' }));
const classMigrated = loadGameState(localStorage);
assert.equal(classMigrated.profile.operatorClass, 'systems', 'Existing atomic saves should infer a compatible operator class from their specialization instead of resetting progress.');
assert.equal(classMigrated.profile.specialization, 'grid-weaver', 'Class migration must preserve an existing specialization.');
assert.equal(classMigrated.profile.classSelectionComplete, true, 'Existing atomic saves should not be forced back through first-run class intake.');
assert.equal(classMigrated.profile.equipped.carbine, 'starter-carbine', 'Atomic save migration should equip the inferred Systems Carbine.');
assert.equal(classMigrated.profile.equipped.breacher, null, 'Atomic save migration should move incompatible Breachers to storage.');
assert.equal(classMigrated.profile.equipped.rail, null, 'Atomic save migration should move incompatible Rails to storage.');

storage.clear();
const legacyProfile = createDefaultProfile();
legacyProfile.xp = 63;
const legacyAtomicCampaign = createDefaultCampaign();
legacyAtomicCampaign.resources.credits = 432;
assert.equal(saveProfile(legacyProfile), true);
assert.equal(saveCampaign(legacyAtomicCampaign), true);
const migratedAtomic = loadGameState(localStorage);
assert.equal(migratedAtomic.profile.xp, 63, 'combined persistence should migrate from the existing profile key when no envelope exists');
assert.equal(migratedAtomic.campaign.resources.credits, 432, 'combined persistence should migrate from the existing campaign key when no envelope exists');

storage.clear();
const legacyClasslessProfile = createDefaultProfile();
delete legacyClasslessProfile.operatorClass;
delete legacyClasslessProfile.classSelectionComplete;
legacyClasslessProfile.level = 15;
legacyClasslessProfile.xp = 7140;
legacyClasslessProfile.specialization = 'grid-weaver';
localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(legacyClasslessProfile));
const inferredLegacyClass = loadProfile();
assert.equal(inferredLegacyClass.operatorClass, 'systems', 'Legacy profile-key saves should infer class from their existing specialization.');
assert.equal(inferredLegacyClass.specialization, 'grid-weaver', 'Legacy class inference must preserve specialization state.');
assert.equal(inferredLegacyClass.classSelectionComplete, true, 'Legacy profile-key saves should be treated as already onboarded.');

async function runSaveRecoveryRegressions() {
  storage.clear();
  const validProfileRaw = JSON.stringify(createDefaultProfile());
  localStorage.setItem(PROFILE_STORAGE_KEY, validProfileRaw);
  const validRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => new Date('2026-09-16T12:00:00.000Z'), id: () => 'valid' });
  assert.equal(validRecovery.blocked, false, 'valid saves should not block startup');
  assert.equal(validRecovery.backups.length, 0, 'valid saves should not be copied into recovery storage');
  assert.equal(localStorage.getItem(PROFILE_STORAGE_KEY), validProfileRaw, 'valid saves should remain untouched');

  storage.clear();
  const defaultProfile = createDefaultProfile();
  const malformedProfileRaw = JSON.stringify({
    ...defaultProfile,
    inventory: defaultProfile.inventory.map((item, index) => index === 0 ? { ...item, augments: ['future-unknown-augment'] } : item),
  });
  localStorage.setItem(PROFILE_STORAGE_KEY, malformedProfileRaw);
  const malformedProfileRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => new Date('2026-09-16T12:01:00.000Z'), id: () => 'profile' });
  assert.equal(malformedProfileRecovery.blocked, false, 'a malformed profile should start only after its raw data is backed up');
  assert.equal(localStorage.getItem(PROFILE_STORAGE_KEY), null, 'unsafe profile save should be detached before the normal loader can replace it');
  const profileBackup = malformedProfileRecovery.backups.find(backup => backup.kind === 'profile');
  assert.ok(profileBackup, 'malformed profile should produce a recovery backup');
  assert.equal(localStorage.getItem(profileBackup.backupKey), malformedProfileRaw, 'profile recovery backup must preserve the exact original bytes');
  assert.deepEqual(loadProfile(), createDefaultProfile(), 'normal profile loading should see a clean slot after quarantine');

  storage.clear();
  const mismatchedEquipmentProfile = createDefaultProfile();
  mismatchedEquipmentProfile.equipped.carbine = 'starter-suit';
  const mismatchedEquipmentRaw = JSON.stringify(mismatchedEquipmentProfile);
  localStorage.setItem(PROFILE_STORAGE_KEY, mismatchedEquipmentRaw);
  const equipmentRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => new Date('2026-09-16T12:01:30.000Z'), id: () => 'equipment' });
  assert.equal(equipmentRecovery.blocked, false, 'an equipped-slot mismatch should be quarantined after backup');
  assert.equal(localStorage.getItem(PROFILE_STORAGE_KEY), null, 'mismatched equipment must not reach the normal profile loader');
  assert.ok(equipmentRecovery.backups.some(backup => backup.kind === 'profile'), 'mismatched equipment should create a profile recovery backup');

  storage.clear();
  const incompatibleCampaignRaw = JSON.stringify({ ...createDefaultCampaign(), version: 99 });
  localStorage.setItem(CAMPAIGN_STORAGE_KEY, incompatibleCampaignRaw);
  const campaignRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => new Date('2026-09-16T12:02:00.000Z'), id: () => 'campaign' });
  assert.equal(campaignRecovery.blocked, false, 'an incompatible campaign should be quarantined before startup');
  assert.equal(localStorage.getItem(CAMPAIGN_STORAGE_KEY), null, 'incompatible campaign should be detached from the primary key');
  const campaignBackup = campaignRecovery.backups.find(backup => backup.kind === 'campaign');
  assert.ok(campaignBackup, 'incompatible campaign should produce a recovery backup');
  assert.equal(localStorage.getItem(campaignBackup.backupKey), incompatibleCampaignRaw, 'campaign recovery backup must preserve the exact original bytes');
  assert.deepEqual(loadCampaign(), createDefaultCampaign(), 'normal campaign loading should see a clean slot after quarantine');

  storage.clear();
  const invalidUpgradeCampaign = createDefaultCampaign();
  invalidUpgradeCampaign.shipUpgrades.reactor = 9;
  const invalidUpgradeRaw = JSON.stringify(invalidUpgradeCampaign);
  localStorage.setItem(CAMPAIGN_STORAGE_KEY, invalidUpgradeRaw);
  const upgradeRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => new Date('2026-09-16T12:02:15.000Z'), id: () => 'upgrade' });
  assert.equal(upgradeRecovery.blocked, false, 'out-of-range ship upgrades should be quarantined after backup');
  assert.equal(localStorage.getItem(CAMPAIGN_STORAGE_KEY), null, 'invalid upgrade state must not reach campaign loading');
  assert.ok(upgradeRecovery.backups.some(backup => backup.kind === 'campaign'), 'invalid upgrade state should create a campaign recovery backup');

  storage.clear();
  const incompatibleStateRaw = JSON.stringify({ version: 1, profile: createDefaultProfile(), campaign: { ...createDefaultCampaign(), version: 99 }, savedAt: '2026-09-16T12:02:30.000Z' });
  localStorage.setItem(GAME_STATE_STORAGE_KEY, incompatibleStateRaw);
  const stateRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => new Date('2026-09-16T12:02:30.000Z'), id: () => 'state' });
  assert.equal(stateRecovery.blocked, false, 'an incompatible combined state should be quarantined before startup');
  assert.equal(localStorage.getItem(GAME_STATE_STORAGE_KEY), null, 'unsafe combined state should be detached before the game loader can use it');
  const stateBackup = stateRecovery.backups.find(backup => backup.kind === 'state');
  assert.ok(stateBackup, 'invalid combined state should produce a recovery backup');
  assert.equal(localStorage.getItem(stateBackup.backupKey), incompatibleStateRaw, 'combined state recovery must preserve the exact original bytes');

  storage.clear();
  const invalidTimestampStateRaw = JSON.stringify({ version: 1, profile: createDefaultProfile(), campaign: createDefaultCampaign(), savedAt: 'not-a-date' });
  localStorage.setItem(GAME_STATE_STORAGE_KEY, invalidTimestampStateRaw);
  const timestampRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => new Date('2026-09-16T12:02:45.000Z'), id: () => 'timestamp' });
  assert.equal(timestampRecovery.blocked, false, 'invalid envelope metadata should be quarantined after backup');
  assert.equal(localStorage.getItem(GAME_STATE_STORAGE_KEY), null, 'invalid envelope metadata must not reach the combined-state loader');
  assert.ok(timestampRecovery.backups.some(backup => backup.kind === 'state'), 'invalid envelope metadata should create a state recovery backup');

  storage.clear();
  const unreadableRaw = '{bad-profile-json';
  localStorage.setItem(PROFILE_STORAGE_KEY, unreadableRaw);
  failBackupWrites = true;
  const blockedRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => new Date('2026-09-16T12:03:00.000Z'), id: () => 'blocked' });
  failBackupWrites = false;
  assert.equal(blockedRecovery.blocked, true, 'startup must stop if an unreadable save cannot be backed up');
  assert.equal(localStorage.getItem(PROFILE_STORAGE_KEY), unreadableRaw, 'failed backup must leave the original save untouched');
  assert.equal(blockedRecovery.backups.length, 0, 'a failed copy must never be reported as a verified backup');

  return malformedProfileRecovery.backups.length + equipmentRecovery.backups.length + campaignRecovery.backups.length + upgradeRecovery.backups.length + stateRecovery.backups.length + timestampRecovery.backups.length;
}

runSaveRecoveryRegressions()
  .then(saveRecoveryCount => console.log(`GAMEPLAY_REGRESSIONS_PASS credits=${campaign.resources.credits} med=${campaign.consumables.medGel} hp=${deathState.player.hp} aim=${aimState.player.aim.x.toFixed(3)} expeditionLoot=${expeditionLootCarry.length} saveRecovery=${saveRecoveryCount} transactional=1`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });

function weaponHandlingIdentitySmoke() {
  const families = ['carbine', 'breacher', 'rail'] as const;
  const stances = new Set(families.map(id => weaponHandlingProfiles[id].stance));
  assert.equal(stances.size, 3, 'each class-owned weapon family should have a unique handling stance');

  for (const id of families) {
    const handling = weaponHandlingProfiles[id];
    const budgetTotal = Object.values(handling.budget).reduce((total, value) => total + value, 0);
    assert.equal(budgetTotal, 100, `${id} handling budget should total 100`);

    const reloadState = createSimulation();
    reloadState.player.currentWeapon = id;
    reloadState.player.mags[id] = Math.max(0, reloadState.weapons[id].magazine - 1);
    assert.equal(triggerReload(reloadState), true, `${id} should enter its reload state`);
    assert.ok(Math.abs(reloadState.player.reloadT - reloadState.weapons[id].reloadSeconds * handling.reloadDurationMul) < 0.0001, `${id} reload timing should use its handling profile`);

    reloadState.player.reloadT = 0;
    reloadState.player.weaponHeat[id] = 0.6;
    assert.equal(triggerVent(reloadState), true, `${id} should enter its vent state`);
    assert.ok(Math.abs(reloadState.player.ventT - handling.ventSeconds) < 0.0001, `${id} vent timing should use its handling profile`);
  }

  const postShotVelocity = Object.fromEntries(families.map(id => {
    const state = createSimulation();
    state.player.currentWeapon = id;
    state.player.vx = 120;
    state.player.vy = 0;
    state.player.aim = { x: 1, y: 0 };
    assert.equal(triggerFire(state), true, `${id} handling smoke should fire`);
    return [id, state.player.vx];
  })) as Record<(typeof families)[number], number>;
  assert.ok(postShotVelocity.carbine > postShotVelocity.breacher && postShotVelocity.breacher > postShotVelocity.rail, 'family fire movement should separate mobile Carbine, backblast Breacher, and planted Rail handling');
  assert.ok(weaponHandlingProfiles.carbine.cameraKick < weaponHandlingProfiles.breacher.cameraKick && weaponHandlingProfiles.breacher.cameraKick < weaponHandlingProfiles.rail.cameraKick, 'camera response should escalate from Carbine to Breacher to Rail');
}
weaponHandlingIdentitySmoke();


function classOwnedSkillMigrationSmoke() {
  const classes = ['vanguard', 'vector', 'systems'] as const satisfies readonly OperatorClassId[];
  const frameByFamily = {
    breacher: 'breacher-dense',
    rail: 'rail-hypervelocity',
    carbine: 'carbine-feedline',
  } as const;
  const affixByFamily = {
    breacher: 'tungsten',
    rail: 'hypervelocity',
    carbine: 'extendedFeed',
  } as const;
  const singularByFamily = {
    breacher: 'rheaBackblast',
    rail: 'cryolineRail',
    carbine: 'palisadeDoctrine',
  } as const;

  for (const operatorClass of classes) {
    const family = operatorWeaponFamilyByClass[operatorClass];
    assert.ok(classAbilityKits[operatorClass].every(skill => skill.weaponFamily === family), `${operatorClass} skill kit should be explicitly owned by ${family}`);

    let profile = setOperatorClass(createDefaultProfile(), operatorClass).profile;
    profile = {
      ...profile,
      level: 16,
      allocatedNodes: ['ballistics-1', 'ballistics-2', 'mobility-1', 'mobility-2', 'mobility-3', 'systems-1', 'systems-2', 'systems-3', 'engineering-1', 'engineering-2', 'awareness-1'],
      inventory: profile.inventory.map(item => item.id === profile.equipped[family]
        ? {
          ...item,
          frameGeneration: 4,
          frameIdentity: frameByFamily[family],
          equipmentQuality: 20,
          modifiers: [materializeModifier(affixByFamily[family], 5)],
          singularTrait: singularByFamily[family],
        }
        : item),
    };

    const tunedBuild = deriveCombatBuild(profile);
    assert.equal(tunedBuild.classSkillFamily.family, family, `${operatorClass} skill family should follow its class arsenal`);
    assert.equal(tunedBuild.classSkillFamily.frameIdentity, frameByFamily[family], `${operatorClass} skills should inherit active-family frame identity`);
    assert.equal(tunedBuild.classSkillFamily.singularLinked, true, `${operatorClass} active-family Singular should influence class skills`);
    if (operatorClass === 'vanguard') {
      assert.ok(tunedBuild.classSkillFamily.powerMul > 1 && tunedBuild.classSkillFamily.armorMul > 1, 'Vanguard Dense-Choke identity should tune Breacher power and armor interaction.');
    }
    if (operatorClass === 'vector') {
      assert.ok(tunedBuild.classSkillFamily.rangeMul > 1 && tunedBuild.classSkillFamily.armorMul > 1, 'Vector Hypervelocity identity should tune Rail range and armor interaction.');
    }
    if (operatorClass === 'systems') {
      assert.ok(tunedBuild.classSkillFamily.recoveryMul > 1 && tunedBuild.classSkillFamily.chainBonus > 0, 'Systems Feedline identity should tune Carbine recovery and chaining.');
    }
    assert.ok(tunedBuild.classSkillFamily.sources.some(source => source.startsWith('frame:')) && tunedBuild.classSkillFamily.sources.some(source => source.startsWith('singular:')), `${operatorClass} family skill tuning should report frame and Singular sources`);

    const sim = createSimulation(tunedBuild);
    const firstAbility = getAbilityConfig(sim, 0);
    assert.equal(firstAbility.familyBound, true, `${operatorClass} class skill should resolve as family-bound`);
    assert.equal(firstAbility.weaponFamily, family, `${operatorClass} class skill metadata should expose the owned family`);
    assert.ok(
      firstAbility.power > tunedBuild.abilities[0].powerMul
        || firstAbility.range > 1
        || firstAbility.control > 1
        || firstAbility.armor > 1
        || firstAbility.chainBonus > 0,
      `${operatorClass} runtime skill config should consume its identity-specific family tuning`,
    );

    const offFamily = family === 'breacher' ? 'rail' : 'breacher';
    const offFamilyEquipped = {
      ...profile,
      equipped: { ...profile.equipped, [offFamily]: `starter-${offFamily}` },
    };
    const offFamilyBuild = deriveCombatBuild(offFamilyEquipped);
    assert.deepEqual(offFamilyBuild.classSkillFamily, tunedBuild.classSkillFamily, `${operatorClass} stowed/off-family weapon state must not bind or tune class skills`);

    const executionProfile = setAbilityMod(profile, 'mark', 'mark-execution');
    const executionState = createSimulation(deriveCombatBuild(executionProfile));
    const target = executionState.enemies.find(enemy => enemy.active && !enemy.dead)!;
    target.statuses.marked = 4;
    target.telegraph = 1;
    target.hp = Math.max(target.hp, 80);
    target.armor = Math.max(target.armor, 80);
    executionState.projectiles.push({
      active: true,
      x: target.x,
      y: target.y,
      vx: 0,
      vy: 0,
      radius: 6,
      damage: 1,
      life: 1,
      owner: 'player',
      weapon: family,
      penetration: 0,
      armorDamage: 0.1,
      healthMultiplier: 0.1,
      knockback: 0,
      lastObjectId: null,
      lastObjectT: 0,
    });
    stepSimulation(executionState, 0.001);
    assert.equal(target.statuses.marked, 0, `${operatorClass} Execution Trace should consume marks with its owned ${family} family`);
    assert.equal(target.telegraph, 0, `${operatorClass} Execution Trace should interrupt committed firing solutions with its owned family`);
  }
}
classOwnedSkillMigrationSmoke();


function skillHierarchyPersistenceSmoke() {
  const cases = [
    { operatorClass: 'vanguard', specialization: 'pressure-diver', ability: 'mag', evolution: 'vanguard-siege-ram', capstone: 'Void Ram' },
    { operatorClass: 'vector', specialization: 'momentum-broker', ability: 'mag', evolution: 'vector-slingshot-shift', capstone: 'Inertial Dividend' },
    { operatorClass: 'systems', specialization: 'thermal-shunter', ability: 'mag', evolution: 'systems-anchor-lattice', capstone: 'Induction Sink' },
  ] as const;

  for (const testCase of cases) {
    let storedState: string | null = null;
    const isolatedStorage = {
      getItem: (key: string) => key === GAME_STATE_STORAGE_KEY ? storedState : null,
      setItem: (key: string, value: string) => { if (key === GAME_STATE_STORAGE_KEY) storedState = value; },
    };
    let profile = setOperatorClass(createDefaultProfile(), testCase.operatorClass).profile;
    profile = { ...profile, level: 16, xp: 9120, classSelectionComplete: true };
    profile = setSpecialization(profile, testCase.specialization);
    profile = setSpecializationOverclock(profile, true);
    profile = setAbilityMod(profile, testCase.ability, testCase.evolution);

    const family = activeWeaponFamilyForProfile(profile);
    const equippedFamilyId = profile.equipped[family];
    assert.ok(equippedFamilyId, `${testCase.operatorClass} hierarchy fixture requires its owned family equipped`);
    assert.equal(profile.equipped[family], `starter-${family}`, `${testCase.operatorClass} should retain its normalized starter family before persistence`);
    for (const otherFamily of ['carbine', 'breacher', 'rail'] as const) {
      if (otherFamily !== family) assert.equal(profile.equipped[otherFamily], null, `${testCase.operatorClass} save fixture should not equip off-family ${otherFamily}`);
    }

    const capstoneBefore = capstoneInteractionFor(profile, profile.abilityMods[testCase.ability]);
    assert.equal(capstoneBefore?.name, testCase.capstone, `${testCase.operatorClass} hierarchy fixture should form the intended capstone link`);

    const campaign = createDefaultCampaign();
    campaign.shipUpgrades.sensors = 2;
    campaign.shipUpgrades.reactor = 1;
    assert.equal(saveGameState(profile, campaign, isolatedStorage), true, `${testCase.operatorClass} hierarchy should save atomically with campaign state`);

    const loaded = loadGameState(isolatedStorage);
    assert.equal(loaded.profile.operatorClass, testCase.operatorClass, `${testCase.operatorClass} class should survive save/load`);
    assert.equal(loaded.profile.specialization, testCase.specialization, `${testCase.operatorClass} specialization should survive save/load`);
    assert.equal(loaded.profile.specializationOverclock, true, `${testCase.operatorClass} specialization overclock should survive save/load`);
    assert.equal(loaded.profile.abilityMods[testCase.ability], testCase.evolution, `${testCase.operatorClass} class Evolution should survive save/load`);
    assert.equal(activeWeaponFamilyForProfile(loaded.profile), family, `${testCase.operatorClass} owned family should survive save/load`);
    assert.equal(loaded.profile.equipped[family], equippedFamilyId, `${testCase.operatorClass} equipped family item should survive save/load`);
    assert.equal(capstoneInteractionFor(loaded.profile, loaded.profile.abilityMods[testCase.ability])?.name, testCase.capstone, `${testCase.operatorClass} capstone link should survive save/load`);
    assert.equal(loaded.campaign.shipUpgrades.sensors, 2, `${testCase.operatorClass} campaign state should round-trip beside skill hierarchy state`);

    const derived = deriveCombatBuild(loaded.profile);
    const withShip = applyShipBonuses(derived, loaded.campaign);
    assert.deepEqual(withShip.classSkillFamily, derived.classSkillFamily, `${testCase.operatorClass} campaign ship bonuses must preserve family-skill tuning and source provenance`);
    const runtime = createSimulation(withShip);
    const abilityConfig = getAbilityConfig(runtime, 0);
    assert.equal(abilityConfig.weaponFamily, family, `${testCase.operatorClass} saved Evolution should still resolve through its owned family at runtime`);
    assert.equal(abilityConfig.familyBound, true, `${testCase.operatorClass} saved skill hierarchy should stay family-bound after campaign bonuses`);
  }

}
skillHierarchyPersistenceSmoke();

function standardRepeatableIdentitySmoke() {
  const allowedModes = {
    salvage: new Set(['deep-salvage', 'machinery-recovery']),
    boarding: new Set(['emergency-boarding']),
    stabilization: new Set(['grid-isolation', 'gravity-stabilization']),
  } as const;
  const expectedPattern = { salvage: 'mixed', boarding: 'swarm', stabilization: 'elite-led' } as const;
  const seenModes = { salvage: new Set<string>(), boarding: new Set<string>(), stabilization: new Set<string>() };

  for (let cycle = 0; cycle < 9; cycle += 1) {
    const campaign = { ...createDefaultCampaign(), cycle };
    const contracts = generateStandardContracts(campaign);
    assert.equal(contracts.length, 3, `cycle ${cycle} should author exactly three standard repeatable families`);
    for (const contract of contracts) {
      assert.equal(contract.standardRepeatable, true, `${contract.archetype} should be marked as a standard repeatable`);
      assert.ok(contract.repeatableIdentity?.loop && contract.repeatableIdentity.safePattern && contract.repeatableIdentity.deepPattern, `${contract.archetype} should expose authored loop/safe/deep briefing identity`);
      assert.equal(contract.encounterPattern, expectedPattern[contract.archetype], `${contract.archetype} should keep its authored encounter pressure`);
      assert.ok(allowedModes[contract.archetype].has(contract.objectiveMode as never), `${contract.archetype} should stay inside its family objective pool, got ${contract.objectiveMode}`);
      seenModes[contract.archetype].add(contract.objectiveMode);
    }
  }

  assert.deepEqual([...seenModes.salvage].sort(), ['deep-salvage', 'machinery-recovery'], 'salvage should rotate recovery primitives');
  assert.deepEqual([...seenModes.boarding], ['emergency-boarding'], 'boarding should stay on the two-lock breach primitive');
  assert.deepEqual([...seenModes.stabilization].sort(), ['gravity-stabilization', 'grid-isolation'], 'stabilization should rotate control-system primitives');

  const profile = setOperatorClass(createDefaultProfile(), 'vanguard').profile;
  const build = deriveCombatBuild(profile);
  for (const contract of generateStandardContracts(createDefaultCampaign())) {
    const state = createSimulation(build);
    applyMissionSetup(state, contract);
    const runtime = createDirector();
    runtime.deep = true;
    runtime.deepElapsed = 10;
    stepMissionDirector(state, runtime, contract, 0.1);
    const expectedHazard = contract.archetype === 'salvage' ? 'vectorWash' : contract.archetype === 'boarding' ? 'shockGrid' : 'gravityWell';
    assert.ok(state.hazards.some(hazard => hazard.active && hazard.kind === expectedHazard), `${contract.archetype} deep push should activate its authored ${expectedHazard} risk`);
    assert.equal(runtime.repeatableDeepTriggered, true, `${contract.archetype} deep identity should trigger once`);
  }
}
standardRepeatableIdentitySmoke();
