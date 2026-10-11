import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  selectAuthoritativeReviewCommentWithProvenance,
  verifyTrustedMainMachineRun,
} from '../tools/review-comment-gate.mjs';

const candidateSha = 'a'.repeat(40);
const trustedWorkflowSha = 'b'.repeat(40);
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
const comment = {
  id: 12,
  created_at: '2026-10-10T12:00:00Z',
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

const oldCandidateBot = {
  ...comment,
  id: 13,
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
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: trustedWorkflowSha,
    status: 'completed',
    conclusion: 'success',
  });
  if (url.includes('/actions/runs/123/jobs')) return response({ jobs: [{ id: 77, name: 'trusted-review', status: 'completed', conclusion: 'success' }] });
  if (url.endsWith('/actions/jobs/77/logs')) return response(`TRUSTED_INDEPENDENT_REVIEW_PASS candidate=${candidateSha} comment=12`);
  throw new Error(`unexpected URL ${url}`);
};
assert.deepEqual(await verifyTrustedMainMachineRun(comment, pass, { fetchImpl: dispatchFetch }), {
  reviewer: 'github-actions[bot]',
  authorAssociation: 'TRUSTED_MAIN_ACTIONS',
});

const issueLogs = [
  'EVENT_NAME: issue_comment',
  'ISSUE_NUMBER: 346',
  `COMMENT_BODY: /ao6-trusted-review 346 ${candidateSha} AO-6`,
  'COMMENT_ASSOCIATION: OWNER',
  `AO6_TRUSTED_REVIEW_REQUEST_RESOLVED pr=346 candidate=${candidateSha} task=AO-6`,
  `TRUSTED_INDEPENDENT_REVIEW_PASS candidate=${candidateSha} comment=12`,
].join('\n');
const issueFetch = async url => {
  if (url.endsWith('/actions/runs/123')) return response({
    name: 'AO-6 Trusted Independent Review',
    event: 'issue_comment',
    head_branch: 'main',
    head_sha: trustedWorkflowSha,
    status: 'completed',
    conclusion: 'success',
    actor: { login: 'papa4568' },
    triggering_actor: { login: 'papa4568' },
  });
  if (url.includes('/actions/runs/123/jobs')) return response({ jobs: [{ id: 77, name: 'trusted-review', status: 'completed', conclusion: 'success' }] });
  if (url.endsWith('/actions/jobs/77/logs')) return response(issueLogs);
  throw new Error(`unexpected URL ${url}`);
};
assert.deepEqual(await verifyTrustedMainMachineRun(comment, pass, { fetchImpl: issueFetch }), {
  reviewer: 'github-actions[bot]',
  authorAssociation: 'TRUSTED_MAIN_ACTIONS',
});

const untrustedIssueFetch = async url => {
  if (url.endsWith('/actions/jobs/77/logs')) return response(issueLogs.replace('COMMENT_ASSOCIATION: OWNER', 'COMMENT_ASSOCIATION: NONE'));
  return issueFetch(url);
};
await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, { fetchImpl: untrustedIssueFetch }),
  /OWNER, MEMBER, or COLLABORATOR/,
);

const wrongCommandIssueFetch = async url => {
  if (url.endsWith('/actions/jobs/77/logs')) return response(issueLogs.replace(candidateSha, 'c'.repeat(40)));
  return issueFetch(url);
};
await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, { fetchImpl: wrongCommandIssueFetch }),
  /command does not bind this task and candidate/,
);

const mismatchedActorIssueFetch = async url => {
  if (url.endsWith('/actions/runs/123')) return response({
    name: 'AO-6 Trusted Independent Review',
    event: 'issue_comment',
    head_branch: 'main',
    head_sha: trustedWorkflowSha,
    status: 'completed',
    conclusion: 'success',
    actor: { login: 'papa4568' },
    triggering_actor: { login: 'someone-else' },
  });
  return issueFetch(url);
};
await assert.rejects(
  () => verifyTrustedMainMachineRun(comment, pass, { fetchImpl: mismatchedActorIssueFetch }),
  /actor provenance is invalid/,
);

const wrongBranchFetch = async url => {
  if (url.endsWith('/actions/runs/123')) return response({
    name: 'AO-6 Trusted Independent Review',
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
assert.match(gateSource, /COMMENT_ASSOCIATION/);
assert.match(gateSource, /AO6_TRUSTED_REVIEW_REQUEST_RESOLVED/);
assert.match(gateSource, /head_branch === 'main'/);
assert.match(gateSource, /TRUSTED_INDEPENDENT_REVIEW_/);
assert.match(gateSource, /actions\/jobs\/\$\{job\.id\}\/logs/);
assert.match(gateSource, /GITHUB_EVENT_PATH/, 'human fallback must derive the PR author from the trusted pull-request event');
assert.match(gateSource, /normalizedLogin\(reviewerLogin\) === prAuthorLogin/, 'human fallback must reject self-authored PR-author verdicts');

console.log('TRUSTED_MAIN_REVIEW_GATE_TEST_PASS');
