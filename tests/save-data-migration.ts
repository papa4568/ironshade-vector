import assert from 'node:assert/strict';
import { SHIP_SYSTEM_SCHEMA_VERSION, createDefaultCampaign } from '../src/game/campaign';
import { GAME_STATE_VERSION, loadGameState, saveGameState } from '../src/game/gamePersistence';
import { gearSchemaVersion } from '../src/game/gearSchema';
import { OPERATOR_NETWORK_SCHEMA_VERSION } from '../src/game/operatorNetwork';
import { createDefaultProfile, setProfileSettings } from '../src/game/meta';
import { GAME_STATE_STORAGE_KEY, prepareSaveRecovery, validateStoredProfile } from '../src/game/saveRecovery';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class MigrationBackupFailingStorage extends MemoryStorage {
  setItem(key: string, value: string) {
    if (key.includes('-recovery-')) throw new Error('simulated rollback backup failure');
    super.setItem(key, value);
  }
}

function legacyStateMigrationSmoke() {
  const storage = new MemoryStorage();
  const campaign = createDefaultCampaign();
  delete (campaign as Partial<typeof campaign>).shipSystemSchemaVersion;
  campaign.shipUpgrades.reactor = 2;
  campaign.shipUpgrades.drive = 1;
  const profile = createDefaultProfile();
  const legacyItem = profile.inventory.find(item => item.id === 'starter-breacher')!;
  legacyItem.rarity = 'Refined';
  legacyItem.recoveryLevel = 999;
  legacyItem.frameGeneration = 99 as any;
  legacyItem.frameIdentity = 'breacher-dense';
  legacyItem.equipmentQuality = 99;
  legacyItem.augmentSlots = 7;
  legacyItem.augments = ['countermass-coupler', 'countermass-coupler'] as any;
  legacyItem.modifiers = [
    { id: 'countermass', label: 'Legacy Countermass', description: 'legacy', mechanical: false, grade: 5 },
    { id: 'countermass', label: 'Duplicate Countermass', description: 'legacy', mechanical: false, grade: 2 },
    { id: 'breachPropulsion', label: 'Legacy Propulsion', description: 'legacy', mechanical: true, grade: 3 },
    { id: 'tungsten', label: 'Legacy Tungsten', description: 'legacy', mechanical: false, grade: 4 },
  ];
  const legacyEnvelope = {
    version: 1,
    profile,
    campaign,
    savedAt: '2026-09-01T12:00:00.000Z',
  };
  storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(legacyEnvelope));

  assert.equal(validateStoredProfile(profile), null, 'normalizable legacy gear should remain eligible for migration instead of recovery quarantine');

  const migrated = loadGameState(storage as any);
  const item = migrated.profile.inventory.find(candidate => candidate.id === legacyItem.id)!;
  assert.ok(item, 'migration must preserve the legacy item record instead of deleting valid gear');
  assert.equal(item.name, legacyItem.name, 'migration must preserve item identity/presentation');
  assert.equal(item.recoveryLevel, 56, 'legacy recovery level should clamp to the supported Gear 2.0 range');
  assert.equal(item.frameGeneration, 6, 'legacy frame generation should clamp to the supported range');
  assert.equal(item.frameIdentity, 'breacher-dense', 'legacy frame identity should remain attached to the migrated base');
  assert.equal(item.equipmentQuality, 20, 'legacy Equipment Quality should clamp to the current base-frame ceiling');
  assert.equal(item.augmentSlots, 1, 'Refined legacy gear should normalize to the current one-socket responsibility');
  assert.deepEqual(item.augments, ['countermass-coupler'], 'duplicate legacy Augments should be deduplicated and bounded to current socket responsibility');
  assert.deepEqual(item.modifiers.map(modifier => [modifier.id, modifier.grade]), [['countermass', 5], ['tungsten', 4]], 'legacy affixes should dedupe, reject illegal base combinations, and obey the current rarity budget');
  assert.equal(item.recoverySource, 'Legacy recovery', 'migrated gear should retain explicit legacy provenance');
  assert.equal(migrated.profile.equipped.breacher, legacyItem.id, 'equipped identity must survive migration');
  assert.equal(migrated.campaign.shipSystemSchemaVersion, SHIP_SYSTEM_SCHEMA_VERSION, 'legacy atomic saves should migrate into the Ship Systems 2.0 schema.');
  assert.equal(migrated.campaign.shipUpgrades.reactor, 2, 'fully purchased legacy ship upgrades must retain their paid tier.');
  assert.equal(migrated.campaign.shipUpgrades.drive, 1, 'partially purchased legacy ship upgrades must retain their paid tier.');

  const persisted = JSON.parse(storage.getItem(GAME_STATE_STORAGE_KEY)!) as any;
  assert.equal(persisted.version, GAME_STATE_VERSION, 'successful legacy loads should upgrade the atomic save envelope in place');
  assert.equal(persisted.gearSchemaVersion, gearSchemaVersion, 'upgraded saves should declare the Gear 2.0 schema version');
  assert.equal(persisted.operatorNetworkSchemaVersion, OPERATOR_NETWORK_SCHEMA_VERSION, 'upgraded saves should declare the Operator Network schema version');
  assert.equal(persisted.profile.operatorNetwork.schemaVersion, OPERATOR_NETWORK_SCHEMA_VERSION, 'legacy profiles should migrate into canonical Operator Network state');
  assert.equal(persisted.profile.operatorNetwork.startNodeId, 'start-vanguard', 'legacy Vanguard saves should migrate from the Vanguard class origin');
  assert.deepEqual(persisted.profile.allocatedNodes, persisted.profile.operatorNetwork.allocatedNodeIds, 'legacy allocatedNodes must mirror canonical network allocations after migration');
  assert.equal(persisted.profile.progressionPoints, persisted.profile.operatorNetwork.unspentPoints, 'legacy progressionPoints must mirror canonical network points after migration');
  assert.equal(persisted.profile.inventory.some((candidate: any) => candidate.id === legacyItem.id), true, 'upgraded saves must persist the migrated item');
  assert.equal(persisted.campaign.shipSystemSchemaVersion, SHIP_SYSTEM_SCHEMA_VERSION, 'upgraded saves must persist the Ship Systems 2.0 schema marker.');
  assert.equal(persisted.campaign.shipUpgrades.reactor, 2, 'upgraded saves must persist legacy ship-system value exactly.');

  assert.equal(saveGameState(migrated.profile, migrated.campaign, storage as any), true, 'migrated state should remain writable by the normal web/Android autosave path');
  const roundTrip = loadGameState(storage as any);
  assert.equal(roundTrip.profile.equipped.breacher, legacyItem.id, 'current-version state should round-trip after migration');
  assert.equal(validateStoredProfile(roundTrip.profile), null, 'round-tripped migrated profile should satisfy current save validation');
}

