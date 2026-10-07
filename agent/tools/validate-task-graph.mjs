import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TASK_STATUSES = new Set([
  'planned',
  'ready',
  'active',
  'verifying',
  'failed_retryable',
  'blocked_external',
  'verified',
  'archived',
]);

const PROOF_KINDS = new Set([
  'test',
  'build',
  'ci',
  'artifact',
  'review',
  'invariant',
  'external',
]);

const COMPLETED_STATUSES = new Set(['verified', 'archived']);
const ACTIONABLE_STATUSES = new Set(['ready', 'active', 'verifying', 'failed_retryable']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertStringArray(value, label, { minItems = 0, unique = false } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(value.length >= minItems, `${label} must contain at least ${minItems} item(s)`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  if (unique) assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function validateProof(proof, taskId, seenProofIds) {
  assert(proof && typeof proof === 'object' && !Array.isArray(proof), `${taskId}.proof must be an object`);
  assertString(proof.id, `${taskId}.proof.id`);
  assert(!seenProofIds.has(proof.id), `${taskId} has duplicate proof id ${proof.id}`);
  seenProofIds.add(proof.id);
  assert(PROOF_KINDS.has(proof.kind), `${taskId}.${proof.id} has unsupported proof kind ${proof.kind}`);
  assert(typeof proof.required === 'boolean', `${taskId}.${proof.id}.required must be boolean`);
  assertString(proof.description, `${taskId}.${proof.id}.description`);
  if (proof.command !== undefined) assertString(proof.command, `${taskId}.${proof.id}.command`);
  if (proof.evidence !== undefined) assert(typeof proof.evidence === 'string', `${taskId}.${proof.id}.evidence must be a string`);
}

function detectCycles(tasksById) {
  const visiting = new Set();
  const visited = new Set();

  function visit(taskId, path = []) {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      const cycle = [...path.slice(cycleStart), taskId].join(' -> ');
      throw new Error(`dependency cycle detected: ${cycle}`);
    }
    visiting.add(taskId);
    const task = tasksById.get(taskId);
    for (const dependencyId of task.dependsOn) visit(dependencyId, [...path, taskId]);
    visiting.delete(taskId);
    visited.add(taskId);
  }

  for (const taskId of tasksById.keys()) visit(taskId);
}

function dependenciesComplete(task, tasksById) {
  return task.dependsOn.every(dependencyId => COMPLETED_STATUSES.has(tasksById.get(dependencyId).status));
}

export function validateTaskGraph(graph) {
  assert(graph && typeof graph === 'object' && !Array.isArray(graph), 'task graph must be an object');
  assert(graph.schemaVersion === 1, 'schemaVersion must be 1');
  assertString(graph.scope, 'scope');
  assert(graph.authority && typeof graph.authority === 'object' && !Array.isArray(graph.authority), 'authority must be an object');
  assertStringArray(graph.authority.authoritativeForPatterns, 'authority.authoritativeForPatterns', { minItems: 1, unique: true });
  assertString(graph.authority.fallbackQueue, 'authority.fallbackQueue');
  assert(Array.isArray(graph.tasks), 'tasks must be an array');

  const tasksById = new Map();
  let activeCount = 0;

  for (const [index, task] of graph.tasks.entries()) {
    assert(task && typeof task === 'object' && !Array.isArray(task), `tasks[${index}] must be an object`);
    assertString(task.id, `tasks[${index}].id`);
    assert(/^[A-Z][A-Z0-9-]*$/.test(task.id), `${task.id} has invalid id format`);
    assert(!tasksById.has(task.id), `duplicate task id ${task.id}`);
    assertString(task.title, `${task.id}.title`);
    assert(Number.isInteger(task.priority) && task.priority >= 0, `${task.id}.priority must be a non-negative integer`);
    assert(TASK_STATUSES.has(task.status), `${task.id} has unsupported status ${task.status}`);
    assertStringArray(task.dependsOn, `${task.id}.dependsOn`, { unique: true });
    assertStringArray(task.acceptance, `${task.id}.acceptance`, { minItems: 1 });
    assertStringArray(task.affectedDomains, `${task.id}.affectedDomains`, { unique: true });
    assert(Array.isArray(task.proofs) && task.proofs.length > 0, `${task.id}.proofs must contain at least one proof`);
    assertStringArray(task.externalDependencies, `${task.id}.externalDependencies`, { unique: true });
    if (task.status === 'blocked_external') {
      assert(task.externalDependencies.length > 0, `${task.id} is blocked_external but has no externalDependencies`);
    }
    const seenProofIds = new Set();
    task.proofs.forEach(proof => validateProof(proof, task.id, seenProofIds));
    if (task.status === 'active') activeCount += 1;
    tasksById.set(task.id, task);
  }

  assert(activeCount <= 1, `scope ${graph.scope} has ${activeCount} active tasks; only one writer-owned task may be active`);

  for (const task of graph.tasks) {
    for (const dependencyId of task.dependsOn) {
      assert(dependencyId !== task.id, `${task.id} cannot depend on itself`);
      assert(tasksById.has(dependencyId), `${task.id} depends on unknown task ${dependencyId}`);
    }
  }

  detectCycles(tasksById);

  for (const task of graph.tasks) {
    if (ACTIONABLE_STATUSES.has(task.status)) {
      assert(dependenciesComplete(task, tasksById), `${task.id} is ${task.status} before all dependencies are verified or archived`);
    }
  }

  const requiredProofs = graph.tasks.reduce(
    (count, task) => count + task.proofs.filter(proof => proof.required).length,
    0,
  );

  return {
    scope: graph.scope,
    taskCount: graph.tasks.length,
    activeTask: graph.tasks.find(task => task.status === 'active')?.id ?? null,
    requiredProofs,
  };
}

export function selectNextTask(graph) {
  validateTaskGraph(graph);
  const tasksById = new Map(graph.tasks.map(task => [task.id, task]));
  const active = graph.tasks.find(task => task.status === 'active');
  if (active) return active;

  const candidates = graph.tasks
    .filter(task => ['ready', 'planned', 'failed_retryable'].includes(task.status))
    .filter(task => dependenciesComplete(task, tasksById))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  return candidates[0] ?? null;
}

export async function loadTaskGraph(graphPath = resolve('agent/task-graph.json')) {
  const raw = await readFile(graphPath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const graphPath = process.argv[2] ? resolve(process.argv[2]) : resolve('agent/task-graph.json');
  const graph = await loadTaskGraph(graphPath);
  const summary = validateTaskGraph(graph);
  console.log(`AGENT_TASK_GRAPH_VALID scope=${summary.scope} tasks=${summary.taskCount} active=${summary.activeTask ?? 'none'} requiredProofs=${summary.requiredProofs}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`AGENT_TASK_GRAPH_INVALID ${error.message}`);
    process.exitCode = 1;
  });
}
