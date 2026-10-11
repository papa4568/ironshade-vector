import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import {
  buildAcceptanceAttackDecision,
  evaluateAcceptanceAttackScope,
  validateAcceptanceAttackPolicy,
} from '../tools/acceptance-attack-gate.mjs';
import {
  evaluateDishonestAttack,
  validateRuntimeCalibrationConfig,
} from '../tools/acceptance-attack-runtime-calibration.mjs';

const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const policy = validateAcceptanceAttackPolicy(JSON.parse(await readFile('agent/acceptance-attack-policy.json', 'utf8')));
assert.equal(policy.enforcementEnabled, true, 'EV-8 policy must enable the measured promoted scope by default');
assert.equal(policy.scopes.length, 1, 'EV-8 must promote only the measured deterministic subset');
const [scope] = policy.scopes;
assert.deepEqual(scope.enforcedTemplateIds, ['hidden-serialization'], 'unsupported EV-1 templates must remain advisory');
assert.equal(scope.runtimeCalibration.verifyCommand, 'npm run test:graphics:babylon', 'promotion must exercise the real P28-PLOAD1 runtime regression');
assert.equal(scope.runtimeCalibration.targetFile, 'src/game/babylonCombatRenderer.ts', 'promotion must mutate the production refinery loader');
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
    dependencyIsolation: { strategy: 'source-node-modules-symlink' },
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
assert.equal(result.isolation.dependencyStrategy, 'source-node-modules-symlink');

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

console.log(`ACCEPTANCE_ATTACK_PROMOTION_REGRESSIONS_PASS candidate=${candidateSha} scope=${scope.id} measuredControl=true criterionMatchedFailure=true falsePositiveBudget=0 falseNegativeBudget=0 advisorySurvivors=${result.advisory.survivors.length} rollback=advisory`);
