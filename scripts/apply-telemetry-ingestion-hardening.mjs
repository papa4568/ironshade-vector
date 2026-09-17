import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(needle)) throw new Error(`Unable to locate ${label}`);
  return source.replace(needle, replacement);
}

const apiPath = 'netlify/functions/api.ts';
let api = readFileSync(apiPath, 'utf8');
api = replaceOnce(
  api,
  "const runsStore = () => getStore({ name: 'ironshade-runs', consistency: 'strong' });",
  "// Only telemetry that passes the strict ingestion gate enters this ledger; aggregate balance metrics are derived exclusively from it.\nconst acceptedRunsStore = () => getStore({ name: 'ironshade-runs', consistency: 'strong' });",
  'accepted run ledger',
);
api = api.replaceAll('runsStore()', 'acceptedRunsStore()');

const validatorAnchor = "function cleanTrace(value: unknown): TracePoint[] { if (!Array.isArray(value)) return []; const result: TracePoint[] = []; for (const entry of value.slice(0, 720)) { if (!entry || typeof entry !== 'object') continue; const point = entry as Record<string, unknown>; const weapon = point.weapon === 'breacher' || point.weapon === 'rail' ? point.weapon : 'carbine'; result.push({ t: Math.round(cleanNumber(point.t, 0, 1800) * 10) / 10, x: Math.round(cleanNumber(point.x, 0, 2320)), y: Math.round(cleanNumber(point.y, 0, 1040)), hp: Math.round(cleanNumber(point.hp, 0, 250)), armor: Math.round(cleanNumber(point.armor, 0, 250)), weapon }); } return result; }";
const validatorBlock = `${validatorAnchor}\n\nfunction isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }\nfunction isText(value: unknown, minimum: number, maximum: number) { return typeof value === 'string' && value.length >= minimum && value.length <= maximum; }\nfunction isFiniteInRange(value: unknown, minimum: number, maximum: number) { return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum; }\nfunction isIntegerInRange(value: unknown, minimum: number, maximum: number) { return isFiniteInRange(value, minimum, maximum) && Number.isInteger(value); }\nfunction isRunOutcome(value: unknown): value is RunOutcome { return value === 'safe' || value === 'deep' || value === 'failed'; }\nfunction isWeapon(value: unknown): value is WeaponId { return value === 'carbine' || value === 'breacher' || value === 'rail'; }\nfunction isStrictNumberArray(value: unknown, minimum: number, maximum: number, limit: number) { return Array.isArray(value) && value.length <= limit && value.every(entry => isIntegerInRange(entry, minimum, maximum)); }\nfunction isStrictCountMap(value: unknown, maxKeys = 20) {\n  if (!isRecord(value)) return false;\n  const entries = Object.entries(value);\n  return entries.length <= maxKeys && entries.every(([key, count]) => key.length > 0 && key.length <= 100 && isIntegerInRange(count, 0, 10000));\n}\nfunction isStrictTrace(value: unknown) {\n  if (!Array.isArray(value) || value.length > 720) return false;\n  return value.every(entry => {\n    if (!isRecord(entry)) return false;\n    return isFiniteInRange(entry.t, 0, 1800)\n      && isFiniteInRange(entry.x, 0, 2320)\n      && isFiniteInRange(entry.y, 0, 1040)\n      && isFiniteInRange(entry.hp, 0, 250)\n      && isFiniteInRange(entry.armor, 0, 250)\n      && isWeapon(entry.weapon);\n  });\n}\nfunction validateRunPayload(raw: Record<string, unknown>): string | null {\n  if (!isText(raw.contractId, 1, 120) || !isText(raw.contractTitle, 1, 120)) return 'Run telemetry requires a valid contract identifier and title';\n  if (!isText(raw.location, 1, 80) || !isText(raw.objectiveMode, 1, 80) || !isText(raw.buildLabel, 1, 80)) return 'Run telemetry contains invalid descriptive fields';\n  if (!isRunOutcome(raw.outcome)) return 'Invalid run outcome';\n  if (!isIntegerInRange(raw.operationTier, 1, 12) || !isIntegerInRange(raw.level, 1, 20)) return 'Run telemetry contains an invalid tier or level';\n  if (!isFiniteInRange(raw.duration, 0, 1800) || !isIntegerInRange(raw.salvageTags, 0, 1000)) return 'Run telemetry contains invalid timing or salvage values';\n  if (!isIntegerInRange(raw.damageDealt, 0, 1000000) || !isIntegerInRange(raw.damageTaken, 0, 1000000) || !isIntegerInRange(raw.kills, 0, 1000)) return 'Run telemetry contains invalid combat totals';\n  if (!isIntegerInRange(raw.eliteProtocolValue, 0, 1000) || !isFiniteInRange(raw.killIntervalTotal, 0, 100000) || !isIntegerInRange(raw.killIntervalSamples, 0, 1000)) return 'Run telemetry contains invalid protocol timing values';\n  if (!isIntegerInRange(raw.singularCount, 0, 20)) return 'Run telemetry contains an invalid Singular count';\n  if (typeof raw.directive !== 'boolean' || typeof raw.bossDefeated !== 'boolean' || typeof raw.daily !== 'boolean') return 'Run telemetry contains invalid boolean flags';\n  if (!isText(raw.operationDate, 0, 16)) return 'Run telemetry contains an invalid operation date';\n  if (!isStrictCountMap(raw.protocolCombinations)) return 'Run telemetry contains invalid protocol combinations';\n  if (!isStrictNumberArray(raw.recoveryQualities, 0, 5, 40) || !isStrictNumberArray(raw.modifierGrades, 1, 5, 100)) return 'Run telemetry contains invalid recovery data';\n  if (!isRecord(raw.weaponShots) || !isIntegerInRange(raw.weaponShots.carbine, 0, 100000) || !isIntegerInRange(raw.weaponShots.breacher, 0, 100000) || !isIntegerInRange(raw.weaponShots.rail, 0, 100000)) return 'Run telemetry contains invalid weapon totals';\n  if (!Array.isArray(raw.abilityUses) || raw.abilityUses.length !== 3 || !raw.abilityUses.every(value => isIntegerInRange(value, 0, 10000))) return 'Run telemetry contains invalid ability totals';\n  if (!isStrictTrace(raw.trace)) return 'Run telemetry contains an invalid trace';\n  return null;\n}`;
api = replaceOnce(api, validatorAnchor, validatorBlock, 'strict telemetry validator');

