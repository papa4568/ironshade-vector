import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { loadEvidenceGraph } from '../tools/evidence-independence.mjs';
import { runEvidenceIndependenceGate } from '../tools/evidence-independence-gate.mjs';
import {
  buildEvidenceIndependencePromotionDecision,
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
const indirectRevisionHelper = [
  "import { spawnSync } from 'node:",
  "child_process';\n",
  "spawnSync('git', ['checkout', 'deadbeef']);\n",
  "spawnSync('git', ['checkout', process.env.CANDIDATE_SHA ?? 'HEAD']);\n",
].join('');

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
assert.equal(parsed.jobs.has('candidate-verification'), true);
assert.deepEqual(parsed.jobs.get('candidate-build').env, {});
assert.equal(parsed.jobs.get('candidate-build').steps.filter(step => step.uses?.startsWith('actions/checkout@')).length, 1);
assert.equal(parsed.jobs.get('candidate-build').steps.find(step => step.id === 'identity').env.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha }}');
assert.equal(parsed.jobs.get('candidate-build').steps.find(step => step.id === 'full-verification').env.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha }}');

const observation = observePrCandidateHeadContract({ workflowText, candidateSha: HEAD_SHA });
if (!observation.pass) {
  const blocking = observation.producerRunSurface.reports.filter(entry => !entry.pass).map(entry => ({ stepName: entry.stepName, reviewed: entry.reviewed, directSourceRefs: entry.directSourceRefs, expectedSourceRefs: entry.expectedSourceRefs, stepIf: entry.stepIf, expectedIf: entry.expectedIf, blockingFindings: entry.blockingFindings }));
  const environment = observation.producerEnvironment.reports.filter(entry => !entry.pass).map(entry => ({ stepName: entry.stepName, actualEnv: entry.actualEnv, expectedEnv: entry.expectedEnv }));
  console.error(`PR_CANDIDATE_HEAD_OBSERVER_BASELINE_FAIL failed=${observation.failedCheckIds.join(',')} missingRuns=${observation.producerRunSurface.missingReviewedRunSteps.join(',')} missingActions=${observation.producerActions.missingReviewedActions.join(',')} preflight=${observation.producerEnvironmentPreflight.pass} environment=${JSON.stringify(environment)} blocking=${JSON.stringify(blocking)}`);
}
assert.equal(observation.schema, 'ironshade-pr-candidate-head-observer:v2');
assert.equal(observation.parsingMode, 'structured-jobs-steps');
assert.equal(observation.pass, true);
assert.equal(observation.criterionId, 'candidate-workflows-use-exact-pr-head');
assert.equal(observation.checks.length, 14);
assert.deepEqual(observation.failedCheckIds, []);
assert.equal(observation.checks.find(entry => entry.id === 'candidate-build-environment-preflight')?.pass, true);
assert.equal(observation.checks.find(entry => entry.id === 'candidate-build-install-scripts-disabled')?.pass, true);
assert.equal(observation.checks.find(entry => entry.id === 'candidate-build-shell-git-safety')?.pass, true);
assert.equal(observation.checks.find(entry => entry.id === 'candidate-build-action-safety')?.pass, true);
assert.equal(observation.checks.find(entry => entry.id === 'candidate-build-environment-safety')?.pass, true);
assert.equal(observation.checks.find(entry => entry.id === 'candidate-build-transitive-step-safety')?.pass, true);
assert.equal(observation.checks.find(entry => entry.id === 'candidate-build-sealed-runtime')?.pass, true);
assert.deepEqual(observation.allowedProducerGitSubcommands, ['archive', 'diff', 'rev-parse']);
assert.equal(observation.producerActions.pass, true);
assert.equal(observation.producerActions.unreviewedActions.length, 0);
assert.deepEqual(observation.producerActions.missingReviewedActions, []);
assert.equal(observation.producerEnvironment.pass, true);
assert.deepEqual(observation.producerEnvironment.jobEnv, {});
assert.equal(observation.producerEnvironment.reports.every(entry => entry.pass), true);
assert.equal(observation.producerEnvironmentPreflight.pass, true);
assert.equal(observation.producerRunSurface.unreviewedRunStepCount, 0);
assert.deepEqual(observation.producerRunSurface.missingReviewedRunSteps, []);
assert.equal(observation.producerRunSurface.reviewedRunStepCount > 0, true);
assert.equal(observation.producerRunSurface.reports.every(entry => entry.pass), true);
assert.equal(observation.producerRunSurface.reports.every(entry => entry.stepIf === entry.expectedIf), true);
assert.equal(observation.producerRunSurface.reports.find(entry => entry.stepName === 'Capture EV-5 impact-map calibration shadow evidence')?.expectedIf, 'always()');
assert.equal(observation.producerRunSurface.reports.find(entry => entry.stepName === 'Compare EV-6 reuse prediction with the real rerun')?.expectedIf, 'always()');
assert.equal(observation.producerRunSurface.reports.find(entry => entry.stepName === 'Enforce promoted causal evidence independence scope')?.expectedIf, null);

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
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'comment-spoofs-exact-head-ref').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'later-checkout-overrides-producer').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'identity-assertion-commented-out').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'build-switches-and-restores-revision').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'transitive-build-script-sees-host-repository').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'install-lifecycle-scripts-enabled').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'dependency-install-node-options-preload').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'candidate-build-job-node-options-preload').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'environment-preflight-skipped').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'promoted-enforcement-step-skipped').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'indirect-added-producer-step-revision-switch').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'indirect-reviewed-name-producer-step-revision-switch').detected, true);
assert.equal(calibration.dishonestMutations.find(entry => entry.id === 'reviewed-entrypoint-source-revision-switch').detected, true);
assert.equal(calibration.negativeControls.find(entry => entry.id === 'comment-mentions-synthetic-ref').passed, true);
assert.equal(calibration.negativeControls.find(entry => entry.id === 'shell-comment-mentions-git-checkout').passed, true);

