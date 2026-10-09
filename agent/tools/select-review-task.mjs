import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { loadRoadmapAdapter, selectNextRoadmapTask } from './roadmap-adapter.mjs';
import { loadTaskGraph, validateTaskGraph } from './validate-task-graph.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadTaskGraphAtRef(ref) {
  assert(typeof ref === 'string' && ref.trim().length > 0, 'task-graph git ref must be a non-empty string');
  const raw = execFileSync('git', ['show', `${ref}:agent/task-graph.json`], { encoding: 'utf8' });
  const graph = JSON.parse(raw);
  validateTaskGraph(graph);
  return graph;
}

function githubPullRequestRefs() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return { baseRef: null, headRef: null };
  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    return {
      baseRef: event.pull_request?.base?.sha ?? null,
      headRef: event.pull_request?.head?.sha ?? null,
    };
  } catch {
    return { baseRef: null, headRef: null };
  }
}

export function selectOrchestrationReviewTask(currentGraph, { baseGraph = null } = {}) {
  validateTaskGraph(currentGraph);
  const inFlight = currentGraph.tasks.find(task => task.status === 'active' || task.status === 'verifying');
  if (inFlight) return { task: inFlight, mode: 'orchestration' };

  if (!baseGraph) return null;
  validateTaskGraph(baseGraph);
  const baseById = new Map(baseGraph.tasks.map(task => [task.id, task]));
  const transitioned = currentGraph.tasks.filter(task => {
    if (task.status !== 'verified') return false;
    const baseTask = baseById.get(task.id);
    return baseTask && !['verified', 'archived'].includes(baseTask.status);
  });
  assert(transitioned.length <= 1, `multiple AO tasks transitioned to verified in one candidate: ${transitioned.map(task => task.id).join(', ')}`);
  return transitioned.length === 1 ? { task: transitioned[0], mode: 'orchestration-closeout' } : null;
}

export async function selectReviewTask({ baseRef = null, headRef = null } = {}) {
  if (!baseRef && !headRef) {
    const eventRefs = githubPullRequestRefs();
    baseRef = eventRefs.baseRef;
    headRef = eventRefs.headRef;
  }
  const currentGraph = headRef ? loadTaskGraphAtRef(headRef) : await loadTaskGraph();
  const baseGraph = baseRef ? loadTaskGraphAtRef(baseRef) : null;
  const orchestration = selectOrchestrationReviewTask(currentGraph, { baseGraph });
  if (orchestration) {
    return {
      taskId: orchestration.task.id,
      source: 'agent/task-graph.json',
      mode: orchestration.mode,
    };
  }

  const { graph } = await loadRoadmapAdapter();
  const productTask = selectNextRoadmapTask(graph);
  if (!productTask) throw new Error('no active orchestration task or executable product-roadmap task is available for independent review');
  return { taskId: productTask.id, source: 'docs/content-roadmap.md', mode: 'product' };
}

async function main() {
  const args = process.argv.slice(2);
  let baseRef = null;
  let headRef = null;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--base') baseRef = args[++index];
    else if (arg === '--head') headRef = args[++index];
    else if (arg === '--json') json = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  const selection = await selectReviewTask({ baseRef, headRef });
  if (json) console.log(JSON.stringify(selection, null, 2));
  else console.log(`INDEPENDENT_REVIEW_TASK task=${selection.taskId} mode=${selection.mode} source=${selection.source}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
