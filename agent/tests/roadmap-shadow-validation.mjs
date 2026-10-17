import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  evaluatePredeclaredTrialRepeatability,
  summarizeSurfacePrediction,
  validateRoadmapShadowValidationCorpus,
} from '../tools/roadmap-shadow-validation.mjs';

const corpus = validateRoadmapShadowValidationCorpus(
  JSON.parse(await readFile(resolve('agent/roadmap-shadow-validation-corpus.json'), 'utf8')),
);

assert.equal(corpus.mode, 'advisory');
assert.equal(corpus.predictionTrials.length, 2);
assert.equal(corpus.supportedSignals.length, 1);
assert.equal(corpus.promotionBoundary.acceptedForEnforcement, false);
assert.equal(corpus.promotionBoundary.crossTaskGeneralizationEstablished, false);

const actual = corpus.actualOutcome.expectedProductionSurfaces;
const original = summarizeSurfacePrediction(
  ['src/game/combatGraphicsBackendCore.ts', 'src/game/missionVisualReadinessGate.ts'],
  actual,
);
assert.deepEqual(original.truePositiveSurfaces, ['src/game/combatGraphicsBackendCore.ts']);
assert.deepEqual(original.falsePositiveSurfaces, ['src/game/missionVisualReadinessGate.ts']);
assert.deepEqual(original.falseNegativeSurfaces, [
  'src/game/babylonCombatRenderer.ts',
  'src/game/babylonRefineryMissionReadiness.ts',
  'src/game/mapLoadReadinessTelemetry.ts',
]);
assert.equal(original.usefulPredictionCount, 1);
assert.equal(original.falseAlarmCount, 1);
assert.equal(original.missedIntegrationPressureCount, 3);
assert.equal(original.precision, 0.5);
assert.equal(original.recall, 0.25);

const migrated = summarizeSurfacePrediction(
  corpus.predictionTrials[1].expectedSurfaces,
  actual,
);
assert.deepEqual(migrated.truePositiveSurfaces, ['src/game/combatGraphicsBackendCore.ts']);
assert.deepEqual(migrated.falsePositiveSurfaces, [
  'src/game/combatGraphicsBackend.ts',
  'src/game/missionVisualReadinessGate.ts',
]);
assert.deepEqual(migrated.falseNegativeSurfaces, [
  'src/game/babylonCombatRenderer.ts',
  'src/game/babylonRefineryMissionReadiness.ts',
  'src/game/mapLoadReadinessTelemetry.ts',
]);
assert.equal(migrated.usefulPredictionCount, 1);
assert.equal(migrated.falseAlarmCount, 2);
assert.equal(migrated.missedIntegrationPressureCount, 3);
assert.equal(migrated.precision, 0.333333);
assert.equal(migrated.recall, 0.25);

const signal = corpus.supportedSignals[0];
const trials = corpus.predictionTrials.map(trial => ({
  id: trial.id,
  candidateSha: trial.candidateSha,
  configBlobSha: trial.configBlobSha,
  normalizedExpectedSurfaces: trial.id === 'ev7-original'
    ? ['src/game/combatGraphicsBackendCore.ts', 'src/game/missionVisualReadinessGate.ts']
    : [...trial.expectedSurfaces],
  predeclared: true,
  directOutcomeHit: true,
}));

const repeatable = evaluatePredeclaredTrialRepeatability(trials, signal);
assert.equal(repeatable.established, true);
assert.equal(repeatable.hitCount, 2);
assert.equal(repeatable.distinctPredictionCandidateCount, 2);
assert.equal(repeatable.distinctConfigBlobCount, 2);

const duplicate = evaluatePredeclaredTrialRepeatability(
  [trials[0], { ...trials[0], id: 'duplicate' }],
  signal,
);
assert.equal(duplicate.established, false, 'replaying one prediction snapshot must not establish repeatability');

const postHoc = evaluatePredeclaredTrialRepeatability(
  [trials[0], { ...trials[1], predeclared: false }],
  signal,
);
assert.equal(postHoc.established, false, 'post-outcome trials must not establish repeatability');

const missed = evaluatePredeclaredTrialRepeatability(
  [trials[0], { ...trials[1], directOutcomeHit: false }],
  signal,
);
assert.equal(missed.established, false, 'a non-hit must not establish repeatability');

const unrelated = evaluatePredeclaredTrialRepeatability(
  [trials[0], { ...trials[1], normalizedExpectedSurfaces: ['src/game/missionVisualReadinessGate.ts'] }],
  signal,
);
assert.equal(unrelated.established, false, 'a trial that did not predeclare the supported signal must not count');

assert.throws(
  () => validateRoadmapShadowValidationCorpus({ ...corpus, mode: 'enforced' }),
  /must remain advisory/,
);
assert.throws(
  () => validateRoadmapShadowValidationCorpus({
    ...corpus,
    promotionBoundary: { ...corpus.promotionBoundary, crossTaskGeneralizationEstablished: true },
  }),
  /must not claim cross-task generalization/,
);

console.log('EV19_ROADMAP_SHADOW_VALIDATION_TEST_PASS original=1tp/1fp/3fn migrated=1tp/2fp/3fn repeatable=2-trials duplicate=reject posthoc=reject nonhit=reject crossTask=false enforcement=false');
