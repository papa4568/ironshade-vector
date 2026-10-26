#!/usr/bin/env node
// AO-16: one-use, base-owned policy-source bootstrap. Never execute candidate code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OWNER = 'papa4568';
const REPO = 'ironshade-vector';
const PR = 438;
const CANDIDATE = 'cbefc548a4478015572e19f74670fba0757e0cac';
const OBSERVER = 'agent/tools/ev9-trusted-pr-candidate-observer-v11.mjs';
const BASE_OBSERVER = '3df1250e218565a2c1b76d927810ee8a27c0a471';
const REVIEWED_OBSERVER = 'd17392878d2dd4a70122a649ba8fc10d54a0d4d6';
const WORKFLOW = '.github/workflows/ao16-trusted-observer-bootstrap.yml';
const HELPER = 'tools/ao16-trusted-observer-bootstrap.mjs';
const COMMAND = '/ao16-promote-observer 438 ' + CANDIDATE;
const REPO_URL = 'https://api.github.com/repos/' + OWNER + '/' + REPO;

function authorizedComment(event) {
  return event?.action === 'created'
    && event?.issue?.number === PR
    && Boolean(event?.issue?.pull_request)
    && event?.comment?.body === COMMAND
    && event?.comment?.user?.login === OWNER
    && event?.sender?.login === OWNER
    && event?.comment?.author_association === 'OWNER'
    && event?.repository?.full_name === OWNER + '/' + REPO;
}

function treeEntry(tree, path) {
  const entries = tree?.tree ?? [];
  assert.equal(tree?.truncated, false, 'refuse incomplete Git tree');
  const found = entries.filter(x => x.path === path);
  assert.equal(found.length, 1, 'missing or ambiguous tree path ' + path);
  return found[0];
}

function pinnedObject(tree, path, expected) {
  const entry = treeEntry(tree, path);
  assert.equal(entry.mode + ' ' + entry.type + ' ' + entry.sha, expected,
    'Git object mismatch for ' + path);
  return entry;
}

function namedJob(jobs, name) {
  const matches = jobs.filter(x => x.name === name);
  assert.equal(matches.length, 1, 'unexpected job count: ' + name);
  return matches[0];
}

function provedJobs(jobs) {
  for (const name of ['Candidate Build and Full Verification',
    'Independent Review Context', 'Android PR / Android PR APK',
    'Android PR / Android PR API 35 Smoke',
    'Android PR / Android PR API 36 Large Screen',
    'Android PR / Android PR Verification']) {
    assert.equal(namedJob(jobs, name).conclusion, 'success', name + ' not successful');
  }
  assert(['success', 'skipped'].includes(namedJob(jobs, 'Browser E2E').conclusion),
    'browser proof must pass or be scope-skipped');
  const final = namedJob(jobs, 'PR Candidate Verification');
  assert.equal(final.conclusion, 'failure', 'unexpected final candidate state');
  const technical = final.steps?.filter(s => s.name === 'Require exact candidate technical gates').at(-1);
  const review = final.steps?.filter(s => s.name === 'Require actual exact-SHA independent-review pass').at(-1);
  assert.equal(technical?.conclusion, 'success', 'exact-SHA technical proof must pass');
  assert.equal(review?.conclusion, 'failure', 'only the anticipated review gate may fail');
  assert(!final.steps?.some(s => s.conclusion === 'failure' && s.name !== review.name),
    'unexpected other final-candidate failure');
}

function reviewerEvidence(comments, technicalRunId) {
  const validated = comments.filter(comment =>
    comment.user?.login === 'github-actions[bot]'
    && comment.body?.includes('<!-- ironshade-independent-review:trusted-main-actions:v1 -->'))
    .map(comment => {
      const match = comment.body?.match(/```json\s*([\s\S]*?)\s*```/);
      try { return match ? JSON.parse(match[1]) : null; } catch { return null; }
    }).filter(x => x?.candidateSha === CANDIDATE && x.taskId === 'AO-15');
  assert(validated.length > 0, 'no exact-head trusted Copilot review');
  const latest = validated.at(-1);
  assert.equal(latest.reviewerKind, 'trusted-main-copilot-actions');
  assert.equal(latest.verdict, 'fail', 'bootstrap requires the specifically documented circular finding');
  assert.equal(latest.technicalRunId, technicalRunId);
  assert(Array.isArray(latest.findings) && latest.findings.length === 1,
    'unreviewed additional finding blocks bootstrap');
  const finding = latest.findings[0];
  assert.equal(finding.severity, 'major');
  assert(/observer.*(implementation|source)|implementation.*observer/i.test(finding.summary),
    'Copilot finding is not the expected observer self-update conflict');
  assert(Array.isArray(latest.proofChecks) && latest.proofChecks.every(p =>
    p.proofId === 'independent-review-verdict' || p.status === 'credible'),
    'non-review proofs disputed by Copilot');
  return latest;
}

