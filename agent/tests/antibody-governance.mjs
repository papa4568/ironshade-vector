import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as governanceModule from '../tools/antibody-governance.mjs';
import {
  authorizeAntibodyGovernanceDecision,
  runAntibodyGovernanceAssessment,
  validateAntibodyCanonicalSourceEntry,
  validateAntibodyGovernanceCalibrationCorpus,
  validateAntibodyGovernancePolicy,
} from '../tools/antibody-governance.mjs';
import { verifyAntibodyGovernanceEvidence } from '../tools/antibody-governance-evidence.mjs';
import { buildCandidateManifest } from '../tools/candidate-evidence.mjs';
import { evaluateArchitectureInvariants } from '../tools/check-architecture-invariants.mjs';
import { selectExperimentalReviewTask } from '../tools/experimental-review-task.mjs';
import { buildIndependentReviewPacket } from '../tools/independent-review.mjs';
import {
  clusterFailureRecords,
  proposeAntibodies,
  sha256Value,
} from '../tools/repository-immune-system.mjs';
import { selectAffectedVerification } from '../tools/select-affected-verification.mjs';

const policy = JSON.parse(await readFile(new URL('../antibody-governance-policy.json', import.meta.url), 'utf8'));
const calibration = JSON.parse(await readFile(new URL('../antibody-governance-calibration-corpus.json', import.meta.url), 'utf8'));
const ev12Corpus = JSON.parse(await readFile(new URL('../failure-recurrence-calibration-corpus.json', import.meta.url), 'utf8'));
const memory = JSON.parse(await readFile(new URL('../failure-memory.json', import.meta.url), 'utf8'));

validateAntibodyGovernancePolicy(policy);
validateAntibodyGovernanceCalibrationCorpus(calibration);
assert.equal(Object.hasOwn(governanceModule, 'evaluateAntibodyGovernanceDecision'), false, 'the raw decision evaluator must not be externally callable');
assert.equal(typeof authorizeAntibodyGovernanceDecision, 'function', 'real decision authorization must use the GitHub-backed provenance path');

