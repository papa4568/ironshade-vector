#!/usr/bin/env node
// AO-19 one-use Git-object-pinned trusted-main bootstrap. Never run candidate
// code with a write-capable token. Privileged execution requires fresh owner
// authorization on reviewed and merged AO-19 preparation PR #450.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
// Never statically import an untrusted candidate module in a write-token process.
// Inspect exact blob identities with only Node builtins BEFORE dynamic import.

const OWNER = 'papa4568', REPO = OWNER + '/ironshade-vector', PR = 450;
const BRANCH = 'security/ao19-p28f6-review-route';
const NEW = Object.freeze({
  'agent/tools/candidate-evidence.mjs': 'bf0d48a922dbe482c93732c262e38a32bc831711',
  'agent/tools/p28f6-hotfix-review-contract.mjs': 'eb84b567ca9c6e6e5a2cbb0221a26772def0f0ca',
  'agent/tools/select-review-task.mjs': 'f4c6f1515a307f901b02fffa3d36dd94418dd39c',
  'agent/tools/trusted-independent-review-v3.mjs': 'd4e84312a96277be4d4509c44cd0c1a73b1108a5',
});
const SHA = /^[0-9a-f]{40}$/;
const PATCH_PATH = 'tools/ao19-p28f6-route-patches.mjs';
const PATCH_SHA = 'f0fc1564de8253069d9d51fe49ec8469fb0072eb';
const CONTRACT_PATH = 'tools/ao19-p28f6-contract.staged.mjs';
const CONTRACT_SHA = 'eb84b567ca9c6e6e5a2cbb0221a26772def0f0ca';
const BASE_BLOBS = Object.freeze({
  'agent/tools/select-review-task.mjs': '71f5eccdf3a6b9d0ac8cbdb23c62ae202b306cdf',
  'agent/tools/candidate-evidence.mjs': '509de6365c1c72eb4e897177758091d9d24ff58a',
  'agent/tools/trusted-independent-review-v3.mjs': '6feebc5d36e49b6e7f0e8bcadc0980ccbc7d08f6',
});
const ok = (x, reason) => assert(x, reason);
function gitBlobSha(input) {
  const value = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return createHash('sha1').update('blob ' + value.length + '\0').update(value).digest('hex');
}
export function validateStagedModulePin(path = PATCH_PATH, expected = PATCH_SHA) {
  const bytes = readFileSync(path);
  ok(gitBlobSha(bytes) === expected, 'untrusted patch module must pass Git object identity before import');
  return true;
}

