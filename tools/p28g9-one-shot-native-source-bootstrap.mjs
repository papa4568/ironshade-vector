#!/usr/bin/env node
// P28-G9: one-use, trusted-main-only promotion for three exact reviewed native
// consumer blobs. Never execute candidate PR code with a writable credential.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OWNER = 'papa4568';
const REPO = 'ironshade-vector';
const PR = 445;
const CANDIDATE = 'c7bc451815980826946a2482be1e51b5987ae498';
const HELPER = 'tools/p28g9-one-shot-native-source-bootstrap.mjs';
const COMMAND = '/p28g9-promote-native 445 ' + CANDIDATE;
const FILES = Object.freeze([
  { path: 'scripts/configure-android.mjs', before: 'a1f4241307f71376ac2a97382a5063fdba112ad9', after: '00989908366d841e609f60563e64c59b6bf0eb82' },
  { path: 'scripts/android-runtime-smoke.mjs', before: 'b00162ca45d5e65678b6e249ca03cc62d216a557', after: '6409efe5f7e4fdbb90922d7d40b9771be3b22598' },
  { path: 'tests/android-fast-smoke-contract.mjs', before: '740101f7993649dc0c1cb4f9d807174b4bd29760', after: 'a506c7084fd63cd5a289e5b0029b8759f14bb43e' },
]);
const SUCCESS_JOBS = Object.freeze([
  'Candidate Build and Full Verification',
  'Independent Review Context',
  'Android PR / Android PR APK',
  'Android PR / Android PR API 35 Smoke',
  'Android PR / Android PR API 36 Large Screen',
  'Android PR / Android PR Verification',
  'Browser E2E / browser-e2e (desktop)',
  'Browser E2E / browser-e2e (mobile-landscape)',
]);
const REPOSITORY_URL = 'https://api.github.com/repos/' + OWNER + '/' + REPO;

function authorized(event) {
  return event?.action === 'created'
    && event?.repository?.full_name === OWNER + '/' + REPO
    && event?.issue?.number === PR
    && Boolean(event?.issue?.pull_request)
    && event?.sender?.login === OWNER
    && event?.comment?.user?.login === OWNER
    && event?.comment?.author_association === 'OWNER'
    && event?.comment?.body === COMMAND;
}

function entry(tree, path) {
  assert.equal(tree?.truncated, false, 'incomplete Git tree not permitted');
  const found = (tree.tree || []).filter(x => x.path === path);
  assert.equal(found.length, 1, 'missing/ambiguous Git tree entry: ' + path);
  assert.equal(found[0].mode, '100644', 'nonregular file: ' + path);
  assert.equal(found[0].type, 'blob', 'nonblob: ' + path);
  return found[0].sha;
}

function validateProtectedObjects(base, candidate) {
  const expected = new Map(FILES.map(x => [x.path, x]));
  for (const file of FILES) {
    assert.equal(entry(base, file.path), file.before, 'trusted main protected object drift: ' + file.path);
    assert.equal(entry(candidate, file.path), file.after, 'PR protected object not reviewed: ' + file.path);
  }
  const protectedPaths = new Set([
    ...(base.tree || []).map(x => x.path).filter(x => x.startsWith('scripts/')),
    ...(candidate.tree || []).map(x => x.path).filter(x => x.startsWith('scripts/')),
    'tests/android-fast-smoke-contract.mjs',
  ]);
  for (const path of protectedPaths) {
    const a = (base.tree || []).find(x => x.path === path);
    const b = (candidate.tree || []).find(x => x.path === path);
    const unchanged = JSON.stringify(a && [a.mode, a.type, a.sha])
      === JSON.stringify(b && [b.mode, b.type, b.sha]);
    assert(unchanged || expected.has(path), 'unreviewed protected change: ' + path);
  }
  assert.equal(expected.size, 3);
}

function uniqueJob(jobs, name) {
  const found = jobs.filter(x => x.name === name);
  assert.equal(found.length, 1, 'unexpected job multiplicity: ' + name);
  return found[0];
}

