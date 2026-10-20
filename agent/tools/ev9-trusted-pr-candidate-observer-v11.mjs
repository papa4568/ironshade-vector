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

function gitAgentRefs(revision, { transition = false, productCloseout = false } = {}) {
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
    if (productCloseout && path === 'agent/roadmap-metadata.json') continue;
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


// Metadata is protected unless it is *exactly* the mechanical sidecar sync
// caused by closing the first checked product-roadmap item. This exception is
// evaluated by the trusted main checkout against immutable Git tree contents;
// no candidate JS or candidate-provided verifier rule is ever executed.
function validProductRoadmapCloseoutMetadata(trustedBaseSha, candidateSha) {
  const metadataPath = 'agent/roadmap-metadata.json';
  if (gitEntry(candidateSha, metadataPath) === gitEntry(trustedBaseSha, metadataPath)) return true;
  // Content-only JSON equivalence cannot authorize chmod, symlinks, or Git
  // object-type changes in a file otherwise protected by the observer.
  const [baseMode, baseType] = gitEntry(trustedBaseSha, metadataPath).split(' ');
  const [candidateMode, candidateType] = gitEntry(candidateSha, metadataPath).split(' ');
  if (baseMode !== candidateMode || baseType !== candidateType) return false;
  try {
    const base = JSON.parse(gitText(trustedBaseSha, metadataPath));
    const candidate = JSON.parse(gitText(candidateSha, metadataPath));
    const active = Array.isArray(base.roadmapIds) ? base.roadmapIds : [];
    if (active.length < 1 || !active.every(id => typeof id === 'string')) return false;
    const finishedId = active[0];
    const baseRoadmap = gitText(trustedBaseSha, 'docs/content-roadmap.md');
    const candidateRoadmap = gitText(candidateSha, 'docs/content-roadmap.md');
    const baseArchive = gitText(trustedBaseSha, 'docs/content-roadmap-archive.md');
    const candidateArchive = gitText(candidateSha, 'docs/content-roadmap-archive.md');
    const firstTask = baseRoadmap.split('\n').find(line => line.startsWith('- [ ] **'));
    if (!firstTask || !firstTask.startsWith('- [ ] **' + finishedId + ' —')) return false;
    const title = firstTask.match(/^- \[ \] \*\*(.+?)\*\*/)?.[1];
    if (!title) return false;
    const removedTask = firstTask + '\n\n';
    if (baseRoadmap.split(removedTask).length !== 2
        || candidateRoadmap !== baseRoadmap.replace(removedTask, '')) return false;

    const heading = '## P28 — Babylon flagship visual-quality overhaul\n\n';
    if (!baseArchive.startsWith('# Ironshade Vector')
        || !baseArchive.includes(heading)
        || !candidateArchive.startsWith(baseArchive.split(heading)[0] + heading)) return false;
    const archivePrefix = baseArchive.split(heading)[0] + heading;
    const archivedRest = baseArchive.slice(archivePrefix.length);
    if (!candidateArchive.endsWith(archivedRest)) return false;
    const inserted = candidateArchive.slice(archivePrefix.length, candidateArchive.length - archivedRest.length);
    if (!inserted.startsWith('- [x] **' + title + '**')
        || !inserted.includes('\n  - ')
        || !inserted.endsWith('\n\n')
        || inserted.split('\n').filter(line => line.startsWith('- [x] **')).length !== 1) return false;

    const expected = structuredClone(base);
    expected.roadmapIds = active.slice(1);
    const remaining = new Set(expected.roadmapIds);
    for (const taskId of Object.keys(expected.overrides ?? {})) {
      if (!remaining.has(taskId)) {
        delete expected.overrides[taskId];
        continue;
      }
      const override = expected.overrides[taskId];
      if (Array.isArray(override.dependsOn)) {
        override.dependsOn = override.dependsOn.filter(id => remaining.has(id));
        if (!override.dependsOn.length) delete override.dependsOn;
      }
    }
    return sameJson(expected, candidate);
  } catch {
    return false;
  }
}


// The trusted verifier permits exactly one reviewed correction to two negative
// fixture setups. Its old/new full-file Git identities are pinned: other agent
// changes, chmod attacks, or later changes to this test remain prohibited.
// This authorization is consumed naturally when the repaired file is on main.
function validPinnedRoadmapFixtureRepair(trustedBaseSha, candidateSha) {
  const path = 'agent/tests/roadmap-adapter.mjs';
  const baseRefs = gitAgentRefs(trustedBaseSha, { productCloseout: true });
  if (baseRefs[path] !== '100644 blob 370b6c0f9f8a77de3f8dd00398b11500a4f0e407'
      || gitEntry(candidateSha, path) !== '100644 blob 52d51d6070ba19060ad4e164e161015f1548f4ca') return false;
  const candidateRefs = gitAgentRefs(candidateSha, { productCloseout: true });
  candidateRefs[path] = baseRefs[path];
  return sameJson(candidateRefs, baseRefs);
}


 // A second exact Git-object-pinned closeout bundle is necessary after the
 // adapter fixture is repaired: the advisory EV-7 shadow scenario must no
 // longer describe now-current P28-F6 as "future". The only approved bundle
 // replaces it with P28-F7 (the later heavy-art acceptance task), preserves
 // the negative controls, and updates the paired test expectations.
 // This allowance expires as soon as the candidate blobs reach trusted main.
function validPinnedRoadmapShadowCloseoutFixtureBundle(trustedBaseSha, candidateSha) {
  const expected = [
    ['agent/tests/roadmap-adapter.mjs', '100644 blob 370b6c0f9f8a77de3f8dd00398b11500a4f0e407', '100644 blob 52d51d6070ba19060ad4e164e161015f1548f4ca'],
    ['agent/roadmap-shadow-simulator.json', '100644 blob 4155a4e6a9529f87e02084e21132a2dfd9683354', '100644 blob d42628aa3f5defbe63866dd179184c100e7ccc38'],
    ['agent/tests/roadmap-shadow-simulator.mjs', '100644 blob 7f86a83a3cddd783e192b5b7735d982fa2041c00', '100644 blob f95bd5bd61d874247dd78d88da5e6cab1ec120b5'],
  ];
  const baseRefs = gitAgentRefs(trustedBaseSha, { productCloseout: true });
  const candidateRefs = gitAgentRefs(candidateSha, { productCloseout: true });
  for (const [path, before, after] of expected) {
    if (baseRefs[path] !== before || candidateRefs[path] !== after) return false;
    candidateRefs[path] = before;
  }
  return sameJson(candidateRefs, baseRefs);
}


 // F7's completed product closeout makes P28-G1 current. Preserve the EV-7
 // rule that shadow probes target only *later* items, while permitting exactly
 // the reviewed G1/G2 -> G2/G3 data/test fixture update. A future arbitrary
 // agent mutation (including chmod or a third file) is still rejected.
 function validPinnedF7ShadowCloseoutFixtureBundle(trustedBaseSha, candidateSha) {
   const expected = [
     ['agent/roadmap-shadow-simulator.json', '100644 blob fd0c368e289bcd84242b63810c2b2e990c3ba088', '100644 blob 475b9c75344844fea5c89bb8e777a1f3f902ceab'],
     ['agent/tests/roadmap-shadow-simulator.mjs', '100644 blob 5e9d7b6f5b0fe9ffe73fe4c9bfe22a7b848e5767', '100644 blob 6ea06d7a53eb26ded954e67270697a3b02e35d6b'],
   ];
   const baseRefs = gitAgentRefs(trustedBaseSha, { productCloseout: true });
   const candidateRefs = gitAgentRefs(candidateSha, { productCloseout: true });
   for (const [path, before, after] of expected) {
     if (baseRefs[path] !== before || candidateRefs[path] !== after) return false;
     candidateRefs[path] = before;
   }
   return sameJson(candidateRefs, baseRefs);
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
      check('ev18-steady-protected-agent-boundary-unchanged', (sameJson(gitAgentRefs(candidateSha, { productCloseout: true }), gitAgentRefs(trustedBaseSha, { productCloseout: true })) || validPinnedRoadmapFixtureRepair(trustedBaseSha, candidateSha) || validPinnedRoadmapShadowCloseoutFixtureBundle(trustedBaseSha, candidateSha) || validPinnedF7ShadowCloseoutFixtureBundle(trustedBaseSha, candidateSha)), 'protected agent entries must remain trusted-base identical except for the exact Git-object-pinned roadmap regression-fixture repair'),
      check('ev18-steady-roadmap-closeout-metadata-bound', validProductRoadmapCloseoutMetadata(trustedBaseSha, candidateSha), 'metadata mutation must exactly match one first-item roadmap archival, dependency pruning and no other sidecar changes'),
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

// Multi-file calibration uses separate immutable synthetic commits. The
// established EV-24 single-path helper is kept unchanged as a control.
function createSyntheticRoadmapCandidate({ id, changes, baseSha = EV18_REFERENCE_SHA }) {
  let parent = baseSha;
  for (const [index, { path, content, mode }] of changes.entries()) {
    syntheticCommitCounter += 1;
    const indexPath = '/tmp/ironshade-product-closeout-' + process.pid + '-' + syntheticCommitCounter;
    const env = {
      GIT_INDEX_FILE: indexPath,
      GIT_AUTHOR_NAME: 'Product Closeout Calibration',
      GIT_AUTHOR_EMAIL: 'closeout@example.invalid',
      GIT_COMMITTER_NAME: 'Product Closeout Calibration',
      GIT_COMMITTER_EMAIL: 'closeout@example.invalid',
      GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
    };
    try {
      gitWithEnv(['read-tree', parent], env);
      const blob = gitWithEnv(['hash-object', '-w', '--stdin'], env, { input: content });
      gitWithEnv(['update-index', '--add', '--cacheinfo', mode ?? existingMode(parent, path), blob, path], env);
      const tree = gitWithEnv(['write-tree'], env);
      parent = gitWithEnv(['commit-tree', tree, '-p', parent, '-m', id + '-' + index], env);
    } finally {
      rmSync(indexPath, { force: true });
    }
  }
  return parent;
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


function roadmapCloseoutBoundaryCalibration() {
  const base = EV18_REFERENCE_SHA;
  const metadataPath = 'agent/roadmap-metadata.json';
  const roadmapPath = 'docs/content-roadmap.md';
  const archivePath = 'docs/content-roadmap-archive.md';
  const metadata = JSON.parse(gitText(base, metadataPath));
  const [firstId] = metadata.roadmapIds;
  const roadmap = gitText(base, roadmapPath);
  const taskLine = roadmap.split('\n').find(line => line.startsWith('- [ ] **'));
  assert(taskLine?.startsWith('- [ ] **' + firstId + ' —'), 'closeout calibration baseline must select the trusted first task');
  const expectedRoadmap = roadmap.replace(taskLine + '\n\n', '');
  assert.notEqual(roadmap, expectedRoadmap, 'closeout calibration must change the active roadmap');
  const archive = gitText(base, archivePath);
  const heading = '## P28 — Babylon flagship visual-quality overhaul\n\n';
  const exactTaskTitle = taskLine.match(/^- \[ \] \*\*(.+?)\*\*/)?.[1];
  assert(exactTaskTitle, 'synthetic fixture must retain the complete trusted task title');
  const expectedArchive = archive.replace(heading, heading
    + '- [x] **' + exactTaskTitle + '** — Completed in read-only calibration.\n  - Verified candidate proof evidence.\n\n');
  const expectedMetadata = structuredClone(metadata);
  expectedMetadata.roadmapIds.shift();
  const remaining = new Set(expectedMetadata.roadmapIds);
  for (const id of Object.keys(expectedMetadata.overrides ?? {})) {
    if (!remaining.has(id)) delete expectedMetadata.overrides[id];
    else if (Array.isArray(expectedMetadata.overrides[id].dependsOn)) {
      expectedMetadata.overrides[id].dependsOn = expectedMetadata.overrides[id].dependsOn.filter(dep => remaining.has(dep));
      if (!expectedMetadata.overrides[id].dependsOn.length) delete expectedMetadata.overrides[id].dependsOn;
    }
  }
  const changes = [
    { path: roadmapPath, content: expectedRoadmap },
    { path: archivePath, content: expectedArchive },
    { path: metadataPath, content: JSON.stringify(expectedMetadata, null, 2) + '\n' },
  ];
  const accepted = createSyntheticRoadmapCandidate({ id: 'valid-first-item-closeout', changes });
  assert.equal(validProductRoadmapCloseoutMetadata(base, accepted), true,
    'trusted first-item closeout and mechanically synchronized sidecar must pass');
  const modeAttack = createSyntheticRoadmapCandidate({
    id: 'metadata-chmod-during-valid-closeout',
    baseSha: accepted,
    changes: [{ path: metadataPath, content: JSON.stringify(expectedMetadata, null, 2) + '\n', mode: '100755' }],
  });
  assert.notEqual(gitEntry(accepted, metadataPath), gitEntry(modeAttack, metadataPath),
    'metadata chmod attack must actually alter the Git tree entry');
  assert.equal(validProductRoadmapCloseoutMetadata(base, modeAttack), false,
    'valid closeout must not authorize a metadata file-mode or type mutation');

  const attacks = [
    { id: 'mismatched-archive-title', changes: [changes[0], {
      path: archivePath, content: expectedArchive.replace('- [x] **' + exactTaskTitle + '**', '- [x] **' + firstId + ' — Impostor title**'),
    }, changes[2]] },
    { id: 'metadata-without-roadmap', changes: [{ path: metadataPath, content: JSON.stringify(expectedMetadata) }] },
    { id: 'archive-missing', changes: [changes[0], changes[2]] },
    { id: 'wrong-dependency-pruning', changes: [changes[0], changes[1], {
      path: metadataPath, content: JSON.stringify({ ...expectedMetadata, overrides: { ...expectedMetadata.overrides, [expectedMetadata.roadmapIds[1]]: { ...expectedMetadata.overrides?.[expectedMetadata.roadmapIds[1]], dependsOn: [firstId] } } }),
    }] },
    { id: 'unrelated-proof-profile-change', changes: [changes[0], changes[1], {
      path: metadataPath, content: JSON.stringify({ ...expectedMetadata, schemaVersion: 999 }),
    }] },
    { id: 'roadmap-order-mutation', changes: [{
      path: roadmapPath, content: expectedRoadmap.replace('- [ ] **', '- [ ] **UNAUTHORIZED-'),
    }, changes[1], changes[2]] },
  ];
  for (const attack of attacks) {
    const candidate = createSyntheticRoadmapCandidate(attack);
    assert.equal(validProductRoadmapCloseoutMetadata(base, candidate), false,
      'roadmap-closeout protected-metadata boundary missed attack ' + attack.id);
  }
  // A completed final roadmap item must be archival-eligible too.
  const loneMetadata = structuredClone(metadata);
  loneMetadata.roadmapIds = [firstId];
  for (const id of Object.keys(loneMetadata.overrides ?? {})) {
    if (id !== firstId) delete loneMetadata.overrides[id];
    else if (Array.isArray(loneMetadata.overrides[id].dependsOn)) delete loneMetadata.overrides[id].dependsOn;
  }
  const loneRoadmap = roadmap.split('\n').filter(line => line === taskLine || !line.startsWith('- [ ] **')).join('\n');
  const loneBase = createSyntheticRoadmapCandidate({
    id: 'last-active-item-baseline',
    changes: [
      { path: roadmapPath, content: loneRoadmap },
      { path: metadataPath, content: JSON.stringify(loneMetadata, null, 2) + '\n' },
    ],
  });
  const emptyMetadata = structuredClone(loneMetadata);
  emptyMetadata.roadmapIds = [];
  delete emptyMetadata.overrides[firstId];
  const loneCandidate = createSyntheticRoadmapCandidate({
    id: 'last-active-item-closeout',
    baseSha: loneBase,
    changes: [
      { path: roadmapPath, content: loneRoadmap.replace(taskLine + '\n\n', '') },
      { path: archivePath, content: expectedArchive },
      { path: metadataPath, content: JSON.stringify(emptyMetadata, null, 2) + '\n' },
    ],
  });
  assert.equal(validProductRoadmapCloseoutMetadata(loneBase, loneCandidate), true,
    'closing the final active roadmap item must retain its validated archive and synchronized empty metadata');
  return { accepted: true, attacks: attacks.length + 1, lastItemAccepted: true, fileModeAttackRejected: true, falsePositives: 0, falseNegatives: 0 };
}


function roadmapFixtureRepairBoundaryCalibration() {
  const base = EV18_REFERENCE_SHA;
  const path = 'agent/tests/roadmap-adapter.mjs';
  assert.equal(gitEntry(base, path), '100644 blob 370b6c0f9f8a77de3f8dd00398b11500a4f0e407',
    'reviewed fixture repair must start from the pinned trusted test');
  const previous = gitText(base, path) + '\n';
  let repaired = previous.replace(
    'const driftMissing = clone(metadata);\ndriftMissing.roadmapIds.shift();',
    '// Preserve a valid dependency sidecar when simulating an archived root item,\n'
      + '// so the test asserts roadmap drift rather than unrelated override validation.\n'
      + 'const driftMissing = synchronizeRoadmapMetadata(metadata, roadmapTasks.slice(1));',
  );
  repaired = repaired.replace(
    "const unknownRuleMetadata = clone(metadata);\nconst unknownRuleTasks = clone(roadmapTasks);\nunknownRuleTasks[0].id = 'P29-X1';\nunknownRuleMetadata.roadmapIds[0] = 'P29-X1';",
    "const unknownRuleTasks = clone(roadmapTasks);\nunknownRuleTasks[0].id = 'P29-X1';\n"
      + '// Re-sync overrides for the altered queue so the missing domain rule is the\n'
      + '// defect under test, even if the former first task had an override.\n'
      + 'const unknownRuleMetadata = synchronizeRoadmapMetadata(metadata, unknownRuleTasks);',
  );
  assert.notEqual(repaired, previous, 'fixture repair must modify the negative cases');
  const accepted = createSyntheticRoadmapCandidate({
    id: 'pinned-regression-fixture-repair',
    changes: [{ path, content: repaired }],
  });
  assert.equal(gitEntry(accepted, path), '100644 blob 52d51d6070ba19060ad4e164e161015f1548f4ca',
    'pinned repair must match the independently reviewed exact file object');
  assert.equal(validPinnedRoadmapFixtureRepair(base, accepted), true,
    'only the exact reviewed fixture repair is authorized');
  const attacks = [
    { id: 'unreviewed-test-edit', changes: [{ path, content: repaired + '// attack\n' }] },
    { id: 'test-chmod', changes: [{ path, content: repaired, mode: '100755' }] },
    { id: 'another-protected-agent-edit', changes: [{
      path: 'agent/architecture-invariants.json',
      content: gitText(base, 'agent/architecture-invariants.json') + '\n \n',
    }] },
  ];
  for (const attack of attacks) {
    const candidate = createSyntheticRoadmapCandidate({
      id: attack.id,
      baseSha: accepted,
      changes: attack.changes,
    });
    assert.equal(validPinnedRoadmapFixtureRepair(base, candidate), false,
      'trusted observer permitted unauthorized protected fixture mutation ' + attack.id);
  }
  
return { accepted: true, candidateSha: accepted, attacks: attacks.length, falsePositives: 0, falseNegatives: 0 };
}

function roadmapShadowCloseoutFixtureBundleCalibration(repairedAdapterCandidateSha) {
  const base = EV18_REFERENCE_SHA;
  const scenarioConfigPath = 'agent/roadmap-shadow-simulator.json';
  const scenarioTestPath = 'agent/tests/roadmap-shadow-simulator.mjs';
  const originalConfig = gitText(base, scenarioConfigPath);
  const originalTest = gitText(base, scenarioTestPath);
  const config = originalConfig
    .replace('"taskId": "P28-F6"', '"taskId": "P28-F7"')
    .replace('"probeId": "mission-load-readiness-observer"', '"probeId": "heavy-art-acceptance-readiness-observer"') + '\n';
  const test = originalTest.replaceAll("'P28-F6'", "'P28-F7'") + '\n';
  assert.notEqual(config, originalConfig + '\n');
  assert.notEqual(test, originalTest + '\n');
  const accepted = createSyntheticRoadmapCandidate({
    id: 'exact-three-file-shadow-current-task-closeout',
    baseSha: repairedAdapterCandidateSha,
    changes: [
      { path: scenarioConfigPath, content: config },
      { path: scenarioTestPath, content: test },
    ],
  });
  assert.equal(gitEntry(accepted, scenarioConfigPath), '100644 blob d42628aa3f5defbe63866dd179184c100e7ccc38',
    'reviewed advisory simulator config must match the exact pinned Git entry');
  assert.equal(gitEntry(accepted, scenarioTestPath), '100644 blob f95bd5bd61d874247dd78d88da5e6cab1ec120b5',
    'reviewed advisory simulator test must match the exact pinned Git entry');
  assert.equal(validPinnedRoadmapShadowCloseoutFixtureBundle(base, accepted), true,
    'the exact reviewed three-file closeout fix must be eligible');
  const attacks = [
    { id: 'scenario-not-updated', baseSha: repairedAdapterCandidateSha, changes: [{ path: scenarioTestPath, content: test }] },
    { id: 'unexpected-scenario-change', baseSha: accepted, changes: [{ path: scenarioConfigPath, content: config + '// unreviewed\n' }] },
    { id: 'unexpected-test-change', baseSha: accepted, changes: [{ path: scenarioTestPath, content: test + '// unreviewed\n' }] },
    { id: 'test-file-chmod', baseSha: accepted, changes: [{ path: scenarioTestPath, content: test, mode: '100755' }] },
    { id: 'another-agent-edit', baseSha: accepted, changes: [{ path: 'agent/architecture-invariants.json', content: gitText(base, 'agent/architecture-invariants.json') + '\n ' }] },
  ];
  for (const attack of attacks) {
    const candidate = createSyntheticRoadmapCandidate(attack);
    assert.equal(validPinnedRoadmapShadowCloseoutFixtureBundle(base, candidate), false,
      'protected agent boundary admitted attack ' + attack.id);
  }
  return { accepted: true, attacks: attacks.length, falsePositives: 0, falseNegatives: 0 };
}


 // Real immutable Git blobs, not candidate-declared scenario strings, are the
 // authority for this two-file allowance. After F7 merges, this calibration
 // retires naturally because the *before* entries are absent from trusted main.
 function f7ShadowCloseoutFixtureCalibration() {
   const base = git(['rev-parse', 'HEAD']);
   const configPath = 'agent/roadmap-shadow-simulator.json';
   const testPath = 'agent/tests/roadmap-shadow-simulator.mjs';
   const baseConfig = gitEntry(base, configPath);
   const baseTest = gitEntry(base, testPath);
   if (baseConfig === '100644 blob 475b9c75344844fea5c89bb8e777a1f3f902ceab' && baseTest === '100644 blob 6ea06d7a53eb26ded954e67270697a3b02e35d6b') {
     return { retired: true, attacks: 0, falsePositives: 0, falseNegatives: 0 };
   }
   assert.equal(baseConfig, '100644 blob fd0c368e289bcd84242b63810c2b2e990c3ba088', 'unrecognized pre-F7 shadow config baseline');
   assert.equal(baseTest, '100644 blob 5e9d7b6f5b0fe9ffe73fe4c9bfe22a7b848e5767', 'unrecognized pre-F7 shadow test baseline');
   const configText = git(['cat-file', 'blob', '475b9c75344844fea5c89bb8e777a1f3f902ceab']) + '\n';
   const testText = git(['cat-file', 'blob', '6ea06d7a53eb26ded954e67270697a3b02e35d6b']) + '\n';
   const accepted = createSyntheticRoadmapCandidate({
     id: 'f7-exact-shadow-queue-transition',
     baseSha: base,
     changes: [
       { path: configPath, content: configText },
       { path: testPath, content: testText },
     ],
   });
   assert.equal(gitEntry(accepted, configPath), '100644 blob 475b9c75344844fea5c89bb8e777a1f3f902ceab');
   assert.equal(gitEntry(accepted, testPath), '100644 blob 6ea06d7a53eb26ded954e67270697a3b02e35d6b');
   assert.equal(validPinnedF7ShadowCloseoutFixtureBundle(base, accepted), true,
     'two exact reviewed shadow files must be the only accepted protected change');
   const attacks = [
     { id: 'only-test', baseSha: base, changes: [{ path: testPath, content: testText }] },
     { id: 'only-config', baseSha: base, changes: [{ path: configPath, content: configText }] },
     { id: 'drift-config', baseSha: accepted, changes: [{ path: configPath, content: configText + ' ' }] },
     { id: 'drift-test', baseSha: accepted, changes: [{ path: testPath, content: testText + ' ' }] },
     { id: 'test-chmod', baseSha: accepted, changes: [{ path: testPath, content: testText, mode: '100755' }] },
     { id: 'extra-protected-agent', baseSha: accepted, changes: [{ path: 'agent/architecture-invariants.json', content: gitText(base, 'agent/architecture-invariants.json') + '\n ' }] },
   ];
   for (const attack of attacks) {
     const dishonest = createSyntheticRoadmapCandidate(attack);
     assert.equal(validPinnedF7ShadowCloseoutFixtureBundle(base, dishonest), false,
       'unauthorized F7 shadow fixture mutation admitted: ' + attack.id);
   }
   return { retired: false, attacks: attacks.length, falsePositives: 0, falseNegatives: 0 };
 }

function selfTest() {
  assert.deepEqual([...new Set(EV18_TRANSITION_PATHS)], EV18_TRANSITION_PATHS, 'EV-18 transition paths must be sorted and unique');
  assert.equal(EV18_TRANSITION_PATHS.includes(ROADMAP_PATH), false, 'roadmap state must remain base-owned');
  const calibration = productionTransitionCalibration();
  const compatibility = v10CompatibilityCalibration();
  const roadmapCloseout = roadmapCloseoutBoundaryCalibration();
  const roadmapFixtureRepair = roadmapFixtureRepairBoundaryCalibration();
  const roadmapShadowBundle = roadmapShadowCloseoutFixtureBundleCalibration(roadmapFixtureRepair.candidateSha);
  const f7ShadowBundle = f7ShadowCloseoutFixtureCalibration();
  console.log(`EV9_TRUSTED_V11_SELF_TEST_PASS task=EV-25 transitionAttacks=${calibration.rows.length} falsePositives=${calibration.falsePositives} falseNegatives=${calibration.falseNegatives} compatibilityFalsePositives=${compatibility.falsePositives} compatibilityFalseNegatives=${compatibility.falseNegatives} roadmapCloseoutAttacks=${roadmapCloseout.attacks} roadmapCloseoutCalibration=pass roadmapFixtureRepairAttacks=${roadmapFixtureRepair.attacks} roadmapFixtureRepairCalibration=pass roadmapShadowBundleAttacks=${roadmapShadowBundle.attacks} roadmapShadowBundleCalibration=pass f7ShadowFixtureAttacks=${f7ShadowBundle.attacks} f7ShadowFixtureRetired=${f7ShadowBundle.retired} f7ShadowFixtureCalibration=pass v10LegacyContext=pass v10SupersededFalsePositive=reproduced roadmap=base-owned restoreFallback=pinned treeEntryModes=true reference=${EV18_REFERENCE_SHA}`);
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
