import { getStore } from '@netlify/blobs';
import type { Config, Context } from '@netlify/functions';

type RunOutcome = 'safe' | 'deep' | 'failed';
type WeaponId = 'carbine' | 'breacher' | 'rail';
type TracePoint = { t: number; x: number; y: number; hp: number; armor: number; weapon: WeaponId };
type TierBalanceMetric = { attempts: number; extractions: number; safeRuns: number; deepRuns: number; failedRuns: number; totalDamageTaken: number; totalDuration: number; killIntervalTotal: number; killIntervalSamples: number; lootQualityTotal: number; lootItems: number; singulars: number; modifierGrades: Record<string, number> };
type RunSummary = { id: string; contractTitle: string; location: string; outcome: RunOutcome; operationTier: number; directive: boolean; level: number; duration: number; buildLabel: string; createdAt: string; tracePoints: number; daily: boolean };
type RunRecord = Omit<RunSummary, 'id' | 'tracePoints'> & { contractId: string; objectiveMode: string; salvageTags: number; damageDealt: number; damageTaken: number; weaponShots: Record<WeaponId, number>; abilityUses: [number, number, number]; bossDefeated: boolean; operationDate: string; kills: number; eliteProtocolValue: number; killIntervalTotal: number; killIntervalSamples: number; protocolCombinations: Record<string, number>; recoveryQualities: number[]; modifierGrades: number[]; singularCount: number; trace: TracePoint[] };
type MetricsRecord = { runs: number; attempts: number; safeRuns: number; deepRuns: number; failedRuns: number; totalDamageTaken: number; totalDamageDealt: number; totalDuration: number; weaponShots: Record<WeaponId, number>; byTier: Record<string, TierBalanceMetric>; protocolCombinations: Record<string, number>; recent: RunSummary[] };
type DailyOperation = { date: string; seed: number; codename: string; sponsor: 'meridian' | 'heliostat' | 'longarc'; archetype: 'salvage' | 'boarding' | 'stabilization'; objectiveMode: 'pressure-recovery' | 'grid-isolation' | 'gravity-stabilization' | 'machinery-recovery' | 'emergency-boarding' | 'deep-salvage'; location: 'orbital-station' | 'damaged-vessel' | 'asteroid-refinery' | 'spin-habitat' | 'jovian-harvester' | 'ice-mine' | 'solar-yard'; conditions: Array<'unstable-pressure' | 'failing-gravity' | 'damaged-grid' | 'automated-defense' | 'limited-atmosphere' | 'low-visibility'>; challenge: string; generatedAt: string };
type TelemetrySessionRecord = { requestId: string; credential: string; clientKey: string; issuedAt: string; expiresAt: string };
type TelemetryQuotaRecord = { windowStartedAt: number; issued: number };
type AcceptedRunStateRecord = { acceptedRuns: number };

