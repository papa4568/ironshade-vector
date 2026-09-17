import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(needle)) throw new Error(`Unable to locate ${label}`);
  return source.replace(needle, replacement);
}

const appPath = 'src/App.tsx';
let app = readFileSync(appPath, 'utf8');
app = replaceOnce(
  app,
  "import { advanceEscalationAfterContract, applyShipBonuses, dailyOperationContract, factionDisplayName, generateContracts, generateEscalationContract, loadCampaign, resourceLabels, saveCampaign, settleContract, type CampaignReward, type CampaignState, type Contract, type ExpeditionProgress, type ResourceId } from './game/campaign';",
  "import { advanceEscalationAfterContract, applyShipBonuses, dailyOperationContract, factionDisplayName, generateContracts, generateEscalationContract, resourceLabels, settleContract, type CampaignReward, type CampaignState, type Contract, type ExpeditionProgress, type ResourceId } from './game/campaign';",
  'campaign persistence imports',
);
app = replaceOnce(
  app,
  "import { awardRecovery, buildIdentity, deriveCombatBuild, discardItem, dominantEquipmentFaction, loadProfile, saveProfile, setProfileSettings, type PlayerProfile, type ProfileSettings, type VictoryReward } from './game/meta';",
  "import { awardRecovery, buildIdentity, deriveCombatBuild, discardItem, dominantEquipmentFaction, setProfileSettings, type PlayerProfile, type ProfileSettings, type VictoryReward } from './game/meta';",
  'profile persistence imports',
);
app = replaceOnce(
  app,
  "import type { GroundLootReceipt } from './game/fieldLoot';",
  "import type { GroundLootReceipt } from './game/fieldLoot';\nimport { loadGameState, saveGameState } from './game/gamePersistence';",
  'game persistence import',
);
app = replaceOnce(
  app,
  "  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());\n  const [campaign, setCampaign] = useState<CampaignState>(() => loadCampaign());",
  "  const [initialGameState] = useState(() => loadGameState());\n  const [profile, setProfile] = useState<PlayerProfile>(initialGameState.profile);\n  const [campaign, setCampaign] = useState<CampaignState>(initialGameState.campaign);",
  'App persistence initialization',
);
app = replaceOnce(
  app,
  "  useEffect(() => { if (!saveProfile(profile)) setStatusMessage(persistenceWarning); }, [profile]);\n  useEffect(() => { if (!saveCampaign(campaign)) setStatusMessage(persistenceWarning); }, [campaign]);",
  "  useEffect(() => { if (!saveGameState(profile, campaign)) setStatusMessage(persistenceWarning); }, [profile, campaign]);",
  'App persistence effects',
);
writeFileSync(appPath, app);

const persistencePath = 'src/game/gamePersistence.ts';
const persistenceSource = `import { loadCampaign, type CampaignState } from './campaign';\nimport { loadProfile, type PlayerProfile } from './meta';\nimport { GAME_STATE_STORAGE_KEY, validateStoredCampaign, validateStoredProfile } from './saveRecovery';\n\ntype StorageLike = Pick<Storage, 'getItem' | 'setItem'>;\n\nexport type PersistedGameState = {\n  version: 1;\n  profile: PlayerProfile;\n  campaign: CampaignState;\n  savedAt: string;\n};\n\nexport type GameStateSnapshot = Pick<PersistedGameState, 'profile' | 'campaign'>;\n\nfunction browserStorage(): StorageLike | null {\n  if (typeof window === 'undefined') return null;\n  try {\n    return window.localStorage;\n  } catch {\n    return null;\n  }\n}\n\nfunction legacySnapshot(): GameStateSnapshot {\n  return { profile: loadProfile(), campaign: loadCampaign() };\n}\n\nexport function loadGameState(storage: StorageLike | null = browserStorage()): GameStateSnapshot {\n  if (!storage) return legacySnapshot();\n  try {\n    const raw = storage.getItem(GAME_STATE_STORAGE_KEY);\n    if (!raw) return legacySnapshot();\n    const parsed = JSON.parse(raw) as Partial<PersistedGameState>;\n    if (parsed.version !== 1) return legacySnapshot();\n    if (validateStoredProfile(parsed.profile) || validateStoredCampaign(parsed.campaign)) return legacySnapshot();\n    return { profile: parsed.profile as PlayerProfile, campaign: parsed.campaign as CampaignState };\n  } catch {\n    return legacySnapshot();\n  }\n}\n\nexport function saveGameState(profile: PlayerProfile, campaign: CampaignState, storage: StorageLike | null = browserStorage()) {\n  if (!storage) return typeof window === 'undefined';\n  if (validateStoredProfile(profile) || validateStoredCampaign(campaign)) return false;\n  const envelope: PersistedGameState = { version: 1, profile, campaign, savedAt: new Date().toISOString() };\n  try {\n    storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(envelope));\n    return true;\n  } catch {\n    return false;\n  }\n}\n`;
writeFileSync(persistencePath, persistenceSource);

