import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as governanceModule from '../tools/antibody-governance.mjs';
import {
  authorizeAntibodyGovernanceDecision,
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
assert.equal(Object.hasOwn(governanceModule, 'evaluateAntibodyGovernanceDecision'), false, 'the raw decision evaluator must not be externally callable');
assert.equal(typeof authorizeAntibodyGovernanceDecision, 'function', 'real decision authorization must use the GitHub-backed provenance path');

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
assert.equal(report.lifecycle.reviewBoundToDecisionDigest, true, 'trusted review must bind the exact decision digest');
assert.equal(report.lifecycle.exactCommittedDecisionRequired, true, 'authorization must load the committed decision from the candidate SHA');
assert.equal(report.lifecycle.repositoryPinnedInputsRequired, true, 'authorization must load pinned governance inputs from the candidate SHA');
assert.equal(report.lifecycle.completeReviewHistoryRequired, true, 'authorization must inspect complete PR review history');
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
assert.equal(reviewedScreenshot.reviewBoundToDecisionDigest, true);
assert.equal(reviewedScreenshot.pinnedEligibilityVerified, true);
assert.equal(reviewedScreenshot.canonicalSourceEntryVerified, true);
assert.equal(reviewedScreenshot.canonicalSourceContractVerified, true, 'screenshot governance must bind the exact Android smoke contract');
const reviewedArtifact = report.calibration.cases.find(entry => entry.id === 'reviewed-candidate-artifact-accept');
assert.equal(reviewedArtifact.actualPromotionEligible, true);
assert.equal(reviewedArtifact.canonicalSourceEntryVerified, true, 'candidate artifact regression must resolve to its canonical source');
assert.equal(reviewedArtifact.canonicalSourceContractVerified, true, 'candidate artifact governance must bind its exact proposed regression contract');

const selfAttested = report.calibration.cases.find(entry => entry.id === 'self-attested-review-cannot-authorize');
assert.equal(selfAttested.actualTransitionValid, false);
assert.match(selfAttested.error, /trusted review provenance is required/, 'review intent without verified GitHub provenance must fail closed');
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
const bindingWeakened = structuredClone(policy);
bindingWeakened.review.provenance.decisionBinding = 'task-and-sha-only';
assert.throws(
  () => validateAntibodyGovernancePolicy(bindingWeakened),
  /must bind the exact committed decision/,
  'policy must not allow same-SHA review replay onto a different decision',
);
const paginationWeakened = structuredClone(policy);
paginationWeakened.review.provenance.commentPagination = 'first-page';
assert.throws(
  () => validateAntibodyGovernancePolicy(paginationWeakened),
  /complete PR comment history/,
  'policy must not authorize from a truncated PR review history',
);
const inputWeakened = structuredClone(policy);
inputWeakened.decisions.authorizationInput = 'caller-supplied-objects';
assert.throws(
  () => validateAntibodyGovernancePolicy(inputWeakened),
  /exact candidate commit/,
  'authorization inputs must come from the reviewed candidate commit',
);
const sourceBindingWeakened = structuredClone(policy);
sourceBindingWeakened.sourceOfTruthByKind['focused-regression'].binding = 'entry-id-substring';
assert.throws(
  () => validateAntibodyGovernancePolicy(sourceBindingWeakened),
  /must bind the exact EV-4 proposed target and check contract/,
  'focused regressions must not fall back to substring-based source binding',
);

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(value); },
  };
}

function contentPayload(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return { encoding: 'base64', content: Buffer.from(text, 'utf8').toString('base64') };
}

