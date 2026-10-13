import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { validateIndependentReviewPacket, validateIndependentReviewResult } from './independent-review.mjs';

const MARKER = '<!-- ironshade-independent-review:v1 -->';
const TRUSTED_MAIN_MARKER = '<!-- ironshade-independent-review:trusted-main-actions:v1 -->';
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const ACTIONS_LOGIN = 'github-actions[bot]';
const TRUSTED_WORKFLOW = 'AO-6 Trusted Independent Review';
const TRUSTED_WORKFLOW_PATH = '.github/workflows/ao6-trusted-independent-review.yml';
const TRUSTED_JOB = 'trusted-review';
const TRUSTED_REQUEST_MAX_AGE_MS = 2 * 60 * 1000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function normalizedLogin(value) {
  return value.trim().toLowerCase();
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

function rawCandidateSha(body) {
  if (typeof body !== 'string') return null;
  return body.match(/"candidateSha"\s*:\s*"([a-f0-9]{40})"/)?.[1] ?? null;
}

function conclusivelyTargetsDifferentCandidate(packet, body) {
  const candidateSha = rawCandidateSha(body);
  return candidateSha !== null && candidateSha !== packet.candidateSha;
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

function parseTrustedHumanCandidates(packet, comments, { prAuthor } = {}) {
  assertString(prAuthor, 'pull request author');
  const prAuthorLogin = normalizedLogin(prAuthor);
  const candidates = [];
  for (const comment of comments) {
    if (!comment || typeof comment !== 'object' || typeof comment.body !== 'string' || !comment.body.includes(MARKER)) continue;
    if (!isTrustedHuman(comment)) continue;
    const reviewerLogin = comment.user?.login;
    if (typeof reviewerLogin !== 'string' || reviewerLogin.trim().length === 0) continue;
    if (normalizedLogin(reviewerLogin) === prAuthorLogin) continue;
    if (conclusivelyTargetsDifferentCandidate(packet, comment.body)) continue;
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
export function selectAuthoritativeReviewComment(packet, comments, options = {}) {
  validateIndependentReviewPacket(packet);
  assert(Array.isArray(comments), 'GitHub PR comments payload must be an array');
  return chooseLatestPass(packet, parseTrustedHumanCandidates(packet, comments, options));
}

async function github(path, { fetchImpl = fetch } = {}) {
  const token = process.env.GITHUB_TOKEN?.trim();
  const response = await fetchImpl(`https://api.github.com/${path.replace(/^\//, '')}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await response.text();
  assert(response.ok, `GitHub provenance request ${path} failed ${response.status}: ${body}`);
  return JSON.parse(body);
}

function issueNumberFromComment(comment) {
  const issueUrl = comment?.issue_url;
  assertString(issueUrl, 'trusted-main automated review issue_url');
  const match = issueUrl.match(/\/issues\/(\d+)(?:$|[?#])/);
  assert(match, 'trusted-main automated review issue_url does not identify a PR number');
  const value = Number(match[1]);
  assert(Number.isInteger(value) && value > 0, 'trusted-main automated review PR number is invalid');
  return value;
}

function matchesIssueNumber(comment, prNumber) {
  if (typeof comment?.issue_url !== 'string') return false;
  return comment.issue_url.match(/\/issues\/(\d+)(?:$|[?#])/)?.[1] === String(prNumber);
}

function verifyIssueCommentRequestProvenance(comment, result, run, comments) {
  const prNumber = issueNumberFromComment(comment);
  const actor = run.actor?.login;
  const triggeringActor = run.triggering_actor?.login;
  assertString(actor, 'trusted-main issue_comment actor');
  assertString(triggeringActor, 'trusted-main issue_comment triggering actor');
  assert(
    normalizedLogin(triggeringActor) === normalizedLogin(actor) && normalizedLogin(actor) !== normalizedLogin(ACTIONS_LOGIN),
    'trusted-main issue_comment actor provenance is invalid',
  );
  assert(Array.isArray(comments), 'trusted-main issue_comment provenance comments must be an array');

  const runCreatedAt = Date.parse(run.created_at ?? '');
  assert(Number.isFinite(runCreatedAt), 'trusted-main issue_comment source run created_at is invalid');
  const fullCommand = `/ao6-trusted-review ${prNumber} ${result.candidateSha} ${result.taskId}`;
  const defaultTaskCommand = `/ao6-trusted-review ${prNumber} ${result.candidateSha}`;
  const expectedCommands = new Set([
    fullCommand,
    ...(result.taskId === 'AO-6' ? [defaultTaskCommand] : []),
  ]);

  const sourceComment = comments
    .filter(candidate => {
      if (!candidate || typeof candidate !== 'object') return false;
      if (!TRUSTED_ASSOCIATIONS.has(candidate.author_association)) return false;
      if (typeof candidate.user?.login !== 'string' || normalizedLogin(candidate.user.login) !== normalizedLogin(actor)) return false;
      if (!matchesIssueNumber(candidate, prNumber)) return false;
      if (typeof candidate.body !== 'string' || !expectedCommands.has(candidate.body.trim())) return false;
      const createdAt = Date.parse(candidate.created_at ?? '');
      const updatedAt = Date.parse(candidate.updated_at ?? candidate.created_at ?? '');
      return Number.isFinite(createdAt)
        && Number.isFinite(updatedAt)
        && createdAt <= runCreatedAt
        && updatedAt <= runCreatedAt
        && runCreatedAt - createdAt <= TRUSTED_REQUEST_MAX_AGE_MS;
    })
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
    .at(-1);

  assert(
    sourceComment,
    'trusted-main issue_comment source must have a recent trusted command comment bound to this PR, task, candidate, and actor',
  );
}

export async function verifyTrustedMainMachineRun(comment, result, { fetchImpl = fetch, comments = [] } = {}) {
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
  assert(run.path === TRUSTED_WORKFLOW_PATH, 'trusted-main source run workflow path mismatch');
  assert(['workflow_dispatch', 'issue_comment'].includes(run.event), 'trusted-main source run must be workflow_dispatch or trusted issue_comment');
  assert(run.head_branch === 'main', 'trusted-main source run must execute on main');
  assert(run.head_sha === result.trustedWorkflowSha, 'trusted-main source run SHA mismatch');
  const expectedConclusion = result.verdict === 'pass' ? 'success' : 'failure';
  assert(run.status === 'completed' && run.conclusion === expectedConclusion, 'trusted-main source run conclusion does not match verdict');

  const jobsPayload = await github(`repos/${repository}/actions/runs/${result.sourceRunId}/jobs?per_page=100`, { fetchImpl });
  const job = (jobsPayload.jobs ?? []).filter(entry => entry.name === TRUSTED_JOB).sort((a, b) => a.id - b.id).at(-1);
  assert(job?.status === 'completed' && job.conclusion === expectedConclusion, 'trusted-main review job conclusion does not match verdict');
  if (run.event === 'issue_comment') verifyIssueCommentRequestProvenance(comment, result, run, comments);
  return {
    reviewer: ACTIONS_LOGIN,
    authorAssociation: 'TRUSTED_MAIN_ACTIONS',
  };
}

export async function selectAuthoritativeReviewCommentWithProvenance(packet, comments, options = {}) {
  validateIndependentReviewPacket(packet);
  assert(Array.isArray(comments), 'GitHub PR comments payload must be an array');
  const candidates = parseTrustedHumanCandidates(packet, comments, options);
  const verify = options.verifyMachineRun ?? verifyTrustedMainMachineRun;

  for (const comment of comments) {
    if (!comment || typeof comment !== 'object' || comment.user?.login !== ACTIONS_LOGIN) continue;
    if (typeof comment.body !== 'string' || !comment.body.includes(TRUSTED_MAIN_MARKER)) continue;
    if (conclusivelyTargetsDifferentCandidate(packet, comment.body)) continue;
    let result;
    try {
      result = extractReviewResult(comment.body);
    } catch (error) {
      throw new Error(`trusted independent review comment ${comment.id ?? 'unknown'} is malformed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!result || result.taskId !== packet.taskId || result.candidateSha !== packet.candidateSha) continue;
    const trust = await verify(comment, result, { ...options, comments });
    candidates.push({ comment, result, trust });
  }

  return chooseLatestPass(packet, candidates);
}

async function resolvePullRequestAuthor(explicitPrAuthor) {
  const eventPath = process.env.GITHUB_EVENT_PATH?.trim();
  if (eventPath) {
    const event = JSON.parse(await readFile(eventPath, 'utf8'));
    const eventPrAuthor = event?.pull_request?.user?.login;
    assertString(eventPrAuthor, 'GitHub pull request author');
    return eventPrAuthor;
  }
  assertString(explicitPrAuthor, '--pr-author');
  return explicitPrAuthor;
}

async function gate({ packet, comments, output, prAuthor: explicitPrAuthor }) {
  assertString(packet, '--packet');
  assertString(comments, '--comments');
  assertString(output, '--output');
  const prAuthor = await resolvePullRequestAuthor(explicitPrAuthor);
  const reviewPacket = JSON.parse(await readFile(packet, 'utf8'));
  const prComments = JSON.parse(await readFile(comments, 'utf8'));
  const selected = await selectAuthoritativeReviewCommentWithProvenance(reviewPacket, prComments, { prAuthor });
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
  throw new Error('usage: review-comment-gate.mjs gate --packet <path> --comments <path> --output <path> [--pr-author <login>]');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
