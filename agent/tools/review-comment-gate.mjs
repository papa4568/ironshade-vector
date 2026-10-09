import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { validateIndependentReviewPacket, validateIndependentReviewResult } from './independent-review.mjs';

const MARKER = '<!-- ironshade-independent-review:v1 -->';
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

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

export function selectAuthoritativeReviewComment(packet, comments) {
  validateIndependentReviewPacket(packet);
  assert(Array.isArray(comments), 'GitHub PR comments payload must be an array');

  const candidates = [];
  for (const comment of comments) {
    if (!comment || typeof comment !== 'object') continue;
    if (!TRUSTED_ASSOCIATIONS.has(comment.author_association)) continue;
    if (typeof comment.body !== 'string' || !comment.body.includes(MARKER)) continue;

    let result;
    try {
      result = extractReviewResult(comment.body);
    } catch (error) {
      throw new Error(`trusted independent review comment ${comment.id ?? 'unknown'} is malformed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!result) continue;
    if (result.taskId !== packet.taskId || result.candidateSha !== packet.candidateSha) continue;
    candidates.push({ comment, result });
  }

  assert(candidates.length > 0, `no trusted independent review result exists for task ${packet.taskId} candidate ${packet.candidateSha}`);
  candidates.sort((left, right) => timestamp(left.comment) - timestamp(right.comment) || Number(left.comment.id ?? 0) - Number(right.comment.id ?? 0));
  const selected = candidates.at(-1);
  const summary = validateIndependentReviewResult(packet, selected.result);
  assert(summary.verdict === 'pass', `latest independent review verdict for candidate ${packet.candidateSha} is ${summary.verdict}`);

  const reviewer = selected.comment.user?.login ?? 'unknown';
  return {
    result: selected.result,
    reviewer,
    commentId: selected.comment.id ?? null,
    authorAssociation: selected.comment.author_association,
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
