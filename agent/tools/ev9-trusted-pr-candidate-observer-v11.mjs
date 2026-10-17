import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TRANSITION_BASE_SHA = '29eca981f898c838072824d6edb1d0a107ba2d28';
const EV18_REFERENCE_SHA = '0d996b64ac47306a244fcd67e938b937910f3d85';
const PR_CANDIDATE_PATH = '.github/workflows/pr-candidate.yml';
const ROADMAP_PATH = 'docs/experimental-verification-roadmap.md';
const TRUSTED_OBSERVER_WORKFLOW_PATH = '.github/workflows/ev9-trusted-pr-candidate-observer.yml';
const BROWSER_WORKFLOW_PATH = '.github/workflows/browser-e2e.yml';
const ANDROID_WORKFLOW_PATH = '.github/workflows/pr-android-apk.yml';
const EV18_MARKER = 'Prepare EV-18 closed proof inputs';
const RESTORE_FALLBACK_MARKER = 'id: proof-cache-restore\n        continue-on-error: true\n        uses: actions/cache/restore@v5';
const V10_PATH = fileURLToPath(new URL('./ev9-trusted-pr-candidate-observer-v10.mjs', import.meta.url));

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

function gitEntry(revision, path) {
  const result = git(['ls-tree', revision, '--', path], { allowFailure: true });
  ok(result.status === 0 && result.stdout.trim(), `missing Git tree entry ${revision}:${path}`);
  const lines = result.stdout.trim().split('\n');
  ok(lines.length === 1, `expected one Git tree entry for ${revision}:${path}`);
  const match = lines[0].match(/^(\d+)\s+(\w+)\s+([a-f0-9]{40})\t(.+)$/s);
  ok(match && match[4] === path, `unexpected Git tree entry for ${revision}:${path}`);
  return `${match[1]} ${match[2]} ${match[3]}`;
}

function gitText(revision, path) {
  return git(['show', `${revision}:${path}`]);
}

function gitPathRefs(revision, paths) {
  return Object.fromEntries(paths.map(path => [path, gitEntry(revision, path)]));
}

