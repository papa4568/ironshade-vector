import assert from 'node:assert/strict';
import { resolve } from 'node:path';

import {
  applyCalibrationStatus,
  buildCalibrationReport,
  calibrationMetrics,
  createImpactObservation,
  parseFailedNpmScript,
  pathFamily,
  proposeConservativeExpansions,
  validateCalibrationConfig,
  verificationIdsForScript,
} from '../tools/impact-map-calibration.mjs';
import {
  loadImpactMap,
  selectAffectedVerification,
} from '../tools/select-affected-verification.mjs';

const impactMap = await loadImpactMap(resolve('agent/impact-map.json'));
const config = validateCalibrationConfig(JSON.parse(await (await import('node:fs/promises')).readFile(resolve('agent/impact-calibration.json'), 'utf8')));
const graphicsFailureLog = `
> ironshade-vector@0.0.1 build
> npm run test:beta && npm run test:graphics:content

> ironshade-vector@0.0.1 test:graphics:content
> node tests/graphics-content-assets.mjs

Error: synthetic graphics content failure
`;

assert.equal(pathFamily('src/components/Hud.tsx'), 'src/components/**');
assert.equal(pathFamily('scripts/prepare-refinery-premium-surfaces.mjs'), 'scripts/**');
assert.equal(pathFamily('package.json'), 'package.json');
assert.equal(parseFailedNpmScript(graphicsFailureLog), 'test:graphics:content');
assert.deepEqual(verificationIdsForScript('test:graphics:content', impactMap), ['graphics-content']);

const miss = createImpactObservation({
  id: 'synthetic:ui-change-graphics-failure-1',
  source: 'synthetic',
  candidateSha: '1111111111111111111111111111111111111111',
  changedFiles: ['src/components/Hud.tsx'],
  impactMap,
  fullVerificationOutcome: 'failure',
  fullVerificationLog: graphicsFailureLog,
  trustedForCalibration: true,
});
assert.equal(miss.prediction.mode, 'targeted');
assert(miss.prediction.verificationIds.includes('ui-readability'));
assert.deepEqual(miss.fullVerification.observedVerificationIds, ['graphics-content']);
assert(miss.fullVerification.observedDomains.includes('graphics'));
assert.equal(miss.comparison.falseNegative, true);

const proposals = proposeConservativeExpansions([miss], impactMap);
assert(proposals.length >= 1, 'synthetic miss must produce at least one conservative expansion proposal');
assert(proposals.every(proposal => proposal.automaticApply === false));
assert(proposals.every(proposal => proposal.coverageDirection === 'widen-only'));
assert(proposals.every(proposal => proposal.suggestedRule.risk === 'high'));
assert(proposals.every(proposal => proposal.suggestedRule.verificationIds.includes('verify-full')));

const repeatedMiss = createImpactObservation({
  ...miss,
  id: 'synthetic:ui-change-graphics-failure-2',
  candidateSha: '2222222222222222222222222222222222222222',
  impactMap,
  fullVerificationOutcome: 'failure',
  fullVerificationLog: graphicsFailureLog,
});
const repeatedProposals = proposeConservativeExpansions([repeatedMiss, miss], impactMap);
assert.equal(repeatedProposals.length, proposals.length);
for (const proposal of proposals) {
  const repeated = repeatedProposals.find(entry => entry.id === proposal.id);
  assert(repeated, `repeated miss must converge on proposal ${proposal.id}`);
  assert.deepEqual(repeated.suggestedRule, proposal.suggestedRule);
  assert.equal(repeated.occurrenceCount, 2);
}

const hit = createImpactObservation({
  id: 'synthetic:graphics-change-graphics-failure',
  source: 'synthetic',
  candidateSha: '3333333333333333333333333333333333333333',
  changedFiles: ['src/game/graphicsAssetManifest.ts'],
  impactMap,
  fullVerificationOutcome: 'failure',
  fullVerificationLog: graphicsFailureLog,
  trustedForCalibration: true,
});
assert.equal(hit.comparison.falseNegative, false);
assert(hit.prediction.verificationIds.includes('graphics-content'));

