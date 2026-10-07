import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectNextTask, validateTaskGraph } from '../tools/validate-task-graph.mjs';

const repositoryGraph = JSON.parse(await readFile(resolve('agent/task-graph.json'), 'utf8'));
const summary = validateTaskGraph(repositoryGraph);
assert.equal(summary.scope, 'agent-orchestration-migration');
assert.equal(summary.activeTask, 'AO-1');
assert.equal(selectNextTask(repositoryGraph)?.id, 'AO-1');

function clone(value) {
  return structuredClone(value);
}

function expectInvalid(mutator, pattern) {
  const graph = clone(repositoryGraph);
  mutator(graph);
  assert.throws(() => validateTaskGraph(graph), pattern);
}

expectInvalid(graph => {
  graph.tasks.push(clone(graph.tasks[0]));
}, /duplicate task id AO-1/);

expectInvalid(graph => {
  graph.tasks[1].dependsOn = ['AO-MISSING'];
}, /depends on unknown task AO-MISSING/);

expectInvalid(graph => {
  graph.tasks[0].dependsOn = ['AO-2'];
  graph.tasks[1].dependsOn = ['AO-1'];
}, /dependency cycle detected/);

expectInvalid(graph => {
  graph.tasks[1].status = 'ready';
}, /AO-2 is ready before all dependencies are verified or archived/);

expectInvalid(graph => {
  graph.tasks[1].status = 'active';
}, /only one writer-owned task may be active/);

expectInvalid(graph => {
  graph.tasks[1].status = 'blocked_external';
}, /blocked_external but has no externalDependencies/);

const priorityGraph = clone(repositoryGraph);
priorityGraph.tasks[0].status = 'verified';
priorityGraph.tasks[1].status = 'planned';
priorityGraph.tasks[2].dependsOn = ['AO-1'];
priorityGraph.tasks[2].priority = 5;
assert.equal(selectNextTask(priorityGraph)?.id, 'AO-3');

console.log(`AGENT_TASK_GRAPH_TEST_PASS tasks=${summary.taskCount} requiredProofs=${summary.requiredProofs}`);