function changedPaths(baseSha, candidateSha) {
  const output = execFileSync('/usr/bin/git', ['diff', '--name-only', '-z', baseSha, candidateSha, '--'], {
    encoding: 'buffer',
    env: baseGitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output.toString('utf8').split('\0').filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function changedEv9Paths(baseSha, candidateSha) {
  return changedPaths(baseSha, candidateSha).filter(path => EV9_LIVE_AGENT_PATHS.has(path));
}

function isAncestor(ancestor, descendant) {
  return git(['merge-base', '--is-ancestor', ancestor, descendant], { allowFailure: true }).status === 0;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function check(id, pass, evidence) {
  return { id, pass: Boolean(pass), evidence };
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
    const match = entry.match(/^(\d+)\s+(\w+)\s+([a-f0-9]{40})\t(.+)$/s);
    ok(match, `unexpected git ls-tree entry: ${entry}`);
    const [, mode, type, objectSha, path] = match;
    if (allowedAgentMutation(path)) continue;
    if (transition && EV18_AGENT_TRANSITION_PATHS.has(path)) continue;
    refs[path] = `${mode} ${type} ${objectSha}`;
  }
  return refs;
}

function referenceAvailable() {
  return git(['cat-file', '-e', `${EV18_REFERENCE_SHA}^{commit}`], { allowFailure: true }).status === 0;
}

function trustedMode(trustedBaseSha) {
  const baseEntry = gitEntry(trustedBaseSha, PR_CANDIDATE_PATH);
  if (baseEntry === gitEntry(TRANSITION_BASE_SHA, PR_CANDIDATE_PATH)) return 'legacy';
  if (referenceAvailable() && baseEntry === gitEntry(EV18_REFERENCE_SHA, PR_CANDIDATE_PATH)) return 'ev18-steady';
  return 'unknown';
}

function transitionChecks({ trustedBaseSha, candidateSha }) {
  const changed = changedPaths(trustedBaseSha, candidateSha);
  const pinned = referenceAvailable()
    ? Object.fromEntries(EV18_TRANSITION_PATHS.map(path => [path, gitEntry(candidateSha, path) === gitEntry(EV18_REFERENCE_SHA, path)]))
    : Object.fromEntries(EV18_TRANSITION_PATHS.map(path => [path, false]));
  const baseDeps = gitPathRefs(trustedBaseSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const candidateDeps = gitPathRefs(candidateSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const workflow = gitText(candidateSha, PR_CANDIDATE_PATH);
  const checks = [
    check('ev18-reference-object-present', referenceAvailable(), `restore-error-hardened EV-18 reference ${EV18_REFERENCE_SHA} must be present`),
    check('ev18-reference-is-ancestor', referenceAvailable() && isAncestor(EV18_REFERENCE_SHA, candidateSha), 'the synchronized EV-18 candidate must retain the hardened reference as an ancestor'),
    check('ev18-transition-path-set-exact', sameJson(changed, EV18_TRANSITION_PATHS), `candidate diff must be exactly the reviewed EV-18 implementation paths; actual=${changed.join(',')}`),
    check('ev18-transition-pinned-objects', Object.values(pinned).every(Boolean), `every EV-18 implementation path must match ${EV18_REFERENCE_SHA} including mode/type/object identity`),
    check('ev18-roadmap-state-base-owned', gitEntry(candidateSha, ROADMAP_PATH) === gitEntry(trustedBaseSha, ROADMAP_PATH), 'experimental roadmap state must remain trusted-base identical'),
    check('ev18-observer-workflow-unchanged', gitEntry(candidateSha, TRUSTED_OBSERVER_WORKFLOW_PATH) === gitEntry(trustedBaseSha, TRUSTED_OBSERVER_WORKFLOW_PATH), 'trusted observer workflow must remain trusted-base identical'),
    check('ev18-browser-workflow-unchanged', gitEntry(candidateSha, BROWSER_WORKFLOW_PATH) === gitEntry(trustedBaseSha, BROWSER_WORKFLOW_PATH), 'browser workflow must remain trusted-base identical'),
    check('ev18-android-workflow-unchanged', gitEntry(candidateSha, ANDROID_WORKFLOW_PATH) === gitEntry(trustedBaseSha, ANDROID_WORKFLOW_PATH), 'Android workflow must remain trusted-base identical'),
    check('ev18-source-bound-dependencies-unchanged', sameJson(candidateDeps, baseDeps), 'source-bound consumer dependencies must remain trusted-base identical'),
    check('ev18-nontransition-agent-boundary-unchanged', sameJson(gitAgentRefs(candidateSha, { transition: true }), gitAgentRefs(trustedBaseSha, { transition: true })), 'protected agent entries outside the EV-18 implementation set must remain trusted-base identical'),
    check('ev18-candidate-workflow-marker', workflow.includes(EV18_MARKER), 'EV-18 closed-proof producer marker must be present'),
    check('ev18-cache-restore-error-fallback', workflow.includes(RESTORE_FALLBACK_MARKER), 'cache restore service/API failures must continue into the real-proof fallback'),
  ];
  return { checks, changed, pinned };
}

function legacySteadyChecks({ trustedBaseSha, candidateSha }) {
  const baseDeps = gitPathRefs(trustedBaseSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const candidateDeps = gitPathRefs(candidateSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const ev9Changed = changedEv9Paths(trustedBaseSha, candidateSha);
  return {
    checks: [
      check('legacy-producer-workflow-unchanged', gitEntry(candidateSha, PR_CANDIDATE_PATH) === gitEntry(trustedBaseSha, PR_CANDIDATE_PATH), 'pre-EV-18 producer workflow must remain trusted-base identical'),
      check('legacy-observer-workflow-unchanged', gitEntry(candidateSha, TRUSTED_OBSERVER_WORKFLOW_PATH) === gitEntry(trustedBaseSha, TRUSTED_OBSERVER_WORKFLOW_PATH), 'trusted observer workflow must remain trusted-base identical outside a reviewed observer bootstrap'),
      check('legacy-browser-workflow-unchanged', gitEntry(candidateSha, BROWSER_WORKFLOW_PATH) === gitEntry(trustedBaseSha, BROWSER_WORKFLOW_PATH), 'browser workflow must remain trusted-base identical'),
      check('legacy-android-workflow-unchanged', gitEntry(candidateSha, ANDROID_WORKFLOW_PATH) === gitEntry(trustedBaseSha, ANDROID_WORKFLOW_PATH), 'Android workflow must remain trusted-base identical'),
      check('legacy-source-bound-dependencies-unchanged', sameJson(candidateDeps, baseDeps), 'source-bound consumer dependencies must remain trusted-base identical'),
      check('legacy-protected-agent-boundary-unchanged', sameJson(gitAgentRefs(candidateSha), gitAgentRefs(trustedBaseSha)), 'protected agent entries must remain trusted-base identical outside the established allowlist'),
      check('legacy-ev9-live-paths-unchanged', ev9Changed.length === 0, `legacy compatibility path does not authorize EV-9 live implementation changes; changed=${ev9Changed.join(',')}`),
    ],
  };
}

function steadyChecks({ trustedBaseSha, candidateSha }) {
  const expectedWorkflowEntry = gitEntry(EV18_REFERENCE_SHA, PR_CANDIDATE_PATH);
  const baseDeps = gitPathRefs(trustedBaseSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const candidateDeps = gitPathRefs(candidateSha, TRUSTED_CONSUMER_DEPENDENCIES);
  const ev9Changed = changedEv9Paths(trustedBaseSha, candidateSha);
  return {
    checks: [
      check('ev18-steady-trusted-base-pinned', gitEntry(trustedBaseSha, PR_CANDIDATE_PATH) === expectedWorkflowEntry, 'trusted main must retain the hardened EV-18 producer tree entry'),
      check('ev18-steady-candidate-workflow-unchanged', gitEntry(candidateSha, PR_CANDIDATE_PATH) === expectedWorkflowEntry, 'candidate may not redefine the trusted EV-18 producer without a new observer bootstrap'),
      check('ev18-steady-observer-workflow-unchanged', gitEntry(candidateSha, TRUSTED_OBSERVER_WORKFLOW_PATH) === gitEntry(trustedBaseSha, TRUSTED_OBSERVER_WORKFLOW_PATH), 'trusted observer workflow must remain trusted-base identical'),
      check('ev18-steady-browser-workflow-unchanged', gitEntry(candidateSha, BROWSER_WORKFLOW_PATH) === gitEntry(trustedBaseSha, BROWSER_WORKFLOW_PATH), 'browser workflow must remain trusted-base identical'),
      check('ev18-steady-android-workflow-unchanged', gitEntry(candidateSha, ANDROID_WORKFLOW_PATH) === gitEntry(trustedBaseSha, ANDROID_WORKFLOW_PATH), 'Android workflow must remain trusted-base identical'),
      check('ev18-steady-source-bound-dependencies-unchanged', sameJson(candidateDeps, baseDeps), 'source-bound consumer dependencies must remain trusted-base identical'),
      check('ev18-steady-protected-agent-boundary-unchanged', sameJson(gitAgentRefs(candidateSha), gitAgentRefs(trustedBaseSha)), 'protected agent entries must remain trusted-base identical outside the established allowlist'),
      check('ev18-steady-ev9-live-paths-unchanged', ev9Changed.length === 0, `EV-9 live implementation changes require a new trusted observer bootstrap after EV-18; changed=${ev9Changed.join(',')}`),
    ],
  };
}

function reportFor({ mode, trustedBaseSha, candidateSha, checks, details = {} }) {
  const failedCheckIds = checks.filter(entry => !entry.pass).map(entry => entry.id);
  return {
    schema: 'ironshade-ev9-trusted-pr-candidate-observer:v11',
    mode,
    trustedBaseSha,
    candidateSha,
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

function runV10(command) {
  const result = spawnSync(process.execPath, [V10_PATH, command], {
    env: process.env,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runV10SelfTestAt(revision) {
  const worktreePath = `/tmp/ironshade-v11-v10-${process.pid}-${revision.slice(0, 12)}`;
  spawnSync('/usr/bin/git', ['worktree', 'prune'], {
    encoding: 'utf8',
    env: baseGitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  rmSync(worktreePath, { recursive: true, force: true });
  const add = spawnSync('/usr/bin/git', ['worktree', 'add', '--detach', worktreePath, revision], {
    encoding: 'utf8',
    env: baseGitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (add.error) throw add.error;
  ok(add.status === 0, `unable to create v10 compatibility worktree at ${revision}: ${add.stderr.trim()}`);
  try {
    const result = spawnSync(process.execPath, [V10_PATH, 'self-test'], {
      cwd: worktreePath,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.error) throw result.error;
    return result;
  } finally {
    const remove = spawnSync('/usr/bin/git', ['worktree', 'remove', '--force', worktreePath], {
      encoding: 'utf8',
      env: baseGitEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    rmSync(worktreePath, { recursive: true, force: true });
    if (remove.error) throw remove.error;
    ok(remove.status === 0, `unable to remove v10 compatibility worktree at ${revision}: ${remove.stderr.trim()}`);
  }
}

function v10CompatibilityCalibration() {
  const legacy = runV10SelfTestAt(TRANSITION_BASE_SHA);
  assert.equal(
    legacy.status,
    0,
    `v10 compatibility self-test must still pass in its pre-EV-18 trusted context; stdout=${legacy.stdout} stderr=${legacy.stderr}`,
  );

  const hardened = runV10SelfTestAt(EV18_REFERENCE_SHA);
  const hardenedOutput = `${hardened.stdout ?? ''}\n${hardened.stderr ?? ''}`;
  assert.notEqual(hardened.status, 0, 'superseded v10 self-test must reproduce its false positive against the hardened v11 EV-18 reference');
  assert.match(
    hardenedOutput,
    /steady EV-18 workflow tree entry must remain pinned to the provenance-hardened reviewed reference/,
    'superseded v10 failure must remain the known tree-entry pin mismatch rather than an unrelated error',
  );

  return {
    falsePositives: 0,
    falseNegatives: 0,
    legacyContextPass: true,
    supersededFalsePositiveReproduced: true,
  };
}

let syntheticCommitCounter = 0;

function existingMode(revision, path) {
  const result = git(['ls-tree', revision, '--', path], { allowFailure: true });
  if (result.status !== 0 || !result.stdout.trim()) return '100644';
  const match = result.stdout.trim().match(/^(\d+)\s/);
  ok(match, `unable to resolve git mode for ${path}`);
  return match[1];
}

function createSyntheticCandidate({ id, path, content = undefined, mode = undefined }) {
  syntheticCommitCounter += 1;
  const indexPath = `/tmp/ironshade-ev24-index-${process.pid}-${syntheticCommitCounter}`;
  const env = {
    GIT_INDEX_FILE: indexPath,
    GIT_AUTHOR_NAME: 'EV-24 Calibration',
    GIT_AUTHOR_EMAIL: 'ev24@example.invalid',
    GIT_COMMITTER_NAME: 'EV-24 Calibration',
    GIT_COMMITTER_EMAIL: 'ev24@example.invalid',
    GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
  };
  try {
    gitWithEnv(['read-tree', EV18_REFERENCE_SHA], env);
    const referenceBlob = git(['rev-parse', `${EV18_REFERENCE_SHA}:${path}`], { allowFailure: true });
    const blob = content === undefined
      ? (() => {
          ok(referenceBlob.status === 0, `${id} mode-only mutation requires an existing reference blob`);
          return referenceBlob.stdout.trim();
        })()
      : gitWithEnv(['hash-object', '-w', '--stdin'], env, { input: content });
    const targetMode = mode ?? existingMode(EV18_REFERENCE_SHA, path);
    gitWithEnv(['update-index', '--add', '--cacheinfo', targetMode, blob, path], env);
    const tree = gitWithEnv(['write-tree'], env);
    const commit = gitWithEnv(['commit-tree', tree, '-p', EV18_REFERENCE_SHA, '-m', `EV-24 production calibration ${id}`], env);
    if (referenceBlob.status === 0) ok(gitEntry(commit, path) !== gitEntry(EV18_REFERENCE_SHA, path), `${id} must change the target Git tree entry`);
    return commit;
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
  ok(referenceAvailable(), `production calibration requires hardened EV-18 reference ${EV18_REFERENCE_SHA}`);
  const baseline = evaluateTransition(EV18_REFERENCE_SHA);
  let falsePositives = baseline.pass ? 0 : 1;
  let falseNegatives = 0;
  assert.equal(baseline.pass, true, `EV-24 transition baseline failed: ${baseline.failedCheckIds.join(',')}`);

  const modePath = 'agent/tools/proof-cache-promotion.mjs';
  const referenceMode = existingMode(EV18_REFERENCE_SHA, modePath);
  const alternateMode = referenceMode === '100755' ? '100644' : '100755';
  const attacks = [
    { id: 'unexpected-path', path: 'src/__ev24_unreviewed_transition__.ts', content: 'export const ev24UnexpectedTransition = true;\n', expectedFailedCheckId: 'ev18-transition-path-set-exact' },
    { id: 'pinned-object-drift', path: 'AGENTS.md', content: `${gitText(EV18_REFERENCE_SHA, 'AGENTS.md')}\n<!-- EV-24 pinned-object attack -->\n`, expectedFailedCheckId: 'ev18-transition-pinned-objects' },
    { id: 'pinned-mode-drift', path: modePath, mode: alternateMode, expectedFailedCheckId: 'ev18-transition-pinned-objects' },
    { id: 'roadmap-drift', path: ROADMAP_PATH, content: `${gitText(EV18_REFERENCE_SHA, ROADMAP_PATH)}\n<!-- EV-24 roadmap drift -->\n`, expectedFailedCheckId: 'ev18-roadmap-state-base-owned' },
    { id: 'browser-drift', path: BROWSER_WORKFLOW_PATH, content: `${gitText(EV18_REFERENCE_SHA, BROWSER_WORKFLOW_PATH)}\n# EV-24 browser drift attack\n`, expectedFailedCheckId: 'ev18-browser-workflow-unchanged' },
    { id: 'android-drift', path: ANDROID_WORKFLOW_PATH, content: `${gitText(EV18_REFERENCE_SHA, ANDROID_WORKFLOW_PATH)}\n# EV-24 Android drift attack\n`, expectedFailedCheckId: 'ev18-android-workflow-unchanged' },
    { id: 'dependency-drift', path: 'package.json', content: `${gitText(EV18_REFERENCE_SHA, 'package.json')}\n \n`, expectedFailedCheckId: 'ev18-source-bound-dependencies-unchanged' },
    { id: 'protected-agent-drift', path: 'agent/architecture-invariants.json', content: `${gitText(EV18_REFERENCE_SHA, 'agent/architecture-invariants.json')}\n \n`, expectedFailedCheckId: 'ev18-nontransition-agent-boundary-unchanged' },
  ];

  const rows = [];
  for (const attack of attacks) {
    const candidateSha = createSyntheticCandidate(attack);
    const result = evaluateTransition(candidateSha);
    const detected = !result.pass && result.failedCheckIds.includes(attack.expectedFailedCheckId);
    if (!detected) falseNegatives += 1;
    assert.equal(detected, true, `EV-24 production verifier did not reject ${attack.id}; failed=${result.failedCheckIds.join(',')}`);
    rows.push({ id: attack.id, candidateSha, expectedFailedCheckId: attack.expectedFailedCheckId, failedCheckIds: result.failedCheckIds });
  }
  assert.equal(falsePositives, 0, 'EV-24 production calibration false-positive budget exceeded');
  assert.equal(falseNegatives, 0, 'EV-24 production calibration false-negative budget exceeded');
  return { baseline, rows, falsePositives, falseNegatives };
}

function selfTest() {
  assert.deepEqual([...new Set(EV18_TRANSITION_PATHS)], EV18_TRANSITION_PATHS, 'EV-18 transition paths must be sorted and unique');
  assert.equal(EV18_TRANSITION_PATHS.includes(ROADMAP_PATH), false, 'roadmap state must remain base-owned');
  const calibration = productionTransitionCalibration();
  const compatibility = v10CompatibilityCalibration();
  console.log(`EV9_TRUSTED_V11_SELF_TEST_PASS task=EV-25 transitionAttacks=${calibration.rows.length} falsePositives=${calibration.falsePositives} falseNegatives=${calibration.falseNegatives} compatibilityFalsePositives=${compatibility.falsePositives} compatibilityFalseNegatives=${compatibility.falseNegatives} v10LegacyContext=pass v10SupersededFalsePositive=reproduced roadmap=base-owned restoreFallback=pinned treeEntryModes=true reference=${EV18_REFERENCE_SHA}`);
}

function verify() {
  const candidateSha = process.env.CANDIDATE_SHA;
  const trustedBaseSha = process.env.TRUSTED_BASE_SHA;
  ok(/^[a-f0-9]{40}$/.test(candidateSha ?? ''), 'CANDIDATE_SHA must be a full lowercase Git SHA');
  ok(/^[a-f0-9]{40}$/.test(trustedBaseSha ?? ''), 'TRUSTED_BASE_SHA must be a full lowercase Git SHA');
  ok(git(['rev-parse', 'HEAD']) === trustedBaseSha, 'trusted observer must execute from the exact trusted base checkout');
  ok(referenceAvailable(), `EV-18 reference commit ${EV18_REFERENCE_SHA} must be fetched as untrusted calibration data`);

  const mode = trustedMode(trustedBaseSha);
  if (mode === 'legacy') {
    const candidateMatchesHardened = gitEntry(candidateSha, PR_CANDIDATE_PATH) === gitEntry(EV18_REFERENCE_SHA, PR_CANDIDATE_PATH);
    if (candidateMatchesHardened) {
      const transition = transitionChecks({ trustedBaseSha, candidateSha });
      const report = reportFor({
        mode: 'ev18-restore-fallback-transition',
        trustedBaseSha,
        candidateSha,
        checks: transition.checks,
        details: { changedPaths: transition.changed, pinnedPaths: transition.pinned },
      });
      writeOptionalOutput(report);
      ok(report.pass, `EV-18 restore-fallback transition failed: ${report.failedCheckIds.join(',')}`);
      console.log(`EV9_TRUSTED_V11_VERIFY_PASS mode=ev18-restore-fallback-transition candidate=${candidateSha} trustedBase=${trustedBaseSha} paths=${transition.changed.length} roadmap=base-owned`);
      return;
    }

    if (gitEntry(candidateSha, PR_CANDIDATE_PATH) === gitEntry(trustedBaseSha, PR_CANDIDATE_PATH)) {
      const ev9Changed = changedEv9Paths(trustedBaseSha, candidateSha);
      if (ev9Changed.length > 0) {
        runV10('verify');
        console.log(`EV9_TRUSTED_V11_VERIFY_PASS mode=v10-ev9-live candidate=${candidateSha} trustedBase=${trustedBaseSha} ev9ChangedPaths=${ev9Changed.length}`);
        return;
      }
      const legacy = legacySteadyChecks({ trustedBaseSha, candidateSha });
      const report = reportFor({ mode: 'legacy-steady', trustedBaseSha, candidateSha, checks: legacy.checks });
      writeOptionalOutput(report);
      ok(report.pass, `legacy trusted observer compatibility failed: ${report.failedCheckIds.join(',')}`);
      console.log(`EV9_TRUSTED_V11_VERIFY_PASS mode=legacy-steady candidate=${candidateSha} trustedBase=${trustedBaseSha}`);
      return;
    }

    runV10('verify');
    return;
  }

  if (mode === 'ev18-steady') {
    const steady = steadyChecks({ trustedBaseSha, candidateSha });
    const report = reportFor({ mode: 'ev18-hardened-steady', trustedBaseSha, candidateSha, checks: steady.checks });
    writeOptionalOutput(report);
    ok(report.pass, `EV-18 hardened steady-state observation failed: ${report.failedCheckIds.join(',')}`);
    console.log(`EV9_TRUSTED_V11_VERIFY_PASS mode=ev18-hardened-steady candidate=${candidateSha} trustedBase=${trustedBaseSha}`);
    return;
  }

  throw new Error(`trusted PR Candidate producer is neither the pre-EV-18 base nor the restore-error-hardened EV-18 producer: base=${trustedBaseSha}`);
}

const command = process.argv[2];
if (command === 'self-test') selfTest();
else if (command === 'verify') verify();
else throw new Error('usage: ev9-trusted-pr-candidate-observer-v11.mjs <self-test|verify> [--output path]');
