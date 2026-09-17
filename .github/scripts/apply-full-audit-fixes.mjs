import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Missing ${label} anchor`);
  return text.replace(from, to);
}

// App: prevent stale telemetry completions from mutating a later debrief,
// and surface browser-storage failures instead of throwing from effects.
{
  const path = 'src/App.tsx';
  let text = read(path);
  text = replaceOnce(text,
    "import { lazy, Suspense, useEffect, useMemo, useState } from 'react';",
    "import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';",
    'App useRef import',
  );
  text = replaceOnce(text,
    "type Debrief = { contract: Contract; campaignReward: CampaignReward; lootReward: VictoryReward; uplinkStatus: UplinkStatus;",
    "type Debrief = { runId: number; contract: Contract; campaignReward: CampaignReward; lootReward: VictoryReward; uplinkStatus: UplinkStatus;",
    'debrief run id type',
  );
  text = replaceOnce(text,
    "  const [debrief, setDebrief] = useState<Debrief | null>(null);\n  const selectedContract = contracts.find(contract => contract.id === selectedContractId) ?? contracts[0];",
    "  const [debrief, setDebrief] = useState<Debrief | null>(null);\n  const debriefRunSequenceRef = useRef(0);\n  const selectedContract = contracts.find(contract => contract.id === selectedContractId) ?? contracts[0];",
    'debrief sequence ref',
  );
  text = replaceOnce(text,
    "  useEffect(() => saveProfile(profile), [profile]);\n  useEffect(() => saveCampaign(campaign), [campaign]);",
    "  const persistenceWarning = 'LOCAL SAVE FAILED // browser storage is unavailable; current-session progress may not survive a restart.';\n  useEffect(() => { if (!saveProfile(profile)) setStatusMessage(persistenceWarning); }, [profile]);\n  useEffect(() => { if (!saveCampaign(campaign)) setStatusMessage(persistenceWarning); }, [campaign]);",
    'persistence warning effects',
  );
  text = replaceOnce(text,
    "  const finishMission = (telemetry: Telemetry, depth: 'safe' | 'deep', salvageTags: number, expeditionProgress?: ExpeditionProgress, fieldLoot: GroundLootReceipt[] = []) => {\n    if (!selectedContract) return;\n    const buildLabel = buildIdentity(profile);",
    "  const finishMission = (telemetry: Telemetry, depth: 'safe' | 'deep', salvageTags: number, expeditionProgress?: ExpeditionProgress, fieldLoot: GroundLootReceipt[] = []) => {\n    if (!selectedContract) return;\n    const debriefRunId = ++debriefRunSequenceRef.current;\n    const buildLabel = buildIdentity(profile);",
    'debrief run sequence increment',
  );
  text = replaceOnce(text,
    "    setDebrief({ contract: selectedContract, campaignReward, lootReward, uplinkStatus, storyNote: storyAdvance.note,",
    "    setDebrief({ runId: debriefRunId, contract: selectedContract, campaignReward, lootReward, uplinkStatus, storyNote: storyAdvance.note,",
    'debrief run id assignment',
  );
  text = replaceOnce(text,
    "          setDebrief(current => current ? { ...current, uplinkStatus: 'shared' } : current);\n        })\n        .catch(() => setDebrief(current => current ? { ...current, uplinkStatus: 'error' } : current));",
    "          setDebrief(current => current?.runId === debriefRunId ? { ...current, uplinkStatus: 'shared' } : current);\n        })\n        .catch(() => setDebrief(current => current?.runId === debriefRunId ? { ...current, uplinkStatus: 'error' } : current));",
    'debrief telemetry completion guard',
  );
  write(path, text);
}

// Persistence: localStorage failures can happen under quota/privacy restrictions.
// Return a status instead of allowing an uncaught storage exception to escape React effects.
{
  const path = 'src/game/meta.ts';
  let text = read(path);
  text = replaceOnce(text,
    "export function saveProfile(profile: PlayerProfile) { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }",
    "export function saveProfile(profile: PlayerProfile) { if (typeof window === 'undefined') return true; try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); return true; } catch { return false; } }",
    'safe profile persistence',
  );
  write(path, text);
}
{
  const path = 'src/game/campaign.ts';
  let text = read(path);
  text = replaceOnce(text,
    "export function saveCampaign(campaign: CampaignState) { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign)); }",
    "export function saveCampaign(campaign: CampaignState) { if (typeof window === 'undefined') return true; try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign)); return true; } catch { return false; } }",
    'safe campaign persistence',
  );
  write(path, text);
}

// Combat: avoid constructing and discarding a full simulation on every HUD render.
// Also make the long-lived animation loop read the latest mutable settings.
{
  const path = 'src/components/GameCanvas.tsx';
  let text = read(path);
  text = replaceOnce(text,
    "const stateRef = useRef<SimState>(createMissionState(firstMission)); const directorRef = useRef<DirectorRuntime>(createDirector());",
    "const [initialMissionState] = useState(() => createMissionState(firstMission)); const stateRef = useRef<SimState>(initialMissionState); const [initialDirector] = useState(() => createDirector()); const directorRef = useRef<DirectorRuntime>(initialDirector);",
    'lazy combat state refs',
  );
  text = replaceOnce(text,
    "  const consumableStockRef = useRef<ConsumableInventory>({ ...consumables });\n  const [consumableStock, setConsumableStock] = useState<ConsumableInventory>(() => ({ ...consumables }));",
    "  const consumableStockRef = useRef<ConsumableInventory>({ ...consumables });\n  const profileSettingsRef = useRef(profileSettings);\n  const [consumableStock, setConsumableStock] = useState<ConsumableInventory>(() => ({ ...consumables }));\n  useEffect(() => { profileSettingsRef.current = profileSettings; }, [profileSettings]);",
    'live profile settings ref',
  );
  text = replaceOnce(text,
    "if (coarse && fireSourcesRef.current.button && profileSettings.rightStickFire && now >= manualAimUntilRef.current) mobileTargetRef.current = aimAtMobileTarget(state, profileSettings.aimAssist, mobileTargetRef.current);",
    "if (coarse && fireSourcesRef.current.button && profileSettingsRef.current.rightStickFire && now >= manualAimUntilRef.current) mobileTargetRef.current = aimAtMobileTarget(state, profileSettingsRef.current.aimAssist, mobileTargetRef.current);",
    'live right-stick settings',
  );
  text = replaceOnce(text,
    "const visualQuality = profileSettings.effectIntensity === 'reduced' ? baseQuality * 0.62 : baseQuality;",
    "const visualQuality = profileSettingsRef.current.effectIntensity === 'reduced' ? baseQuality * 0.62 : baseQuality;",
    'live effect-intensity setting',
  );
  text = replaceOnce(text,
    "if (profileSettings.screenShake && state.weaponFlash > 0)",
    "if (profileSettingsRef.current.screenShake && state.weaponFlash > 0)",
    'live screen-shake setting',
  );
  write(path, text);
}

// Operations API: protect aggregate metrics against overlapping read/modify/write uploads.
// Netlify Blobs conditional writes make the aggregate update optimistic and retryable.
{
  const path = 'netlify/functions/api.ts';
  let text = read(path);
  text = replaceOnce(text,
    "async function updateMetrics(runId: string, run: RunRecord) {\n  const store = metricsStore();\n  const base = await readMetrics();",
    "async function updateMetrics(runId: string, run: RunRecord) {\n  const store = metricsStore();\n  for (let attempt = 0; attempt < 8; attempt += 1) {\n    const version = await store.getWithMetadata(METRICS_KEY, { type: 'json', consistency: 'strong' }) as { data: MetricsRecord; etag: string } | null;\n    const base = normalizeMetrics(version?.data);",
    'metrics optimistic retry loop',
  );
  text = replaceOnce(text,
    "  await store.setJSON(METRICS_KEY, next);\n  return next;\n}\n\nfunction cleanText",
    "    const result = version\n      ? await store.setJSON(METRICS_KEY, next, { onlyIfMatch: version.etag })\n      : await store.setJSON(METRICS_KEY, next, { onlyIfNew: true });\n    if (result.modified) return next;\n  }\n  throw new Error('Metrics update contention exceeded retry budget');\n}\n\nfunction cleanText",
    'metrics conditional write',
  );
  write(path, text);
}

// Gameplay regression: storage write failures must be non-fatal and detectable.
{
  const path = 'tests/gameplay-regressions.ts';
  let text = read(path);
  text = replaceOnce(text,
    "import { aimAtMobileTarget, applyPlayerDamage, createSimulation, triggerConsumable } from '../src/game/sim';",
    "import { aimAtMobileTarget, applyPlayerDamage, createSimulation, triggerConsumable } from '../src/game/sim';\nimport { createDefaultProfile, saveProfile } from '../src/game/meta';",
    'profile persistence test imports',
  );
  text = replaceOnce(text,
    "const storage = new Map<string, string>();\nconst localStorage = {\n  getItem: (key: string) => storage.get(key) ?? null,\n  setItem: (key: string, value: string) => { storage.set(key, String(value)); },",
    "const storage = new Map<string, string>();\nlet failStorageWrites = false;\nconst localStorage = {\n  getItem: (key: string) => storage.get(key) ?? null,\n  setItem: (key: string, value: string) => { if (failStorageWrites) throw new Error('storage blocked'); storage.set(key, String(value)); },",
    'storage failure switch',
  );
  text = replaceOnce(text,
    "assert.ok(aimState.player.aim.x < -0.95, 'assisted aim should still converge fully on the target');\n\nconsole.log(`GAMEPLAY_REGRESSIONS_PASS",
    "assert.ok(aimState.player.aim.x < -0.95, 'assisted aim should still converge fully on the target');\n\nfailStorageWrites = true;\nassert.equal(saveCampaign(campaign), false, 'campaign persistence should report blocked storage without throwing');\nassert.equal(saveProfile(createDefaultProfile()), false, 'profile persistence should report blocked storage without throwing');\nfailStorageWrites = false;\n\nconsole.log(`GAMEPLAY_REGRESSIONS_PASS",
    'storage failure regression assertions',
  );
  write(path, text);
}

