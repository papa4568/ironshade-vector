import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalJson,
  clusterFailureRecords,
  proposeAntibodies,
  sha256Value,
} from './repository-immune-system.mjs';
import { runFailureRecurrenceCalibration } from './failure-recurrence-calibration.mjs';
import { selectAuthoritativeReviewCommentWithProvenance } from './review-comment-gate.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const ACTIONS = new Set(['accept', 'update', 'retire']);
const CHECK_KINDS = ['architecture-invariant', 'impact-map-rule', 'focused-regression', 'telemetry-check'];
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR', 'TRUSTED_MAIN_ACTIONS']);
const REVIEW_CAPABILITY = Symbol('ironshade-antibody-governance-trusted-review');
const GOVERNANCE_METRICS = [
  'transitionFalsePositives',
  'transitionFalseNegatives',
  'promotionFalsePositives',
  'promotionFalseNegatives',
];
const EV12_METRICS = [
  'overClusteringPairs',
  'underClusteringPairs',
  'recurrenceFalsePositiveRecords',
  'recurrenceFalseNegativeRecords',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertIsoInstant(value, label) {
  assertString(value, label);
  assert(!Number.isNaN(Date.parse(value)) && /T/.test(value), `${label} must be an ISO date-time`);
}

function assertBoolean(value, label) {
  assert(typeof value === 'boolean', `${label} must be boolean`);
}

function assertMetricObject(value, keys, label) {
  assertObject(value, label);
  for (const key of keys) assert(Number.isInteger(value[key]) && value[key] >= 0, `${label}.${key} must be a non-negative integer`);
}

function normalizePath(path) {
  assertString(path, 'sourceOfTruth.path');
  assert(!path.startsWith('/') && !path.includes('..') && !path.includes('\\'), 'sourceOfTruth.path must be a repository-relative normalized path');
  return path;
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function exactArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateAntibodyGovernancePolicy(policy) {
  assertObject(policy, 'antibody governance policy');
  assert(policy.schemaVersion === 1, 'antibody governance policy schemaVersion must be 1');
  assert(policy.mode === 'governance-only', 'EV-13 policy mode must be governance-only');
  assert(policy.governanceEnabled === true, 'EV-13 policy governanceEnabled must be true');
  assert(policy.enforcementEnabled === false, 'EV-13 policy must not enable antibody enforcement');

  assertObject(policy.ownership, 'policy.ownership');
  assert(policy.ownership.proposalOwner === 'implementation-owner', 'proposal ownership must remain with the implementation owner');
  assert(policy.ownership.decisionOwner === 'trusted-repository-participant', 'accept/update/retire decisions must be owned by a trusted repository participant');
  assert(policy.ownership.sourceCheckOwner === 'canonical-check-owner', 'promoted behavior must be owned by the canonical check');
  assert(policy.ownership.historyOwner === 'repository', 'decision history must remain repository-owned');

  assertObject(policy.review, 'policy.review');
  assert(policy.review.authority === 'trusted-repository-participant', 'review authority must be trusted-repository-participant');
  assert(Array.isArray(policy.review.actionsRequiringReview), 'policy.review.actionsRequiringReview must be an array');
  assert(exactArray(sorted(policy.review.actionsRequiringReview), ['accept', 'retire', 'update']), 'accept, update, and retire must all require review');
  assert(Number.isInteger(policy.review.minimumRationaleCharacters) && policy.review.minimumRationaleCharacters >= 20, 'review rationale minimum must be at least 20 characters');
  assert(policy.review.evidenceRequirement === 'pull-request-or-independent-review', 'review evidence must remain repository-reviewable');
  assertObject(policy.review.provenance, 'policy.review.provenance');
  assert(policy.review.provenance.source === 'github-pr-conversation', 'trusted review provenance must come from the GitHub PR conversation');
  assert(policy.review.provenance.verifier === 'agent/tools/review-comment-gate.mjs', 'trusted review provenance must reuse the repository review-comment gate');
  assert(policy.review.provenance.requireRepositoryFetch === true, 'trusted review provenance must be fetched from GitHub rather than supplied by the decision record');

  assertObject(policy.calibration, 'policy.calibration');
  assert(policy.calibration.sourceTask === 'EV-12', 'EV-13 eligibility must be sourced only from EV-12');
  assert(DIGEST_PATTERN.test(policy.calibration.corpusSha256 ?? ''), 'policy calibration corpusSha256 must be a SHA-256 digest');
  assert(DIGEST_PATTERN.test(policy.calibration.sourceFailureMemorySha256 ?? ''), 'policy calibration sourceFailureMemorySha256 must be a SHA-256 digest');
  assert(Array.isArray(policy.calibration.eligibleTruthIds) && policy.calibration.eligibleTruthIds.length > 0, 'policy must name at least one EV-12 eligible truth id');
  assert(new Set(policy.calibration.eligibleTruthIds).size === policy.calibration.eligibleTruthIds.length, 'eligibleTruthIds must be unique');
  assertMetricObject(policy.calibration.errorBudget, EV12_METRICS, 'policy.calibration.errorBudget');
  for (const key of EV12_METRICS) assert(policy.calibration.errorBudget[key] === 0, `EV-13 ${key} budget must remain zero`);

  assertObject(policy.sourceOfTruthByKind, 'policy.sourceOfTruthByKind');
  assert(exactArray(sorted(Object.keys(policy.sourceOfTruthByKind)), sorted(CHECK_KINDS)), 'policy must map every EV-4 antibody kind exactly once');
  assert(policy.sourceOfTruthByKind['architecture-invariant'].mode === 'fixed-file' && policy.sourceOfTruthByKind['architecture-invariant'].path === 'agent/architecture-invariants.json', 'architecture antibodies must promote into agent/architecture-invariants.json');
  assert(policy.sourceOfTruthByKind['impact-map-rule'].mode === 'fixed-file' && policy.sourceOfTruthByKind['impact-map-rule'].path === 'agent/impact-map.json', 'impact-map antibodies must promote into agent/impact-map.json');
  for (const kind of ['focused-regression', 'telemetry-check']) {
    const mapping = policy.sourceOfTruthByKind[kind];
    assert(mapping.mode === 'existing-check-file', `${kind} must bind an existing check file instead of a governance registry`);
    assert(Array.isArray(mapping.allowedPrefixes) && mapping.allowedPrefixes.length > 0, `${kind}.allowedPrefixes must be non-empty`);
    assert(Array.isArray(mapping.forbiddenPrefixes) && mapping.forbiddenPrefixes.length > 0, `${kind}.forbiddenPrefixes must be non-empty`);
  }

  assertObject(policy.decisions, 'policy.decisions');
  assert(policy.decisions.directory === 'agent/antibody-decisions', 'decision history must live under agent/antibody-decisions');
  assert(policy.decisions.schema === '../antibody-governance.schema.json', 'decision records must use the EV-13 schema');
  assert(policy.decisions.initialPromotionTask === 'EV-14', 'the first governance promotion candidate must remain EV-14');
  assert(policy.decisions.allowCommittedDecisionsInEv13 === false, 'EV-13 must not commit an accepted antibody decision');

  assertObject(policy.rollback, 'policy.rollback');
  assert(policy.rollback.environmentVariable === 'IRONSHADE_ANTIBODY_GOVERNANCE', 'rollback environment variable must be stable');
  assert(policy.rollback.disabledValue === '0', 'rollback disabled value must be 0');
  assertString(policy.rollback.behavior, 'policy.rollback.behavior');
  return policy;
}

export function validateAntibodyGovernanceCalibrationCorpus(calibrationCorpus) {
  assertObject(calibrationCorpus, 'antibody governance calibration corpus');
  assert(calibrationCorpus.schemaVersion === 1, 'antibody governance calibration schemaVersion must be 1');
  assert(calibrationCorpus.mode === 'governance-only', 'antibody governance calibration mode must be governance-only');
  assertMetricObject(calibrationCorpus.errorBudget, GOVERNANCE_METRICS, 'antibody governance calibration errorBudget');
  for (const key of GOVERNANCE_METRICS) assert(calibrationCorpus.errorBudget[key] === 0, `EV-13 ${key} budget must remain zero`);
  assert(Array.isArray(calibrationCorpus.cases) && calibrationCorpus.cases.length > 0, 'antibody governance calibration cases must be non-empty');
  const ids = new Set();
  for (const [index, entry] of calibrationCorpus.cases.entries()) {
    const label = `calibration.cases[${index}]`;
    assertObject(entry, label);
    assertString(entry.id, `${label}.id`);
    assert(!ids.has(entry.id), `duplicate governance calibration case ${entry.id}`);
    ids.add(entry.id);
    assertString(entry.truthId, `${label}.truthId`);
    assert(ACTIONS.has(entry.action), `${label}.action must be accept, update, or retire`);
    assertBoolean(entry.reviewed, `${label}.reviewed`);
    if (entry.trustedReview !== undefined) assertBoolean(entry.trustedReview, `${label}.trustedReview`);
    assertObject(entry.sourceOfTruth, `${label}.sourceOfTruth`);
    assertBoolean(entry.expectedTransitionValid, `${label}.expectedTransitionValid`);
    assertBoolean(entry.expectedPromotionEligible, `${label}.expectedPromotionEligible`);
    if (entry.tamperPreviousDecisionDigest !== undefined) assertBoolean(entry.tamperPreviousDecisionDigest, `${label}.tamperPreviousDecisionDigest`);
  }
  return calibrationCorpus;
}

function validateReviewEvidenceShape(evidence) {
  assertObject(evidence, 'antibody decision.review.evidence');
  assert(evidence.type === 'github-pr-review', 'antibody review evidence type must be github-pr-review');
  assert(/^EV-\d+$/.test(evidence.taskId ?? ''), 'antibody review evidence taskId must be an EV task');
  assert(SHA_PATTERN.test(evidence.candidateSha ?? ''), 'antibody review evidence candidateSha must be a full lowercase commit SHA');
  assert(Number.isInteger(evidence.commentId) && evidence.commentId > 0, 'antibody review evidence commentId must be positive');
  assert(DIGEST_PATTERN.test(evidence.reviewResultSha256 ?? ''), 'antibody review evidence reviewResultSha256 must be SHA-256');
  assert(TRUSTED_ASSOCIATIONS.has(evidence.authorAssociation), 'antibody review evidence authorAssociation is not trusted');
  assert(evidence.sourceRunId === null || (Number.isInteger(evidence.sourceRunId) && evidence.sourceRunId > 0), 'antibody review evidence sourceRunId must be null or positive');
}

function validateReview(policy, decisionReview, verifiedReview) {
  assertObject(decisionReview, 'antibody decision.review');
  assert(verifiedReview?.[REVIEW_CAPABILITY] === true, 'trusted review provenance is required; self-attested review fields cannot authorize an antibody');
  assert(decisionReview.authority === policy.review.authority, `antibody review authority must be ${policy.review.authority}`);
  assertString(decisionReview.reviewer, 'antibody decision.review.reviewer');
  assertIsoInstant(decisionReview.reviewedAt, 'antibody decision.review.reviewedAt');
  assertString(decisionReview.rationale, 'antibody decision.review.rationale');
  assert(decisionReview.rationale.trim().length >= policy.review.minimumRationaleCharacters, `antibody review rationale must contain at least ${policy.review.minimumRationaleCharacters} characters`);
  validateReviewEvidenceShape(decisionReview.evidence);
  assert(decisionReview.reviewer === verifiedReview.reviewer, 'antibody review reviewer does not match trusted GitHub review provenance');
  assert(decisionReview.reviewedAt === verifiedReview.reviewedAt, 'antibody review reviewedAt does not match trusted GitHub review provenance');
  assert(decisionReview.evidence.taskId === verifiedReview.taskId, 'antibody review task does not match trusted review provenance');
  assert(decisionReview.evidence.candidateSha === verifiedReview.candidateSha, 'antibody review candidate does not match trusted review provenance');
  assert(decisionReview.evidence.commentId === verifiedReview.commentId, 'antibody review comment does not match trusted review provenance');
  assert(decisionReview.evidence.reviewResultSha256 === verifiedReview.reviewResultSha256, 'antibody review result digest does not match trusted review provenance');
  assert(decisionReview.evidence.authorAssociation === verifiedReview.authorAssociation, 'antibody review association does not match trusted review provenance');
  assert(decisionReview.evidence.sourceRunId === verifiedReview.sourceRunId, 'antibody review source run does not match trusted review provenance');
}

function validateSourceMapping(policy, proposal, sourceOfTruth) {
  assertObject(sourceOfTruth, 'antibody decision.sourceOfTruth');
  assert(CHECK_KINDS.includes(sourceOfTruth.kind), 'antibody decision sourceOfTruth.kind is unsupported');
  assert(sourceOfTruth.kind === proposal.kind, `source-of-truth kind ${sourceOfTruth.kind} does not match proposal kind ${proposal.kind}`);
  const path = normalizePath(sourceOfTruth.path);
  assertString(sourceOfTruth.entryId, 'antibody decision.sourceOfTruth.entryId');
  assert(sourceOfTruth.entryId === proposal.suggestedCheck.id, 'source-of-truth entryId must match the EV-4 proposed check id');
  const mapping = policy.sourceOfTruthByKind[sourceOfTruth.kind];
  if (mapping.mode === 'fixed-file') {
    assert(path === mapping.path, `${sourceOfTruth.kind} source of truth must be ${mapping.path}`);
  } else {
    assert(mapping.allowedPrefixes.some(prefix => path.startsWith(prefix)), `${sourceOfTruth.kind} source-of-truth path is outside its allowed repository check surfaces`);
    assert(!mapping.forbiddenPrefixes.some(prefix => path.startsWith(prefix)), `${sourceOfTruth.kind} source-of-truth path cannot point into antibody governance history or policy`);
  }
  return { ...sourceOfTruth, path };
}

function jsonContainsCanonicalEntry(kind, parsed, entryId) {
  if (kind === 'architecture-invariant') return Array.isArray(parsed?.rules) && parsed.rules.some(entry => entry?.id === entryId);
  if (kind === 'impact-map-rule') return Array.isArray(parsed?.rules) && parsed.rules.some(entry => entry?.id === entryId);
  return false;
}

async function validateCanonicalSourceEntry(policy, proposal, sourceOfTruth, {
  readText = async path => readFile(resolve(path), 'utf8'),
} = {}) {
  const normalized = validateSourceMapping(policy, proposal, sourceOfTruth);
  let text;
  try {
    text = await readText(normalized.path);
  } catch {
    throw new Error(`canonical source-of-truth file does not exist or is unreadable: ${normalized.path}`);
  }
  assert(typeof text === 'string', `canonical source-of-truth reader must return text for ${normalized.path}`);
  if (normalized.kind === 'architecture-invariant' || normalized.kind === 'impact-map-rule') {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`canonical ${normalized.kind} source is not valid JSON: ${normalized.path}`);
    }
    assert(jsonContainsCanonicalEntry(normalized.kind, parsed, normalized.entryId), `canonical source-of-truth entry ${normalized.entryId} does not exist in ${normalized.path}`);
  } else {
    assert(text.includes(normalized.entryId), `canonical source-of-truth entry ${normalized.entryId} does not exist in ${normalized.path}`);
  }
  return normalized;
}

