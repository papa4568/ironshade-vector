import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  selectAuthoritativeReviewCommentWithProvenance,
  verifyTrustedMainMachineRun,
} from '../tools/review-comment-gate.mjs';

const candidateSha = 'a'.repeat(40);
const trustedWorkflowSha = 'b'.repeat(40);
const trustedWorkflowPath = '.github/workflows/ao6-trusted-independent-review.yml';
const packet = {
  schemaVersion: 1,
  taskId: 'AO-6',
  candidateSha,
  branch: 'chatgpt/ao6-independent-verifier-v2',
  mode: 'read-only-adversarial',
  mutationsAllowed: false,
  changedFiles: ['agent/file.mjs'],
  impact: { mode: 'full' },
  acceptance: [{ index: 0, text: 'independent verifier exists' }],
  requiredProofs: [{ id: 'review-contract', kind: 'review', required: true, description: 'independent review' }],
  architectureInvariants: [{ id: 'renderer-boundary', status: 'passed', file: 'renderer.ts', type: 'sourceContract' }],
  verifierInstructions: ['read only', 'disprove', 'exact SHA', 'fail closed'],
  adversarialQuestions: ['a?', 'b?', 'c?', 'd?'],
};

const pass = {
  schemaVersion: 1,
  taskId: 'AO-6',
  candidateSha,
  mode: 'read-only-adversarial',
  verdict: 'pass',
  acceptanceChecks: [{ index: 0, status: 'satisfied', notes: 'checked exact diff' }],
  proofChecks: [{ proofId: 'review-contract', status: 'credible', notes: 'trusted main review' }],
  findings: [],
  reviewerKind: 'trusted-main-copilot-actions',
  sourceWorkflow: 'AO-6 Trusted Independent Review',
  sourceRunId: 123,
  technicalRunId: 456,
  orchestrationRunId: 789,
  trustedWorkflowSha,
  model: 'auto',
};

const envelope = result => `<!-- ironshade-independent-review:trusted-main-actions:v1 -->\n<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\``;
const malformedEnvelope = sha => `<!-- ironshade-independent-review:trusted-main-actions:v1 -->\n<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n{"taskId":"AO-6","candidateSha":"${sha}","verdict":"fail","notes":"bad\\q"}\n\`\`\``;
const malformedMixedCandidateEnvelope = (staleSha, currentSha) => `<!-- ironshade-independent-review:trusted-main-actions:v1 -->\n<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n{"taskId":"AO-6","candidateSha":"${staleSha}","nested":{"candidateSha":"${currentSha}"},"verdict":"fail","notes":"bad\\q"}\n\`\`\``;
const comment = {
  id: 12,
  created_at: '2026-10-10T12:00:10Z',
  updated_at: '2026-10-10T12:00:10Z',
  issue_url: 'https://api.github.com/repos/papa4568/ironshade-vector/issues/346',
  author_association: 'NONE',
  user: { login: 'github-actions[bot]' },
  body: envelope(pass),
};

const selected = await selectAuthoritativeReviewCommentWithProvenance(packet, [comment], {
  prAuthor: 'papa4568',
  verifyMachineRun: async () => ({ reviewer: 'github-actions[bot]', authorAssociation: 'TRUSTED_MAIN_ACTIONS' }),
});
assert.equal(selected.commentId, 12);
assert.equal(selected.authorAssociation, 'TRUSTED_MAIN_ACTIONS');

const staleMalformed = {
  ...comment,
  id: 13,
  body: malformedEnvelope('c'.repeat(40)),
};
const selectedPastStaleMalformed = await selectAuthoritativeReviewCommentWithProvenance(packet, [staleMalformed, comment], {
  prAuthor: 'papa4568',
  verifyMachineRun: async () => ({ reviewer: 'github-actions[bot]', authorAssociation: 'TRUSTED_MAIN_ACTIONS' }),
});
assert.equal(selectedPastStaleMalformed.commentId, 12, 'malformed trusted review for a conclusively different candidate must not poison the current exact-SHA gate');

const olderMalformedCurrent = {
  ...comment,
  id: 14,
  created_at: '2026-10-10T12:00:05Z',
  updated_at: '2026-10-10T12:00:05Z',
  body: malformedEnvelope(candidateSha),
};
const newerValidCurrent = {
  ...comment,
  id: 17,
  created_at: '2026-10-10T12:00:20Z',
  updated_at: '2026-10-10T12:00:20Z',
};
const selectedPastSupersededMalformed = await selectAuthoritativeReviewCommentWithProvenance(
  packet,
  [olderMalformedCurrent, newerValidCurrent],
  {
    prAuthor: 'papa4568',
    verifyMachineRun: async () => ({ reviewer: 'github-actions[bot]', authorAssociation: 'TRUSTED_MAIN_ACTIONS' }),
  },
);
assert.equal(
  selectedPastSupersededMalformed.commentId,
  17,
  'a newer valid exact-SHA trusted-main review must supersede older malformed machine evidence',
);

