import { createDefaultProfile, awardRecovery, awardVictory, allocateNode, deriveCombatBuild, gearResonanceForProfile, itemBuildAffinities, loadProfile, operatorClassForProfile, operatorClassOnboardingRecovery, saveProfile, setOperatorClass, setSpecialization, setSpecializationOverclock, xpProgress } from '../src/game/meta';
import { createDefaultCampaign, generateContracts, loadCampaign, saveCampaign, settleContract } from '../src/game/campaign';
import { withOperationScaling, frameGenerationForRecovery } from '../src/game/scaling';
import { applyMissionSetup, createDirector } from '../src/game/director';
import { getMissionObjectiveStatus, getNextMissionObjectiveTarget } from '../src/game/encounters';
import { applyPlayerDamage, createSimulation, selectWeapon, setAim, setMove, stepSimulation, triggerAbility, triggerDodge, triggerFire } from '../src/game/sim';
import { classAbilityKits } from '../src/game/classSkills';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function telemetry(damageDealt = 4000) {
  return {
    damageDealt,
    damageTaken: 0,
    deaths: 0,
    kills: 8,
    eliteKills: 2,
    eliteProtocolsDefeated: 2,
    killIntervalTotal: 8,
    killIntervalSamples: 4,
    lastKillAt: 30,
    protocolCombinations: {},
    weaponShots: { carbine: 20, breacher: 5, rail: 2 },
    abilityUses: [2, 2, 2] as [number, number, number],
    encounterStart: 0,
    bossStart: 0,
    duration: 45,
    trace: [],
    nextTraceAt: 0,
  };
}

function installStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, String(value)); },
    removeItem(key: string) { values.delete(key); },
    clear() { values.clear(); },
    key(index: number) { return [...values.keys()][index] ?? null; },
    get length() { return values.size; },
  };
  Object.defineProperty(globalThis, 'window', { value: { localStorage }, configurable: true });
}

function combatSmoke() {
  const profile = createDefaultProfile();
  const state = createSimulation(deriveCombatBuild(profile));
  selectWeapon(state, 'carbine');
  stepSimulation(state, 0.15);
  const initialMag = state.player.mags.carbine;
  setAim(state, { x: 1, y: 0 }, false);
  assert(triggerFire(state), 'Carbine should fire from a fresh simulation.');
  assert(state.player.mags.carbine === initialMag - 1, 'Firing should consume exactly one carbine round.');
  assert(state.telemetry.weaponShots.carbine === 1, 'Firing should be represented in telemetry.');
  assert(triggerAbility(state, 0), 'MAG should activate with a full capacitor.');
  assert(state.telemetry.abilityUses[0] === 1, 'Ability activation should be represented in telemetry.');
  setMove(state, { x: 1, y: 0 });
  assert(triggerDodge(state), 'Dodge should activate when ready.');
  stepSimulation(state, 1 / 60);
  assert(state.time > 0, 'Fixed-step simulation should advance time.');
}

