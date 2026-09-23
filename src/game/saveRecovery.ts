import { augmentDefinitions, frameIdentityDefinitions } from './gearDepth';
import { gearSchemaVersion } from './gearSchema';
import { OPERATOR_NETWORK_SCHEMA_VERSION } from './operatorNetwork';
import { SHIP_SYSTEM_MAX_TIER, SHIP_SYSTEM_SCHEMA_VERSION } from './campaign';

export const PROFILE_STORAGE_KEY = 'ironshade-vector-profile-v3';
export const CAMPAIGN_STORAGE_KEY = 'ironshade-vector-campaign-v1';
export const GAME_STATE_STORAGE_KEY = 'ironshade-vector-state-v1';

const RECOVERY_DATABASE = 'ironshade-vector-recovery';
const RECOVERY_STORE = 'backups';
const PROFILE_VERSION = 3;
const CAMPAIGN_VERSION = 1;
const profileSlots = new Set(['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant']);
const profileRarities = new Set(['Field', 'Refined', 'Prototype', 'Singular']);
const modifierIds = new Set([
  'hypervelocity', 'countermass', 'overdrive', 'cryoloop', 'extendedFeed', 'tungsten',
  'vacuumSeal', 'servoWeave', 'capacitorRecycler', 'railFracture', 'dodgeVent',
  'magRedirect', 'breachPropulsion', 'markShear', 'arcDrone',
]);
const frameIdentityById = new Map(frameIdentityDefinitions.map(definition => [definition.id, definition]));
const augmentById = new Map(augmentDefinitions.map(definition => [definition.id, definition]));

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type SaveKind = 'profile' | 'campaign' | 'state';

type RecoveryEnvironment = {
  storage?: StorageLike | null;
  indexedDb?: IDBFactory | null;
  now?: () => Date;
  id?: () => string;
};

export type SaveRecoveryBackup = {
  kind: SaveKind;
  sourceKey: string;
  backupKey: string;
  medium: 'indexeddb' | 'localStorage';
  reason: string;
};

export type SaveRecoveryResult = {
  blocked: boolean;
  notices: string[];
  backups: SaveRecoveryBackup[];
};

type BackupRecord = {
  version: 1;
  sourceKey: string;
  kind: SaveKind;
  createdAt: string;
  reason: string;
  raw: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalNumberReason(value: Record<string, unknown>, field: string, minimum: number, maximum: number, integer = false) {
  const candidate = value[field];
  if (candidate === undefined) return null;
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < minimum || candidate > maximum || (integer && !Number.isInteger(candidate))) {
    return `${field} is outside its valid range`;
  }
  return null;
}

function optionalBooleanReason(value: Record<string, unknown>, field: string) {
  const candidate = value[field];
  return candidate !== undefined && typeof candidate !== 'boolean' ? `${field} is not a boolean` : null;
}

function optionalStringOrNullReason(value: Record<string, unknown>, field: string, maxLength = 256) {
  const candidate = value[field];
  if (candidate === undefined || candidate === null) return null;
  return typeof candidate !== 'string' || candidate.length > maxLength ? `${field} is not a valid string` : null;
}

function optionalStringArrayReason(value: Record<string, unknown>, field: string, maxLength = 256) {
  const candidate = value[field];
  if (candidate === undefined) return null;
  if (!Array.isArray(candidate) || candidate.length > maxLength || candidate.some(entry => typeof entry !== 'string')) return `${field} is not a valid string array`;
  return null;
}

