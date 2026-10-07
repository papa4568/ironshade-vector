import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectNextTask, validateTaskGraph } from '../tools/validate-task-graph.mjs';

const repositoryGraph = JSON.parse(await readFile(resolve('agent/task-graph.json'), 'utf8'));
const summary = validateTaskGraph(repositoryGraph);
const selectedTask = selectNextTask(repositoryGraph);
const activeTask = repositoryGraph.tasks.find(task => task.status === 'active') ?? null;

assert.equal(summary.scope, 'agent-orchestration-migration');
assert.equal(repositoryGraph.tasks.find(task => task.id === 'AO-1')?.status, 'verified');
assert.equal(summary.activeTask, activeTask?.id ?? null);
if (activeTask) assert.equal(selectedTask?.id, activeTask.id);
else if (selectedTask) assert(['ready', 'planned', 'failed_retryable'].includes(selectedTask.status));

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
  graph.tasks.forEach(task => {
    if (task.id !== 'AO-1' && task.id !== 'AO-2') task.status = 'planned';
  });
  graph.tasks[0].status = 'planned';
  graph.tasks[1].status = 'ready';
}, /AO-2 is ready before all dependencies are verified or archived/);

expectInvalid(graph => {
  graph.tasks.forEach(task => {
    if (task.status === 'active') task.status = 'planned';
  });
  graph.tasks[1].status = 'active';
  graph.tasks[2].status = 'active';
}, /only one writer-owned task may be active/);

expectInvalid(graph => {
  graph.tasks.forEach(task => {
    if (task.status === 'active') task.status = 'planned';
  });
  graph.tasks[2].status = 'blocked_external';
  graph.tasks[2].externalDependencies = [];
}, /blocked_external but has no externalDependencies/);

const priorityGraph = clone(repositoryGraph);
priorityGraph.tasks.forEach(task => {
  task.status = 'planned';
});
priorityGraph.tasks[0].status = 'verified';
priorityGraph.tasks[1].status = 'verified';
priorityGraph.tasks[2].dependsOn = ['AO-2'];
priorityGraph.tasks[3].dependsOn = ['AO-2'];
priorityGraph.tasks[2].priority = 30;
priorityGraph.tasks[3].priority = 5;
assert.equal(selectNextTask(priorityGraph)?.id, 'AO-4');

console.log(`AGENT_TASK_GRAPH_TEST_PASS tasks=${summary.taskCount} requiredProofs=${summary.requiredProofs} active=${summary.activeTask ?? 'none'} next=${selectedTask?.id ?? 'none'}`);
