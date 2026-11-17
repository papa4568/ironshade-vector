import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
