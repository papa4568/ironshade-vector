import assert from 'node:assert/strict';
import { parseReviewScopeArguments, requiresOrchestrationReview, verifyReviewScope } from '../tools/review-scope.mjs';

const paths = ['AGENTS.md', 'docs/engineering-iteration-playbook.md', 'agent/task-graph.json'];
const ao = { taskId: 'AO-18', mode: 'orchestration', source: 'agent/task-graph.json' };
assert.equal(requiresOrchestrationReview(paths), true);
assert.deepEqual(verifyReviewScope(paths, ao), { processChange: true, taskId: 'AO-18', mode: 'orchestration' });
assert.deepEqual(verifyReviewScope(paths, { ...ao, mode: 'orchestration-closeout' }).mode, 'orchestration-closeout');
for (const bad of [
  { taskId: 'P28-G9', mode: 'product', source: 'docs/content-roadmap.md' },
  { taskId: 'AO-18', mode: 'product', source: 'agent/task-graph.json' },
  { taskId: 'EV-21', mode: 'experimental', source: 'docs/experimental-verification-roadmap.md' },
  { taskId: 'AO-18', mode: 'orchestration', source: 'docs/content-roadmap.md' },
]) assert.throws(() => verifyReviewScope(paths, bad));
assert.equal(verifyReviewScope(['src/game/babylonCombatRenderer.ts'], { taskId: 'P28-G9', mode: 'product' }).processChange, false);
assert.equal(requiresOrchestrationReview(['AGENTS.md']), false);
assert.throws(() => requiresOrchestrationReview([]));
assert.throws(() => verifyReviewScope(paths, null));
assert.deepEqual(parseReviewScopeArguments(['--base', 'main', '--head', 'HEAD']), { base: 'main', head: 'HEAD' });
for (const bad of [[], ['--base', 'main'], ['--base', 'main', '--head', 'HEAD', '--head', 'other'], ['--foo']]) {
  assert.throws(() => parseReviewScopeArguments(bad));
}
console.log('REVIEW_SCOPE_REGRESSIONS_PASS');
