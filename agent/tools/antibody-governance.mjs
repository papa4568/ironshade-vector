import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { buildCandidateManifest } from './candidate-evidence.mjs';
import { selectExperimentalReviewTask } from './experimental-review-task.mjs';
import { buildIndependentReviewPacket } from './independent-review.mjs';
import {
  canonicalJson,
  clusterFailureRecords,
  proposeAntibodies,
  sha256Value,
} from './repository-immune-system.mjs';
import { runFailureRecurrenceCalibration } from './failure-recurrence-calibration.mjs';
import { selectAuthoritativeReviewCommentWithProvenance } from './review-comment-gate.mjs';
import { selectAffectedVerification } from './select-affected-verification.mjs';

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
const POLICY_PATH = 'agent/antibody-governance-policy.json';
const EV12_CORPUS_PATH = 'agent/failure-recurrence-calibration-corpus.json';
const FAILURE_MEMORY_PATH = 'agent/failure-memory.json';
const EXPERIMENTAL_ROADMAP_PATH = 'docs/experimental-verification-roadmap.md';
const IMPACT_MAP_PATH = 'agent/impact-map.json';
const ARCHITECTURE_INVARIANTS_PATH = 'agent/architecture-invariants.json';
const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);
const SHELL_EXTENSIONS = new Set(['.sh', '.bash']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertBoolean(value, label) {
  assert(typeof value === 'boolean', `${label} must be boolean`);
}

function assertIsoInstant(value, label) {
  assertString(value, label);
  assert(!Number.isNaN(Date.parse(value)) && /T/.test(value), `${label} must be an ISO date-time`);
}

function assertMetricObject(value, keys, label) {
  assertObject(value, label);
  for (const key of keys) {
    assert(Number.isInteger(value[key]) && value[key] >= 0, `${label}.${key} must be a non-negative integer`);
  }
}

function normalizePath(path, label = 'sourceOfTruth.path') {
  assertString(path, label);
  assert(!path.startsWith('/') && !path.includes('..') && !path.includes('\\'), `${label} must be a repository-relative normalized path`);
  return path;
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function exactArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizedLogin(value, label) {
  assertString(value, label);
  return value.trim().toLowerCase();
}

function validateCheckContract(check, label = 'antibody proposal check') {
  assertObject(check, label);
  const targetPath = normalizePath(check.targetPath, `${label}.targetPath`);
  assert(Array.isArray(check.requiredSubstrings), `${label}.requiredSubstrings must be an array`);
  assert(Array.isArray(check.forbiddenSubstrings), `${label}.forbiddenSubstrings must be an array`);
  for (const [index, value] of check.requiredSubstrings.entries()) assertString(value, `${label}.requiredSubstrings[${index}]`);
  for (const [index, value] of check.forbiddenSubstrings.entries()) assertString(value, `${label}.forbiddenSubstrings[${index}]`);
  assert(check.requiredSubstrings.length + check.forbiddenSubstrings.length > 0, `${label} must contain at least one required or forbidden substring`);
  return { targetPath, requiredSubstrings: [...check.requiredSubstrings], forbiddenSubstrings: [...check.forbiddenSubstrings] };
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
  assert(policy.review.provenance.decisionBinding === 'exact-candidate-committed-decision', 'trusted review must bind the exact committed decision from the reviewed candidate SHA');
  assert(policy.review.provenance.packetBinding === 'exact-candidate-derived-review-packet', 'trusted review must bind the exact candidate-derived independent-review packet');
  assert(policy.review.provenance.commentPagination === 'complete', 'trusted review authorization must inspect the complete PR comment history');
  assert(policy.review.provenance.requireRequesterIndependentOfPrAuthor === true, 'antibody authorization must require the trusted review requester or reviewer to differ from the PR author');

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
    assert(mapping.binding === 'executable-proposal-target-contract', `${kind} must bind the exact EV-4 proposed target and check contract`);
    assert(Array.isArray(mapping.allowedPrefixes) && mapping.allowedPrefixes.length > 0, `${kind}.allowedPrefixes must be non-empty`);
    assert(Array.isArray(mapping.forbiddenPrefixes) && mapping.forbiddenPrefixes.length > 0, `${kind}.forbiddenPrefixes must be non-empty`);
  }

  assertObject(policy.decisions, 'policy.decisions');
  assert(policy.decisions.directory === 'agent/antibody-decisions', 'decision history must live under agent/antibody-decisions');
  assert(policy.decisions.schema === '../antibody-governance.schema.json', 'decision records must use the EV-13 schema');
  assert(policy.decisions.initialPromotionTask === 'EV-14', 'the first governance promotion candidate must remain EV-14');
  assert(policy.decisions.allowCommittedDecisionsInEv13 === false, 'EV-13 must not commit an accepted antibody decision');
  assert(policy.decisions.authorizationInput === 'exact-candidate-github-content', 'authorization must load governance inputs from the exact candidate commit');
  assert(policy.decisions.historyBinding === 'latest-committed-decision-head', 'update/retire authorization must bind the latest committed lifecycle head');
  assert(policy.decisions.appendOnly === true, 'antibody decision history must be append-only');

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
    if (entry.reviewAuthorAssociation !== undefined) assert(TRUSTED_ASSOCIATIONS.has(entry.reviewAuthorAssociation), `${label}.reviewAuthorAssociation must be a trusted association`);
    if (entry.reviewRequester !== undefined) assertString(entry.reviewRequester, `${label}.reviewRequester`);
    if (entry.prAuthor !== undefined) assertString(entry.prAuthor, `${label}.prAuthor`);
    if (entry.canonicalSourceFixture !== undefined) assertString(entry.canonicalSourceFixture, `${label}.canonicalSourceFixture`);
    assertObject(entry.sourceOfTruth, `${label}.sourceOfTruth`);
    assertBoolean(entry.expectedTransitionValid, `${label}.expectedTransitionValid`);
    assertBoolean(entry.expectedPromotionEligible, `${label}.expectedPromotionEligible`);
    if (entry.tamperPreviousDecisionDigest !== undefined) assertBoolean(entry.tamperPreviousDecisionDigest, `${label}.tamperPreviousDecisionDigest`);
  }
  return calibrationCorpus;
}

