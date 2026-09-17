import { loadCampaign, type CampaignState } from './campaign';
import { loadProfile, type PlayerProfile } from './meta';
import { GAME_STATE_STORAGE_KEY, validateStoredCampaign, validateStoredProfile } from './saveRecovery';

// Profile and campaign are committed atomically so readers never observe half of a progression update.
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export type PersistedGameState = {
  version: 1;
  profile: PlayerProfile;
  campaign: CampaignState;
  savedAt: string;
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

export function loadGameState(storage: StorageLike | null = browserStorage()): GameStateSnapshot {
  if (!storage) return legacySnapshot();
  try {
    const raw = storage.getItem(GAME_STATE_STORAGE_KEY);
    if (!raw) return legacySnapshot();
    const parsed = JSON.parse(raw) as Partial<PersistedGameState>;
    if (parsed.version !== 1) return legacySnapshot();
    if (validateStoredProfile(parsed.profile) || validateStoredCampaign(parsed.campaign)) return legacySnapshot();
    return { profile: parsed.profile as PlayerProfile, campaign: parsed.campaign as CampaignState };
  } catch {
    return legacySnapshot();
  }
}

// Callers can clear a save-failure warning only after this whole-envelope write succeeds.
export function saveGameState(profile: PlayerProfile, campaign: CampaignState, storage: StorageLike | null = browserStorage()) {
  if (!storage) return typeof window === 'undefined';
  if (validateStoredProfile(profile) || validateStoredCampaign(campaign)) return false;
  const envelope: PersistedGameState = { version: 1, profile, campaign, savedAt: new Date().toISOString() };
  try {
    storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}
