import { createDefaultProfile, awardRecovery, allocateNode, deriveCombatBuild, loadProfile, saveProfile, setSpecialization, setSpecializationOverclock, xpProgress } from '../src/game/meta';
import { createDefaultCampaign, generateContracts, loadCampaign, saveCampaign, settleContract } from '../src/game/campaign';
import { withOperationScaling, frameGenerationForRecovery } from '../src/game/scaling';
import { applyMissionSetup, createDirector } from '../src/game/director';
import { getMissionObjectiveStatus, getNextMissionObjectiveTarget } from '../src/game/encounters';
import { createSimulation, setAim, setMove, stepSimulation, triggerAbility, triggerDodge, triggerFire } from '../src/game/sim';

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

function objectiveSmoke(profileLevel: number) {
  const campaign = createDefaultCampaign();
  const profile = { ...createDefaultProfile(), level: profileLevel, xp: profileLevel >= 15 ? 7140 : 0 };
  for (const raw of generateContracts(campaign)) {
    const contract = withOperationScaling(raw, campaign, profile.level);
    const state = createSimulation(deriveCombatBuild(profile));
    const director = createDirector();
    applyMissionSetup(state, contract);
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
objectiveSmoke(1);
objectiveSmoke(15);

let profile = createDefaultProfile();
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
profile = setSpecialization(profile, 'pressure-diver');
assert(profile.specialization === 'pressure-diver', 'Level 15 should unlock Vector Specialization selection.');
assert(profile.progressionPoints === beforeSpecializationPoints, 'Choosing a specialization must not consume a progression point.');
assert(profile.allocatedNodes.join('|') === beforeSpecializationNodes, 'Choosing a specialization must not rewrite the progression network.');
profile = setSpecializationOverclock(profile, true);
assert(profile.specializationOverclock === false, 'Level 15 must not enable the level 16 overclock early.');

const pressureBuild = deriveCombatBuild(profile);
assert(pressureBuild.specialization === 'pressure-diver', 'Selected specialization should reach the combat build.');
assert(pressureBuild.player.maxArmorAdd <= -12, 'Pressure Diver tradeoff should reduce maximum armor by 12 before gear bonuses.');

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
