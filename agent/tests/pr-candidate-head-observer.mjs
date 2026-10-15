import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { loadEvidenceGraph } from '../tools/evidence-independence.mjs';
import {
  runEvidenceIndependencePromotionGate,
  validateSemanticObserverPolicy,
} from '../tools/evidence-independence-promotion-gate.mjs';
import {
  calibratePrCandidateHeadObserver,
  observePrCandidateHeadContract,
  parsePrCandidateWorkflow,
} from '../tools/pr-candidate-head-observer.mjs';

const HEAD_SHA = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const workflowText = await readFile('.github/workflows/pr-candidate.yml', 'utf8');
const graph = await loadEvidenceGraph('agent/evidence-independence.json');
const policy = JSON.parse(await readFile('agent/evidence-independence-policy.json', 'utf8'));

const semanticPolicy = validateSemanticObserverPolicy(policy, graph);
assert.equal(semanticPolicy.criterionId, 'candidate-workflows-use-exact-pr-head');
assert.equal(semanticPolicy.observerSourceId, 'pr-candidate-head-observer');
assert.equal(semanticPolicy.workflowPath, '.github/workflows/pr-candidate.yml');

const redirectedPolicy = structuredClone(policy);
redirectedPolicy.semanticObserver.workflowPath = 'AGENTS.md';
assert.throws(
  () => validateSemanticObserverPolicy(redirectedPolicy, graph),
  /semanticObserver\.workflowPath must remain \.github\/workflows\/pr-candidate\.yml/,
  'semantic observer policy must not redirect the enforced observation away from the authoritative PR Candidate workflow',
);

const parsed = parsePrCandidateWorkflow(workflowText);
assert.equal(parsed.jobs.has('candidate-build'), true);
assert.equal(parsed.jobs.has('independent-review-context'), true);
assert.equal(parsed.jobs.has('browser-e2e'), true);
assert.equal(parsed.jobs.has('android'), true);
assert.equal(parsed.jobs.has('candidate-verification'), true);
assert.equal(parsed.jobs.get('candidate-build').steps.filter(step => step.uses?.startsWith('actions/checkout@')).length, 1);
assert.equal(parsed.jobs.get('candidate-build').steps.find(step => step.id === 'identity')?.env?.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha }}');
assert.equal(parsed.jobs.get('candidate-build').steps.find(step => step.id === 'full-verification')?.env?.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha }}');

const observation = observePrCandidateHeadContract({ workflowText, candidateSha: HEAD_SHA });
if (!observation.pass) console.error(`PR_CANDIDATE_HEAD_OBSERVER_BASELINE_FAIL failed=${observation.failedCheckIds.join(',')}`);
assert.equal(observation.schema, 'ironshade-pr-candidate-head-observer:v2');
assert.equal(observation.parsingMode, 'structured-jobs-steps');
assert.equal(observation.pass, true);
assert.equal(observation.criterionId, 'candidate-workflows-use-exact-pr-head');
assert.equal(observation.checks.length, 10);
assert.deepEqual(observation.failedCheckIds, []);
for (const id of [
  'candidate-build-checkout',
  'candidate-build-install-scripts-disabled',
  'candidate-build-source-bound-snapshot',
  'candidate-output-contract',
  'candidate-identity-runtime-assertion',
  'review-context-consumer',
  'browser-consumer',
  'android-consumer',
  'final-evidence-checkout',
  'no-synthetic-merge-ref',
]) {
  assert.equal(observation.checks.find(entry => entry.id === id)?.pass, true, `${id} must pass on the live workflow`);
}

const calibration = calibratePrCandidateHeadObserver({ workflowText, candidateSha: HEAD_SHA });
assert.equal(calibration.schema, 'ironshade-pr-candidate-head-observer-calibration:v2');
assert.equal(calibration.pass, true);
assert.equal(calibration.baselinePass, true);
assert.equal(calibration.falsePositiveTrials, 4);
assert.equal(calibration.falsePositives, 0);
assert.equal(calibration.falsePositiveRate, 0);
assert.equal(calibration.falseNegativeTrials, 15);
assert.equal(calibration.falseNegatives, 0);
assert.equal(calibration.falseNegativeRate, 0);
assert.equal(calibration.negativeControls.every(entry => entry.passed && !entry.falsePositive), true);
assert.equal(calibration.dishonestMutations.every(entry => entry.detected && !entry.falseNegative), true);
for (const id of [
  'producer-synthetic-event-sha',
  'comment-spoofs-exact-head-ref',
  'later-checkout-overrides-producer',
  'source-bound-build-uses-synthetic-event-sha',
  'source-bound-build-comment-spoof',
  'source-bound-build-quoted-string-spoof',
  'cache-request-synthetic-candidate',
  'cache-materialize-without-validated-decision',
  'closed-proof-fallback-removed',
  'identity-assertion-commented-out',
  'review-context-synthetic-event-sha',
  'browser-consumer-synthetic-event-sha',
  'android-consumer-synthetic-event-sha',
  'browser-artifact-substitution',
  'final-evidence-synthetic-event-sha',
]) {
  assert.equal(calibration.dishonestMutations.find(entry => entry.id === id)?.detected, true, `${id} must be detected`);
}

const promotionDecision = await runEvidenceIndependencePromotionGate({ candidateSha: HEAD_SHA, env: {} });
assert.equal(promotionDecision.verdict, 'pass');
assert.equal(promotionDecision.blocking, false);
assert.equal(promotionDecision.semanticObserver.pass, true);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.source, 'candidate-git-object');
assert.equal(promotionDecision.semanticObserver.workflowProvenance.gitObject, `${HEAD_SHA}:.github/workflows/pr-candidate.yml`);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.workingTreeAuthoritative, false);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.falseNegatives, 0);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.attack.id, 'mutable-workspace-substitution');
assert.equal(promotionDecision.semanticObserver.workflowProvenance.attack.substitutedWorkspaceRejected, true);
assert.equal(promotionDecision.semanticObserver.calibration.falsePositives, 0);
assert.equal(promotionDecision.semanticObserver.calibration.falseNegatives, 0);
assert.equal(promotionDecision.existingExactShaEvidenceRemainsAuthoritative, true);
assert.equal(promotionDecision.proofSynthesisAllowed, false);
assert.equal(promotionDecision.candidatePassGranted, false);

const rollbackDecision = await runEvidenceIndependencePromotionGate({
  candidateSha: HEAD_SHA,
  env: { IRONSHADE_EVIDENCE_INDEPENDENCE_ENFORCEMENT: '0' },
});
assert.equal(rollbackDecision.mode, 'advisory-rollback');
assert.equal(rollbackDecision.verdict, 'disabled-advisory');
assert.equal(rollbackDecision.blocking, false);
assert.equal(rollbackDecision.semanticObserver.pass, true);
assert.equal(rollbackDecision.existingExactShaEvidenceRemainsAuthoritative, true);
assert.equal(rollbackDecision.proofSynthesisAllowed, false);
assert.equal(rollbackDecision.candidatePassGranted, false);

console.log(`PR_CANDIDATE_HEAD_OBSERVER_TEST_PASS checks=${observation.checks.length} falsePositives=${calibration.falsePositives}/${calibration.falsePositiveTrials} falseNegatives=${calibration.falseNegatives}/${calibration.falseNegativeTrials} source=candidate-git-object rollback=advisory-only`);
