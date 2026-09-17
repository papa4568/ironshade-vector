import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import handler, { config } from '../netlify/functions/api';
import { uploadRunTelemetry } from '../src/game/network';
import { getMockBlobCalls, getMockStoreJson, getMockStoreKeys, resetMockBlobStores, setMockMetricsContention } from './mocks/netlify-blobs';

const context = (params: Record<string, string> = {}) => ({ params }) as never;

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

async function postRun(payload: Record<string, unknown>, key?: string, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers({ 'content-type': 'application/json', ...extraHeaders });
  if (key) headers.set('x-idempotency-key', key);
  return handler(new Request('https://example.test/api/runs', { method: 'POST', headers, body: JSON.stringify(payload) }), context());
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

  const invalidOutcome = await postRun(validRun({ outcome: 'mystery' }), 'invalid-run-000001');
  assert.equal(invalidOutcome.status, 400);
  assert.match((await responseJson(invalidOutcome)).error, /Invalid run outcome/);
  assert.equal(getMockStoreKeys('ironshade-runs').length, 0, 'invalid telemetry must never enter the accepted run ledger');

  const missingKey = await postRun(validRun());
  assert.equal(missingKey.status, 400);
  assert.equal(getMockStoreKeys('ironshade-runs').length, 0, 'missing idempotency keys must not write telemetry');

  const oversized = await postRun(validRun(), 'oversized-run-0001', { 'content-length': '512001' });
  assert.equal(oversized.status, 413);
  assert.equal(getMockStoreKeys('ironshade-runs').length, 0, 'oversized telemetry must be rejected before persistence');

  const firstKey = 'accepted-run-000001';
  const first = await postRun(validRun(), firstKey);
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

  const duplicate = await postRun(validRun(), firstKey);
  assert.equal(duplicate.status, 200);
  const duplicateBody = await responseJson(duplicate);
  assert.equal(duplicateBody.metrics.attempts, 1, 'replaying one idempotency key must not double-count an attempt');
  assert.equal(getMockStoreKeys('ironshade-runs').length, 1, 'replaying one idempotency key must not create a second ledger row');

  const secondKey = 'accepted-run-000002';
  const second = await postRun(validRun({ outcome: 'deep', bossDefeated: true }), secondKey);
  assert.equal(second.status, 201);
  const secondBody = await responseJson(second);
  assert.equal(secondBody.metrics.attempts, 2);
  assert.equal(secondBody.metrics.deepRuns, 1);
  const conditionalMetricsWrite = getMockBlobCalls('ironshade-metrics').find(call => call.method === 'setJSON' && typeof call.options?.onlyIfMatch === 'string');
  assert.ok(conditionalMetricsWrite, 'existing aggregate writes must use the current ETag');

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

  setMockMetricsContention(false);
  const operations = await handler(new Request('https://example.test/api/operations'), context());
  assert.equal(operations.status, 200);
  const operationsBody = await responseJson(operations);
  assert.equal(operationsBody.metrics.attempts, 3, 'operations reads must repair stale aggregate metrics from the accepted ledger');
  assert.equal((getMockStoreJson<any>('ironshade-metrics', 'global'))?.attempts, 3, 'reconciled aggregate metrics must be persisted after contention clears');

  const originalFetch = globalThis.fetch;
  let capturedHeaders: Headers | null = null;
  try {
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return Response.json({ id: 'client-run', metrics: { attempts: 0 } });
    }) as typeof fetch;
    await uploadRunTelemetry({
      contract: { id: 'client-contract', title: 'Client contract', locationName: 'Station', objectiveMode: 'pressure-recovery', operationTier: 2 } as any,
      telemetry: { duration: 1, damageDealt: 0, damageTaken: 0, kills: 0, eliteProtocolsDefeated: 0, killIntervalTotal: 0, killIntervalSamples: 0, protocolCombinations: {}, weaponShots: { carbine: 0, breacher: 0, rail: 0 }, abilityUses: [0, 0, 0], trace: [] } as any,
      outcome: 'safe', salvageTags: 0, level: 1, buildLabel: 'Client', requestId: 'client-request-0001',
    }, { timeoutMs: 100 });
    assert.equal(capturedHeaders?.get('x-idempotency-key'), 'client-request-0001', 'telemetry transport must send the caller-owned idempotency key');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(existsSync('.github/workflows/fix-three-objective-beacon.yml'), false, 'completed objective-beacon migration workflow must stay retired');
  assert.equal(existsSync('scripts/apply-three-objective-beacon.mjs'), false, 'completed objective-beacon migration script must stay retired');

  console.log('SERVICE_REGRESSIONS_PASS executable=handler idempotency=verified metrics=cas+reconcile validation=strict rateLimit=enabled clientKey=verified staleMigration=removed');
}

void main();