function assertTechnicalJobs(jobs) {
  for (const name of SUCCESS_JOBS) {
    const job = uniqueJob(jobs, name);
    assert.equal(job.status, 'completed', 'unfinished required job: ' + name);
    assert.equal(job.conclusion, 'success', 'failed required job: ' + name);
  }
  const final = uniqueJob(jobs, 'PR Candidate Verification');
  assert.equal(final.status, 'completed');
  assert(['success', 'failure'].includes(final.conclusion));
  // No failure other than the existing trusted-source/review final gate is
  // excused; the actual product and Android gates above must already succeed.
  assert(jobs.every(job => job.conclusion !== 'failure'
    || job.name === 'PR Candidate Verification'), 'unexpected CI failure');
}

function exactRun(runs, expectedName) {
  const matches = runs.filter(x => x.head_sha === CANDIDATE
    && x.event === 'pull_request'
    && (x.pull_requests || []).some(p => p.number === PR));
  assert.equal(matches.length, 1, 'missing/ambiguous exact-SHA ' + expectedName + ' run');
  assert.equal(matches[0].status, 'completed');
  return matches[0];
}

async function promotion({ event, request, checkoutSha }) {
  assert(authorized(event), 'only an exact owner-authored command can authorize promotion');
  const ref = await request('GET', '/git/ref/heads/main');
  const baseSha = ref.object?.sha;
  assert(/^[0-9a-f]{40}$/.test(baseSha || ''));
  assert.equal(checkoutSha, baseSha, 'trusted-main race or checkout mismatch');
  const pr = await request('GET', '/pulls/' + PR);
  assert.equal(pr.state, 'open');
  assert.equal(pr.draft, true, 'promotion must not masquerade as product merge');
  assert.equal(pr.head?.sha, CANDIDATE, 'candidate SHA moved');
  assert.equal(pr.head?.repo?.full_name, OWNER + '/' + REPO);
  assert.equal(pr.base?.ref, 'main');
  const [mainCommit, candidateCommit] = await Promise.all([
    request('GET', '/git/commits/' + baseSha),
    request('GET', '/git/commits/' + CANDIDATE),
  ]);
  const [baseTree, candidateTree] = await Promise.all([
    request('GET', '/git/trees/' + mainCommit.tree.sha + '?recursive=1'),
    request('GET', '/git/trees/' + candidateCommit.tree.sha + '?recursive=1'),
  ]);
  validateProtectedObjects(baseTree, candidateTree);
  assert.equal(entry(baseTree, HELPER).length, 40, 'trusted helper not installed on main');

  const ciRuns = await request('GET', '/actions/workflows/pr-candidate.yml/runs?event=pull_request&head_sha=' + CANDIDATE + '&per_page=100');
  const technical = exactRun(ciRuns.workflow_runs || [], 'PR candidate');
  const jobResult = await request('GET', '/actions/runs/' + technical.id + '/jobs?per_page=100');
  assert.equal(jobResult.total_count, jobResult.jobs?.length, 'truncated candidate jobs');
  assertTechnicalJobs(jobResult.jobs);
  const visualRuns = await request('GET', '/actions/workflows/p28-g9-parallax-visual-qa.yml/runs?event=pull_request&head_sha=' + CANDIDATE + '&per_page=100');
  const visual = exactRun(visualRuns.workflow_runs || [], 'G9 visual');
  assert.equal(visual.conclusion, 'success', 'real PNG and Copilot visual acceptance not successful');
  const visualJobResult = await request('GET', '/actions/runs/' + visual.id + '/jobs?per_page=100');
  assert.equal(visualJobResult.total_count, visualJobResult.jobs?.length);
  for (const name of ['G9 Real Android Gameplay Pixels and Provenance', 'G9 Independent Copilot PNG Inspection']) {
    assert.equal(uniqueJob(visualJobResult.jobs, name).conclusion, 'success',
      'visual evidence gate failed: ' + name);
  }
  // The transaction updates precisely the reviewed native source objects and
  // deletes the privileged helper atomically. The retained workflow cannot
  // run another promotion after its helper is absent.
  const tree = await request('POST', '/git/trees', {
    base_tree: mainCommit.tree.sha,
    tree: [
      ...FILES.map(file => ({ path: file.path, mode: '100644', type: 'blob', sha: file.after })),
      { path: HELPER, mode: '100644', type: 'blob', sha: null },
    ],
  });
  const commit = await request('POST', '/git/commits', {
    message: 'P28-G9: promote three independently reviewed native consumer blobs\n\n'
      + 'Owner-authenticated one-shot trusted main promotion of PR #' + PR
      + ' at ' + CANDIDATE + ', after exact-SHA Android and Copilot visual proof. '
      + 'Privileged helper deleted atomically; no observer or workflow change.',
    tree: tree.sha,
    parents: [baseSha],
  });
  const updated = await request('PATCH', '/git/refs/heads/main', {
    sha: commit.sha, force: false,
  });
  assert.equal(updated.object?.sha, commit.sha);
  console.log('P28G9_ONE_SHOT_NATIVE_PROMOTION_PASS candidate=' + CANDIDATE
    + ' previousMain=' + baseSha + ' nextMain=' + commit.sha);
  return commit.sha;
}

