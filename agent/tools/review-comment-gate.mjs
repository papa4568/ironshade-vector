import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { validateIndependentReviewPacket, validateIndependentReviewResult } from './independent-review.mjs';

const MARKER = '<!-- ironshade-independent-review:v1 -->';
const AUTOMATED_MARKER = '<!-- ironshade-independent-review:github-models-actions:v1 -->';
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const AUTOMATED_REVIEWER_LOGIN = 'github-actions[bot]';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

export function extractReviewResult(body) {
  if (typeof body !== 'string' || !body.includes(MARKER)) return null;
  const match = body.match(/<!-- ironshade-independent-review:v1 -->\s*```json\s*([\s\S]*?)```/i);
  if (!match) throw new Error('independent review comment marker is present but JSON envelope is malformed');
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`independent review comment contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function timestamp(comment) {
  const value = Date.parse(comment.updated_at ?? comment.created_at ?? '');
  return Number.isFinite(value) ? value : 0;
}

function machineReviewer(comment, result) {
  if (comment.user?.login !== AUTOMATED_REVIEWER_LOGIN) return null;
  if (typeof comment.body !== 'string' || !comment.body.includes(AUTOMATED_MARKER)) return null;
  assert(result.reviewerKind === 'github-models-actions', 'automated independent review is missing reviewerKind provenance');
  assert(result.sourceWorkflow === 'Automated Independent Review', 'automated independent review sourceWorkflow is invalid');
  assertString(result.model, 'automated independent review model');
  assert(Number.isInteger(result.sourceRunId) && result.sourceRunId > 0, 'automated independent review sourceRunId must be a positive integer');
  assert(Number.isInteger(result.technicalRunId) && result.technicalRunId > 0, 'automated independent review technicalRunId must be a positive integer');
  return {
    reviewer: AUTOMATED_REVIEWER_LOGIN,
    authorAssociation: 'AUTOMATED_GITHUB_MODELS',
  };
}

function trustedReviewer(comment, result) {
  if (TRUSTED_ASSOCIATIONS.has(comment.author_association)) {
    return {
      reviewer: comment.user?.login ?? 'unknown',
      authorAssociation: comment.author_association,
    };
  }
  return machineReviewer(comment, result);
}

export function selectAuthoritativeReviewComment(packet, comments) {
  validateIndependentReviewPacket(packet);
  assert(Array.isArray(comments), 'GitHub PR comments payload must be an array');

  const candidates = [];
  for (const comment of comments) {
    if (!comment || typeof comment !== 'object') continue;
    if (typeof comment.body !== 'string' || !comment.body.includes(MARKER)) continue;

    let result;
    try {
      result = extractReviewResult(comment.body);
    } catch (error) {
      const potentiallyTrusted = TRUSTED_ASSOCIATIONS.has(comment.author_association)
        || comment.user?.login === AUTOMATED_REVIEWER_LOGIN;
      if (potentiallyTrusted) {
        throw new Error(`trusted independent review comment ${comment.id ?? 'unknown'} is malformed: ${error instanceof Error ? error.message : String(error)}`);
      }
      continue;
    }
    if (!result) continue;
    const trust = trustedReviewer(comment, result);
    if (!trust) continue;
    if (result.taskId !== packet.taskId || result.candidateSha !== packet.candidateSha) continue;
    candidates.push({ comment, result, trust });
  }

  assert(candidates.length > 0, `no trusted independent review result exists for task ${packet.taskId} candidate ${packet.candidateSha}`);
  candidates.sort((left, right) => timestamp(left.comment) - timestamp(right.comment) || Number(left.comment.id ?? 0) - Number(right.comment.id ?? 0));
  const selected = candidates.at(-1);
  const summary = validateIndependentReviewResult(packet, selected.result);
  assert(summary.verdict === 'pass', `latest independent review verdict for candidate ${packet.candidateSha} is ${summary.verdict}`);

  return {
    result: selected.result,
    reviewer: selected.trust.reviewer,
    commentId: selected.comment.id ?? null,
    authorAssociation: selected.trust.authorAssociation,
    findingCount: summary.findingCount,
  };
}

async function gate({ packet, comments, output }) {
  assertString(packet, '--packet');
  assertString(comments, '--comments');
  assertString(output, '--output');
  const reviewPacket = JSON.parse(await readFile(packet, 'utf8'));
  const prComments = JSON.parse(await readFile(comments, 'utf8'));
  const selected = selectAuthoritativeReviewComment(reviewPacket, prComments);
  await writeFile(output, `${JSON.stringify(selected.result, null, 2)}\n`, 'utf8');
  console.log(`INDEPENDENT_REVIEW_GATE_PASS task=${reviewPacket.taskId} candidate=${reviewPacket.candidateSha} reviewer=${selected.reviewer} association=${selected.authorAssociation} comment=${selected.commentId} findings=${selected.findingCount}`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith('--')) options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = args[++index];
    else throw new Error(`unknown argument ${arg}`);
  }
  if (command === 'gate') return gate(options);
  throw new Error('usage: review-comment-gate.mjs gate --packet <path> --comments <path> --output <path>');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
