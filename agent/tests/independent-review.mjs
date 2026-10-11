import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildIndependentReviewPacket,
  validateIndependentReviewPacket,
  validateIndependentReviewResult,
} from '../tools/independent-review.mjs';
import { extractReviewResult, selectAuthoritativeReviewComment } from '../tools/review-comment-gate.mjs';
import { loadRoadmapAdapter } from '../tools/roadmap-adapter.mjs';
import {
  selectOrchestrationReviewTask,
  selectProductReviewTask,
  selectReviewTask,
} from '../tools/select-review-task.mjs';
import { sha256Value } from '../tools/candidate-evidence.mjs';

const acceptance = ['criterion one', 'criterion two'];
const manifest = {
  schemaVersion: 1,
  repository: 'papa4568/ironshade-vector',
  task: {
    id: 'AO-6',
    title: 'Independent review',
    source: 'agent/task-graph.json',
    acceptanceDigest: sha256Value(acceptance),
    affectedDomains: ['agent-orchestration', 'review'],
  },
  candidate: {
    baseSha: 'b'.repeat(40),
    headSha: 'a'.repeat(40),
    branch: 'chatgpt/ao6',
  },
  changedFiles: ['agent/file.mjs'],
  impact: {
    mode: 'full',
    escalated: true,
    domains: ['agent-orchestration'],
    verificationIds: ['full-verification'],
    unknownFiles: [],
    escalationReasons: ['test fixture'],
  },
  requiredProofs: [
    { id: 'review-contract', kind: 'review', required: true, description: 'review' },
    { id: 'architecture-invariants', kind: 'invariant', required: true, description: 'architecture' },
  ],
  externalQaRefs: [],
};
const task = { acceptance };
const architectureResults = [
  { id: 'renderer-boundary', status: 'passed', file: 'renderer.ts', type: 'sourceContract' },
];

const packet = buildIndependentReviewPacket({ manifest, task, architectureResults });
validateIndependentReviewPacket(packet);
assert.equal(packet.mutationsAllowed, false);
assert.equal(packet.acceptance.length, 2);

const pass = {
  schemaVersion: 1,
  taskId: 'AO-6',
  candidateSha: 'a'.repeat(40),
  mode: 'read-only-adversarial',
  verdict: 'pass',
  acceptanceChecks: [
    { index: 0, status: 'satisfied', notes: 'evidence checked' },
    { index: 1, status: 'satisfied', notes: 'evidence checked' },
  ],
  proofChecks: [
    { proofId: 'review-contract', status: 'credible', notes: 'contract exercised' },
    { proofId: 'architecture-invariants', status: 'credible', notes: 'checks passed' },
  ],
  findings: [
    { severity: 'minor', summary: 'non-blocking note', evidence: ['review packet'] },
  ],
};
assert.deepEqual(validateIndependentReviewResult(packet, pass), { verdict: 'pass', findingCount: 1 });

const badPass = structuredClone(pass);
badPass.acceptanceChecks[1].status = 'not_satisfied';
assert.throws(() => validateIndependentReviewResult(packet, badPass), /pass verdict cannot contain unsatisfied/);

const fail = structuredClone(pass);
fail.verdict = 'fail';
fail.acceptanceChecks[1].status = 'not_satisfied';
fail.findings = [
  { severity: 'major', summary: 'acceptance unsupported', evidence: ['criterion 1'] },
];
assert.equal(validateIndependentReviewResult(packet, fail).verdict, 'fail');

const crossSha = structuredClone(pass);
crossSha.candidateSha = 'c'.repeat(40);
assert.throws(() => validateIndependentReviewResult(packet, crossSha), /candidateSha does not match/);

const envelope = `<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(pass)}\n\`\`\``;
assert.equal(extractReviewResult(envelope).candidateSha, packet.candidateSha);

const comments = [
  {
    id: 1,
    created_at: '2026-10-09T10:00:00Z',
    author_association: 'NONE',
    user: { login: 'untrusted' },
    body: envelope,
  },
  {
    id: 2,
    created_at: '2026-10-09T10:01:00Z',
    author_association: 'OWNER',
    user: { login: 'independent-owner' },
    body: envelope,
  },
];
const humanReviewOptions = { prAuthor: 'implementation-owner' };
const selected = selectAuthoritativeReviewComment(packet, comments, humanReviewOptions);
assert.equal(selected.commentId, 2);
assert.equal(selected.reviewer, 'independent-owner');