function validateReviewIntent(policy, decisionReview, verifiedReview, decision, decisionPath = null, prAuthor = null) {
  assertObject(decisionReview, 'antibody decision.review');
  assert(decisionReview.required === true, 'antibody decision.review.required must be true');
  assert(/^EV-\d+$/.test(decisionReview.taskId ?? ''), 'antibody decision.review.taskId must be an EV task');
  assertString(decisionReview.rationale, 'antibody decision.review.rationale');
  assert(decisionReview.rationale.trim().length >= policy.review.minimumRationaleCharacters, `antibody review rationale must contain at least ${policy.review.minimumRationaleCharacters} characters`);
  assert(verifiedReview?.[REVIEW_CAPABILITY] === true, 'trusted review provenance is required; review intent alone cannot authorize an antibody');
  assert(decisionReview.taskId === verifiedReview.taskId, 'antibody review task does not match trusted review provenance');
  assert(decisionDigest(decision) === verifiedReview.decisionDigest, 'trusted review is not bound to the exact antibody decision digest');
  if (decisionPath !== null) assert(decisionPath === verifiedReview.decisionPath, 'trusted review is not bound to the exact antibody decision path');
  if (policy.review.provenance.requireRequesterIndependentOfPrAuthor) {
    const authorLogin = normalizedLogin(prAuthor, 'pull request author');
    const authorityLogin = verifiedReview.authorAssociation === 'TRUSTED_MAIN_ACTIONS'
      ? normalizedLogin(verifiedReview.reviewRequester, 'trusted-main review requester')
      : normalizedLogin(verifiedReview.reviewer, 'trusted review reviewer');
    assert(authorityLogin !== authorLogin, 'antibody trusted review requester or reviewer must differ from the pull request author');
  }
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
    const contract = validateCheckContract(proposal.suggestedCheck.check);
    assert(path === contract.targetPath, `canonical source-of-truth entry ${sourceOfTruth.entryId} does not exist at ${path}; EV-4 canonical target is ${contract.targetPath}`);
  }
  return { ...sourceOfTruth, path };
}

function canonicalJsonEntry(kind, parsed, entryId) {
  if (!['architecture-invariant', 'impact-map-rule'].includes(kind) || !Array.isArray(parsed?.rules)) return null;
  return parsed.rules.find(entry => entry?.id === entryId) ?? null;
}

function validateFixedFileEntryContract(proposal, normalized, entry) {
  const contract = validateCheckContract(proposal.suggestedCheck.check);
  if (normalized.kind === 'architecture-invariant') {
    assert(entry?.type === 'sourceContract', `canonical architecture invariant ${normalized.entryId} must be a sourceContract to implement the EV-4 substring contract`);
    assert(entry.file === contract.targetPath, `canonical architecture invariant ${normalized.entryId} targets ${entry.file ?? 'unknown'} instead of EV-4 target ${contract.targetPath}`);
    assert(Array.isArray(entry.required) && Array.isArray(entry.forbidden), `canonical architecture invariant ${normalized.entryId} must declare required and forbidden source contract arrays`);
    for (const required of contract.requiredSubstrings) {
      assert(entry.required.includes(required), `canonical architecture invariant ${normalized.entryId} is missing required EV-4 contract content: ${required}`);
    }
    for (const forbidden of contract.forbiddenSubstrings) {
      assert(entry.forbidden.includes(forbidden), `canonical architecture invariant ${normalized.entryId} is missing forbidden EV-4 contract content: ${forbidden}`);
    }
  } else {
    assert(contract.targetPath === normalized.path, `canonical impact-map rule ${normalized.entryId} must bind EV-4 target ${normalized.path}, found ${contract.targetPath}`);
    const entryText = canonicalJson(entry);
    for (const required of contract.requiredSubstrings) {
      assert(entryText.includes(required), `canonical impact-map rule ${normalized.entryId} is missing required EV-4 contract content: ${required}`);
    }
    for (const forbidden of contract.forbiddenSubstrings) {
      assert(!entryText.includes(forbidden), `canonical impact-map rule ${normalized.entryId} contains forbidden EV-4 contract content: ${forbidden}`);
    }
  }
  return {
    ...normalized,
    binding: 'named-json-entry-contract',
    contractDigest: sha256Value(proposal.suggestedCheck.check),
    canonicalEntryDigest: sha256Value(entry),
  };
}

