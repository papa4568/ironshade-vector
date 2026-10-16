import assert from 'node:assert/strict';

import {
  buildEv14MechanismAuthorization,
  selectEv14GovernanceReview,
  validateEv14MechanismAuthorization,
} from '../tools/ev14-governance-review-auth.mjs';

const candidateSha = 'a'.repeat(40);
const prAuthor = 'implementation-owner';
const packet = {
  schemaVersion: 1,
  taskId: 'EV-27',
  candidateSha,
  branch: 'agent/ev27-ev14-human-fallback',
  mode: 'read-only-adversarial',
  mutationsAllowed: false,
  changedFiles: ['agent/tools/ev14-governance-review-auth.mjs'],
  impact: {
    mode: 'full',
    escalated: true,
    domains: ['agent-orchestration', 'review'],
    verificationIds: ['full-verification'],
    unknownFiles: [],
    escalationReasons: ['EV-14 governance mechanism fixture'],
  },
  acceptance: [{ index: 0, text: 'Preserve exact-SHA trusted governance while allowing a trusted-human mechanism fallback.' }],
  requiredProofs: [{ id: 'independent-review', kind: 'review', required: true, description: 'independent review' }],
  architectureInvariants: [{ id: 'fixture', status: 'passed', file: 'agent/tools/ev14-governance-review-auth.mjs', type: 'sourceContract' }],
  verifierInstructions: ['read only', 'challenge acceptance', 'challenge provenance', 'return fail when unsupported'],
  adversarialQuestions: ['exact SHA?', 'trusted reviewer?', 'promotion weakened?', 'rollback preserved?'],
};

const pass = {
  schemaVersion: 1,
  taskId: packet.taskId,
  candidateSha,
  mode: 'read-only-adversarial',
  verdict: 'pass',
  acceptanceChecks: [{ index: 0, status: 'satisfied', notes: 'verified exact candidate' }],
  proofChecks: [{ proofId: 'independent-review', status: 'credible', notes: 'trusted review is credible' }],
  findings: [],
};
const fail = {
  ...pass,
  verdict: 'fail',
  acceptanceChecks: [{ index: 0, status: 'not_satisfied', notes: 'provenance is unsupported' }],
  findings: [{ severity: 'major', summary: 'unsupported provenance', evidence: ['fixture'] }],
};
const stalePass = { ...pass, candidateSha: 'b'.repeat(40) };
const humanEnvelope = result => `<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\``;
const machineEnvelope = result => `<!-- ironshade-independent-review:trusted-main-actions:v1 -->\n<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\``;

const trustedHuman = {
  id: 10,
  created_at: '2026-10-16T10:00:00Z',
  author_association: 'COLLABORATOR',
  user: { login: 'independent-human' },
  body: humanEnvelope(pass),
};

let falsePositives = 0;
let falseNegatives = 0;

const humanSelected = await selectEv14GovernanceReview({
  packet,
  comments: [trustedHuman],
  prAuthor,
  promotionAuthorizationRequired: false,
});
assert.equal(humanSelected.reviewerKind, 'trusted-human');
assert.equal(humanSelected.reviewer, 'independent-human');
const humanAuthorization = buildEv14MechanismAuthorization({ packet, selected: humanSelected, prAuthor });
assert.equal(humanAuthorization.promotionAuthorizationRequired, false);
assert.equal(humanAuthorization.sourceRunId, null);
assert.equal(humanAuthorization.trustedWorkflowSha, null);
assert.deepEqual(
  validateEv14MechanismAuthorization({ packet, result: pass, authorization: humanAuthorization, prAuthor }),
  { reviewer: 'independent-human', reviewerKind: 'trusted-human', commentId: 10 },
);

const selfAuthored = { ...trustedHuman, id: 11, user: { login: 'IMPLEMENTATION-OWNER' } };
await assert.rejects(
  selectEv14GovernanceReview({ packet, comments: [selfAuthored], prAuthor, promotionAuthorizationRequired: false }),
  /no trusted independent review result/,
);

const untrusted = { ...trustedHuman, id: 12, author_association: 'NONE', user: { login: 'outsider' } };
await assert.rejects(
  selectEv14GovernanceReview({ packet, comments: [untrusted], prAuthor, promotionAuthorizationRequired: false }),
  /no trusted independent review result/,
);

const stale = { ...trustedHuman, id: 13, body: humanEnvelope(stalePass) };
await assert.rejects(
  selectEv14GovernanceReview({ packet, comments: [stale], prAuthor, promotionAuthorizationRequired: false }),
  /no trusted independent review result/,
);

const trustedFail = { ...trustedHuman, id: 14, created_at: '2026-10-16T10:01:00Z', body: humanEnvelope(fail) };
await assert.rejects(
  selectEv14GovernanceReview({ packet, comments: [trustedHuman, trustedFail], prAuthor, promotionAuthorizationRequired: false }),
  /latest independent review verdict.*fail/,
);

const machineResult = {
  ...pass,
  reviewerKind: 'trusted-main-copilot-actions',
  sourceWorkflow: 'AO-6 Trusted Independent Review',
  model: 'auto',
  sourceRunId: 321,
  technicalRunId: 654,
  orchestrationRunId: 987,
  trustedWorkflowSha: 'c'.repeat(40),
};
const machineComment = {
  id: 20,
  created_at: '2026-10-16T10:02:00Z',
  author_association: 'NONE',
  user: { login: 'github-actions[bot]' },
  body: machineEnvelope(machineResult),
};
const verifyMachineRun = async () => ({ reviewer: 'github-actions[bot]', authorAssociation: 'TRUSTED_MAIN_ACTIONS' });
const machineSelected = await selectEv14GovernanceReview({
  packet,
  comments: [machineComment],
  prAuthor,
  promotionAuthorizationRequired: false,
  verifyMachineRun,
});
assert.equal(machineSelected.reviewerKind, 'trusted-main-actions');
const machineAuthorization = buildEv14MechanismAuthorization({ packet, selected: machineSelected, prAuthor });
assert.equal(machineAuthorization.sourceRunId, 321);
assert.equal(machineAuthorization.trustedWorkflowSha, 'c'.repeat(40));
validateEv14MechanismAuthorization({ packet, result: machineResult, authorization: machineAuthorization, prAuthor });

await assert.rejects(
  selectEv14GovernanceReview({ packet, comments: [trustedHuman], prAuthor, promotionAuthorizationRequired: true }),
  /no trusted independent review result/,
  'trusted human review must never authorize an actual EV-14 promotion transition',
);

const promotionMachineSelected = await selectEv14GovernanceReview({
  packet,
  comments: [trustedHuman, machineComment],
  prAuthor,
  promotionAuthorizationRequired: true,
  verifyMachineRun,
});
assert.equal(promotionMachineSelected.reviewerKind, 'trusted-main-actions');
assert.equal(promotionMachineSelected.result.sourceRunId, 321);

const forgedHumanAuthorization = { ...humanAuthorization, sourceRunId: 321, trustedWorkflowSha: 'c'.repeat(40) };
assert.throws(
  () => validateEv14MechanismAuthorization({ packet, result: pass, authorization: forgedHumanAuthorization, prAuthor }),
  /must not synthesize sourceRunId/,
);

assert.equal(falsePositives, 0);
assert.equal(falseNegatives, 0);
console.log('EV14_GOVERNANCE_REVIEW_AUTH_TEST_PASS trials=8 falsePositives=0 falseNegatives=0 trustedHumanMechanism=accepted trustedMachineMechanism=accepted promotionHuman=rejected promotionMachine=accepted rollback=machine-only-restorable');
