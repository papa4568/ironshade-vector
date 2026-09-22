import { loadCampaign, type CampaignState } from './campaign';
import { gearSchemaVersion } from './gearSchema';
import { loadProfile, normalizeStoredProfile, type PlayerProfile } from './meta';
import { GAME_STATE_STORAGE_KEY, validateStoredCampaign, validateStoredProfile } from './saveRecovery';

// Profile and campaign are committed atomically so readers never observe half of a progression update. APK verification follows each audited fix.
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const GAME_STATE_VERSION = 2;

export type PersistedGameState = {
  version: typeof GAME_STATE_VERSION;
  gearSchemaVersion: typeof gearSchemaVersion;
  profile: PlayerProfile;
  campaign: CampaignState;
  savedAt: string;
};

type LegacyPersistedGameState = Omit<PersistedGameState, 'version' | 'gearSchemaVersion'> & {
  version: 1;
};

export type GameStateSnapshot = Pick<PersistedGameState, 'profile' | 'campaign'>;

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function legacySnapshot(): GameStateSnapshot {
  return { profile: loadProfile(), campaign: loadCampaign() };
}

function persistedEnvelope(profile: PlayerProfile, campaign: CampaignState): PersistedGameState {
  return {
    version: GAME_STATE_VERSION,
    gearSchemaVersion,
    profile,
    campaign,
    savedAt: new Date().toISOString(),
  };
}

export function loadGameState(storage: StorageLike | null = browserStorage()): GameStateSnapshot {
  if (!storage) return legacySnapshot();
  try {
    const raw = storage.getItem(GAME_STATE_STORAGE_KEY);
    if (!raw) return legacySnapshot();
    const parsed = JSON.parse(raw) as Partial<PersistedGameState | LegacyPersistedGameState>;
    if (parsed.version !== 1 && parsed.version !== GAME_STATE_VERSION) return legacySnapshot();
    if (parsed.version === GAME_STATE_VERSION && parsed.gearSchemaVersion !== gearSchemaVersion) return legacySnapshot();
    if (validateStoredProfile(parsed.profile) || validateStoredCampaign(parsed.campaign)) return legacySnapshot();

    const profile = normalizeStoredProfile(parsed.profile as Partial<PlayerProfile>);
    const campaign = parsed.campaign as CampaignState;
    if (validateStoredProfile(profile)) return legacySnapshot();

    // Version-1 atomic saves predate Gear 2.0 normalization. A successful load upgrades them in place
    // only after the legacy payload has passed recovery validation and the migrated profile validates too.
    if (parsed.version !== GAME_STATE_VERSION || parsed.gearSchemaVersion !== gearSchemaVersion) {
      try {
        storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(persistedEnvelope(profile, campaign)));
      } catch {
        // Keep the migrated session playable. The normal autosave path will surface persistence failure.
      }
    }

    return { profile, campaign };
  } catch {
    return legacySnapshot();
  }
}

// Callers can clear a save-failure warning only after this whole-envelope write succeeds.
export function saveGameState(profile: PlayerProfile, campaign: CampaignState, storage: StorageLike | null = browserStorage()) {
  if (!storage) return typeof window === 'undefined';
  let normalizedProfile: PlayerProfile;
  try {
    normalizedProfile = normalizeStoredProfile(profile);
  } catch {
    return false;
  }
  if (validateStoredProfile(normalizedProfile) || validateStoredCampaign(campaign)) return false;
  try {
    storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(persistedEnvelope(normalizedProfile, campaign)));
    return true;
  } catch {
    return false;
  }
}
