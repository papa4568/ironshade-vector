import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LEGACY_ANCHOR_SHA = 'ad4ec884ba2aa262b06f91a03411a972550cbb87';
const TRANSITION_BASE_SHA = 'e77b70fe4766ba9cd2892c222df0acd1b4c827ca';
const EV18_REFERENCE_SHA = '2174a1092a3b478589c2d26c2acb56ed2a99fd05';
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

function baseGitEnv(extra = {}) {
  return { PATH: '/usr/bin:/bin', HOME: '/tmp', ...extra };
}

function git(args, { allowFailure = false } = {}) {
  if (allowFailure) {
    return spawnSync('/usr/bin/git', args, {
      encoding: 'utf8',
      env: baseGitEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  return execFileSync('/usr/bin/git', args, {
    encoding: 'utf8',
    env: baseGitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitWithEnv(args, extraEnv, { input = undefined } = {}) {
  return execFileSync('/usr/bin/git', args, {
    encoding: 'utf8',
    env: baseGitEnv(extraEnv),
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
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
    env: baseGitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output.toString('utf8').split('\0').filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function isAncestor(ancestor, descendant) {
  return git(['merge-base', '--is-ancestor', ancestor, descendant], { allowFailure: true }).status === 0;
}

function allowedAgentMutation(path) {
  return path === 'agent/task-graph.json'
    || /^agent\/tools\/ev9-trusted-pr-candidate-observer(?:-v\d+)?\.mjs$/.test(path)
    || EV9_LIVE_AGENT_PATHS.has(path);
}

function gitAgentRefs(revision, { transition = false } = {}) {
  const tree = execFileSync('/usr/bin/git', ['ls-tree', '-r', '-z', revision, '--', 'agent'], {
    encoding: 'buffer',
    env: baseGitEnv(),
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
      check('ev18-steady-trusted-base-pinned', gitBlob(trustedBaseSha, PR_CANDIDATE_PATH) === expectedWorkflowBlob, 'trusted main must retain the reviewed provenance-hardened EV-18 producer Git object'),
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
    schema: 'ironshade-ev9-trusted-pr-candidate-observer:v10',
    mode,
    trustedBaseSha,
    candidateSha,
    legacyAnchorSha: LEGACY_ANCHOR_SHA,
    transitionBaseSha: TRANSITION_BASE_SHA,
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

let syntheticCommitCounter = 0;

function existingMode(revision, path) {
  const result = git(['ls-tree', revision, '--', path], { allowFailure: true });
  if (result.status !== 0 || !result.stdout.trim()) return '100644';
  const match = result.stdout.trim().match(/^(\d+)\s/);
  ok(match, `unable to resolve git mode for ${path}`);
  return match[1];
}

function createSyntheticCandidate({ id, path, content }) {
  syntheticCommitCounter += 1;
  const indexPath = `/tmp/ironshade-ev23-index-${process.pid}-${syntheticCommitCounter}`;
  const env = {
    GIT_INDEX_FILE: indexPath,
    GIT_AUTHOR_NAME: 'EV-23 Calibration',
    GIT_AUTHOR_EMAIL: 'ev23@example.invalid',
    GIT_COMMITTER_NAME: 'EV-23 Calibration',
    GIT_COMMITTER_EMAIL: 'ev23@example.invalid',
    GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
  };
  try {
    gitWithEnv(['read-tree', EV18_REFERENCE_SHA], env);
    const blob = gitWithEnv(['hash-object', '-w', '--stdin'], env, { input: content });
    const referenceBlob = git(['rev-parse', `${EV18_REFERENCE_SHA}:${path}`], { allowFailure: true });
    if (referenceBlob.status === 0) ok(blob !== referenceBlob.stdout.trim(), `${id} calibration mutation must change the target Git object`);
    gitWithEnv(['update-index', '--add', '--cacheinfo', existingMode(EV18_REFERENCE_SHA, path), blob, path], env);
    const tree = gitWithEnv(['write-tree'], env);
    return gitWithEnv(['commit-tree', tree, '-p', EV18_REFERENCE_SHA, '-m', `EV-23 production calibration ${id}`], env);
  } finally {
    rmSync(indexPath, { force: true });
  }
}

function evaluateTransition(candidateSha) {
  const result = transitionChecks({ trustedBaseSha: TRANSITION_BASE_SHA, candidateSha });
  const failedCheckIds = result.checks.filter(entry => !entry.pass).map(entry => entry.id);
  return { pass: failedCheckIds.length === 0, failedCheckIds };
}

function productionTransitionCalibration() {
  ok(referenceAvailable(), `production calibration requires provenance-hardened EV-18 reference ${EV18_REFERENCE_SHA}`);
  const baseline = evaluateTransition(EV18_REFERENCE_SHA);
  let falsePositives = baseline.pass ? 0 : 1;
  let falseNegatives = 0;
  assert.equal(baseline.pass, true, `production transition baseline failed: ${baseline.failedCheckIds.join(',')}`);

  const attacks = [
    { id: 'unexpected-path', path: 'src/__ev23_unreviewed_transition__.ts', content: 'export const ev23UnexpectedTransition = true;\n', expectedFailedCheckId: 'ev18-transition-path-set-exact' },
    { id: 'pinned-object-drift', path: 'AGENTS.md', content: `${gitText(EV18_REFERENCE_SHA, 'AGENTS.md')}\n<!-- EV-23 pinned-object attack -->\n`, expectedFailedCheckId: 'ev18-transition-pinned-objects' },
    { id: 'browser-drift', path: BROWSER_WORKFLOW_PATH, content: `${gitText(EV18_REFERENCE_SHA, BROWSER_WORKFLOW_PATH)}\n# EV-23 browser drift attack\n`, expectedFailedCheckId: 'ev18-browser-workflow-unchanged' },
    { id: 'android-drift', path: ANDROID_WORKFLOW_PATH, content: `${gitText(EV18_REFERENCE_SHA, ANDROID_WORKFLOW_PATH)}\n# EV-23 Android drift attack\n`, expectedFailedCheckId: 'ev18-android-workflow-unchanged' },
    { id: 'dependency-drift', path: 'package.json', content: `${gitText(EV18_REFERENCE_SHA, 'package.json')}\n \n`, expectedFailedCheckId: 'ev18-source-bound-dependencies-unchanged' },
    { id: 'protected-agent-drift', path: 'agent/architecture-invariants.json', content: `${gitText(EV18_REFERENCE_SHA, 'agent/architecture-invariants.json')}\n \n`, expectedFailedCheckId: 'ev18-nontransition-agent-boundary-unchanged' },
  ];

  const rows = [];
  for (const attack of attacks) {
    const candidateSha = createSyntheticCandidate(attack);
    const result = evaluateTransition(candidateSha);
    const detected = !result.pass && result.failedCheckIds.includes(attack.expectedFailedCheckId);
    if (!detected) falseNegatives += 1;
    assert.equal(detected, true, `production transition verifier did not reject ${attack.id} through ${attack.expectedFailedCheckId}; failed=${result.failedCheckIds.join(',')}`);
    rows.push({ id: attack.id, candidateSha, expectedFailedCheckId: attack.expectedFailedCheckId, failedCheckIds: result.failedCheckIds });
  }
  assert.equal(falsePositives, 0, 'EV-23 production calibration false-positive budget exceeded');
  assert.equal(falseNegatives, 0, 'EV-23 production calibration false-negative budget exceeded');
  return { baseline, rows, falsePositives, falseNegatives };
}

function selfTest() {
  assert.deepEqual([...new Set(EV18_TRANSITION_PATHS)], EV18_TRANSITION_PATHS, 'EV-18 transition path set must be sorted and unique');
  const calibration = productionTransitionCalibration();
  const liveWorkflow = gitText('HEAD', PR_CANDIDATE_PATH);
  if (!liveWorkflow.includes(EV18_MARKER)) {
    runV8('self-test');
    console.log(`EV9_TRUSTED_V10_SELF_TEST_PASS mode=legacy-v8 productionTransition=true transitionAttacks=${calibration.rows.length} falsePositives=${calibration.falsePositives} falseNegatives=${calibration.falseNegatives} reference=${EV18_REFERENCE_SHA}`);
    return;
  }
  ok(referenceAvailable(), `EV-18 reference commit ${EV18_REFERENCE_SHA} must remain reachable after promotion`);
  assert.equal(gitBlob('HEAD', PR_CANDIDATE_PATH), gitBlob(EV18_REFERENCE_SHA, PR_CANDIDATE_PATH), 'steady EV-18 workflow must remain pinned to the provenance-hardened reviewed reference object');
  console.log(`EV9_TRUSTED_V10_SELF_TEST_PASS mode=ev18-steady productionTransition=true transitionAttacks=${calibration.rows.length} falsePositives=${calibration.falsePositives} falseNegatives=${calibration.falseNegatives} reference=${EV18_REFERENCE_SHA}`);
}

function verify() {
  const candidateSha = process.env.CANDIDATE_SHA;
  const trustedBaseSha = process.env.TRUSTED_BASE_SHA;
  ok(/^[a-f0-9]{40}$/.test(candidateSha ?? ''), 'CANDIDATE_SHA must be a full lowercase Git SHA');
  ok(/^[a-f0-9]{40}$/.test(trustedBaseSha ?? ''), 'TRUSTED_BASE_SHA must be a full lowercase Git SHA');
  ok(git(['rev-parse', 'HEAD']) === trustedBaseSha, 'trusted observer must execute from the exact trusted base checkout');

  const mode = trustedMode(trustedBaseSha);
  if (mode === 'legacy') {
    const candidateWorkflowMatchesEv18 = referenceAvailable() && gitBlob(candidateSha, PR_CANDIDATE_PATH) === gitBlob(EV18_REFERENCE_SHA, PR_CANDIDATE_PATH);
    if (!candidateWorkflowMatchesEv18) {
      runV8('verify');
      console.log(`EV9_TRUSTED_V10_VERIFY_PASS mode=legacy-v8 candidate=${candidateSha} trustedBase=${trustedBaseSha}`);
      return;
    }
    const transition = transitionChecks({ trustedBaseSha, candidateSha });
    const report = reportFor({ mode: 'ev18-transition', trustedBaseSha, candidateSha, checks: transition.checks, details: { changedPaths: transition.changed, pinnedPaths: transition.pinned } });
    writeOptionalOutput(report);
    ok(report.pass, `EV-18 trusted provenance-hardened transition failed: ${report.failedCheckIds.join(',')}`);
    console.log(`EV9_TRUSTED_V10_VERIFY_PASS mode=ev18-transition candidate=${candidateSha} trustedBase=${trustedBaseSha} paths=${transition.changed.length}`);
    return;
  }

  if (mode === 'ev18-steady') {
    const steady = steadyChecks({ trustedBaseSha, candidateSha });
    const report = reportFor({ mode: 'ev18-steady', trustedBaseSha, candidateSha, checks: steady.checks });
    writeOptionalOutput(report);
    ok(report.pass, `EV-18 trusted steady-state observation failed: ${report.failedCheckIds.join(',')}`);
    console.log(`EV9_TRUSTED_V10_VERIFY_PASS mode=ev18-steady candidate=${candidateSha} trustedBase=${trustedBaseSha}`);
    return;
  }

  throw new Error(`trusted PR Candidate producer is neither the legacy anchor nor the provenance-hardened reviewed EV-18 producer: base=${trustedBaseSha}`);
}

const command = process.argv[2];
if (command === 'self-test') selfTest();
else if (command === 'verify') verify();
else throw new Error('usage: ev9-trusted-pr-candidate-observer-v10.mjs <self-test|verify> [--output path]');
