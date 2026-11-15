import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectReviewChangedFiles, parseReviewScopeArguments, requiresOrchestrationReview, verifyReviewScope } from '../tools/review-scope.mjs';

const paths = ['AGENTS.md', 'docs/engineering-iteration-playbook.md', 'agent/task-graph.json'];
const ao = { taskId: 'AO-18', mode: 'orchestration', source: 'agent/task-graph.json' };
const contract = {
  tasks: [{
    id: 'AO-18', title: 'Bind engineering iteration guardrails to the actual agent-orchestration review task',
    status: 'active', acceptance: ['Process-only iteration-preflight changes must be checked'],
    proofs: [
      { id: 'iteration-preflight-unit', required: true },
      { id: 'architecture-contract', required: true },
      { id: 'trusted-independent-review', required: true },
    ],
  }],
};
const verify = (files, sel, graph = contract) => verifyReviewScope(files, sel, graph);
assert.equal(requiresOrchestrationReview(paths), true);
assert.deepEqual(verify(paths, ao), { processChange: true, taskId: 'AO-18', mode: 'orchestration' });
assert.deepEqual(verify(paths, { ...ao, mode: 'orchestration-closeout' }, { tasks: [{ ...contract.tasks[0], status: 'verified' }] }).mode, 'orchestration-closeout');
for (const bad of [
  { taskId: 'P28-G9', mode: 'product', source: 'docs/content-roadmap.md' },
  { taskId: 'AO-18', mode: 'product', source: 'agent/task-graph.json' },
  { taskId: 'EV-21', mode: 'experimental', source: 'docs/experimental-verification-roadmap.md' },
  { taskId: 'AO-18', mode: 'orchestration', source: 'docs/content-roadmap.md' },
]) assert.throws(() => verify(paths, bad));
assert.equal(verify(['src/game/babylonCombatRenderer.ts'], { taskId: 'P28-G9', mode: 'product' }).processChange, false);
assert.equal(requiresOrchestrationReview(['AGENTS.md']), false);
assert.throws(() => requiresOrchestrationReview([]));
assert.throws(() => verify(paths, null));
assert.throws(() => verify(paths, { ...ao, taskId: 'AO-19' }), /AO-18/);
assert.throws(() => verifyReviewScope(paths, ao), /authoritative AO task graph required/);
assert.throws(() => verify(paths, ao, { tasks: [] }), /AO-18 task contract is missing/);
assert.throws(() => verify(paths, ao, { tasks: [{ ...contract.tasks[0], acceptance: [] }] }), /acceptance contract/);
assert.throws(() => verify(paths, ao, { tasks: [{ ...contract.tasks[0], title: 'Unrelated task' }] }), /not the iteration-guardrails task/);
assert.throws(() => verify(paths, ao, { tasks: [{ ...contract.tasks[0], proofs: [] }] }), /missing process/);
assert.throws(() => verify(paths, ao, { tasks: [{ ...contract.tasks[0], status: 'verified' }] }), /status does not match/);

assert.deepEqual(parseReviewScopeArguments(['--base', 'main', '--head', 'HEAD']), { base: 'main', head: 'HEAD' });
for (const bad of [[], ['--base', 'main'], ['--base', 'main', '--head', 'HEAD', '--head', 'other'], ['--foo']]) {
  assert.throws(() => parseReviewScopeArguments(bad));
}
// Prove the real Git scan keeps both rename sources and deleted process files.
const repo = await mkdtemp(join(tmpdir(), 'ironshade-review-scope-'));
try {
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  await mkdir(join(repo, 'docs'), { recursive: true });
  await mkdir(join(repo, 'tools'), { recursive: true });
  await writeFile(join(repo, 'docs/engineering-iteration-playbook.md'), '# Rules\n');
  await writeFile(join(repo, 'tools/iteration-preflight.mjs'), 'export {};\n');
  git('add', '.');
  git('-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  git('mv', 'docs/engineering-iteration-playbook.md', 'docs/renamed.md');
  await rm(join(repo, 'tools/iteration-preflight.mjs'));
  git('add', '-A');
  git('-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'rename and delete');
  const changed = collectReviewChangedFiles({ base, head: git('rev-parse', 'HEAD'), cwd: repo });
  assert(changed.includes('docs/engineering-iteration-playbook.md'), 'rename source must be included');
  assert(changed.includes('docs/renamed.md'), 'rename target must be included');
  assert(changed.includes('tools/iteration-preflight.mjs'), 'deleted process script must be included');
  assert.equal(requiresOrchestrationReview(changed), true);
} finally {
  await rm(repo, { recursive: true, force: true });
}
console.log('REVIEW_SCOPE_REGRESSIONS_PASS');