function scriptKindForSource(path) {
  const extension = extname(path).toLowerCase();
  if (extension === '.tsx') return ts.ScriptKind.TSX;
  if (extension === '.jsx') return ts.ScriptKind.JSX;
  if (['.js', '.mjs', '.cjs'].includes(extension)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function callExpressionName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const parent = callExpressionName(expression.expression);
    return parent ? `${parent}.${expression.name.text}` : expression.name.text;
  }
  return '';
}

function expressionHasBehaviorSubject(node, sourceFile) {
  if (!node) return false;
  if (ts.isParenthesizedExpression(node)) return expressionHasBehaviorSubject(node.expression, sourceFile);
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) || node.kind === ts.SyntaxKind.NullKeyword) return false;
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node) || ts.isAwaitExpression(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return true;
  let found = false;
  ts.forEachChild(node, child => {
    if (!found && expressionHasBehaviorSubject(child, sourceFile)) found = true;
  });
  return found;
}

function assertionHasBehaviorSubject(node, sourceFile) {
  const name = callExpressionName(node.expression);
  if (!(name === 'assert' || name.startsWith('assert.'))) return false;
  const args = [...node.arguments];
  if (args.length === 0) return false;
  if (name === 'assert' || name === 'assert.ok') return expressionHasBehaviorSubject(args[0], sourceFile);
  if (['assert.equal', 'assert.strictEqual', 'assert.deepEqual', 'assert.deepStrictEqual', 'assert.notEqual', 'assert.notStrictEqual', 'assert.notDeepEqual', 'assert.notDeepStrictEqual'].includes(name)) {
    if (args.length < 2) return false;
    if (args[0].getText(sourceFile) === args[1].getText(sourceFile)) return false;
    return expressionHasBehaviorSubject(args[0], sourceFile) || expressionHasBehaviorSubject(args[1], sourceFile);
  }
  return expressionHasBehaviorSubject(args[0], sourceFile);
}

function javascriptExecutableEvidence(text, path) {
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindForSource(path));
  assert((sourceFile.parseDiagnostics ?? []).length === 0, `canonical executable source could not be parsed: ${path}`);
  const testLike = /(^|\/)(?:tests?|__tests__)\//.test(path) || /\.(?:test|spec)\.[^.]+$/.test(path);
  const evidence = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = callExpressionName(node.expression);
      const loggingOnly = name.startsWith('console.') || name === 'process.stdout.write' || name === 'process.stderr.write';
      const assertion = name === 'assert' || name.startsWith('assert.');
      if (!loggingOnly && (!testLike || (assertion && assertionHasBehaviorSubject(node, sourceFile)))) evidence.push(node.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { evidence, namedEntryRequired: testLike };
}

function shellExecutableEvidence(text) {
  const evidence = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line === '{' || line === '}') continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(line)) continue;
    if (/^(?:echo|printf)\b/.test(line)) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*\(\)\s*\{/.test(line)) continue;
    evidence.push(line);
  }
  return { evidence, namedEntryRequired: false };
}

function validateExecutableCheckContract(proposal, normalized, text) {
  const contract = validateCheckContract(proposal.suggestedCheck.check);
  const extension = extname(normalized.path).toLowerCase();
  let executable;
  if (JAVASCRIPT_EXTENSIONS.has(extension)) executable = javascriptExecutableEvidence(text, normalized.path);
  else if (SHELL_EXTENSIONS.has(extension)) executable = shellExecutableEvidence(text);
  else throw new Error(`canonical executable check source type is unsupported for ${normalized.path}`);

  assert(executable.evidence.length > 0, `canonical source-of-truth file has no behavior-bearing executable check evidence: ${normalized.path}`);
  if (executable.namedEntryRequired) {
    assert(
      executable.evidence.some(snippet => snippet.includes(normalized.entryId)),
      `canonical executable check entry ${normalized.entryId} is not bound to a behavior-bearing assertion in ${normalized.path}`,
    );
  }
  for (const required of contract.requiredSubstrings) {
    assert(
      executable.evidence.some(snippet => snippet.includes(required)),
      `canonical executable check ${normalized.entryId} is missing required EV-4 contract behavior in ${normalized.path}: ${required}`,
    );
  }
  for (const forbidden of contract.forbiddenSubstrings) {
    assert(!text.includes(forbidden), `canonical source-of-truth contract contains forbidden content in ${normalized.path}: ${forbidden}`);
  }
  return {
    ...normalized,
    binding: 'executable-proposal-target-contract',
    contractDigest: sha256Value(proposal.suggestedCheck.check),
    executableEvidenceDigest: sha256Value(executable.evidence),
  };
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
    const entry = canonicalJsonEntry(normalized.kind, parsed, normalized.entryId);
    assert(entry, `canonical source-of-truth entry ${normalized.entryId} does not exist in ${normalized.path}`);
    return validateFixedFileEntryContract(proposal, normalized, entry);
  }

  const contract = validateCheckContract(proposal.suggestedCheck.check);
  assert(normalized.path === contract.targetPath, `canonical source-of-truth path must match the EV-4 proposed target ${contract.targetPath}`);
  return validateExecutableCheckContract(proposal, normalized, text);
}

