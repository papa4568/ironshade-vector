import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Exact paths for the evidence-led iteration feature. Do not turn this into
// an uncalibrated heuristic over unrelated product/Android infrastructure.
const ITERATION_PROCESS_PATHS = new Set([
  'tools/iteration-preflight.mjs',
  'tools/review-scope.mjs',
  'tests/iteration-preflight.mjs',
  'tests/review-scope.mjs',
  '.github/workflows/iteration-preflight.yml',
  'docs/engineering-iteration-playbook.md',
]);

export function requiresOrchestrationReview(changedFiles) {
  assert(Array.isArray(changedFiles) && changedFiles.length > 0, 'changed file inventory is required');
  return changedFiles.some(path => ITERATION_PROCESS_PATHS.has(path));
}

export function verifyReviewScope(changedFiles, selection) {
  assert(selection && typeof selection === 'object', 'review-task selection is required');
  assert(typeof selection.taskId === 'string' && typeof selection.mode === 'string', 'review-task selection is malformed');
  const processChange = requiresOrchestrationReview(changedFiles);
  if (processChange) {
    assert(/^AO-\d+$/.test(selection.taskId), 'iteration-process changes require an AO task, not ' + selection.taskId);
    assert(selection.mode === 'orchestration' || selection.mode === 'orchestration-closeout',
      'iteration-process changes require an active or closing AO review, not ' + selection.mode);
    assert(selection.source === 'agent/task-graph.json', 'AO review must resolve from the authoritative task graph');
  }
  return { processChange, taskId: selection.taskId, mode: selection.mode };
}

export function collectReviewChangedFiles({ base, head, cwd = process.cwd() }) {
  assert(base && head, 'both Git comparison refs are required');
  // Do not omit deletions or rename sources. A process rule must still apply
  // if its own protected document or tool is deleted/moved out of scope.
  return execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base + '...' + head], {
    cwd, encoding: 'utf8',
  }).split('\0').filter(Boolean);
}

export function parseReviewScopeArguments(argv) {
  let base = null;
  let head = null;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--base' && !base) base = argv[++index] ?? null;
    else if (argv[index] === '--head' && !head) head = argv[++index] ?? null;
    else throw new Error('expected one --base and one --head');
  }
  assert(base && head && !base.startsWith('--') && !head.startsWith('--'), 'both --base and --head refs are required');
  return { base, head };
}

async function main() {
  const { base, head } = parseReviewScopeArguments(process.argv.slice(2));
  const files = collectReviewChangedFiles({ base, head });
  const { selectReviewTask } = await import('../agent/tools/select-review-task.mjs');
  const selection = await selectReviewTask({ baseRef: base, headRef: head, useEventRefs: false });
  const outcome = verifyReviewScope(files, selection);
  console.log('REVIEW_SCOPE_PASS ' + JSON.stringify(outcome));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error('REVIEW_SCOPE_ERROR ' + error.message); process.exitCode = 1; });
}
