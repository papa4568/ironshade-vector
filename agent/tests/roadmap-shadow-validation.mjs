import assert from 'node:assert/strict';

import {
  materializeExperimentalTasks,
  selectExperimentalReviewTask,
} from '../tools/experimental-review-task.mjs';
import {
  classifyPressurePrediction,
  summarizePressureClassifications,
  validateRoadmapShadowValidationCorpus,
} from '../tools/roadmap-shadow-validation.mjs';

assert.equal(classifyPressurePrediction(true, true), 'true-positive');
assert.equal(classifyPressurePrediction(true, false), 'false-positive');
assert.equal(classifyPressurePrediction(false, true), 'false-negative');
assert.equal(classifyPressurePrediction(false, false), 'true-negative');

const measured = summarizePressureClassifications([
  'true-negative',
  'false-negative',
]);
assert.deepEqual(measured, {
  truePositives: 0,
  trueNegatives: 1,
  falsePositives: 0,
  falseNegatives: 1,
  evaluatedSignalCount: 2,
  usefulPredictionCount: 1,
  falseAlarmCount: 0,
  missedIntegrationPressureCount: 1,
  accuracy: 0.5,
  falsePositiveRate: 0,
  falseNegativeRate: 1,
});

const synthetic = {
  schemaVersion: 1,
  taskId: 'EV-19',
  mode: 'advisory',
  prediction: {
    taskId: 'P28-PLOAD2',
    probeId: 'mission-load-readiness-observer',
    ev7CandidateSha: '1'.repeat(40),
    configPath: 'agent/roadmap-shadow-simulator.json',
    configBlobSha: '2'.repeat(40),
    expectedFrictionScore: 1,
    expectedRewritePressure: 'low',
    preferredSurfaceCount: 2,
    expectedSurfaces: ['src/a.ts', 'src/b.ts'],
  },
  actualOutcome: {
    kind: 'implementation-attempt',
    pullRequest: 366,
    baseSha: '3'.repeat(40),
    headSha: '4'.repeat(40),
    requiredChangedPaths: ['tests/p28-pload2-map-load-readiness.ts'],
    productionPrefix: 'src/',
    testPrefix: 'tests/',
    behaviorTestPath: 'tests/p28-pload2-map-load-readiness.ts',
    behaviorImplementationPath: 'src/game/babylonRefineryMissionReadiness.ts',
    behaviorPassMarker: 'P28_PLOAD2_MAP_LOAD_READINESS_PASS',
    behaviorRunCount: 3,
  },
  signals: [
    {
      id: 'shared-readiness-decision-reuse',
      kind: 'behavior-regression',
      predictedPressure: false,
    },
    {
      id: 'surface-count-pressure',
      kind: 'surface-count',
      predictedPressure: false,
      preferredSurfaceCount: 2,
    },
  ],
  unsupportedSignals: [
    {
      id: 'public-readiness-observer-surface',
      reason: 'later implementation did not consume the exact EV-7 public observer surface',
    },
    {
      id: 'renderer-boundary-independence',
      reason: 'absence of a dependency is not outcome evidence when the later implementation did not exercise that surface',
    },
  ],
  unsupportedScenarios: [
    { taskId: 'P28-G1', reason: 'not implemented' },
  ],
  promotionBoundary: {
    acceptedForEnforcement: false,
    candidatePassGranted: false,
    blocking: false,
  },
};
assert.equal(validateRoadmapShadowValidationCorpus(synthetic), synthetic);
assert.throws(
  () => validateRoadmapShadowValidationCorpus({ ...synthetic, mode: 'enforced' }),
  /must remain advisory/,
);
assert.throws(
  () => validateRoadmapShadowValidationCorpus({
    ...synthetic,
    promotionBoundary: { ...synthetic.promotionBoundary, acceptedForEnforcement: true },
  }),
  /cannot accept enforcement/,
);
assert.throws(
  () => validateRoadmapShadowValidationCorpus({
    ...synthetic,
    unsupportedScenarios: [],
  }),
  /P28-G1 must remain explicitly unsupported/,
);
assert.throws(
  () => validateRoadmapShadowValidationCorpus({
    ...synthetic,
    unsupportedSignals: synthetic.unsupportedSignals.filter(signal => signal.id !== 'public-readiness-observer-surface'),
  }),
  /public readiness observer surface must remain unsupported/,
);
assert.throws(
  () => validateRoadmapShadowValidationCorpus({
    ...synthetic,
    signals: [
      ...synthetic.signals,
      { id: 'static-token-presence', kind: 'required-contract', predictedPressure: false },
    ],
  }),
  /exactly two outcome-backed/,
);

const blockedBaseRoadmap = [
  '# Experimental verification roadmap',
  '',
  '## Active experimental queue',
  '',
  '- [ ] **EV-18 — Reuse proof class**',
  '  - **Blocked by EV-17 calibration evidence:** causal inputs remain unbound.',
  '  - Preserve rollback.',
  '',
  '- [ ] **EV-19 — Validate roadmap pressure**',
  '  - Measure prediction accuracy.',
  '',
  '- [ ] **EV-20 — Graduate signal**',
  '  - Review validated signals only.',
].join('\n');
const blockedTasks = materializeExperimentalTasks(blockedBaseRoadmap);
assert.equal(blockedTasks[0].id, 'EV-18');
assert.equal(blockedTasks[0].status, 'blocked');
assert.equal(blockedTasks[1].id, 'EV-19');
assert.equal(blockedTasks[1].status, 'ready');
const blockedHeadRoadmap = blockedBaseRoadmap.replace(
  '- [ ] **EV-19 — Validate roadmap pressure**\n  - Measure prediction accuracy.\n\n',
  '',
);
const blockedCloseout = selectExperimentalReviewTask(blockedHeadRoadmap, { baseMarkdown: blockedBaseRoadmap });
assert.equal(blockedCloseout.task.id, 'EV-19');
assert.equal(blockedCloseout.mode, 'experimental-closeout');
const nextActionable = selectExperimentalReviewTask(blockedHeadRoadmap);
assert.equal(nextActionable.task.id, 'EV-20');
assert.equal(nextActionable.mode, 'experimental');

console.log(`EV19_ROADMAP_SHADOW_VALIDATION_TEST_PASS useful=${measured.usefulPredictionCount} fp=${measured.falsePositives} fn=${measured.falseNegatives} unsupported=2 blockedCloseout=${blockedCloseout.task.id} next=${nextActionable.task.id} blocking=false`);
