import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  evaluateAntibodyGovernanceDecision,
  runAntibodyGovernanceAssessment,
  validateAntibodyGovernanceCalibrationCorpus,
  validateAntibodyGovernancePolicy,
} from '../tools/antibody-governance.mjs';
import { verifyAntibodyGovernanceEvidence } from '../tools/antibody-governance-evidence.mjs';
import {
  clusterFailureRecords,
  proposeAntibodies,
  sha256Value,
} from '../tools/repository-immune-system.mjs';

const policy = JSON.parse(await readFile(new URL('../antibody-governance-policy.json', import.meta.url), 'utf8'));
const calibration = JSON.parse(await readFile(new URL('../antibody-governance-calibration-corpus.json', import.meta.url), 'utf8'));
const ev12Corpus = JSON.parse(await readFile(new URL('../failure-recurrence-calibration-corpus.json', import.meta.url), 'utf8'));
const memory = JSON.parse(await readFile(new URL('../failure-memory.json', import.meta.url), 'utf8'));

validateAntibodyGovernancePolicy(policy);
validateAntibodyGovernanceCalibrationCorpus(calibration);

const candidateSha = 'd'.repeat(40);
const report = await runAntibodyGovernanceAssessment(policy, calibration, ev12Corpus, memory, {
  candidateSha,
  decisionRecordCount: 0,
});
assert.equal(report.governancePass, true, 'EV-13 governance contract must pass its exact measured scope');
assert.equal(report.enforcementEnabled, false, 'EV-13 must not enable an antibody');
assert.equal(report.acceptedForEnforcement, false, 'EV-13 must leave all antibodies non-enforcing');
assert.equal(report.lifecycle.decisionRecordCount, 0, 'EV-13 must not commit an accepted antibody record');
assert.deepEqual(report.eligibleTruthIds, ['android-screenshot-capture-transport-timeout', 'candidate-artifact-integrity-drift']);
assert.deepEqual(report.calibration.measuredErrors, {
  transitionFalsePositives: 0,
  transitionFalseNegatives: 0,
  promotionFalsePositives: 0,
  promotionFalseNegatives: 0,
}, 'EV-13 governance calibration must have zero false-positive/false-negative errors');
assert.equal(report.rollback.disabledPromotionAuthorizations, 0, 'rollback must disable all promotion authorization');
assert.equal(report.rollback.sourceFailureMemoryUnchanged, true, 'governance measurement must not mutate failure history');
assert.equal(report.rollback.existingEnforcementChanged, false, 'EV-13 rollback must leave existing verification semantics intact');
await verifyAntibodyGovernanceEvidence(report, policy, calibration, ev12Corpus, memory, {
  candidateSha,
  requirePass: true,
});

const rollback = await runAntibodyGovernanceAssessment(policy, calibration, ev12Corpus, memory, {
  candidateSha,
  governanceOverride: false,
  decisionRecordCount: 0,
});
assert.equal(rollback.mode, 'advisory-rollback');
assert.equal(rollback.governanceEnabled, false);
assert.equal(rollback.calibration.cases.filter(entry => entry.actualPromotionEligible).length, 0, 'disabled governance must authorize no promotions');
assert.equal(rollback.rollback.evidenceStillMeasured, true, 'rollback must preserve calibration visibility');
await verifyAntibodyGovernanceEvidence(rollback, policy, calibration, ev12Corpus, memory, {
  candidateSha,
  governanceOverride: false,
});

