import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as governanceModule from '../tools/antibody-governance.mjs';
import {
  runAntibodyGovernanceAssessment,
  validateAntibodyGovernanceCalibrationCorpus,
  validateAntibodyGovernancePolicy,
} from '../tools/antibody-governance.mjs';
import { verifyAntibodyGovernanceEvidence } from '../tools/antibody-governance-evidence.mjs';

const policy = JSON.parse(await readFile(new URL('../antibody-governance-policy.json', import.meta.url), 'utf8'));
const calibration = JSON.parse(await readFile(new URL('../antibody-governance-calibration-corpus.json', import.meta.url), 'utf8'));
const ev12Corpus = JSON.parse(await readFile(new URL('../failure-recurrence-calibration-corpus.json', import.meta.url), 'utf8'));
const memory = JSON.parse(await readFile(new URL('../failure-memory.json', import.meta.url), 'utf8'));

validateAntibodyGovernancePolicy(policy);
validateAntibodyGovernanceCalibrationCorpus(calibration);
assert.equal(Object.hasOwn(governanceModule, 'evaluateAntibodyGovernanceDecision'), false, 'the raw decision evaluator must not be externally callable');
assert.equal(typeof governanceModule.authorizeAntibodyGovernanceDecision, 'function', 'real decision authorization must use the GitHub-backed provenance path');

const candidateSha = 'd'.repeat(40);
const report = await runAntibodyGovernanceAssessment(policy, calibration, ev12Corpus, memory, {
  candidateSha,
  decisionRecordCount: 0,
});
assert.equal(report.governancePass, true, 'EV-13 governance contract must pass its exact measured scope');
assert.equal(report.enforcementEnabled, false, 'EV-13 must not enable an antibody');
assert.equal(report.acceptedForEnforcement, false, 'EV-13 must leave all antibodies non-enforcing');
assert.equal(report.lifecycle.decisionRecordCount, 0, 'EV-13 must not commit an accepted antibody record');
assert.equal(report.lifecycle.trustedReviewProvenanceRequired, true, 'all lifecycle transitions must require externally verified review provenance');
assert.equal(report.lifecycle.canonicalSourceEntryRequired, true, 'governance must verify the named canonical check entry exists');
assert.equal(report.lifecycle.canonicalSourceContractRequired, true, 'focused-regression and telemetry governance must bind the exact EV-4 target contract');
assert.equal(report.lifecycle.directDecisionEvaluatorExported, false, 'callers must not bypass the trusted authorization wrapper');
assert.deepEqual(report.eligibleTruthIds, ['android-screenshot-capture-transport-timeout', 'candidate-artifact-integrity-drift']);
assert.equal(report.ev12.pinnedCorpusDigestVerified, true);
assert.equal(report.ev12.pinnedFailureMemoryDigestVerified, true);
assert.deepEqual(report.calibration.measuredErrors, {
  transitionFalsePositives: 0,
  transitionFalseNegatives: 0,
  promotionFalsePositives: 0,
  promotionFalseNegatives: 0,
}, 'EV-13 governance calibration must have zero false-positive/false-negative errors');

const reviewedScreenshot = report.calibration.cases.find(entry => entry.id === 'reviewed-screenshot-accept');
assert.equal(reviewedScreenshot.actualPromotionEligible, true);
assert.equal(reviewedScreenshot.reviewProvenanceVerified, true);
assert.equal(reviewedScreenshot.pinnedEligibilityVerified, true);
assert.equal(reviewedScreenshot.canonicalSourceEntryVerified, true);
assert.equal(reviewedScreenshot.canonicalSourceContractVerified, true, 'screenshot governance must bind the exact Android smoke contract');
const reviewedArtifact = report.calibration.cases.find(entry => entry.id === 'reviewed-candidate-artifact-accept');
assert.equal(reviewedArtifact.actualPromotionEligible, true);
assert.equal(reviewedArtifact.canonicalSourceEntryVerified, true, 'candidate artifact regression must resolve to its canonical source');
assert.equal(reviewedArtifact.canonicalSourceContractVerified, true, 'candidate artifact governance must bind its exact proposed regression contract');

const selfAttested = report.calibration.cases.find(entry => entry.id === 'self-attested-review-cannot-authorize');
assert.equal(selfAttested.actualTransitionValid, false);
assert.match(selfAttested.error, /trusted review provenance is required/, 'review-shaped fields without verified GitHub provenance must fail closed');
const phantomSource = report.calibration.cases.find(entry => entry.id === 'noncanonical-file-with-entry-id-cannot-authorize');
assert.equal(phantomSource.actualTransitionValid, false);
assert.match(phantomSource.error, /canonical source-of-truth entry .* does not exist at .*EV-4 canonical target/, 'an allowed file that merely mentions the entry id must not become a phantom canonical check');
const unreviewed = report.calibration.cases.find(entry => entry.id === 'unreviewed-proposal-cannot-authorize');
assert.equal(unreviewed.actualTransitionValid, false);
assert.match(unreviewed.error, /antibody decision\.review must be an object/);
const staleUpdate = report.calibration.cases.find(entry => entry.id === 'stale-update-digest-cannot-authorize');
assert.equal(staleUpdate.actualTransitionValid, false);
assert.match(staleUpdate.error, /previousDecisionDigest must bind the exact prior decision/);
const validUpdate = report.calibration.cases.find(entry => entry.id === 'reviewed-update-preserves-authorization');
assert.equal(validUpdate.actualTransitionValid, true);
assert.equal(validUpdate.actualPromotionEligible, true);
const retirement = report.calibration.cases.find(entry => entry.id === 'reviewed-retirement-revokes-authorization');
assert.equal(retirement.actualTransitionValid, true);
assert.equal(retirement.actualPromotionEligible, false);

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

const tamperedCorpus = structuredClone(ev12Corpus);
tamperedCorpus.truthGroups[0].rationale += ' tampered';
await assert.rejects(
  () => runAntibodyGovernanceAssessment(policy, calibration, tamperedCorpus, memory, { candidateSha, decisionRecordCount: 0 }),
  /EV-12 calibration corpus digest drift/,
  'decision governance must not accept an arbitrary caller-supplied recurrence corpus',
);

const provenanceWeakened = structuredClone(policy);
provenanceWeakened.review.provenance.requireRepositoryFetch = false;
assert.throws(
  () => validateAntibodyGovernancePolicy(provenanceWeakened),
  /must be fetched from GitHub/,
  'policy must not allow self-attested review provenance',
);

const sourceBindingWeakened = structuredClone(policy);
sourceBindingWeakened.sourceOfTruthByKind['focused-regression'].binding = 'entry-id-substring';
assert.throws(
  () => validateAntibodyGovernancePolicy(sourceBindingWeakened),
  /must bind the exact EV-4 proposed target and check contract/,
  'focused regressions must not fall back to substring-based source binding',
);

console.log('ANTIBODY_GOVERNANCE_PASS eligible=2 transitionFp=0 transitionFn=0 promotionFp=0 promotionFn=0 decisions=0 enforcement=false rollback=clean lifecycle=accept+update+retire review=github-provenance eligibility=pinned sourceEntry=verified sourceContract=exact-target');
