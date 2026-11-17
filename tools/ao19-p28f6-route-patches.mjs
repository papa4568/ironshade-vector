// AO-19: reviewed one-use source patch recipe. Only trusted-main bootstrap
// may promote these generated objects into protected agent/ after independent
// AO-19 approval and an exact owner comment. Never execute PR candidate code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const REVIEWED_OLD_BLOBS = Object.freeze({
  'agent/tools/select-review-task.mjs': '71f5eccdf3a6b9d0ac8cbdb23c62ae202b306cdf',
  'agent/tools/candidate-evidence.mjs': '509de6365c1c72eb4e897177758091d9d24ff58a',
  'agent/tools/trusted-independent-review-v3.mjs': '6feebc5d36e49b6e7f0e8bcadc0980ccbc7d08f6',
});
export const REVIEWED_NEW_CONTRACT_PATH = 'agent/tools/p28f6-hotfix-review-contract.mjs';
export const STAGED_CONTRACT_PATH = 'tools/ao19-p28f6-contract.staged.mjs';
export function gitBlobSha(content) {
  assert(typeof content === 'string', 'Git blob content must be UTF-8 source text');
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}
function insertOnce(source, needle, replacement, path) {
  assert(typeof source === 'string' && source.includes(needle),
    'trusted source anchor is missing: ' + path);
  assert(source.indexOf(needle) === source.lastIndexOf(needle),
    'trusted source anchor is ambiguous: ' + path);
  assert(!source.includes(replacement), 'cannot apply same protected patch twice: ' + path);
  return source.replace(needle, replacement);
}
export function prepareProtectedHotfixReviewSources(oldSources, stagedContractText) {
  assert(oldSources && typeof oldSources === 'object', 'trusted main old sources missing');
  const result = [];
  for (const [path, sha] of Object.entries(REVIEWED_OLD_BLOBS)) {
    const old = oldSources[path];
    assert(gitBlobSha(old) === sha, 'protected trusted-main base source drift: ' + path);
  }
  assert(typeof stagedContractText === 'string' && stagedContractText.includes('export function verifyPinnedHotfixPull'),
    'the reviewed hotfix contract source is missing');

  const selector = 'agent/tools/select-review-task.mjs';
  let selection = oldSources[selector];
  selection = insertOnce(selection,
    "import { loadTaskGraph, validateTaskGraph } from './validate-task-graph.mjs';",
    "import { loadTaskGraph, validateTaskGraph } from './validate-task-graph.mjs';\nimport { maybePinnedHotfixReview } from './p28f6-hotfix-review-contract.mjs';",
    selector);
  selection = insertOnce(selection,
    "  let product;\n  if (headRef) {",
    "  // Only the Git-object-pinned, owner-approved PR #449 product regression\n  // may precede the ordinary first-unfinished product roadmap fallback.\n  const reviewedHotfix = maybePinnedHotfixReview({ baseRef, headRef, eventPath: process.env.GITHUB_EVENT_PATH });\n  if (reviewedHotfix) return reviewedHotfix;\n\n  let product;\n  if (headRef) {",
    selector);
  result.push({ path: selector, content: selection, sha: gitBlobSha(selection) });

  const evidence = 'agent/tools/candidate-evidence.mjs';
  let candidate = oldSources[evidence];
  candidate = insertOnce(candidate,
    "import { execFileSync } from 'node:child_process';",
    "import { execFileSync } from 'node:child_process';\nimport { candidatePinnedHotfixTask, HOTFIX_TASK_ID } from './p28f6-hotfix-review-contract.mjs';",
    evidence);
  candidate = insertOnce(candidate,
    "  const productTask = await loadProductTask(taskId);",
    "  if (taskId === HOTFIX_TASK_ID) {\n    assertString(baseRef, 'P28-F6 pinned review base Git ref');\n    return {\n      task: candidatePinnedHotfixTask({ baseRef, eventPath: process.env.GITHUB_EVENT_PATH }),\n      source: 'agent/tools/p28f6-hotfix-review-contract.mjs',\n    };\n  }\n\n  const productTask = await loadProductTask(taskId);",
    evidence);
  result.push({ path: evidence, content: candidate, sha: gitBlobSha(candidate) });

  const reviewer = 'agent/tools/trusted-independent-review-v3.mjs';
  let trusted = oldSources[reviewer];
  trusted = insertOnce(trusted,
    "import { selectExperimentalReviewTask } from './experimental-review-task.mjs';",
    "import { selectExperimentalReviewTask } from './experimental-review-task.mjs';\nimport { HOTFIX_TASK, HOTFIX_TASK_ID, verifyPinnedHotfixPull } from './p28f6-hotfix-review-contract.mjs';",
    reviewer);
  trusted = insertOnce(trusted,
    "export async function exactCandidatePacket(repo, candidateSha, taskId, baseSha = null) {\n",
    "export async function exactCandidatePacket(repo, candidateSha, taskId, baseSha = null) {\n  if (taskId === HOTFIX_TASK_ID) {\n    ok(repo === 'papa4568/ironshade-vector', 'wrong repository for P28-F6 owner-authorized hotfix');\n    ok(typeof baseSha === 'string', 'trusted P28-F6 review requires exact base Git ref');\n    const [pull, files, headTree] = await Promise.all([\n      api('repos/' + repo + '/pulls/449'),\n      api('repos/' + repo + '/pulls/449/files?per_page=100'),\n      api('repos/' + repo + '/git/trees/' + candidateSha + '?recursive=1'),\n    ]);\n    verifyPinnedHotfixPull({ pull, files, headTree, candidateSha, baseSha });\n    return packetFromTaskGraph({ tasks: [HOTFIX_TASK] }, taskId, candidateSha);\n  }\n",
    reviewer);
  result.push({ path: reviewer, content: trusted, sha: gitBlobSha(trusted) });
  result.push({ path: REVIEWED_NEW_CONTRACT_PATH, content: stagedContractText, sha: gitBlobSha(stagedContractText) });
  assert(result.length === 4 && new Set(result.map(x => x.path)).size === 4, 'protected route source inventory mismatch');
  return result;
}
