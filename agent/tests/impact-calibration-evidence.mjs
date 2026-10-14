import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  recommendWidening,
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
  assert.equal(probe.wideningAction, 'escalate-rule-to-full');
}

const highRiskCi = selectAffectedVerification(['.github/workflows/pr-candidate.yml'], impactMap);
assert.equal(highRiskCi.mode, 'full');
assert.deepEqual(highRiskCi.verifications.map(entry => entry.id), ['verify-full']);

const historicalPload = corpus.historicalObservations.find(entry => entry.id === 'p28-pload1-exact-success');
const historicalSelection = selectAffectedVerification(historicalPload.changedFiles, impactMap);
assert.equal(historicalSelection.mode, 'full', 'mixed P28 history must retain fail-safe full fallback');
assert(historicalSelection.unknownFiles.length > 0, 'historical P28 control should preserve currently-unclassified paths as unresolved rather than infer narrowing');

console.log(`EV15_IMPACT_CALIBRATION_TEST_PASS probes=${corpus.executableMissProbes.length} historical=${corpus.historicalObservations.length} wideningThreshold=${corpus.minimumIndependentMissesForWidening} uiDefault=${uiRule.risk} noNarrowing=pass`);
