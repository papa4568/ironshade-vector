import { isNetworkRequestError, loadOperationsSnapshot, loadRunTrace, normalizeOperationsApiBase, resolveOperationsApiUrl } from '../src/game/network';

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

    console.log('NETWORK_REGRESSION_PASS timeout=bounded body=bounded abort=distinct http=typed offline=typed invalid=typed apiOrigin=verified');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main();