// Render regression: catch accidental render-time simulation allocation and stale settings closure.
{
  const path = 'tests/render-performance.ts';
  let text = read(path);
  text = replaceOnce(text,
    "import { AdaptiveRenderBudget } from '../src/game/renderQuality';",
    "import { readFileSync } from 'node:fs';\nimport { resolve } from 'node:path';\nimport { AdaptiveRenderBudget } from '../src/game/renderQuality';",
    'render source test imports',
  );
  text = replaceOnce(text,
    "const desktop = new AdaptiveRenderBudget(false);",
    "const gameCanvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');\nassert(!gameCanvasSource.includes('useRef<SimState>(createMissionState(firstMission))'), 'GameCanvas must not construct a new simulation on every React render');\nassert(gameCanvasSource.includes('useState(() => createMissionState(firstMission))'), 'GameCanvas initial simulation should use a lazy one-time initializer');\nassert(gameCanvasSource.includes('profileSettingsRef.current.effectIntensity') && gameCanvasSource.includes('profileSettingsRef.current.screenShake'), 'combat render loop must read live profile settings');\n\nconst desktop = new AdaptiveRenderBudget(false);",
    'render allocation regression assertions',
  );
  write(path, text);
}

// Existing UI source regression suite also guards async debrief ownership.
{
  const path = 'tests/ui-readability.ts';
  let text = read(path);
  text = replaceOnce(text,
    "assert(app.includes('discardRecoveredItem') && app.includes('discardItem(current, itemId)'), 'Debrief discard is not wired to persistent profile inventory.');",
    "assert(app.includes('discardRecoveredItem') && app.includes('discardItem(current, itemId)'), 'Debrief discard is not wired to persistent profile inventory.');\nassert(app.includes('debriefRunSequenceRef') && app.includes('current?.runId === debriefRunId'), 'Telemetry completion can still mutate a later mission debrief.');\nassert(app.includes('LOCAL SAVE FAILED') && app.includes('!saveProfile(profile)') && app.includes('!saveCampaign(campaign)'), 'Local persistence failures are not surfaced to the player.');",
    'App race and persistence regressions',
  );
  write(path, text);
}

