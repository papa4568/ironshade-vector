import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  authorizeAntibodyGovernanceDecision,
  validateAntibodyCanonicalSourceEntry,
  validateAntibodyGovernancePolicy,
} from './antibody-governance.mjs';
import {
  canonicalJson,
  clusterFailureRecords,
  proposeAntibodies,
  sha256Value,
} from './repository-immune-system.mjs';
import { selectAuthoritativeReviewCommentWithProvenance } from './review-comment-gate.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const POLICY_PATH = 'agent/antibody-promotion-policy.json';
const GOVERNANCE_POLICY_PATH = 'agent/antibody-governance-policy.json';
const EV12_CORPUS_PATH = 'agent/failure-recurrence-calibration-corpus.json';
const FAILURE_MEMORY_PATH = 'agent/failure-memory.json';
const ACTIONS_LOGIN = 'github-actions[bot]';
const TRUSTED_MAIN_ASSOCIATION = 'TRUSTED_MAIN_ACTIONS';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function exactObject(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function validateAntibodyPromotionPolicy(policy) {
  assertObject(policy, 'antibody promotion policy');
  assert(policy.schemaVersion === 1, 'antibody promotion policy schemaVersion must be 1');
  assert(policy.mode === 'single-antibody-enforcement', 'EV-14 policy mode must be single-antibody-enforcement');
  assert(policy.enabled === true, 'EV-14 promotion must be enabled by default');
  assert(policy.promotionTask === 'EV-14', 'EV-14 promotion task must be EV-14');

  assertObject(policy.governance, 'promotion.governance');
  assert(policy.governance.policyPath === GOVERNANCE_POLICY_PATH, `EV-14 governance policy path must be ${GOVERNANCE_POLICY_PATH}`);
  for (const key of ['policySha256', 'ev12CorpusSha256', 'failureMemorySha256']) {
    assert(DIGEST_PATTERN.test(policy.governance[key] ?? ''), `promotion.governance.${key} must be a SHA-256 digest`);
  }
  assertString(policy.governance.decisionPath, 'promotion.governance.decisionPath');
  assert(policy.governance.decisionPath.startsWith('agent/antibody-decisions/') && policy.governance.decisionPath.endsWith('.json'), 'EV-14 decision must live under agent/antibody-decisions');

  assertObject(policy.antibody, 'promotion.antibody');
  assert(policy.antibody.truthId === 'candidate-artifact-integrity-drift', 'EV-14 may promote only the selected candidate-artifact truth id');
  assert(policy.antibody.antibodyId === 'antibody-candidate-artifact-integrity-drift', 'EV-14 antibody id is fixed');
  assert(policy.antibody.sourceFailureClass === policy.antibody.truthId, 'EV-14 source failure class must match the selected truth id');
  assert(DIGEST_PATTERN.test(policy.antibody.proposalSha256 ?? ''), 'EV-14 proposalSha256 must be a SHA-256 digest');
  assert(exactObject(policy.antibody.sourceOfTruth, {
    kind: 'focused-regression',
    path: 'agent/tests/candidate-artifact.mjs',
    entryId: 'candidate-artifact-integrity',
  }), 'EV-14 source of truth must remain the existing candidate-artifact regression');

  assertObject(policy.calibration, 'promotion.calibration');
  assert(Array.isArray(policy.calibration.benignControls) && policy.calibration.benignControls.length === 1 && policy.calibration.benignControls[0] === 'append-comment', 'EV-14 must retain its behavior-preserving negative control');
  assert(Array.isArray(policy.calibration.dishonestMutations) && exactObject(policy.calibration.dishonestMutations, [
    'remove-required-candidate-sha-match',
    'inject-forbidden-cross-sha-acceptance',
  ]), 'EV-14 dishonest mutation set is fixed');
  assertObject(policy.calibration.errorBudget, 'promotion.calibration.errorBudget');
  assert(policy.calibration.errorBudget.falsePositives === 0 && policy.calibration.errorBudget.falseNegatives === 0, 'EV-14 false-positive and false-negative budgets must both be zero');

  assertObject(policy.rollback, 'promotion.rollback');
  assert(policy.rollback.environmentVariable === 'IRONSHADE_ANTIBODY_ENFORCEMENT', 'EV-14 rollback variable must remain stable');
  assert(policy.rollback.disabledValue === '0', 'EV-14 rollback disabled value must be 0');
  assertString(policy.rollback.behavior, 'promotion.rollback.behavior');
  return policy;
}

function proposalForTruth(ev12Corpus, truthId) {
  const group = ev12Corpus.truthGroups.find(entry => entry.truthId === truthId);
  assert(group, `EV-14 truth id ${truthId} is absent from EV-12 calibration`);
  assert(group.governance === 'eligible-for-ev13-review', `EV-14 truth id ${truthId} is not EV-13 governance eligible`);
  const memory = clusterFailureRecords(group.records, {
    maxSamplesPerClass: ev12Corpus.calibrationMaxSamplesPerClass,
    maxSerializedBytes: ev12Corpus.calibrationMaxSerializedBytes,
  });
  const proposals = proposeAntibodies(memory);
  assert(proposals.length === 1, `EV-14 truth id ${truthId} must resolve to exactly one EV-4 antibody proposal`);
  return proposals[0];
}

function validateDecisionIntent(policy, proposal, decision) {
  assertObject(decision, 'EV-14 antibody decision');
  assert(decision.schemaVersion === 1, 'EV-14 decision schemaVersion must be 1');
  assert(decision.antibodyId === policy.antibody.antibodyId, 'EV-14 decision antibodyId does not match policy');
  assert(decision.truthId === policy.antibody.truthId, 'EV-14 decision truthId does not match policy');
  assert(decision.sourceFailureClass === policy.antibody.sourceFailureClass, 'EV-14 decision sourceFailureClass does not match policy');
  assert(decision.proposalDigest === policy.antibody.proposalSha256, 'EV-14 decision proposal digest does not match policy');
  assert(decision.proposalDigest === sha256Value(proposal), 'EV-14 decision proposal digest does not match the exact EV-4 proposal');
  assert(decision.revision === 1 && decision.action === 'accept' && decision.previousDecisionDigest === null, 'EV-14 must be the first append-only acceptance revision');
  assert(exactObject(decision.sourceOfTruth, policy.antibody.sourceOfTruth), 'EV-14 decision source of truth does not match policy');
  assertObject(decision.review, 'EV-14 decision.review');
  assert(decision.review.required === true && decision.review.taskId === 'EV-14', 'EV-14 decision must require EV-14 trusted review');
  assertString(decision.review.rationale, 'EV-14 decision.review.rationale');
  assert(decision.review.rationale.trim().length >= 20, 'EV-14 decision review rationale is too short');
  assertObject(decision.promotion, 'EV-14 decision.promotion');
  assert(decision.promotion.state === 'not-promoted' && decision.promotion.taskId === 'EV-14', 'EV-14 accepted decision must remain pending until exact-SHA trusted authorization completes');
}

async function classifySource(policy, governancePolicy, proposal, sourceText) {
  try {
    await validateAntibodyCanonicalSourceEntry(
      governancePolicy,
      proposal,
      policy.antibody.sourceOfTruth,
      { readText: async path => {
        assert(path === policy.antibody.sourceOfTruth.path, `unexpected canonical source read ${path}`);
        return sourceText;
      } },
    );
    return { accepted: true, error: null };
  } catch (error) {
    return { accepted: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function mutatedSource(sourceText, mutation) {
  if (mutation === 'remove-required-candidate-sha-match') {
    return sourceText.replaceAll('candidate-sha-match', 'candidate-sha-mismatch');
  }
  if (mutation === 'inject-forbidden-cross-sha-acceptance') {
    return `${sourceText}\nconst EV14_DISHONEST_MARKER = 'accept-cross-sha-artifact';\n`;
  }
  throw new Error(`unknown EV-14 mutation ${mutation}`);
}

export async function runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, failureMemory, decision, {
  candidateSha,
  enforcementOverride = null,
  readText = async path => readFile(resolve(path), 'utf8'),
} = {}) {
  validateAntibodyPromotionPolicy(policy);
  validateAntibodyGovernancePolicy(governancePolicy);
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  assert(sha256Value(governancePolicy) === policy.governance.policySha256, 'EV-13 governance policy digest drift requires reviewed EV-14 policy recalibration');
  assert(sha256Value(ev12Corpus) === policy.governance.ev12CorpusSha256, 'EV-12 calibration corpus digest drift requires reviewed EV-14 policy recalibration');
  assert(sha256Value(failureMemory) === policy.governance.failureMemorySha256, 'EV-4 failure-memory digest drift requires EV-12/EV-13 recalibration before EV-14 may continue');

  const proposal = proposalForTruth(ev12Corpus, policy.antibody.truthId);
  assert(proposal.id === policy.antibody.antibodyId, 'EV-14 policy antibody id does not match the exact EV-4 proposal');
  assert(proposal.sourceFailureClass === policy.antibody.sourceFailureClass, 'EV-14 policy source failure class does not match the exact EV-4 proposal');
  assert(sha256Value(proposal) === policy.antibody.proposalSha256, 'EV-14 proposal digest drift requires reviewed policy change');
  validateDecisionIntent(policy, proposal, decision);

  const sourceText = await readText(policy.antibody.sourceOfTruth.path);
  const baseline = await classifySource(policy, governancePolicy, proposal, sourceText);
  const benign = await classifySource(policy, governancePolicy, proposal, `${sourceText}\n// EV-14 behavior-preserving calibration control.\n`);
  const attacks = [];
  for (const mutation of policy.calibration.dishonestMutations) {
    const result = await classifySource(policy, governancePolicy, proposal, mutatedSource(sourceText, mutation));
    attacks.push({ mutation, detected: !result.accepted, error: result.error });
  }
  const falsePositives = benign.accepted ? 0 : 1;
  const falseNegatives = attacks.filter(entry => !entry.detected).length;
  const withinBudget = falsePositives <= policy.calibration.errorBudget.falsePositives
    && falseNegatives <= policy.calibration.errorBudget.falseNegatives;
  const environmentDisabled = process.env[policy.rollback.environmentVariable] === policy.rollback.disabledValue;
  const enforcementEnabled = enforcementOverride ?? (policy.enabled && !environmentDisabled);
  const wouldBlock = !baseline.accepted || !withinBudget;

  return {
    schema: 'ironshade-antibody-promotion:v1',
    mode: enforcementEnabled ? 'enforced' : 'advisory-rollback',
    candidateSha,
    policySha256: sha256Value(policy),
    governancePolicySha256: sha256Value(governancePolicy),
    ev12CorpusSha256: sha256Value(ev12Corpus),
    failureMemorySha256: sha256Value(failureMemory),
    selectedTruthId: policy.antibody.truthId,
    selectedAntibodyId: policy.antibody.antibodyId,
    selectedProposalSha256: sha256Value(proposal),
    decisionPath: policy.governance.decisionPath,
    decisionSha256: sha256Value(decision),
    decisionIntentValidated: true,
    trustedReviewAuthorizationRequired: true,
    trustedReviewAuthorized: false,
    sourceOfTruth: structuredClone(policy.antibody.sourceOfTruth),
    baseline: {
      accepted: baseline.accepted,
      error: baseline.error,
    },
    calibration: {
      benignControl: {
        id: policy.calibration.benignControls[0],
        accepted: benign.accepted,
        error: benign.error,
      },
      dishonestMutations: attacks,
      measuredErrors: { falsePositives, falseNegatives },
      errorBudget: structuredClone(policy.calibration.errorBudget),
      withinBudget,
    },
    enforcementEnabled,
    blocking: enforcementEnabled,
    wouldBlock,
    enforcementContractPass: baseline.accepted && withinBudget,
    candidatePassGranted: false,
    rollback: {
      environmentVariable: policy.rollback.environmentVariable,
      disabledValue: policy.rollback.disabledValue,
      behavior: policy.rollback.behavior,
      failureHistoryUnchanged: true,
      existingCandidateArtifactCheckStillRequired: true,
      unrelatedAcceptanceSemanticsChanged: false,
    },
  };
}

async function githubJson(repository, path, { fetchImpl = fetch } = {}) {
  assertString(repository, 'repository');
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/${path.replace(/^\//, '')}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await response.text();
  assert(response.ok, `GitHub EV-14 promotion request ${path} failed ${response.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function githubAllPages(repository, path, { fetchImpl = fetch } = {}) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const payload = await githubJson(repository, `${path}${separator}per_page=100&page=${page}`, { fetchImpl });
    assert(Array.isArray(payload), `GitHub paginated response for ${path} must be an array`);
    all.push(...payload);
    if (payload.length < 100) return all;
    assert(page < 1000, `GitHub pagination for ${path} exceeded safety limit`);
  }
}

export async function selectAntibodyPromotionMachineReview(reviewPacket, comments, {
  prAuthor,
  fetchImpl = fetch,
  verifyMachineRun,
} = {}) {
  assertObject(reviewPacket, 'reviewPacket');
  assert(Array.isArray(comments), 'EV-14 promotion comments must be an array');
  assertString(prAuthor, 'EV-14 promotion pull request author');
  const machineComments = comments.filter(comment => comment?.user?.login === ACTIONS_LOGIN);
  const selected = await selectAuthoritativeReviewCommentWithProvenance(reviewPacket, machineComments, {
    prAuthor,
    fetchImpl,
    ...(verifyMachineRun ? { verifyMachineRun } : {}),
  });
  assert(selected.reviewer === ACTIONS_LOGIN, 'EV-14 promotion review must be authored by github-actions[bot]');
  assert(selected.authorAssociation === TRUSTED_MAIN_ASSOCIATION, 'EV-14 promotion review must have trusted-main machine provenance');
  assert(Number.isInteger(selected.result?.sourceRunId) && selected.result.sourceRunId > 0, 'EV-14 promotion review must bind a positive trusted-main source run');
  assert(SHA_PATTERN.test(selected.result?.trustedWorkflowSha ?? ''), 'EV-14 promotion review must bind the trusted workflow SHA');
  return selected;
}

export async function authorizeAntibodyPromotion(policy, {
  candidateSha,
  repository,
  prNumber,
  reviewPacket,
  fetchImpl = fetch,
  verifyMachineRun,
  authorizeGovernanceDecision = authorizeAntibodyGovernanceDecision,
} = {}) {
  validateAntibodyPromotionPolicy(policy);
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  assertString(repository, 'repository');
  assert(Number.isInteger(prNumber) && prNumber > 0, 'prNumber must be a positive integer');
  assertObject(reviewPacket, 'reviewPacket');
  assert(typeof authorizeGovernanceDecision === 'function', 'authorizeGovernanceDecision must be a function');
  const result = await authorizeGovernanceDecision({
    candidateSha,
    repository,
    prNumber,
    decisionPath: policy.governance.decisionPath,
    reviewPacket,
  });
  assert(result.transitionValid === true, 'EV-14 governance transition must be valid');
  assert(result.promotionEligible === true, 'EV-14 trusted governance review did not authorize promotion');
  assert(result.truthId === policy.antibody.truthId, 'EV-14 governance authorization truthId mismatch');
  assert(result.antibodyId === policy.antibody.antibodyId, 'EV-14 governance authorization antibodyId mismatch');

  const [pr, comments] = await Promise.all([
    githubJson(repository, `pulls/${prNumber}`, { fetchImpl }),
    githubAllPages(repository, `issues/${prNumber}/comments`, { fetchImpl }),
  ]);
  assert(pr?.state === 'open' && pr?.head?.sha === candidateSha, 'EV-14 promotion PR must be open and its head must match the exact candidate');
  assertString(pr?.user?.login, 'EV-14 promotion pull request author');
  const machineReview = await selectAntibodyPromotionMachineReview(reviewPacket, comments, {
    prAuthor: pr.user.login,
    fetchImpl,
    verifyMachineRun,
  });
  const machineComment = comments.find(comment => comment?.id === machineReview.commentId);
  assert(machineComment, `EV-14 trusted-main review comment ${machineReview.commentId} is missing from the complete PR conversation`);
  const reviewedAt = machineComment.updated_at ?? machineComment.created_at;
  assertString(reviewedAt, 'EV-14 trusted-main review timestamp');

  const reviewAuthorization = {
    reviewer: machineReview.reviewer,
    reviewedAt,
    taskId: reviewPacket.taskId,
    candidateSha,
    commentId: machineReview.commentId,
    reviewResultSha256: sha256Value(machineReview.result),
    authorAssociation: machineReview.authorAssociation,
    sourceRunId: machineReview.result.sourceRunId,
    trustedWorkflowSha: machineReview.result.trustedWorkflowSha,
    decisionDigest: result.decisionDigest,
    decisionPath: result.decisionPath,
  };

  return {
    schema: 'ironshade-antibody-promotion-authorization:v1',
    candidateSha,
    policySha256: sha256Value(policy),
    truthId: result.truthId,
    antibodyId: result.antibodyId,
    decisionPath: result.decisionPath,
    decisionDigest: result.decisionDigest,
    promotionEligible: result.promotionEligible,
    reviewAuthorization,
    repositoryInputsLoadedFromCandidate: result.repositoryInputsLoadedFromCandidate,
    exactReviewPacketVerified: result.reviewPacketCandidateDerived && result.reviewPacketChangedFilesVerified,
    completeReviewHistoryVerified: result.completeReviewHistoryVerified,
    completeDecisionHistoryVerified: result.completeDecisionHistoryVerified,
    latestDecisionHeadVerified: result.latestDecisionHeadVerified,
    reviewIndependentFromPrAuthorVerified: result.reviewIndependentFromPrAuthorVerified,
    trustedMainPromotionReviewVerified: true,
    candidatePassGranted: false,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(resolve(path), canonicalJson(value), 'utf8');
}

function parseArguments(argv) {
  const command = argv[0];
  const options = {
    command,
    candidateSha: null,
    policy: POLICY_PATH,
    governancePolicy: GOVERNANCE_POLICY_PATH,
    ev12Corpus: EV12_CORPUS_PATH,
    memory: FAILURE_MEMORY_PATH,
    decision: null,
    repository: null,
    prNumber: null,
    reviewPacket: null,
    output: null,
    disabled: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--policy') options.policy = argv[++index] ?? null;
    else if (argument === '--governance-policy') options.governancePolicy = argv[++index] ?? null;
    else if (argument === '--ev12-corpus') options.ev12Corpus = argv[++index] ?? null;
    else if (argument === '--memory') options.memory = argv[++index] ?? null;
    else if (argument === '--decision') options.decision = argv[++index] ?? null;
    else if (argument === '--repository') options.repository = argv[++index] ?? null;
    else if (argument === '--pr-number') options.prNumber = Number.parseInt(argv[++index] ?? '', 10);
    else if (argument === '--review-packet') options.reviewPacket = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--disabled') options.disabled = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  assert(command === 'gate' || command === 'authorize', 'usage: antibody-promotion.mjs <gate|authorize> ...');
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const policy = await readJson(options.policy);
  if (options.command === 'gate') {
    const [governancePolicy, ev12Corpus, memory, decision] = await Promise.all([
      readJson(options.governancePolicy),
      readJson(options.ev12Corpus),
      readJson(options.memory),
      readJson(options.decision ?? policy.governance.decisionPath),
    ]);
    const report = await runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, memory, decision, {
      candidateSha: options.candidateSha,
      enforcementOverride: options.disabled ? false : null,
    });
    if (options.output) await writeJson(options.output, report);
    console.log(`ANTIBODY_PROMOTION_GATE mode=${report.mode} candidate=${report.candidateSha} truth=${report.selectedTruthId} pass=${report.enforcementContractPass} fp=${report.calibration.measuredErrors.falsePositives} fn=${report.calibration.measuredErrors.falseNegatives} wouldBlock=${report.wouldBlock}`);
    if (report.blocking && report.wouldBlock) process.exitCode = 1;
    return;
  }

  assert(options.reviewPacket, '--review-packet is required for authorize');
  const reviewPacket = await readJson(options.reviewPacket);
  const report = await authorizeAntibodyPromotion(policy, {
    candidateSha: options.candidateSha,
    repository: options.repository,
    prNumber: options.prNumber,
    reviewPacket,
  });
  if (options.output) await writeJson(options.output, report);
  console.log(`ANTIBODY_PROMOTION_AUTHORIZED candidate=${report.candidateSha} truth=${report.truthId} decision=${report.decisionDigest} reviewer=${report.reviewAuthorization.reviewer}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