function classMechanicSmoke() {
  const fresh = createDefaultProfile();
  assert(fresh.classSelectionComplete === false, 'A fresh profile should require explicit operator class selection.');
  const kitSignatures = (['vanguard', 'vector', 'systems'] as const).map(classId => classAbilityKits[classId].map(ability => ability.name).join('|'));
  assert(new Set(kitSignatures).size === 3, 'Each operator class should have a distinct level-one active skill kit.');
  assert(classAbilityKits.vanguard.map(ability => ability.shortName).join('/') === 'RUSH/BREAK/GUARD', 'Vanguard should expose the close-range RUSH/BREAK/GUARD kit.');
  assert(classAbilityKits.vector.map(ability => ability.shortName).join('/') === 'SHIFT/LOCK/SPLIT', 'Vector should expose the mobility/precision SHIFT/LOCK/SPLIT kit.');
  assert(classAbilityKits.systems.map(ability => ability.shortName).join('/') === 'WELL/HACK/CHAIN', 'Systems should expose the control/network WELL/HACK/CHAIN kit.');

  for (const classId of ['vanguard', 'vector', 'systems'] as const) {
    const selected = setOperatorClass(fresh, classId).profile;
    const expected = operatorClassOnboardingRecovery[classId];
    const firstRecovery = awardRecovery(selected, telemetry(), false, 0, { operationTier: 1, maxRecoveryLevel: 12, actualDepth: false });
    assert(firstRecovery.loot[0]?.name === expected[0].name, `${classId} first contract recovery should use its doctrine-aligned onboarding frame.`);
    assert(itemBuildAffinities(firstRecovery.loot[0]).includes(classId), `${classId} first contract recovery should resonate with the selected class.`);
    const trainingRecovery = awardVictory(selected, telemetry());
    assert(trainingRecovery.loot[0]?.name === expected[0].name && trainingRecovery.loot[1]?.name === expected[1].name, `${classId} training recovery should use both doctrine-aligned onboarding frames.`);
    assert(trainingRecovery.loot.every(item => itemBuildAffinities(item).includes(classId)), `${classId} training recovery should reinforce the chosen class without locking equipment.`);
  }

  const vanguardProfile = setOperatorClass(fresh, 'vanguard').profile;
  assert(vanguardProfile.classSelectionComplete === true, 'Confirming an operator class should complete class intake.');
  const vanguard = createSimulation(deriveCombatBuild(vanguardProfile));
  assert(vanguard.build.operatorClass === 'vanguard' && vanguard.build.classResonanceTier === 1, 'Vanguard combat build should carry class and starter resonance into simulation.');
  assert(vanguard.player.currentWeapon === 'breacher', 'Vanguard should deploy with the Breacher already in hand.');
  setAim(vanguard, { x: 1, y: 0 }, false);
  assert(triggerAbility(vanguard, 0), 'Vanguard Breach Rush should activate at level one.');
  assert(vanguard.player.vx > 400 && vanguard.classState.vanguardGuard > 0, 'Breach Rush should visibly move Vanguard forward and raise Breach Guard.');
  vanguard.player.currentWeapon = 'breacher';
  vanguard.player.armor = Math.max(0, vanguard.player.maxArmor - 12);
  const closeTarget = vanguard.enemies[0];
  for (const enemy of vanguard.enemies) enemy.active = false;
  closeTarget.active = true;
  closeTarget.dead = false;
  closeTarget.x = vanguard.player.x + 95;
  closeTarget.y = vanguard.player.y;
  closeTarget.armor = 1;
  closeTarget.maxArmor = 1;
  closeTarget.hp = 300;
  closeTarget.maxHp = 300;
  closeTarget.statuses.stagger = 10;
  setAim(vanguard, { x: 1, y: 0 }, false);
  assert(triggerAbility(vanguard, 1), 'Vanguard Fracture Tag should activate on a nearby target.');
  assert(closeTarget.statuses.armorBreach > 0, 'Fracture Tag should open an armor breach immediately.');
  assert(triggerFire(vanguard), 'Vanguard should be able to fire the Breacher.');
  for (let index = 0; index < 24; index += 1) stepSimulation(vanguard, 1 / 120);
  assert(vanguard.classState.vanguardGuard > 0, 'Close Breacher contact should activate Vanguard Breach Guard.');
  const guardedArmorBefore = vanguard.player.armor;
  applyPlayerDamage(vanguard, 10, 0);
  assert(guardedArmorBefore - vanguard.player.armor < 10, 'Active Breach Guard should reduce incoming armor impact without duplicating Breach Vanguard armor recovery.');

  const vectorProfile = setOperatorClass(fresh, 'vector').profile;
  const vector = createSimulation(deriveCombatBuild(vectorProfile));
  assert(vector.player.currentWeapon === 'rail', 'Vector should deploy with the Rail Lance already in hand.');
  setAim(vector, { x: 1, y: 0 }, false);
  assert(triggerAbility(vector, 0), 'Vector Shift should activate at level one.');
  assert(vector.player.vx > 500 && vector.classState.vectorWindow > 0, 'Vector Shift should create immediate mobility and prime Slipstream.');
  const splitshot = createSimulation(deriveCombatBuild(vectorProfile));
  setAim(splitshot, { x: 1, y: 0 }, false);
  assert(triggerAbility(splitshot, 2), 'Vector Splitshot should activate at level one.');
  assert(splitshot.projectiles.filter(projectile => projectile.active && projectile.owner === 'player').length === 3, 'Splitshot should launch a three-lane projectile fan.');
  setMove(vector, { x: 1, y: 0 });
  vector.classState.vectorWindow = 0;
  assert(triggerDodge(vector), 'Vector should also be able to dodge into Slipstream.');
  assert(vector.classState.vectorWindow > 0, 'Vector dodge should prime Slipstream.');
  const baseRailVelocity = vector.weapons.rail.projectileSpeed;
  assert(triggerFire(vector), 'Vector should be able to spend Slipstream on a Rail shot.');
  const slipstreamProjectile = vector.projectiles.find(projectile => projectile.active && projectile.owner === 'player');
  assert(!!slipstreamProjectile, 'Vector Slipstream shot should create a player projectile.');
  assert(Math.hypot(slipstreamProjectile.vx, slipstreamProjectile.vy) > baseRailVelocity * 1.15, 'Slipstream should materially accelerate the primed Rail shot.');
  assert(vector.classState.vectorWindow === 0, 'Slipstream should be consumed by the next shot.');

  const systemsProfile = setOperatorClass(fresh, 'systems').profile;
  const systems = createSimulation(deriveCombatBuild(systemsProfile));
  assert(systems.player.currentWeapon === 'carbine', 'Systems should deploy with the flexible Carbine in hand.');
  const polarityTarget = systems.enemies.find(enemy => enemy.active && !enemy.dead)!;
  setAim(systems, { x: 1, y: 0 }, false);
  assert(triggerAbility(systems, 0), 'Systems Polarity Well should activate at level one.');
  assert(polarityTarget.vx < 0 && polarityTarget.statuses.disrupted > 0, 'Polarity Well should pull forward enemies back toward its mass point and disrupt them.');
  const magCooldown = systems.player.abilityCooldowns[0];
  assert(triggerAbility(systems, 1), 'Systems Relay Hack should chain after Polarity Well.');
  assert(systems.enemies.filter(enemy => enemy.active && !enemy.dead && enemy.statuses.marked > 0).length >= 2, 'Relay Hack should spread target control across multiple hostiles.');
  assert(systems.classState.systemsLinks === 1, 'Systems should bank the first Closed Loop link.');
  assert(systems.player.abilityCooldowns[0] < magCooldown, 'Closed Loop should advance the previous ability cooldown.');
  systems.player.weaponHeat.carbine = 0.5;
  assert(triggerAbility(systems, 2), 'Systems Cascade Arc should complete the three-ability loop.');
  assert(systems.classState.systemsLinks === 0, 'Completing Closed Loop should reset the link counter.');
  assert(systems.player.weaponHeat.carbine < 0.5, 'Completing Closed Loop should cool the active weapon.');
}