function validateRun(runs, workflow, event = 'pull_request') {
  const matched = runs.filter(x => x.head_sha === CANDIDATE
    && x.event === event
    && (x.pull_requests ?? []).some(p => p.number === PR));
  assert.equal(matched.length, 1, 'expected one exact-head run for ' + workflow);
  return matched[0];
}

async function promote({ request, event, checkoutSha }) {
  assert(authorizedComment(event), 'only an exact authenticated owner comment can promote');
  const ref = await request('GET', '/git/ref/heads/main');
  const baseSha = ref.object?.sha;
  assert(/^[a-f0-9]{40}$/.test(baseSha ?? ''), 'malformed trusted-main SHA');
  assert.equal(checkoutSha, baseSha, 'checkout differs from immutable trusted main');
  const pull = await request('GET', '/pulls/' + PR);
  assert.equal(pull.state, 'open');
  assert.equal(pull.head?.sha, CANDIDATE);
  assert.equal(pull.head?.repo?.full_name, OWNER + '/' + REPO);
  assert.equal(pull.base?.ref, 'main');
  const old = await request('GET', '/git/commits/' + baseSha);
  const next = await request('GET', '/git/commits/' + CANDIDATE);
  const [baseTree, candidateTree] = await Promise.all([
    request('GET', '/git/trees/' + old.tree.sha + '?recursive=1'),
    request('GET', '/git/trees/' + next.tree.sha + '?recursive=1'),
  ]);
  pinnedObject(baseTree, OBSERVER, '100644 blob ' + BASE_OBSERVER);
  pinnedObject(candidateTree, OBSERVER, '100644 blob ' + REVIEWED_OBSERVER);
  pinnedObject(baseTree, WORKFLOW, treeEntry(baseTree, WORKFLOW).mode + ' blob ' + treeEntry(baseTree, WORKFLOW).sha);
  pinnedObject(baseTree, HELPER, treeEntry(baseTree, HELPER).mode + ' blob ' + treeEntry(baseTree, HELPER).sha);
  assert.equal(treeEntry(baseTree, WORKFLOW).mode, '100644');
  assert.equal(treeEntry(baseTree, HELPER).mode, '100644');
  const candidateRuns = await request('GET', '/actions/workflows/pr-candidate.yml/runs?event=pull_request&head_sha=' + CANDIDATE + '&per_page=100');
  const technical = validateRun(candidateRuns.workflow_runs ?? [], 'PR Candidate Verification');
  const jobs = await request('GET', '/actions/runs/' + technical.id + '/jobs?per_page=100');
  assert.equal(jobs.total_count, jobs.jobs?.length, 'refuse truncated technical jobs');
  provedJobs(jobs.jobs);
  const orchestrationRuns = await request('GET', '/actions/workflows/agent-orchestration.yml/runs?event=pull_request&head_sha=' + CANDIDATE + '&per_page=100');
  const orchestration = validateRun(orchestrationRuns.workflow_runs ?? [], 'Agent Orchestration');
  assert.equal(orchestration.conclusion, 'success');
  const observerRuns = await request('GET', '/actions/workflows/ev9-trusted-pr-candidate-observer.yml/runs?event=pull_request&head_sha=' + CANDIDATE + '&per_page=100');
  const observer = validateRun(observerRuns.workflow_runs ?? [], 'EV-9 observer self-test');
  assert.equal(observer.conclusion, 'success');
  const comments = await request('GET', '/issues/' + PR + '/comments?per_page=100');
  assert(comments.length < 100, 'refuse truncated review comments');
  const review = reviewerEvidence(comments, technical.id);

  // No candidate code is executed, ever. Promote one exact reviewed blob and
  // atomically remove the privileged one-use workflow and its helper.
  const tree = await request('POST', '/git/trees', {
    base_tree: old.tree.sha,
    tree: [
      { path: OBSERVER, mode: '100644', type: 'blob', sha: REVIEWED_OBSERVER },
      { path: WORKFLOW, sha: null },
      { path: HELPER, sha: null },
    ],
  });
  const commit = await request('POST', '/git/commits', {
    message: 'AO-16 trusted one-shot bootstrap: pin reviewed AO-15 observer source\n\n'
      + 'Authorized by ' + OWNER + '; AO-15 candidate ' + CANDIDATE
      + '; CI run ' + technical.id + '; Copilot finding ' + review.sourceRunId
      + '. The bootstrap workflow and helper are removed atomically.',
    tree: tree.sha,
    parents: [baseSha],
  });
  const updated = await request('PATCH', '/git/refs/heads/main', { sha: commit.sha, force: false });
  assert.equal(updated.object?.sha, commit.sha, 'trusted main promotion not confirmed');
  console.log('AO16_TRUSTED_BOOTSTRAP_PASS main=' + commit.sha + ' source='
    + REVIEWED_OBSERVER + ' previous=' + baseSha + ' ci=' + technical.id);
  return commit.sha;
}