function invalidProfileReason(value: unknown): string | null {
  if (!isRecord(value)) return 'profile root is not an object';
  if (value.version !== PROFILE_VERSION) return `unsupported profile version ${String(value.version ?? 'missing')}`;
  if (!Array.isArray(value.inventory)) return 'profile inventory is not an array';
  if (value.operatorClass !== undefined && value.operatorClass !== 'vanguard' && value.operatorClass !== 'vector' && value.operatorClass !== 'systems') return 'operatorClass is invalid';

  for (const reason of [
    optionalNumberReason(value, 'xp', 0, 10_000_000),
    optionalNumberReason(value, 'level', 1, 20, true),
    optionalNumberReason(value, 'progressionPoints', 0, 10_000, true),
    optionalNumberReason(value, 'runsCompleted', 0, 10_000_000, true),
    optionalBooleanReason(value, 'specializationOverclock'),
    optionalBooleanReason(value, 'classSelectionComplete'),
    optionalStringOrNullReason(value, 'specialization', 64),
    optionalStringArrayReason(value, 'allocatedNodes', 256),
  ]) {
    if (reason) return reason;
  }

  if (value.operatorNetwork !== undefined) {
    if (!isRecord(value.operatorNetwork)) return 'operatorNetwork is not an object';
    const network = value.operatorNetwork;
    if (network.schemaVersion !== OPERATOR_NETWORK_SCHEMA_VERSION) return 'operatorNetwork schema version is unsupported';
    if (typeof network.startNodeId !== 'string' || network.startNodeId.length === 0 || network.startNodeId.length > 128) return 'operatorNetwork start node is invalid';
    if (!Array.isArray(network.allocatedNodeIds) || network.allocatedNodeIds.length > 512 || network.allocatedNodeIds.some(id => typeof id !== 'string' || id.length === 0 || id.length > 128)) return 'operatorNetwork allocated nodes are invalid';
    if (new Set(network.allocatedNodeIds).size !== network.allocatedNodeIds.length) return 'operatorNetwork contains duplicate allocated nodes';
    const pointsReason = optionalNumberReason(network, 'unspentPoints', 0, 10_000, true);
    if (pointsReason) return `operatorNetwork.${pointsReason}`;
  }

  if (value.settings !== undefined) {
    if (!isRecord(value.settings)) return 'settings is not an object';
    const settings = value.settings;
    if (settings.aimAssist !== undefined && settings.aimAssist !== 'light' && settings.aimAssist !== 'balanced') return 'settings.aimAssist is invalid';
    if (settings.graphicsQuality !== undefined && settings.graphicsQuality !== 'adaptive' && settings.graphicsQuality !== 'flagship' && settings.graphicsQuality !== 'performance') return 'settings.graphicsQuality is invalid';
    if (settings.effectIntensity !== undefined && settings.effectIntensity !== 'full' && settings.effectIntensity !== 'reduced') return 'settings.effectIntensity is invalid';
    for (const field of ['rightStickFire', 'screenShake', 'haptics', 'telemetrySharing', 'tutorialComplete']) {
      const reason = optionalBooleanReason(settings, field);
      if (reason) return `settings.${reason}`;
    }
    for (const field of ['effectsVolume', 'uiVolume']) {
      const reason = optionalNumberReason(settings, field, 0, 1);
      if (reason) return `settings.${reason}`;
    }
  }

  if (value.abilityMods !== undefined) {
    if (!isRecord(value.abilityMods)) return 'abilityMods is not an object';
    for (const field of ['mag', 'mark', 'arc']) {
      const reason = optionalStringOrNullReason(value.abilityMods, field, 80);
      if (reason) return `abilityMods.${reason}`;
    }
  }

  const inventoryById = new Map<string, string>();
  for (let index = 0; index < value.inventory.length; index += 1) {
    const item = value.inventory[index];
    if (!isRecord(item)) return `inventory item ${index} is not an object`;
    if (typeof item.id !== 'string' || !item.id || item.id.length > 160) return `inventory item ${index} has an invalid id`;
    if (inventoryById.has(item.id)) return `inventory item ${index} duplicates an existing id`;
    if (typeof item.slot !== 'string' || !profileSlots.has(item.slot)) return `inventory item ${index} has an unknown equipment slot`;
    inventoryById.set(item.id, item.slot);
    if (typeof item.rarity !== 'string' || !profileRarities.has(item.rarity)) return `inventory item ${index} has an unknown rarity`;
    if (!Array.isArray(item.modifiers)) return `inventory item ${index} modifiers are not an array`;
    const levelReason = optionalNumberReason(item, 'levelRequirement', 1, 20, true);
    if (levelReason) return `inventory item ${index} ${levelReason}`;

    for (const modifier of item.modifiers) {
      if (!isRecord(modifier) || typeof modifier.id !== 'string' || !modifierIds.has(modifier.id)) return `inventory item ${index} contains an unknown modifier`;
      const grade = modifier.grade;
      if (grade !== undefined && (typeof grade !== 'number' || !Number.isFinite(grade) || grade < 1 || grade > 5)) return `inventory item ${index} contains an invalid modifier grade`;
    }

    if (item.frameIdentity !== undefined) {
      if (typeof item.frameIdentity !== 'string') return `inventory item ${index} has an invalid frame identity`;
      const frame = frameIdentityById.get(item.frameIdentity as never);
      if (!frame || frame.slot !== item.slot) return `inventory item ${index} has an unknown or mismatched frame identity`;
    }

    if (item.augments !== undefined) {
      if (!Array.isArray(item.augments)) return `inventory item ${index} augments are not an array`;
      for (const augmentId of item.augments) {
        if (typeof augmentId !== 'string') return `inventory item ${index} contains an invalid Augment id`;
        const augment = augmentById.get(augmentId as never);
        if (!augment || !augment.slots.includes(item.slot as never)) return `inventory item ${index} contains an unknown or incompatible Augment`;
      }
    }
  }

  if (value.equipped !== undefined) {
    if (!isRecord(value.equipped)) return 'equipped is not an object';
    for (const slot of profileSlots) {
      const equippedId = value.equipped[slot];
      if (equippedId === undefined || equippedId === null) continue;
      if (typeof equippedId !== 'string') return `equipped.${slot} is not an item id`;
      if (inventoryById.get(equippedId) !== slot) return `equipped.${slot} points to a missing or mismatched item`;
    }
  }

  return null;
}

