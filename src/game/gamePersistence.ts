import { loadCampaign, normalizeCampaignState, type CampaignState } from './campaign';
import { gearSchemaVersion } from './gearSchema';
import { loadProfile, normalizeStoredProfile, type PlayerProfile } from './meta';
import { OPERATOR_NETWORK_SCHEMA_VERSION, isSupportedOperatorNetworkSchemaVersion } from './operatorNetwork';
import { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, validateStoredCampaign, validateStoredProfile } from './saveRecovery';

// Profile and campaign are committed atomically so readers never observe half of a progression update. APK verification follows each audited fix.
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export { GAME_STATE_VERSION } from './saveRecovery';

export type PersistedGameState = {
  version: typeof GAME_STATE_VERSION;
  gearSchemaVersion: typeof gearSchemaVersion;
  operatorNetworkSchemaVersion: typeof OPERATOR_NETWORK_SCHEMA_VERSION;
  profile: PlayerProfile;
  campaign: CampaignState;
  savedAt: string;
};

type LegacyPersistedGameState = Omit<PersistedGameState, 'version' | 'gearSchemaVersion' | 'operatorNetworkSchemaVersion'> & {
  version: 1 | 2 | 3;
  gearSchemaVersion?: typeof gearSchemaVersion;
  operatorNetworkSchemaVersion?: number;
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
    operatorNetworkSchemaVersion: OPERATOR_NETWORK_SCHEMA_VERSION,
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
    if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== GAME_STATE_VERSION) return legacySnapshot();
    if ((parsed.version === 2 || parsed.version === 3 || parsed.version === GAME_STATE_VERSION) && parsed.gearSchemaVersion !== gearSchemaVersion) return legacySnapshot();
    if (parsed.version === 3 && !isSupportedOperatorNetworkSchemaVersion(parsed.operatorNetworkSchemaVersion)) return legacySnapshot();
    if (parsed.version === GAME_STATE_VERSION && parsed.operatorNetworkSchemaVersion !== OPERATOR_NETWORK_SCHEMA_VERSION) return legacySnapshot();
    if (validateStoredProfile(parsed.profile) || validateStoredCampaign(parsed.campaign)) return legacySnapshot();

    const profile = normalizeStoredProfile(parsed.profile as Partial<PlayerProfile>);
    const campaign = normalizeCampaignState(parsed.campaign as Partial<CampaignState>);
    if (validateStoredProfile(profile) || validateStoredCampaign(campaign)) return legacySnapshot();
    const profileRepaired = JSON.stringify(parsed.profile) !== JSON.stringify(profile);
    const campaignRepaired = JSON.stringify(parsed.campaign) !== JSON.stringify(campaign);

    // Legacy atomic saves predate Gear 2.0, the deep Operator Network, or Ship Systems 2.0. Current saves can
    // also require a bounded canonical repair when retired progression data is refunded or normalized.
    // Persist only after both the original payload and repaired state have passed recovery validation.
    if (parsed.version !== GAME_STATE_VERSION || parsed.gearSchemaVersion !== gearSchemaVersion || parsed.operatorNetworkSchemaVersion !== OPERATOR_NETWORK_SCHEMA_VERSION || profileRepaired || campaignRepaired) {
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
