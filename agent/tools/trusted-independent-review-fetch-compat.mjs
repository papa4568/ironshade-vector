import { fileURLToPath } from 'node:url';

const standardGitHubAccept = 'application/vnd.github+json';
const jobLogPath = /\/actions\/jobs\/\d+\/logs(?:\?|$)/;
const runJobsPath = /\/actions\/runs\/\d+\/jobs(?:\?|$)/;
const technicalStepName = 'Require exact candidate technical gates';

const inputUrl = input => (
  typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url ?? '')
);

const hasTechnicalStep = job => (
  Array.isArray(job?.steps) && job.steps.some(step => step?.name === technicalStepName)
);

function latestFinalCandidateJob(jobs) {
  return (Array.isArray(jobs) ? jobs : [])
    .filter(job => job?.name === 'PR Candidate Verification')
    .sort((left, right) => Number(left.id ?? 0) - Number(right.id ?? 0))
    .at(-1);
}

export function normalizeTrustedReviewFetch(input, init = {}) {
  const url = inputUrl(input);
  if (!url.startsWith('https://api.github.com/') || !jobLogPath.test(url)) return { input, init };

  const headers = new Headers(init.headers ?? (typeof input === 'object' ? input.headers : undefined));
  if (headers.get('Accept') === 'text/plain') headers.set('Accept', standardGitHubAccept);
  return { input, init: { ...init, headers } };
}

export function hydrateFinalCandidateJobs(payload, detail) {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null;
  if (!jobs) return payload;
  const final = latestFinalCandidateJob(jobs);
  if (!final || hasTechnicalStep(final) || !hasTechnicalStep(detail) || detail?.id !== final.id) return payload;
  return {
    ...payload,
    jobs: jobs.map(job => job?.id === final.id ? { ...job, ...detail, steps: detail.steps } : job),
  };
}

const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
  globalThis.fetch = async (input, init) => {
    const normalized = normalizeTrustedReviewFetch(input, init);
    const response = await originalFetch(normalized.input, normalized.init);
    const url = inputUrl(normalized.input);
    if (!response.ok || !url.startsWith('https://api.github.com/') || !runJobsPath.test(url)) return response;

    let payload;
    try {
      payload = await response.clone().json();
    } catch {
      return response;
    }
    const final = latestFinalCandidateJob(payload?.jobs);
    if (!final || hasTechnicalStep(final) || !Number.isInteger(final.id)) return response;

    const detailUrl = new URL(url);
    detailUrl.pathname = detailUrl.pathname.replace(/\/actions\/runs\/\d+\/jobs$/, `/actions/jobs/${final.id}`);
    detailUrl.search = '';
    const detailHeaders = new Headers(
      normalized.init?.headers ?? (typeof normalized.input === 'object' ? normalized.input.headers : undefined),
    );
    detailHeaders.set('Accept', standardGitHubAccept);
    const detailResponse = await originalFetch(detailUrl, { ...normalized.init, method: 'GET', body: undefined, headers: detailHeaders });
    if (!detailResponse.ok) return response;

    let detail;
    try {
      detail = await detailResponse.json();
    } catch {
      return response;
    }
    const hydrated = hydrateFinalCandidateJobs(payload, detail);
    if (hydrated === payload) return response;
    return new Response(JSON.stringify(hydrated), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
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

  const partialPayload = {
    jobs: [{
      id: 77,
      name: 'PR Candidate Verification',
      status: 'completed',
      conclusion: 'failure',
      steps: [{ name: 'Set up job', conclusion: 'success' }],
    }],
  };
  const detailedFinal = {
    id: 77,
    name: 'PR Candidate Verification',
    status: 'completed',
    conclusion: 'failure',
    steps: [
      { name: 'Require exact candidate technical gates', conclusion: 'success' },
      { name: 'Require actual exact-SHA independent-review pass', conclusion: 'failure' },
    ],
  };
  const hydrated = hydrateFinalCandidateJobs(partialPayload, detailedFinal);
  if (!hasTechnicalStep(hydrated.jobs[0])) throw new Error('partial final-job metadata was not hydrated from dedicated job detail');

  const incompleteDetail = { ...detailedFinal, steps: [{ name: 'Set up job', conclusion: 'success' }] };
  if (hydrateFinalCandidateJobs(partialPayload, incompleteDetail) !== partialPayload) {
    throw new Error('incomplete dedicated job detail must not replace fail-closed partial metadata');
  }

  const alreadyComplete = { jobs: [detailedFinal] };
  if (hydrateFinalCandidateJobs(alreadyComplete, detailedFinal) !== alreadyComplete) {
    throw new Error('complete final-job metadata must remain unchanged');
  }

  console.log('TRUSTED_INDEPENDENT_REVIEW_FETCH_COMPAT_SELF_TEST_PASS');
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'self-test') selfTest();