function objectFieldReason(value: Record<string, unknown>, field: string) {
  const candidate = value[field];
  return candidate !== undefined && !isRecord(candidate) ? `${field} is not an object` : null;
}

function arrayFieldReason(value: unknown, label: string, field: string) {
  if (!isRecord(value)) return null;
  const candidate = value[field];
  return candidate !== undefined && !Array.isArray(candidate) ? `${label}.${field} is not an array` : null;
}

function numericMapReason(value: unknown, label: string, minimum: number, maximum: number, integer = false) {
  if (value === undefined) return null;
  if (!isRecord(value)) return `${label} is not an object`;
  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < minimum || candidate > maximum || (integer && !Number.isInteger(candidate))) {
      return `${label}.${key} is outside its valid range`;
    }
  }
  return null;
}

function invalidCampaignReason(value: unknown): string | null {
  if (!isRecord(value)) return 'campaign root is not an object';
  if (value.version !== CAMPAIGN_VERSION) return `unsupported campaign version ${String(value.version ?? 'missing')}`;

  for (const reason of [
    optionalNumberReason(value, 'cycle', 0, 10_000_000, true),
    optionalNumberReason(value, 'contractsCompleted', 0, 10_000_000, true),
    optionalNumberReason(value, 'shipSystemSchemaVersion', 1, SHIP_SYSTEM_SCHEMA_VERSION, true),
    optionalBooleanReason(value, 'anomalyRecovered'),
    optionalStringOrNullReason(value, 'dailyCompletedDate', 40),
    optionalStringOrNullReason(value, 'lastOutcome', 2_000),
    numericMapReason(value.resources, 'resources', 0, 1_000_000_000),
    numericMapReason(value.consumables, 'consumables', 0, 100_000, true),
    numericMapReason(value.reputation, 'reputation', -1_000_000, 1_000_000),
    numericMapReason(value.shipUpgrades, 'shipUpgrades', 0, SHIP_SYSTEM_MAX_TIER, true),
  ]) {
    if (reason) return reason;
  }

  for (const field of ['resources', 'consumables', 'reputation', 'shipUpgrades', 'story', 'escalation', 'directives']) {
    const reason = objectFieldReason(value, field);
    if (reason) return reason;
  }

  const story = value.story;
  if (isRecord(story)) {
    const arcsReason = objectFieldReason(story, 'arcs');
    if (arcsReason) return `story.${arcsReason}`;
    for (const chapter of ['blackLattice', 'postKhepri', 'interdiction']) {
      const chapterValue = story[chapter];
      if (chapterValue !== undefined && !isRecord(chapterValue)) return `story.${chapter} is not an object`;
      for (const field of chapter === 'interdiction' ? ['completed', 'evidence', 'identifiedTargets'] : ['completed', 'evidence']) {
        const reason = arrayFieldReason(chapterValue, `story.${chapter}`, field);
        if (reason) return reason;
      }
    }
  }

  const escalationReason = arrayFieldReason(value.escalation, 'escalation', 'completed');
  if (escalationReason) return escalationReason;
  if (isRecord(value.escalation)) {
    const stageReason = optionalNumberReason(value.escalation, 'stage', 0, 1_000, true);
    if (stageReason) return `escalation.${stageReason}`;
  }

  const directivesReason = arrayFieldReason(value.directives, 'directives', 'inventory');
  if (directivesReason) return directivesReason;
  if (isRecord(value.directives)) {
    for (const reason of [
      optionalBooleanReason(value.directives, 'unlocked'),
      optionalNumberReason(value.directives, 'completed', 0, 1_000_000, true),
      optionalNumberReason(value.directives, 'highestTier', 0, 12, true),
      optionalStringOrNullReason(value.directives, 'preparedId', 160),
    ]) {
      if (reason) return `directives.${reason}`;
    }
  }
  return null;
}

