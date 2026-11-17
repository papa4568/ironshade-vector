import assert from 'node:assert/strict';
import {
  HOTFIX_PR, HOTFIX_BRANCH, HOTFIX_REPO, HOTFIX_BLOBS, HOTFIX_TASK,
  verifyPinnedHotfixIdentity, verifyPinnedHotfixPull, maybePinnedHotfixReview,
} from '../tools/ao19-p28f6-contract.staged.mjs';
const baseSha = 'a'.repeat(40), headSha = 'b'.repeat(40);
const files = Object.entries(HOTFIX_BLOBS).map(([path, sha]) => ({ path, sha, mode: '100644', type: 'blob', status: 'modified' }));
const good = { prNumber: HOTFIX_PR, repo: HOTFIX_REPO, branch: HOTFIX_BRANCH, baseSha, headSha, files };
assert.equal(verifyPinnedHotfixIdentity(good).id, 'P28-F6');
assert(HOTFIX_TASK.acceptance.some(x => x.includes('genuine post-resume touch FIRE')));
assert(HOTFIX_TASK.proofs.some(x => x.kind === 'review' && x.required));
const bad = patch => assert.throws(() => verifyPinnedHotfixIdentity({ ...good, ...patch }));
bad({ prNumber: 448 });
bad({ repo: 'attacker/ironshade-vector' });
bad({ state: 'closed' });
bad({ branch: 'unreviewed' });
bad({ baseSha: headSha });
bad({ headSha: 'short' });
bad({ files: [] });
bad({ files: files.slice(1) });
bad({ files: [...files, files[0]] });
bad({ files: files.map((f, i) => i ? f : { ...f, sha: 'f'.repeat(40) }) });
bad({ files: files.map((f, i) => i ? f : { ...f, mode: '100755' }) });
bad({ files: files.map((f, i) => i ? f : { ...f, type: 'commit' }) });
bad({ files: files.map((f, i) => i ? f : { ...f, status: 'renamed' }) });
bad({ files: files.map((f, i) => i ? f : { ...f, path: 'agent/tools/select-review-task.mjs' }) });
const pull = { number: HOTFIX_PR, state: 'open', head: { sha: headSha, ref: HOTFIX_BRANCH, repo: { full_name: HOTFIX_REPO } }, base: { sha: baseSha, ref: 'main' } };
const mapped = files.map(f => ({ filename: f.path, sha: f.sha, status: f.status }));
const headTree = { truncated: false, tree: files.map(f => ({ path: f.path, mode: f.mode, type: f.type, sha: f.sha })) };
assert.equal(verifyPinnedHotfixPull({ pull, files: mapped, candidateSha: headSha, baseSha, headTree }).id, 'P28-F6');
for (const patch of [
  { pull: { ...pull, number: 445 } },
  { pull: { ...pull, base: { ...pull.base, sha: headSha } } },
  { pull: { ...pull, head: { ...pull.head, sha: baseSha } } },
  { pull: { ...pull, head: { ...pull.head, ref: 'fix/unreviewed' } } },
  { files: mapped.map((f, i) => i ? f : { ...f, sha: baseSha }) },
  { files: [...mapped, mapped[0]] },
  { headTree: { ...headTree, truncated: true } },
  { headTree: { ...headTree, tree: headTree.tree.map((entry, i) => i ? entry : { ...entry, mode: '100755' }) } },
  { headTree: { ...headTree, tree: headTree.tree.slice(1) } },
]) assert.throws(() => verifyPinnedHotfixPull({ pull, files: mapped, candidateSha: headSha, baseSha, headTree, ...patch }));
assert.equal(maybePinnedHotfixReview({ baseRef: baseSha, headRef: headSha, eventPath: undefined }), null);
console.log('AO19_P28F6_ONE_PR_OBJECT_PIN_REGRESSIONS_PASS');
