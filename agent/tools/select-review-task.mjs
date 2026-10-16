import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  parseExperimentalRoadmap,
  selectExperimentalReviewTask,
} from './experimental-review-task.mjs';
import {
  loadRoadmapAdapter,
  materializeRoadmapGraph,
  parseRoadmap,
  selectNextRoadmapTask,
} from './roadmap-adapter.mjs';
import { loadTaskGraph, validateTaskGraph } from './validate-task-graph.mjs';

const PINNED_EXPERIMENTAL_IMPLEMENTATIONS = Object.freeze({
  'EV-18': Object.freeze({
    referenceSha: '0d996b64ac47306a244fcd67e938b937910f3d85',
    changedFiles: Object.freeze([
      '.github/workflows/ev18-proof-cache-promotion.yml',
      '.github/workflows/ev21-proof-cache-closure-calibration.yml',
      '.github/workflows/pr-candidate.yml',
      'AGENTS.md',
      'agent/proof-cache-promotion-policy.json',
      'agent/proof-cache-promotion-policy.schema.json',
      'agent/tests/ci-proof-reuse.mjs',
      'agent/tests/pr-candidate-head-observer.mjs',
      'agent/tests/proof-cache-promotion.mjs',
      'agent/tools/pr-candidate-head-observer.mjs',
      'agent/tools/proof-cache-promotion.mjs',
    ].sort()),
  }),
});

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
  assert(typeof ref === 'string' && ref.trim().length > 0, 'experimental-roadmap git ref must be a non-empty string');
  return execFileSync('git', ['show', `${ref}:docs/experimental-verification-roadmap.md`], { encoding: 'utf8' });
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

function experimentalContract(markdown) {
  return parseExperimentalRoadmap(markdown).map(task => ({
    id: task.id,
    title: task.title,
    acceptance: [...task.acceptance],
  }));
}

function changedFilesBetween(baseRef, headRef) {
  const raw = execFileSync('git', ['diff', '--name-only', '-z', baseRef, headRef], { encoding: 'utf8' });
  return raw.split('\0').filter(Boolean).sort();
}

function blobAtRef(ref, path) {
  return execFileSync('git', ['rev-parse', `${ref}:${path}`], { encoding: 'utf8' }).trim();
}

export function matchPinnedExperimentalImplementation(
  taskId,
  changedFiles,
  { headBlobByPath = new Map(), referenceBlobByPath = new Map() } = {},
) {
  const transition = PINNED_EXPERIMENTAL_IMPLEMENTATIONS[taskId];
  if (!transition) return false;
  const actual = [...changedFiles].sort();
  const expected = [...transition.changedFiles];
  const hasEveryExpectedPath = expected.every(path => actual.includes(path));
  if (!hasEveryExpectedPath) return false;
  assert(
    actual.length === expected.length && actual.every((path, index) => path === expected[index]),
    `pinned experimental implementation ${taskId} must change exactly its reviewed transition paths`,
  );
  for (const path of expected) {
    const headBlob = headBlobByPath.get(path);
    const referenceBlob = referenceBlobByPath.get(path);
    assert(typeof headBlob === 'string' && headBlob.length > 0, `pinned experimental implementation ${taskId} is missing head blob identity for ${path}`);
    assert(typeof referenceBlob === 'string' && referenceBlob.length > 0, `pinned experimental implementation ${taskId} is missing reference blob identity for ${path}`);
    assert(headBlob === referenceBlob, `pinned experimental implementation ${taskId} drifted from reviewed reference at ${path}`);
  }
  return true;
}

export function selectPinnedExperimentalImplementationReviewTask(baseMarkdown, { baseRef, headRef } = {}) {
  if (!baseRef || !headRef) return null;
  const active = selectExperimentalReviewTask(baseMarkdown);
  if (!active) return null;
  const transition = PINNED_EXPERIMENTAL_IMPLEMENTATIONS[active.task.id];
  if (!transition) return null;
  const changedFiles = changedFilesBetween(baseRef, headRef);
  const hasEveryExpectedPath = transition.changedFiles.every(path => changedFiles.includes(path));
  if (!hasEveryExpectedPath) return null;
  const headBlobByPath = new Map();
  const referenceBlobByPath = new Map();
  for (const path of transition.changedFiles) {
    headBlobByPath.set(path, blobAtRef(headRef, path));
    referenceBlobByPath.set(path, blobAtRef(transition.referenceSha, path));
  }
  if (!matchPinnedExperimentalImplementation(active.task.id, changedFiles, { headBlobByPath, referenceBlobByPath })) return null;
  return { task: active.task, mode: 'experimental' };
}

export function selectExperimentalCandidateReviewTask(headMarkdown, { baseMarkdown = null } = {}) {
  if (!baseMarkdown) return null;
  const headContract = experimentalContract(headMarkdown);
  const baseContract = experimentalContract(baseMarkdown);
  if (JSON.stringify(headContract) === JSON.stringify(baseContract)) return null;
  return selectExperimentalReviewTask(headMarkdown, { baseMarkdown });
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
    return !baseTask || !['verified', 'archived'].includes(baseTask.status);
  });
  assert(transitioned.length <= 1, `multiple AO tasks entered verified state in one candidate: ${transitioned.map(task => task.id).join(', ')}`);
  return transitioned.length === 1 ? { task: transitioned[0], mode: 'orchestration-closeout' } : null;
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

  if (headRef && baseRef) {
    const headExperimentalRoadmap = loadExperimentalRoadmapAtRef(headRef);
    const baseExperimentalRoadmap = loadExperimentalRoadmapAtRef(baseRef);
    const experimental = selectExperimentalCandidateReviewTask(
      headExperimentalRoadmap,
      { baseMarkdown: baseExperimentalRoadmap },
    ) ?? selectPinnedExperimentalImplementationReviewTask(baseExperimentalRoadmap, { baseRef, headRef });
    if (experimental) {
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

  if (!product) throw new Error('no active orchestration task, authenticated experimental promotion transition, changed experimental promotion contract, or executable product-roadmap task is available for independent review');
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