export async function validateAntibodyCanonicalSourceEntry(policy, proposal, sourceOfTruth, options = {}) {
  return validateCanonicalSourceEntry(policy, proposal, sourceOfTruth, options);
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

function trustedReviewCapability({ reviewer, reviewRequester, reviewedAt, taskId, candidateSha, commentId, reviewResultSha256, authorAssociation, sourceRunId, decisionDigest: boundDecisionDigest, decisionPath }) {
  assertString(reviewer, 'trusted review reviewer');
  assertString(reviewRequester, 'trusted review requester');
  assertIsoInstant(reviewedAt, 'trusted review reviewedAt');
  assert(/^EV-\d+$/.test(taskId ?? ''), 'trusted review taskId must be an EV task');
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'trusted review candidateSha must be a full lowercase commit SHA');
  assert(Number.isInteger(commentId) && commentId > 0, 'trusted review commentId must be positive');
  assert(DIGEST_PATTERN.test(reviewResultSha256 ?? ''), 'trusted review result digest must be SHA-256');
  assert(TRUSTED_ASSOCIATIONS.has(authorAssociation), 'trusted review authorAssociation is invalid');
  assert(sourceRunId === null || (Number.isInteger(sourceRunId) && sourceRunId > 0), 'trusted review sourceRunId must be null or positive');
  assert(DIGEST_PATTERN.test(boundDecisionDigest ?? ''), 'trusted review decisionDigest must be SHA-256');
  const normalizedDecisionPath = decisionPath === null ? null : normalizePath(decisionPath, 'trusted review decisionPath');
  return Object.freeze({
    [REVIEW_CAPABILITY]: true,
    reviewer,
    reviewRequester,
    reviewedAt,
    taskId,
    candidateSha,
    commentId,
    reviewResultSha256,
    authorAssociation,
    sourceRunId,
    decisionDigest: boundDecisionDigest,
    decisionPath: normalizedDecisionPath,
  });
}

function reviewIntentForCase(entry) {
  if (!entry.reviewed) return undefined;
  return {
    required: true,
    taskId: 'EV-13',
    rationale: `EV-13 deterministic governance calibration for ${entry.id}.`,
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
  decisionPath = null,
  prAuthor = null,
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
  validateReviewIntent(policy, decision.review, verifiedReview, decision, decisionPath, prAuthor);
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
    reviewBoundToDecisionDigest: true,
    reviewIndependentFromPrAuthor: true,
    pinnedEligibilityVerified: true,
    canonicalSourceEntryVerified: true,
    canonicalSourceContractVerified: true,
    wouldBePromotionEligible,
    promotionEligible: governanceEnabled && wouldBePromotionEligible,
    enforcementEnabled: false,
    candidatePassGranted: false,
  };
}

function calibrationReviewCapability(entry, candidateSha, decision) {
  if (!entry.reviewed || entry.trustedReview === false) return null;
  const commentId = 9000000000 + [...entry.id].reduce((sum, char) => sum + char.codePointAt(0), 0);
  const authorAssociation = entry.reviewAuthorAssociation ?? 'COLLABORATOR';
  const reviewRequester = entry.reviewRequester ?? 'ev13-calibration-reviewer';
  return trustedReviewCapability({
    reviewer: authorAssociation === 'TRUSTED_MAIN_ACTIONS' ? 'github-actions[bot]' : 'ev13-calibration-reviewer',
    reviewRequester,
    reviewedAt: '2026-10-13T22:45:00Z',
    taskId: decision.review.taskId,
    candidateSha,
    commentId,
    reviewResultSha256: sha256Value({ calibrationCase: entry.id, decisionDigest: decisionDigest(decision), verdict: 'pass' }),
    authorAssociation,
    sourceRunId: authorAssociation === 'TRUSTED_MAIN_ACTIONS' ? 9000000001 : null,
    decisionDigest: decisionDigest(decision),
    decisionPath: null,
  });
}

function sourceForPrevious(entry) {
  return structuredClone(entry.sourceOfTruth);
}

function buildPreviousDecision(entry, proposal, policy) {
  if (entry.action === 'accept') return null;
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
      required: true,
      taskId: 'EV-13',
      rationale: `EV-13 deterministic prior acceptance for ${entry.id}.`,
    },
    promotion: { state: 'not-promoted', taskId: policy.decisions.initialPromotionTask },
  };
}