function proposalForTruth(corpus, truthId) {
  const group = corpus.truthGroups.find(entry => entry.truthId === truthId);
  assert(group, `unknown EV-12 truthId ${truthId}`);
  assert(group.governance === 'eligible-for-ev13-review', `EV-12 truthId ${truthId} remains advisory-only and cannot enter antibody governance`);
  const memory = clusterFailureRecords(group.records, {
    maxSamplesPerClass: corpus.calibrationMaxSamplesPerClass,
    maxSerializedBytes: corpus.calibrationMaxSerializedBytes,
  });
  const proposals = proposeAntibodies(memory);
  assert(proposals.length === 1, `EV-12 truthId ${truthId} must resolve to exactly one recurring antibody proposal`);
  return proposals[0];
}

function decisionDigest(decision) {
  return sha256Value(decision);
}

function validatePinnedEligibility(policy, ev12Corpus, failureMemory, candidateSha) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  assert(sha256Value(ev12Corpus) === policy.calibration.corpusSha256, 'EV-12 calibration corpus digest drift requires a reviewed governance policy update');
  assert(sha256Value(failureMemory) === policy.calibration.sourceFailureMemorySha256, 'EV-4 failure-memory digest drift requires EV-12 recalibration before governance can expand');
  const ev12 = runFailureRecurrenceCalibration(ev12Corpus, failureMemory, { candidateSha });
  assert(ev12.calibrationPass === true, 'EV-13 requires the exact candidate EV-12 calibration to pass');
  assert(ev12.eligibleScope.withinBudget === true, 'EV-13 requires EV-12 eligible scope within its zero-error budget');
  const eligibleTruthIds = ev12.eligibleScope.stableForGovernance.map(entry => entry.truthId).sort((a, b) => a.localeCompare(b));
  assert(exactArray(eligibleTruthIds, sorted(policy.calibration.eligibleTruthIds)), 'EV-13 policy eligible scope must exactly match EV-12 measured stable scope');
  for (const key of EV12_METRICS) {
    assert(ev12.eligibleScope.measuredErrors[key] <= policy.calibration.errorBudget[key], `EV-12 eligible ${key} exceeds EV-13 governance budget`);
  }
  return { ev12, eligibleTruthIds };
}