const selfAuthoredPass = {
  ...comments[1],
  id: 3,
  created_at: '2026-10-09T10:02:00Z',
  user: { login: 'IMPLEMENTATION-OWNER' },
};
assert.throws(
  () => selectAuthoritativeReviewComment(packet, [selfAuthoredPass], humanReviewOptions),
  /no trusted independent review result/,
);
const selectedIgnoringLaterSelfReview = selectAuthoritativeReviewComment(
  packet,
  [...comments, selfAuthoredPass],
  humanReviewOptions,
);
assert.equal(selectedIgnoringLaterSelfReview.commentId, 2);
assert.equal(selectedIgnoringLaterSelfReview.reviewer, 'independent-owner');

const stale = structuredClone(pass);
stale.candidateSha = 'c'.repeat(40);
assert.throws(
  () => selectAuthoritativeReviewComment(
    packet,
    [{ ...comments[1], body: `<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(stale)}\n\`\`\`` }],
    humanReviewOptions,
  ),
  /no trusted independent review result/,
);

const latestFail = structuredClone(fail);
const failEnvelope = `<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(latestFail)}\n\`\`\``;
assert.throws(
  () => selectAuthoritativeReviewComment(
    packet,
    [...comments, { ...comments[1], id: 4, created_at: '2026-10-09T10:03:00Z', body: failEnvelope }],
    humanReviewOptions,
  ),
  /latest independent review verdict.*fail/,
);

const currentGraph = JSON.parse(readFileSync('agent/task-graph.json', 'utf8'));
const activeTask = currentGraph.tasks.find(entry => entry.status === 'active' || entry.status === 'verifying');
assert(activeTask, 'review-selection fixture requires one in-flight AO task');
const inFlightSelection = await selectReviewTask({ useEventRefs: false });
assert.equal(inFlightSelection.taskId, activeTask.id, 'review selection must target the actual in-flight AO task rather than a historical task ID');
assert.equal(inFlightSelection.mode, 'orchestration');
assert.equal(inFlightSelection.source, 'agent/task-graph.json');

const closeoutCurrentGraph = structuredClone(currentGraph);
const closeoutBaseGraph = structuredClone(currentGraph);
for (const entry of closeoutCurrentGraph.tasks) {
  if (entry.status === 'active' || entry.status === 'verifying') entry.status = 'planned';
}
for (const entry of closeoutBaseGraph.tasks) {
  if (entry.status === 'active' || entry.status === 'verifying') entry.status = 'planned';
}
const currentAo6 = closeoutCurrentGraph.tasks.find(entry => entry.id === 'AO-6');
const baseAo6 = closeoutBaseGraph.tasks.find(entry => entry.id === 'AO-6');
assert.equal(currentAo6.status, 'verified', 'AO-6 closeout fixture must carry its verified state');
baseAo6.status = 'active';
const closeoutSelection = selectOrchestrationReviewTask(closeoutCurrentGraph, { baseGraph: closeoutBaseGraph });
assert.equal(closeoutSelection.task.id, 'AO-6');
assert.equal(closeoutSelection.mode, 'orchestration-closeout');

const postMigrationGraph = structuredClone(currentGraph);
for (const entry of postMigrationGraph.tasks) {
  if (entry.status === 'active' || entry.status === 'verifying') entry.status = 'verified';
}
const unchangedPostMigrationBase = structuredClone(postMigrationGraph);
assert.equal(selectOrchestrationReviewTask(postMigrationGraph, { baseGraph: unchangedPostMigrationBase }), null, 'without an active or closing AO task orchestration selection must fall through');

const { graph: currentProductGraph } = await loadRoadmapAdapter();
const productFallbackSelection = selectProductReviewTask(currentProductGraph);
assert.equal(productFallbackSelection.mode, 'product', 'after AO work is no longer in flight, review selection must fall back to product work');
assert.equal(productFallbackSelection.task.id, currentProductGraph.tasks[0].id);