const promotionDecision = await runEvidenceIndependencePromotionGate({ candidateSha: HEAD_SHA, env: {} });
assert.equal(promotionDecision.verdict, 'pass');
assert.equal(promotionDecision.blocking, false);
assert.equal(promotionDecision.semanticObserver.pass, true);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.source, 'candidate-git-object');
assert.equal(promotionDecision.semanticObserver.workflowProvenance.gitObject, `${HEAD_SHA}:.github/workflows/pr-candidate.yml`);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.workingTreeAuthoritative, false);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.trials, 1);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.falseNegatives, 0);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.attack.id, 'mutable-workspace-substitution');
assert.equal(promotionDecision.semanticObserver.workflowProvenance.attack.substitutedWorkspaceRejected, true);
assert.equal(promotionDecision.semanticObserver.workflowProvenance.attack.authoritativeSourceUnaffected, true);
assert.equal(promotionDecision.semanticObserver.observation.parsingMode, 'structured-jobs-steps');
assert.equal(promotionDecision.semanticObserver.observation.checks.find(entry => entry.id === 'candidate-build-environment-preflight')?.pass, true);
assert.equal(promotionDecision.semanticObserver.observation.checks.find(entry => entry.id === 'candidate-build-install-scripts-disabled')?.pass, true);
assert.equal(promotionDecision.semanticObserver.observation.checks.find(entry => entry.id === 'candidate-build-environment-safety')?.pass, true);
assert.equal(promotionDecision.semanticObserver.observation.checks.find(entry => entry.id === 'candidate-build-transitive-step-safety')?.pass, true);
assert.equal(promotionDecision.semanticObserver.observation.checks.find(entry => entry.id === 'candidate-build-sealed-runtime')?.pass, true);
assert.equal(promotionDecision.semanticObserver.calibration.falsePositives, 0);
assert.equal(promotionDecision.semanticObserver.calibration.falseNegatives, 0);
assert.equal(promotionDecision.proofSynthesisAllowed, false);
assert.equal(promotionDecision.candidatePassGranted, false);

const dishonestWorkflow = workflowText.replace('ref: ${{ github.event.pull_request.head.sha }}', 'ref: ${{ github.sha }}');
const dishonestObservation = observePrCandidateHeadContract({ workflowText: dishonestWorkflow, candidateSha: HEAD_SHA });
assert.equal(dishonestObservation.pass, false);
assert.equal(dishonestObservation.failedCheckIds.includes('candidate-build-checkout'), true);
assert.equal(dishonestObservation.failedCheckIds.includes('no-synthetic-merge-ref'), true);

const commentSpoofWorkflow = workflowText.replace(
  'ref: ${{ github.event.pull_request.head.sha }}',
  'ref: ${{ github.sha }}\n          # ref: ${{ github.event.pull_request.head.sha }}',
);
const commentSpoofObservation = observePrCandidateHeadContract({ workflowText: commentSpoofWorkflow, candidateSha: HEAD_SHA });
assert.equal(commentSpoofObservation.pass, false, 'a comment containing the expected ref must not satisfy a structural checkout check');
assert.equal(commentSpoofObservation.failedCheckIds.includes('candidate-build-checkout'), true);