function versionTwoNetworkMigrationSmoke() {
  const storage = new MemoryStorage();
  const campaign = createDefaultCampaign();
  delete (campaign as Partial<typeof campaign>).shipSystemSchemaVersion;
  campaign.shipUpgrades.armor = 2;
  const profile: any = { ...createDefaultProfile(), level: 4, xp: 540, progressionPoints: 1, allocatedNodes: ['ballistics-1', 'ballistics-2'] };
  delete profile.operatorNetwork;
  storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify({
    version: 2,
    gearSchemaVersion,
    profile,
    campaign,
    savedAt: '2026-09-20T12:00:00.000Z',
  }));

  const migrated = loadGameState(storage as any);
  assert.equal(migrated.profile.operatorNetwork?.schemaVersion, OPERATOR_NETWORK_SCHEMA_VERSION, 'v2 saves should gain canonical P9-A network state.');
  assert.deepEqual(migrated.profile.operatorNetwork?.allocatedNodeIds, ['ballistics-1', 'ballistics-2'], 'v2 migration should preserve legacy passive allocations.');
  assert.equal(migrated.profile.operatorNetwork?.unspentPoints, 1, 'v2 migration should preserve valid unspent progression points.');
  assert.equal(migrated.campaign.shipSystemSchemaVersion, SHIP_SYSTEM_SCHEMA_VERSION, 'v2 saves should gain canonical Ship Systems 2.0 state.');
  assert.equal(migrated.campaign.shipUpgrades.armor, 2, 'v2 migration should preserve a paid Tier 2 ship system.');

  const persisted = JSON.parse(storage.getItem(GAME_STATE_STORAGE_KEY)!) as any;
  assert.equal(persisted.version, GAME_STATE_VERSION, 'v2 saves should be upgraded to the current atomic envelope.');
  assert.equal(persisted.operatorNetworkSchemaVersion, OPERATOR_NETWORK_SCHEMA_VERSION, 'v2 upgrades should persist the P9-A network schema.');
}

