import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  runAntibodyPromotionGate,
  validateAntibodyPromotionPolicy,
} from '../tools/antibody-promotion.mjs';
import { sha256Value } from '../tools/repository-immune-system.mjs';

const policy = JSON.parse(await readFile(new URL('../antibody-promotion-policy.json', import.meta.url), 'utf8'));
const governancePolicy = JSON.parse(await readFile(new URL('../antibody-governance-policy.json', import.meta.url), 'utf8'));
const ev12Corpus = JSON.parse(await readFile(new URL('../failure-recurrence-calibration-corpus.json', import.meta.url), 'utf8'));
const memory = JSON.parse(await readFile(new URL('../failure-memory.json', import.meta.url), 'utf8'));
const decision = JSON.parse(await readFile(new URL('../antibody-decisions/candidate-artifact-integrity-drift-r1.json', import.meta.url), 'utf8'));

validateAntibodyPromotionPolicy(policy);
const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const report = await runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, memory, decision, { candidateSha });
assert.equal(report.mode, 'enforced');
assert.equal(report.enforcementEnabled, true);
assert.equal(report.blocking, true);
assert.equal(report.enforcementContractPass, true);
assert.equal(report.wouldBlock, false);
assert.equal(report.baseline.accepted, true);
assert.deepEqual(report.calibration.measuredErrors, { falsePositives: 0, falseNegatives: 0 });
assert.equal(report.calibration.benignControl.accepted, true);
assert.equal(report.calibration.dishonestMutations.every(entry => entry.detected), true);
assert.equal(report.decisionIntentValidated, true);
assert.equal(report.trustedReviewAuthorizationRequired, true);
assert.equal(report.trustedReviewAuthorized, false);
assert.equal(report.rollback.failureHistoryUnchanged, true);
assert.equal(report.rollback.existingCandidateArtifactCheckStillRequired, true);
assert.equal(report.rollback.unrelatedAcceptanceSemanticsChanged, false);
assert.equal(report.candidatePassGranted, false);

const rollback = await runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, memory, decision, {
  candidateSha,
  enforcementOverride: false,
});
assert.equal(rollback.mode, 'advisory-rollback');
assert.equal(rollback.enforcementEnabled, false);
assert.equal(rollback.blocking, false);
assert.equal(rollback.enforcementContractPass, true);
assert.deepEqual(rollback.calibration.measuredErrors, report.calibration.measuredErrors);
assert.equal(rollback.failureMemorySha256, sha256Value(memory));

const sourceText = await readFile(new URL('./candidate-artifact.mjs', import.meta.url), 'utf8');
const regressedSource = sourceText.replaceAll('candidate-sha-match', 'candidate-sha-mismatch');
const regressed = await runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, memory, decision, {
  candidateSha,
  readText: async path => path === 'agent/tests/candidate-artifact.mjs' ? regressedSource : readFile(path, 'utf8'),
});
assert.equal(regressed.baseline.accepted, false);
assert.equal(regressed.wouldBlock, true);
assert.equal(regressed.blocking, true);

const regressedRollback = await runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, memory, decision, {
  candidateSha,
  enforcementOverride: false,
  readText: async path => path === 'agent/tests/candidate-artifact.mjs' ? regressedSource : readFile(path, 'utf8'),
});
assert.equal(regressedRollback.baseline.accepted, false);
assert.equal(regressedRollback.wouldBlock, true);
assert.equal(regressedRollback.blocking, false);

console.log(`ANTIBODY_PROMOTION_TEST_PASS candidate=${candidateSha} truth=${report.selectedTruthId} falsePositives=0 falseNegatives=0 rollback=nonblocking recurrence=blocked`);
