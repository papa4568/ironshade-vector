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

const dailyStore = () => getStore('ironshade-daily');
const metricsStore = () => getStore({ name: 'ironshade-metrics', consistency: 'strong' });
const runsStore = () => getStore({ name: 'ironshade-runs', consistency: 'strong' });
const METRICS_KEY = 'global';

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}
function problem(message: string, status: number) {
  return json({ error: message }, status);
}
function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function hashText(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return hash >>> 0; }

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

async function rebuildMetricsFromLedger(runKeys: string[]) {
  const store = runsStore();
  let rebuilt = emptyMetrics();
  for (const runId of runKeys) {
    const run = await store.get(runId, { type: 'json', consistency: 'strong' }) as RunRecord | null;
    if (run) rebuilt = applyRunToMetrics(rebuilt, runId, run);
  }
  return rebuilt;
}

async function readMetrics() {
  const store = metricsStore();
  const version = await store.getWithMetadata(METRICS_KEY, { type: 'json', consistency: 'strong' }) as { data: MetricsRecord; etag: string } | null;
  const cached = normalizeMetrics(version?.data);
  const runStore = runsStore();
  const ledger = await runStore.list();
  const runKeys = ledger.blobs.map(blob => blob.key);
  if (cached.attempts === runKeys.length) return cached;

  const rebuilt = await rebuildMetricsFromLedger(runKeys);
  const confirmed = await runStore.list();
  if (confirmed.blobs.length === runKeys.length) {
    const result = version
      ? await store.setJSON(METRICS_KEY, rebuilt, { onlyIfMatch: version.etag })
      : await store.setJSON(METRICS_KEY, rebuilt, { onlyIfNew: true });
    if (!result.modified) {
      const current = await store.get(METRICS_KEY, { type: 'json', consistency: 'strong' }) as MetricsRecord | null;
      const normalized = normalizeMetrics(current);
      if (normalized.attempts === confirmed.blobs.length) return normalized;
    }
  }
  return rebuilt;
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

async function handlePostRun(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return problem('Invalid run telemetry payload', 400); }
  if (!body || typeof body !== 'object') return problem('Invalid run telemetry payload', 400);
  const raw = body as Record<string, unknown>;
  const contractId = cleanText(raw.contractId, 120);
  const contractTitle = cleanText(raw.contractTitle, 120);
  if (!contractId || !contractTitle) return problem('Run telemetry requires a contract identifier and title', 400);
  const outcome: RunOutcome = raw.outcome === 'failed' ? 'failed' : raw.outcome === 'deep' ? 'deep' : 'safe';
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
  if (!/^[A-Za-z0-9._-]{16,80}$/.test(idempotencyKey)) return problem('Run telemetry requires a valid idempotency key', 400);
  const runId = idempotencyKey;
  const store = runsStore();
  const created = await store.setJSON(runId, run, { onlyIfNew: true });
  if (!created.modified) return json({ id: runId, metrics: await readMetrics() }, 200);
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
    if (req.method === 'POST' && path === '/api/runs') return handlePostRun(req);
    if (req.method === 'GET' && path.startsWith('/api/runs/')) {
      const id = cleanText(context.params.id ?? decodeURIComponent(path.slice('/api/runs/'.length)), 80);
      if (!id) return problem('Run id is required', 400);
      const stored = await runsStore().get(id, { type: 'json', consistency: 'strong' }) as RunRecord | null;
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
  path: ['/api/_healthcheck', '/api/operations', '/api/runs', '/api/runs/:id'],
};
