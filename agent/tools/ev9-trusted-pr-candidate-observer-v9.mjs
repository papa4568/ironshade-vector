import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LEGACY_ANCHOR_SHA = 'ad4ec884ba2aa262b06f91a03411a972550cbb87';
const EV18_REFERENCE_SHA = 'b37d564c773e47df0dcc65a6367384037ea6d963';
const PR_CANDIDATE_PATH = '.github/workflows/pr-candidate.yml';
const BROWSER_WORKFLOW_PATH = '.github/workflows/browser-e2e.yml';
const ANDROID_WORKFLOW_PATH = '.github/workflows/pr-android-apk.yml';
const EV18_MARKER = 'Prepare EV-18 closed proof inputs';
const V8_PATH = fileURLToPath(new URL('./ev9-trusted-pr-candidate-observer-v8.mjs', import.meta.url));

const EV18_TRANSITION_PATHS = [
  '.github/workflows/ev18-proof-cache-promotion.yml',
  '.github/workflows/ev21-proof-cache-closure-calibration.yml',
  '.github/workflows/pr-candidate.yml',
  'AGENTS.md',
  'agent/proof-cache-promotion-policy.json',
  'agent/proof-cache-promotion-policy.schema.json',
  'agent/tests/ci-proof-reuse.mjs',
  'agent/tests/pr-candidate-head-observer.mjs',
  'agent/tests/proof-cache-promotion.mjs',
  'agent/tools/pr-candidate-head-observer.mjs',
  'agent/tools/proof-cache-promotion.mjs',
  'docs/experimental-verification-roadmap.md',
].sort((a, b) => a.localeCompare(b));

const EV18_AGENT_TRANSITION_PATHS = new Set(EV18_TRANSITION_PATHS.filter(path => path.startsWith('agent/')));
const TRUSTED_CONSUMER_DEPENDENCIES = [
  'scripts',
  'agent/tools/candidate-artifact.mjs',
  'tests/android-fast-smoke-contract.mjs',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'capacitor.config.ts',
];
const EV9_LIVE_AGENT_PATHS = new Set([
  'agent/evidence-independence-policy.json',
  'agent/evidence-independence.json',
  'agent/tests/evidence-independence-promotion.mjs',
  'agent/tests/pr-candidate-head-observer.mjs',
  'agent/tools/evidence-independence-gate.mjs',
  'agent/tools/evidence-independence-promotion-gate.mjs',
  'agent/tools/pr-candidate-build-surface.mjs',
  'agent/tools/pr-candidate-head-observer.mjs',
]);

function ok(value, message) {
  if (!value) throw new Error(message);
}

