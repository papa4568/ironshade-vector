import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(needle)) throw new Error(`Unable to locate ${label}`);
  return source.replace(needle, replacement);
}

const apiPath = 'netlify/functions/api.ts';
let api = readFileSync(apiPath, 'utf8');
api = replaceOnce(
  api,
  "const runsStore = () => getStore('ironshade-runs');",
  "const runsStore = () => getStore({ name: 'ironshade-runs', consistency: 'strong' });",
  'strongly consistent run store',
);

const readMetricsStart = api.indexOf('async function readMetrics() {');
const cleanTextStart = api.indexOf('function cleanText(', readMetricsStart);
if (readMetricsStart < 0 || cleanTextStart < 0) throw new Error('Unable to locate metrics implementation boundaries');
const replacement = `function applyRunToMetrics(base: MetricsRecord, runId: string, run: RunRecord): MetricsRecord {
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

`;
api = api.slice(0, readMetricsStart) + replacement + api.slice(cleanTextStart);

api = replaceOnce(
  api,
  "  const runId = crypto.randomUUID();\n  await runsStore().setJSON(runId, run);\n  const metrics = await updateMetrics(runId, run);\n  return json({ id: runId, metrics }, 201);",
  "  const idempotencyKey = cleanText(req.headers.get('x-idempotency-key'), 80);\n  if (!/^[A-Za-z0-9._-]{16,80}$/.test(idempotencyKey)) return problem('Run telemetry requires a valid idempotency key', 400);\n  const runId = idempotencyKey;\n  const store = runsStore();\n  const created = await store.setJSON(runId, run, { onlyIfNew: true });\n  if (!created.modified) return json({ id: runId, metrics: await readMetrics() }, 200);\n  try {\n    return json({ id: runId, metrics: await updateMetrics(runId, run) }, 201);\n  } catch (cause) {\n    console.error('Telemetry aggregate update deferred to ledger reconciliation', cause);\n    return json({ id: runId, metrics: await readMetrics() }, 201);\n  }",
  'idempotent run persistence',
);
writeFileSync(apiPath, api);

const networkPath = 'src/game/network.ts';
let network = readFileSync(networkPath, 'utf8');
network = replaceOnce(
  network,
  "export async function uploadRunTelemetry(input: {",
  "export function createTelemetryRequestId() {\n  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();\n  return `telemetry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;\n}\n\nexport async function uploadRunTelemetry(input: {",
  'telemetry request id helper',
);
network = replaceOnce(
  network,
  "  singularCount?: number;\n}) {",
  "  singularCount?: number;\n  requestId?: string;\n}) {",
  'telemetry request id input',
);
network = replaceOnce(
  network,
  "  return requestJson<{ id: string; metrics: RunMetrics }>('/api/runs', {\n    method: 'POST',",
  "  const requestId = input.requestId ?? createTelemetryRequestId();\n  return requestJson<{ id: string; metrics: RunMetrics }>('/api/runs', {\n    method: 'POST',\n    headers: { 'x-idempotency-key': requestId },",
  'idempotency header',
);
writeFileSync(networkPath, network);

const appPath = 'src/App.tsx';
let app = readFileSync(appPath, 'utf8');
app = replaceOnce(
  app,
  "import { loadOperationsSnapshot, uploadRunTelemetry, type OperationsSnapshot } from './game/network';",
  "import { createTelemetryRequestId, loadOperationsSnapshot, uploadRunTelemetry, type OperationsSnapshot } from './game/network';",
  'telemetry helper import',
);
app = replaceOnce(
  app,
  "    if (profile.settings.telemetrySharing) {\n      void uploadRunTelemetry({ contract: selectedContract, telemetry, outcome: depth, salvageTags, level: profile.level, buildLabel, recoveryQualities:",
  "    if (profile.settings.telemetrySharing) {\n      const telemetryRequestId = createTelemetryRequestId();\n      void uploadRunTelemetry({ contract: selectedContract, telemetry, outcome: depth, salvageTags, level: profile.level, buildLabel, requestId: telemetryRequestId, recoveryQualities:",
  'successful run idempotency id',
);
app = replaceOnce(
  app,
  "const reportFailedAttempt = (telemetry: Telemetry) => { if (!selectedContract || !profile.settings.telemetrySharing) return; void uploadRunTelemetry({ contract: selectedContract, telemetry, outcome: 'failed', salvageTags: 0, level: profile.level, buildLabel: buildIdentity(profile) })",
  "const reportFailedAttempt = (telemetry: Telemetry) => { if (!selectedContract || !profile.settings.telemetrySharing) return; const telemetryRequestId = createTelemetryRequestId(); void uploadRunTelemetry({ contract: selectedContract, telemetry, outcome: 'failed', salvageTags: 0, level: profile.level, buildLabel: buildIdentity(profile), requestId: telemetryRequestId })",
  'failed run idempotency id',
);
writeFileSync(appPath, app);

const serviceTestPath = 'tests/service-regressions.mjs';
let serviceTest = readFileSync(serviceTestPath, 'utf8');
if (!serviceTest.includes("const network = readFileSync('src/game/network.ts'")) {
  serviceTest = serviceTest.replace(
    "const api = readFileSync('netlify/functions/api.ts', 'utf8');",
    "const api = readFileSync('netlify/functions/api.ts', 'utf8');\nconst network = readFileSync('src/game/network.ts', 'utf8');\nconst app = readFileSync('src/App.tsx', 'utf8');",
  );
}
if (!serviceTest.includes('idempotency-key')) {
  serviceTest = serviceTest.replace(
    "assert.match(api, /Metrics update contention exceeded retry budget/, 'metrics update must fail rather than silently lose a contended write');",
    "assert.match(api, /Metrics update contention exceeded retry budget/, 'metrics update must fail rather than silently lose a contended write');\nassert.match(api, /x-idempotency-key/, 'run ingestion must require a client idempotency key');\nassert.match(api, /setJSON\\(runId, run, \\{ onlyIfNew: true \\}\\)/, 'run ledger writes must be create-only');\nassert.match(api, /rebuildMetricsFromLedger/, 'aggregate metrics must be repairable from the authoritative run ledger');\nassert.match(network, /x-idempotency-key/, 'telemetry clients must send the idempotency key');\nassert.match(app, /requestId: telemetryRequestId/, 'mission completion must keep one request id for the telemetry submission');",
  );
  serviceTest = serviceTest.replace(
    "console.log('SERVICE_REGRESSIONS_PASS metrics=conditional staleMigration=removed');",
    "console.log('SERVICE_REGRESSIONS_PASS metrics=conditional telemetry=idempotent-ledger staleMigration=removed');",
  );
}
writeFileSync(serviceTestPath, serviceTest);

for (const path of ['.github/workflows/fix-telemetry-idempotency.yml', 'scripts/apply-telemetry-idempotency.mjs']) {
  if (existsSync(path)) unlinkSync(path);
}

console.log('TELEMETRY_IDEMPOTENCY_PATCHED');
