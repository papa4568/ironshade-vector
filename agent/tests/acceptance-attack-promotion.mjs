import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildAcceptanceAttackDecision,
  evaluateAcceptanceAttackScope,
  validateAcceptanceAttackPolicy,
} from '../tools/acceptance-attack-gate.mjs';
import {
  evaluateDishonestAttack,
  exerciseRuntimeCalibration,
  validateRuntimeCalibrationConfig,
} from '../tools/acceptance-attack-runtime-calibration.mjs';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function exerciseRuntimeIsolationRegression() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'ironshade-runtime-calibration-regression-'));
  const targetPath = join(fixtureRoot, 'target.mjs');
  const sentinelPath = join(fixtureRoot, 'source-sentinel.txt');
  const ignoredSentinelPath = join(fixtureRoot, 'ignored-source-sentinel.txt');
  const verifierPath = join(fixtureRoot, 'verify.mjs');
  const dependencyDir = join(fixtureRoot, 'node_modules');
  const dependencySentinelPath = join(dependencyDir, 'dependency-sentinel.txt');
  const previousGithubWorkspace = process.env.GITHUB_WORKSPACE;
  const previousInitCwd = process.env.INIT_CWD;
  const previousPwd = process.env.PWD;

  try {
    execFileSync('git', ['init', '--quiet'], { cwd: fixtureRoot });
    execFileSync('git', ['config', 'user.email', 'ev8-runtime-isolation@example.invalid'], { cwd: fixtureRoot });
    execFileSync('git', ['config', 'user.name', 'EV-8 Runtime Isolation Regression'], { cwd: fixtureRoot });

    await writeFile(targetPath, 'export const batchSize = 4;\n');
    await writeFile(sentinelPath, 'source sentinel\n');
    await writeFile(join(fixtureRoot, '.gitignore'), 'ignored-source-sentinel.txt\n');
    await writeFile(verifierPath, `import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const remotes = execFileSync('git', ['remote'], { encoding: 'utf8' }).trim();
if (remotes) {
  console.error(\`runtime calibration sandbox retained remote: \${remotes}\`);
  process.exit(2);
}
const workspace = process.env.GITHUB_WORKSPACE;
if (!workspace) {
  console.error('runtime calibration verifier workspace was not provided');
  process.exit(5);
}
appendFileSync(join(workspace, 'ignored-source-sentinel.txt'), 'sandbox workspace mutation\\n');
const dependencySentinel = readFileSync('node_modules/dependency-sentinel.txt', 'utf8');
if (dependencySentinel !== 'source dependency sentinel\\n') {
  console.error(\`runtime calibration dependency state leaked across trials: \${JSON.stringify(dependencySentinel)}\`);
  process.exit(4);
}
appendFileSync('node_modules/dependency-sentinel.txt', 'sandbox dependency mutation\\n');
const target = readFileSync('target.mjs', 'utf8');
if (target.includes('batchSize = 1;')) {
  console.error('runtime isolation fixture batch size 1');
  process.exit(1);
}
if (target.includes('batchSize = 4;') || target.includes('batchSize = 2 + 2;')) {
  console.log('RUNTIME_ISOLATION_FIXTURE_PASS');
  process.exit(0);
}
console.error('runtime isolation fixture unknown target state');
process.exit(3);
`);
    execFileSync('git', ['add', 'target.mjs', 'verify.mjs', 'source-sentinel.txt', '.gitignore'], { cwd: fixtureRoot });
    execFileSync('git', ['commit', '--quiet', '-m', 'runtime isolation fixture'], { cwd: fixtureRoot });
    await writeFile(ignoredSentinelPath, 'source ignored sentinel\n');
    await mkdir(dependencyDir);
    await writeFile(dependencySentinelPath, 'source dependency sentinel\n');

    const fixtureSha = git(['rev-parse', 'HEAD'], fixtureRoot);
    const fixtureConfig = {
      verifyCommand: 'node verify.mjs',
      targetFile: 'target.mjs',
      passMarker: 'RUNTIME_ISOLATION_FIXTURE_PASS',
      dependencyStrategy: 'isolated-node-modules-copy',
      negativeControls: [
        {
          id: 'equivalent-batch-expression',
          replacement: {
            find: 'export const batchSize = 4;',
            replace: 'export const batchSize = 2 + 2;',
          },
        },
      ],
      attack: {
        templateId: 'hidden-serialization',
        replacement: {
          find: 'export const batchSize = 4;',
          replace: 'export const batchSize = 1;',
        },
        expectedFailurePatterns: ['runtime isolation fixture batch size 1'],
      },
    };

    process.env.GITHUB_WORKSPACE = fixtureRoot;
    process.env.INIT_CWD = fixtureRoot;
    process.env.PWD = fixtureRoot;
    const report = await exerciseRuntimeCalibration({
      candidateSha: fixtureSha,
      config: fixtureConfig,
      repoRoot: fixtureRoot,
    });
    assert.equal(report.isolation.strategy, 'disposable-clone');
    assert.equal(report.isolation.sourceHead, fixtureSha);
    assert.equal(report.isolation.sourceUnchanged, true, 'runtime calibration must prove its source repository stayed unchanged');
    assert.equal(report.isolation.sandboxRemoteDetached, true, 'runtime verifier itself must observe a detached sandbox remote');
    assert.equal(report.isolation.environmentIsolation.workspaceRebased, true, 'runtime verifier workspace must be rebound to disposable state');
    assert.equal(report.isolation.environmentIsolation.sourcePathVariablesExposed, false, 'runtime verifier environment must not expose the source repository path');
    assert.equal(report.isolation.dependencyIsolation.strategy, 'isolated-node-modules-copy');
    assert.equal(report.isolation.dependencyIsolation.writableSourceDependencyPathExposed, false);
    assert.equal(report.negativeControls[0].falsePositive, false);
    assert.equal(report.attack.detected, true);
    assert.equal(
      await readFile(ignoredSentinelPath, 'utf8'),
      'source ignored sentinel\n',
      'a verifier write through GITHUB_WORKSPACE must be contained in the disposable clone even for git-ignored paths',
    );
    assert.equal(
      await readFile(dependencySentinelPath, 'utf8'),
      'source dependency sentinel\n',
      'verifier writes through sandbox node_modules must never mutate source dependencies',
    );
    assert.equal(git(['status', '--porcelain=v1', '--untracked-files=all'], fixtureRoot), '?? node_modules/dependency-sentinel.txt', 'successful runtime calibration must preserve the source fixture including ignored and dependency state');

    const dependencyEscapePath = join(dependencyDir, 'escape-to-source');
    await symlink(sentinelPath, dependencyEscapePath);
    await assert.rejects(
      exerciseRuntimeCalibration({
        candidateSha: fixtureSha,
        config: fixtureConfig,
        repoRoot: fixtureRoot,
      }),
      /runtime calibration dependency symlink escapes disposable clone/,
      'runtime calibration must reject dependency links that expose writable source paths to the verifier',
    );
    await unlink(dependencyEscapePath);
  } finally {
    if (previousGithubWorkspace === undefined) delete process.env.GITHUB_WORKSPACE;
    else process.env.GITHUB_WORKSPACE = previousGithubWorkspace;
    if (previousInitCwd === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = previousInitCwd;
    if (previousPwd === undefined) delete process.env.PWD;
    else process.env.PWD = previousPwd;
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

await exerciseRuntimeIsolationRegression();

const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const policy = validateAcceptanceAttackPolicy(JSON.parse(await readFile('agent/acceptance-attack-policy.json', 'utf8')));
assert.equal(policy.enforcementEnabled, true, 'EV-8 policy must enable the measured promoted scope by default');
assert.equal(policy.scopes.length, 1, 'EV-8 must promote only the measured deterministic subset');
const [scope] = policy.scopes;
assert.deepEqual(scope.enforcedTemplateIds, ['hidden-serialization'], 'unsupported EV-1 templates must remain advisory');
assert.equal(
  scope.runtimeCalibration.verifyCommand,
  'npm run prepare:graphics-assets && ./node_modules/.bin/vite build --ssr tests/p28-pload1-refinery-placement-runtime.ts --outDir .acceptance-attack-runtime-dist && node .acceptance-attack-runtime-dist/p28-pload1-refinery-placement-runtime.js',
  'promotion must exercise the dedicated real P28-PLOAD1 runtime oracle without unrelated source-shape guards',
);
assert.equal(scope.runtimeCalibration.targetFile, 'src/game/babylonCombatRenderer.ts', 'promotion must mutate the production refinery loader');
assert.equal(scope.runtimeCalibration.dependencyStrategy, 'isolated-node-modules-copy', 'runtime verifier dependencies must be copied into disposable state');
assert.equal(scope.runtimeCalibration.negativeControls.length, 1, 'promotion must measure at least one negative control');
assert.equal(scope.calibration.promotedFalsePositiveBudget, 0);
assert.equal(scope.calibration.promotedFalseNegativeBudget, 0);
validateRuntimeCalibrationConfig(scope.runtimeCalibration);

const shadowReport = {
  taskId: scope.taskId,
  baseline: { exitCode: 0 },
  isolation: { sourceUnchanged: true, sandboxRemoteDetached: true },
  results: [
    { templateId: 'false-readiness', outcome: 'proof-gap' },
    { templateId: 'fake-telemetry', outcome: 'proof-gap' },
    { templateId: 'skipped-quality-work', outcome: 'proof-gap' },
    { templateId: 'hidden-serialization', outcome: 'caught' },
    { templateId: 'special-cased-test-route', outcome: 'proof-gap' },
    { templateId: 'omitted-resource-work', outcome: 'proof-gap' },
  ],
  summary: { total: 6, caught: 1, proofGaps: 5 },
};

const runtimeReport = {
  candidateSha,
  baseline: { exitCode: 0, passed: true, markerMatched: true },
  negativeControls: [
    {
      id: 'equivalent-batch-size-expression',
      passed: true,
      falsePositive: false,
      markerMatched: true,
    },
  ],
  attack: {
    templateId: 'hidden-serialization',
    detected: true,
    falseNegative: false,
    nonZeroExit: true,
    matchedPatterns: ['runtime refinery load must retain batch size 4, got 1'],
    expectedFailurePatterns: ['runtime refinery load must retain batch size 4, got 1'],
    failureReason: null,
  },
  calibration: {
    falsePositiveTrials: 1,
    falsePositives: 0,
    falsePositiveRate: 0,
    falseNegativeTrials: 1,
    falseNegatives: 0,
    falseNegativeRate: 0,
  },
  isolation: {
    sourceUnchanged: true,
    sandboxRemoteDetached: true,
    environmentIsolation: { workspaceRebased: true, sourcePathVariablesExposed: false },
    dependencyIsolation: { strategy: 'isolated-node-modules-copy', writableSourceDependencyPathExposed: false },
  },
};

const result = evaluateAcceptanceAttackScope({ shadowReport, runtimeReport }, scope);
assert.equal(result.pass, true);
assert.deepEqual(result.enforcedTemplateIds, ['hidden-serialization']);
assert.deepEqual(result.enforcedResults, [
  {
    templateId: 'hidden-serialization',
    detected: true,
    falseNegative: false,
    nonZeroExit: true,
    matchedFailurePatterns: ['runtime refinery load must retain batch size 4, got 1'],
    expectedFailurePatterns: ['runtime refinery load must retain batch size 4, got 1'],
  },
]);
assert.deepEqual(result.calibration.promoted, {
  falsePositiveTrials: 1,
  falsePositives: 0,
  falsePositiveRate: 0,
  falseNegativeTrials: 1,
  falseNegatives: 0,
  falseNegativeRate: 0,
});
assert.deepEqual(
  result.advisory.survivors,
  ['fake-telemetry', 'false-readiness', 'omitted-resource-work', 'skipped-quality-work', 'special-cased-test-route'],
  'unsupported dishonest variants must stay advisory instead of becoming accidental blockers',
);
assert.equal(result.isolation.runtimeSourceUnchanged, true);
assert.equal(result.isolation.runtimeRemoteDetached, true);
assert.equal(result.isolation.dependencyStrategy, 'isolated-node-modules-copy');

const gate = buildAcceptanceAttackDecision({ policy, candidateSha, scopeResults: [{ ...result, sourceHead: candidateSha, fullShadowSummary: shadowReport.summary }] });
assert.equal(gate.schema, 'ironshade-acceptance-attack-gate:v1');
assert.equal(gate.candidateSha, candidateSha);
assert.equal(gate.mode, 'enforced');
assert.equal(gate.verdict, 'pass');
assert.equal(gate.blocking, false);
assert.equal(gate.candidatePassGranted, false, 'the attack gate may block but must never synthesize candidate acceptance');

const survivingAttack = {
  ...runtimeReport,
  attack: {
    ...runtimeReport.attack,
    detected: false,
    falseNegative: true,
    nonZeroExit: false,
    matchedPatterns: [],
    failureReason: 'dishonest runtime mutation survived the real verifier',
  },
  calibration: {
    ...runtimeReport.calibration,
    falseNegatives: 1,
    falseNegativeRate: 1,
  },
};
const survivorResult = evaluateAcceptanceAttackScope({ shadowReport, runtimeReport: survivingAttack }, scope);
assert.equal(survivorResult.pass, false, 'a surviving promoted dishonest mutation must fail closed');
assert.equal(survivorResult.calibration.promoted.falseNegatives, 1);
assert.match(survivorResult.blockingReasons.join('\n'), /false negatives 1 exceed budget 0/);
assert.match(survivorResult.blockingReasons.join('\n'), /survived the real verifier/);

const unrelatedFailure = evaluateDishonestAttack(
  { exitCode: 1, signal: null, stdout: '', stderr: 'SyntaxError: unrelated verifier crash' },
  ['runtime refinery load must retain batch size 4, got 1'],
);
assert.equal(unrelatedFailure.detected, false, 'an arbitrary nonzero verifier exit must not count as catching the promoted attack');
assert.equal(unrelatedFailure.falseNegative, true);
assert.equal(unrelatedFailure.nonZeroExit, true);
assert.match(unrelatedFailure.failureReason, /did not match the promoted acceptance criterion/);

const falsePositiveControl = {
  ...runtimeReport,
  negativeControls: [{
    id: 'equivalent-batch-size-expression',
    passed: false,
    falsePositive: true,
    markerMatched: false,
  }],
  calibration: {
    ...runtimeReport.calibration,
    falsePositives: 1,
    falsePositiveRate: 1,
  },
};
const falsePositiveResult = evaluateAcceptanceAttackScope({ shadowReport, runtimeReport: falsePositiveControl }, scope);
assert.equal(falsePositiveResult.pass, false, 'a verifier that rejects the equivalent negative control must fail promotion');
assert.match(falsePositiveResult.blockingReasons.join('\n'), /false positives 1 exceed budget 0/);

const rollback = buildAcceptanceAttackDecision({
  policy,
  candidateSha,
  scopeResults: [{ ...survivorResult, sourceHead: candidateSha, fullShadowSummary: shadowReport.summary }],
  enforcementOverride: false,
});
assert.equal(rollback.mode, 'advisory-rollback');
assert.equal(rollback.enforcementEnabled, false);
assert.equal(rollback.verdict, 'disabled-advisory');
assert.equal(rollback.blocking, false, 'rollback must disable only the promoted blocking decision');
assert.deepEqual(rollback.scopes[0].fullShadowSummary, shadowReport.summary, 'rollback must retain the pre-promotion shadow evidence');
assert.equal(rollback.rollback.restoresAdvisoryBehavior, true);
assert.equal(rollback.candidatePassGranted, false);

assert.throws(
  () => validateAcceptanceAttackPolicy({ ...policy, scopes: [{ ...scope, enforcedTemplateIds: [] }] }),
  /enforcedTemplateIds must be non-empty/,
  'an empty promoted scope must fail closed',
);
assert.throws(
  () => validateAcceptanceAttackPolicy({ ...policy, scopes: [{ ...scope, runtimeCalibration: undefined }] }),
  /runtime calibration config must be an object/,
  'missing measured runtime calibration must fail closed',
);
assert.throws(
  () => validateAcceptanceAttackPolicy({
    ...policy,
    scopes: [{
      ...scope,
      calibration: { ...scope.calibration, promotedFalseNegativeBudget: 1 },
    }],
  }),
  /promoted false-negative budget must be zero/,
  'promotion policy must not relax the zero false-negative requirement',
);

console.log(`ACCEPTANCE_ATTACK_PROMOTION_REGRESSIONS_PASS candidate=${candidateSha} scope=${scope.id} runtimeIsolation=exercised+fault-tested dependencyIsolation=fresh-copy+write-contained+escape-rejected environmentIsolation=workspace-rebased+ignored-write-contained measuredControl=true criterionMatchedFailure=true falsePositiveBudget=0 falseNegativeBudget=0 advisorySurvivors=${result.advisory.survivors.length} rollback=advisory`);
