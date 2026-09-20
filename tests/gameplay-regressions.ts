import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buyConsumable, createDefaultCampaign, generateContracts, loadCampaign, saveCampaign } from '../src/game/campaign';
import { aimAtMobileTarget, applyPlayerDamage, createSimulation, stepSimulation, triggerAbility, triggerConsumable, triggerDodge, triggerFire, weaponConfigs, type Telemetry } from '../src/game/sim';
import { applyMissionSetup, createDirector, stepMissionDirector } from '../src/game/director';
import { awardRecovery, createDefaultProfile, deriveCombatBuild, loadProfile, saveProfile } from '../src/game/meta';
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

const expeditionLootSource = [{ id: 'stage-1-drop', enemyId: 7, enemyLabel: 'Stage One Elite', rarity: 'Prototype' as const, source: 'elite' as const, recoveryQualityFloor: 3 as const, recoveryLevel: 24, monsterLevel: 8 }];
const expeditionLootCarry = carryExpeditionLoot(expeditionLootSource);
assert.deepEqual(expeditionLootCarry, expeditionLootSource, 'megastructure stage transit should preserve every collected field-loot receipt');
assert.notEqual(expeditionLootCarry, expeditionLootSource, 'stage transit should copy the receipt list instead of sharing the mutable array');
assert.notEqual(expeditionLootCarry[0], expeditionLootSource[0], 'stage transit should copy individual receipts so later mutation cannot rewrite earlier-stage recovery data');
const gameCanvasSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');
assert.match(gameCanvasSource, /state\.collectedLoot = carryExpeditionLoot\(carry\.collectedLoot\);/, 'GameCanvas must carry collected expedition loot into each new megastructure stage');

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
