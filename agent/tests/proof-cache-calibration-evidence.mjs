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
assert.equal(proofEntry.knownClosureGaps.some(gap => gap.id === 'mutable-runner-image-alias' && gap.blocksEligibility), true);

const safeTrials = [
  { kind: 'baseline', closureRelation: 'same', prediction: 'baseline', outcome: 'success', classification: 'baseline' },
  { kind: 'same-closure-control', closureRelation: 'same', prediction: 'hit', outcome: 'success', classification: 'agreement' },
  { kind: 'invalidation-control', closureRelation: 'different', prediction: 'miss', outcome: 'success', classification: 'false-miss' },
  { kind: 'invalidation-defect', closureRelation: 'different', prediction: 'miss', outcome: 'failure', classification: 'correct-invalidation' },
];

const closedRuntime = { requiredInputsClosed: true, missingInputs: [] };
const blockedByDeclaredGap = evaluateProofClassEligibility({ corpus, proofEntry, trialRows: safeTrials, runtimeAudit: closedRuntime });
assert.equal(blockedByDeclaredGap.falseHits, 0);
assert.equal(blockedByDeclaredGap.falseMisses, 1);
assert.equal(blockedByDeclaredGap.sameClosureRunCount, 2);
assert.equal(blockedByDeclaredGap.sameClosureDisagreements, 0);
assert.equal(blockedByDeclaredGap.eligible, false, 'a known immutable-environment closure gap must fail closed despite observed agreement');
assert.match(blockedByDeclaredGap.reasons.join('\n'), /ubuntu-latest/);

const noGapProof = { ...proofEntry, knownClosureGaps: [] };
const eligibleWhenClosed = evaluateProofClassEligibility({ corpus, proofEntry: noGapProof, trialRows: safeTrials, runtimeAudit: closedRuntime });
assert.equal(eligibleWhenClosed.eligible, true, 'the decision boundary should permit a proof only when observed safety and required closure are both complete');

const falseHitTrials = safeTrials.map(entry => ({ ...entry }));
falseHitTrials[1] = { ...falseHitTrials[1], outcome: 'failure', classification: 'false-hit' };
const falseHitResult = evaluateProofClassEligibility({ corpus, proofEntry: noGapProof, trialRows: falseHitTrials, runtimeAudit: closedRuntime });
assert.equal(falseHitResult.eligible, false);
assert.equal(falseHitResult.falseHits, 1);
assert.equal(falseHitResult.sameClosureDisagreements, 1);

const missingRuntime = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: { requiredInputsClosed: false, missingInputs: ['runner-image-identity'] },
});
assert.equal(missingRuntime.eligible, false);
assert.match(missingRuntime.reasons.join('\n'), /runner-image-identity/);

const mutatedCorpus = structuredClone(corpus);
mutatedCorpus.mode = 'enforced';
assert.throws(() => validateProofCacheCalibrationCorpus(mutatedCorpus, policy), /must remain advisory/);

console.log('EV17_PROOF_CACHE_CALIBRATION_TEST_PASS advisory=pass decisionBoundary=pass falseHit=pass falseMissMeasured=pass runtimeGap=pass reuse=disabled');