api = replaceOnce(
  api,
  "async function handlePostRun(req: Request) {\n  let body: unknown;\n  try { body = await req.json(); } catch { return problem('Invalid run telemetry payload', 400); }\n  if (!body || typeof body !== 'object') return problem('Invalid run telemetry payload', 400);\n  const raw = body as Record<string, unknown>;\n  const contractId = cleanText(raw.contractId, 120);\n  const contractTitle = cleanText(raw.contractTitle, 120);\n  if (!contractId || !contractTitle) return problem('Run telemetry requires a contract identifier and title', 400);\n  const outcome: RunOutcome = raw.outcome === 'failed' ? 'failed' : raw.outcome === 'deep' ? 'deep' : 'safe';",
  "async function handlePostRun(req: Request) {\n  const declaredLength = Number(req.headers.get('content-length') ?? 0);\n  if (Number.isFinite(declaredLength) && declaredLength > 512_000) return problem('Run telemetry payload is too large', 413);\n  let body: unknown;\n  try { body = await req.json(); } catch { return problem('Invalid run telemetry payload', 400); }\n  if (!isRecord(body)) return problem('Invalid run telemetry payload', 400);\n  const raw = body;\n  const validationError = validateRunPayload(raw);\n  if (validationError) return problem(validationError, 400);\n  const contractId = cleanText(raw.contractId, 120);\n  const contractTitle = cleanText(raw.contractTitle, 120);\n  const outcome = raw.outcome as RunOutcome;",
  'strict POST validation gate',
);

api = replaceOnce(
  api,
  "export const config: Config = {\n  path: ['/api/_healthcheck', '/api/operations', '/api/runs', '/api/runs/:id'],\n};",
  "export const config: Config = {\n  path: ['/api/_healthcheck', '/api/operations', '/api/runs', '/api/runs/:id'],\n  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },\n};",
  'Netlify rate limit',
);
writeFileSync(apiPath, api);

const testPath = 'tests/service-regressions.mjs';
let test = readFileSync(testPath, 'utf8');
const insertion = "assert.match(app, /requestId: telemetryRequestId/, 'mission completion must keep one request id for the telemetry submission');";
if (!test.includes("strict telemetry validation gate")) {
  test = replaceOnce(
    test,
    insertion,
    `${insertion}\nassert.match(api, /function validateRunPayload/, 'strict telemetry validation gate must exist');\nassert.match(api, /Invalid run outcome/, 'unknown run outcomes must be rejected rather than coerced to safe');\nassert.doesNotMatch(api, /raw\\.outcome === 'failed' \\? 'failed' : raw\\.outcome === 'deep' \\? 'deep' : 'safe'/, 'ingestion must not silently coerce unknown outcomes');\nassert.match(api, /acceptedRunsStore/, 'aggregate metrics must read only from the validated run ledger');\nassert.ok(api.indexOf('validateRunPayload(raw)') < api.indexOf('setJSON(runId, run, { onlyIfNew: true })'), 'validation must happen before the accepted telemetry ledger write');\nassert.match(api, /rateLimit: \\{ windowLimit: 60, windowSize: 60, aggregateBy: \\['ip', 'domain'\\] \\}/, 'Netlify function ingress must be protected by per-IP/domain rate limiting');\n// strict telemetry validation gate`,
    'service hardening assertions',
  );
  test = test.replace(
    "console.log('SERVICE_REGRESSIONS_PASS metrics=conditional telemetry=idempotent-ledger staleMigration=removed');",
    "console.log('SERVICE_REGRESSIONS_PASS metrics=conditional telemetry=idempotent-ledger validation=strict rateLimit=enabled staleMigration=removed');",
  );
}
writeFileSync(testPath, test);

for (const path of ['.github/workflows/fix-telemetry-ingestion-hardening.yml', 'scripts/apply-telemetry-ingestion-hardening.mjs']) {
  if (existsSync(path)) unlinkSync(path);
}
console.log('TELEMETRY_INGESTION_HARDENED');