const productCloseoutGraph = structuredClone(currentProductGraph);
const completedProductTask = productCloseoutGraph.tasks.shift();
assert(completedProductTask, 'product closeout fixture requires at least one live product task');
productCloseoutGraph.tasks.forEach((entry, index) => {
  entry.priority = index;
  entry.status = index === 0 ? 'ready' : 'planned';
  entry.dependsOn = entry.dependsOn.filter(dependencyId => dependencyId !== completedProductTask.id);
});
const productCloseoutSelection = selectProductReviewTask(productCloseoutGraph, { baseGraph: currentProductGraph });
assert.equal(productCloseoutSelection.task.id, completedProductTask.id, 'product closeout must preserve the removed task identity');
assert.equal(productCloseoutSelection.mode, 'product-closeout');

const combinedProductCloseout = structuredClone(productCloseoutGraph);
combinedProductCloseout.tasks.shift();
combinedProductCloseout.tasks.forEach((entry, index) => {
  entry.priority = index;
  entry.status = index === 0 ? 'ready' : 'planned';
});
assert.throws(
  () => selectProductReviewTask(combinedProductCloseout, { baseGraph: currentProductGraph }),
  /must remove only the first executable roadmap item/,
  'product closeout must reject combining multiple roadmap completions',
);

const selectorSource = readFileSync('agent/tools/select-review-task.mjs', 'utf8');
assert.match(selectorSource, /GITHUB_EVENT_PATH/, 'PR review selection must inspect the exact pull-request base and head refs');
assert.match(selectorSource, /orchestration-closeout/, 'review selection must preserve a just-verified AO task as the closeout review target');
assert.match(selectorSource, /product-closeout/, 'review selection must preserve a just-completed product task as the closeout review target');
assert.doesNotMatch(selectorSource, /orchestration-maintenance/, 'verified AO tasks must not override the required product fallback through a maintenance shortcut');

const candidateEvidenceSource = readFileSync('agent/tools/candidate-evidence.mjs', 'utf8');
assert.match(candidateEvidenceSource, /baseRef/, 'candidate evidence must be able to recover a completed product task from the exact base roadmap');
assert.match(candidateEvidenceSource, /loadProductTaskAtRef/, 'product closeout evidence must use an exact git-ref task contract');

const independentReviewSource = readFileSync('agent/tools/independent-review.mjs', 'utf8');
assert.match(independentReviewSource, /baseRef: candidateManifest\.candidate\.baseSha/, 'review packet generation must preserve the base product task contract after closeout');

const workflow = readFileSync('.github/workflows/pr-candidate.yml', 'utf8');
assert.match(workflow, /independent-review-context:/, 'PR candidate workflow must provide a separate review context job');
assert.match(workflow, /name: Independent Review Context/);
assert.match(workflow, /persist-credentials: false/, 'review checkout must not retain repository write credentials');
assert.match(workflow, /node agent\/tools\/select-review-task\.mjs/, 'review flow must resolve its task through the closeout-aware selector');
assert.match(workflow, /node agent\/tools\/independent-review\.mjs packet/, 'review context must generate the machine-readable packet');
assert.match(workflow, /node agent\/tools\/review-comment-gate\.mjs gate/, 'final candidate workflow must require an actual review result');
assert.match(workflow, /gh api --paginate/, 'final candidate workflow must read PR conversation evidence');
assert.match(workflow, /issues: read/, 'workflow must only request read access to PR conversation evidence');
assert.match(workflow, /--pass-kinds test,build,ci,artifact,review,invariant/, 'final evidence must not credit review until the gate passes and must cover product proof kinds');

const gateSource = readFileSync('agent/tools/review-comment-gate.mjs', 'utf8');
assert.match(gateSource, /GITHUB_EVENT_PATH/, 'final gate must derive the PR author from the trusted GitHub pull-request event');
assert.match(gateSource, /pull_request\?\.user\?\.login/, 'final gate must bind human-review eligibility to the PR author identity');

const verifierContract = readFileSync('agent/INDEPENDENT_VERIFIER.md', 'utf8');
assert.match(verifierContract, /read-only adversarial verifier/i);
assert.match(verifierContract, /Do not implement fixes/);
assert.match(verifierContract, /same branch/);
assert.match(verifierContract, /ironshade-independent-review:v1/);
assert.match(verifierContract, /different GitHub account from the pull request author/i);

console.log('INDEPENDENT_REVIEW_TEST_PASS');
