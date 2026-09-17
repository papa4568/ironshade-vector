import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const api = readFileSync('netlify/functions/api.ts', 'utf8');
const network = readFileSync('src/game/network.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
assert.match(api, /getWithMetadata\(METRICS_KEY/, 'metrics update must read an ETag before writing');
assert.match(api, /onlyIfMatch: version\.etag/, 'existing metrics writes must be conditional');
assert.match(api, /onlyIfNew: true/, 'first metrics write must be create-only');
assert.match(api, /Metrics update contention exceeded retry budget/, 'metrics update must fail rather than silently lose a contended write');
assert.match(api, /x-idempotency-key/, 'run ingestion must require a client idempotency key');
assert.match(api, /setJSON\(runId, run, \{ onlyIfNew: true \}\)/, 'run ledger writes must be create-only');
assert.match(api, /rebuildMetricsFromLedger/, 'aggregate metrics must be repairable from the authoritative run ledger');
assert.match(network, /x-idempotency-key/, 'telemetry clients must send the idempotency key');
assert.match(app, /requestId: telemetryRequestId/, 'mission completion must keep one request id for the telemetry submission');
assert.match(api, /function validateRunPayload/, 'strict telemetry validation gate must exist');
assert.match(api, /Invalid run outcome/, 'unknown run outcomes must be rejected rather than coerced to safe');
assert.doesNotMatch(api, /raw\.outcome === 'failed' \? 'failed' : raw\.outcome === 'deep' \? 'deep' : 'safe'/, 'ingestion must not silently coerce unknown outcomes');
assert.match(api, /acceptedRunsStore/, 'aggregate metrics must read only from the validated run ledger');
assert.ok(api.indexOf('validateRunPayload(raw)') < api.indexOf('setJSON(runId, run, { onlyIfNew: true })'), 'validation must happen before the accepted telemetry ledger write');
assert.match(api, /rateLimit: \{ windowLimit: 60, windowSize: 60, aggregateBy: \['ip', 'domain'\] \}/, 'Netlify function ingress must be protected by per-IP/domain rate limiting');
// strict telemetry validation gate
assert.equal(existsSync('.github/workflows/fix-three-objective-beacon.yml'), false, 'completed objective-beacon migration workflow must stay retired');
assert.equal(existsSync('scripts/apply-three-objective-beacon.mjs'), false, 'completed objective-beacon migration script must stay retired');
console.log('SERVICE_REGRESSIONS_PASS metrics=conditional telemetry=idempotent-ledger validation=strict rateLimit=enabled staleMigration=removed');