function currentNetworkRepairSmoke() {
  const storage = new MemoryStorage();
  const campaign = createDefaultCampaign();
  const profile: any = {
    ...createDefaultProfile(),
    level: 4,
    xp: 540,
    progressionPoints: 0,
    allocatedNodes: ['ballistics-1', 'retired-network-node'],
    operatorNetwork: {
      schemaVersion: OPERATOR_NETWORK_SCHEMA_VERSION,
      startNodeId: 'start-vanguard',
      allocatedNodeIds: ['ballistics-1', 'retired-network-node'],
      unspentPoints: 0,
    },
  };
  storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify({
    version: GAME_STATE_VERSION,
    gearSchemaVersion,
    operatorNetworkSchemaVersion: OPERATOR_NETWORK_SCHEMA_VERSION,
    profile,
    campaign,
    savedAt: '2026-09-22T10:00:00.000Z',
  }));

  assert.equal(validateStoredProfile(profile), null, 'structurally safe retired Network IDs must reach canonical migration instead of recovery quarantine');
  const repaired = loadGameState(storage as any);
  assert.deepEqual(repaired.profile.allocatedNodes, ['ballistics-1'], 'current-version migration must remove retired Network node IDs.');
  assert.deepEqual(repaired.profile.operatorNetwork?.allocatedNodeIds, ['ballistics-1'], 'canonical Network state must match the repaired legacy mirror.');
  assert.equal(repaired.profile.progressionPoints, 2, 'retired Network node value plus level-earned slack must be refunded safely.');
  assert.equal(repaired.profile.operatorNetwork?.unspentPoints, 2, 'canonical Network refunds must mirror progressionPoints.');

  const persisted = JSON.parse(storage.getItem(GAME_STATE_STORAGE_KEY)!) as any;
  assert.deepEqual(persisted.profile.operatorNetwork.allocatedNodeIds, ['ballistics-1'], 'repaired current-version Network state must be atomically rewritten during load.');
  assert.equal(persisted.profile.operatorNetwork.unspentPoints, 2, 'persisted repair must keep refunded progression value.');
  assert.equal(persisted.profile.allocatedNodes.includes('retired-network-node'), false, 'retired node IDs must not survive the rewritten profile mirror.');
}

function graphicsQualityPersistenceSmoke() {
  for (const mode of ['adaptive', 'flagship', 'performance'] as const) {
    const storage = new MemoryStorage();
    const profile = setProfileSettings(createDefaultProfile(), { graphicsQuality: mode });
    assert.equal(saveGameState(profile, createDefaultCampaign(), storage as any), true, `graphics quality ${mode} should save atomically`);
    const restored = loadGameState(storage as any);
    assert.equal(restored.profile.settings.graphicsQuality, mode, `graphics quality ${mode} should survive save/load normalization`);
  }
}

async function migrationRollbackSnapshotSmoke() {
  const storage = new MemoryStorage();
  const raw = JSON.stringify({
    version: 2,
    gearSchemaVersion,
    profile: createDefaultProfile(),
    campaign: createDefaultCampaign(),
    savedAt: '2026-09-20T12:00:00.000Z',
  });
  storage.setItem(GAME_STATE_STORAGE_KEY, raw);

  const recovery = await prepareSaveRecovery({
    storage: storage as any,
    indexedDb: null,
    now: () => new Date('2026-09-23T12:00:00.000Z'),
    id: () => 'rollback-snapshot',
  });

  assert.equal(recovery.blocked, false, 'supported legacy saves should proceed only after a verified rollback snapshot is created');
  assert.equal(recovery.backups.length, 1, 'legacy atomic saves should create exactly one pre-migration rollback snapshot');
  assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), raw, 'preflight must leave the primary legacy save untouched until migration runs');
  assert.equal(storage.getItem(recovery.backups[0]!.backupKey), raw, 'rollback snapshot must preserve the exact pre-migration bytes');

  const migrated = loadGameState(storage as any);
  const persisted = JSON.parse(storage.getItem(GAME_STATE_STORAGE_KEY)!) as any;
  assert.equal(persisted.version, GAME_STATE_VERSION, 'normal loading should migrate the primary save after rollback protection succeeds');
  assert.equal(migrated.profile.version, createDefaultProfile().version, 'migrated state should remain playable after protected upgrade');
  assert.equal(storage.getItem(recovery.backups[0]!.backupKey), raw, 'migration must not overwrite the rollback snapshot');
}

