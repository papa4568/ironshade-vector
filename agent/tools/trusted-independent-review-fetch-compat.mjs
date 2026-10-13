import { fileURLToPath } from 'node:url';

const standardGitHubAccept = 'application/vnd.github+json';
const jobLogPath = /\/actions\/jobs\/\d+\/logs(?:\?|$)/;

export function normalizeTrustedReviewFetch(input, init = {}) {
  const url = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url ?? '');
  if (!url.startsWith('https://api.github.com/') || !jobLogPath.test(url)) return { input, init };

  const headers = new Headers(init.headers ?? (typeof input === 'object' ? input.headers : undefined));
  if (headers.get('Accept') === 'text/plain') headers.set('Accept', standardGitHubAccept);
  return { input, init: { ...init, headers } };
}

const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
  globalThis.fetch = (input, init) => {
    const normalized = normalizeTrustedReviewFetch(input, init);
    return originalFetch(normalized.input, normalized.init);
  };
}

function selfTest() {
  const corrected = normalizeTrustedReviewFetch(
    'https://api.github.com/repos/example/repo/actions/jobs/123/logs',
    { headers: { Accept: 'text/plain', Authorization: 'Bearer test' } },
  );
  const correctedHeaders = new Headers(corrected.init.headers);
  if (correctedHeaders.get('Accept') !== standardGitHubAccept) throw new Error('job-log Accept header was not normalized');
  if (correctedHeaders.get('Authorization') !== 'Bearer test') throw new Error('existing headers were not preserved');

  const normalApi = normalizeTrustedReviewFetch(
    'https://api.github.com/repos/example/repo/actions/runs/456/jobs',
    { headers: { Accept: 'text/plain' } },
  );
  if (new Headers(normalApi.init.headers).get('Accept') !== 'text/plain') throw new Error('non-log GitHub request was changed');

  const external = normalizeTrustedReviewFetch(
    'https://example.com/actions/jobs/123/logs',
    { headers: { Accept: 'text/plain' } },
  );
  if (new Headers(external.init.headers).get('Accept') !== 'text/plain') throw new Error('non-GitHub request was changed');

  console.log('TRUSTED_INDEPENDENT_REVIEW_FETCH_COMPAT_SELF_TEST_PASS');
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'self-test') selfTest();