function trustedReviewCapability({ reviewer, reviewedAt, taskId, candidateSha, commentId, reviewResultSha256, authorAssociation, sourceRunId }) {
  assertString(reviewer, 'trusted review reviewer');
  assertIsoInstant(reviewedAt, 'trusted review reviewedAt');
  assert(/^EV-\d+$/.test(taskId ?? ''), 'trusted review taskId must be an EV task');
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'trusted review candidateSha must be a full lowercase commit SHA');
  assert(Number.isInteger(commentId) && commentId > 0, 'trusted review commentId must be positive');
  assert(DIGEST_PATTERN.test(reviewResultSha256 ?? ''), 'trusted review result digest must be SHA-256');
  assert(TRUSTED_ASSOCIATIONS.has(authorAssociation), 'trusted review authorAssociation is invalid');
  assert(sourceRunId === null || (Number.isInteger(sourceRunId) && sourceRunId > 0), 'trusted review sourceRunId must be null or positive');
  return Object.freeze({
    [REVIEW_CAPABILITY]: true,
    reviewer,
    reviewedAt,
    taskId,
    candidateSha,
    commentId,
    reviewResultSha256,
    authorAssociation,
    sourceRunId,
  });
}

function calibrationReviewCapability(entry, candidateSha) {
  if (!entry.reviewed || entry.trustedReview === false) return null;
  const commentId = 9000000000 + [...entry.id].reduce((sum, char) => sum + char.codePointAt(0), 0);
  return trustedReviewCapability({
    reviewer: 'ev13-calibration-reviewer',
    reviewedAt: '2026-10-13T22:45:00Z',
    taskId: 'EV-13',
    candidateSha,
    commentId,
    reviewResultSha256: sha256Value({ calibrationCase: entry.id, verdict: 'pass' }),
    authorAssociation: 'COLLABORATOR',
    sourceRunId: null,
  });
}