const laterCheckoutWorkflow = workflowText.replace(
  '      - name: Set up Node 22',
  '      - name: Later checkout bypass\n        uses: actions/checkout@v7\n        with:\n          ref: ${{ github.sha }}\n\n      - name: Set up Node 22',
);
const laterCheckoutObservation = observePrCandidateHeadContract({ workflowText: laterCheckoutWorkflow, candidateSha: HEAD_SHA });
assert.equal(laterCheckoutObservation.pass, false, 'a later checkout must invalidate the unique producer checkout contract');
assert.equal(laterCheckoutObservation.failedCheckIds.includes('candidate-build-checkout'), true);
assert.equal(laterCheckoutObservation.failedCheckIds.includes('candidate-build-action-safety'), true);
assert.equal(laterCheckoutObservation.failedCheckIds.includes('no-synthetic-merge-ref'), true);

const indirectProducerWorkflow = workflowText.replace(
  '      - name: Set up Node 22',
  '      - name: Indirect producer revision switch\n        run: node scripts/ev9-indirect-producer-step.mjs\n\n      - name: Set up Node 22',
);
const indirectProducerObservation = observePrCandidateHeadContract({
  workflowText: indirectProducerWorkflow,
  candidateSha: HEAD_SHA,
  sourceOverrides: { 'scripts/ev9-indirect-producer-step.mjs': indirectRevisionHelper },
});
assert.equal(indirectProducerObservation.pass, false, 'an added producer step must not hide a revision switch behind an indirect Git subprocess');
assert.equal(indirectProducerObservation.failedCheckIds.includes('candidate-build-transitive-step-safety'), true);
assert.equal(indirectProducerObservation.checks.find(entry => entry.id === 'candidate-identity-runtime-assertion')?.pass, true, 'the attack must demonstrate the later identity assertion can still pass after the helper restores HEAD');
assert.equal(indirectProducerObservation.producerRunSurface.unreviewedRunStepCount, 1);
assert.equal(indirectProducerObservation.producerRunSurface.reports.find(entry => !entry.reviewed).findings.some(entry => entry.kind === 'revision-changing-git-process'), true);

const sameNameIndirectWorkflow = workflowText.replace(
  '      - name: Verify candidate artifact integrity contract\n        run: node agent/tests/candidate-artifact.mjs',
  '      - name: Verify candidate artifact integrity contract\n        run: node scripts/ev9-indirect-producer-step.mjs',
);
const sameNameIndirectObservation = observePrCandidateHeadContract({
  workflowText: sameNameIndirectWorkflow,
  candidateSha: HEAD_SHA,
  sourceOverrides: { 'scripts/ev9-indirect-producer-step.mjs': indirectRevisionHelper },
});
assert.equal(sameNameIndirectObservation.pass, false, 'retaining a reviewed step name must not exempt a changed executable entrypoint');
assert.equal(sameNameIndirectObservation.failedCheckIds.includes('candidate-build-transitive-step-safety'), true);
assert.equal(sameNameIndirectObservation.checks.find(entry => entry.id === 'candidate-identity-runtime-assertion')?.pass, true);
const sameNameSurface = sameNameIndirectObservation.producerRunSurface.reports.find(entry => entry.stepName === 'Verify candidate artifact integrity contract');
assert.equal(sameNameSurface.reviewed, false, 'review status must follow executable entrypoints rather than the step label');
assert.deepEqual(sameNameSurface.expectedSourceRefs, ['agent/tests/candidate-artifact.mjs']);
assert.deepEqual(sameNameSurface.directSourceRefs, ['scripts/ev9-indirect-producer-step.mjs']);
assert.equal(sameNameSurface.findings.some(entry => entry.kind === 'revision-changing-git-process'), true);

const reviewedSourceObservation = observePrCandidateHeadContract({
  workflowText,
  candidateSha: HEAD_SHA,
  sourceOverrides: { 'agent/tests/candidate-artifact.mjs': indirectRevisionHelper },
});
assert.equal(reviewedSourceObservation.pass, false, 'a reviewed workflow entrypoint must still reject a transitive source mutation that changes Git revision');
assert.equal(reviewedSourceObservation.failedCheckIds.includes('candidate-build-transitive-step-safety'), true);
const reviewedSourceSurface = reviewedSourceObservation.producerRunSurface.reports.find(entry => entry.stepName === 'Verify candidate artifact integrity contract');
assert.equal(reviewedSourceSurface.reviewed, true);
assert.equal(reviewedSourceSurface.blockingFindings.some(entry => entry.kind === 'revision-changing-git-process'), true);

