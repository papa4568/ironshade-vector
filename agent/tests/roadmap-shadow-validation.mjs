import assert from 'node:assert/strict';

import {
  materializeExperimentalTasks,
  selectExperimentalReviewTask,
} from '../tools/experimental-review-task.mjs';
import {
  summarizeSurfacePrediction,
  validateRoadmapShadowValidationCorpus,
} from '../tools/roadmap-shadow-validation.mjs';

const surfaceSummary = summarizeSurfacePrediction(
  ['src/game/combatGraphicsBackendCore.ts', 'src/game/missionVisualReadinessGate.ts'],
  [
    'src/game/babylonCombatRenderer.ts',
    'src/game/babylonRefineryMissionReadiness.ts',
    'src/game/combatGraphicsBackendCore.ts',
    'src/game/mapLoadReadinessTelemetry.ts',
  ],
);
assert.deepEqual(surfaceSummary, {
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
    expectedSurfaces: ['src/game/combatGraphicsBackend.ts', 'src/game/missionVisualReadinessGate.ts'],
  },
  actualOutcome: {
    kind: 'implementation-attempt',
    pullRequest: 366,
    baseSha: '3'.repeat(40),
    headSha: '4'.repeat(40),
    featureIntroductionSha: '5'.repeat(40),
    requiredChangedPaths: ['tests/p28-pload2-map-load-readiness.ts'],
    productionPrefix: 'src/',
    testPrefix: 'tests/',
    behaviorTestPath: 'tests/p28-pload2-map-load-readiness.ts',
    behaviorImplementationPath: 'src/game/babylonRefineryMissionReadiness.ts',
    behaviorPassMarker: 'P28_PLOAD2_MAP_LOAD_READINESS_PASS',
    behaviorRunCount: 3,
  },
  surfaceLineage: [
    {
      predictionPath: 'src/game/combatGraphicsBackend.ts',
      resolvedPath: 'src/game/combatGraphicsBackendCore.ts',
      migrationCommit: '6'.repeat(40),
      migrationParent: '7'.repeat(40),
      publicFacadePath: 'src/game/combatGraphicsBackend.ts',
      publicFacadeExport: "export * from './combatGraphicsBackendCore';",
      carryoverContracts: [
        'export type MissionVisualReadiness = {',
        'missionVisualReadiness?(): MissionVisualReadiness;',
      ],
    },
  ],
  unsupportedSignals: [
    {
      id: 'extension-point:missionVisualReadiness-observer',
      reason: 'later implementation did not consume the exact prior observer extension point',
    },
    {
      id: 'forbidden-dependency:public-backend-no-static-babylon-import',
      reason: 'later implementation did not modify the public facade carrying this prior rule',
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
    surfaceLineage: [{ ...synthetic.surfaceLineage[0], predictionPath: 'src/game/postHocSurface.ts' }],
  }),
  /source must be a frozen EV-7 expected surface/,
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
    unsupportedSignals: synthetic.unsupportedSignals.map(signal => signal.id.startsWith('extension-point:')
      ? { ...signal, id: 'post-hoc-behavior-signal' }
      : signal),
  }),
  /observer extension-point signal must remain unsupported/,
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

console.log(`EV19_ROADMAP_SHADOW_VALIDATION_TEST_PASS useful=${surfaceSummary.usefulPredictionCount} fp=${surfaceSummary.falseAlarmCount} fn=${surfaceSummary.missedIntegrationPressureCount} precision=${surfaceSummary.precision} recall=${surfaceSummary.recall} blockedCloseout=${blockedCloseout.task.id} next=${nextActionable.task.id} blocking=false`);