function reviewFromCapability(entry, capability) {
  if (!entry.reviewed) return undefined;
  const evidence = capability
    ? {
        type: 'github-pr-review',
        taskId: capability.taskId,
        candidateSha: capability.candidateSha,
        commentId: capability.commentId,
        reviewResultSha256: capability.reviewResultSha256,
        authorAssociation: capability.authorAssociation,
        sourceRunId: capability.sourceRunId,
      }
    : {
        type: 'github-pr-review',
        taskId: 'EV-13',
        candidateSha: 'f'.repeat(40),
        commentId: 1,
        reviewResultSha256: '0'.repeat(64),
        authorAssociation: 'COLLABORATOR',
        sourceRunId: null,
      };
  return {
    authority: 'trusted-repository-participant',
    reviewer: capability?.reviewer ?? 'self-attested-reviewer',
    reviewedAt: capability?.reviewedAt ?? '2026-10-13T22:45:00Z',
    rationale: `EV-13 deterministic governance calibration for ${entry.id}.`,
    evidence,
  };
}

async function evaluateDecision({
  policy,
  ev12Corpus,
  failureMemory,
  candidateSha,
  decision,
  previousDecision = null,
  governanceEnabled = true,
  verifiedReview,
  pinnedEligibility = null,
  readText,
}) {
  validateAntibodyGovernancePolicy(policy);
  const eligibility = pinnedEligibility ?? validatePinnedEligibility(policy, ev12Corpus, failureMemory, candidateSha);
  assertObject(decision, 'antibody decision');
  assert(decision.schemaVersion === 1, 'antibody decision schemaVersion must be 1');
  assert(ACTIONS.has(decision.action), 'antibody decision action must be accept, update, or retire');
  assertString(decision.antibodyId, 'antibody decision.antibodyId');
  assertString(decision.truthId, 'antibody decision.truthId');
  assert(eligibility.eligibleTruthIds.includes(decision.truthId), `EV-12 truthId ${decision.truthId} is not in the policy-pinned zero-error governance scope`);
  assertString(decision.sourceFailureClass, 'antibody decision.sourceFailureClass');
  assert(DIGEST_PATTERN.test(decision.proposalDigest ?? ''), 'antibody decision proposalDigest must be a SHA-256 digest');
  assert(Number.isInteger(decision.revision) && decision.revision >= 1, 'antibody decision revision must be a positive integer');
  const proposal = proposalForTruth(ev12Corpus, decision.truthId);
  assert(decision.antibodyId === proposal.id, 'antibody decision antibodyId must match the EV-4 proposal');
  assert(decision.sourceFailureClass === proposal.sourceFailureClass, 'antibody decision sourceFailureClass must match the EV-4 proposal');
  assert(decision.proposalDigest === sha256Value(proposal), 'antibody decision proposalDigest must match the exact EV-4 proposal');
  const sourceOfTruth = await validateCanonicalSourceEntry(policy, proposal, decision.sourceOfTruth, { readText });
  validateReview(policy, decision.review, verifiedReview);
  assertObject(decision.promotion, 'antibody decision.promotion');

  if (decision.action === 'accept') {
    assert(previousDecision === null, 'initial antibody acceptance cannot name a previous decision object');
    assert(decision.revision === 1, 'initial antibody acceptance revision must be 1');
    assert(decision.previousDecisionDigest === null, 'initial antibody acceptance previousDecisionDigest must be null');
    assert(decision.promotion.state === 'not-promoted', 'accepted antibody governance record must remain not-promoted until its source check is promoted');
    assert(decision.promotion.taskId === policy.decisions.initialPromotionTask, `initial accepted antibody must point to ${policy.decisions.initialPromotionTask}`);
  } else {
    assertObject(previousDecision, 'previous antibody decision');
    assert(previousDecision.antibodyId === decision.antibodyId && previousDecision.truthId === decision.truthId, 'update/retire must preserve antibody and truth identity');
    assert(previousDecision.action === 'accept' || previousDecision.action === 'update', 'only an active accepted/updated antibody may be updated or retired');
    assert(decision.revision === previousDecision.revision + 1, 'update/retire revision must increment the previous decision by one');
    assert(decision.previousDecisionDigest === decisionDigest(previousDecision), 'update/retire previousDecisionDigest must bind the exact prior decision');
    if (decision.action === 'update') {
      assert(decision.promotion.state === 'not-promoted', 'updated antibody remains not-promoted until its canonical source check is promoted');
      assert(decision.promotion.taskId === policy.decisions.initialPromotionTask, `updated pre-promotion antibody must point to ${policy.decisions.initialPromotionTask}`);
    } else {
      assert(decision.promotion.state === 'retired', 'retirement must mark the antibody retired');
      assert(decision.promotion.taskId === null, 'retired antibody cannot retain a promotion task');
    }
  }

  const wouldBePromotionEligible = decision.action !== 'retire';
  return {
    schema: 'ironshade-antibody-governance-decision:v1',
    transitionValid: true,
    governanceEnabled,
    action: decision.action,
    antibodyId: decision.antibodyId,
    truthId: decision.truthId,
    sourceOfTruth,
    decisionDigest: decisionDigest(decision),
    reviewProvenanceVerified: true,
    pinnedEligibilityVerified: true,
    canonicalSourceEntryVerified: true,
    wouldBePromotionEligible,
    promotionEligible: governanceEnabled && wouldBePromotionEligible,
    enforcementEnabled: false,
    candidatePassGranted: false,
  };
}

