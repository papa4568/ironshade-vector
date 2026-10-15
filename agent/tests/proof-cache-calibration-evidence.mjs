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
assert.deepEqual(proofEntry.knownClosureGaps, []);

const safeTrials = [
  { kind: 'baseline', closureRelation: 'same', prediction: 'baseline', outcome: 'success', classification: 'baseline' },
  { kind: 'same-closure-control', closureRelation: 'same', prediction: 'hit', outcome: 'success', classification: 'agreement' },
  { kind: 'invalidation-control', closureRelation: 'different', prediction: 'miss', outcome: 'success', classification: 'false-miss' },
  { kind: 'invalidation-defect', closureRelation: 'different', prediction: 'miss', outcome: 'failure', classification: 'correct-invalidation' },
];

const closedRuntime = { requiredInputsClosed: true, missingInputs: [], invalidationControlsPass: true };
const eligible = evaluateProofClassEligibility({
  corpus,
  proofEntry,
  trialRows: safeTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 0,
});
assert.equal(eligible.eligible, true, 'zero false-hit/disagreement evidence with closed runtime inputs should permit EV-18 eligibility');
assert.equal(eligible.falseHits, 0);
assert.equal(eligible.falseMisses, 1, 'benign included-input invalidation is a measured conservative false miss, not an unsafe hit');
assert.equal(eligible.sameClosureRunCount, 2);
assert.equal(eligible.sameClosureDisagreements, 0);
assert.equal(eligible.historicalSameClosureDisagreements, 0);
assert.equal(eligible.detectedInvalidationDefectCount, 1);

const falseHitTrials = safeTrials.map(entry => ({ ...entry }));
falseHitTrials[1] = { ...falseHitTrials[1], outcome: 'failure', classification: 'false-hit' };
const falseHitResult = evaluateProofClassEligibility({
  corpus,
  proofEntry,
  trialRows: falseHitTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 0,
});
assert.equal(falseHitResult.eligible, false);
assert.equal(falseHitResult.falseHits, 1);
assert.equal(falseHitResult.sameClosureDisagreements, 1);

const missingRuntime = evaluateProofClassEligibility({
  corpus,
  proofEntry,
  trialRows: safeTrials,
  runtimeAudit: { requiredInputsClosed: false, missingInputs: ['runner-image-version'], invalidationControlsPass: true },
  historicalDisagreementCount: 0,
});
assert.equal(missingRuntime.eligible, false);
assert.match(missingRuntime.reasons.join('\n'), /runner-image-version/);

const runtimeInvalidationFailure = evaluateProofClassEligibility({
  corpus,
  proofEntry,
  trialRows: safeTrials,
  runtimeAudit: { requiredInputsClosed: true, missingInputs: [], invalidationControlsPass: false },
  historicalDisagreementCount: 0,
});
assert.equal(runtimeInvalidationFailure.eligible, false);
assert.match(runtimeInvalidationFailure.reasons.join('\n'), /runtime inputs do not invalidate/);

const historicalDisagreement = evaluateProofClassEligibility({
  corpus,
  proofEntry,
  trialRows: safeTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 1,
});
assert.equal(historicalDisagreement.eligible, false);
assert.match(historicalDisagreement.reasons.join('\n'), /retained history/);

const mutatedCorpus = structuredClone(corpus);
mutatedCorpus.mode = 'enforced';
assert.throws(() => validateProofCacheCalibrationCorpus(mutatedCorpus, policy), /must remain advisory/);

console.log('EV17_PROOF_CACHE_CALIBRATION_TEST_PASS advisory=pass eligibility=pass falseHit=pass falseMissMeasured=pass runtimeClosure=pass historyDisagreement=pass reuse=disabled');