function decisionForCase(entry, proposal, policy, previousDecision = null) {
  const action = entry.action;
  const revision = previousDecision ? previousDecision.revision + 1 : 1;
  const previousDecisionDigest = previousDecision
    ? (entry.tamperPreviousDecisionDigest ? '0'.repeat(64) : decisionDigest(previousDecision))
    : null;
  return {
    schemaVersion: 1,
    antibodyId: proposal.id,
    truthId: entry.truthId,
    sourceFailureClass: proposal.sourceFailureClass,
    proposalDigest: sha256Value(proposal),
    revision,
    action,
    previousDecisionDigest,
    sourceOfTruth: structuredClone(entry.sourceOfTruth),
    ...(entry.reviewed ? { review: reviewIntentForCase(entry) } : {}),
    promotion: action === 'retire'
      ? { state: 'retired', taskId: null }
      : { state: 'not-promoted', taskId: policy.decisions.initialPromotionTask },
  };
}

async function classifyCalibrationCase({ policy, ev12Corpus, failureMemory, entry, candidateSha, governanceEnabled, pinnedEligibility, readText }) {
  let result = null;
  let error = null;
  try {
    const proposal = proposalForTruth(ev12Corpus, entry.truthId);
    const previousDecision = buildPreviousDecision(entry, proposal, policy);
    const decision = decisionForCase(entry, proposal, policy, previousDecision);
    const capability = calibrationReviewCapability(entry, candidateSha, decision);
    const caseReadText = entry.canonicalSourceFixture === undefined
      ? readText
      : async path => {
        if (path === entry.sourceOfTruth.path) return entry.canonicalSourceFixture;
        if (readText) return readText(path);
        return readFile(resolve(path), 'utf8');
      };
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
      readText: caseReadText,
      prAuthor: entry.prAuthor ?? 'ev13-calibration-pr-author',
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
    reviewBoundToDecisionDigest: result?.reviewBoundToDecisionDigest === true,
    reviewIndependentFromPrAuthor: result?.reviewIndependentFromPrAuthor === true,
    pinnedEligibilityVerified: result?.pinnedEligibilityVerified === true,
    canonicalSourceEntryVerified: result?.canonicalSourceEntryVerified === true,
    canonicalSourceContractVerified: result?.canonicalSourceContractVerified === true,
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
  assert(response.ok, `GitHub governance request ${path} failed ${response.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

function decodeContentPayload(payload, label) {
  assertObject(payload, label);
  assert(payload.encoding === 'base64' && typeof payload.content === 'string', `${label} must be a base64 GitHub contents payload`);
  return Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

async function githubContentText(repository, path, candidateSha, { fetchImpl = fetch } = {}) {
  const normalized = normalizePath(path, 'GitHub content path');
  const payload = await githubJson(repository, `contents/${normalized}?ref=${encodeURIComponent(candidateSha)}`, { fetchImpl });
  return decodeContentPayload(payload, `GitHub content ${normalized}`);
}

async function githubContentJson(repository, path, candidateSha, options = {}) {
  const text = await githubContentText(repository, path, candidateSha, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`GitHub content ${path} at ${candidateSha} is not valid JSON`);
  }
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

function validateDecisionPath(policy, path, label = 'decisionPath') {
  const normalized = normalizePath(path, label);
  assert(normalized.startsWith(`${policy.decisions.directory}/`) && normalized.endsWith('.json'), `${label} must be a JSON record under ${policy.decisions.directory}/`);
  return normalized;
}

function validateHistoryRecord(record, label) {
  assertObject(record, label);
  assert(record.schemaVersion === 1, `${label}.schemaVersion must be 1`);
  assertString(record.antibodyId, `${label}.antibodyId`);
  assertString(record.truthId, `${label}.truthId`);
  assertString(record.sourceFailureClass, `${label}.sourceFailureClass`);
  assert(DIGEST_PATTERN.test(record.proposalDigest ?? ''), `${label}.proposalDigest must be a SHA-256 digest`);
  assert(Number.isInteger(record.revision) && record.revision >= 1, `${label}.revision must be a positive integer`);
  assert(ACTIONS.has(record.action), `${label}.action must be accept, update, or retire`);
  return record;
}

export function validateAntibodyDecisionHistory(policy, {
  decisionPath,
  decision,
  previousDecisionPath = null,
  records,
}) {
  validateAntibodyGovernancePolicy(policy);
  const normalizedDecisionPath = validateDecisionPath(policy, decisionPath);
  const normalizedPreviousPath = previousDecisionPath === null ? null : validateDecisionPath(policy, previousDecisionPath, 'previousDecisionPath');
  validateHistoryRecord(decision, 'current antibody decision');
  assert(Array.isArray(records) && records.length > 0, 'committed antibody decision history must contain the current decision');

  const normalizedRecords = records.map((entry, index) => {
    assertObject(entry, `decision history entry[${index}]`);
    const path = validateDecisionPath(policy, entry.path, `decision history entry[${index}].path`);
    return { path, decision: validateHistoryRecord(entry.decision, `decision history entry[${index}].decision`) };
  });
  const paths = normalizedRecords.map(entry => entry.path);
  assert(new Set(paths).size === paths.length, 'committed antibody decision history contains duplicate paths');
  const current = normalizedRecords.find(entry => entry.path === normalizedDecisionPath);
  assert(current, `committed antibody decision history does not contain current decision ${normalizedDecisionPath}`);
  assert(canonicalJson(current.decision) === canonicalJson(decision), 'committed antibody decision history current record does not match the exact reviewed decision');

  const priorRecords = normalizedRecords.filter(entry => entry.path !== normalizedDecisionPath);
  const related = priorRecords.filter(entry => entry.decision.antibodyId === decision.antibodyId || entry.decision.truthId === decision.truthId);
  for (const entry of related) {
    assert(entry.decision.antibodyId === decision.antibodyId && entry.decision.truthId === decision.truthId, `committed decision history has conflicting antibody/truth identity at ${entry.path}`);
    assert(entry.decision.sourceFailureClass === decision.sourceFailureClass, `committed decision history sourceFailureClass drift at ${entry.path}`);
    assert(entry.decision.proposalDigest === decision.proposalDigest, `committed decision history proposalDigest drift at ${entry.path}`);
  }
  related.sort((left, right) => left.decision.revision - right.decision.revision || left.path.localeCompare(right.path));

  for (const [index, entry] of related.entries()) {
    const expectedRevision = index + 1;
    assert(entry.decision.revision === expectedRevision, `committed decision history for ${decision.antibodyId} has missing or duplicate revision ${expectedRevision}`);
    if (index === 0) {
      assert(entry.decision.action === 'accept', `committed decision history for ${decision.antibodyId} must start with accept`);
      assert(entry.decision.previousDecisionDigest === null, `initial committed decision for ${decision.antibodyId} must have null previousDecisionDigest`);
      continue;
    }
    const previous = related[index - 1].decision;
    assert(previous.action !== 'retire', `committed decision history for ${decision.antibodyId} continues after retirement`);
    assert(entry.decision.action === 'update' || entry.decision.action === 'retire', `committed decision history revision ${entry.decision.revision} must update or retire the active head`);
    assert(entry.decision.previousDecisionDigest === decisionDigest(previous), `committed decision history revision ${entry.decision.revision} does not bind its immediate predecessor`);
  }

  if (decision.action === 'accept') {
    assert(normalizedPreviousPath === null, 'initial acceptance cannot supply previousDecisionPath');
    assert(related.length === 0, `initial acceptance for ${decision.antibodyId} conflicts with existing committed decision history`);
    return {
      previousDecision: null,
      previousDecisionPath: null,
      committedHistoryRecords: normalizedRecords.length,
      relatedHistoryRecords: 0,
      latestPriorRevision: 0,
    };
  }

  assert(normalizedPreviousPath !== null, 'update/retire authorization requires previousDecisionPath');
  assert(related.length > 0, `update/retire for ${decision.antibodyId} requires committed prior decision history`);
  const head = related[related.length - 1];
  assert(head.decision.action === 'accept' || head.decision.action === 'update', `latest committed decision for ${decision.antibodyId} is retired and cannot be extended`);
  assert(normalizedPreviousPath === head.path, `previousDecisionPath must reference latest committed decision head ${head.path}`);
  assert(decision.revision === head.decision.revision + 1, 'update/retire revision must increment the latest committed decision head by one');
  assert(decision.previousDecisionDigest === decisionDigest(head.decision), 'update/retire previousDecisionDigest must bind the latest committed decision head');
  return {
    previousDecision: head.decision,
    previousDecisionPath: head.path,
    committedHistoryRecords: normalizedRecords.length,
    relatedHistoryRecords: related.length,
    latestPriorRevision: head.decision.revision,
  };
}

async function githubDecisionRecords(repository, policy, candidateSha, { fetchImpl = fetch } = {}) {
  const payload = await githubJson(repository, `contents/${policy.decisions.directory}?ref=${encodeURIComponent(candidateSha)}`, { fetchImpl });
  assert(Array.isArray(payload), `GitHub decision history ${policy.decisions.directory} must be a directory listing`);
  const jsonEntries = payload.filter(entry => entry?.type === 'file' && typeof entry?.path === 'string' && entry.path.endsWith('.json'));
  assert(jsonEntries.length === payload.length, `decision history directory ${policy.decisions.directory} may contain only JSON decision records`);
  const records = await Promise.all(jsonEntries.map(async entry => ({
    path: validateDecisionPath(policy, entry.path, 'GitHub decision history path'),
    decision: await githubContentJson(repository, entry.path, candidateSha, { fetchImpl }),
  })));
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

function assertExactCandidateCheckout(candidateSha) {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  assert(head === candidateSha, `local checkout ${head} does not match exact candidate ${candidateSha}`);
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  assert(status.length === 0, 'exact candidate architecture evaluation requires a clean checkout');
}

async function buildExactCandidateReviewPacket({ repository, pr, candidateSha, taskId, changedFiles, fetchImpl }) {
  assert(SHA_PATTERN.test(pr?.base?.sha ?? ''), 'pull request base SHA must be a full lowercase commit SHA');
  assertString(pr?.head?.ref, 'pull request head branch');
  const [headRoadmap, baseRoadmap, impactMap, architectureConfig] = await Promise.all([
    githubContentText(repository, EXPERIMENTAL_ROADMAP_PATH, candidateSha, { fetchImpl }),
    githubContentText(repository, EXPERIMENTAL_ROADMAP_PATH, pr.base.sha, { fetchImpl }),
    githubContentJson(repository, IMPACT_MAP_PATH, candidateSha, { fetchImpl }),
    githubContentJson(repository, ARCHITECTURE_INVARIANTS_PATH, candidateSha, { fetchImpl }),
  ]);
  const selection = selectExperimentalReviewTask(headRoadmap, { baseMarkdown: baseRoadmap });
  assert(selection?.task?.id === taskId, `exact candidate-derived review task ${selection?.task?.id ?? 'none'} does not match antibody review task ${taskId}`);
  assert(Array.isArray(architectureConfig?.rules) && architectureConfig.rules.length > 0, 'exact candidate architecture invariant config must contain rules');
  const impactSelection = selectAffectedVerification(changedFiles, impactMap);
  const manifest = buildCandidateManifest({
    repository,
    task: selection.task,
    taskSource: EXPERIMENTAL_ROADMAP_PATH,
    baseSha: pr.base.sha,
    headSha: candidateSha,
    branch: pr.head.ref,
    changedFiles,
    impactSelection,
  });
  assertExactCandidateCheckout(candidateSha);
  const { evaluateArchitectureInvariants } = await import('./check-architecture-invariants.mjs');
  const architectureResults = await evaluateArchitectureInvariants(architectureConfig);
  return buildIndependentReviewPacket({ manifest, task: selection.task, architectureResults });
}

export async function authorizeAntibodyGovernanceDecision({
  candidateSha,
  repository,
  prNumber,
  decisionPath,
  previousDecisionPath = null,
  reviewPacket,
  governanceEnabled = true,
  fetchImpl = fetch,
}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  assertString(repository, 'repository');
  assert(Number.isInteger(prNumber) && prNumber > 0, 'prNumber must be a positive integer');
  assertObject(reviewPacket, 'reviewPacket');
  assert(reviewPacket.candidateSha === candidateSha, 'review packet candidate must match antibody decision candidate');
  assert(/^EV-\d+$/.test(reviewPacket.taskId ?? ''), 'review packet task must be an EV task');

  const [pr, policy] = await Promise.all([
    githubJson(repository, `pulls/${prNumber}`, { fetchImpl }),
    githubContentJson(repository, POLICY_PATH, candidateSha, { fetchImpl }),
  ]);
  validateAntibodyGovernancePolicy(policy);
  const environmentDisabled = process.env[policy.rollback.environmentVariable] === policy.rollback.disabledValue;
  const effectiveGovernanceEnabled = governanceEnabled && !environmentDisabled;
  assert(pr?.state === 'open' && pr?.head?.sha === candidateSha, 'trusted review PR must be open and its head must match the antibody decision candidate');
  assertString(pr?.user?.login, 'pull request author');

  const normalizedDecisionPath = validateDecisionPath(policy, decisionPath);
  const normalizedPreviousPath = previousDecisionPath === null ? null : validateDecisionPath(policy, previousDecisionPath, 'previousDecisionPath');
  const [ev12Corpus, failureMemory, decision, decisionRecords, comments, prFiles] = await Promise.all([
    githubContentJson(repository, EV12_CORPUS_PATH, candidateSha, { fetchImpl }),
    githubContentJson(repository, FAILURE_MEMORY_PATH, candidateSha, { fetchImpl }),
    githubContentJson(repository, normalizedDecisionPath, candidateSha, { fetchImpl }),
    githubDecisionRecords(repository, policy, candidateSha, { fetchImpl }),
    githubAllPages(repository, `issues/${prNumber}/comments`, { fetchImpl }),
    githubAllPages(repository, `pulls/${prNumber}/files`, { fetchImpl }),
  ]);

  assertObject(decision.review, 'antibody decision.review');
  assert(decision.review.taskId === reviewPacket.taskId, 'committed antibody review task must match the trusted review packet');
  const changedFiles = prFiles.map(file => file?.filename).filter(value => typeof value === 'string').sort((a, b) => a.localeCompare(b));
  assert(changedFiles.length === prFiles.length, 'PR changed-file payload contains an invalid filename');
  assert(exactArray(changedFiles, sorted(reviewPacket.changedFiles ?? [])), 'trusted review packet changedFiles do not match the complete GitHub PR diff');
  const changedDecisionFiles = prFiles.filter(file => typeof file?.filename === 'string' && file.filename.startsWith(`${policy.decisions.directory}/`) && file.filename.endsWith('.json'));
  assert(changedDecisionFiles.length === 1 && changedDecisionFiles[0].filename === normalizedDecisionPath, 'authorization requires exactly one changed antibody decision record, bound to decisionPath');
  assert(changedDecisionFiles[0].status === 'added', 'antibody decision history is append-only; authorization requires a newly added decision record');

  const exactReviewPacket = await buildExactCandidateReviewPacket({
    repository,
    pr,
    candidateSha,
    taskId: decision.review.taskId,
    changedFiles,
    fetchImpl,
  });
  assert(
    canonicalJson(reviewPacket) === canonicalJson(exactReviewPacket),
    'trusted review packet does not match the exact candidate-derived independent-review packet',
  );

  const history = validateAntibodyDecisionHistory(policy, {
    decisionPath: normalizedDecisionPath,
    decision,
    previousDecisionPath: normalizedPreviousPath,
    records: decisionRecords,
  });

  const selected = await selectAuthoritativeReviewCommentWithProvenance(exactReviewPacket, comments, {
    prAuthor: pr.user.login,
    fetchImpl,
  });
  const selectedComment = comments.find(comment => comment?.id === selected.commentId);
  assert(selectedComment, `trusted review comment ${selected.commentId} is missing from the complete fetched PR conversation`);
  const reviewedAt = selectedComment.updated_at ?? selectedComment.created_at;
  assertIsoInstant(reviewedAt, 'trusted review comment timestamp');
  let reviewRequester = selected.reviewer;
  if (selected.authorAssociation === 'TRUSTED_MAIN_ACTIONS') {
    assert(Number.isInteger(selected.result?.sourceRunId) && selected.result.sourceRunId > 0, 'trusted-main antibody review must name its source workflow run');
    const sourceRun = await githubJson(repository, `actions/runs/${selected.result.sourceRunId}`, { fetchImpl });
    reviewRequester = sourceRun?.triggering_actor?.login ?? sourceRun?.actor?.login;
    assertString(reviewRequester, 'trusted-main antibody review requester');
  }
  const capability = trustedReviewCapability({
    reviewer: selected.reviewer,
    reviewRequester,
    reviewedAt,
    taskId: exactReviewPacket.taskId,
    candidateSha,
    commentId: selected.commentId,
    reviewResultSha256: sha256Value(selected.result),
    authorAssociation: selected.authorAssociation,
    sourceRunId: Number.isInteger(selected.result?.sourceRunId) ? selected.result.sourceRunId : null,
    decisionDigest: decisionDigest(decision),
    decisionPath: normalizedDecisionPath,
  });

  const result = await evaluateDecision({
    policy,
    ev12Corpus,
    failureMemory,
    candidateSha,
    decision,
    previousDecision: history.previousDecision,
    governanceEnabled: effectiveGovernanceEnabled,
    verifiedReview: capability,
    decisionPath: normalizedDecisionPath,
    readText: path => githubContentText(repository, path, candidateSha, { fetchImpl }),
    prAuthor: pr.user.login,
  });

  return {
    ...result,
    repository,
    prNumber,
    decisionPath: normalizedDecisionPath,
    repositoryInputsLoadedFromCandidate: true,
    reviewPacketChangedFilesVerified: true,
    reviewPacketCandidateDerived: true,
    reviewPacketSha256: sha256Value(exactReviewPacket),
    completeReviewHistoryVerified: true,
    completeDecisionHistoryVerified: true,
    decisionHistoryAppendOnlyVerified: true,
    latestDecisionHeadVerified: true,
    decisionBoundToReviewedCandidate: true,
    reviewIndependentFromPrAuthorVerified: true,
    rollbackEnvironmentApplied: environmentDisabled,
    decisionHistory: {
      committedRecords: history.committedHistoryRecords,
      relatedRecords: history.relatedHistoryRecords,
      latestPriorRevision: history.latestPriorRevision,
      previousDecisionPath: history.previousDecisionPath,
    },
    reviewAuthorization: {
      reviewer: capability.reviewer,
      reviewRequester: capability.reviewRequester,
      reviewedAt: capability.reviewedAt,
      taskId: capability.taskId,
      candidateSha: capability.candidateSha,
      commentId: capability.commentId,
      reviewResultSha256: capability.reviewResultSha256,
      authorAssociation: capability.authorAssociation,
      sourceRunId: capability.sourceRunId,
      decisionDigest: capability.decisionDigest,
      decisionPath: capability.decisionPath,
    },
  };
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
      reviewBoundToDecisionDigest: true,
      exactReviewPacketRequired: true,
      exactCommittedDecisionRequired: true,
      repositoryPinnedInputsRequired: true,
      completeReviewHistoryRequired: true,
      reviewIndependentFromPrAuthorRequired: true,
      completeDecisionHistoryRequired: true,
      latestDecisionHeadRequired: true,
      appendOnlyDecisionHistoryRequired: true,
      canonicalSourceEntryRequired: true,
      canonicalSourceContractRequired: true,
      executableSourceContractRequired: true,
      behaviorBearingAssertionRequired: true,
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
    policy: POLICY_PATH,
    calibration: 'agent/antibody-governance-calibration-corpus.json',
    ev12Corpus: EV12_CORPUS_PATH,
    memory: FAILURE_MEMORY_PATH,
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