function objectiveSmoke(profileLevel: number) {
  const campaign = createDefaultCampaign();
  const profile = { ...createDefaultProfile(), level: profileLevel, xp: profileLevel >= 15 ? 7140 : 0 };
  for (const raw of generateContracts(campaign)) {
    const contract = withOperationScaling(raw, campaign, profile.level);
    const state = createSimulation(deriveCombatBuild(profile));
    const director = createDirector();
    applyMissionSetup(state, contract);
    assert(state.eventText.includes('BREACH GUARD'), `${contract.id} deployment callout should carry the active class signature.`);
    const status = getMissionObjectiveStatus(state, contract);
    assert(status.required > 0, `${contract.id} should expose a non-zero objective requirement.`);
    assert(status.progress >= 0 && status.progress <= status.required, `${contract.id} objective progress should start within bounds.`);
    const next = getNextMissionObjectiveTarget(state, contract);
    if (!status.complete) assert(next || contract.objectiveMode === 'pressure-recovery', `${contract.id} should expose a next ACT target when incomplete.`);
    assert(director.deep === false, 'Mission director should initialize in the safe zone.');
  }
}

installStorage();
combatSmoke();
classMechanicSmoke();
objectiveSmoke(1);
objectiveSmoke(15);

let profile = createDefaultProfile();
assert(operatorClassForProfile(profile) === 'vanguard', 'Fresh operators should begin on the Vanguard class path.');
const starterVanguardResonance = gearResonanceForProfile(profile);
assert(starterVanguardResonance.count === 2 && starterVanguardResonance.tier === 1, 'Starter Breacher + Suit should activate Vanguard Tier I resonance without locking other gear.');
const classProbe = setOperatorClass(profile, 'systems');
assert(operatorClassForProfile(classProbe.profile) === 'systems', 'Operator class should be freely changeable aboard the ship.');
assert(classProbe.profile.specialization === null, 'Changing an unspecialized class should keep specialization empty.');
assert(JSON.stringify(classProbe.profile.equipped) === JSON.stringify(profile.equipped), 'Changing class must never rewrite the equipped loadout.');
const starterSystemsResonance = gearResonanceForProfile(classProbe.profile);
assert(starterSystemsResonance.count === 2 && starterSystemsResonance.tier === 1, 'Starter Rig + Implant should activate Systems Tier I resonance.');
const vanguardBuild = deriveCombatBuild(profile);
const systemsBuild = deriveCombatBuild(classProbe.profile);
assert(vanguardBuild.player.maxArmorAdd > systemsBuild.player.maxArmorAdd, 'Vanguard class identity should materially favor armor.');
assert(systemsBuild.player.maxCapAdd > vanguardBuild.player.maxCapAdd, 'Systems class identity should materially favor capacitor headroom.');
let campaign = createDefaultCampaign();
const starterEquipped = JSON.stringify(profile.equipped);
const starterIds = new Set(Object.values(profile.equipped).filter(Boolean));
let allocated = false;
let transitionLoot: typeof profile.inventory = [];
let reached15 = false;
let runs = 0;

