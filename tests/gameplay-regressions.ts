import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMegastructureDebrief, buyConsumable, createDefaultCampaign, generateContracts, getMegastructureStageContract, loadCampaign, saveCampaign } from '../src/game/campaign';
import { aimAtMobileTarget, applyPlayerDamage, createSimulation, stepSimulation, triggerAbility, triggerConsumable, triggerDodge, triggerFire, weaponConfigs, type Telemetry } from '../src/game/sim';
import { applyMissionSetup, createDirector, stepMissionDirector } from '../src/game/director';
import { awardRecovery, createDefaultProfile, deriveCombatBuild, loadProfile, saveProfile, setAbilityMod, setOperatorClass, systemsCapstoneInteractionFor, vanguardCapstoneInteractionFor } from '../src/game/meta';
import { CAMPAIGN_STORAGE_KEY, GAME_STATE_STORAGE_KEY, prepareSaveRecovery, PROFILE_STORAGE_KEY } from '../src/game/saveRecovery';
import { loadGameState, saveGameState } from '../src/game/gamePersistence';
import { carryExpeditionLoot } from '../src/game/expeditionCarry';
import { advanceParallaxDebtAfterContract, chooseParallaxDebtBranch, getParallaxDebtChoicePrompt, getParallaxDebtContract, parallaxDebtChapter, parallaxDebtIntel, parallaxDebtNextRequiredLevel, syncParallaxDebtAccess } from '../src/game/parallaxDebt';
import { operationScalingFor } from '../src/game/scaling';

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

  const meshProfile = setAbilityMod({ ...baseProfile, specialization: 'grid-weaver' as const }, 'arc', 'systems-return-current');
  assert.equal(systemsCapstoneInteractionFor(meshProfile, meshProfile.abilityMods.arc)?.name, 'Mesh Reflux');
  const meshState = createSimulation(deriveCombatBuild(meshProfile));
  for (const enemy of meshState.enemies) enemy.active = false;
  const conduit = meshState.objects.find(object => object.kind === 'conduit' || object.kind === 'anchorNode');
  assert.ok(conduit, 'Mesh Reflux regression needs an available conduit or anchor node.');
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
localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify({ version: 1, profile: preClassProfile, campaign: preClassCampaign, savedAt: '2026-09-18T00:00:00.000Z' }));
const classMigrated = loadGameState(localStorage);
assert.equal(classMigrated.profile.operatorClass, 'systems', 'Existing atomic saves should infer a compatible operator class from their specialization instead of resetting progress.');
assert.equal(classMigrated.profile.specialization, 'grid-weaver', 'Class migration must preserve an existing specialization.');
assert.equal(classMigrated.profile.classSelectionComplete, true, 'Existing atomic saves should not be forced back through first-run class intake.');

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
