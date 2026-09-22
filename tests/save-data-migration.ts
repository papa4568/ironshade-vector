import assert from 'node:assert/strict';
import { createDefaultCampaign } from '../src/game/campaign';
import { GAME_STATE_VERSION, loadGameState, saveGameState } from '../src/game/gamePersistence';
import { gearSchemaVersion } from '../src/game/gearSchema';
import { createDefaultProfile } from '../src/game/meta';
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

function legacyStateMigrationSmoke() {
  const storage = new MemoryStorage();
  const campaign = createDefaultCampaign();
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

  const persisted = JSON.parse(storage.getItem(GAME_STATE_STORAGE_KEY)!) as any;
  assert.equal(persisted.version, GAME_STATE_VERSION, 'successful legacy loads should upgrade the atomic save envelope in place');
  assert.equal(persisted.gearSchemaVersion, gearSchemaVersion, 'upgraded saves should declare the Gear 2.0 schema version');
  assert.equal(persisted.profile.inventory.some((candidate: any) => candidate.id === legacyItem.id), true, 'upgraded saves must persist the migrated item');

  assert.equal(saveGameState(migrated.profile, migrated.campaign, storage as any), true, 'migrated state should remain writable by the normal web/Android autosave path');
  const roundTrip = loadGameState(storage as any);
  assert.equal(roundTrip.profile.equipped.breacher, legacyItem.id, 'current-version state should round-trip after migration');
  assert.equal(validateStoredProfile(roundTrip.profile), null, 'round-tripped migrated profile should satisfy current save validation');
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

legacyStateMigrationSmoke();
recoveryPreservationSmoke()
  .then(() => console.log('SAVE_DATA_MIGRATION_PASS legacy=v1->v2 gearSchema=1 recovery=preserved'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
