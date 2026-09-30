import { isNetworkRequestError, loadOperationsSnapshot, loadRunTrace, normalizeOperationsApiBase, resolveOperationsApiUrl, uploadRunTelemetry } from '../src/game/network';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectFailure(action: () => Promise<unknown>, predicate: (error: unknown) => boolean, message: string) {
  try {
    await action();
  } catch (error) {
    assert(predicate(error), message);
    return;
  }
  throw new Error(message);
}

const originalFetch = globalThis.fetch;

function hangingFetch() {
  globalThis.fetch = ((_, init) => new Promise<Response>((_, reject) => {
    const signal = init?.signal;
    const abort = () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  })) as typeof fetch;
}

function hangingBodyFetch() {
  globalThis.fetch = (async (_, init) => {
    const signal = init?.signal;
    return {
      ok: true,
      status: 200,
      json: () => new Promise<never>((_, reject) => {
        const abort = () => {
          const error = new Error('aborted body');
          error.name = 'AbortError';
          reject(error);
        };
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
      }),
    } as Response;
  }) as typeof fetch;
}

async function main() {
  try {
    assert(normalizeOperationsApiBase(' https://example.net/game/ ') === 'https://example.net/game', 'API base normalization should trim whitespace and trailing slashes');
    assert(normalizeOperationsApiBase('file:///tmp/service') === '', 'native API base must reject non-http protocols');
    assert(resolveOperationsApiUrl('/api/operations', 'https://example.net') === 'https://example.net/api/operations', 'configured native API requests should target the external service origin');
    assert(resolveOperationsApiUrl('api/runs/trace-a', 'https://example.net/base') === 'https://example.net/base/api/runs/trace-a', 'API URL joining should preserve configured path prefixes');
    assert(resolveOperationsApiUrl('/api/operations', '') === '/api/operations', 'web builds without an API origin should keep same-origin requests');

    hangingFetch();
    const timeoutStarted = Date.now();
    await expectFailure(() => loadOperationsSnapshot({ timeoutMs: 20 }), error => isNetworkRequestError(error) && error.kind === 'timeout', 'stalled Operations requests must fail as a timeout');
    assert(Date.now() - timeoutStarted < 1_000, 'timeout handling must resolve promptly in regression tests');

    hangingBodyFetch();
    await expectFailure(() => loadOperationsSnapshot({ timeoutMs: 20 }), error => isNetworkRequestError(error) && error.kind === 'timeout', 'stalled response bodies must remain bounded and classify as a timeout');

    hangingFetch();
    const controller = new AbortController();
    const abortedRequest = loadRunTrace('trace-a', { signal: controller.signal, timeoutMs: 1_000 });
    controller.abort();
    await expectFailure(() => abortedRequest, error => isNetworkRequestError(error) && error.kind === 'aborted', 'explicitly aborted trace requests must be classified separately from timeouts');

    globalThis.fetch = (async () => new Response('rate limited', { status: 429 })) as typeof fetch;
    await expectFailure(() => loadOperationsSnapshot({ timeoutMs: 100 }), error => isNetworkRequestError(error) && error.kind === 'http' && error.status === 429, 'HTTP failures must preserve their response status');

    globalThis.fetch = (async () => { throw new TypeError('offline'); }) as typeof fetch;
    await expectFailure(() => loadOperationsSnapshot({ timeoutMs: 100 }), error => isNetworkRequestError(error) && error.kind === 'network', 'transport failures must be classified as offline/network failures');

    globalThis.fetch = (async () => new Response('{bad json', { status: 200 })) as typeof fetch;
    await expectFailure(() => loadOperationsSnapshot({ timeoutMs: 100 }), error => isNetworkRequestError(error) && error.kind === 'invalid-response', 'unreadable JSON must not masquerade as an offline failure');

    globalThis.fetch = (async () => Response.json({ operation: { date: '2026-09-29' }, metrics: {} })) as typeof fetch;
    await expectFailure(() => loadOperationsSnapshot({ timeoutMs: 100 }), error => isNetworkRequestError(error) && error.kind === 'invalid-response', 'shape-invalid Operations JSON must fail as invalid-response');

    globalThis.fetch = (async () => Response.json({ id: 'trace-a', trace: [] })) as typeof fetch;
    await expectFailure(() => loadRunTrace('trace-a', { timeoutMs: 100 }), error => isNetworkRequestError(error) && error.kind === 'invalid-response', 'shape-invalid trace JSON must fail as invalid-response');

    globalThis.fetch = (async () => Response.json({ credential: 'invalid', expiresAt: 'not-a-date' })) as typeof fetch;
    await expectFailure(() => uploadRunTelemetry({
      contract: { id: 'client-contract', title: 'Client contract', locationName: 'Station', objectiveMode: 'pressure-recovery', operationTier: 2 } as any,
      telemetry: { duration: 1, damageDealt: 0, damageTaken: 0, kills: 0, eliteProtocolsDefeated: 0, killIntervalTotal: 0, killIntervalSamples: 0, protocolCombinations: {}, weaponShots: { carbine: 0, breacher: 0, rail: 0 }, abilityUses: [0, 0, 0], trace: [] } as any,
      outcome: 'safe', salvageTags: 0, level: 1, buildLabel: 'Client', requestId: 'client-request-0000',
    }, { timeoutMs: 100 }), error => isNetworkRequestError(error) && error.kind === 'invalid-response', 'shape-invalid telemetry session JSON must fail as invalid-response');

    let telemetryFetchCount = 0;
    globalThis.fetch = (async () => {
      telemetryFetchCount += 1;
      if (telemetryFetchCount === 1) return Response.json({ credential: `tsc_${'b'.repeat(64)}`, expiresAt: '2099-01-01T00:00:00.000Z' });
      return Response.json({ id: 'client-run', metrics: { attempts: 1 } });
    }) as typeof fetch;
    await expectFailure(() => uploadRunTelemetry({
      contract: { id: 'client-contract', title: 'Client contract', locationName: 'Station', objectiveMode: 'pressure-recovery', operationTier: 2 } as any,
      telemetry: { duration: 1, damageDealt: 0, damageTaken: 0, kills: 0, eliteProtocolsDefeated: 0, killIntervalTotal: 0, killIntervalSamples: 0, protocolCombinations: {}, weaponShots: { carbine: 0, breacher: 0, rail: 0 }, abilityUses: [0, 0, 0], trace: [] } as any,
      outcome: 'safe', salvageTags: 0, level: 1, buildLabel: 'Client', requestId: 'client-request-0001',
    }, { timeoutMs: 100 }), error => isNetworkRequestError(error) && error.kind === 'invalid-response', 'shape-invalid telemetry response JSON must fail as invalid-response');

    console.log('NETWORK_REGRESSION_PASS timeout=bounded body=bounded abort=distinct http=typed offline=typed invalid=typed shapeValidation=operations+telemetrySession+telemetry+trace apiOrigin=verified');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main();
