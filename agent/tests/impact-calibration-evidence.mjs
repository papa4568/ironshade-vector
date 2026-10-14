import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  observeVerificationTargetRead,
  recommendWidening,
  validateHistoricalRunEvidence,
  validateImpactCalibrationCorpus,
} from '../tools/impact-calibration-evidence.mjs';
import { loadImpactMap, selectAffectedVerification } from '../tools/select-affected-verification.mjs';

const impactMap = await loadImpactMap(resolve('agent/impact-map.json'));
const corpus = validateImpactCalibrationCorpus(
  JSON.parse(await readFile(resolve('agent/impact-calibration-corpus.json'), 'utf8')),
  impactMap,
);

assert.equal(corpus.mode, 'advisory');
assert.equal(corpus.promotionTarget, 'EV-16');
assert.equal(corpus.errorBudget.falsePositiveWidenings, 0);
assert.equal(corpus.errorBudget.falseNegativeWidenings, 0);
assert.equal(recommendWidening({ missCount: 2, independentTargetCount: 2 }, corpus.minimumIndependentMissesForWidening), true);
assert.equal(recommendWidening({ missCount: 1, independentTargetCount: 1 }, corpus.minimumIndependentMissesForWidening), false);
assert.equal(recommendWidening({ missCount: 0, independentTargetCount: 2 }, corpus.minimumIndependentMissesForWidening), false);

const uiRule = impactMap.rules.find(rule => rule.id === 'ui-and-design-system');
assert(uiRule, 'UI rule must exist');
assert.equal(uiRule.risk, 'normal', 'EV-15 must not promote the UI widening itself');
assert.deepEqual(uiRule.verificationIds, ['ui-readability', 'design-system']);

for (const probe of corpus.executableMissProbes) {
  const selection = selectAffectedVerification(probe.changedFiles, impactMap);
  assert.equal(selection.mode, 'targeted');
  assert(selection.matchedRuleIds.includes(probe.expectedRuleId));
  assert.deepEqual(selection.verifications.map(entry => entry.id), probe.expectedVerificationIds);
  assert.deepEqual(
    [...probe.expectedDirectlyObservedVerificationIds, ...probe.expectedOverSelectedVerificationIds].sort(),
    [...probe.expectedVerificationIds].sort(),
    `${probe.id} measured observation expectations must partition the selected checks`,
  );
  assert.equal(probe.wideningAction, 'escalate-rule-to-full');
}

const observed = await observeVerificationTargetRead(
  "node --input-type=module -e \"import { readFileSync } from 'node:fs'; readFileSync('agent/impact-map.json', 'utf8');\"",
  'agent/impact-map.json',
);
assert.equal(observed.directTargetObserved, true, 'runtime file observer must detect a real target read');
assert(observed.targetReadObservationCount > 0, 'runtime file observer must record at least one target read');
const unobserved = await observeVerificationTargetRead(
  "node -e \"process.stdout.write('no-target-read')\"",
  'agent/impact-map.json',
);
assert.equal(unobserved.directTargetObserved, false, 'runtime file observer must not synthesize a target read');

const historicalPload = corpus.historicalObservations.find(entry => entry.id === 'p28-pload1-exact-success');
const historicalSelection = selectAffectedVerification(historicalPload.changedFiles, impactMap);
assert.equal(historicalSelection.mode, 'full', 'mixed P28 history must retain fail-safe full fallback');
assert(historicalSelection.unknownFiles.length > 0, 'historical P28 control should preserve currently-unclassified paths as unresolved rather than infer narrowing');

const validHistoricalEvidence = {
  runRecord: {
    id: historicalPload.fullVerificationRunId,
    name: 'PR Candidate Verification',
    path: '.github/workflows/pr-candidate.yml',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    head_sha: historicalPload.candidateSha,
    head_branch: 'agent/p28-pload1-batched-refinery-instantiation',
  },
  jobs: [
    {
      id: 1,
      name: 'Candidate Build and Full Verification',
      status: 'completed',
      conclusion: 'success',
      steps: [{ name: 'Run full repository verification and production build once', status: 'completed', conclusion: 'success' }],
    },
    { id: 2, name: 'PR Candidate Verification', status: 'completed', conclusion: 'success', steps: [] },
  ],
  pullRequest: {
    number: historicalPload.pullRequest,
    base: { sha: historicalPload.baseSha },
    head: { ref: 'agent/p28-pload1-batched-refinery-instantiation' },
  },
  pullRequestCommits: [{ sha: historicalPload.candidateSha }],
  pullRequestFiles: historicalPload.changedFiles.map(filename => ({ filename })),
};
assert.equal(validateHistoricalRunEvidence(historicalPload, validHistoricalEvidence).authenticated, true);
assert.throws(
  () => validateHistoricalRunEvidence(historicalPload, {
    ...validHistoricalEvidence,
    runRecord: { ...validHistoricalEvidence.runRecord, head_sha: 'f'.repeat(40) },
  }),
  /historical run head SHA mismatch/,
  'historical authentication must reject a cross-SHA run',
);
assert.throws(
  () => validateHistoricalRunEvidence(historicalPload, {
    ...validHistoricalEvidence,
    jobs: validHistoricalEvidence.jobs.map(job => job.name === 'Candidate Build and Full Verification'
      ? { ...job, steps: job.steps.map(step => ({ ...step, conclusion: 'failure' })) }
      : job),
  }),
  /authoritative full-verification step did not pass/,
  'historical authentication must reject a failed full-verification step even when corpus metadata says success',
);
assert.throws(
  () => validateHistoricalRunEvidence(historicalPload, {
    ...validHistoricalEvidence,
    pullRequestFiles: validHistoricalEvidence.pullRequestFiles.slice(1),
  }),
  /GitHub PR changed files mismatch/,
  'historical authentication must bind the changed-file inventory',
);

const highRiskCi = selectAffectedVerification(['.github/workflows/pr-candidate.yml'], impactMap);
assert.equal(highRiskCi.mode, 'full');
assert.deepEqual(highRiskCi.verifications.map(entry => entry.id), ['verify-full']);

console.log(`EV15_IMPACT_CALIBRATION_TEST_PASS probes=${corpus.executableMissProbes.length} historical=${corpus.historicalObservations.length} wideningThreshold=${corpus.minimumIndependentMissesForWidening} uiDefault=${uiRule.risk} observer=measured historyAuth=fail-closed noNarrowing=pass`);
