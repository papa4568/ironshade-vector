import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { validateProofCachePolicy } from '../tools/causal-proof-cache.mjs';
import {
  evaluateProofClassEligibility,
  validateProofCacheCalibrationCorpus,
} from '../tools/proof-cache-calibration-evidence.mjs';

const policy = validateProofCachePolicy(JSON.parse(await readFile(resolve('agent/proof-cache.json'), 'utf8')));
const corpus = validateProofCacheCalibrationCorpus(
  JSON.parse(await readFile(resolve('agent/proof-cache-calibration-corpus.json'), 'utf8')),
  policy,
);

assert.equal(corpus.mode, 'advisory');
assert.equal(policy.mode, 'shadow');
assert.equal(corpus.proofClasses.length, 1);
const proofEntry = corpus.proofClasses[0];
assert.equal(proofEntry.proofId, 'full-repository-build');
assert.equal(proofEntry.expectedCommand, 'npm run build');
assert.equal(proofEntry.calibrationCommand, 'bash scripts/run-full-repository-build-proof.sh');
assert.equal(proofEntry.executionProfilePath, 'scripts/run-full-repository-build-proof.sh');
assert.deepEqual(proofEntry.requiredExternalInputs, [
  'external-network-availability',
  'npm-registry-response-identity',
]);
assert.deepEqual(proofEntry.externalDependencyEvidence.map(entry => entry.input), proofEntry.requiredExternalInputs);
assert.deepEqual(proofEntry.knownClosureGaps.map(entry => entry.id), [
  'docker-base-image-identity-not-bound',
  'docker-engine-version-not-bound',
  'external-network-availability-not-bound',
  'npm-registry-response-identity-not-bound',
]);
assert.equal(proofEntry.knownClosureGaps.every(entry => entry.blocksEligibility === true), true);

const safeTrials = [
  { kind: 'baseline', closureRelation: 'same', prediction: 'baseline', outcome: 'success', classification: 'baseline' },
  { kind: 'same-closure-control', closureRelation: 'same', prediction: 'hit', outcome: 'success', classification: 'agreement' },
  { kind: 'invalidation-control', closureRelation: 'different', prediction: 'miss', outcome: 'success', classification: 'false-miss' },
  { kind: 'invalidation-defect', closureRelation: 'different', prediction: 'miss', outcome: 'failure', classification: 'correct-invalidation' },
];

const closedRuntime = {
  requiredInputsClosed: true,
  missingInputs: [],
  executionProfileInRepositoryClosure: true,
  externalDependencyAccountingPass: true,
  invalidationControlsPass: true,
};
const blockedByDockerClosure = evaluateProofClassEligibility({
  corpus,
  proofEntry,
  trialRows: safeTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 0,
});
assert.equal(blockedByDockerClosure.eligible, false, 'known Docker closure gaps must block EV-18 eligibility');
assert.equal(blockedByDockerClosure.falseHits, 0);
assert.equal(blockedByDockerClosure.falseMisses, 1);
assert.equal(blockedByDockerClosure.sameClosureRunCount, 2);
assert.equal(blockedByDockerClosure.sameClosureDisagreements, 0);
assert.match(blockedByDockerClosure.reasons.join('\n'), /immutable pulled node:22\.23\.2-bookworm image identity/);
assert.match(blockedByDockerClosure.reasons.join('\n'), /Docker engine version/);
assert.match(blockedByDockerClosure.reasons.join('\n'), /external network access/);
assert.match(blockedByDockerClosure.reasons.join('\n'), /npm@10\.9\.8/);

const noGapProof = { ...proofEntry, knownClosureGaps: [] };
const eligibleWhenClosureIsActuallyComplete = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 0,
});
assert.equal(eligibleWhenClosureIsActuallyComplete.eligible, true, 'decision boundary should permit a class only after all runtime inputs are closed');

const falseHitTrials = safeTrials.map(entry => ({ ...entry }));
falseHitTrials[1] = { ...falseHitTrials[1], outcome: 'failure', classification: 'false-hit' };
const falseHitResult = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: falseHitTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 0,
});
assert.equal(falseHitResult.eligible, false);
assert.equal(falseHitResult.falseHits, 1);
assert.equal(falseHitResult.sameClosureDisagreements, 1);

const missingRuntime = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: {
    requiredInputsClosed: false,
    missingInputs: ['docker-base-image-identity', 'docker-engine-version', 'external-network-availability', 'npm-registry-response-identity'],
    executionProfileInRepositoryClosure: true,
    externalDependencyAccountingPass: true,
    invalidationControlsPass: true,
  },
  historicalDisagreementCount: 0,
});
assert.equal(missingRuntime.eligible, false);
assert.match(missingRuntime.reasons.join('\n'), /docker-base-image-identity/);
assert.match(missingRuntime.reasons.join('\n'), /docker-engine-version/);
assert.match(missingRuntime.reasons.join('\n'), /external-network-availability/);
assert.match(missingRuntime.reasons.join('\n'), /npm-registry-response-identity/);

const profileOutsideClosure = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: { ...closedRuntime, executionProfileInRepositoryClosure: false },
  historicalDisagreementCount: 0,
});
assert.equal(profileOutsideClosure.eligible, false);
assert.match(profileOutsideClosure.reasons.join('\n'), /execution profile is outside/);

const runtimeInvalidationFailure = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: { ...closedRuntime, invalidationControlsPass: false },
  historicalDisagreementCount: 0,
});
assert.equal(runtimeInvalidationFailure.eligible, false);
assert.match(runtimeInvalidationFailure.reasons.join('\n'), /runtime inputs do not invalidate/);

const historicalDisagreement = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 1,
});
assert.equal(historicalDisagreement.eligible, false);
assert.match(historicalDisagreement.reasons.join('\n'), /retained history/);

const mutatedCorpus = structuredClone(corpus);
mutatedCorpus.mode = 'enforced';
assert.throws(() => validateProofCacheCalibrationCorpus(mutatedCorpus, policy), /must remain advisory/);

console.log('EV17_PROOF_CACHE_CALIBRATION_TEST_PASS advisory=pass dockerProfile=pass externalDependencies=accounted noEligibility=pass falseHit=pass falseMissMeasured=pass runtimeGap=pass reuse=disabled');
