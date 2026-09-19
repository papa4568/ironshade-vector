import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buyConsumable, createDefaultCampaign, loadCampaign, saveCampaign } from '../src/game/campaign';
import { aimAtMobileTarget, applyPlayerDamage, createSimulation, stepSimulation, triggerAbility, triggerConsumable, weaponConfigs } from '../src/game/sim';
import { createDefaultProfile, loadProfile, saveProfile } from '../src/game/meta';
import { CAMPAIGN_STORAGE_KEY, GAME_STATE_STORAGE_KEY, prepareSaveRecovery, PROFILE_STORAGE_KEY } from '../src/game/saveRecovery';
import { loadGameState, saveGameState } from '../src/game/gamePersistence';
import { carryExpeditionLoot } from '../src/game/expeditionCarry';
import { advanceParallaxDebtAfterContract, getParallaxDebtContract, parallaxDebtChapter, parallaxDebtNextRequiredLevel, syncParallaxDebtAccess } from '../src/game/parallaxDebt';
import { operationScalingFor } from '../src/game/scaling';

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
assert.equal(parallaxDebtChapter.totalContracts, 12, 'Parallax Debt should reserve a full 12-contract Chapter 3 arc.');
assert.equal(parallaxDebtChapter.authoredContracts, 9, 'This slice should author nine Chapter 3 contracts through LV18.');

for (let step = 0; step < 3; step += 1) {
  const contract = getParallaxDebtContract(parallaxCampaign, 15);
  assert.ok(contract, `Parallax Debt opening contract ${step + 1} should exist at LV15`);
  if (step === 0) {
    assert.equal(contract.location, 'parallax-array');
    assert.equal(contract.objectiveMode, 'reference-alignment');
    assert.equal(operationScalingFor(contract, parallaxCampaign, 15).operationTier, 9, 'Opening Parallax work should start at T9 / LV15 pressure.');
  }
  const advanced = advanceParallaxDebtAfterContract(parallaxCampaign, contract);
  parallaxCampaign = advanced.campaign;
}
assert.equal(parallaxCampaign.story.parallaxDebt.status, 'active', 'Blind Meridian should now finish only the opening phase, not the full chapter.');
assert.equal(parallaxCampaign.story.parallaxDebt.evidence.length, 3, 'Opening Parallax Debt should bank its original three evidence records.');
assert.equal(parallaxDebtNextRequiredLevel(parallaxCampaign), 16, 'The first continuation phase should require LV16.');
assert.equal(getParallaxDebtContract(parallaxCampaign, 15), null, 'LV15 should not bypass the LV16 Parallax continuation gate.');

let migratedLegacyParallax = createDefaultCampaign();
migratedLegacyParallax.story.interdiction.status = 'complete';
migratedLegacyParallax.story.parallaxDebt = {
  status: 'complete',
  step: 3,
  completed: ['parallax-debt-0', 'parallax-debt-1', 'parallax-debt-2'],
  evidence: ['baseline-offset', 'return-vector', 'blind-meridian'],
  lastBeat: 'Legacy opening sequence complete.',
};
migratedLegacyParallax = syncParallaxDebtAccess(migratedLegacyParallax, 15);
assert.equal(migratedLegacyParallax.story.parallaxDebt.status, 'active', 'Legacy saves that completed the three-contract opening must reopen safely into the expanded chapter.');
assert.equal(migratedLegacyParallax.story.parallaxDebt.step, 3, 'Legacy Parallax migration must preserve the completed opening step.');

for (let step = 3; step < 6; step += 1) {
  const contract = getParallaxDebtContract(parallaxCampaign, 16);
  assert.ok(contract, `Parallax Debt LV16 contract ${step + 1} should exist`);
  if (step === 3) {
    assert.equal(contract.title, 'Parallax Debt // Kepler Wake');
    assert.equal(operationScalingFor(contract, parallaxCampaign, 16).operationTier, 10, 'LV16 continuation should move Parallax Debt to T10 pressure.');
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
    assert.equal(operationScalingFor(contract, parallaxCampaign, 17).operationTier, 11, 'LV17 continuation should move Parallax Debt to T11 pressure.');
  }
  parallaxCampaign = advanceParallaxDebtAfterContract(parallaxCampaign, contract).campaign;
}
assert.equal(parallaxDebtNextRequiredLevel(parallaxCampaign), 18, 'False Horizon should be the LV18 gate for the current authored slice.');
assert.equal(getParallaxDebtContract(parallaxCampaign, 17), null, 'LV17 should not bypass the LV18 False Horizon gate.');

const falseHorizon = getParallaxDebtContract(parallaxCampaign, 18);
assert.ok(falseHorizon, 'False Horizon should unlock at LV18.');
assert.equal(falseHorizon.title, 'Parallax Debt // False Horizon');
parallaxCampaign = advanceParallaxDebtAfterContract(parallaxCampaign, falseHorizon).campaign;
assert.equal(parallaxCampaign.story.parallaxDebt.status, 'active', 'The nine-contract LV15–18 slice should leave Parallax Debt active for its decision branch and final operations.');
assert.equal(parallaxCampaign.story.parallaxDebt.step, 9, 'The authored slice should bank nine Chapter 3 contracts.');
assert.equal(parallaxCampaign.story.parallaxDebt.evidence.length, 9, 'The LV15–18 slice should bank nine distinct evidence records.');
assert.equal(getParallaxDebtContract(parallaxCampaign, 20), null, 'No un-authored Chapter 3 contract should leak onto the board after the current slice.');
assert.match(parallaxCampaign.story.parallaxDebt.lastBeat, /MID-CHAPTER VECTOR COMPLETE/, 'The campaign should clearly explain why the next Parallax contract is not yet available.');

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