const screenshotGroup = ev12Corpus.truthGroups.find(entry => entry.truthId === 'android-screenshot-capture-transport-timeout');
const screenshotMemory = clusterFailureRecords(screenshotGroup.records, {
  maxSamplesPerClass: ev12Corpus.calibrationMaxSamplesPerClass,
  maxSerializedBytes: ev12Corpus.calibrationMaxSerializedBytes,
});
const screenshotProposal = proposeAntibodies(screenshotMemory)[0];
const decisionPath = 'agent/antibody-decisions/ev14-screenshot.json';
const committedDecision = {
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
    path: 'scripts/android-large-screen-smoke.sh',
    entryId: 'android-screenshot-capture-contract',
  },
  review: {
    required: true,
    taskId: 'EV-13',
    rationale: 'Trusted review must authorize this exact committed decision and no caller-substituted payload.',
  },
  promotion: { state: 'not-promoted', taskId: 'EV-14' },
};
const reviewPacket = {
  schemaVersion: 1,
  taskId: 'EV-13',
  candidateSha,
  branch: 'agent/ev13-authorization-fixture',
  mode: 'read-only-adversarial',
  mutationsAllowed: false,
  changedFiles: [decisionPath],
  impact: { mode: 'targeted', escalated: false, domains: [], verificationIds: [], unknownFiles: [], escalationReasons: [] },
  acceptance: [{ index: 0, text: 'Authorize only the exact reviewed governance decision.' }],
  requiredProofs: [{ id: 'experimental-regressions', kind: 'test', required: true, description: 'Governance authorization regression.' }],
  architectureInvariants: [{ id: 'fixture', status: 'passed', file: 'agent/architecture-invariants.json', type: 'sourceContract' }],
  verifierInstructions: ['read only', 'try to disprove', 'check exact candidate', 'fail unsupported claims'],
  adversarialQuestions: ['exact decision?', 'exact SHA?', 'complete comments?', 'pinned inputs?'],
};
function reviewResult(verdict, note = 'Exact decision binding is supported.') {
  return {
    schemaVersion: 1,
    taskId: 'EV-13',
    candidateSha,
    mode: 'read-only-adversarial',
    verdict,
    acceptanceChecks: [{ index: 0, status: verdict === 'pass' ? 'satisfied' : 'not_satisfied', notes: note }],
    proofChecks: [{ proofId: 'experimental-regressions', status: 'credible', notes: 'Fixture proof is credible.' }],
    findings: verdict === 'pass' ? [] : [{ severity: 'major', summary: 'Newer review rejects authorization.', evidence: ['pagination fixture'] }],
  };
}
function reviewComment(id, result, { reviewer = 'trusted-reviewer', association = 'COLLABORATOR', timestamp = '2026-10-13T23:30:00Z' } = {}) {
  return {
    id,
    user: { login: reviewer },
    author_association: association,
    created_at: timestamp,
    updated_at: timestamp,
    body: `<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`,
  };
}

const sourceContractText = [
  'adb exec-out screencap -p > android-large-screen-portrait.png',
  'adb exec-out screencap -p > android-large-screen-resized.png',
].join('\n');
const repository = 'papa4568/ironshade-vector';
const prNumber = 42;
const happyComment = reviewComment(7001, reviewResult('pass'));
const requestedUrls = [];
function buildFetch({ commentPages = [[happyComment]] } = {}) {
  return async url => {
    requestedUrls.push(url);
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    if (pathname === `/repos/${repository}/pulls/${prNumber}`) {
      return jsonResponse({ state: 'open', head: { sha: candidateSha }, user: { login: 'implementation-author' } });
    }
    if (pathname === `/repos/${repository}/issues/${prNumber}/comments`) {
      const page = Number(parsed.searchParams.get('page') ?? '1');
      return jsonResponse(commentPages[page - 1] ?? []);
    }
    if (pathname === `/repos/${repository}/pulls/${prNumber}/files`) return jsonResponse([{ filename: decisionPath }]);
    const contentsPrefix = `/repos/${repository}/contents/`;
    if (pathname.startsWith(contentsPrefix)) {
      assert.equal(parsed.searchParams.get('ref'), candidateSha, 'all authorization content must be fetched from the exact candidate SHA');
      const path = decodeURIComponent(pathname.slice(contentsPrefix.length));
      const values = new Map([
        ['agent/antibody-governance-policy.json', policy],
        ['agent/failure-recurrence-calibration-corpus.json', ev12Corpus],
        ['agent/failure-memory.json', memory],
        [decisionPath, committedDecision],
        ['scripts/android-large-screen-smoke.sh', sourceContractText],
      ]);
      if (!values.has(path)) return jsonResponse({ message: 'not found' }, 404);
      return jsonResponse(contentPayload(values.get(path)));
    }
    return jsonResponse({ message: `unexpected fixture URL ${url}` }, 404);
  };
}