const screenshotGroup = ev12Corpus.truthGroups.find(entry => entry.truthId === 'android-screenshot-capture-transport-timeout');
const screenshotMemory = clusterFailureRecords(screenshotGroup.records, {
  maxSamplesPerClass: ev12Corpus.calibrationMaxSamplesPerClass,
  maxSerializedBytes: ev12Corpus.calibrationMaxSerializedBytes,
});
const screenshotProposal = proposeAntibodies(screenshotMemory)[0];
const accepted = {
  schemaVersion: 1,
  antibodyId: screenshotProposal.id,
  truthId: screenshotGroup.truthId,
  sourceFailureClass: screenshotProposal.sourceFailureClass,
  proposalDigest: sha256Value(screenshotProposal),
  revision: 1,
  action: 'accept',
  previousDecisionDigest: null,
  sourceOfTruth: {
    kind: 'focused-regression',
    path: 'agent/tests/repository-immune-system.mjs',
    entryId: 'android-screenshot-capture-contract',
  },
  review: {
    authority: 'trusted-repository-participant',
    reviewer: 'ev13-regression-reviewer',
    reviewedAt: '2026-10-13T22:45:00Z',
    rationale: 'Measured screenshot recurrence is zero-error and already has a canonical focused regression owner.',
    evidence: 'test:reviewed-acceptance',
  },
  promotion: { state: 'not-promoted', taskId: 'EV-14' },
};
const acceptedResult = await evaluateAntibodyGovernanceDecision({ policy, corpus: ev12Corpus, decision: accepted });
assert.equal(acceptedResult.transitionValid, true);
assert.equal(acceptedResult.promotionEligible, true, 'reviewed eligible acceptance may become an EV-14 promotion candidate');
assert.equal(acceptedResult.enforcementEnabled, false, 'governance acceptance must still not enforce the antibody');

const unreviewed = structuredClone(accepted);
delete unreviewed.review;
await assert.rejects(
  () => evaluateAntibodyGovernanceDecision({ policy, corpus: ev12Corpus, decision: unreviewed }),
  /antibody decision\.review must be an object/,
  'unreviewed proposals must remain non-enforcing and ineligible for promotion',
);

const update = structuredClone(accepted);
update.revision = 2;
update.action = 'update';
update.previousDecisionDigest = sha256Value(accepted);
update.review = {
  authority: 'trusted-repository-participant',
  reviewer: 'ev13-regression-reviewer',
  reviewedAt: '2026-10-13T22:50:00Z',
  rationale: 'Reviewed lifecycle update preserves the same canonical focused regression ownership.',
  evidence: 'test:reviewed-update',
};
assert.equal((await evaluateAntibodyGovernanceDecision({ policy, corpus: ev12Corpus, decision: update, previousDecision: accepted })).promotionEligible, true);

const staleUpdate = structuredClone(update);
staleUpdate.previousDecisionDigest = '0'.repeat(64);
await assert.rejects(
  () => evaluateAntibodyGovernanceDecision({ policy, corpus: ev12Corpus, decision: staleUpdate, previousDecision: accepted }),
  /previousDecisionDigest must bind the exact prior decision/,
  'updates must bind the exact previous governance record',
);

const retirement = structuredClone(update);
retirement.action = 'retire';
retirement.promotion = { state: 'retired', taskId: null };
retirement.review = {
  authority: 'trusted-repository-participant',
  reviewer: 'ev13-regression-reviewer',
  reviewedAt: '2026-10-13T22:55:00Z',
  rationale: 'Reviewed retirement preserves audit history while removing future promotion authorization.',
  evidence: 'test:reviewed-retirement',
};
const retiredResult = await evaluateAntibodyGovernanceDecision({ policy, corpus: ev12Corpus, decision: retirement, previousDecision: accepted });
assert.equal(retiredResult.transitionValid, true);
assert.equal(retiredResult.promotionEligible, false, 'retired antibodies must not remain promotion-eligible');

const duplicateRegistry = structuredClone(accepted);
duplicateRegistry.sourceOfTruth.path = 'agent/antibody-decisions/android-screenshot-capture-transport-timeout.json';
await assert.rejects(
  () => evaluateAntibodyGovernanceDecision({
    policy,
    corpus: ev12Corpus,
    decision: duplicateRegistry,
    fileExists: async () => true,
  }),
  /outside its allowed repository check surfaces|cannot point into antibody governance/,
  'governance history may reference but never replace the canonical check registry',
);

console.log('ANTIBODY_GOVERNANCE_PASS eligible=2 transitionFp=0 transitionFn=0 promotionFp=0 promotionFn=0 decisions=0 enforcement=false rollback=clean lifecycle=accept+update+retire sourceOfTruth=canonical');