function git(args, { allowFailure = false } = {}) {
  if (allowFailure) {
    return spawnSync('/usr/bin/git', args, {
      encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin', HOME: '/tmp' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  return execFileSync('/usr/bin/git', args, {
    encoding: 'utf8',
    env: { PATH: '/usr/bin:/bin', HOME: '/tmp' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitBlob(revision, path) {
  return git(['rev-parse', `${revision}:${path}`]);
}

function gitText(revision, path) {
  return git(['show', `${revision}:${path}`]);
}

function gitPathRefs(revision, paths) {
  return Object.fromEntries(paths.map(path => [path, gitBlob(revision, path)]));
}

function changedPaths(baseSha, candidateSha) {
  const output = execFileSync('/usr/bin/git', ['diff', '--name-only', '-z', baseSha, candidateSha, '--'], {
    encoding: 'buffer',
    env: { PATH: '/usr/bin:/bin', HOME: '/tmp' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output.toString('utf8').split('\0').filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function isAncestor(ancestor, descendant) {
  const result = git(['merge-base', '--is-ancestor', ancestor, descendant], { allowFailure: true });
  return result.status === 0;
}

function allowedAgentMutation(path) {
  return path === 'agent/task-graph.json'
    || /^agent\/tools\/ev9-trusted-pr-candidate-observer(?:-v\d+)?\.mjs$/.test(path)
    || EV9_LIVE_AGENT_PATHS.has(path);
}

function gitAgentRefs(revision, { transition = false } = {}) {
  const tree = execFileSync('/usr/bin/git', ['ls-tree', '-r', '-z', revision, '--', 'agent'], {
    encoding: 'buffer',
    env: { PATH: '/usr/bin:/bin', HOME: '/tmp' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString('utf8');
  const refs = {};
  for (const entry of tree.split('\0').filter(Boolean)) {
    const match = entry.match(/^\d+\s+\w+\s+([a-f0-9]{40})\t(.+)$/s);
    ok(match, `unexpected git ls-tree entry: ${entry}`);
    const [, objectSha, path] = match;
    if (allowedAgentMutation(path)) continue;
    if (transition && EV18_AGENT_TRANSITION_PATHS.has(path)) continue;
    refs[path] = objectSha;
  }
  return refs;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function check(id, pass, evidence) {
  return { id, pass: Boolean(pass), evidence };
}

function referenceAvailable() {
  return git(['cat-file', '-e', `${EV18_REFERENCE_SHA}^{commit}`], { allowFailure: true }).status === 0;
}

function trustedMode(trustedBaseSha) {
  const baseBlob = gitBlob(trustedBaseSha, PR_CANDIDATE_PATH);
  const legacyBlob = gitBlob(LEGACY_ANCHOR_SHA, PR_CANDIDATE_PATH);
  if (baseBlob === legacyBlob) return 'legacy';
  if (referenceAvailable() && baseBlob === gitBlob(EV18_REFERENCE_SHA, PR_CANDIDATE_PATH)) return 'ev18-steady';
  return 'unknown';
}

function transitionChecks({ trustedBaseSha, candidateSha }) {
  const changed = changedPaths(trustedBaseSha, candidateSha);
  const pinned = referenceAvailable()
    ? Object.fromEntries(EV18_TRANSITION_PATHS.map(path => [path, gitBlob(candidateSha, path) === gitBlob(EV18_REFERENCE_SHA, path)]))
    : Object.fromEntries(EV18_TRANSITION_PATHS.map(path => [path, false]));
  const baseDeps = gitPathRefs(trustedBaseSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const candidateDeps = gitPathRefs(candidateSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const checks = [
    check('ev18-reference-object-present', referenceAvailable(), `reviewed EV-18 reference commit ${EV18_REFERENCE_SHA} must be present in the fetched object graph`),
    check('ev18-reference-is-ancestor', referenceAvailable() && isAncestor(EV18_REFERENCE_SHA, candidateSha), 'the synchronized EV-18 candidate must retain the reviewed reference commit as an ancestor'),
    check('ev18-transition-path-set-exact', sameJson(changed, EV18_TRANSITION_PATHS), `candidate tree diff must be exactly the reviewed EV-18 paths; actual=${changed.join(',')}`),
    check('ev18-transition-pinned-objects', Object.values(pinned).every(Boolean), `every EV-18 transition path must match the reviewed ${EV18_REFERENCE_SHA} Git object exactly`),
    check('ev18-browser-workflow-unchanged', gitBlob(candidateSha, BROWSER_WORKFLOW_PATH) === gitBlob(trustedBaseSha, BROWSER_WORKFLOW_PATH), 'browser consumer workflow must remain trusted-base identical'),
    check('ev18-android-workflow-unchanged', gitBlob(candidateSha, ANDROID_WORKFLOW_PATH) === gitBlob(trustedBaseSha, ANDROID_WORKFLOW_PATH), 'Android consumer workflow must remain trusted-base identical'),
    check('ev18-source-bound-dependencies-unchanged', sameJson(candidateDeps, baseDeps), 'source-bound consumer dependencies must remain trusted-base identical'),
    check('ev18-nontransition-agent-boundary-unchanged', sameJson(gitAgentRefs(candidateSha, { transition: true }), gitAgentRefs(trustedBaseSha, { transition: true })), 'all protected agent objects outside the exact EV-18 transition set must remain trusted-base identical'),
    check('ev18-candidate-workflow-marker', gitText(candidateSha, PR_CANDIDATE_PATH).includes(EV18_MARKER), 'reviewed EV-18 candidate producer marker must be present'),
  ];
  return { checks, changed, pinned };
}

function steadyChecks({ trustedBaseSha, candidateSha }) {
  const baseDeps = gitPathRefs(trustedBaseSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const candidateDeps = gitPathRefs(candidateSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const expectedWorkflowBlob = gitBlob(EV18_REFERENCE_SHA, PR_CANDIDATE_PATH);
  return {
    checks: [
      check('ev18-steady-trusted-base-pinned', gitBlob(trustedBaseSha, PR_CANDIDATE_PATH) === expectedWorkflowBlob, 'trusted main must retain the reviewed EV-18 producer Git object'),
      check('ev18-steady-candidate-workflow-unchanged', gitBlob(candidateSha, PR_CANDIDATE_PATH) === expectedWorkflowBlob, 'candidate may not redefine the trusted EV-18 producer without a new observer bootstrap'),
      check('ev18-steady-browser-workflow-unchanged', gitBlob(candidateSha, BROWSER_WORKFLOW_PATH) === gitBlob(trustedBaseSha, BROWSER_WORKFLOW_PATH), 'browser consumer workflow must remain trusted-base identical'),
      check('ev18-steady-android-workflow-unchanged', gitBlob(candidateSha, ANDROID_WORKFLOW_PATH) === gitBlob(trustedBaseSha, ANDROID_WORKFLOW_PATH), 'Android consumer workflow must remain trusted-base identical'),
      check('ev18-steady-source-bound-dependencies-unchanged', sameJson(candidateDeps, baseDeps), 'source-bound consumer dependencies must remain trusted-base identical'),
      check('ev18-steady-protected-agent-boundary-unchanged', sameJson(gitAgentRefs(candidateSha), gitAgentRefs(trustedBaseSha)), 'protected agent objects must remain trusted-base identical outside the established EV-9 mutation allowlist'),
    ],
  };
}

function reportFor({ mode, trustedBaseSha, candidateSha, checks, details = {} }) {
  const failedCheckIds = checks.filter(entry => !entry.pass).map(entry => entry.id);
  return {
    schema: 'ironshade-ev9-trusted-pr-candidate-observer:v9',
    mode,
    trustedBaseSha,
    candidateSha,
    legacyAnchorSha: LEGACY_ANCHOR_SHA,
    ev18ReferenceSha: EV18_REFERENCE_SHA,
    checks,
    failedCheckIds,
    pass: failedCheckIds.length === 0,
    candidatePassGranted: false,
    ...details,
  };
}

function writeOptionalOutput(report) {
  const index = process.argv.indexOf('--output');
  if (index < 0) return;
  const path = process.argv[index + 1];
  ok(path, '--output requires a path');
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function runV8(command) {
  const result = spawnSync(process.execPath, [V8_PATH, command], {
    env: process.env,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function pureTransitionCalibration() {
  const approved = [...EV18_TRANSITION_PATHS];
  const baseline = {
    changed: approved,
    pinned: approved.map(() => true),
    browserSame: true,
    androidSame: true,
    depsSame: true,
    agentsSame: true,
  };
  const passes = snapshot => sameJson(snapshot.changed, approved)
    && snapshot.pinned.every(Boolean)
    && snapshot.browserSame
    && snapshot.androidSame
    && snapshot.depsSame
    && snapshot.agentsSame;
  assert.equal(passes(baseline), true, 'EV-18 transition baseline must pass');
  const attacks = [
    { id: 'unexpected-path', mutate: value => value.changed.push('src/unreviewed.ts') },
    { id: 'pinned-object-drift', mutate: value => { value.pinned[0] = false; } },
    { id: 'browser-drift', mutate: value => { value.browserSame = false; } },
    { id: 'android-drift', mutate: value => { value.androidSame = false; } },
    { id: 'dependency-drift', mutate: value => { value.depsSame = false; } },
    { id: 'agent-drift', mutate: value => { value.agentsSame = false; } },
  ];
  for (const attack of attacks) {
    const sample = structuredClone(baseline);
    attack.mutate(sample);
    assert.equal(passes(sample), false, `trusted v9 calibration must reject ${attack.id}`);
  }
  return attacks.length;
}

function selfTest() {
  assert.deepEqual([...new Set(EV18_TRANSITION_PATHS)], EV18_TRANSITION_PATHS, 'EV-18 transition path set must be sorted and unique');
  const attackCount = pureTransitionCalibration();
  const liveWorkflow = gitText('HEAD', PR_CANDIDATE_PATH);
  if (!liveWorkflow.includes(EV18_MARKER)) {
    runV8('self-test');
    console.log(`EV9_TRUSTED_V9_SELF_TEST_PASS mode=legacy-v8 transitionAttacks=${attackCount}`);
    return;
  }
  ok(referenceAvailable(), `EV-18 reference commit ${EV18_REFERENCE_SHA} must remain reachable after promotion`);
  assert.equal(gitBlob('HEAD', PR_CANDIDATE_PATH), gitBlob(EV18_REFERENCE_SHA, PR_CANDIDATE_PATH), 'steady EV-18 workflow must remain pinned to the reviewed reference object');
  console.log(`EV9_TRUSTED_V9_SELF_TEST_PASS mode=ev18-steady transitionAttacks=${attackCount} reference=${EV18_REFERENCE_SHA}`);
}

function verify() {
  const candidateSha = process.env.CANDIDATE_SHA;
  const trustedBaseSha = process.env.TRUSTED_BASE_SHA;
  ok(/^[a-f0-9]{40}$/.test(candidateSha ?? ''), 'CANDIDATE_SHA must be a full lowercase Git SHA');
  ok(/^[a-f0-9]{40}$/.test(trustedBaseSha ?? ''), 'TRUSTED_BASE_SHA must be a full lowercase Git SHA');
  ok(git(['rev-parse', 'HEAD']) === trustedBaseSha, 'trusted observer must execute from the exact trusted base checkout');

  const mode = trustedMode(trustedBaseSha);
  if (mode === 'legacy') {
    const candidateWorkflowMatchesEv18 = referenceAvailable()
      && gitBlob(candidateSha, PR_CANDIDATE_PATH) === gitBlob(EV18_REFERENCE_SHA, PR_CANDIDATE_PATH);
    if (!candidateWorkflowMatchesEv18) {
      runV8('verify');
      console.log(`EV9_TRUSTED_V9_VERIFY_PASS mode=legacy-v8 candidate=${candidateSha} trustedBase=${trustedBaseSha}`);
      return;
    }
    const transition = transitionChecks({ trustedBaseSha, candidateSha });
    const report = reportFor({
      mode: 'ev18-transition',
      trustedBaseSha,
      candidateSha,
      checks: transition.checks,
      details: { changedPaths: transition.changed, pinnedPaths: transition.pinned },
    });
    writeOptionalOutput(report);
    ok(report.pass, `EV-18 trusted transition failed: ${report.failedCheckIds.join(',')}`);
    console.log(`EV9_TRUSTED_V9_VERIFY_PASS mode=ev18-transition candidate=${candidateSha} trustedBase=${trustedBaseSha} paths=${transition.changed.length}`);
    return;
  }

  if (mode === 'ev18-steady') {
    const steady = steadyChecks({ trustedBaseSha, candidateSha });
    const report = reportFor({ mode: 'ev18-steady', trustedBaseSha, candidateSha, checks: steady.checks });
    writeOptionalOutput(report);
    ok(report.pass, `EV-18 trusted steady-state observation failed: ${report.failedCheckIds.join(',')}`);
    console.log(`EV9_TRUSTED_V9_VERIFY_PASS mode=ev18-steady candidate=${candidateSha} trustedBase=${trustedBaseSha}`);
    return;
  }

  throw new Error(`trusted PR Candidate producer is neither the legacy anchor nor the reviewed EV-18 producer: base=${trustedBaseSha}`);
}

const command = process.argv[2];
if (command === 'self-test') selfTest();
else if (command === 'verify') verify();
else throw new Error('usage: ev9-trusted-pr-candidate-observer-v9.mjs <self-test|verify> [--output path]');
