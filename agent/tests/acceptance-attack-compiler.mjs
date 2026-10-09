import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  classifyAttackOutcome,
  compileAttackPlan,
  exerciseAttackPlan,
  resolveSandboxMutationTarget,
} from '../tools/acceptance-attack-compiler.mjs';

const taskId = 'P28-PLOAD1';
const fixturePath = 'agent/fixtures/acceptance-attacks/p28-pload1/fixture.json';

const first = await compileAttackPlan({ taskId });
const second = await compileAttackPlan({ taskId });
assert.deepEqual(second, first, 'attack plan must be deterministic for an unchanged roadmap task');
assert.equal(first.schema, 'ironshade-acceptance-attack-plan:v1');
assert.equal(first.mode, 'advisory');
assert.equal(first.task.id, taskId);
assert.equal(first.isolation.strategy, 'disposable-clone');
assert.equal(first.isolation.candidateBranchMutationAllowed, false);
assert.equal(first.outcomeContract.survivorCanPass, false);
assert.equal(first.attacks.length, 6, 'all initial deterministic attack templates must compile');

const expectedTemplates = new Set([
  'false-readiness',
  'fake-telemetry',
  'skipped-quality-work',
  'hidden-serialization',
  'special-cased-test-route',
  'omitted-resource-work',
]);
assert.deepEqual(new Set(first.attacks.map(attack => attack.templateId)), expectedTemplates);
const challengedCriterionCounts = new Map();
for (const attack of first.attacks) {
  challengedCriterionCounts.set(attack.criterionId, (challengedCriterionCounts.get(attack.criterionId) ?? 0) + 1);
}
assert.ok([...challengedCriterionCounts.values()].some(count => count >= 2), 'a representative P28 criterion must be challenged by multiple attacks');

assert.equal(
  classifyAttackOutcome({ exitCode: 0, stdout: 'VISIBLE CHECKS PASS' }),
  'proof-gap',
  'a surviving attack must never be converted into a pass',
);
assert.equal(classifyAttackOutcome({ exitCode: 1 }), 'caught');

await assert.rejects(
  resolveSandboxMutationTarget('/tmp/ev1-sandbox', '../candidate.txt'),
  /escapes disposable clone/,
  'path traversal must fail before any mutation can reach candidate state',
);
await assert.rejects(
  resolveSandboxMutationTarget('/tmp/ev1-sandbox', resolve('/tmp/candidate.txt')),
  /must be repository-relative/,
  'absolute mutation targets must fail before any write',
);

const report = await exerciseAttackPlan({ taskId, fixturePath });
assert.equal(report.schema, 'ironshade-acceptance-attack-report:v1');
assert.equal(report.mode, 'advisory');
assert.equal(report.taskId, taskId);
assert.equal(report.candidatePassGranted, false);
assert.equal(report.isolation.sourceUnchanged, true);
assert.equal(report.isolation.sandboxRemoteDetached, true, 'disposable clone must not retain a remote back to candidate state');
assert.equal(report.summary.total, 6);
assert.ok(report.summary.caught >= 1, 'fixture must prove at least one dishonest variant is caught');
assert.ok(report.summary.proofGaps >= 1, 'fixture must prove surviving dishonest variants become proof gaps');
assert.equal(report.summary.total, report.summary.caught + report.summary.proofGaps);
for (const result of report.results) {
  assert.ok(result.outcome === 'caught' || result.outcome === 'proof-gap');
  assert.notEqual(result.outcome, 'pass');
}

const evidenceDir = process.env.ACCEPTANCE_ATTACK_EVIDENCE_DIR;
if (evidenceDir) {
  const resolved = resolve(evidenceDir);
  await mkdir(resolved, { recursive: true });
  await writeFile(resolve(resolved, 'p28-pload1-plan.json'), `${JSON.stringify(first, null, 2)}\n`);
  await writeFile(resolve(resolved, 'p28-pload1-report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`ACCEPTANCE_ATTACK_COMPILER_REGRESSIONS_PASS task=${taskId} attacks=${report.summary.total} caught=${report.summary.caught} proofGaps=${report.summary.proofGaps} sourceUnchanged=${report.isolation.sourceUnchanged} remoteDetached=${report.isolation.sandboxRemoteDetached} pathEscape=blocked-before-write`);
