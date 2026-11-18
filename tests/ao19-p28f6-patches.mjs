import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectOrchestrationReviewTask } from '../agent/tools/select-review-task.mjs';
import {
  REVIEWED_OLD_BLOBS, REVIEWED_NEW_CONTRACT_PATH,
  gitBlobSha, prepareProtectedHotfixReviewSources,
} from '../tools/ao19-p28f6-route-patches.mjs';
const old = Object.fromEntries(Object.keys(REVIEWED_OLD_BLOBS).map(path => [path, readFileSync(path, 'utf8')]));
const staged = readFileSync('tools/ao19-p28f6-contract.staged.mjs', 'utf8');
const newFiles = prepareProtectedHotfixReviewSources(old, staged);
assert.equal(newFiles.length, 4);
assert.equal(newFiles.at(-1).path, REVIEWED_NEW_CONTRACT_PATH);
assert.equal(newFiles.at(-1).content, staged, 'staged contract must be copied byte-for-byte, not rewritten');
for (const output of newFiles) {
  assert.equal(output.sha, gitBlobSha(output.content), 'proposed protected source must have deterministic Git blob identity');
  assert(output.content.includes('P28-F6') || output.content.includes('P28F6') ||
    output.content.includes('p28f6-hotfix-review-contract'),
    'protected patch must be scoped to P28-F6');
}
const byPath = Object.fromEntries(newFiles.map(f => [f.path, f.content]));
assert(byPath['agent/tools/select-review-task.mjs'].includes('if (reviewedHotfix) return reviewedHotfix;'));
assert(byPath['agent/tools/candidate-evidence.mjs'].includes('candidatePinnedHotfixTask({ baseRef'));
assert(byPath['agent/tools/trusted-independent-review-v3.mjs'].includes('verifyPinnedHotfixPull({ pull, files, headTree, candidateSha, baseSha })'));
assert(!byPath['agent/tools/select-review-task.mjs'].includes('P28-G9') ||
  old['agent/tools/select-review-task.mjs'].includes('P28-G9'),
  'new route must not reorder or alter the existing product fallback');
for (const path of Object.keys(REVIEWED_OLD_BLOBS)) {
  assert.throws(() => prepareProtectedHotfixReviewSources({
    ...old, [path]: old[path] + '\n// tampered\n',
  }, staged), /base source drift/);
}
assert.throws(() => prepareProtectedHotfixReviewSources(old, 'not a contract'), /contract source/);
console.log('AO19_TRUSTED_HOTFIX_SOURCE_PATCH_REGRESSIONS_PASS ' + newFiles.map(x => x.path + ':' + x.sha).join(' '));

// Full routing-order regression: after this final AO-19 closeout is merged,
// AO-19 cannot shadow P28-F6. A stray active task would make selection choose
// AO-19 before the proposed hotfix route could execute.
const graph = JSON.parse(readFileSync('agent/task-graph.json', 'utf8'));
const ao19 = graph.tasks.find(t => t.id === 'AO-19');
assert.equal(ao19?.status, 'verified', 'the reviewed AO-19 PR must be a verified closeout candidate');
const mergedGraph = structuredClone(graph);
assert.equal(selectOrchestrationReviewTask(mergedGraph, { baseGraph: mergedGraph }), null,
  'after merge, no active/transitioned AO task may shadow pinned product hotfix routing');
const shadowedGraph = structuredClone(graph);
shadowedGraph.tasks.find(t => t.id === 'AO-19').status = 'active';
assert.equal(selectOrchestrationReviewTask(shadowedGraph, { baseGraph: shadowedGraph })?.task.id, 'AO-19',
  'a regression would re-enable the active-AO-19 review shadow');
const selector = byPath['agent/tools/select-review-task.mjs'];
const orchestrationPosition = selector.indexOf('const orchestration = selectOrchestrationReviewTask(');
const hotfixPosition = selector.indexOf('const reviewedHotfix = maybePinnedHotfixReview(');
const productPosition = selector.indexOf('let product;');
assert(orchestrationPosition >= 0 && orchestrationPosition < hotfixPosition &&
  hotfixPosition < productPosition, 'new selector must evaluate verified AO closeout, then pinned hotfix, then normal product fallback');

const bootstrap = readFileSync('tools/ao19-p28f6-route-bootstrap.mjs', 'utf8');
assert(!bootstrap.includes("from './ao19-p28f6-route-patches.mjs'"),
  'privileged helper must not statically import unchecked patch recipe');
assert(bootstrap.indexOf('validateStagedModulePin();') >= 0 &&
  bootstrap.indexOf('validateStagedModulePin();') < bootstrap.indexOf("await import('./ao19-p28f6-route-patches.mjs')"),
  'actual patch module import must happen strictly after digest verification');
const workflow = readFileSync('.github/workflows/ao19-p28f6-review-route.yml', 'utf8');
assert(workflow.includes(gitBlobSha(bootstrap)), 'trusted workflow must pin the exact owner-helper Git object');
console.log('AO19_SELECTOR_CLOSEOUT_AND_PREIMPORT_SOURCE_PIN_PASS');
