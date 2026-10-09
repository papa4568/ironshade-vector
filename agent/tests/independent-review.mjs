import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildIndependentReviewPacket,
  validateIndependentReviewPacket,
  validateIndependentReviewResult,
} from '../tools/independent-review.mjs';
import { extractReviewResult, selectAuthoritativeReviewComment } from '../tools/review-comment-gate.mjs';
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
    user: { login: 'owner' },
    body: envelope,
  },
];
const selected = selectAuthoritativeReviewComment(packet, comments);
assert.equal(selected.commentId, 2);
assert.equal(selected.reviewer, 'owner');

const stale = structuredClone(pass);
stale.candidateSha = 'c'.repeat(40);
assert.throws(
  () => selectAuthoritativeReviewComment(packet, [{ ...comments[1], body: `<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(stale)}\n\`\`\`` }]),
  /no trusted independent review result/,
);

const latestFail = structuredClone(fail);
const failEnvelope = `<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(latestFail)}\n\`\`\``;
assert.throws(
  () => selectAuthoritativeReviewComment(packet, [...comments, { ...comments[1], id: 3, created_at: '2026-10-09T10:02:00Z', body: failEnvelope }]),
  /latest independent review verdict.*fail/,
);

const workflow = readFileSync('.github/workflows/pr-candidate.yml', 'utf8');
assert.match(workflow, /independent-review-context:/, 'PR candidate workflow must provide a separate review context job');
assert.match(workflow, /name: Independent Review Context/);
assert.match(workflow, /persist-credentials: false/, 'review checkout must not retain repository write credentials');
assert.match(workflow, /node agent\/tools\/independent-review\.mjs packet/, 'review context must generate the machine-readable packet');
assert.match(workflow, /node agent\/tools\/review-comment-gate\.mjs gate/, 'final candidate workflow must require an actual review result');
assert.match(workflow, /gh api --paginate/, 'final candidate workflow must read PR conversation evidence');
assert.match(workflow, /issues: read/, 'workflow must only request read access to PR conversation evidence');
assert.match(workflow, /--pass-kinds test,build,ci,artifact,review,invariant/, 'final evidence must not credit review until the gate passes and must cover product proof kinds');

const verifierContract = readFileSync('agent/INDEPENDENT_VERIFIER.md', 'utf8');
assert.match(verifierContract, /read-only adversarial verifier/i);
assert.match(verifierContract, /Do not implement fixes/);
assert.match(verifierContract, /same branch/);
assert.match(verifierContract, /ironshade-independent-review:v1/);

console.log('INDEPENDENT_REVIEW_TEST_PASS');