const dailyStore = () => getStore('ironshade-daily');
const metricsStore = () => getStore({ name: 'ironshade-metrics', consistency: 'strong' });
// Only telemetry that passes the strict ingestion gate enters this ledger; aggregate balance metrics are derived exclusively from it.
const acceptedRunsStore = () => getStore({ name: 'ironshade-runs', consistency: 'strong' });
const acceptedRunStateStore = () => getStore({ name: 'ironshade-run-ledger-state', consistency: 'strong' });
const telemetrySessionsStore = () => getStore({ name: 'ironshade-telemetry-sessions', consistency: 'strong' });
const telemetryQuotaStore = () => getStore({ name: 'ironshade-telemetry-quota', consistency: 'strong' });
const METRICS_KEY = 'global';
const ACCEPTED_RUN_STATE_KEY = 'accepted-runs';
const MAX_RUN_TELEMETRY_BYTES = 512_000;
const MAX_TELEMETRY_SESSION_BYTES = 4_096;
const TELEMETRY_SESSION_TTL_MS = 5 * 60 * 1_000;
const TELEMETRY_QUOTA_WINDOW_MS = 60 * 60 * 1_000;
const TELEMETRY_SESSIONS_PER_WINDOW = 24;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}
function problem(message: string, status: number) {
  return json({ error: message }, status);
}
function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function hashText(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function telemetryClientKey(ip: string | undefined) { return `client-${hashText(ip?.trim() || 'unknown').toString(36)}`; }
function isTelemetryRequestId(value: string) { return /^[A-Za-z0-9._-]{16,80}$/.test(value); }
function createTelemetryCredential() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `tsc_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function makeDailyOperation(date: string): DailyOperation {
  const seed = hashText(`ironshade-vector:${date}`);
  const archetypes: DailyOperation['archetype'][] = ['salvage', 'boarding', 'stabilization'];
  const locations: DailyOperation['location'][] = ['orbital-station', 'damaged-vessel', 'asteroid-refinery', 'spin-habitat', 'jovian-harvester', 'ice-mine', 'solar-yard'];
  const objectiveModes: DailyOperation['objectiveMode'][] = ['pressure-recovery', 'grid-isolation', 'gravity-stabilization', 'machinery-recovery', 'emergency-boarding', 'deep-salvage'];
  const conditionPairs: DailyOperation['conditions'][] = [['unstable-pressure', 'limited-atmosphere'], ['failing-gravity', 'damaged-grid'], ['automated-defense', 'low-visibility'], ['unstable-pressure', 'failing-gravity'], ['damaged-grid', 'automated-defense'], ['limited-atmosphere', 'low-visibility']];
  const adjectives = ['Cold', 'Silent', 'Vector', 'Ash', 'Broken', 'Long'];
  const nouns = ['Relay', 'Crucible', 'Spindle', 'Transit', 'Wake', 'Anchor'];
  const archetype = archetypes[seed % archetypes.length];
  const sponsor = archetype === 'salvage' ? 'longarc' : archetype === 'boarding' ? 'meridian' : 'heliostat';
  const location = locations[(seed >>> 5) % locations.length];
  const objectiveMode = objectiveModes[(seed >>> 21) % objectiveModes.length];
  const conditions = conditionPairs[(seed >>> 9) % conditionPairs.length];
  const codename = `${adjectives[(seed >>> 13) % adjectives.length]} ${nouns[(seed >>> 17) % nouns.length]}`;
  return { date, seed, codename, sponsor, archetype, objectiveMode, location, conditions, challenge: 'Shared daily configuration // identical location, objective family and environmental conditions // first extraction earns +15% materials.', generatedAt: new Date().toISOString() };
}

async function ensureDailyOperation(date = dayKey()) {
  const store = dailyStore();
  const existing = await store.get(date, { type: 'json', consistency: 'strong' }) as DailyOperation | null;
  if (existing?.date === date && existing.objectiveMode) return existing;
  const desired = makeDailyOperation(date);
  await store.setJSON(date, desired, { onlyIfNew: true });
  return (await store.get(date, { type: 'json', consistency: 'strong' }) as DailyOperation | null) ?? desired;
}

function emptyTier(): TierBalanceMetric { return { attempts: 0, extractions: 0, safeRuns: 0, deepRuns: 0, failedRuns: 0, totalDamageTaken: 0, totalDuration: 0, killIntervalTotal: 0, killIntervalSamples: 0, lootQualityTotal: 0, lootItems: 0, singulars: 0, modifierGrades: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } }; }
function emptyMetrics(): MetricsRecord { return { runs: 0, attempts: 0, safeRuns: 0, deepRuns: 0, failedRuns: 0, totalDamageTaken: 0, totalDamageDealt: 0, totalDuration: 0, weaponShots: { carbine: 0, breacher: 0, rail: 0 }, byTier: {}, protocolCombinations: {}, recent: [] }; }
function normalizeTier(value: Partial<TierBalanceMetric> | undefined): TierBalanceMetric {
  const base = emptyTier();
  return { ...base, ...value, modifierGrades: { ...base.modifierGrades, ...(value?.modifierGrades ?? {}) } };
}
function normalizeRunOutcome(outcome: unknown): RunOutcome { return outcome === 'failed' || outcome === 'deep' ? outcome : 'safe'; }
function normalizeRunSummary(value: Partial<RunSummary>, index: number): RunSummary {
  const numberOr = (input: unknown, fallback: number) => typeof input === 'number' && Number.isFinite(input) ? input : fallback;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `legacy-run-${index}`,
    contractTitle: typeof value.contractTitle === 'string' && value.contractTitle ? value.contractTitle : 'Legacy operation',
    location: typeof value.location === 'string' ? value.location : 'Unknown location',
    outcome: normalizeRunOutcome(value.outcome),
    operationTier: Math.max(1, Math.min(12, Math.round(numberOr(value.operationTier, 1)))),
    directive: value.directive === true,
    level: Math.max(1, Math.min(20, Math.round(numberOr(value.level, 1)))),
    duration: Math.max(0, numberOr(value.duration, 0)),
    buildLabel: typeof value.buildLabel === 'string' && value.buildLabel ? value.buildLabel : 'Legacy build',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    tracePoints: Math.max(0, Math.round(numberOr(value.tracePoints, 0))),
    daily: value.daily === true,
  };
}
function normalizeMetrics(value: Partial<MetricsRecord> | null | undefined): MetricsRecord {
  const base = emptyMetrics();
  const byTier: Record<string, TierBalanceMetric> = {};
  for (const [key, tier] of Object.entries(value?.byTier ?? {})) byTier[key] = normalizeTier(tier);
  const recent = (value?.recent ?? []).slice(0, 8).map((entry, index) => normalizeRunSummary(entry, index));
  return { ...base, ...value, attempts: value?.attempts ?? value?.runs ?? 0, failedRuns: value?.failedRuns ?? 0, weaponShots: { ...base.weaponShots, ...(value?.weaponShots ?? {}) }, byTier, protocolCombinations: { ...(value?.protocolCombinations ?? {}) }, recent };
}
function applyRunToMetrics(base: MetricsRecord, runId: string, run: RunRecord): MetricsRecord {
  const banked = run.outcome !== 'failed';
  const summary: RunSummary = { id: runId, contractTitle: run.contractTitle, location: run.location, outcome: run.outcome, operationTier: run.operationTier, directive: run.directive, level: run.level, duration: run.duration, buildLabel: run.buildLabel, createdAt: run.createdAt, tracePoints: run.trace.length, daily: run.daily };
  const tierKey = String(run.operationTier);
  const tier = normalizeTier(base.byTier[tierKey]);
  const grades = { ...tier.modifierGrades };
  for (const grade of run.modifierGrades) grades[String(grade)] = (grades[String(grade)] ?? 0) + 1;
  const qualityTotal = run.recoveryQualities.reduce((sum, value) => sum + value, 0);
  const nextTier: TierBalanceMetric = {
    attempts: tier.attempts + 1,
    extractions: tier.extractions + (banked ? 1 : 0),
    safeRuns: tier.safeRuns + (run.outcome === 'safe' ? 1 : 0),
    deepRuns: tier.deepRuns + (run.outcome === 'deep' ? 1 : 0),
    failedRuns: tier.failedRuns + (run.outcome === 'failed' ? 1 : 0),
    totalDamageTaken: tier.totalDamageTaken + run.damageTaken,
    totalDuration: tier.totalDuration + run.duration,
    killIntervalTotal: tier.killIntervalTotal + run.killIntervalTotal,
    killIntervalSamples: tier.killIntervalSamples + run.killIntervalSamples,
    lootQualityTotal: tier.lootQualityTotal + qualityTotal,
    lootItems: tier.lootItems + run.recoveryQualities.length,
    singulars: tier.singulars + run.singularCount,
    modifierGrades: grades,
  };
  return {
    runs: base.runs + (banked ? 1 : 0),
    attempts: base.attempts + 1,
    safeRuns: base.safeRuns + (run.outcome === 'safe' ? 1 : 0),
    deepRuns: base.deepRuns + (run.outcome === 'deep' ? 1 : 0),
    failedRuns: base.failedRuns + (run.outcome === 'failed' ? 1 : 0),
    totalDamageTaken: base.totalDamageTaken + run.damageTaken,
    totalDamageDealt: base.totalDamageDealt + run.damageDealt,
    totalDuration: base.totalDuration + run.duration,
    weaponShots: { carbine: base.weaponShots.carbine + run.weaponShots.carbine, breacher: base.weaponShots.breacher + run.weaponShots.breacher, rail: base.weaponShots.rail + run.weaponShots.rail },
    byTier: { ...base.byTier, [tierKey]: nextTier },
    protocolCombinations: mergeCountMap(base.protocolCombinations, run.protocolCombinations),
    recent: [summary, ...base.recent].slice(0, 8),
  };
}

function normalizeAcceptedRunCount(value: Partial<AcceptedRunStateRecord> | null | undefined) {
  return typeof value?.acceptedRuns === 'number' && Number.isInteger(value.acceptedRuns) && value.acceptedRuns >= 0 ? value.acceptedRuns : 0;
}

async function readAcceptedRunCount() {
  const version = await acceptedRunStateStore().getWithMetadata(ACCEPTED_RUN_STATE_KEY, { type: 'json', consistency: 'strong' }) as { data: AcceptedRunStateRecord; etag: string } | null;
  return normalizeAcceptedRunCount(version?.data);
}

async function incrementAcceptedRunCount() {
  const store = acceptedRunStateStore();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const version = await store.getWithMetadata(ACCEPTED_RUN_STATE_KEY, { type: 'json', consistency: 'strong' }) as { data: AcceptedRunStateRecord; etag: string } | null;
    const next: AcceptedRunStateRecord = { acceptedRuns: normalizeAcceptedRunCount(version?.data) + 1 };
    const result = version
      ? await store.setJSON(ACCEPTED_RUN_STATE_KEY, next, { onlyIfMatch: version.etag })
      : await store.setJSON(ACCEPTED_RUN_STATE_KEY, next, { onlyIfNew: true });
    if (result.modified) return next.acceptedRuns;
  }
  throw new Error('Accepted-run state contention exceeded retry budget');
}

async function ensureAcceptedRunCountAtLeast(expected: number) {
  const store = acceptedRunStateStore();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const version = await store.getWithMetadata(ACCEPTED_RUN_STATE_KEY, { type: 'json', consistency: 'strong' }) as { data: AcceptedRunStateRecord; etag: string } | null;
    const current = normalizeAcceptedRunCount(version?.data);
    if (current >= expected) return current;
    const next: AcceptedRunStateRecord = { acceptedRuns: expected };
    const result = version
      ? await store.setJSON(ACCEPTED_RUN_STATE_KEY, next, { onlyIfMatch: version.etag })
      : await store.setJSON(ACCEPTED_RUN_STATE_KEY, next, { onlyIfNew: true });
    if (result.modified) return expected;
  }
  throw new Error('Accepted-run state repair contention exceeded retry budget');
}

async function rebuildMetricsFromLedger(runKeys: string[]) {
  const store = acceptedRunsStore();
  let rebuilt = emptyMetrics();
  for (const runId of runKeys) {
    const run = await store.get(runId, { type: 'json', consistency: 'strong' }) as RunRecord | null;
    if (run) rebuilt = applyRunToMetrics(rebuilt, runId, run);
  }
  return rebuilt;
}

async function reconcileMetricsFromLedger(version?: { data: MetricsRecord; etag: string } | null) {
  const store = metricsStore();
  const runStore = acceptedRunsStore();
  const ledger = await runStore.list();
  const runKeys = ledger.blobs.map(blob => blob.key);
  const rebuilt = await rebuildMetricsFromLedger(runKeys);
  const confirmed = await runStore.list();
  if (confirmed.blobs.length === runKeys.length) {
    await ensureAcceptedRunCountAtLeast(confirmed.blobs.length);
    const currentVersion = version === undefined
      ? await store.getWithMetadata(METRICS_KEY, { type: 'json', consistency: 'strong' }) as { data: MetricsRecord; etag: string } | null
      : version;
    const result = currentVersion
      ? await store.setJSON(METRICS_KEY, rebuilt, { onlyIfMatch: currentVersion.etag })
      : await store.setJSON(METRICS_KEY, rebuilt, { onlyIfNew: true });
    if (!result.modified) {
      const current = await store.get(METRICS_KEY, { type: 'json', consistency: 'strong' }) as MetricsRecord | null;
      const normalized = normalizeMetrics(current);
      if (normalized.attempts === await readAcceptedRunCount()) return normalized;
    }
  }
  return rebuilt;
}

async function readMetrics() {
  const store = metricsStore();
  const [version, acceptedRunCount] = await Promise.all([
    store.getWithMetadata(METRICS_KEY, { type: 'json', consistency: 'strong' }) as Promise<{ data: MetricsRecord; etag: string } | null>,
    readAcceptedRunCount(),
  ]);
  const cached = normalizeMetrics(version?.data);
  if (cached.attempts === acceptedRunCount) return cached;
  return reconcileMetricsFromLedger(version);
}

function mergeCountMap(base: Record<string, number>, addition: Record<string, number>, maxKeys = 30) {
  const next = { ...base };
  for (const [key, value] of Object.entries(addition)) next[key] = (next[key] ?? 0) + value;
  return Object.fromEntries(Object.entries(next).sort((a, b) => b[1] - a[1]).slice(0, maxKeys));
}

async function updateMetrics(runId: string, run: RunRecord) {
  const store = metricsStore();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const version = await store.getWithMetadata(METRICS_KEY, { type: 'json', consistency: 'strong' }) as { data: MetricsRecord; etag: string } | null;
    const base = normalizeMetrics(version?.data);
    const next = applyRunToMetrics(base, runId, run);
    const result = version
      ? await store.setJSON(METRICS_KEY, next, { onlyIfMatch: version.etag })
      : await store.setJSON(METRICS_KEY, next, { onlyIfNew: true });
    if (result.modified) return next;
  }
  throw new Error('Metrics update contention exceeded retry budget');
}

function cleanText(value: unknown, maxLength = 96) { return typeof value === 'string' ? value.slice(0, maxLength) : ''; }
function cleanNumber(value: unknown, minimum: number, maximum: number) { if (typeof value !== 'number' || !Number.isFinite(value)) return minimum; return Math.max(minimum, Math.min(maximum, value)); }
function cleanShots(value: unknown): Record<WeaponId, number> { const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}; return { carbine: Math.round(cleanNumber(record.carbine, 0, 100000)), breacher: Math.round(cleanNumber(record.breacher, 0, 100000)), rail: Math.round(cleanNumber(record.rail, 0, 100000)) }; }
function cleanAbilityUses(value: unknown): [number, number, number] { if (!Array.isArray(value)) return [0, 0, 0]; return [0, 1, 2].map(index => Math.round(cleanNumber(value[index], 0, 10000))) as [number, number, number]; }
function cleanNumberArray(value: unknown, minimum: number, maximum: number, limit = 40) { if (!Array.isArray(value)) return []; return value.slice(0, limit).map(entry => Math.round(cleanNumber(entry, minimum, maximum))); }
function cleanCountMap(value: unknown, maxKeys = 20) { const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}; const result: Record<string, number> = {}; for (const [key, raw] of Object.entries(record).slice(0, maxKeys)) { const cleanKey = cleanText(key, 100); if (cleanKey) result[cleanKey] = Math.round(cleanNumber(raw, 0, 10000)); } return result; }
function cleanTrace(value: unknown): TracePoint[] { if (!Array.isArray(value)) return []; const result: TracePoint[] = []; for (const entry of value.slice(0, 720)) { if (!entry || typeof entry !== 'object') continue; const point = entry as Record<string, unknown>; const weapon = point.weapon === 'breacher' || point.weapon === 'rail' ? point.weapon : 'carbine'; result.push({ t: Math.round(cleanNumber(point.t, 0, 1800) * 10) / 10, x: Math.round(cleanNumber(point.x, 0, 2320)), y: Math.round(cleanNumber(point.y, 0, 1040)), hp: Math.round(cleanNumber(point.hp, 0, 250)), armor: Math.round(cleanNumber(point.armor, 0, 250)), weapon }); } return result; }

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function isText(value: unknown, minimum: number, maximum: number) { return typeof value === 'string' && value.length >= minimum && value.length <= maximum; }
function isFiniteInRange(value: unknown, minimum: number, maximum: number) { return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum; }
function isIntegerInRange(value: unknown, minimum: number, maximum: number) { return isFiniteInRange(value, minimum, maximum) && Number.isInteger(value); }
function isRunOutcome(value: unknown): value is RunOutcome { return value === 'safe' || value === 'deep' || value === 'failed'; }
function isWeapon(value: unknown): value is WeaponId { return value === 'carbine' || value === 'breacher' || value === 'rail'; }
function isStrictNumberArray(value: unknown, minimum: number, maximum: number, limit: number) { return Array.isArray(value) && value.length <= limit && value.every(entry => isIntegerInRange(entry, minimum, maximum)); }
function isStrictCountMap(value: unknown, maxKeys = 20) {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= maxKeys && entries.every(([key, count]) => key.length > 0 && key.length <= 100 && isIntegerInRange(count, 0, 10000));
}
function isStrictTrace(value: unknown) {
  if (!Array.isArray(value) || value.length > 720) return false;
  return value.every(entry => {
    if (!isRecord(entry)) return false;
    return isFiniteInRange(entry.t, 0, 1800)
      && isFiniteInRange(entry.x, 0, 2320)
      && isFiniteInRange(entry.y, 0, 1040)
      && isFiniteInRange(entry.hp, 0, 250)
      && isFiniteInRange(entry.armor, 0, 250)
      && isWeapon(entry.weapon);
  });
}
function validateRunPayload(raw: Record<string, unknown>): string | null {
  if (!isText(raw.contractId, 1, 120) || !isText(raw.contractTitle, 1, 120)) return 'Run telemetry requires a valid contract identifier and title';
  if (!isText(raw.location, 1, 80) || !isText(raw.objectiveMode, 1, 80) || !isText(raw.buildLabel, 1, 80)) return 'Run telemetry contains invalid descriptive fields';
  if (!isRunOutcome(raw.outcome)) return 'Invalid run outcome';
  if (!isIntegerInRange(raw.operationTier, 1, 12) || !isIntegerInRange(raw.level, 1, 20)) return 'Run telemetry contains an invalid tier or level';
  if (!isFiniteInRange(raw.duration, 0, 1800) || !isIntegerInRange(raw.salvageTags, 0, 1000)) return 'Run telemetry contains invalid timing or salvage values';
  if (!isIntegerInRange(raw.damageDealt, 0, 1000000) || !isIntegerInRange(raw.damageTaken, 0, 1000000) || !isIntegerInRange(raw.kills, 0, 1000)) return 'Run telemetry contains invalid combat totals';
  if (!isIntegerInRange(raw.eliteProtocolValue, 0, 1000) || !isFiniteInRange(raw.killIntervalTotal, 0, 100000) || !isIntegerInRange(raw.killIntervalSamples, 0, 1000)) return 'Run telemetry contains invalid protocol timing values';
  if (!isIntegerInRange(raw.singularCount, 0, 20)) return 'Run telemetry contains an invalid Singular count';
  if (typeof raw.directive !== 'boolean' || typeof raw.bossDefeated !== 'boolean' || typeof raw.daily !== 'boolean') return 'Run telemetry contains invalid boolean flags';
  if (!isText(raw.operationDate, 0, 16)) return 'Run telemetry contains an invalid operation date';
  if (!isStrictCountMap(raw.protocolCombinations)) return 'Run telemetry contains invalid protocol combinations';
  if (!isStrictNumberArray(raw.recoveryQualities, 0, 5, 40) || !isStrictNumberArray(raw.modifierGrades, 1, 5, 100)) return 'Run telemetry contains invalid recovery data';
  if (!isRecord(raw.weaponShots) || !isIntegerInRange(raw.weaponShots.carbine, 0, 100000) || !isIntegerInRange(raw.weaponShots.breacher, 0, 100000) || !isIntegerInRange(raw.weaponShots.rail, 0, 100000)) return 'Run telemetry contains invalid weapon totals';
  if (!Array.isArray(raw.abilityUses) || raw.abilityUses.length !== 3 || !raw.abilityUses.every(value => isIntegerInRange(value, 0, 10000))) return 'Run telemetry contains invalid ability totals';
  if (!isStrictTrace(raw.trace)) return 'Run telemetry contains an invalid trace';
  return null;
}

async function readRequestTextWithinLimit(req: Request, limit: number) {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > limit) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function reserveTelemetrySessionSlot(clientKey: string, now = Date.now()) {
  const store = telemetryQuotaStore();
  const windowStartedAt = Math.floor(now / TELEMETRY_QUOTA_WINDOW_MS) * TELEMETRY_QUOTA_WINDOW_MS;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const version = await store.getWithMetadata(clientKey, { type: 'json', consistency: 'strong' }) as { data: TelemetryQuotaRecord; etag: string } | null;
    const current = version?.data;
    const issued = current?.windowStartedAt === windowStartedAt && Number.isInteger(current.issued) && current.issued >= 0 ? current.issued : 0;
    if (issued >= TELEMETRY_SESSIONS_PER_WINDOW) return false;
    const next: TelemetryQuotaRecord = { windowStartedAt, issued: issued + 1 };
    const result = version
      ? await store.setJSON(clientKey, next, { onlyIfMatch: version.etag })
      : await store.setJSON(clientKey, next, { onlyIfNew: true });
    if (result.modified) return true;
  }
  throw new Error('Telemetry session quota contention exceeded retry budget');
}

async function handleCreateTelemetrySession(req: Request, context: Context) {
  const bodyText = await readRequestTextWithinLimit(req, MAX_TELEMETRY_SESSION_BYTES);
  if (bodyText === null) return problem('Telemetry session request is too large', 413);
  let body: unknown;
  try { body = JSON.parse(bodyText); } catch { return problem('Invalid telemetry session request', 400); }
  if (!isRecord(body)) return problem('Invalid telemetry session request', 400);
  const requestId = cleanText(body.requestId, 80);
  if (!isTelemetryRequestId(requestId)) return problem('Telemetry session requires a valid request id', 400);

  const store = telemetrySessionsStore();
  const clientKey = telemetryClientKey(context.ip);
  const now = Date.now();
  const existing = await store.getWithMetadata(requestId, { type: 'json', consistency: 'strong' }) as { data: TelemetrySessionRecord; etag: string } | null;
  const existingExpiry = Date.parse(existing?.data?.expiresAt ?? '');
  if (existing?.data?.requestId === requestId
    && existing.data.clientKey === clientKey
    && /^tsc_[0-9a-f]{64}$/.test(existing.data.credential)
    && Number.isFinite(existingExpiry)
    && existingExpiry > now) {
    return json({ credential: existing.data.credential, expiresAt: existing.data.expiresAt }, 200);
  }

  if (!await reserveTelemetrySessionSlot(clientKey, now)) return problem('Telemetry submission quota reached; try again later', 429);

  const issuedAt = new Date(now).toISOString();
  const record: TelemetrySessionRecord = {
    requestId,
    credential: createTelemetryCredential(),
    clientKey,
    issuedAt,
    expiresAt: new Date(now + TELEMETRY_SESSION_TTL_MS).toISOString(),
  };
  const written = existing
    ? await store.setJSON(requestId, record, { onlyIfMatch: existing.etag })
    : await store.setJSON(requestId, record, { onlyIfNew: true });
  if (written.modified) return json({ credential: record.credential, expiresAt: record.expiresAt }, 201);

  const raced = await store.get(requestId, { type: 'json', consistency: 'strong' }) as TelemetrySessionRecord | null;
  const racedExpiry = Date.parse(raced?.expiresAt ?? '');
  if (raced?.requestId === requestId && raced.clientKey === clientKey && Number.isFinite(racedExpiry) && racedExpiry > now) {
    return json({ credential: raced.credential, expiresAt: raced.expiresAt }, 200);
  }
  return problem('Telemetry session could not be established', 409);
}

async function verifyTelemetryCredential(requestId: string, credential: string, context: Context) {
  if (!/^tsc_[0-9a-f]{64}$/.test(credential)) return 'Run telemetry requires a valid short-lived submission credential';
  const session = await telemetrySessionsStore().get(requestId, { type: 'json', consistency: 'strong' }) as TelemetrySessionRecord | null;
  if (!session
    || session.requestId !== requestId
    || session.credential !== credential
    || session.clientKey !== telemetryClientKey(context.ip)) return 'Run telemetry requires a valid short-lived submission credential';
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return 'Run telemetry submission credential has expired';
  return null;
}

async function handlePostRun(req: Request, context: Context) {
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RUN_TELEMETRY_BYTES) return problem('Run telemetry payload is too large', 413);
  const bodyText = await readRequestTextWithinLimit(req, MAX_RUN_TELEMETRY_BYTES);
  if (bodyText === null) return problem('Run telemetry payload is too large', 413);
  let body: unknown;
  try { body = JSON.parse(bodyText); } catch { return problem('Invalid run telemetry payload', 400); }
  if (!isRecord(body)) return problem('Invalid run telemetry payload', 400);
  const raw = body;
  const validationError = validateRunPayload(raw);
  if (validationError) return problem(validationError, 400);
  const contractId = cleanText(raw.contractId, 120);
  const contractTitle = cleanText(raw.contractTitle, 120);
  const outcome = raw.outcome as RunOutcome;
  const trace = cleanTrace(raw.trace);
  const run: RunRecord = {
    contractId,
    contractTitle,
    location: cleanText(raw.location, 80),
    objectiveMode: cleanText(raw.objectiveMode, 80),
    outcome,
    operationTier: Math.round(cleanNumber(raw.operationTier, 1, 12)),
    directive: raw.directive === true,
    level: Math.round(cleanNumber(raw.level, 1, 20)),
    duration: Math.round(cleanNumber(raw.duration, 0, 1800) * 10) / 10,
    buildLabel: cleanText(raw.buildLabel, 80),
    createdAt: new Date().toISOString(),
    salvageTags: Math.round(cleanNumber(raw.salvageTags, 0, 1000)),
    damageDealt: Math.round(cleanNumber(raw.damageDealt, 0, 1000000)),
    damageTaken: Math.round(cleanNumber(raw.damageTaken, 0, 1000000)),
    kills: Math.round(cleanNumber(raw.kills, 0, 1000)),
    eliteProtocolValue: Math.round(cleanNumber(raw.eliteProtocolValue, 0, 1000)),
    killIntervalTotal: cleanNumber(raw.killIntervalTotal, 0, 100000),
    killIntervalSamples: Math.round(cleanNumber(raw.killIntervalSamples, 0, 1000)),
    protocolCombinations: cleanCountMap(raw.protocolCombinations),
    recoveryQualities: cleanNumberArray(raw.recoveryQualities, 0, 5),
    modifierGrades: cleanNumberArray(raw.modifierGrades, 1, 5, 100),
    singularCount: Math.round(cleanNumber(raw.singularCount, 0, 20)),
    weaponShots: cleanShots(raw.weaponShots),
    abilityUses: cleanAbilityUses(raw.abilityUses),
    bossDefeated: raw.bossDefeated === true,
    daily: raw.daily === true,
    operationDate: cleanText(raw.operationDate, 16),
    trace,
  };
  const idempotencyKey = cleanText(req.headers.get('x-idempotency-key'), 80);
  if (!isTelemetryRequestId(idempotencyKey)) return problem('Run telemetry requires a valid idempotency key', 400);
  const credential = cleanText(req.headers.get('x-telemetry-credential'), 128);
  const credentialError = await verifyTelemetryCredential(idempotencyKey, credential, context);
  if (credentialError) return problem(credentialError, 401);
  const runId = idempotencyKey;
  const store = acceptedRunsStore();
  const created = await store.setJSON(runId, run, { onlyIfNew: true });
  if (!created.modified) return json({ id: runId, metrics: await readMetrics() }, 200);
  try {
    await incrementAcceptedRunCount();
  } catch (cause) {
    console.error('Accepted-run state update deferred to ledger reconciliation', cause);
    return json({ id: runId, metrics: await reconcileMetricsFromLedger() }, 201);
  }
  try {
    return json({ id: runId, metrics: await updateMetrics(runId, run) }, 201);
  } catch (cause) {
    console.error('Telemetry aggregate update deferred to ledger reconciliation', cause);
    return json({ id: runId, metrics: await readMetrics() }, 201);
  }
}

export default async function handler(req: Request, context: Context) {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === 'GET' && path === '/api/_healthcheck') return json({ message: 'Success', platform: 'netlify' });
    if (req.method === 'GET' && path === '/api/operations') {
      const [operation, metrics] = await Promise.all([ensureDailyOperation(), readMetrics()]);
      return json({ operation, metrics });
    }
    if (req.method === 'POST' && path === '/api/telemetry/session') return handleCreateTelemetrySession(req, context);
    if (req.method === 'POST' && path === '/api/runs') return handlePostRun(req, context);
    if (req.method === 'GET' && path.startsWith('/api/runs/')) {
      const id = cleanText(context.params.id ?? decodeURIComponent(path.slice('/api/runs/'.length)), 80);
      if (!id) return problem('Run id is required', 400);
      const stored = await acceptedRunsStore().get(id, { type: 'json', consistency: 'strong' }) as RunRecord | null;
      if (!stored) return problem('Run trace not found', 404);
      return json({ id, ...stored, outcome: normalizeRunOutcome(stored.outcome), operationTier: Math.round(cleanNumber(stored.operationTier, 1, 12)), level: Math.round(cleanNumber(stored.level, 1, 20)), trace: cleanTrace(stored.trace) });
    }
    return problem('Not found', 404);
  } catch (cause) {
    console.error('Ironshade Operations API error', cause);
    return problem('Operations service unavailable', 500);
  }
}

export const config: Config = {
  path: ['/api/_healthcheck', '/api/operations', '/api/telemetry/session', '/api/runs', '/api/runs/:id'],
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
