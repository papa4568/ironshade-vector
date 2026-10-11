import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { parseExperimentalRoadmap } from './experimental-review-task.mjs';

const ok = (value, message) => { if (!value) throw new Error(message); };
const positive = (value, label) => {
  const parsed = Number(value);
  ok(Number.isInteger(parsed) && parsed > 0, `${label} must be positive`);
  return parsed;
};
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const SHA_RE = /^[a-f0-9]{40}$/;
const TASK_RE = /^(?:AO-\d+|EV-\d+|P\d+(?:-[A-Z0-9]+)+)$/;

function validateTaskId(taskId, label) {
  ok(TASK_RE.test(taskId), `${label} must be an AO task ID, EV task ID, or product-roadmap task ID`);
  return taskId;
}

export function resolveTrustedReviewRequest({
  eventName,
  inputPrNumber = '',
  inputCandidateSha = '',
  inputTaskId = '',
  issueNumber = '',
  commentBody = '',
  commentAssociation = '',
}) {
  if (eventName === 'workflow_dispatch') {
    const prNumber = positive(inputPrNumber, 'input pr_number');
    const candidateSha = inputCandidateSha.trim();
    const taskId = validateTaskId(inputTaskId.trim() || 'AO-6', 'input task_id');
    ok(SHA_RE.test(candidateSha), 'input candidate_sha must be a full lowercase SHA');
    return { prNumber: String(prNumber), candidateSha, taskId };
  }

  if (eventName === 'issue_comment') {
    ok(TRUSTED_ASSOCIATIONS.has(commentAssociation), `untrusted issue_comment association ${commentAssociation || 'NONE'}`);
    const match = commentBody.trim().match(/^\/ao6-trusted-review\s+(\d+)\s+([a-f0-9]{40})(?:\s+([A-Z][A-Z0-9-]*))?$/);
    ok(match, 'issue_comment command must be /ao6-trusted-review <pr> <sha> [task]');
    const prNumber = positive(match[1], 'comment PR number');
    const eventIssueNumber = positive(issueNumber, 'event issue number');
    ok(prNumber === eventIssueNumber, `comment PR ${prNumber} does not match event issue ${eventIssueNumber}`);
    const taskId = validateTaskId(match[3] || 'AO-6', 'comment task');
    return { prNumber: String(prNumber), candidateSha: match[2], taskId };
  }

  throw new Error(`unsupported trusted review event ${eventName || 'unknown'}`);
}

function resolveCommand() {
  const request = resolveTrustedReviewRequest({
    eventName: process.env.EVENT_NAME?.trim() ?? '',
    inputPrNumber: process.env.INPUT_PR_NUMBER ?? '',
    inputCandidateSha: process.env.INPUT_CANDIDATE_SHA ?? '',
    inputTaskId: process.env.INPUT_TASK_ID ?? '',
    issueNumber: process.env.ISSUE_NUMBER ?? '',
    commentBody: process.env.COMMENT_BODY ?? '',
    commentAssociation: process.env.COMMENT_ASSOCIATION ?? '',
  });
  const target = process.env.GITHUB_ENV?.trim();
  ok(target, 'GITHUB_ENV is required');
  appendFileSync(target, `PR_NUMBER=${request.prNumber}\nCANDIDATE_SHA=${request.candidateSha}\nTASK_ID=${request.taskId}\n`, 'utf8');
  console.log(`AO6_TRUSTED_REVIEW_REQUEST_RESOLVED pr=${request.prNumber} candidate=${request.candidateSha} task=${request.taskId}`);
}