async function githubJson(path) {
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  assertString(repository, 'GITHUB_REPOSITORY');
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  const response = await fetch(`https://api.github.com/${path.replace(/^\//, '')}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await response.text();
  assert(response.ok, `GitHub governance provenance request ${path} failed ${response.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

export async function authorizeAntibodyGovernanceDecision({
  policy,
  ev12Corpus,
  failureMemory,
  candidateSha,
  decision,
  previousDecision = null,
  reviewPacket,
  repository,
  prNumber,
  governanceEnabled = true,
}) {
  validateAntibodyGovernancePolicy(policy);
  assertString(repository, 'repository');
  assert(process.env.GITHUB_REPOSITORY?.trim() === repository, 'repository must match GITHUB_REPOSITORY for trusted review provenance');
  assert(Number.isInteger(prNumber) && prNumber > 0, 'prNumber must be a positive integer');
  assertObject(reviewPacket, 'reviewPacket');
  assert(reviewPacket.candidateSha === candidateSha, 'review packet candidate must match antibody decision candidate');
  assert(/^EV-\d+$/.test(reviewPacket.taskId ?? ''), 'review packet task must be an EV task');
  assert(decision?.review?.evidence?.taskId === reviewPacket.taskId, 'decision review task must match the trusted review packet');

  const [pr, comments] = await Promise.all([
    githubJson(`repos/${repository}/pulls/${prNumber}`),
    githubJson(`repos/${repository}/issues/${prNumber}/comments?per_page=100`),
  ]);
  assert(pr?.head?.sha === candidateSha, 'trusted review PR head no longer matches the antibody decision candidate');
  assertString(pr?.user?.login, 'pull request author');
  assert(Array.isArray(comments), 'GitHub PR comments payload must be an array');

  const selected = await selectAuthoritativeReviewCommentWithProvenance(reviewPacket, comments, { prAuthor: pr.user.login });
  const selectedComment = comments.find(comment => comment?.id === selected.commentId);
  assert(selectedComment, `trusted review comment ${selected.commentId} is missing from the fetched PR conversation`);
  const reviewedAt = selectedComment.updated_at ?? selectedComment.created_at;
  assertIsoInstant(reviewedAt, 'trusted review comment timestamp');
  const capability = trustedReviewCapability({
    reviewer: selected.reviewer,
    reviewedAt,
    taskId: reviewPacket.taskId,
    candidateSha,
    commentId: selected.commentId,
    reviewResultSha256: sha256Value(selected.result),
    authorAssociation: selected.authorAssociation,
    sourceRunId: Number.isInteger(selected.result?.sourceRunId) ? selected.result.sourceRunId : null,
  });

  return evaluateDecision({
    policy,
    ev12Corpus,
    failureMemory,
    candidateSha,
    decision,
    previousDecision,
    governanceEnabled,
    verifiedReview: capability,
  });
}

function sourceForPrevious(entry) {
  return structuredClone(entry.sourceOfTruth);
}

function decisionForCase(entry, proposal, policy, candidateSha, previousDecision = null) {
  const capability = calibrationReviewCapability(entry, candidateSha);
  const action = entry.action;
  const revision = previousDecision ? previousDecision.revision + 1 : 1;
  const previousDecisionDigest = previousDecision
    ? (entry.tamperPreviousDecisionDigest ? '0'.repeat(64) : decisionDigest(previousDecision))
    : null;
  return {
    capability,
    decision: {
      schemaVersion: 1,
      antibodyId: proposal.id,
      truthId: entry.truthId,
      sourceFailureClass: proposal.sourceFailureClass,
      proposalDigest: sha256Value(proposal),
      revision,
      action,
      previousDecisionDigest,
      sourceOfTruth: structuredClone(entry.sourceOfTruth),
      ...(entry.reviewed ? { review: reviewFromCapability(entry, capability) } : {}),
      promotion: action === 'retire'
        ? { state: 'retired', taskId: null }
        : { state: 'not-promoted', taskId: policy.decisions.initialPromotionTask },
    },
  };
}

function buildPreviousDecision(entry, proposal, policy, candidateSha) {
  if (entry.action === 'accept') return null;
  const previousEntry = { ...entry, id: `${entry.id}:prior`, reviewed: true, trustedReview: true };
  const capability = calibrationReviewCapability(previousEntry, candidateSha);
  return {
    schemaVersion: 1,
    antibodyId: proposal.id,
    truthId: entry.truthId,
    sourceFailureClass: proposal.sourceFailureClass,
    proposalDigest: sha256Value(proposal),
    revision: 1,
    action: 'accept',
    previousDecisionDigest: null,
    sourceOfTruth: sourceForPrevious(entry),
    review: {
      authority: 'trusted-repository-participant',
      reviewer: capability.reviewer,
      reviewedAt: capability.reviewedAt,
      rationale: `EV-13 deterministic prior acceptance for ${entry.id}.`,
      evidence: {
        type: 'github-pr-review',
        taskId: capability.taskId,
        candidateSha: capability.candidateSha,
        commentId: capability.commentId,
        reviewResultSha256: capability.reviewResultSha256,
        authorAssociation: capability.authorAssociation,
        sourceRunId: capability.sourceRunId,
      },
    },
    promotion: { state: 'not-promoted', taskId: policy.decisions.initialPromotionTask },
  };
}

async function classifyCalibrationCase({ policy, ev12Corpus, failureMemory, entry, candidateSha, governanceEnabled, pinnedEligibility, readText }) {
  let result = null;
  let error = null;
  try {
    const proposal = proposalForTruth(ev12Corpus, entry.truthId);
    const previousDecision = buildPreviousDecision(entry, proposal, policy, candidateSha);
    const { decision, capability } = decisionForCase(entry, proposal, policy, candidateSha, previousDecision);
    result = await evaluateDecision({
      policy,
      ev12Corpus,
      failureMemory,
      candidateSha,
      decision,
      previousDecision,
      governanceEnabled,
      verifiedReview: capability,
      pinnedEligibility,
      readText,
    });
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return {
    id: entry.id,
    action: entry.action,
    truthId: entry.truthId,
    expectedTransitionValid: entry.expectedTransitionValid,
    actualTransitionValid: result?.transitionValid === true,
    expectedPromotionEligible: governanceEnabled ? entry.expectedPromotionEligible : false,
    actualPromotionEligible: result?.promotionEligible === true,
    wouldBePromotionEligible: result?.wouldBePromotionEligible === true,
    reviewProvenanceVerified: result?.reviewProvenanceVerified === true,
    pinnedEligibilityVerified: result?.pinnedEligibilityVerified === true,
    canonicalSourceEntryVerified: result?.canonicalSourceEntryVerified === true,
    error,
  };
}

function measureGovernanceCases(cases) {
  const metrics = Object.fromEntries(GOVERNANCE_METRICS.map(key => [key, 0]));
  for (const entry of cases) {
    if (!entry.expectedTransitionValid && entry.actualTransitionValid) metrics.transitionFalsePositives += 1;
    if (entry.expectedTransitionValid && !entry.actualTransitionValid) metrics.transitionFalseNegatives += 1;
    if (!entry.expectedPromotionEligible && entry.actualPromotionEligible) metrics.promotionFalsePositives += 1;
    if (entry.expectedPromotionEligible && !entry.actualPromotionEligible) metrics.promotionFalseNegatives += 1;
  }
  return metrics;
}

async function countDecisionRecords(directory) {
  try {
    const entries = await readdir(resolve(directory), { withFileTypes: true });
    return entries.filter(entry => entry.isFile() && entry.name.endsWith('.json')).length;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return 0;
    throw error;
  }
}

export async function runAntibodyGovernanceAssessment(policy, calibrationCorpus, ev12Corpus, failureMemory, {
  candidateSha,
  governanceOverride = null,
  decisionRecordCount = null,
  readText,
} = {}) {
  validateAntibodyGovernancePolicy(policy);
  validateAntibodyGovernanceCalibrationCorpus(calibrationCorpus);
  const sourceMemoryBefore = canonicalJson(failureMemory);
  const pinnedEligibility = validatePinnedEligibility(policy, ev12Corpus, failureMemory, candidateSha);
  const governanceEnabled = governanceOverride ?? policy.governanceEnabled;

  const activeCases = [];
  for (const entry of calibrationCorpus.cases) {
    activeCases.push(await classifyCalibrationCase({
      policy,
      ev12Corpus,
      failureMemory,
      entry,
      candidateSha,
      governanceEnabled,
      pinnedEligibility,
      readText,
    }));
  }
  const measuredErrors = measureGovernanceCases(activeCases);
  const withinBudget = GOVERNANCE_METRICS.every(key => measuredErrors[key] <= calibrationCorpus.errorBudget[key]);

  const rollbackCases = [];
  for (const entry of calibrationCorpus.cases) {
    rollbackCases.push(await classifyCalibrationCase({
      policy,
      ev12Corpus,
      failureMemory,
      entry,
      candidateSha,
      governanceEnabled: false,
      pinnedEligibility,
      readText,
    }));
  }
  const rollbackMeasuredErrors = measureGovernanceCases(rollbackCases);
  const rollbackPromotionAuthorizations = rollbackCases.filter(entry => entry.actualPromotionEligible).length;
  const recordCount = decisionRecordCount ?? await countDecisionRecords(policy.decisions.directory);
  const sourceMemoryUnchanged = canonicalJson(failureMemory) === sourceMemoryBefore;
  const pass = withinBudget
    && sourceMemoryUnchanged
    && pinnedEligibility.ev12.calibrationPass
    && (!policy.decisions.allowCommittedDecisionsInEv13 ? recordCount === 0 : true)
    && rollbackPromotionAuthorizations === 0;

  return {
    schema: 'ironshade-antibody-governance:v1',
    mode: governanceEnabled ? 'governance-only' : 'advisory-rollback',
    blockingGovernanceValidation: governanceEnabled,
    candidateSha,
    policySha256: sha256Value(policy),
    calibrationCorpusSha256: sha256Value(calibrationCorpus),
    ev12CorpusSha256: sha256Value(ev12Corpus),
    sourceFailureMemorySha256: sha256Value(failureMemory),
    governanceEnabled,
    enforcementEnabled: false,
    acceptedForEnforcement: false,
    candidatePassGranted: false,
    eligibleTruthIds: pinnedEligibility.eligibleTruthIds,
    lifecycle: {
      reviewedActions: [...policy.review.actionsRequiringReview],
      decisionRecordCount: recordCount,
      committedDecisionAllowedInEv13: policy.decisions.allowCommittedDecisionsInEv13,
      initialPromotionTask: policy.decisions.initialPromotionTask,
      trustedReviewProvenanceRequired: true,
      canonicalSourceEntryRequired: true,
      directDecisionEvaluatorExported: false,
    },
    sourceOfTruthKinds: structuredClone(policy.sourceOfTruthByKind),
    calibration: {
      errorBudget: structuredClone(calibrationCorpus.errorBudget),
      measuredErrors,
      withinBudget,
      cases: activeCases,
    },
    ev12: {
      calibrationPass: pinnedEligibility.ev12.calibrationPass,
      eligibleScopeWithinBudget: pinnedEligibility.ev12.eligibleScope.withinBudget,
      eligibleMeasuredErrors: structuredClone(pinnedEligibility.ev12.eligibleScope.measuredErrors),
      advisoryOnlyTruthIds: pinnedEligibility.ev12.advisoryOnly.map(entry => entry.truthId).sort((a, b) => a.localeCompare(b)),
      pinnedCorpusDigestVerified: true,
      pinnedFailureMemoryDigestVerified: true,
    },
    rollback: {
      environmentVariable: policy.rollback.environmentVariable,
      disabledValue: policy.rollback.disabledValue,
      behavior: policy.rollback.behavior,
      sourceFailureMemoryUnchanged: sourceMemoryUnchanged,
      ev4ModeRemainsAdvisory: failureMemory.mode === 'advisory',
      existingEnforcementChanged: false,
      disabledPromotionAuthorizations: rollbackPromotionAuthorizations,
      disabledMeasuredErrors: rollbackMeasuredErrors,
      evidenceStillMeasured: rollbackCases.length === activeCases.length,
    },
    governancePass: pass,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, canonicalJson(value), 'utf8');
}

function parseArguments(argv) {
  const options = {
    candidateSha: null,
    policy: 'agent/antibody-governance-policy.json',
    calibration: 'agent/antibody-governance-calibration-corpus.json',
    ev12Corpus: 'agent/failure-recurrence-calibration-corpus.json',
    memory: 'agent/failure-memory.json',
    output: null,
    disabled: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--policy') options.policy = argv[++index] ?? null;
    else if (argument === '--calibration') options.calibration = argv[++index] ?? null;
    else if (argument === '--ev12-corpus') options.ev12Corpus = argv[++index] ?? null;
    else if (argument === '--memory') options.memory = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--disabled') options.disabled = true;
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [policy, calibration, ev12Corpus, memory] = await Promise.all([
    readJson(options.policy),
    readJson(options.calibration),
    readJson(options.ev12Corpus),
    readJson(options.memory),
  ]);
  const environmentDisabled = process.env[policy.rollback.environmentVariable] === policy.rollback.disabledValue;
  const report = await runAntibodyGovernanceAssessment(policy, calibration, ev12Corpus, memory, {
    candidateSha: options.candidateSha,
    governanceOverride: options.disabled || environmentDisabled ? false : null,
  });
  if (options.output) await writeJson(options.output, report);
  if (options.json) process.stdout.write(canonicalJson(report));
  else console.log(`ANTIBODY_GOVERNANCE mode=${report.mode} candidate=${report.candidateSha} pass=${report.governancePass} transitionFp=${report.calibration.measuredErrors.transitionFalsePositives} transitionFn=${report.calibration.measuredErrors.transitionFalseNegatives} promotionFp=${report.calibration.measuredErrors.promotionFalsePositives} promotionFn=${report.calibration.measuredErrors.promotionFalseNegatives} decisions=${report.lifecycle.decisionRecordCount} enforcement=${report.enforcementEnabled}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
