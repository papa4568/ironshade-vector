import { resolve } from 'node:path';
import { loadTaskGraph, selectNextTask } from './validate-task-graph.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const pathArg = args.find(arg => arg !== '--json');
const graph = await loadTaskGraph(pathArg ? resolve(pathArg) : undefined);
const task = selectNextTask(graph);

if (!task) {
  if (json) console.log(JSON.stringify({ task: null }));
  else console.log('AGENT_NEXT_TASK_NONE');
  process.exit(0);
}

if (json) {
  console.log(JSON.stringify({
    task: {
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      dependsOn: task.dependsOn,
      affectedDomains: task.affectedDomains,
      acceptance: task.acceptance,
      requiredProofs: task.proofs.filter(proof => proof.required),
    },
  }, null, 2));
} else {
  console.log(`AGENT_NEXT_TASK id=${task.id} priority=${task.priority} status=${task.status} title=${JSON.stringify(task.title)}`);
}
