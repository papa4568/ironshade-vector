import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import handler, { config } from '../netlify/functions/api';
import { loadOperationsSnapshot, loadRunTrace, uploadRunTelemetry } from '../src/game/network';
import { getMockBlobCalls, getMockStoreJson, getMockStoreKeys, getStore, resetMockBlobStores, setMockMetricsContention } from './mocks/netlify-blobs';

const defaultClientIp = '203.0.113.10';
const context = (params: Record<string, string> = {}, ip = defaultClientIp) => ({ params, ip }) as never;

function validRun(overrides: Record<string, unknown> = {}) {
  return {
    contractId: 'contract-test', contractTitle: 'Executable service regression', location: 'Orbital Station', objectiveMode: 'pressure-recovery',
    outcome: 'safe', operationTier: 3, directive: false, level: 12, duration: 91.4, buildLabel: 'Test Build', salvageTags: 9,
    damageDealt: 4200, damageTaken: 230, kills: 14, eliteProtocolValue: 3, killIntervalTotal: 48.5, killIntervalSamples: 8,
    protocolCombinations: { 'armor+drone': 2 }, recoveryQualities: [2, 4], modifierGrades: [3, 4], singularCount: 0,
    weaponShots: { carbine: 55, breacher: 12, rail: 3 }, abilityUses: [2, 1, 4], bossDefeated: false, daily: false, operationDate: '',
    trace: [{ t: 1.2, x: 400, y: 300, hp: 95, armor: 40, weapon: 'carbine' }],
    ...overrides,
  };
}

async function requestTelemetrySession(key: string, ip = defaultClientIp) {
  return handler(new Request('https://example.test/api/telemetry/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: key }),
  }), context({}, ip));
}

async function issueTelemetryCredential(key: string, ip = defaultClientIp) {
  const response = await requestTelemetrySession(key, ip);
  assert.ok(response.status === 200 || response.status === 201, `telemetry session issuance failed with HTTP ${response.status}`);
  const body = await responseJson(response);
  assert.match(body.credential, /^tsc_[0-9a-f]{64}$/);
  assert.ok(Number.isFinite(Date.parse(body.expiresAt)));
  return body.credential as string;
}

async function postRun(payload: Record<string, unknown>, key?: string, extraHeaders: Record<string, string> = {}, ip = defaultClientIp) {
  return postRunBody(JSON.stringify(payload), key, extraHeaders, ip);
}

async function postRunBody(body: string, key?: string, extraHeaders: Record<string, string> = {}, ip = defaultClientIp) {
  const headers = new Headers({ 'content-type': 'application/json', ...extraHeaders });
  if (key) {
    headers.set('x-idempotency-key', key);
    if (!headers.has('x-telemetry-credential')) headers.set('x-telemetry-credential', await issueTelemetryCredential(key, ip));
  }
  return handler(new Request('https://example.test/api/runs', { method: 'POST', headers, body }), context({}, ip));
}

async function responseJson(response: Response) {
  return await response.json() as Record<string, any>;
}

