import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import {
  auditProducerIntegration,
  calibratePromotionDecision,
  generatePromotionEvidence,
  loadPromotionContract,
} from '../tools/proof-cache-promotion.mjs';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const contract = await loadPromotionContract();
assert.equal(contract.policy.promotionTask, 'EV-18');
assert.equal(contract.policy.proofClass, 'full-repository-build-closed');
assert.equal(contract.policy.sourceEvidence.ev21.candidateSha, '945b44853742e43e92f3657df1b7cee1dfe5b0e1');
assert.equal(contract.policy.sourceEvidence.ev21.workflowRunId, '38777138277');
assert.equal(contract.policy.sourceEvidence.ev21.artifactId, '11994293248');
assert.equal(contract.policy.sourceEvidence.ev21.falseHits, 0);
assert.equal(contract.policy.sourceEvidence.ev21.sameClosureDisagreements, 0);
assert.deepEqual(contract.policy.sourceEvidence.ev21.eligibleProofClasses, ['full-repository-build-closed']);

const calibration = await calibratePromotionDecision({ policy: contract.policy });
assert.equal(calibration.falsePositives, 0);
assert.equal(calibration.falseNegatives, 0);
assert.equal(calibration.rollbackPass, true);
assert.equal(calibration.pass, true);
assert.equal(calibration.trials.find(entry => entry.id === 'valid-exact-closure-success-entry')?.observedReuse, true);
for (const id of ['cache-miss', 'closure-mismatch', 'failed-proof-receipt', 'invalid-source-candidate', 'dist-digest-mismatch']) {
  const trial = calibration.trials.find(entry => entry.id === id);
  assert.equal(trial?.observedReuse, false, `${id} must fail closed to a real proof`);
  assert.equal(trial?.pass, true, `${id} calibration failed`);
}
const rollback = calibration.trials.find(entry => entry.id === 'rollback-forces-legacy-proof');
assert.equal(rollback?.observedReuse, false);
assert.equal(rollback?.proofMode, 'legacy');
assert.equal(rollback?.reason, 'rollback-disabled');

const producer = await auditProducerIntegration();
assert.equal(producer.pass, true);
assert(Object.values(producer.checks).every(Boolean));

const evidence = await generatePromotionEvidence({ candidateSha: head });
assert.equal(evidence.taskId, 'EV-18');
assert.equal(evidence.candidateSha, head);
assert.equal(evidence.proofId, 'full-repository-build-closed');
assert.equal(evidence.calibration.measuredErrors.falsePositives, 0);
assert.equal(evidence.calibration.measuredErrors.falseNegatives, 0);
assert.equal(evidence.rollback.forcesPrePromotionLegacyProof, true);
assert.equal(evidence.cache.exactKeyOnly, true);
assert.equal(evidence.acceptedForReuse, true);
assert.equal(evidence.blocking, true);
assert.equal(evidence.candidatePassGranted, false);

console.log(`EV18_PROOF_CACHE_PROMOTION_TEST_PASS candidate=${head} proof=full-repository-build-closed falsePositives=0 falseNegatives=0 rollback=legacy exactKey=true`);
