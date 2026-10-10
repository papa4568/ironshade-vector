import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { validateIndependentReviewPacket, validateIndependentReviewResult } from './independent-review.mjs';

const MARKER = '<!-- ironshade-independent-review:v1 -->';
const TRUSTED_MAIN_MARKER = '<!-- ironshade-independent-review:trusted-main-actions:v1 -->';
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const ACTIONS_LOGIN = 'github-actions[bot]';
const TRUSTED_WORKFLOW = 'AO-6 Trusted Independent Review';
const TRUSTED_JOB = 'trusted-review';

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

function isTrustedHuman(comment) {
  return TRUSTED_ASSOCIATIONS.has(comment?.author_association);
}

function humanTrust(comment) {
  return {
    reviewer: comment.user?.login ?? 'unknown',
    authorAssociation: comment.author_association,
  };
}

function chooseLatestPass(packet, candidates) {
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

function parseTrustedHumanCandidates(packet, comments) {
  const candidates = [];
  for (const comment of comments) {
    if (!comment || typeof comment !== 'object' || typeof comment.body !== 'string' || !comment.body.includes(MARKER)) continue;
    if (!isTrustedHuman(comment)) continue;
    let result;
    try {
      result = extractReviewResult(comment.body);
    } catch (error) {
      throw new Error(`trusted independent review comment ${comment.id ?? 'unknown'} is malformed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!result || result.taskId !== packet.taskId || result.candidateSha !== packet.candidateSha) continue;
    candidates.push({ comment, result, trust: humanTrust(comment) });
  }
  return candidates;
}

// Preserve the synchronous human-review selector used by repository regressions and
// manual fallback. Automated reviews are intentionally excluded from this path.
export function selectAuthoritativeReviewComment(packet, comments) {
  validateIndependentReviewPacket(packet);
  assert(Array.isArray(comments), 'GitHub PR comments payload must be an array');
  return chooseLatestPass(packet, parseTrustedHumanCandidates(packet, comments));
}

async function github(path, { accept = 'application/vnd.github+json', text = false, fetchImpl = fetch } = {}) {
  const token = process.env.GITHUB_TOKEN?.trim();
  const response = await fetchImpl(`https://api.github.com/${path.replace(/^\//, '')}`, {
    headers: {
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await response.text();
  assert(response.ok, `GitHub provenance request ${path} failed ${response.status}: ${body}`);
  return text ? body : JSON.parse(body);
}

export async function verifyTrustedMainMachineRun(comment, result, { fetchImpl = fetch } = {}) {
  assert(comment.user?.login === ACTIONS_LOGIN, 'trusted-main automated review must be authored by github-actions[bot]');
  assert(typeof comment.body === 'string' && comment.body.includes(TRUSTED_MAIN_MARKER), 'trusted-main automated review marker is missing');
  assert(result.reviewerKind === 'trusted-main-copilot-actions', 'trusted-main review reviewerKind is invalid');
  assert(result.sourceWorkflow === TRUSTED_WORKFLOW, 'trusted-main review sourceWorkflow is invalid');
  assertString(result.model, 'trusted-main review model');
  assert(Number.isInteger(result.sourceRunId) && result.sourceRunId > 0, 'trusted-main review sourceRunId must be positive');
  assert(Number.isInteger(result.technicalRunId) && result.technicalRunId > 0, 'trusted-main review technicalRunId must be positive');
  assert(Number.isInteger(result.orchestrationRunId) && result.orchestrationRunId > 0, 'trusted-main review orchestrationRunId must be positive');
  assert(/^[a-f0-9]{40}$/.test(result.trustedWorkflowSha ?? ''), 'trusted-main review trustedWorkflowSha must be a full SHA');

  const repository = process.env.GITHUB_REPOSITORY?.trim();
  assertString(repository, 'GITHUB_REPOSITORY');
  const run = await github(`repos/${repository}/actions/runs/${result.sourceRunId}`, { fetchImpl });
  assert(run.name === TRUSTED_WORKFLOW, 'trusted-main source run workflow name mismatch');
  assert(run.event === 'workflow_dispatch', 'trusted-main source run must be workflow_dispatch');
  assert(run.head_branch === 'main', 'trusted-main source run must execute on main');
  assert(run.head_sha === result.trustedWorkflowSha, 'trusted-main source run SHA mismatch');
  const expectedConclusion = result.verdict === 'pass' ? 'success' : 'failure';
  assert(run.status === 'completed' && run.conclusion === expectedConclusion, 'trusted-main source run conclusion does not match verdict');

  const jobsPayload = await github(`repos/${repository}/actions/runs/${result.sourceRunId}/jobs?per_page=100`, { fetchImpl });
  const job = (jobsPayload.jobs ?? []).filter(entry => entry.name === TRUSTED_JOB).sort((a, b) => a.id - b.id).at(-1);
  assert(job?.status === 'completed' && job.conclusion === expectedConclusion, 'trusted-main review job conclusion does not match verdict');
  const logs = await github(`repos/${repository}/actions/jobs/${job.id}/logs`, { accept: 'text/plain', text: true, fetchImpl });
  const marker = `TRUSTED_INDEPENDENT_REVIEW_${result.verdict.toUpperCase()} candidate=${result.candidateSha} comment=${comment.id}`;
  assert(logs.includes(marker), 'trusted-main review job log does not bind this verdict to the candidate and comment');
  return {
    reviewer: ACTIONS_LOGIN,
    authorAssociation: 'TRUSTED_MAIN_ACTIONS',
  };
}

export async function selectAuthoritativeReviewCommentWithProvenance(packet, comments, options = {}) {
  validateIndependentReviewPacket(packet);
  assert(Array.isArray(comments), 'GitHub PR comments payload must be an array');
  const candidates = parseTrustedHumanCandidates(packet, comments);
  const verify = options.verifyMachineRun ?? verifyTrustedMainMachineRun;

  for (const comment of comments) {
    if (!comment || typeof comment !== 'object' || comment.user?.login !== ACTIONS_LOGIN) continue;
    if (typeof comment.body !== 'string' || !comment.body.includes(TRUSTED_MAIN_MARKER)) continue;
    let result;
    try {
      result = extractReviewResult(comment.body);
    } catch (error) {
      throw new Error(`trusted independent review comment ${comment.id ?? 'unknown'} is malformed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!result || result.taskId !== packet.taskId || result.candidateSha !== packet.candidateSha) continue;
    const trust = await verify(comment, result, options);
    candidates.push({ comment, result, trust });
  }

  return chooseLatestPass(packet, candidates);
}

async function gate({ packet, comments, output }) {
  assertString(packet, '--packet');
  assertString(comments, '--comments');
  assertString(output, '--output');
  const reviewPacket = JSON.parse(await readFile(packet, 'utf8'));
  const prComments = JSON.parse(await readFile(comments, 'utf8'));
  const selected = await selectAuthoritativeReviewCommentWithProvenance(reviewPacket, prComments);
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