async function main() {
  resetMockBlobStores();

  const health = await handler(new Request('https://example.test/api/_healthcheck'), context());
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { message: 'Success', platform: 'netlify' });

  assert.deepEqual((config as any).rateLimit, { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] });
  assert.ok((config as any).path.includes('/api/telemetry/session'), 'telemetry credential issuance must be routed through the service');

  for (let index = 0; index < 24; index += 1) {
    const issued = await requestTelemetrySession(`quota-session-${String(index).padStart(4, '0')}`, '198.51.100.40');
    assert.equal(issued.status, 201, 'bounded telemetry sessions should issue below the per-client quota');
  }
  const quotaLimited = await requestTelemetrySession('quota-session-0024', '198.51.100.40');
  assert.equal(quotaLimited.status, 429, 'public telemetry session issuance must be server-bounded per client');
  assert.equal(getMockStoreKeys('ironshade-telemetry-sessions').length, 24);
  resetMockBlobStores();

  const invalidOutcome = await postRun(validRun({ outcome: 'mystery' }), 'invalid-run-000001');
  assert.equal(invalidOutcome.status, 400);
  assert.match((await responseJson(invalidOutcome)).error, /Invalid run outcome/);
  assert.equal(getMockStoreKeys('ironshade-runs').length, 0, 'invalid telemetry must never enter the accepted run ledger');

  const missingKey = await postRun(validRun());
  assert.equal(missingKey.status, 400);
  assert.equal(getMockStoreKeys('ironshade-runs').length, 0, 'missing idempotency keys must not write telemetry');

  const forged = await postRun(validRun(), 'forged-run-000001', { 'x-telemetry-credential': `tsc_${'0'.repeat(64)}` });
  assert.equal(forged.status, 401, 'forged telemetry credentials must be rejected');
  assert.equal(getMockStoreKeys('ironshade-runs').length, 0, 'forged credentials must never write telemetry');

  const expiredKey = 'expired-run-000001';
  const expiredCredential = await issueTelemetryCredential(expiredKey);
  const issuedSession = getMockStoreJson<any>('ironshade-telemetry-sessions', expiredKey);
  assert.ok(issuedSession);
  await getStore('ironshade-telemetry-sessions').setJSON(expiredKey, { ...issuedSession, expiresAt: '2000-01-01T00:00:00.000Z' });
  const expired = await postRun(validRun(), expiredKey, { 'x-telemetry-credential': expiredCredential });
  assert.equal(expired.status, 401, 'expired telemetry credentials must be rejected');
  assert.match((await responseJson(expired)).error, /expired/i);
  assert.equal(getMockStoreKeys('ironshade-runs').length, 0, 'expired credentials must never write telemetry');

  resetMockBlobStores();

  const encodedValidRun = JSON.stringify(validRun());
  const correctLength = await postRunBody(encodedValidRun, 'length-correct-0001', { 'content-length': String(Buffer.byteLength(encodedValidRun)) });
  assert.equal(correctLength.status, 201, 'correctly declared telemetry within the byte limit must be accepted');

  const missingLength = await postRunBody(encodedValidRun, 'length-missing-0001');
  assert.equal(missingLength.status, 201, 'telemetry without Content-Length must be accepted when actual bytes are within the limit');

  const oversizedBody = JSON.stringify({ ...validRun(), padding: 'x'.repeat(512_000) });
  const understatedLength = await postRunBody(oversizedBody, 'length-under-00001', { 'content-length': '128' });
  assert.equal(understatedLength.status, 413, 'understated Content-Length must not bypass the actual byte limit');

  const oversizedMissingLength = await postRunBody(oversizedBody, 'length-oversize-001');
  assert.equal(oversizedMissingLength.status, 413, 'oversized telemetry must be rejected when Content-Length is missing');
  assert.equal(getMockStoreKeys('ironshade-runs').length, 2, 'only byte-valid payloads may enter the accepted run ledger during payload-limit coverage');

  resetMockBlobStores();

  const firstKey = 'accepted-run-000001';
  const firstCredential = await issueTelemetryCredential(firstKey);
  const first = await postRun(validRun(), firstKey, { 'x-telemetry-credential': firstCredential });
  assert.equal(first.status, 201);
  const firstBody = await responseJson(first);
  assert.equal(firstBody.id, firstKey);
  assert.equal(firstBody.metrics.attempts, 1);
  assert.equal(firstBody.metrics.runs, 1);
  assert.equal(getMockStoreKeys('ironshade-runs').length, 1);
  const firstLedgerWrite = getMockBlobCalls('ironshade-runs').find(call => call.method === 'setJSON');
  assert.equal(firstLedgerWrite?.options?.onlyIfNew, true, 'accepted runs must use create-only ledger writes');
  const firstMetricsWrite = getMockBlobCalls('ironshade-metrics').find(call => call.method === 'setJSON');
  assert.equal(firstMetricsWrite?.options?.onlyIfNew, true, 'first aggregate write must be create-only');
  assert.equal(getMockStoreJson<any>('ironshade-run-ledger-state', 'accepted-runs')?.acceptedRuns, 1, 'accepted-run state must track the authoritative ledger without listing it');

  const duplicate = await postRun(validRun({ damageTaken: 999999 }), firstKey, { 'x-telemetry-credential': firstCredential });
  assert.equal(duplicate.status, 200);
  const duplicateBody = await responseJson(duplicate);
  assert.equal(duplicateBody.metrics.attempts, 1, 'replaying one idempotency key must not double-count an attempt');
  assert.equal(getMockStoreKeys('ironshade-runs').length, 1, 'replaying one idempotency key must not create a second ledger row');
  assert.equal(getMockStoreJson<any>('ironshade-runs', firstKey)?.damageTaken, 230, 'a replayed credential must not mutate the accepted run');
  assert.equal(getMockStoreJson<any>('ironshade-run-ledger-state', 'accepted-runs')?.acceptedRuns, 1, 'duplicate submissions must not advance accepted-run state');
  const crossRunReplay = await postRun(validRun(), 'replay-cross-run-001', { 'x-telemetry-credential': firstCredential });
  assert.equal(crossRunReplay.status, 401, 'one run credential must not authorize a different idempotency key');
  assert.equal(getMockStoreKeys('ironshade-runs').length, 1, 'cross-run credential replay must not skew the ledger');

  const secondKey = 'accepted-run-000002';
  const second = await postRun(validRun({ outcome: 'deep', bossDefeated: true }), secondKey);
  assert.equal(second.status, 201);
  const secondBody = await responseJson(second);
  assert.equal(secondBody.metrics.attempts, 2);
  assert.equal(secondBody.metrics.deepRuns, 1);
  const conditionalMetricsWrite = getMockBlobCalls('ironshade-metrics').find(call => call.method === 'setJSON' && typeof call.options?.onlyIfMatch === 'string');
  assert.ok(conditionalMetricsWrite, 'existing aggregate writes must use the current ETag');
  assert.equal(getMockStoreJson<any>('ironshade-run-ledger-state', 'accepted-runs')?.acceptedRuns, 2, 'accepted-run state must advance once per new ledger row');

  const trace = await handler(new Request(`https://example.test/api/runs/${secondKey}`), context({ id: secondKey }));
  assert.equal(trace.status, 200);
  const traceBody = await responseJson(trace);
  assert.equal(traceBody.id, secondKey);
  assert.equal(traceBody.trace.length, 1);
  assert.equal(traceBody.outcome, 'deep');

  const metricsCallsBeforeContention = getMockBlobCalls('ironshade-metrics').length;
  setMockMetricsContention(true);
  const thirdKey = 'accepted-run-000003';
  const contended = await postRun(validRun({ outcome: 'failed' }), thirdKey);
  assert.equal(contended.status, 201);
  const contendedBody = await responseJson(contended);
  assert.equal(contendedBody.metrics.attempts, 3, 'ledger reconciliation must return all accepted runs after aggregate contention');
  assert.equal(contendedBody.metrics.failedRuns, 1);
  const contentionCalls = getMockBlobCalls('ironshade-metrics').slice(metricsCallsBeforeContention).filter(call => call.method === 'setJSON' && typeof call.options?.onlyIfMatch === 'string');
  assert.ok(contentionCalls.length >= 8, 'aggregate contention must exhaust the bounded compare-and-set retry budget before reconciliation');
  assert.equal(getMockStoreKeys('ironshade-runs').length, 3, 'the authoritative run ledger must survive aggregate contention');
  assert.equal(getMockStoreJson<any>('ironshade-run-ledger-state', 'accepted-runs')?.acceptedRuns, 3, 'aggregate contention must not lose the accepted-run version signal');

  setMockMetricsContention(false);
  const operations = await handler(new Request('https://example.test/api/operations'), context());
  assert.equal(operations.status, 200);
  const operationsBody = await responseJson(operations);
  assert.equal(operationsBody.metrics.attempts, 3, 'operations reads must repair stale aggregate metrics from the accepted ledger');
  assert.equal((getMockStoreJson<any>('ironshade-metrics', 'global'))?.attempts, 3, 'reconciled aggregate metrics must be persisted after contention clears');

  const ledgerCallsBeforeHealthyRead = getMockBlobCalls('ironshade-runs').length;
  const healthyOperations = await handler(new Request('https://example.test/api/operations'), context());
  assert.equal(healthyOperations.status, 200);
  assert.equal((await responseJson(healthyOperations)).metrics.attempts, 3);
  assert.equal(getMockBlobCalls('ironshade-runs').length, ledgerCallsBeforeHealthyRead, 'healthy Operations reads must not list or fetch the accepted-run ledger');

  const originalFetch = globalThis.fetch;
  let capturedHeaders: Headers | null = null;
  let capturedSessionBody = '';
  try {
    globalThis.fetch = (async () => Response.json(operationsBody)) as typeof fetch;
    const clientOperations = await loadOperationsSnapshot({ timeoutMs: 100 });
    assert.equal(clientOperations.metrics.attempts, 3, 'client Operations snapshot validation must accept the real service response');

    globalThis.fetch = (async () => Response.json(traceBody)) as typeof fetch;
    const clientTrace = await loadRunTrace(secondKey, { timeoutMs: 100 });
    assert.equal(clientTrace.tracePoints, 1, 'client trace normalization must derive tracePoints from the validated trace array');

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/api/telemetry/session')) {
        capturedSessionBody = String(init?.body ?? '');
        return Response.json({ credential: `tsc_${'a'.repeat(64)}`, expiresAt: '2099-01-01T00:00:00.000Z' });
      }
      capturedHeaders = new Headers(init?.headers);
      return Response.json({ id: 'client-run', metrics: operationsBody.metrics });
    }) as typeof fetch;
    await uploadRunTelemetry({
      contract: { id: 'client-contract', title: 'Client contract', locationName: 'Station', objectiveMode: 'pressure-recovery', operationTier: 2 } as any,
      telemetry: { duration: 1, damageDealt: 0, damageTaken: 0, kills: 0, eliteProtocolsDefeated: 0, killIntervalTotal: 0, killIntervalSamples: 0, protocolCombinations: {}, weaponShots: { carbine: 0, breacher: 0, rail: 0 }, abilityUses: [0, 0, 0], trace: [] } as any,
      outcome: 'safe', salvageTags: 0, level: 1, buildLabel: 'Client', requestId: 'client-request-0001',
    }, { timeoutMs: 100 });
    assert.deepEqual(JSON.parse(capturedSessionBody), { requestId: 'client-request-0001' }, 'telemetry transport must bind the short-lived session to the caller-owned idempotency key');
    assert.equal(capturedHeaders?.get('x-idempotency-key'), 'client-request-0001', 'telemetry transport must send the caller-owned idempotency key');
    assert.equal(capturedHeaders?.get('x-telemetry-credential'), `tsc_${'a'.repeat(64)}`, 'telemetry transport must attach the server-issued submission credential');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(existsSync('.github/workflows/fix-three-objective-beacon.yml'), false, 'completed objective-beacon migration workflow must stay retired');
  assert.equal(existsSync('scripts/apply-three-objective-beacon.mjs'), false, 'completed objective-beacon migration script must stay retired');

  console.log('SERVICE_REGRESSIONS_PASS executable=handler trustBoundary=session+ipQuota forged=rejected replay=idempotent+bound expired=rejected idempotency=verified metrics=cas+versioned-fast-read+reconcile validation=strict payloadBytes=bounded rateLimit=enabled clientCredential=verified staleMigration=removed');
}

void main();