await assert.rejects(
  () => selectAuthoritativeReviewCommentWithProvenance(packet, [{ ...staleMalformed, id: 14, body: malformedEnvelope(candidateSha) }, comment], {
    prAuthor: 'papa4568',
    verifyMachineRun: async () => ({ reviewer: 'github-actions[bot]', authorAssociation: 'TRUSTED_MAIN_ACTIONS' }),
  }),
  /trusted independent review comment 14 is malformed/,
  'malformed trusted review that is newest for the current candidate must remain fail closed',
);

await assert.rejects(
  () => selectAuthoritativeReviewCommentWithProvenance(packet, [{
    ...staleMalformed,
    id: 15,
    created_at: '2026-10-10T12:00:20Z',
    updated_at: '2026-10-10T12:00:20Z',
    body: malformedMixedCandidateEnvelope('c'.repeat(40), candidateSha),
  }, comment], {
    prAuthor: 'papa4568',
    verifyMachineRun: async () => ({ reviewer: 'github-actions[bot]', authorAssociation: 'TRUSTED_MAIN_ACTIONS' }),
  }),
  /trusted independent review comment 15 is malformed/,
  'malformed trusted review with a stale decoy SHA before the current candidate must poison the current exact-SHA gate',
);

const oldCandidateBot = {
  ...comment,
  id: 16,
  body: `<!-- ironshade-independent-review:github-models-actions:v1 -->\n<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify({ ...pass, reviewerKind: 'github-models-actions', sourceWorkflow: 'Agent Orchestration' })}\n\`\`\``,
};
await assert.rejects(
  () => selectAuthoritativeReviewCommentWithProvenance(packet, [oldCandidateBot], {
    prAuthor: 'papa4568',
    verifyMachineRun: async () => { throw new Error('must not execute'); },
  }),
  /no trusted independent review result/,
);

process.env.GITHUB_REPOSITORY = 'papa4568/ironshade-vector';
const response = (value, status = 200) => new Response(typeof value === 'string' ? value : JSON.stringify(value), { status });
const dispatchFetch = async url => {
  if (url.endsWith('/actions/runs/123')) return response({
    name: 'AO-6 Trusted Independent Review',
    path: trustedWorkflowPath,
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: trustedWorkflowSha,
    status: 'completed',
    conclusion: 'success',
  });
  if (url.includes('/actions/runs/123/jobs')) return response({ jobs: [{ id: 77, name: 'trusted-review', status: 'completed', conclusion: 'success' }] });
  throw new Error(`unexpected URL ${url}`);
};
assert.deepEqual(await verifyTrustedMainMachineRun(comment, pass, { fetchImpl: dispatchFetch }), {
  reviewer: 'github-actions[bot]',
  authorAssociation: 'TRUSTED_MAIN_ACTIONS',
});

const sourceCommand = {
  id: 11,
  created_at: '2026-10-10T12:00:00Z',
  updated_at: '2026-10-10T12:00:00Z',
  issue_url: 'https://api.github.com/repos/papa4568/ironshade-vector/issues/346',
  author_association: 'OWNER',
  user: { login: 'papa4568' },
  body: `/ao6-trusted-review 346 ${candidateSha} AO-6`,
};
const issueComments = [sourceCommand, comment];
const issueFetch = async url => {
  if (url.endsWith('/actions/runs/123')) return response({
    name: 'AO-6 Trusted Independent Review',
    path: trustedWorkflowPath,
    event: 'issue_comment',
    head_branch: 'main',
    head_sha: trustedWorkflowSha,
    status: 'completed',
    conclusion: 'success',
    created_at: '2026-10-10T12:00:03Z',
    actor: { login: 'papa4568' },
    triggering_actor: { login: 'papa4568' },
  });
  if (url.includes('/actions/runs/123/jobs')) return response({ jobs: [{ id: 77, name: 'trusted-review', status: 'completed', conclusion: 'success' }] });
  throw new Error(`unexpected URL ${url}`);
};
assert.deepEqual(await verifyTrustedMainMachineRun(comment, pass, { fetchImpl: issueFetch, comments: issueComments }), {
  reviewer: 'github-actions[bot]',
  authorAssociation: 'TRUSTED_MAIN_ACTIONS',
});

await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, {
    fetchImpl: issueFetch,
    comments: [{ ...sourceCommand, author_association: 'NONE' }, comment],
  }),
  /recent trusted command comment/,
);

await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, {
    fetchImpl: issueFetch,
    comments: [{ ...sourceCommand, body: `/ao6-trusted-review 346 ${'c'.repeat(40)} AO-6` }, comment],
  }),
  /recent trusted command comment/,
);