export function validateStoredProfile(value: unknown) { return invalidProfileReason(value); }
export function validateStoredCampaign(value: unknown) { return invalidCampaignReason(value); }

function invalidGameStateReason(value: unknown): string | null {
  if (!isRecord(value)) return 'game-state root is not an object';
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) return `unsupported game-state version ${String(value.version ?? 'missing')}`;
  if ((value.version === 2 || value.version === 3) && value.gearSchemaVersion !== gearSchemaVersion) return `unsupported gear schema version ${String(value.gearSchemaVersion ?? 'missing')}`;
  if (value.version === 3 && value.operatorNetworkSchemaVersion !== OPERATOR_NETWORK_SCHEMA_VERSION) return `unsupported operator network schema version ${String(value.operatorNetworkSchemaVersion ?? 'missing')}`;
  if (value.version === 3 && (!isRecord(value.profile) || value.profile.operatorNetwork === undefined)) return 'current game-state is missing operator network data';
  if (value.savedAt !== undefined && (typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt)))) return 'savedAt is not a valid timestamp';
  const profileReason = invalidProfileReason(value.profile);
  if (profileReason) return `profile: ${profileReason}`;
  const campaignReason = invalidCampaignReason(value.campaign);
  if (campaignReason) return `campaign: ${campaignReason}`;
  return null;
}

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserIndexedDb(): IDBFactory | null {
  if (typeof indexedDB === 'undefined') return null;
  return indexedDB;
}

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function backupToIndexedDb(factory: IDBFactory, key: string, record: BackupRecord) {
  return new Promise<boolean>(resolve => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      const request = factory.open(RECOVERY_DATABASE, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(RECOVERY_STORE)) database.createObjectStore(RECOVERY_STORE);
      };
      request.onerror = () => finish(false);
      request.onblocked = () => finish(false);
      request.onsuccess = () => {
        const database = request.result;
        try {
          const transaction = database.transaction(RECOVERY_STORE, 'readwrite');
          transaction.objectStore(RECOVERY_STORE).put(record, key);
          transaction.oncomplete = () => { database.close(); finish(true); };
          transaction.onerror = () => { database.close(); finish(false); };
          transaction.onabort = () => { database.close(); finish(false); };
        } catch {
          database.close();
          finish(false);
        }
      };
    } catch {
      finish(false);
    }
  });
}