const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
assert.match(candidateSha, /^[a-f0-9]{40}$/, 'governance regression must run from an exact git candidate');
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
assert.equal(report.lifecycle.exactReviewPacketRequired, true, 'trusted review must bind the exact candidate-derived review packet');
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
const packetBindingWeakened = structuredClone(policy);
packetBindingWeakened.review.provenance.packetBinding = 'task-sha-and-files-only';
assert.throws(
  () => validateAntibodyGovernancePolicy(packetBindingWeakened),
  /exact candidate-derived independent-review packet/,
  'policy must not allow a trusted result to be replayed against altered review packet content',
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

const architectureProposal = {
  kind: 'architecture-invariant',
  suggestedCheck: {
    id: 'fixture-architecture-antibody',
    check: {
      targetPath: 'src/game/fixture-guard.ts',
      requiredSubstrings: ['required-guard-marker'],
      forbiddenSubstrings: ['forbidden-guard-marker'],
    },
  },
};
const architectureSource = {
  kind: 'architecture-invariant',
  path: 'agent/architecture-invariants.json',
  entryId: 'fixture-architecture-antibody',
};
const validArchitectureEntry = {
  schemaVersion: 1,
  rules: [{
    id: 'fixture-architecture-antibody',
    type: 'sourceContract',
    description: 'Fixture architecture antibody.',
    file: 'src/game/fixture-guard.ts',
    required: ['required-guard-marker'],
    forbidden: ['forbidden-guard-marker'],
  }],
};
const architectureBinding = await validateAntibodyCanonicalSourceEntry(policy, architectureProposal, architectureSource, {
  readText: async () => JSON.stringify(validArchitectureEntry),
});
assert.equal(architectureBinding.binding, 'named-json-entry-contract', 'architecture fixed-file entries must bind the EV-4 proposed contract, not just the rule id');
const unrelatedArchitectureEntry = structuredClone(validArchitectureEntry);
unrelatedArchitectureEntry.rules[0].file = 'src/game/unrelated.ts';
await assert.rejects(
  () => validateAntibodyCanonicalSourceEntry(policy, architectureProposal, architectureSource, {
    readText: async () => JSON.stringify(unrelatedArchitectureEntry),
  }),
  /targets .* instead of EV-4 target/,
  'an unrelated architecture rule with the same id must not satisfy antibody governance',
);

const impactProposal = {
  kind: 'impact-map-rule',
  suggestedCheck: {
    id: 'fixture-impact-antibody',
    check: {
      targetPath: 'agent/impact-map.json',
      requiredSubstrings: ['verify:android'],
      forbiddenSubstrings: ['verify:none'],
    },
  },
};
const impactSource = {
  kind: 'impact-map-rule',
  path: 'agent/impact-map.json',
  entryId: 'fixture-impact-antibody',
};
const validImpactEntry = {
  schemaVersion: 1,
  rules: [{
    id: 'fixture-impact-antibody',
    include: ['src/android/**'],
    domains: ['android'],
    verificationIds: ['verify:android'],
    risk: 'normal',
  }],
};
const impactBinding = await validateAntibodyCanonicalSourceEntry(policy, impactProposal, impactSource, {
  readText: async () => JSON.stringify(validImpactEntry),
});
assert.equal(impactBinding.binding, 'named-json-entry-contract', 'impact-map fixed-file entries must bind the EV-4 proposed contract, not just the rule id');
const unrelatedImpactEntry = structuredClone(validImpactEntry);
unrelatedImpactEntry.rules[0].verificationIds = ['verify:web'];
await assert.rejects(
  () => validateAntibodyCanonicalSourceEntry(policy, impactProposal, impactSource, {
    readText: async () => JSON.stringify(unrelatedImpactEntry),
  }),
  /missing required EV-4 contract content/,
  'an unrelated impact-map rule with the same id must not satisfy antibody governance',
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
const baseSha = 'e'.repeat(40);
const branch = 'agent/ev13-authorization-fixture';
const ev13Acceptance = 'Define one trusted governance path whose review packet is derived from the exact candidate and cannot be caller-rewritten.';
const baseExperimentalRoadmap = `# Experimental Verification\n\n- [ ] **EV-13 — Define Antibody Governance**\n  - ${ev13Acceptance}\n\n- [ ] **EV-14 — Promote One Accepted Antibody**\n  - Promote exactly one reviewed antibody.\n`;
const headExperimentalRoadmap = `# Experimental Verification\n\n- [ ] **EV-14 — Promote One Accepted Antibody**\n  - Promote exactly one reviewed antibody.\n`;
const fixtureImpactMap = {
  schemaVersion: 1,
  fallback: {
    unknownDomains: ['verification'],
    unknownVerificationIds: ['verify:full'],
    highRiskVerificationIds: ['verify:full'],
  },
  verifications: {
    'verify:full': { command: 'npm run verify:full', cost: 'full', purpose: 'Fallback full verification.' },
    'ev13-governance': { command: 'node agent/tests/antibody-governance.mjs', cost: 'focused', purpose: 'EV-13 governance regression.' },
  },
  rules: [{
    id: 'antibody-decision-fixture',
    include: ['agent/antibody-decisions/**'],
    exclude: [],
    domains: ['verification'],
    verificationIds: ['ev13-governance'],
    risk: 'normal',
  }],
};
const fixtureArchitectureConfig = {
  schemaVersion: 1,
  rules: [{
    id: 'fixture-review-boundary',
    type: 'sourceContract',
    description: 'Fixture invariant for exact review packet construction.',
    file: 'agent/tests/antibody-governance.mjs',
    required: ['ANTIBODY_GOVERNANCE_PASS'],
    forbidden: [],
  }],
};
const fixtureSelection = selectExperimentalReviewTask(headExperimentalRoadmap, { baseMarkdown: baseExperimentalRoadmap });
assert.equal(fixtureSelection.task.id, 'EV-13');
const fixtureChangedFiles = [decisionPath];
const fixtureImpactSelection = selectAffectedVerification(fixtureChangedFiles, fixtureImpactMap);
const fixtureManifest = buildCandidateManifest({
  repository: 'papa4568/ironshade-vector',
  task: fixtureSelection.task,
  taskSource: 'docs/experimental-verification-roadmap.md',
  baseSha,
  headSha: candidateSha,
  branch,
  changedFiles: fixtureChangedFiles,
  impactSelection: fixtureImpactSelection,
});
const fixtureArchitectureResults = await evaluateArchitectureInvariants(fixtureArchitectureConfig);
const reviewPacket = buildIndependentReviewPacket({
  manifest: fixtureManifest,
  task: fixtureSelection.task,
  architectureResults: fixtureArchitectureResults,
});
function reviewResult(verdict, note = 'Exact decision and exact candidate-derived review packet binding are supported.') {
  return {
    schemaVersion: 1,
    taskId: 'EV-13',
    candidateSha,
    mode: 'read-only-adversarial',
    verdict,
    acceptanceChecks: reviewPacket.acceptance.map(entry => ({
      index: entry.index,
      status: verdict === 'pass' ? 'satisfied' : 'not_satisfied',
      notes: note,
    })),
    proofChecks: reviewPacket.requiredProofs.map(proof => ({
      proofId: proof.id,
      status: 'credible',
      notes: 'Fixture proof is credible.',
    })),
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
function buildFetch({ commentPages = [[happyComment]], architectureConfig = fixtureArchitectureConfig } = {}) {
  return async url => {
    requestedUrls.push(url);
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    if (pathname === `/repos/${repository}/pulls/${prNumber}`) {
      return jsonResponse({
        state: 'open',
        base: { sha: baseSha },
        head: { sha: candidateSha, ref: branch },
        user: { login: 'implementation-author' },
      });
    }
    if (pathname === `/repos/${repository}/issues/${prNumber}/comments`) {
      const page = Number(parsed.searchParams.get('page') ?? '1');
      return jsonResponse(commentPages[page - 1] ?? []);
    }
    if (pathname === `/repos/${repository}/pulls/${prNumber}/files`) return jsonResponse([{ filename: decisionPath }]);
    const contentsPrefix = `/repos/${repository}/contents/`;
    if (pathname.startsWith(contentsPrefix)) {
      const ref = parsed.searchParams.get('ref');
      const path = decodeURIComponent(pathname.slice(contentsPrefix.length));
      if (path === 'docs/experimental-verification-roadmap.md' && ref === baseSha) return jsonResponse(contentPayload(baseExperimentalRoadmap));
      assert.equal(ref, candidateSha, 'all non-base-roadmap authorization content must be fetched from the exact candidate SHA');
      const values = new Map([
        ['agent/antibody-governance-policy.json', policy],
        ['agent/failure-recurrence-calibration-corpus.json', ev12Corpus],
        ['agent/failure-memory.json', memory],
        [decisionPath, committedDecision],
        ['scripts/android-large-screen-smoke.sh', sourceContractText],
        ['docs/experimental-verification-roadmap.md', headExperimentalRoadmap],
        ['agent/impact-map.json', fixtureImpactMap],
        ['agent/architecture-invariants.json', architectureConfig],
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
assert.equal(authorized.rollbackEnvironmentApplied, false);
assert.equal(authorized.repositoryInputsLoadedFromCandidate, true, 'public authorization must load policy/calibration inputs from the candidate commit');
assert.equal(authorized.reviewPacketChangedFilesVerified, true, 'public authorization must bind the review packet to the complete GitHub PR diff');
assert.equal(authorized.reviewPacketCandidateDerived, true, 'public authorization must bind the review result to the exact candidate-derived packet');
assert.equal(authorized.reviewPacketSha256, sha256Value(reviewPacket));
assert.equal(authorized.completeReviewHistoryVerified, true, 'public authorization must inspect all PR comment pages');
assert.equal(authorized.decisionBoundToReviewedCandidate, true, 'public authorization must bind the exact decision path/digest to the reviewed candidate');
assert.equal(authorized.reviewAuthorization.decisionDigest, sha256Value(committedDecision));
assert.equal(authorized.reviewAuthorization.decisionPath, decisionPath);
assert(requestedUrls.some(url => url.includes('/contents/agent/antibody-governance-policy.json?ref=')), 'authorization must fetch committed policy');
assert(requestedUrls.some(url => url.includes('/contents/agent/failure-recurrence-calibration-corpus.json?ref=')), 'authorization must fetch committed EV-12 corpus');
assert(requestedUrls.some(url => url.includes('/contents/agent/failure-memory.json?ref=')), 'authorization must fetch committed failure memory');
assert(requestedUrls.some(url => url.includes(`/contents/${decisionPath}?ref=`)), 'authorization must fetch the exact committed decision');
assert(requestedUrls.some(url => url.includes('/contents/docs/experimental-verification-roadmap.md?ref=')), 'authorization must reconstruct review acceptance from the exact roadmap');
assert(requestedUrls.some(url => url.includes('/contents/agent/impact-map.json?ref=')), 'authorization must reconstruct review impact from the exact candidate impact map');
assert(requestedUrls.some(url => url.includes('/contents/agent/architecture-invariants.json?ref=')), 'authorization must reconstruct the exact review invariant packet');

const previousRollbackEnvironment = process.env[policy.rollback.environmentVariable];
process.env[policy.rollback.environmentVariable] = policy.rollback.disabledValue;
try {
  const rollbackAuthorized = await authorizeAntibodyGovernanceDecision({
    candidateSha,
    repository,
    prNumber,
    decisionPath,
    reviewPacket,
    fetchImpl: buildFetch(),
  });
  assert.equal(rollbackAuthorized.transitionValid, true, 'rollback may preserve decision validation evidence');
  assert.equal(rollbackAuthorized.governanceEnabled, false, 'documented rollback must disable public authorization');
  assert.equal(rollbackAuthorized.promotionEligible, false, 'documented rollback must authorize zero promotions through the public API');
  assert.equal(rollbackAuthorized.rollbackEnvironmentApplied, true, 'public authorization must report that the rollback environment disabled governance');
} finally {
  if (previousRollbackEnvironment === undefined) delete process.env[policy.rollback.environmentVariable];
  else process.env[policy.rollback.environmentVariable] = previousRollbackEnvironment;
}

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

const alteredAcceptancePacket = structuredClone(reviewPacket);
alteredAcceptancePacket.acceptance[0].text += ' Caller-injected alternate criterion.';
await assert.rejects(
  () => authorizeAntibodyGovernanceDecision({
    candidateSha,
    repository,
    prNumber,
    decisionPath,
    reviewPacket: alteredAcceptancePacket,
    fetchImpl: buildFetch(),
  }),
  /does not match the exact candidate-derived independent-review packet/,
  'a trusted same-task same-SHA review result must not be replayable against altered acceptance text',
);

const failingArchitectureConfig = structuredClone(fixtureArchitectureConfig);
failingArchitectureConfig.rules[0].required = ['THIS_INVARIANT_MARKER_DOES_NOT_EXIST'];
await assert.rejects(
  () => authorizeAntibodyGovernanceDecision({
    candidateSha,
    repository,
    prNumber,
    decisionPath,
    reviewPacket,
    fetchImpl: buildFetch({ architectureConfig: failingArchitectureConfig }),
  }),
  /fixture-review-boundary|required/i,
  'authorization must evaluate exact-candidate architecture invariants instead of synthesizing passed statuses',
);

console.log('ANTIBODY_GOVERNANCE_PASS eligible=2 transitionFp=0 transitionFn=0 promotionFp=0 promotionFn=0 decisions=0 enforcement=false rollback=clean+public-authorization lifecycle=accept+update+retire review=github-provenance+exact-decision+exact-packet eligibility=pinned sourceEntry=verified sourceContract=exact-target+fixed-rule-semantics invariantPacket=evaluated pagination=complete publicAuthorization=exercised');