// Service-safety regression: protects the conditional aggregate update and retired migration cleanup.
{
  const path = 'tests/service-regressions.mjs';
  const content = `import assert from 'node:assert/strict';\nimport { existsSync, readFileSync } from 'node:fs';\n\nconst api = readFileSync('netlify/functions/api.ts', 'utf8');\nassert.match(api, /getWithMetadata\\(METRICS_KEY/, 'metrics update must read an ETag before writing');\nassert.match(api, /onlyIfMatch: version\\.etag/, 'existing metrics writes must be conditional');\nassert.match(api, /onlyIfNew: true/, 'first metrics write must be create-only');\nassert.match(api, /Metrics update contention exceeded retry budget/, 'metrics update must fail rather than silently lose a contended write');\nassert.equal(existsSync('.github/workflows/fix-three-objective-beacon.yml'), false, 'completed objective-beacon migration workflow must stay retired');\nassert.equal(existsSync('scripts/apply-three-objective-beacon.mjs'), false, 'completed objective-beacon migration script must stay retired');\nconsole.log('SERVICE_REGRESSIONS_PASS metrics=conditional staleMigration=removed');\n`;
  write(path, content);
}

// Ensure service regressions are part of every production build.
{
  const path = 'package.json';
  const packageJson = JSON.parse(read(path));
  packageJson.scripts['test:service'] = 'node tests/service-regressions.mjs';
  packageJson.scripts.build = 'npm run test:beta && npm run test:gameplay && npm run test:service && npm run test:maps && npm run test:loot && npm run test:ui && npm run test:render && vite build && npm run test:bundle';
  write(path, `${JSON.stringify(packageJson, null, 2)}\n`);
}

console.log('FULL_AUDIT_PATCH_APPLIED');
