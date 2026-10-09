import { pathToFileURL } from 'node:url';

import { loadRoadmapAdapter, selectNextRoadmapTask } from './roadmap-adapter.mjs';
import { loadTaskGraph, validateTaskGraph } from './validate-task-graph.mjs';

export async function selectReviewTask() {
  const orchestrationGraph = await loadTaskGraph();
  validateTaskGraph(orchestrationGraph);
  const orchestrationTask = orchestrationGraph.tasks.find(task => task.status === 'active' || task.status === 'verifying');
  if (orchestrationTask) {
    return { taskId: orchestrationTask.id, source: 'agent/task-graph.json', mode: 'orchestration' };
  }

  const { graph } = await loadRoadmapAdapter();
  const productTask = selectNextRoadmapTask(graph);
  if (!productTask) throw new Error('no active orchestration task or executable product-roadmap task is available for independent review');
  return { taskId: productTask.id, source: 'docs/content-roadmap.md', mode: 'product' };
}

async function main() {
  const selection = await selectReviewTask();
  if (process.argv.includes('--json')) console.log(JSON.stringify(selection, null, 2));
  else console.log(`INDEPENDENT_REVIEW_TASK task=${selection.taskId} mode=${selection.mode} source=${selection.source}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
