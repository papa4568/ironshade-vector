import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const TASK_LINE = /^- \[ \] \*\*(EV-\d+) — (.+?)\*\*\s*$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export const EXPERIMENTAL_PROMOTION_PROOFS = Object.freeze([
  Object.freeze({ id: 'experimental-regressions', kind: 'test', required: true, description: 'Promotion-specific regressions and measured false-positive/false-negative evidence pass for the exact promoted scope.' }),
  Object.freeze({ id: 'production-build', kind: 'build', required: true, description: 'The exact candidate passes the repository production build/full verification.' }),
  Object.freeze({ id: 'candidate-ci', kind: 'ci', required: true, description: 'Agent Orchestration and PR Candidate Verification technical gates pass on the exact candidate revision.' }),
  Object.freeze({ id: 'android-apk', kind: 'artifact', required: true, description: 'The exact candidate produces and validates the repository Android APK and required Android smoke evidence.' }),
  Object.freeze({ id: 'architecture-invariants', kind: 'invariant', required: true, description: 'Mechanical architecture invariants pass and the promotion does not weaken existing proof obligations.' }),
  Object.freeze({ id: 'independent-review', kind: 'review', required: true, description: 'A separate trusted read-only verifier passes the exact promotion candidate after attempting to falsify every acceptance criterion.' }),
]);

function cloneProofs() {
  return EXPERIMENTAL_PROMOTION_PROOFS.map(proof => ({ ...proof }));
}

export function parseExperimentalRoadmap(markdown) {
  assert(typeof markdown === 'string' && markdown.trim(), 'experimental roadmap markdown must be non-empty');
  const tasks = [];
  let current = null;
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const taskMatch = line.match(TASK_LINE);
    if (taskMatch) {
      if (current) {
        assert(current.acceptance.length > 0, `${current.id} must contain at least one indented acceptance bullet`);
        tasks.push(current);
      }
      current = {
        id: taskMatch[1],
        title: taskMatch[2].trim(),
        acceptance: [],
        roadmapLine: index + 1,
      };
      continue;
    }
    if (!current) continue;
    if (/^- \[ \] \*\*EV-\d+/.test(line)) throw new Error(`malformed experimental task line at ${index + 1}`);
    const bullet = line.match(/^  - (.+)$/);
    if (bullet) {
      current.acceptance.push(bullet[1].trim());
      continue;
    }
    if (line.startsWith('## ') || line.startsWith('- [ ] **')) {
      assert(current.acceptance.length > 0, `${current.id} must contain at least one indented acceptance bullet`);
      tasks.push(current);
      current = null;
    }
  }
  if (current) {
    assert(current.acceptance.length > 0, `${current.id} must contain at least one indented acceptance bullet`);
    tasks.push(current);
  }
  const ids = tasks.map(task => task.id);
  assert(new Set(ids).size === ids.length, 'experimental roadmap contains duplicate active EV task IDs');
  return tasks;
}

export function materializeExperimentalTasks(markdown) {
  return parseExperimentalRoadmap(markdown).map((task, index) => ({
    id: task.id,
    title: task.title,
    priority: index,
    status: index === 0 ? 'ready' : 'planned',
    dependsOn: [],
    acceptance: [...task.acceptance],
    affectedDomains: ['agent-orchestration', 'verification'],
    proofs: cloneProofs(),
    externalDependencies: [],
    notes: `Derived from docs/experimental-verification-roadmap.md line ${task.roadmapLine}; Markdown order and acceptance remain authoritative.`,
  }));
}

export function selectExperimentalReviewTask(headMarkdown, { baseMarkdown = null } = {}) {
  const headTasks = materializeExperimentalTasks(headMarkdown);
  const headFirst = headTasks[0] ?? null;
  if (!baseMarkdown) return headFirst ? { task: headFirst, mode: 'experimental' } : null;

  const baseTasks = materializeExperimentalTasks(baseMarkdown);
  const baseFirst = baseTasks[0] ?? null;
  if (baseFirst && !headTasks.some(task => task.id === baseFirst.id)) {
    const expectedIds = baseTasks.slice(1).map(task => task.id);
    const headIds = headTasks.map(task => task.id);
    assert(
      JSON.stringify(headIds) === JSON.stringify(expectedIds),
      `experimental closeout for ${baseFirst.id} must remove only the first executable EV item without reordering or combining promotion changes`,
    );
    return { task: baseFirst, mode: 'experimental-closeout' };
  }

  const removed = baseTasks.map(task => task.id).filter(id => !headTasks.some(task => task.id === id));
  assert(removed.length === 0, `experimental roadmap removed non-current task(s): ${removed.join(', ')}`);
  return headFirst ? { task: headFirst, mode: 'experimental' } : null;
}

export async function loadExperimentalRoadmap(path = resolve('docs/experimental-verification-roadmap.md')) {
  return readFile(path, 'utf8');
}
