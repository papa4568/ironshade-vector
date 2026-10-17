import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildEv14MechanismAuthorization,
  selectEv14GovernanceReview,
  validateEv14MechanismAuthorization,
} from '../tools/ev14-governance-review-auth.mjs';
import { authorizeAntibodyPromotion } from '../tools/antibody-promotion.mjs';

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
const selfAuthored = { ...trustedHuman, id: 11, user: { login: 'IMPLEMENTATION-OWNER' } };
const untrusted = { ...trustedHuman, id: 12, author_association: 'NONE', user: { login: 'outsider' } };
const stale = { ...trustedHuman, id: 13, body: humanEnvelope(stalePass) };
const trustedFail = { ...trustedHuman, id: 14, created_at: '2026-10-16T10:01:00Z', body: humanEnvelope(fail) };

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

const promotionPacket = { ...packet, taskId: 'EV-14' };
const promotionPass = { ...pass, taskId: 'EV-14' };
const promotionMachineResult = { ...machineResult, taskId: 'EV-14' };
const promotionMachineComment = { ...machineComment, body: machineEnvelope(promotionMachineResult) };
const laterPromotionHuman = {
  ...trustedHuman,
  id: 21,
  created_at: '2026-10-16T10:03:00Z',
  body: humanEnvelope(promotionPass),
};
const promotionPolicy = JSON.parse(await readFile(new URL('../antibody-promotion-policy.json', import.meta.url), 'utf8'));

function jsonResponse(value) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(value),
  };
}

function promotionFetch(comments) {
  return async url => {
    if (url.endsWith('/pulls/1')) {
      return jsonResponse({ state: 'open', head: { sha: candidateSha }, user: { login: prAuthor } });
    }
    if (url.includes('/issues/1/comments?') && url.includes('page=1')) return jsonResponse(comments);
    throw new Error(`unexpected EV-27 promotion fetch ${url}`);
  };
}

function governanceResult(reviewAuthorization) {
  return {
    transitionValid: true,
    promotionEligible: true,
    truthId: promotionPolicy.antibody.truthId,
    antibodyId: promotionPolicy.antibody.antibodyId,
    decisionPath: promotionPolicy.governance.decisionPath,
    decisionDigest: 'd'.repeat(64),
    reviewAuthorization,
    repositoryInputsLoadedFromCandidate: true,
    reviewPacketCandidateDerived: true,
    reviewPacketChangedFilesVerified: true,
    completeReviewHistoryVerified: true,
    completeDecisionHistoryVerified: true,
    latestDecisionHeadVerified: true,
    reviewIndependentFromPrAuthorVerified: true,
  };
}

function humanPromotionAuthorization() {
  return {
    reviewer: 'later-independent-human',
    reviewedAt: '2026-10-16T10:03:00Z',
    taskId: 'EV-14',
    candidateSha,
    commentId: 21,
    reviewResultSha256: 'e'.repeat(64),
    authorAssociation: 'COLLABORATOR',
    sourceRunId: null,
    decisionDigest: 'd'.repeat(64),
    decisionPath: promotionPolicy.governance.decisionPath,
  };
}

const trials = [];
let falsePositives = 0;
let falseNegatives = 0;
async function trial(id, expectedAccepted, operation) {
  let accepted = true;
  let error = null;
  try {
    await operation();
  } catch (caught) {
    accepted = false;
    error = caught instanceof Error ? caught.message : String(caught);
  }
  if (!expectedAccepted && accepted) falsePositives += 1;
  if (expectedAccepted && !accepted) falseNegatives += 1;
  trials.push({ id, expectedAccepted, accepted, error });
}

let humanAuthorization;
await trial('trusted-human-mechanism-pass', true, async () => {
  const selected = await selectEv14GovernanceReview({
    packet,
    comments: [trustedHuman],
    prAuthor,
    promotionAuthorizationRequired: false,
  });
  assert.equal(selected.reviewerKind, 'trusted-human');
  humanAuthorization = buildEv14MechanismAuthorization({ packet, selected, prAuthor });
  assert.equal(humanAuthorization.sourceRunId, null);
  assert.equal(humanAuthorization.trustedWorkflowSha, null);
  assert.deepEqual(
    validateEv14MechanismAuthorization({ packet, result: pass, authorization: humanAuthorization, prAuthor }),
    { reviewer: 'independent-human', reviewerKind: 'trusted-human', commentId: 10 },
  );
});