function ownerEvent(event) {
  ok(event?.action === 'created' && event.repository?.full_name === REPO, 'wrong owner event');
  ok(event.issue?.number === PR && event.issue?.pull_request, 'owner command not on AO-19 PR');
  ok(event.sender?.login === OWNER && event.comment?.user?.login === OWNER &&
    event.comment?.author_association === 'OWNER', 'only repository owner may authorize promotion');
  const match = event.comment?.body?.match(/^\/ao19-promote-p28f6-review 450 ([0-9a-f]{40})$/);
  ok(match, 'exact owner comment must bind reviewed PR SHA');
  return match[1];
}
function job(jobs, name) {
  const matches = jobs.filter(x => x.name === name);
  assert.equal(matches.length, 1, 'missing or ambiguous CI job: ' + name);
  ok(matches[0].status === 'completed' && matches[0].conclusion === 'success',
    'required CI job not successful: ' + name);
  return matches[0];
}
function technicalProof(jobs) {
  for (const name of [
    'Candidate Build and Full Verification',
    'Independent Review Context',
    'Android PR / Android PR APK',
    'Android PR / Android PR API 35 Smoke',
    'Android PR / Android PR API 36 Large Screen',
    'Android PR / Android PR Verification',
  ]) job(jobs, name);
  // No silent browser matrix omission. AO-19 has an explicit two-platform
  // browser acceptance contract regardless of scope selection.
  for (const name of ['Browser E2E / browser-e2e (desktop)',
    'Browser E2E / browser-e2e (mobile-landscape)']) job(jobs, name);
  const final = job(jobs, 'PR Candidate Verification');
  for (const name of ['Require exact candidate technical gates',
    'Require actual exact-SHA independent-review pass']) {
    ok(final.steps?.some(s => s.name === name && s.conclusion === 'success'),
      'required final gate not successful: ' + name);
  }
}
async function proposedSources() {
  // Execute NO code from the patcher until this exact read-only, Node-builtin
  // object-identity check succeeds. The Git checkout comes from trusted main.
  validateStagedModulePin();
  const contract = readFileSync(CONTRACT_PATH);
  ok(gitBlobSha(contract) === CONTRACT_SHA, 'trusted contract source drift');
  const { prepareProtectedHotfixReviewSources, REVIEWED_OLD_BLOBS } =
    await import('./ao19-p28f6-route-patches.mjs');
  assert.deepEqual(REVIEWED_OLD_BLOBS, BASE_BLOBS, 'imported protected base pin list differs');
  const current = Object.fromEntries(Object.keys(BASE_BLOBS)
    .map(p => [p, readFileSync(p, 'utf8')]));
  const outputs = prepareProtectedHotfixReviewSources(current, contract.toString('utf8'));
  assert.deepEqual(outputs.map(x => x.path).sort(), Object.keys(NEW).sort(),
    'unreviewed protected source path');
  for (const output of outputs) assert.equal(output.sha, NEW[output.path],
    'unreviewed protected source Git blob: ' + output.path);
  return outputs;
}
async function github(path, token, method = 'GET', body = undefined, asText = false) {
  ok(typeof token === 'string' && token.length, 'trusted token absent');
  const response = await fetch('https://api.github.com/repos/' + REPO + path, {
    method, headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  ok(response.ok, method + ' ' + path + ' HTTP ' + response.status + ': ' + raw.slice(0, 500));
  return asText ? raw : (raw ? JSON.parse(raw) : {});
}
function exactRun(list, sha, label) {
  const runs = (list.workflow_runs ?? []).filter(x => x.event === 'pull_request' &&
    x.head_sha === sha && (x.pull_requests ?? []).some(p => p.number === PR));
  assert.equal(runs.length, 1, label + ' exact-head CI source missing/ambiguous');
  ok(runs[0].status === 'completed' && runs[0].conclusion === 'success',
    label + ' not successful');
  return runs[0];
}
function reviewerSourceProvenance({ run, jobs, logs, comment, verdict, sha }) {
  ok(run.workflow_id === 380851235 &&
    run.path === '.github/workflows/ao6-trusted-independent-review.yml' &&
    run.event === 'issue_comment' && run.conclusion === 'success' &&
    run.status === 'completed' && run.actor?.login === OWNER &&
    run.triggering_actor?.login === OWNER &&
    run.head_sha === verdict.trustedWorkflowSha,
  'trusted review source workflow/actor identity mismatch');
  ok(Array.isArray(jobs) && jobs.length === 1 &&
    jobs[0].name === 'trusted-review' && jobs[0].status === 'completed' &&
    jobs[0].conclusion === 'success', 'trusted review job provenance ambiguous');
  const requestMarker = 'AO6_TRUSTED_REVIEW_REQUEST_RESOLVED pr=450 candidate=' +
    sha + ' task=AO-19';
  const publishedMarker = 'TRUSTED_INDEPENDENT_REVIEW_PASS candidate=' +
    sha + ' comment=' + comment.id;
  ok(typeof logs === 'string', 'trusted reviewer job logs absent');
  const first = logs.indexOf(requestMarker), last = logs.indexOf(publishedMarker);
  ok(first >= 0 && last > first &&
    logs.indexOf(requestMarker, first + 1) < 0 &&
    logs.indexOf(publishedMarker, last + 1) < 0,
  'exact review request and bot comment were not published by the cited trusted job');
  const created = Date.parse(comment.created_at), runCreated = Date.parse(run.created_at);
  ok(Number.isFinite(created) && Number.isFinite(runCreated) && created >= runCreated,
    'trusted comment predates its cited review source run');
}

async function independentProof(token, sha) {
  const comments = await github('/issues/' + PR + '/comments?per_page=100', token);
  ok(comments.length < 100, 'truncated trusted reviewer comments');
  const found = [];
  for (const comment of comments) {
    if (comment.user?.login !== 'github-actions[bot]' ||
      !comment.body?.includes('<!-- ironshade-independent-review:trusted-main-actions:v1 -->')) continue;
    const start = comment.body.indexOf('{', comment.body.indexOf('json'));
    const end = comment.body.lastIndexOf('}');
    ok(start > 0 && end > start, 'malformed trusted review JSON envelope');
    const value = JSON.parse(comment.body.slice(start, end + 1));
    if (value.taskId === 'AO-19' && value.candidateSha === sha) found.push({ comment, value });
  }
  ok(found.length, 'trusted AO-19 exact-SHA reviewer verdict absent');
  found.sort((x, y) => x.comment.id - y.comment.id);
  const latest = found.at(-1);
  const verdict = latest.value;
  ok(verdict.verdict === 'pass' &&
    verdict.reviewerKind === 'trusted-main-copilot-actions' &&
    verdict.sourceWorkflow === 'AO-6 Trusted Independent Review' &&
    verdict.acceptanceChecks?.every(x => x.status === 'satisfied') &&
    verdict.proofChecks?.every(x => x.status === 'credible') &&
    !verdict.findings?.some(x => ['blocking', 'major'].includes(x.severity)),
  'latest independent security review was not a full PASS');
  const run = await github('/actions/runs/' + verdict.sourceRunId, token);
  const jobPage = await github('/actions/runs/' + run.id + '/jobs?per_page=100', token);
  ok(jobPage.total_count === jobPage.jobs?.length, 'trusted review jobs truncated');
  const trustedJob = jobPage.jobs?.filter(x => x.name === 'trusted-review') ?? [];
  ok(trustedJob.length === 1, 'trusted review job not found uniquely');
  const logs = await github('/actions/jobs/' + trustedJob[0].id + '/logs', token, 'GET', undefined, true);
  reviewerSourceProvenance({ run, jobs: trustedJob, logs, comment: latest.comment, verdict, sha });
  return latest.comment;
}

export function verifyOwnerMergeAuthorization({ comments, sha, pull, trustedReview }) {
  ok(pull?.merged === true && pull?.state === 'closed' &&
    typeof pull.merged_at === 'string', 'not a completed merged PR');
  ok(Array.isArray(comments) && comments.length < 100,
    'owner authorization history truncated');
  const reviewTime = Date.parse(trustedReview?.created_at);
  const mergeTime = Date.parse(pull.merged_at);
  ok(Number.isFinite(reviewTime) && Number.isFinite(mergeTime) && mergeTime > reviewTime,
    'merge must occur after successful independent security review');
  const approved = comments.filter(item => item.user?.login === OWNER &&
    item.author_association === 'OWNER' &&
    item.body?.trim() === '/ao19-authorize-merge 450 ' + sha &&
    item.created_at === item.updated_at &&
    Date.parse(item.created_at) > reviewTime &&
    Date.parse(item.created_at) < mergeTime);
  ok(approved.length === 1,
    'missing distinct owner-authored exact-SHA merge approval between review and merge');
  return approved[0].id;
}
async function promote() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'));
  const candidate = ownerEvent(event), token = process.env.GITHUB_TOKEN;
  const checkoutSha = process.env.GITHUB_SHA;
  ok(SHA.test(checkoutSha ?? '') &&
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === checkoutSha,
  'bootstrap did not check out trusted main');
  const main = await github('/git/ref/heads/main', token);
  ok(main.object?.sha === checkoutSha, 'main moved since owner authorization');
  const pr = await github('/pulls/' + PR, token);
  ok(pr.state === 'closed' && pr.merged === true && pr.head?.sha === candidate &&
    pr.head?.ref === BRANCH && pr.head?.repo?.full_name === REPO &&
    pr.base?.ref === 'main', 'reviewed AO-19 candidate is not merged unchanged');
  const runs = await github('/actions/workflows/pr-candidate.yml/runs?event=pull_request&head_sha=' + candidate + '&per_page=100', token);
  const ci = exactRun(runs, candidate, 'PR Candidate');
  const jobs = await github('/actions/runs/' + ci.id + '/jobs?per_page=100', token);
  ok(jobs.total_count === jobs.jobs?.length, 'CI jobs response truncated');
  technicalProof(jobs.jobs);
  const ao = await github('/actions/workflows/agent-orchestration.yml/runs?event=pull_request&head_sha=' + candidate + '&per_page=100', token);
  exactRun(ao, candidate, 'Agent Orchestration');
  const observers = await github('/actions/runs?event=pull_request_target&head_sha=' + candidate + '&per_page=100', token);
  ok(observers.workflow_runs?.some(x =>
    x.path === '.github/workflows/ev9-trusted-pr-candidate-observer.yml' &&
    x.status === 'completed' && x.conclusion === 'success' &&
    (x.pull_requests ?? []).some(p => p.number === PR)),
  'trusted-base EV-9 PR observation did not pass');
  const reviewedComment = await independentProof(token, candidate);
  const comments = await github('/issues/' + PR + '/comments?per_page=100', token);
  verifyOwnerMergeAuthorization({ comments, sha: candidate, pull: pr,
    trustedReview: reviewedComment });
  const sources = await proposedSources();
  const oldCommit = await github('/git/commits/' + checkoutSha, token);
  const entries = [];
  for (const source of sources) {
    const blob = await github('/git/blobs', token, 'POST',
      { content: source.content, encoding: 'utf-8' });
    ok(blob.sha === source.sha, 'protected Git object digest mismatch: ' + source.path);
    entries.push({ path: source.path, mode: '100644', type: 'blob', sha: source.sha });
  }
  // GitHub Actions token cannot update workflows. Delete the trusted
  // executable helper atomically, leaving the owner-comment workflow inert.
  entries.push({ path: 'tools/ao19-p28f6-route-bootstrap.mjs', mode: '100644',
    type: 'blob', sha: null });
  const tree = await github('/git/trees', token, 'POST',
    { base_tree: oldCommit.tree.sha, tree: entries });
  const commit = await github('/git/commits', token, 'POST', {
    message: 'AO-19 trusted one-shot P28-F6 review route\n\nReviewed: ' +
      candidate + '; exact CI: ' + ci.id + '; helper retired atomically.',
    tree: tree.sha, parents: [checkoutSha],
  });
  const pushed = await github('/git/refs/heads/main', token, 'PATCH',
    { sha: commit.sha, force: false });
  ok(pushed.object?.sha === commit.sha, 'protected main promotion ref update failed');
  console.log('AO19_ONE_SHOT_OWNER_PROMOTION_PASS main=' + commit.sha +
    ' reviewed=' + candidate);
}
async function selfTest() {
  const sha = 'a'.repeat(40);
  const event = {
    action: 'created', repository: { full_name: REPO },
    issue: { number: PR, pull_request: {} }, sender: { login: OWNER },
    comment: { author_association: 'OWNER', user: { login: OWNER },
      body: '/ao19-promote-p28f6-review 450 ' + sha },
  };
  assert.equal(ownerEvent(event), sha);
  for (const patch of [
    { action: 'edited' }, { repository: { full_name: 'attacker/repo' } },
    { issue: { number: 449, pull_request: {} } },
    { sender: { login: 'attacker' } },
    { comment: { ...event.comment, author_association: 'MEMBER' } },
    { comment: { ...event.comment, body: event.comment.body + ' --force' } },
  ]) assert.throws(() => ownerEvent({ ...event, ...patch }));
  const names = ['Candidate Build and Full Verification', 'Independent Review Context',
    'Android PR / Android PR APK', 'Android PR / Android PR API 35 Smoke',
    'Android PR / Android PR API 36 Large Screen', 'Android PR / Android PR Verification',
    'Browser E2E / browser-e2e (desktop)', 'Browser E2E / browser-e2e (mobile-landscape)',
    'PR Candidate Verification'];
  const jobs = names.map(name => ({
    name, status: 'completed', conclusion: 'success',
    steps: name === 'PR Candidate Verification' ? [
      { name: 'Require exact candidate technical gates', conclusion: 'success' },
      { name: 'Require actual exact-SHA independent-review pass', conclusion: 'success' },
    ] : [],
  }));
  technicalProof(jobs);
  for (const name of names) assert.throws(() => technicalProof(
    jobs.map(j => j.name === name ? { ...j, conclusion: 'failure' } : j)));
  assert.throws(() => technicalProof([...jobs, jobs[0]]));
  for (const name of ['Browser E2E / browser-e2e (desktop)',
    'Browser E2E / browser-e2e (mobile-landscape)']) {
    assert.throws(() => technicalProof(jobs.filter(j => j.name !== name)),
      /missing or ambiguous CI job/);
  }
  // Source objects cannot be loaded before the bootstrap validates the
  // patch module's exact object identity. Even negative tests check the pin.
  assert.equal(validateStagedModulePin(), true);
  assert.throws(() => validateStagedModulePin(CONTRACT_PATH, PATCH_SHA),
    /before import/);
  assert.equal((await proposedSources()).length, 4);
  const stamp = '2026-11-15T20:00:00Z', reviewSha = 'c'.repeat(40);
  const reviewSource = {
    workflow_id: 380851235,
    path: '.github/workflows/ao6-trusted-independent-review.yml',
    event: 'issue_comment', status: 'completed', conclusion: 'success',
    actor: { login: OWNER }, triggering_actor: { login: OWNER },
    head_sha: reviewSha, created_at: stamp,
  };
  const trustedJob = { name: 'trusted-review', status: 'completed', conclusion: 'success' };
  const reviewComment = { id: 12345, created_at: '2026-11-15T20:05:00Z' };
  const reviewVerdict = { trustedWorkflowSha: reviewSha };
  const markerLogs = 'AO6_TRUSTED_REVIEW_REQUEST_RESOLVED pr=450 candidate=' +
    sha + ' task=AO-19\nTRUSTED_INDEPENDENT_REVIEW_PASS candidate=' +
    sha + ' comment=12345\n';
  const args = { run: reviewSource, jobs: [trustedJob], logs: markerLogs,
    comment: reviewComment, verdict: reviewVerdict, sha };
  reviewerSourceProvenance(args);
  for (const bad of [
    { run: { ...reviewSource, event: 'pull_request' } },
    { run: { ...reviewSource, actor: { login: 'attacker' } } },
    { run: { ...reviewSource, workflow_id: 42 } },
    { run: { ...reviewSource, head_sha: 'd'.repeat(40) } },
    { jobs: [{ ...trustedJob, conclusion: 'failure' }] },
    { jobs: [trustedJob, trustedJob] },
    { logs: markerLogs.replace('comment=12345', 'comment=12') },
    { logs: markerLogs.replace('task=AO-19', 'task=P28-G9') },
    { logs: markerLogs + markerLogs },
    { comment: { ...reviewComment, created_at: '2026-11-15T19:59:00Z' } },
  ]) assert.throws(() => reviewerSourceProvenance({ ...args, ...bad }));

  const trialReview = { created_at: '2026-11-15T19:58:00Z' };
  const trialPull = { state: 'closed', merged: true,
    merged_at: '2026-11-15T20:10:00Z' };
  const approved = { id: 200, user: { login: OWNER },
    author_association: 'OWNER', body: '/ao19-authorize-merge 450 ' + sha,
    created_at: '2026-11-15T20:04:00Z',
    updated_at: '2026-11-15T20:04:00Z' };
  const approvalArgs = { comments: [approved], sha, pull: trialPull,
    trustedReview: trialReview };
  assert.equal(verifyOwnerMergeAuthorization(approvalArgs), 200);
  assert.throws(() => verifyOwnerMergeAuthorization({ ...approvalArgs, comments: [] }));
  assert.throws(() => verifyOwnerMergeAuthorization({ ...approvalArgs,
    comments: [{ ...approved, user: { login: 'attacker' } }] }));
  assert.throws(() => verifyOwnerMergeAuthorization({ ...approvalArgs,
    comments: [{ ...approved, author_association: 'MEMBER' }] }));
  assert.throws(() => verifyOwnerMergeAuthorization({ ...approvalArgs,
    comments: [{ ...approved, body: approved.body.replace(sha, 'b'.repeat(40)) }] }));
  assert.throws(() => verifyOwnerMergeAuthorization({ ...approvalArgs,
    comments: [{ ...approved, updated_at: '2026-11-15T20:05:00Z' }] }));
  assert.throws(() => verifyOwnerMergeAuthorization({ ...approvalArgs,
    comments: [{ ...approved, created_at: '2026-11-15T19:55:00Z' }] }));
  assert.throws(() => verifyOwnerMergeAuthorization({ ...approvalArgs,
    comments: [{ ...approved, created_at: '2026-11-15T20:11:00Z' }] }));
  assert.throws(() => verifyOwnerMergeAuthorization({ ...approvalArgs,
    comments: [approved, approved] }));
  assert.throws(() => verifyOwnerMergeAuthorization({ ...approvalArgs,
    pull: { ...trialPull, merged: false } }));
  console.log('AO19_BOOTSTRAP_SECURITY_SELF_TEST_PASS');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    if (process.argv[2] === 'self-test') await selfTest();
    else if (process.argv[2] === 'promote') await promote();
    else throw new Error('expected self-test or promote');
  })().catch(e => {
    console.error('AO19_BOOTSTRAP_FAIL ' + e.message);
    process.exitCode = 1;
  });
}