async function preserveRawSave(storage: StorageLike, indexedDb: IDBFactory | null, sourceKey: string, kind: SaveKind, raw: string, reason: string, createdAt: string, suffix: string): Promise<SaveRecoveryBackup | null> {
  const backupKey = `${sourceKey}-recovery-${createdAt.replace(/[^0-9]/g, '')}-${suffix}`;
  const record: BackupRecord = { version: 1, sourceKey, kind, createdAt, reason, raw };

  if (indexedDb && await backupToIndexedDb(indexedDb, backupKey, record)) {
    return { kind, sourceKey, backupKey, medium: 'indexeddb', reason };
  }

  try {
    storage.setItem(backupKey, raw);
    if (storage.getItem(backupKey) === raw) return { kind, sourceKey, backupKey, medium: 'localStorage', reason };
  } catch {
    // A full or blocked localStorage cannot safely hold a second copy of the save.
  }
  return null;
}

async function inspectSave(storage: StorageLike, indexedDb: IDBFactory | null, sourceKey: string, kind: SaveKind, validator: (value: unknown) => string | null, createdAt: string, suffix: string) {
  let raw: string | null;
  try {
    raw = storage.getItem(sourceKey);
  } catch {
    return { blocked: true, notice: `${kind.toUpperCase()} SAVE RECOVERY LOCK // existing browser storage could not be read, so the game was not started and no save was overwritten.`, backup: null as SaveRecoveryBackup | null };
  }
  if (!raw) return { blocked: false, notice: null as string | null, backup: null as SaveRecoveryBackup | null };

  let parsed: unknown;
  let reason: string | null = null;
  try {
    parsed = JSON.parse(raw);
    reason = validator(parsed);
  } catch {
    reason = 'save JSON could not be parsed';
  }
  if (!reason) return { blocked: false, notice: null as string | null, backup: null as SaveRecoveryBackup | null };

  const backup = await preserveRawSave(storage, indexedDb, sourceKey, kind, raw, reason, createdAt, suffix);
  if (!backup) {
    return { blocked: true, notice: `${kind.toUpperCase()} SAVE RECOVERY LOCK // ${reason}. The original save remains untouched because a verified backup could not be created.`, backup: null as SaveRecoveryBackup | null };
  }

  try {
    storage.removeItem(sourceKey);
    if (storage.getItem(sourceKey) !== null) throw new Error('save key still present');
  } catch {
    return { blocked: true, notice: `${kind.toUpperCase()} SAVE RECOVERY LOCK // ${reason}. A backup was preserved in ${backup.medium}, but the unsafe primary save could not be detached, so startup was stopped.`, backup };
  }

  return {
    blocked: false,
    notice: `${kind.toUpperCase()} SAVE RECOVERY // ${reason}. The original raw save was preserved in ${backup.medium} as ${backup.backupKey} before a clean save was allowed to start.`,
    backup,
  };
}

export async function prepareSaveRecovery(environment: RecoveryEnvironment = {}): Promise<SaveRecoveryResult> {
  if (typeof window === 'undefined' && environment.storage === undefined) return { blocked: false, notices: [], backups: [] };
  const storage = environment.storage === undefined ? browserStorage() : environment.storage;
  const indexedDb = environment.indexedDb === undefined ? browserIndexedDb() : environment.indexedDb;
  if (!storage) return { blocked: true, notices: ['SAVE RECOVERY LOCK // persistent browser storage is unavailable, so startup was stopped before any existing save could be replaced.'], backups: [] };

  const now = (environment.now ?? (() => new Date()))();
  const createdAt = now.toISOString();
  const makeId = environment.id ?? randomId;
  const state = await inspectSave(storage, indexedDb ?? null, GAME_STATE_STORAGE_KEY, 'state', invalidGameStateReason, createdAt, makeId());
  const profile = await inspectSave(storage, indexedDb ?? null, PROFILE_STORAGE_KEY, 'profile', invalidProfileReason, createdAt, makeId());
  const campaign = await inspectSave(storage, indexedDb ?? null, CAMPAIGN_STORAGE_KEY, 'campaign', invalidCampaignReason, createdAt, makeId());
  const backups = [state.backup, profile.backup, campaign.backup].filter((backup): backup is SaveRecoveryBackup => !!backup);
  const notices = [state.notice, profile.notice, campaign.notice].filter((notice): notice is string => !!notice);
  return { blocked: state.blocked || profile.blocked || campaign.blocked, notices, backups };
}
