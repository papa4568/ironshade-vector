import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { validateIndependentReviewPacket, validateIndependentReviewResult } from './independent-review.mjs';
import { selectAuthoritativeReviewCommentWithProvenance } from './review-comment-gate.mjs';

const ACTIONS_LOGIN = 'github-actions[bot]';
const TRUSTED_MAIN_ASSOCIATION = 'TRUSTED_MAIN_ACTIONS';
const TRUSTED_HUMAN_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const AUTH_SCHEMA = 'ironshade-ev14-governance-mechanism-authorization:v1';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function normalizedLogin(value) {
  return value.trim().toLowerCase();
}

function isMachineSelection(selected) {
  return selected.reviewer === ACTIONS_LOGIN && selected.authorAssociation === TRUSTED_MAIN_ASSOCIATION;
}

function serializedResult(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export async function selectEv14GovernanceReview({
  packet,
  comments,
  prAuthor,
  promotionAuthorizationRequired = false,
  verifyMachineRun,
}) {
  validateIndependentReviewPacket(packet);
  assert(Array.isArray(comments), 'EV-14 governance review comments must be an array');
  assertString(prAuthor, 'EV-14 governance pull request author');

  const eligibleComments = promotionAuthorizationRequired
    ? comments.filter(comment => comment?.user?.login === ACTIONS_LOGIN)
    : comments;
  const selected = await selectAuthoritativeReviewCommentWithProvenance(packet, eligibleComments, {
    prAuthor,
    ...(verifyMachineRun ? { verifyMachineRun } : {}),
  });
  validateIndependentReviewResult(packet, selected.result);

  const machine = isMachineSelection(selected);
  if (promotionAuthorizationRequired && !machine) {
    throw new Error('EV14_GOVERNANCE_REVIEW_AUTH_FAIL antibody promotion authorization requires trusted-main machine provenance');
  }

  return {
    ...selected,
    reviewerKind: machine ? 'trusted-main-actions' : 'trusted-human',
  };
}

export function buildEv14MechanismAuthorization({ packet, selected, prAuthor }) {
  validateIndependentReviewPacket(packet);
  assert(selected?.result, 'EV-14 governance selection result is required');
  validateIndependentReviewResult(packet, selected.result);
  assert(selected.result.verdict === 'pass', 'EV-14 governance mechanism authorization requires a pass result');
  assertString(prAuthor, 'EV-14 governance pull request author');

  const machine = selected.reviewerKind === 'trusted-main-actions';
  if (machine) {
    assert(selected.reviewer === ACTIONS_LOGIN, 'EV-14 trusted-main reviewer login is invalid');
    assert(selected.authorAssociation === TRUSTED_MAIN_ASSOCIATION, 'EV-14 trusted-main reviewer association is invalid');
    assert(Number.isInteger(selected.result.sourceRunId) && selected.result.sourceRunId > 0, 'EV-14 trusted-main sourceRunId is invalid');
    assert(SHA40.test(selected.result.trustedWorkflowSha ?? ''), 'EV-14 trusted-main workflow SHA is invalid');
  } else {
    assert(selected.reviewerKind === 'trusted-human', 'EV-14 governance reviewer kind is invalid');
    assert(TRUSTED_HUMAN_ASSOCIATIONS.has(selected.authorAssociation), 'EV-14 governance human reviewer association is untrusted');
    assertString(selected.reviewer, 'EV-14 governance human reviewer');
    assert(normalizedLogin(selected.reviewer) !== normalizedLogin(prAuthor), 'EV-14 governance human reviewer must differ from PR author');
  }

  const resultText = serializedResult(selected.result);
  return {
    schema: AUTH_SCHEMA,
    candidateSha: packet.candidateSha,
    reviewTaskId: packet.taskId,
    reviewer: selected.reviewer,
    reviewerKind: selected.reviewerKind,
    authorAssociation: selected.authorAssociation,
    commentId: selected.commentId ?? null,
    sourceRunId: machine ? selected.result.sourceRunId : null,
    trustedWorkflowSha: machine ? selected.result.trustedWorkflowSha : null,
    reviewResultSha256: createHash('sha256').update(resultText).digest('hex'),
    promotionAuthorizationRequired: false,
    trustedReviewPass: true,
    trustedReviewProvenanceVerified: true,
    candidatePassGranted: false,
  };
}

export function validateEv14MechanismAuthorization({ packet, result, authorization, prAuthor }) {
  validateIndependentReviewPacket(packet);
  validateIndependentReviewResult(packet, result);
  assert(result.verdict === 'pass', 'EV-14 governance mechanism result must pass');
  assert(authorization?.schema === AUTH_SCHEMA, 'EV-14 governance mechanism authorization schema is invalid');
  assert(authorization.candidateSha === packet.candidateSha, 'EV-14 governance mechanism candidate SHA mismatch');
  assert(authorization.reviewTaskId === packet.taskId, 'EV-14 governance mechanism task mismatch');
  assert(authorization.promotionAuthorizationRequired === false, 'EV-14 governance mechanism authorization cannot authorize antibody promotion');
  assert(authorization.trustedReviewPass === true, 'EV-14 governance mechanism trusted review must pass');
  assert(authorization.trustedReviewProvenanceVerified === true, 'EV-14 governance mechanism provenance must be verified');
  assert(authorization.candidatePassGranted === false, 'EV-14 governance mechanism authorization cannot grant the candidate pass');
  assert(SHA64.test(authorization.reviewResultSha256 ?? ''), 'EV-14 governance mechanism review digest is invalid');
  assert(
    authorization.reviewResultSha256 === createHash('sha256').update(serializedResult(result)).digest('hex'),
    'EV-14 governance mechanism review digest mismatch',
  );
  assertString(prAuthor, 'EV-14 governance pull request author');

  if (authorization.reviewerKind === 'trusted-main-actions') {
    assert(authorization.reviewer === ACTIONS_LOGIN, 'EV-14 governance machine reviewer login is invalid');
    assert(authorization.authorAssociation === TRUSTED_MAIN_ASSOCIATION, 'EV-14 governance machine association is invalid');
    assert(Number.isInteger(authorization.sourceRunId) && authorization.sourceRunId > 0, 'EV-14 governance machine sourceRunId is invalid');
    assert(SHA40.test(authorization.trustedWorkflowSha ?? ''), 'EV-14 governance machine workflow SHA is invalid');
  } else {
    assert(authorization.reviewerKind === 'trusted-human', 'EV-14 governance mechanism reviewer kind is invalid');
    assert(TRUSTED_HUMAN_ASSOCIATIONS.has(authorization.authorAssociation), 'EV-14 governance mechanism human association is untrusted');
    assertString(authorization.reviewer, 'EV-14 governance mechanism human reviewer');
    assert(normalizedLogin(authorization.reviewer) !== normalizedLogin(prAuthor), 'EV-14 governance mechanism human reviewer must differ from PR author');
    assert(authorization.sourceRunId === null, 'EV-14 governance mechanism human review must not synthesize sourceRunId');
    assert(authorization.trustedWorkflowSha === null, 'EV-14 governance mechanism human review must not synthesize trustedWorkflowSha');
  }

  return {
    reviewer: authorization.reviewer,
    reviewerKind: authorization.reviewerKind,
    commentId: authorization.commentId,
  };
}

async function bind(options) {
  assertString(options.packet, '--packet');
  assertString(options.comments, '--comments');
  assertString(options.reviewOutput, '--review-output');
  assertString(options.prAuthor, '--pr-author');
  const promotionAuthorizationRequired = options.promotionAuthorizationRequired === 'true';
  const packet = JSON.parse(await readFile(options.packet, 'utf8'));
  const comments = JSON.parse(await readFile(options.comments, 'utf8'));
  const selected = await selectEv14GovernanceReview({
    packet,
    comments,
    prAuthor: options.prAuthor,
    promotionAuthorizationRequired,
  });
  const resultText = serializedResult(selected.result);
  await writeFile(options.reviewOutput, resultText, 'utf8');

  if (!promotionAuthorizationRequired) {
    assertString(options.authorizationOutput, '--authorization-output');
    const authorization = buildEv14MechanismAuthorization({ packet, selected, prAuthor: options.prAuthor });
    await writeFile(options.authorizationOutput, `${JSON.stringify(authorization, null, 2)}\n`, 'utf8');
  }

  console.log(
    `EV14_GOVERNANCE_REVIEW_BIND_PASS candidate=${packet.candidateSha} task=${packet.taskId} reviewer=${selected.reviewer} reviewerKind=${selected.reviewerKind} association=${selected.authorAssociation} promotionAuthorizationRequired=${promotionAuthorizationRequired}`,
  );
}

async function validateAuthorization(options) {
  assertString(options.packet, '--packet');
  assertString(options.result, '--result');
  assertString(options.authorization, '--authorization');
  assertString(options.prAuthor, '--pr-author');
  const packet = JSON.parse(await readFile(options.packet, 'utf8'));
  const result = JSON.parse(await readFile(options.result, 'utf8'));
  const authorization = JSON.parse(await readFile(options.authorization, 'utf8'));
  const summary = validateEv14MechanismAuthorization({ packet, result, authorization, prAuthor: options.prAuthor });
  console.log(
    `EV14_GOVERNANCE_MECHANISM_AUTH_PASS candidate=${packet.candidateSha} task=${packet.taskId} reviewer=${summary.reviewer} reviewerKind=${summary.reviewerKind} comment=${summary.commentId ?? 'unknown'} provenance=verified`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) throw new Error(`unknown argument ${arg}`);
    options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = args[++index];
  }
  if (command === 'bind') return bind(options);
  if (command === 'validate-authorization') return validateAuthorization(options);
  throw new Error('usage: ev14-governance-review-auth.mjs bind --packet <path> --comments <path> --review-output <path> --authorization-output <path> --pr-author <login> --promotion-authorization-required <true|false> | validate-authorization --packet <path> --result <path> --authorization <path> --pr-author <login>');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
