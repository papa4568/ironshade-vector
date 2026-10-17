import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  buildRoadmapShadowPromotionDecision,
  normalizeTrialSurfaces,
  summarizeSurfacePrediction,
  validateAdvisoryRollbackBoundary,
  validateEv19EvidenceBoundary,
  validateNoPromotionPolicy,
} from '../tools/roadmap-shadow-promotion.mjs';

const policy = JSON.parse(await readFile('agent/roadmap-shadow-promotion-policy.json', 'utf8'));
const corpus = JSON.parse(await readFile('agent/roadmap-shadow-validation-corpus.json', 'utf8'));
validateNoPromotionPolicy(policy);
const trials = validateEv19EvidenceBoundary(corpus, policy);

assert.deepEqual(normalizeTrialSurfaces(corpus.predictionTrials[0]), [
  'src/game/combatGraphicsBackendCore.ts',
  'src/game/missionVisualReadinessGate.ts',
]);
assert.deepEqual(normalizeTrialSurfaces(corpus.predictionTrials[1]), [
  'src/game/combatGraphicsBackend.ts',
  'src/game/combatGraphicsBackendCore.ts',
  'src/game/missionVisualReadinessGate.ts',
]);

assert.deepEqual(trials[0].surfacePrediction, {
  predictedSurfaceCount: 2,
  actualSurfaceCount: 4,
  truePositiveSurfaces: ['src/game/combatGraphicsBackendCore.ts'],
  falsePositiveSurfaces: ['src/game/missionVisualReadinessGate.ts'],
  falseNegativeSurfaces: [
    'src/game/babylonCombatRenderer.ts',
    'src/game/babylonRefineryMissionReadiness.ts',
    'src/game/mapLoadReadinessTelemetry.ts',
  ],
  usefulPredictionCount: 1,
  falseAlarmCount: 1,
  missedIntegrationPressureCount: 3,
  precision: 0.5,
  recall: 0.25,
});
assert.equal(trials[1].surfacePrediction.usefulPredictionCount, 1);
assert.equal(trials[1].surfacePrediction.falseAlarmCount, 2);
assert.equal(trials[1].surfacePrediction.missedIntegrationPressureCount, 3);
assert.equal(trials[1].surfacePrediction.precision, 0.333333);
assert.equal(trials[1].surfacePrediction.recall, 0.25);

assert.throws(() => validateNoPromotionPolicy({
  ...policy,
  decision: { ...policy.decision, promote: true },
}), /must not promote/);
assert.throws(() => validateNoPromotionPolicy({
  ...policy,
  decision: { ...policy.decision, acceptedForEnforcement: true },
}), /must not accept enforcement/);
assert.throws(() => validateEv19EvidenceBoundary({
  ...corpus,
  promotionBoundary: { ...corpus.promotionBoundary, crossTaskGeneralizationEstablished: true },
}, policy), /unexpectedly claims cross-task generalization/);

assert.deepEqual(summarizeSurfacePrediction(['a', 'b'], ['a', 'c']), {
  predictedSurfaceCount: 2,
  actualSurfaceCount: 2,
  truePositiveSurfaces: ['a'],
  falsePositiveSurfaces: ['b'],
  falseNegativeSurfaces: ['c'],
  usefulPredictionCount: 1,
  falseAlarmCount: 1,
  missedIntegrationPressureCount: 1,
  precision: 0.5,
  recall: 0.5,
});

const rollback = validateAdvisoryRollbackBoundary({
  simulator: { mode: 'advisory' },
  prCandidateWorkflow: `- name: Capture EV-7 roadmap shadow simulator advisory evidence\n  continue-on-error: true\n  run: node agent/tools/roadmap-shadow-simulator.mjs\n`,
  agentOrchestrationWorkflow: `- name: Run roadmap shadow simulator regressions\n  run: node agent/tests/roadmap-shadow-simulator.mjs\n`,
  referencePaths: ['agent/tools/roadmap-shadow-simulator.mjs', '.github/workflows/pr-candidate.yml'],
});
assert.equal(rollback.simulatorDisableRestoresPreviousAcceptancePath, true);
assert.throws(() => validateAdvisoryRollbackBoundary({
  simulator: { mode: 'advisory' },
  prCandidateWorkflow: `- name: Capture EV-7 roadmap shadow simulator advisory evidence\n  run: node agent/tools/roadmap-shadow-simulator.mjs\n`,
  agentOrchestrationWorkflow: `- name: Run roadmap shadow simulator regressions\n  run: node agent/tests/roadmap-shadow-simulator.mjs\n`,
  referencePaths: [],
}), /continue-on-error advisory evidence/);
assert.throws(() => validateAdvisoryRollbackBoundary({
  simulator: { mode: 'advisory' },
  prCandidateWorkflow: `- name: Capture EV-7 roadmap shadow simulator advisory evidence\n  continue-on-error: true\n  run: node agent/tools/roadmap-shadow-simulator.mjs\n`,
  agentOrchestrationWorkflow: `- name: Run roadmap shadow simulator regressions\n  run: node agent/tests/roadmap-shadow-simulator.mjs\n`,
  referencePaths: ['agent/tools/candidate-evidence.mjs'],
}), /leaked into candidate acceptance/);

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const report = await buildRoadmapShadowPromotionDecision({ candidateSha: head });
assert.equal(report.taskId, 'EV-20');
assert.equal(report.candidateSha, head);
assert.equal(report.decision, 'no-promotion');
assert.equal(report.detectorCalibration.falsePositives, 0);
assert.equal(report.detectorCalibration.falseNegatives, 0);
assert.equal(report.promotionBoundary.distinctProductOutcomes, 1);
assert.equal(report.promotionBoundary.crossTaskGeneralizationEstablished, false);
assert.equal(report.promotionBoundary.acceptedForEnforcement, false);
assert.equal(report.rollback.simulatorDisableRestoresPreviousAcceptancePath, true);
assert.equal(report.preservedBoundary.authoritativeHeuristicScore, false);

console.log('EV20_ROADMAP_SHADOW_NO_PROMOTION_TEST_PASS original=1tp/1fp/3fn migrated=1tp/2fp/3fn detector=0fp/0fn outcomes=1 crossTask=false enforcement=false rollback=advisory-removable');