await trial('trusted-main-mechanism-pass', true, async () => {
  const selected = await selectEv14GovernanceReview({
    packet,
    comments: [machineComment],
    prAuthor,
    promotionAuthorizationRequired: false,
    verifyMachineRun,
  });
  assert.equal(selected.reviewerKind, 'trusted-main-actions');
  const authorization = buildEv14MechanismAuthorization({ packet, selected, prAuthor });
  assert.equal(authorization.sourceRunId, 321);
  assert.equal(authorization.trustedWorkflowSha, 'c'.repeat(40));
  validateEv14MechanismAuthorization({ packet, result: machineResult, authorization, prAuthor });
});

await trial('self-authored-mechanism-reject', false, () => selectEv14GovernanceReview({
  packet,
  comments: [selfAuthored],
  prAuthor,
  promotionAuthorizationRequired: false,
}));

await trial('untrusted-mechanism-reject', false, () => selectEv14GovernanceReview({
  packet,
  comments: [untrusted],
  prAuthor,
  promotionAuthorizationRequired: false,
}));

await trial('stale-mechanism-reject', false, () => selectEv14GovernanceReview({
  packet,
  comments: [stale],
  prAuthor,
  promotionAuthorizationRequired: false,
}));

await trial('failing-verdict-mechanism-reject', false, () => selectEv14GovernanceReview({
  packet,
  comments: [trustedHuman, trustedFail],
  prAuthor,
  promotionAuthorizationRequired: false,
}));

await trial('human-only-promotion-reject', false, () => authorizeAntibodyPromotion(promotionPolicy, {
  candidateSha,
  repository: 'papa4568/ironshade-vector',
  prNumber: 1,
  reviewPacket: promotionPacket,
  fetchImpl: promotionFetch([laterPromotionHuman]),
  verifyMachineRun,
  authorizeGovernanceDecision: async () => governanceResult(humanPromotionAuthorization()),
}));

await trial('machine-promotion-survives-later-human', true, async () => {
  const report = await authorizeAntibodyPromotion(promotionPolicy, {
    candidateSha,
    repository: 'papa4568/ironshade-vector',
    prNumber: 1,
    reviewPacket: promotionPacket,
    fetchImpl: promotionFetch([promotionMachineComment, laterPromotionHuman]),
    verifyMachineRun,
    // Reproduce the pre-fix generic-governance behavior: a later trusted human wins
    // there. EV-14 promotion must nevertheless bind its own machine-only result.
    authorizeGovernanceDecision: async () => governanceResult(humanPromotionAuthorization()),
  });
  assert.equal(report.reviewAuthorization.reviewer, 'github-actions[bot]');
  assert.equal(report.reviewAuthorization.authorAssociation, 'TRUSTED_MAIN_ACTIONS');
  assert.equal(report.reviewAuthorization.sourceRunId, 321);
  assert.equal(report.reviewAuthorization.trustedWorkflowSha, 'c'.repeat(40));
  assert.equal(report.trustedMainPromotionReviewVerified, true);
});

await trial('forged-human-machine-provenance-reject', false, async () => {
  assert(humanAuthorization, 'trusted-human mechanism authorization fixture must exist');
  const forged = { ...humanAuthorization, sourceRunId: 321, trustedWorkflowSha: 'c'.repeat(40) };
  validateEv14MechanismAuthorization({ packet, result: pass, authorization: forged, prAuthor });
});

assert.equal(trials.length, 9);
for (const entry of trials) {
  assert.equal(entry.accepted, entry.expectedAccepted, `${entry.id} observed=${entry.accepted} expected=${entry.expectedAccepted} error=${entry.error ?? 'none'}`);
}
assert.equal(falsePositives, 0);
assert.equal(falseNegatives, 0);
console.log(`EV14_GOVERNANCE_REVIEW_AUTH_TEST_PASS trials=${trials.length} falsePositives=${falsePositives} falseNegatives=${falseNegatives} trustedHumanMechanism=accepted trustedMachineMechanism=accepted promotionHuman=rejected promotionMachine=accepted promotionLaterHuman=ignored rollback=machine-only-restorable`);
