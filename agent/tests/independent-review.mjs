import assert from 'node:assert/strict';
import {
  buildIndependentReviewPacket,
  validateIndependentReviewPacket,
  validateIndependentReviewResult,
} from '../tools/independent-review.mjs';
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

console.log('INDEPENDENT_REVIEW_TEST_PASS');