async function incompatibleFutureSaveLockSmoke() {
  const storage = new MemoryStorage();
  const raw = JSON.stringify({
    version: GAME_STATE_VERSION + 1,
    gearSchemaVersion,
    operatorNetworkSchemaVersion: OPERATOR_NETWORK_SCHEMA_VERSION,
    profile: createDefaultProfile(),
    campaign: createDefaultCampaign(),
    savedAt: '2026-09-24T12:00:00.000Z',
  });
  storage.setItem(GAME_STATE_STORAGE_KEY, raw);

  const recovery = await prepareSaveRecovery({
    storage: storage as any,
    indexedDb: null,
    now: () => new Date('2026-09-23T12:05:00.000Z'),
    id: () => 'future-version',
  });

  assert.equal(recovery.blocked, true, 'a release must refuse to start when it sees a newer incompatible save');
  assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), raw, 'rollback compatibility lock must leave the newer primary save untouched');
  assert.equal(recovery.backups.length, 1, 'compatibility lock should preserve a second exact copy when storage permits');
  assert.equal(storage.getItem(recovery.backups[0]!.backupKey), raw, 'compatibility backup must preserve exact future-save bytes');
  assert.match(recovery.notices.join(' '), /Install a release that supports this save/, 'compatibility lock should tell the player how to recover');
}

async function migrationBackupFailureLockSmoke() {
  const storage = new MigrationBackupFailingStorage();
  const raw = JSON.stringify({
    version: 2,
    gearSchemaVersion,
    profile: createDefaultProfile(),
    campaign: createDefaultCampaign(),
    savedAt: '2026-09-20T12:00:00.000Z',
  });
  storage.setItem(GAME_STATE_STORAGE_KEY, raw);

  const recovery = await prepareSaveRecovery({
    storage: storage as any,
    indexedDb: null,
    now: () => new Date('2026-09-23T12:10:00.000Z'),
    id: () => 'backup-failure',
  });

  assert.equal(recovery.blocked, true, 'migration must stop if no verified rollback snapshot can be created');
  assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), raw, 'failed rollback protection must leave the primary save untouched');
  assert.equal(recovery.backups.length, 0, 'failed rollback protection must not report an unverified backup');
  assert.match(recovery.notices.join(' '), /pre-migration rollback snapshot could not be created/, 'migration lock should explain why startup stopped');
}

async function recoveryPreservationSmoke() {
  const storage = new MemoryStorage();
  const campaign = createDefaultCampaign();
  const profile = createDefaultProfile();
  const item = profile.inventory.find(candidate => candidate.id === 'starter-breacher')!;
  item.modifiers = [{ id: 'removed-legacy-affix' as any, label: 'Unknown', description: 'unknown', mechanical: false }];

  const raw = JSON.stringify({ version: 1, profile, campaign, savedAt: '2026-09-01T12:00:00.000Z' });
  storage.setItem(GAME_STATE_STORAGE_KEY, raw);

  const recovery = await prepareSaveRecovery({
    storage: storage as any,
    indexedDb: null,
    now: () => new Date('2026-09-21T18:00:00.000Z'),
    id: () => 'migration-test',
  });

  assert.equal(recovery.blocked, false, 'verified local backup should let startup continue after quarantining unknown save content');
  assert.equal(recovery.backups.length, 1, 'unknown modifier data should still enter the existing recovery path');
  assert.equal(recovery.backups[0]!.sourceKey, GAME_STATE_STORAGE_KEY, 'recovery should protect the atomic game-state key');
  assert.equal(recovery.backups[0]!.medium, 'localStorage', 'test environment should fall back to localStorage recovery backup');
  assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), null, 'unsafe primary state should be detached only after backup verification');
  assert.equal(storage.getItem(recovery.backups[0]!.backupKey), raw, 'recovery backup must preserve the original raw bytes exactly');
}

async function main() {
  legacyStateMigrationSmoke();
  versionTwoNetworkMigrationSmoke();
  currentNetworkRepairSmoke();
  graphicsQualityPersistenceSmoke();
  await migrationRollbackSnapshotSmoke();
  await incompatibleFutureSaveLockSmoke();
  await migrationBackupFailureLockSmoke();
  await recoveryPreservationSmoke();
  console.log(`SAVE_DATA_MIGRATION_PASS legacy=v1/v2->v${GAME_STATE_VERSION} gearSchema=${gearSchemaVersion} networkSchema=${OPERATOR_NETWORK_SCHEMA_VERSION} currentNetworkRepair=refunded graphicsQuality=adaptive+flagship+performance migrationRollback=preserved incompatibleSave=blocked recovery=preserved`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