async function selfTest() {
  const event = {
    action: 'created', issue: { number: PR, pull_request: {} },
    comment: { body: COMMAND, user: { login: OWNER }, author_association: 'OWNER' },
    sender: { login: OWNER }, repository: { full_name: OWNER + '/' + REPO },
  };
  assert(authorized(event));
  for (const mutation of [
    { action: 'edited' }, { issue: { number: 444, pull_request: {} } },
    { comment: { ...event.comment, body: '/p28g9-promote-native 445 wrong' } },
    { comment: { ...event.comment, user: { login: 'attacker' } } },
    { sender: { login: 'attacker' } }, { repository: { full_name: 'attacker/fork' } },
    { comment: { ...event.comment, author_association: 'COLLABORATOR' } },
  ]) assert.equal(authorized({ ...event, ...mutation }), false);

  const old = 'a'.repeat(40), candidateTreeSha = 'b'.repeat(40), oldTree = 'c'.repeat(40);
  const nextTree = 'd'.repeat(40), nextCommit = 'e'.repeat(40);
  const beforeFiles = FILES.map(x => ({ path: x.path, mode: '100644', type: 'blob', sha: x.before }));
  const afterFiles = FILES.map(x => ({ path: x.path, mode: '100644', type: 'blob', sha: x.after }));
  const baseTree = { truncated: false, tree: [...beforeFiles,
    { path: HELPER, mode: '100644', type: 'blob', sha: 'f'.repeat(40) },
    { path: 'scripts/unchanged.mjs', mode: '100644', type: 'blob', sha: '8'.repeat(40) }] };
  const candidateTree = { truncated: false, tree: [...afterFiles,
    { path: 'scripts/unchanged.mjs', mode: '100644', type: 'blob', sha: '8'.repeat(40) }] };
  validateProtectedObjects(baseTree, candidateTree);
  for (const mutated of [
    { ...candidateTree, tree: [...candidateTree.tree, { path: 'scripts/other.mjs', mode: '100644', type: 'blob', sha: '9'.repeat(40) }] },
    { ...candidateTree, tree: candidateTree.tree.map(x => x.path === FILES[0].path ? { ...x, sha: '9'.repeat(40) } : x) },
    { ...candidateTree, tree: candidateTree.tree.map(x => x.path === FILES[2].path ? { ...x, mode: '100755' } : x) },
    { ...candidateTree, truncated: true },
  ]) assert.throws(() => validateProtectedObjects(baseTree, mutated));
  const jobs = [...SUCCESS_JOBS, 'PR Candidate Verification'].map(name => ({
    name, status: 'completed', conclusion: name === 'PR Candidate Verification' ? 'failure' : 'success',
  }));
  assertTechnicalJobs(jobs);
  for (const bad of [
    jobs.map(j => j.name === 'Android PR / Android PR API 35 Smoke' ? { ...j, conclusion: 'failure' } : j),
    jobs.map(j => j.name === 'Browser E2E / browser-e2e (desktop)' ? { ...j, conclusion: 'failure' } : j),
    [...jobs, { name: 'Extra failed job', conclusion: 'failure' }],
  ]) assert.throws(() => assertTechnicalJobs(bad));

  function mock({ e = event, tree = candidateTree, jobList = jobs, visualOutcome = 'success', base = baseTree } = {}) {
    const writes = [];
    async function request(method, path, data) {
      if (method !== 'GET') {
        writes.push({ method, path, data });
        if (path === '/git/trees') {
          assert.equal(method, 'POST');
          assert.equal(data.base_tree, oldTree);
          assert.deepEqual(data.tree, [
            ...FILES.map(f => ({ path: f.path, mode: '100644', type: 'blob', sha: f.after })),
            { path: HELPER, mode: '100644', type: 'blob', sha: null },
          ]);
          return { sha: nextTree };
        }
        if (path === '/git/commits') {
          assert.equal(method, 'POST');
          assert.equal(data.tree, nextTree);
          assert.deepEqual(data.parents, [old]);
          return { sha: nextCommit };
        }
        if (path === '/git/refs/heads/main') {
          assert.equal(method, 'PATCH');
          assert.deepEqual(data, { sha: nextCommit, force: false });
          return { object: { sha: nextCommit } };
        }
        throw new Error('unreviewed mutation ' + method + ' ' + path);
      }
      if (path === '/git/ref/heads/main') return { object: { sha: old } };
      if (path === '/pulls/' + PR) return { state: 'open', draft: true,
        head: { sha: CANDIDATE, repo: { full_name: OWNER + '/' + REPO } }, base: { ref: 'main' } };
      if (path === '/git/commits/' + old) return { tree: { sha: oldTree } };
      if (path === '/git/commits/' + CANDIDATE) return { tree: { sha: candidateTreeSha } };
      if (path === '/git/trees/' + oldTree + '?recursive=1') return base;
      if (path === '/git/trees/' + candidateTreeSha + '?recursive=1') return tree;
      if (path.startsWith('/actions/workflows/pr-candidate.yml/runs?')) return {
        workflow_runs: [{ id: 101, status: 'completed', head_sha: CANDIDATE, event: 'pull_request', pull_requests: [{ number: PR }] }] };
      if (path === '/actions/runs/101/jobs?per_page=100') return { total_count: jobList.length, jobs: jobList };
      if (path.startsWith('/actions/workflows/p28-g9-parallax-visual-qa.yml/runs?')) return {
        workflow_runs: [{ id: 102, status: 'completed', conclusion: visualOutcome,
          head_sha: CANDIDATE, event: 'pull_request', pull_requests: [{ number: PR }] }] };
      if (path === '/actions/runs/102/jobs?per_page=100') return { total_count: 2, jobs: [
        { name: 'G9 Real Android Gameplay Pixels and Provenance', conclusion: 'success' },
        { name: 'G9 Independent Copilot PNG Inspection', conclusion: 'success' },
      ] };
      throw new Error('unknown external dependency ' + path);
    }
    return { request, writes, event: e };
  }
  const good = mock();
  await promotion({ ...good, checkoutSha: old });
  assert.deepEqual(good.writes.map(x => x.method + ' ' + x.path), [
    'POST /git/trees', 'POST /git/commits', 'PATCH /git/refs/heads/main',
  ]);
  for (const options of [
    { e: { ...event, sender: { login: 'attacker' } } },
    { tree: { ...candidateTree, tree: [...candidateTree.tree,
      { path: 'scripts/unauthorized.sh', mode: '100644', type: 'blob', sha: '9'.repeat(40) }] } },
    { jobList: jobs.map(j => j.name === 'Android PR / Android PR API 35 Smoke' ? { ...j, conclusion: 'failure' } : j) },
    { visualOutcome: 'failure' },
    { base: { ...baseTree, tree: baseTree.tree.map(x => x.path === FILES[0].path ? { ...x, sha: '9'.repeat(40) } : x) } },
  ]) {
    const f = mock(options);
    await assert.rejects(() => promotion({ ...f, checkoutSha: old }));
    assert.equal(f.writes.length, 0, 'failing promotion attempted a repository write');
  }
  const raced = mock();
  await assert.rejects(() => promotion({ ...raced, checkoutSha: nextCommit }));
  assert.equal(raced.writes.length, 0);
  console.log('P28G9_ONE_SHOT_BOOTSTRAP_SELF_TEST_PASS cases=auth+pin+tree+CI+visual+nonforce+retirement');
}

async function githubRequest(method, path, data) {
  const token = process.env.GITHUB_TOKEN;
  assert(token, 'GitHub token is required for owner-triggered promotion');
  const url = REPOSITORY_URL + path;
  const response = await fetch(url, {
    method: method === 'TEXT' ? 'GET' : method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  assert.equal(response.status, method === 'POST' ? 201 : 200,
    'GitHub operation failed closed: ' + method + ' ' + path + ' status=' + response.status);
  return response.json();
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'promote') {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await promotion({ event, request: githubRequest, checkoutSha });
} else throw new Error('Usage: p28g9-one-shot-native-source-bootstrap.mjs <self-test|promote>');