function selfTest() {
  const sha = 'a'.repeat(40);
  const dispatched = resolveTrustedReviewRequest({ eventName: 'workflow_dispatch', inputPrNumber: '346', inputCandidateSha: sha, inputTaskId: 'AO-6' });
  ok(dispatched.prNumber === '346' && dispatched.candidateSha === sha && dispatched.taskId === 'AO-6', 'workflow_dispatch request resolution failed');
  const productDispatch = resolveTrustedReviewRequest({ eventName: 'workflow_dispatch', inputPrNumber: '345', inputCandidateSha: sha, inputTaskId: 'P28-PLOAD1' });
  ok(productDispatch.taskId === 'P28-PLOAD1', 'product workflow_dispatch task resolution failed');
  const experimentalDispatch = resolveTrustedReviewRequest({ eventName: 'workflow_dispatch', inputPrNumber: '365', inputCandidateSha: sha, inputTaskId: 'EV-8' });
  ok(experimentalDispatch.taskId === 'EV-8', 'experimental workflow_dispatch task resolution failed');
  const commented = resolveTrustedReviewRequest({ eventName: 'issue_comment', issueNumber: '346', commentAssociation: 'OWNER', commentBody: `/ao6-trusted-review 346 ${sha} AO-6` });
  ok(commented.prNumber === '346' && commented.candidateSha === sha && commented.taskId === 'AO-6', 'trusted issue_comment request resolution failed');
  const productComment = resolveTrustedReviewRequest({ eventName: 'issue_comment', issueNumber: '345', commentAssociation: 'OWNER', commentBody: `/ao6-trusted-review 345 ${sha} P28-PLOAD1` });
  ok(productComment.taskId === 'P28-PLOAD1', 'product issue_comment task resolution failed');
  const experimentalComment = resolveTrustedReviewRequest({ eventName: 'issue_comment', issueNumber: '365', commentAssociation: 'OWNER', commentBody: `/ao6-trusted-review 365 ${sha} EV-8` });
  ok(experimentalComment.taskId === 'EV-8', 'experimental issue_comment task resolution failed');
  const defaultTask = resolveTrustedReviewRequest({ eventName: 'issue_comment', issueNumber: '346', commentAssociation: 'MEMBER', commentBody: `/ao6-trusted-review 346 ${sha}` });
  ok(defaultTask.taskId === 'AO-6', 'issue_comment default task resolution failed');
  try { resolveTrustedReviewRequest({ eventName: 'issue_comment', issueNumber: '346', commentAssociation: 'NONE', commentBody: `/ao6-trusted-review 346 ${sha}` }); throw new Error('untrusted association was accepted'); } catch (error) { ok(/untrusted issue_comment association/.test(String(error)), 'untrusted association did not fail closed'); }
  try { resolveTrustedReviewRequest({ eventName: 'issue_comment', issueNumber: '347', commentAssociation: 'OWNER', commentBody: `/ao6-trusted-review 346 ${sha}` }); throw new Error('cross-PR command was accepted'); } catch (error) { ok(/does not match event issue/.test(String(error)), 'cross-PR command did not fail closed'); }
  try { resolveTrustedReviewRequest({ eventName: 'issue_comment', issueNumber: '346', commentAssociation: 'OWNER', commentBody: `/ao6-trusted-review 346 ${sha.toUpperCase()}` }); throw new Error('uppercase SHA was accepted'); } catch (error) { ok(/command must be/.test(String(error)), 'malformed SHA did not fail closed'); }
  try { resolveTrustedReviewRequest({ eventName: 'issue_comment', issueNumber: '345', commentAssociation: 'OWNER', commentBody: `/ao6-trusted-review 345 ${sha} ZZ-1` }); throw new Error('unsupported task namespace was accepted'); } catch (error) { ok(/must be an AO task ID, EV task ID, or product-roadmap task ID/.test(String(error)), 'unsupported task namespace did not fail closed'); }

  const malformedFirstEv = [
    '# Experimental verification roadmap',
    '',
    '## Active experimental queue',
    '',
    '- [ ] **EV-8 - malformed separator**',
    '  - This malformed first task must never be skipped.',
    '',
    '- [ ] **EV-9 — Later valid task**',
    '  - A later valid task must not become authoritative.',
  ].join('\n');
  try {
    parseExperimentalRoadmap(malformedFirstEv);
    throw new Error('malformed first EV task was silently skipped');
  } catch (error) {
    ok(/malformed experimental task line/.test(String(error)), 'malformed first EV task did not fail closed');
  }

  const malformedNonnumericFirstEv = [
    '# Experimental verification roadmap',
    '',
    '## Active experimental queue',
    '',
    '- [ ] **EV-X — malformed task id**',
    '  - A malformed nonnumeric first EV task must never be skipped.',
    '',
    '- [ ] **EV-9 — Later valid task**',
    '  - A later valid task must not become authoritative.',
  ].join('\n');
  try {
    parseExperimentalRoadmap(malformedNonnumericFirstEv);
    throw new Error('malformed nonnumeric first EV task was silently skipped');
  } catch (error) {
    ok(/malformed experimental task line/.test(String(error)), 'malformed nonnumeric first EV task did not fail closed');
  }

  console.log('AO6_TRUSTED_REVIEW_REQUEST_SELF_TEST_PASS');
}

function main() {
  const command = process.argv[2];
  if (command === 'resolve') return resolveCommand();
  if (command === 'self-test') return selfTest();
  throw new Error('usage: ao6-trusted-review-request.mjs resolve | self-test');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