while (profile.level < 15 && runs < 40) {
  const rawContracts = generateContracts(campaign);
  assert(rawContracts.length >= 3, 'Campaign should always present a contract set.');
  const contract = withOperationScaling(rawContracts[runs % rawContracts.length], campaign, profile.level);
  const priorLevel = profile.level;
  const priorXp = profile.xp;
  const priorRuns = profile.runsCompleted;
  const priorInventory = profile.inventory.length;
  const priorAllocated = [...profile.allocatedNodes];
  const priorPoints = profile.progressionPoints;
  const reward = settleContract(campaign, contract, 'deep', 12);
  const lootReward = awardRecovery(profile, telemetry(), true, campaign.shipUpgrades.fabrication, {
    operationTier: contract.operationTier,
    threatBudget: contract.threatBudget,
    maxRecoveryLevel: contract.maxRecoveryLevel,
    combatEffectiveness: contract.combatEffectiveness,
    location: contract.location,
    locationName: contract.locationName,
    deepTarget: contract.deepTarget,
    faction: contract.sponsor,
    factionReputation: campaign.reputation[contract.sponsor],
    optionalObjectives: 1,
    environmentalComplications: contract.environmentalEventSlots,
    eliteProtocolCount: contract.eliteProtocolSlots,
    actualDepth: true,
    directiveQualityBonus: contract.directiveQualityBonus,
    directiveSingularChanceBonus: contract.directiveSingularChanceBonus,
    directiveRecoveryLevelBonus: contract.directiveRecoveryLevelBonus,
  });

  campaign = reward.campaign;
  profile = lootReward.profile;
  runs += 1;

  assert(profile.xp >= priorXp, `XP regressed after run ${runs}.`);
  assert(profile.level >= priorLevel, `Level regressed after run ${runs}.`);
  assert(profile.runsCompleted === priorRuns + 1, `Run counter did not advance exactly once on run ${runs}.`);
  assert(profile.inventory.length >= priorInventory + 1, `Recovery did not append equipment on run ${runs}.`);
  assert(JSON.stringify(profile.equipped) === starterEquipped, `Equipped starter loadout changed without an explicit equip action on run ${runs}.`);
  assert([...starterIds].every(id => profile.inventory.some(item => item.id === id)), `A starter item disappeared from storage on run ${runs}.`);
  assert(priorAllocated.every(id => profile.allocatedNodes.includes(id)), `Allocated nodes were lost on run ${runs}.`);
  assert(profile.progressionPoints >= 0, `Progression points became negative on run ${runs}.`);
  assert(campaign.contractsCompleted === runs, `Campaign completion count diverged on run ${runs}.`);

  if (!allocated && profile.progressionPoints > 0) {
    const beforeEquip = JSON.stringify(profile.equipped);
    const result = allocateNode(profile, 'ballistics-1');
    assert(result.profile.allocatedNodes.includes('ballistics-1'), 'Earned progression point should allocate Dense Flight.');
    assert(result.profile.progressionPoints === profile.progressionPoints - 1, 'Allocating one node should consume one point.');
    assert(JSON.stringify(result.profile.equipped) === beforeEquip, 'Progression allocation must not alter equipment.');
    profile = result.profile;
    allocated = true;
  } else if (allocated) {
    assert(profile.allocatedNodes.includes('ballistics-1'), `Allocated node was lost after run ${runs}.`);
    assert(profile.progressionPoints >= Math.max(0, priorPoints - (priorAllocated.includes('ballistics-1') ? 0 : 1)), `Progression point accounting regressed after run ${runs}.`);
  }

  saveProfile(profile);
  saveCampaign(campaign);
  const reloadedProfile = loadProfile();
  const reloadedCampaign = loadCampaign();
  assert(reloadedProfile.level === profile.level && reloadedProfile.xp === profile.xp, `Profile save round-trip failed after run ${runs}.`);
  assert(reloadedProfile.allocatedNodes.join('|') === profile.allocatedNodes.join('|'), `Allocated nodes failed save round-trip after run ${runs}.`);
  assert(JSON.stringify(reloadedProfile.equipped) === JSON.stringify(profile.equipped), `Equipped loadout failed save round-trip after run ${runs}.`);
  assert(reloadedCampaign.contractsCompleted === campaign.contractsCompleted, `Campaign save round-trip failed after run ${runs}.`);

  if (priorLevel === 14 && profile.level >= 15) {
    reached15 = true;
    transitionLoot = lootReward.loot;
    assert(profile.specialization === null, 'Reaching level 15 should not silently choose a specialization.');
    assert(transitionLoot.every(item => (item.frameGeneration ?? 1) < 6), 'The 14→15 recovery must remain source-correct and cannot retroactively roll Gen VI.');
  }
}