const authorized = await authorizeAntibodyGovernanceDecision({
  candidateSha,
  repository,
  prNumber,
  decisionPath,
  reviewPacket,
  fetchImpl: buildFetch(),
});
assert.equal(authorized.transitionValid, true, 'exported authorization path must accept the exact reviewed committed decision');
assert.equal(authorized.promotionEligible, true);
assert.equal(authorized.repositoryInputsLoadedFromCandidate, true, 'public authorization must load policy/calibration inputs from the candidate commit');
assert.equal(authorized.reviewPacketChangedFilesVerified, true, 'public authorization must bind the review packet to the complete GitHub PR diff');
assert.equal(authorized.completeReviewHistoryVerified, true, 'public authorization must inspect all PR comment pages');
assert.equal(authorized.decisionBoundToReviewedCandidate, true, 'public authorization must bind the exact decision path/digest to the reviewed candidate');
assert.equal(authorized.reviewAuthorization.decisionDigest, sha256Value(committedDecision));
assert.equal(authorized.reviewAuthorization.decisionPath, decisionPath);
assert(requestedUrls.some(url => url.includes('/contents/agent/antibody-governance-policy.json?ref=')), 'authorization must fetch committed policy');
assert(requestedUrls.some(url => url.includes('/contents/agent/failure-recurrence-calibration-corpus.json?ref=')), 'authorization must fetch committed EV-12 corpus');
assert(requestedUrls.some(url => url.includes('/contents/agent/failure-memory.json?ref=')), 'authorization must fetch committed failure memory');
assert(requestedUrls.some(url => url.includes(`/contents/${decisionPath}?ref=`)), 'authorization must fetch the exact committed decision');

const oldPass = reviewComment(7100, reviewResult('pass'), { timestamp: '2026-10-13T23:30:00Z' });
const filler = Array.from({ length: 99 }, (_, index) => ({ id: 7200 + index, body: `noise-${index}`, user: { login: 'noise' }, author_association: 'NONE', created_at: '2026-10-13T23:31:00Z', updated_at: '2026-10-13T23:31:00Z' }));
const newerFail = reviewComment(8001, reviewResult('fail', 'A later trusted review found a blocking decision issue.'), { timestamp: '2026-10-13T23:40:00Z' });
await assert.rejects(
  () => authorizeAntibodyGovernanceDecision({
    candidateSha,
    repository,
    prNumber,
    decisionPath,
    reviewPacket,
    fetchImpl: buildFetch({ commentPages: [[oldPass, ...filler], [newerFail]] }),
  }),
  /latest independent review verdict .* is fail/,
  'authorization must paginate past the first 100 comments and fail closed on a newer trusted rejection',
);

const forgedPacket = structuredClone(reviewPacket);
forgedPacket.changedFiles = ['agent/antibody-decisions/another-decision.json'];
await assert.rejects(
  () => authorizeAntibodyGovernanceDecision({
    candidateSha,
    repository,
    prNumber,
    decisionPath,
    reviewPacket: forgedPacket,
    fetchImpl: buildFetch(),
  }),
  /changedFiles do not match the complete GitHub PR diff/,
  'callers must not forge a review packet to replay a trusted pass onto another decision path',
);

console.log('ANTIBODY_GOVERNANCE_PASS eligible=2 transitionFp=0 transitionFn=0 promotionFp=0 promotionFn=0 decisions=0 enforcement=false rollback=clean lifecycle=accept+update+retire review=github-provenance+exact-decision eligibility=pinned sourceEntry=verified sourceContract=exact-target pagination=complete publicAuthorization=exercised');