function selfTest() {
  const event = {
    action: 'created', issue: { number: PR, pull_request: { url: 'x' } },
    comment: { body: COMMAND, user: { login: OWNER }, author_association: 'OWNER' },
    sender: { login: OWNER }, repository: { full_name: OWNER + '/' + REPO },
  };
  assert(authorizedComment(event));
  for (const patch of [
    { action: 'edited' }, { issue: { number: 437, pull_request: { url: 'x' } } },
    { comment: { ...event.comment, body: '/ao16-promote-observer 438 attacker' } },
    { comment: { ...event.comment, user: { login: 'attacker' } } },
    { sender: { login: 'attacker' } },
    { comment: { ...event.comment, author_association: 'NONE' } },
    { repository: { full_name: 'attacker/fork' } },
  ]) assert.equal(authorizedComment({ ...event, ...patch }), false);
  const jobs = ['Candidate Build and Full Verification','Independent Review Context',
    'Android PR / Android PR APK','Android PR / Android PR API 35 Smoke',
    'Android PR / Android PR API 36 Large Screen','Android PR / Android PR Verification',
    'Browser E2E','PR Candidate Verification'].map(name => ({
    name, conclusion: name === 'PR Candidate Verification' ? 'failure' : 'success',
    steps: name === 'PR Candidate Verification' ? [
      { name: 'Require exact candidate technical gates', conclusion: 'success' },
      { name: 'Require actual exact-SHA independent-review pass', conclusion: 'failure' },
    ] : [],
  }));
  provedJobs(jobs);
  assert.throws(() => provedJobs(jobs.map(j => j.name === 'Android PR / Android PR API 35 Smoke'
    ? { ...j, conclusion: 'failure' } : j)));
  assert.throws(() => provedJobs(jobs.map(j => j.name === 'PR Candidate Verification'
    ? { ...j, steps: [...j.steps, { name: 'Different failure', conclusion: 'failure' }] } : j)));
  const pinTree = { truncated: false, tree: [{ path: OBSERVER, mode: '100644', type: 'blob', sha: BASE_OBSERVER }] };
  pinnedObject(pinTree, OBSERVER, '100644 blob ' + BASE_OBSERVER);
  assert.throws(() => pinnedObject(pinTree, OBSERVER, '100755 blob ' + BASE_OBSERVER));
  assert.throws(() => pinnedObject({ ...pinTree, truncated: true }, OBSERVER, '100644 blob ' + BASE_OBSERVER));
  const goodReview = {
    taskId: 'AO-15', candidateSha: CANDIDATE, reviewerKind: 'trusted-main-copilot-actions',
    verdict: 'fail', technicalRunId: 11, sourceRunId: 22,
    findings: [{ severity: 'major', summary: 'Observer implementation unchanged check blocks policy' }],
    proofChecks: [{ proofId: 'candidate-ci', status: 'credible' },
      { proofId: 'independent-review-verdict', status: 'insufficient' }],
  };
  const comment = r => [{ user: { login: 'github-actions[bot]' },
    body: '<!-- ironshade-independent-review:trusted-main-actions:v1 -->\n```json\n' + JSON.stringify(r) + '\n```' }];
  reviewerEvidence(comment(goodReview), 11);
  assert.throws(() => reviewerEvidence(comment({ ...goodReview, findings: [{severity:'major',summary:'Unrelated trust flaw'}] }), 11));
  assert.throws(() => reviewerEvidence(comment({ ...goodReview, proofChecks:[{proofId:'candidate-ci',status:'insufficient'}] }), 11));
  assert.throws(() => reviewerEvidence(comment(goodReview), 12));
  console.log('AO16_BOOTSTRAP_SELF_TEST_PASS unauthorized=7 source-bound=true technical-gates=true reviewer-bound=true');
}

async function main() {
  const command = process.argv[2];
  if (command === 'self-test') { selfTest(); return; }
  assert.equal(command, 'promote', 'usage: ao16-trusted-observer-bootstrap.mjs self-test|promote');
  assert.equal(process.env.GITHUB_REPOSITORY, OWNER + '/' + REPO);
  const token = process.env.GITHUB_TOKEN;
  assert(token, 'trusted token required');
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const checkoutSha = execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  async function request(method, path, data) {
    const response = await fetch(REPO_URL + path, {
      method,
      headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28', ...(data ? {'content-type':'application/json'} : {}) },
      ...(data ? {body: JSON.stringify(data)} : {}),
    });
    assert(response.ok, 'GitHub ' + method + ' ' + path + ' status ' + response.status);
    return response.json();
  }
  await promote({ request, event, checkoutSha });
}
await main();