assert(reached15, `Expected to reach level 15 within 40 deep extractions; stopped at level ${profile.level} after ${runs}.`);
assert(profile.level === 15, `Beta progression should stop at level 15, got ${profile.level}.`);
assert(profile.xp >= 7140 && profile.xp < 8100, `Level 15 XP should sit inside the 7140–8099 band, got ${profile.xp}.`);
assert(xpProgress(profile).maxed === false, 'Level 15 should still report progress toward level 16.');
assert(profile.allocatedNodes.includes('ballistics-1'), 'Pre-level-15 progression allocation should survive the climb.');
assert(JSON.stringify(profile.equipped) === starterEquipped, 'Level 15 transition must preserve equipped gear.');

const beforeSpecializationPoints = profile.progressionPoints;
const beforeSpecializationNodes = profile.allocatedNodes.join('|');
const rejectedCrossClassSpecialization = setSpecialization(profile, 'grid-weaver');
assert(rejectedCrossClassSpecialization.specialization === null, 'A Vanguard should not be able to select a Systems specialization without changing class.');
profile = setSpecialization(profile, 'pressure-diver');
assert(profile.specialization === 'pressure-diver', 'Level 15 should unlock Vanguard specialization selection.');
assert(profile.progressionPoints === beforeSpecializationPoints, 'Choosing a specialization must not consume a progression point.');
assert(profile.allocatedNodes.join('|') === beforeSpecializationNodes, 'Choosing a specialization must not rewrite the progression network.');
profile = setSpecializationOverclock(profile, true);
assert(profile.specializationOverclock === false, 'Level 15 must not enable the level 16 overclock early.');

const pressureBaselineBuild = deriveCombatBuild({ ...profile, specialization: null, specializationOverclock: false });
const pressureBuild = deriveCombatBuild(profile);
assert(pressureBuild.specialization === 'pressure-diver', 'Selected specialization should reach the combat build.');
assert(pressureBuild.player.maxArmorAdd === pressureBaselineBuild.player.maxArmorAdd - 12, 'Pressure Diver should reduce maximum armor by exactly 12 versus the same equipped loadout.');
const classSwapAfterSpecialization = setOperatorClass(profile, 'systems');
assert(classSwapAfterSpecialization.profile.specialization === null && classSwapAfterSpecialization.profile.specializationOverclock === false, 'Changing to an incompatible class should clear its specialization and overclock without touching progression.');

assert(frameGenerationForRecovery(55, 14) === 5, 'Operator level 14 must not access Gen VI even at recovery level 55.');
assert(frameGenerationForRecovery(55, 15) === 6, 'Operator level 15 should access Gen VI at recovery level 55.');

const post15Reward = awardRecovery(profile, telemetry(), true, campaign.shipUpgrades.fabrication, {
  operationTier: 12,
  threatBudget: 76,
  maxRecoveryLevel: 56,
  combatEffectiveness: 1.2,
  location: 'momentum-exchange',
  locationName: 'Momentum Exchange',
  deepTarget: 'Transfer Adjudicator Iona Vale',
  optionalObjectives: 1,
  environmentalComplications: 4,
  eliteProtocolCount: 4,
  actualDepth: true,
});
const eligiblePost15 = post15Reward.loot.filter(item => (item.recoveryLevel ?? 0) >= 55);
assert(eligiblePost15.length > 0, 'A tier-12 level-15 deep recovery should produce at least one Gen VI-eligible frame.');
assert(eligiblePost15.every(item => item.frameGeneration === 6), 'Gen VI-eligible level-15 recoveries should materialize as Gen VI.');

console.log(`LEVEL15_BETA_PASS runs=${runs} level=${profile.level} xp=${profile.xp} contracts=${campaign.contractsCompleted} inventory=${profile.inventory.length} points=${profile.progressionPoints} allocated=${profile.allocatedNodes.length}`);