const lowConfidenceConfig = structuredClone(config);
lowConfidenceConfig.trustedObservations = [miss, repeatedMiss, hit];
const lowStatus = calibrationMetrics(lowConfidenceConfig.trustedObservations, lowConfidenceConfig);
assert.equal(lowStatus.trustedFailureObservations, 3);
assert.equal(lowStatus.falseNegativeCount, 2);
assert(lowStatus.confidence < lowStatus.threshold);
assert.equal(lowStatus.sufficientSample, true);
assert.equal(lowStatus.failClosed, true);

const docsSelection = selectAffectedVerification(['docs/product-constraints.md'], impactMap);
assert.equal(docsSelection.mode, 'none');
const failClosedSelection = applyCalibrationStatus(docsSelection, lowStatus, impactMap);
assert.equal(failClosedSelection.mode, 'full');
assert.equal(failClosedSelection.escalated, true);
assert.deepEqual(failClosedSelection.verifications.map(verification => verification.id), ['verify-full']);
assert(failClosedSelection.escalationReasons.some(reason => reason.includes('fail closed to full verification')));

const alreadyFull = selectAffectedVerification(['package.json'], impactMap);
assert.equal(applyCalibrationStatus(alreadyFull, lowStatus, impactMap), alreadyFull, 'calibration may not narrow or replace an existing full selection');

const highConfidenceConfig = structuredClone(config);
const hit2 = { ...hit, id: 'synthetic:graphics-change-graphics-failure-2', candidateSha: '4444444444444444444444444444444444444444' };
const hit3 = { ...hit, id: 'synthetic:graphics-change-graphics-failure-3', candidateSha: '5555555555555555555555555555555555555555' };
highConfidenceConfig.trustedObservations = [hit, hit2, hit3];
const highStatus = calibrationMetrics(highConfidenceConfig.trustedObservations, highConfidenceConfig);
assert.equal(highStatus.confidence, 1);
assert.equal(highStatus.failClosed, false);
assert.equal(applyCalibrationStatus(docsSelection, highStatus, impactMap), docsSelection, 'healthy calibration confidence must not alter existing selection');

const unknownFailure = createImpactObservation({
  id: 'synthetic:unmapped-full-failure',
  source: 'synthetic',
  candidateSha: '6666666666666666666666666666666666666666',
  changedFiles: ['docs/product-constraints.md'],
  impactMap,
  fullVerificationOutcome: 'failure',
  fullVerificationLog: `> ironshade-vector@0.0.1 build\n> npm run test:new-hidden-domain\n\n> ironshade-vector@0.0.1 test:new-hidden-domain\n> node tests/new-hidden-domain.mjs\n`,
  trustedForCalibration: false,
});
assert.equal(unknownFailure.comparison.falseNegative, true);
assert.deepEqual(unknownFailure.fullVerification.observedVerificationIds, []);
assert.deepEqual(unknownFailure.fullVerification.observedDomains, ['full-verification']);

const successObservation = createImpactObservation({
  id: 'candidate:successful-shadow',
  source: 'candidate',
  candidateSha: '7777777777777777777777777777777777777777',
  changedFiles: ['src/components/Hud.tsx'],
  impactMap,
  fullVerificationOutcome: 'success',
  trustedForCalibration: false,
});
const successReport = buildCalibrationReport({ observation: successObservation, config, impactMap });
assert.equal(successReport.mode, 'advisory');
assert.equal(successReport.observation.comparison.falseNegative, false);
assert.equal(successReport.acceptedForEnforcement, false);
assert.equal(successReport.candidatePassGranted, false);
assert.deepEqual(successReport.proposals, []);

console.log(`IMPACT_MAP_CALIBRATION_TEST_PASS syntheticMiss=proposal repeatedMiss=deterministic confidence=${lowStatus.confidence.toFixed(3)} failClosed=${failClosedSelection.mode} noNarrowing=pass candidateShadow=advisory`);