const recoveryPath = 'src/game/saveRecovery.ts';
let recovery = readFileSync(recoveryPath, 'utf8');
recovery = replaceOnce(
  recovery,
  "export const CAMPAIGN_STORAGE_KEY = 'ironshade-vector-campaign-v1';",
  "export const CAMPAIGN_STORAGE_KEY = 'ironshade-vector-campaign-v1';\nexport const GAME_STATE_STORAGE_KEY = 'ironshade-vector-state-v1';",
  'combined persistence storage key',
);
recovery = replaceOnce(
  recovery,
  "type SaveKind = 'profile' | 'campaign';",
  "type SaveKind = 'profile' | 'campaign' | 'state';",
  'save recovery kind',
);
recovery = replaceOnce(
  recovery,
  "function browserStorage(): StorageLike | null {",
  `export function validateStoredProfile(value: unknown) { return invalidProfileReason(value); }\nexport function validateStoredCampaign(value: unknown) { return invalidCampaignReason(value); }\n\nfunction invalidGameStateReason(value: unknown): string | null {\n  if (!isRecord(value)) return 'game-state root is not an object';\n  if (value.version !== 1) return \`unsupported game-state version \${String(value.version ?? 'missing')}\`;\n  const profileReason = invalidProfileReason(value.profile);\n  if (profileReason) return \`profile: \${profileReason}\`;\n  const campaignReason = invalidCampaignReason(value.campaign);\n  if (campaignReason) return \`campaign: \${campaignReason}\`;\n  return null;\n}\n\nfunction browserStorage(): StorageLike | null {`,
  'combined save validator',
);
recovery = replaceOnce(
  recovery,
  "  const profile = await inspectSave(storage, indexedDb ?? null, PROFILE_STORAGE_KEY, 'profile', invalidProfileReason, createdAt, makeId());\n  const campaign = await inspectSave(storage, indexedDb ?? null, CAMPAIGN_STORAGE_KEY, 'campaign', invalidCampaignReason, createdAt, makeId());\n  const backups = [profile.backup, campaign.backup].filter((backup): backup is SaveRecoveryBackup => !!backup);\n  const notices = [profile.notice, campaign.notice].filter((notice): notice is string => !!notice);\n  return { blocked: profile.blocked || campaign.blocked, notices, backups };",
  "  const state = await inspectSave(storage, indexedDb ?? null, GAME_STATE_STORAGE_KEY, 'state', invalidGameStateReason, createdAt, makeId());\n  const profile = await inspectSave(storage, indexedDb ?? null, PROFILE_STORAGE_KEY, 'profile', invalidProfileReason, createdAt, makeId());\n  const campaign = await inspectSave(storage, indexedDb ?? null, CAMPAIGN_STORAGE_KEY, 'campaign', invalidCampaignReason, createdAt, makeId());\n  const backups = [state.backup, profile.backup, campaign.backup].filter((backup): backup is SaveRecoveryBackup => !!backup);\n  const notices = [state.notice, profile.notice, campaign.notice].filter((notice): notice is string => !!notice);\n  return { blocked: state.blocked || profile.blocked || campaign.blocked, notices, backups };",
  'combined save recovery inspection',
);
writeFileSync(recoveryPath, recovery);