const buildRevisionSwitchWorkflow = workflowText.replace(
  '            npm run build 2>&1 | tee .agent-impact-calibration/full-verification.log',
  '            git checkout "${{ github.sha }}"\n            npm run build 2>&1 | tee .agent-impact-calibration/full-verification.log\n            git checkout "${{ github.event.pull_request.head.sha }}"',
);
const buildRevisionSwitchObservation = observePrCandidateHeadContract({ workflowText: buildRevisionSwitchWorkflow, candidateSha: HEAD_SHA });
assert.equal(buildRevisionSwitchObservation.pass, false, 'switching away for the build and restoring before the later identity assertion must be rejected');
assert.equal(buildRevisionSwitchObservation.failedCheckIds.includes('candidate-build-shell-git-safety'), true);
assert.equal(buildRevisionSwitchObservation.failedCheckIds.includes('candidate-build-sealed-runtime'), true);
assert.equal(buildRevisionSwitchObservation.checks.find(entry => entry.id === 'candidate-identity-runtime-assertion')?.pass, true, 'the attack must demonstrate the later identity assertion alone can still pass');

const transitiveBuildWorkflow = workflowText.replace(
  '            --network none \\\n            --volume "$snapshot:/workspace" \\',
  '            --network none \\\n            --volume "$GITHUB_WORKSPACE:/workspace" \\',
);
const transitiveBuildObservation = observePrCandidateHeadContract({ workflowText: transitiveBuildWorkflow, candidateSha: HEAD_SHA });
assert.equal(transitiveBuildObservation.pass, false, 'a candidate-controlled transitive build script must never receive the host Git checkout');
assert.equal(transitiveBuildObservation.failedCheckIds.includes('candidate-build-sealed-runtime'), true);
assert.equal(transitiveBuildObservation.checks.find(entry => entry.id === 'candidate-identity-runtime-assertion')?.pass, true, 'the later host identity assertion does not prove the transitive build source');

const lifecycleWorkflow = workflowText.replace(
  '        run: npm ci --ignore-scripts --no-audit --no-fund',
  '        run: npm ci --no-audit --no-fund',
);
const lifecycleObservation = observePrCandidateHeadContract({ workflowText: lifecycleWorkflow, candidateSha: HEAD_SHA });
assert.equal(lifecycleObservation.pass, false, 'candidate-controlled install lifecycle scripts must remain disabled');
assert.equal(lifecycleObservation.failedCheckIds.includes('candidate-build-install-scripts-disabled'), true);

const installPreloadWorkflow = workflowText.replace(
  '      - name: Install locked dependencies\n        run: npm ci --ignore-scripts --no-audit --no-fund',
  '      - name: Install locked dependencies\n        env:\n          NODE_OPTIONS: --require=./payload.cjs\n        run: npm ci --ignore-scripts --no-audit --no-fund',
);
const installPreloadObservation = observePrCandidateHeadContract({ workflowText: installPreloadWorkflow, candidateSha: HEAD_SHA });
assert.equal(installPreloadObservation.pass, false, 'NODE_OPTIONS preload on dependency installation must be rejected even when --ignore-scripts remains present');
assert.equal(installPreloadObservation.failedCheckIds.includes('candidate-build-environment-safety'), true);
assert.equal(installPreloadObservation.checks.find(entry => entry.id === 'candidate-build-install-scripts-disabled')?.pass, true, 'the preload attack must demonstrate why --ignore-scripts alone is insufficient');

const jobPreloadWorkflow = workflowText.replace(
  '    timeout-minutes: 35\n    outputs:',
  '    timeout-minutes: 35\n    env:\n      NODE_OPTIONS: --require=./payload.cjs\n    outputs:',
);
const jobPreloadObservation = observePrCandidateHeadContract({ workflowText: jobPreloadWorkflow, candidateSha: HEAD_SHA });
assert.equal(jobPreloadObservation.pass, false, 'candidate-build job-level preload environment must be rejected');
assert.equal(jobPreloadObservation.failedCheckIds.includes('candidate-build-environment-safety'), true);