const mismatchedActorIssueFetch = async url => {
  if (url.endsWith('/actions/runs/123')) return response({
    name: 'AO-6 Trusted Independent Review',
    path: trustedWorkflowPath,
    event: 'issue_comment',
    head_branch: 'main',
    head_sha: trustedWorkflowSha,
    status: 'completed',
    conclusion: 'success',
    created_at: '2026-10-10T12:00:03Z',
    actor: { login: 'papa4568' },
    triggering_actor: { login: 'someone-else' },
  });
  return issueFetch(url);
};
await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, { fetchImpl: mismatchedActorIssueFetch, comments: issueComments }),
  /actor provenance is invalid/,
);

await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, {
    fetchImpl: issueFetch,
    comments: [{ ...sourceCommand, created_at: '2026-10-10T11:55:00Z', updated_at: '2026-10-10T11:55:00Z' }, comment],
  }),
  /recent trusted command comment/,
);

await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, {
    fetchImpl: issueFetch,
    comments: [{ ...sourceCommand, updated_at: '2026-10-10T12:00:04Z' }, comment],
  }),
  /recent trusted command comment/,
);

const wrongPathFetch = async url => {
  if (url.endsWith('/actions/runs/123')) return response({
    name: 'AO-6 Trusted Independent Review',
    path: '.github/workflows/not-the-trusted-review.yml',
    event: 'issue_comment',
    head_branch: 'main',
    head_sha: trustedWorkflowSha,
    status: 'completed',
    conclusion: 'success',
    created_at: '2026-10-10T12:00:03Z',
    actor: { login: 'papa4568' },
    triggering_actor: { login: 'papa4568' },
  });
  return issueFetch(url);
};
await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, { fetchImpl: wrongPathFetch, comments: issueComments }),
  /workflow path mismatch/,
);

const skippedJobFetch = async url => {
  if (url.includes('/actions/runs/123/jobs')) return response({ jobs: [{ id: 77, name: 'trusted-review', status: 'completed', conclusion: 'skipped' }] });
  return issueFetch(url);
};
await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, { fetchImpl: skippedJobFetch, comments: issueComments }),
  /job conclusion does not match verdict/,
);

const wrongBranchFetch = async url => {
  if (url.endsWith('/actions/runs/123')) return response({
    name: 'AO-6 Trusted Independent Review',
    path: trustedWorkflowPath,
    event: 'workflow_dispatch',
    head_branch: 'chatgpt/ao6-independent-verifier-v2',
    head_sha: trustedWorkflowSha,
    status: 'completed',
    conclusion: 'success',
  });
  return dispatchFetch(url);
};
await assert.rejects(() => verifyTrustedMainMachineRun(comment, pass, { fetchImpl: wrongBranchFetch }), /must execute on main/);

const workflow = readFileSync('.github/workflows/agent-orchestration.yml', 'utf8');
assert.doesNotMatch(workflow, /automated-independent-verifier:/, 'candidate workflow must not run its own verifier');
assert.doesNotMatch(workflow, /publish-independent-review:/, 'candidate workflow must not publish its own verdict');
assert.doesNotMatch(workflow, /COPILOT_GITHUB_TOKEN/, 'candidate workflow must never receive the long-lived Copilot token');
assert.match(workflow, /trusted-main-review-gate\.mjs/, 'trusted-main provenance regression must run in orchestration CI');

const candidateWorkflow = readFileSync('.github/workflows/pr-candidate.yml', 'utf8');
assert.match(
  candidateWorkflow,
  /^permissions:\n  actions: read\n/m,
  'candidate review gate must retain Actions read permission so trusted-main run and job provenance can be verified',
);

const gateSource = readFileSync('agent/tools/review-comment-gate.mjs', 'utf8');
assert.match(gateSource, /trusted-main-actions:v1/);
assert.match(gateSource, /workflow_dispatch/);
assert.match(gateSource, /issue_comment/);
assert.match(gateSource, /TRUSTED_WORKFLOW_PATH/);
assert.match(gateSource, /TRUSTED_REQUEST_MAX_AGE_MS/);
assert.match(gateSource, /author_association/);
assert.match(gateSource, /recent trusted command comment/);
assert.match(gateSource, /run\.path === TRUSTED_WORKFLOW_PATH/);
assert.match(gateSource, /conclusivelyTargetsDifferentCandidate/);
assert.match(gateSource, /rawCandidateShas/);
assert.doesNotMatch(gateSource, /actions\/jobs\/\$\{job\.id\}\/logs/, 'candidate gate must not require privileged cross-run job-log downloads');
assert.match(gateSource, /GITHUB_EVENT_PATH/, 'human fallback must derive the PR author from the trusted pull-request event');
assert.match(gateSource, /normalizedLogin\(reviewerLogin\) === prAuthorLogin/, 'human fallback must reject self-authored PR-author verdicts');

console.log('TRUSTED_MAIN_REVIEW_GATE_TEST_PASS');