const testPath = 'tests/gameplay-regressions.ts';
let test = readFileSync(testPath, 'utf8');
test = replaceOnce(
  test,
  "import { CAMPAIGN_STORAGE_KEY, prepareSaveRecovery, PROFILE_STORAGE_KEY } from '../src/game/saveRecovery';",
  "import { CAMPAIGN_STORAGE_KEY, GAME_STATE_STORAGE_KEY, prepareSaveRecovery, PROFILE_STORAGE_KEY } from '../src/game/saveRecovery';\nimport { loadGameState, saveGameState } from '../src/game/gamePersistence';",
  'transactional persistence test imports',
);
const atomicMarker = "const atomicProfile = createDefaultProfile();";
if (!test.includes(atomicMarker)) {
  const insertBefore = "async function runSaveRecoveryRegressions() {";
  if (!test.includes(insertBefore)) throw new Error('Unable to locate save recovery regression function');
  const atomicRegression = `storage.clear();\nconst atomicProfile = createDefaultProfile();\natomicProfile.xp = 111;\nconst atomicCampaign = createDefaultCampaign();\natomicCampaign.resources.credits = 777;\nassert.equal(saveGameState(atomicProfile, atomicCampaign, localStorage), true, 'combined game state should commit profile and campaign in one storage write');\nconst committedEnvelope = localStorage.getItem(GAME_STATE_STORAGE_KEY);\nassert.ok(committedEnvelope, 'combined persistence should create a versioned game-state envelope');\nconst nextAtomicProfile = { ...atomicProfile, xp: 222 };\nconst nextAtomicCampaign = { ...atomicCampaign, resources: { ...atomicCampaign.resources, credits: 888 } };\nfailStorageWrites = true;\nassert.equal(saveGameState(nextAtomicProfile, nextAtomicCampaign, localStorage), false, 'failed combined persistence should report the failed transaction');\nfailStorageWrites = false;\nassert.equal(localStorage.getItem(GAME_STATE_STORAGE_KEY), committedEnvelope, 'a failed transaction must leave the previous committed envelope byte-for-byte intact');\nconst reloadedAtomic = loadGameState(localStorage);\nassert.equal(reloadedAtomic.profile.xp, 111, 'failed persistence must not expose the newer profile without its matching campaign');\nassert.equal(reloadedAtomic.campaign.resources.credits, 777, 'failed persistence must not expose the newer campaign without its matching profile');\n\nstorage.clear();\nconst legacyProfile = createDefaultProfile();\nlegacyProfile.xp = 63;\nconst legacyAtomicCampaign = createDefaultCampaign();\nlegacyAtomicCampaign.resources.credits = 432;\nassert.equal(saveProfile(legacyProfile), true);\nassert.equal(saveCampaign(legacyAtomicCampaign), true);\nconst migratedAtomic = loadGameState(localStorage);\nassert.equal(migratedAtomic.profile.xp, 63, 'combined persistence should migrate from the existing profile key when no envelope exists');\nassert.equal(migratedAtomic.campaign.resources.credits, 432, 'combined persistence should migrate from the existing campaign key when no envelope exists');\n\n`;
  test = test.replace(insertBefore, atomicRegression + insertBefore);
}
const recoveryInsertMarker = "  storage.clear();\n  const unreadableRaw = '{bad-profile-json';";
if (!test.includes("const incompatibleStateRaw = JSON.stringify")) {
  if (!test.includes(recoveryInsertMarker)) throw new Error('Unable to locate recovery insertion point');
  const stateRecoveryRegression = `  storage.clear();\n  const incompatibleStateRaw = JSON.stringify({ version: 1, profile: createDefaultProfile(), campaign: { ...createDefaultCampaign(), version: 99 }, savedAt: '2026-09-16T12:02:30.000Z' });\n  localStorage.setItem(GAME_STATE_STORAGE_KEY, incompatibleStateRaw);\n  const stateRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => new Date('2026-09-16T12:02:30.000Z'), id: () => 'state' });\n  assert.equal(stateRecovery.blocked, false, 'an incompatible combined state should be quarantined before startup');\n  assert.equal(localStorage.getItem(GAME_STATE_STORAGE_KEY), null, 'unsafe combined state should be detached before the game loader can use it');\n  const stateBackup = stateRecovery.backups.find(backup => backup.kind === 'state');\n  assert.ok(stateBackup, 'invalid combined state should produce a recovery backup');\n  assert.equal(localStorage.getItem(stateBackup.backupKey), incompatibleStateRaw, 'combined state recovery must preserve the exact original bytes');\n\n`;
  test = test.replace(recoveryInsertMarker, stateRecoveryRegression + recoveryInsertMarker);
}
test = test.replace(
  "return malformedProfileRecovery.backups.length + campaignRecovery.backups.length;",
  "return malformedProfileRecovery.backups.length + campaignRecovery.backups.length + stateRecovery.backups.length;",
);
test = test.replace(
  "saveRecovery=${saveRecoveryCount}`))",
  "saveRecovery=${saveRecoveryCount} transactional=1`))",
);
writeFileSync(testPath, test);

const workflowPath = '.github/workflows/fix-transactional-persistence.yml';
const scriptPath = 'scripts/apply-transactional-persistence.mjs';
// The workflow is one-shot. Remove its scaffolding from the verified product commit.
if (existsSync(workflowPath)) unlinkSync(workflowPath);
if (existsSync(scriptPath)) unlinkSync(scriptPath);

console.log('TRANSACTIONAL_PERSISTENCE_PATCHED');