const skippedPreflightWorkflow = workflowText.replace(
  '      - name: Verify producer environment before executable setup\n        shell: /usr/bin/python3 -I -S -E {0}\n        run: |',
  '      - name: Verify producer environment before executable setup\n        if: ${{ false }}\n        shell: /usr/bin/python3 -I -S -E {0}\n        run: |',
);
const skippedPreflightObservation = observePrCandidateHeadContract({ workflowText: skippedPreflightWorkflow, candidateSha: HEAD_SHA });
assert.equal(skippedPreflightObservation.pass, false, 'the isolated producer environment preflight must remain unconditional');
assert.equal(skippedPreflightObservation.failedCheckIds.includes('candidate-build-environment-preflight'), true);
assert.equal(skippedPreflightObservation.failedCheckIds.includes('candidate-build-transitive-step-safety'), true);

const skippedPromotionGateWorkflow = workflowText.replace(
  '      - name: Enforce promoted causal evidence independence scope\n        env:',
  '      - name: Enforce promoted causal evidence independence scope\n        if: ${{ false }}\n        env:',
);
const skippedPromotionGateObservation = observePrCandidateHeadContract({ workflowText: skippedPromotionGateWorkflow, candidateSha: HEAD_SHA });
assert.equal(skippedPromotionGateObservation.pass, false, 'the promoted EV-9 enforcement step must remain unconditional');
assert.equal(skippedPromotionGateObservation.failedCheckIds.includes('candidate-build-transitive-step-safety'), true);
const skippedPromotionGateSurface = skippedPromotionGateObservation.producerRunSurface.reports.find(entry => entry.stepName === 'Enforce promoted causal evidence independence scope');
assert.equal(skippedPromotionGateSurface.reviewed, false);
assert.equal(skippedPromotionGateSurface.stepIf, '${{ false }}');
assert.equal(skippedPromotionGateSurface.expectedIf, null);
assert.equal(skippedPromotionGateSurface.blockingFindings.some(entry => entry.kind === 'unreviewed-producer-run-step'), true);

const baseDecision = await runEvidenceIndependenceGate({ candidateSha: HEAD_SHA, enforcementOverride: false, env: {} });
assert.equal(baseDecision.wouldBlock, false, 'graph labels alone still classify the real criterion independent');
const semanticFailure = buildEvidenceIndependencePromotionDecision({
  policy,
  graph,
  baseDecision,
  semanticObservation: transitiveBuildObservation,
  semanticCalibration: calibration,
  candidateSha: HEAD_SHA,
  env: {},
});
assert.equal(semanticFailure.baseDecision.wouldBlock, false);
assert.equal(semanticFailure.semanticObserver.pass, false);
assert.equal(semanticFailure.wouldBlock, true);
assert.equal(semanticFailure.blocking, true, 'semantic observer failure must block even when graph labels still say independent');
assert.equal(semanticFailure.verdict, 'fail');

const rollback = buildEvidenceIndependencePromotionDecision({
  policy,
  graph,
  baseDecision,
  semanticObservation: transitiveBuildObservation,
  semanticCalibration: calibration,
  candidateSha: HEAD_SHA,
  env: { IRONSHADE_EVIDENCE_INDEPENDENCE_ENFORCEMENT: '0' },
});
assert.equal(rollback.wouldBlock, true);
assert.equal(rollback.blocking, false);
assert.equal(rollback.verdict, 'disabled-advisory');
assert.equal(rollback.semanticObserver.observation.pass, false);
assert.equal(rollback.proofSynthesisAllowed, false);
assert.equal(rollback.candidatePassGranted, false);

console.log(`PR_CANDIDATE_HEAD_OBSERVER_PASS checks=${observation.checks.length} parsing=${observation.parsingMode} semanticFalsePositives=${calibration.falsePositives}/${calibration.falsePositiveTrials} semanticFalseNegatives=${calibration.falseNegatives}/${calibration.falseNegativeTrials} sourceFalseNegatives=${promotionDecision.semanticObserver.workflowProvenance.falseNegatives}/${promotionDecision.semanticObserver.workflowProvenance.trials} sourceSubstitution=blocked commentSpoof=blocked envPreflight=early envInjection=blocked laterCheckout=blocked indirectProducerStep=blocked reviewedNameBypass=blocked reviewedSourceMutation=blocked buildRevisionSwitch=blocked transitiveBuild=sealed installLifecycle=disabled promotionGateSkip=blocked dishonestBlocked=${semanticFailure.blocking} rollback=${rollback.mode} exactSha=bound candidatePassGranted=false`);
