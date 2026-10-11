import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { selectExperimentalReviewTask } from './experimental-review-task.mjs';
import {
  loadRoadmapAdapter,
  materializeRoadmapGraph,
  parseRoadmap,
  selectNextRoadmapTask,
} from './roadmap-adapter.mjs';
import { loadTaskGraph, validateTaskGraph } from './validate-task-graph.mjs';

const EXPERIMENTAL_PROMOTION_PATHS = new Set([
  'agent/acceptance-attack-policy.json',
  'agent/tools/acceptance-attack-enforcer.mjs',
  'agent/tests/acceptance-attack-enforcer.mjs',
]);

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

function loadRoadmapGraphAtRef(ref) {
  assert(typeof ref === 'string' && ref.trim().length > 0, 'roadmap git ref must be a non-empty string');
  const metadataRaw = execFileSync('git', ['show', `${ref}:agent/roadmap-metadata.json`], { encoding: 'utf8' });
  const metadata = JSON.parse(metadataRaw);
  assert(metadata?.roadmap === 'docs/content-roadmap.md', 'roadmap metadata must point to docs/content-roadmap.md');
  const roadmapRaw = execFileSync('git', ['show', `${ref}:docs/content-roadmap.md`], { encoding: 'utf8' });
  return materializeRoadmapGraph(parseRoadmap(roadmapRaw), metadata);
}

function loadExperimentalRoadmapAtRef(ref) {
  assert(typeof ref === 'string' && ref.trim().length > 0, 'experimental roadmap git ref must be a non-empty string');
  return execFileSync('git', ['show', `${ref}:docs/experimental-verification-roadmap.md`], { encoding: 'utf8' });
}

function changedFilesBetweenRefs(baseRef, headRef) {
  const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACDMR', `${baseRef}...${headRef}`], { encoding: 'utf8' });
  return [...new Set(output.split(/\r?\n/).map(entry => entry.trim()).filter(Boolean))].sort();
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

function isExperimentalPromotionCandidate(changedFiles) {
  return changedFiles.includes('docs/experimental-verification-roadmap.md')
    || changedFiles.some(path => EXPERIMENTAL_PROMOTION_PATHS.has(path));
}

export function selectProductReviewTask(currentGraph, { baseGraph = null } = {}) {
  validateTaskGraph(currentGraph);
  if (!baseGraph) {
    const task = selectNextRoadmapTask(currentGraph);
    return task ? { task, mode: 'product' } : null;
  }

  validateTaskGraph(baseGraph);
  const baseIds = baseGraph.tasks.map(task => task.id);
  const currentIds = currentGraph.tasks.map(task => task.id);
  const baseFirst = baseGraph.tasks[0] ?? null;
  if (baseFirst && !currentIds.includes(baseFirst.id)) {
    const expectedIds = baseIds.slice(1);
    assert(
      JSON.stringify(currentIds) === JSON.stringify(expectedIds),
      `product closeout for ${baseFirst.id} must remove only the first executable roadmap item without reordering or combining roadmap changes`,
    );
    return { task: baseFirst, mode: 'product-closeout' };
  }

  const removed = baseIds.filter(id => !currentIds.includes(id));
  assert(removed.length === 0, `product roadmap removed non-current task(s): ${removed.join(', ')}`);
  const task = selectNextRoadmapTask(currentGraph);
  return task ? { task, mode: 'product' } : null;
}

export async function selectReviewTask({ baseRef = null, headRef = null, useEventRefs = true } = {}) {
  if (useEventRefs && !baseRef && !headRef) {
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

  if (baseRef && headRef) {
    const changedFiles = changedFilesBetweenRefs(baseRef, headRef);
    if (isExperimentalPromotionCandidate(changedFiles)) {
      const experimental = selectExperimentalReviewTask(
        loadExperimentalRoadmapAtRef(headRef),
        { baseMarkdown: loadExperimentalRoadmapAtRef(baseRef) },
      );
      assert(experimental, 'experimental promotion candidate has no executable EV task');
      return {
        taskId: experimental.task.id,
        source: 'docs/experimental-verification-roadmap.md',
        mode: experimental.mode,
      };
    }
  }

  let product;
  if (headRef) {
    const currentRoadmapGraph = loadRoadmapGraphAtRef(headRef);
    const baseRoadmapGraph = baseRef ? loadRoadmapGraphAtRef(baseRef) : null;
    product = selectProductReviewTask(currentRoadmapGraph, { baseGraph: baseRoadmapGraph });
  } else {
    const { graph } = await loadRoadmapAdapter();
    product = selectProductReviewTask(graph);
  }

  if (!product) throw new Error('no active orchestration task, selected experimental promotion, or executable product-roadmap task is available for independent review');
  return { taskId: product.task.id, source: 'docs/content-roadmap.md', mode: product.mode };
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
