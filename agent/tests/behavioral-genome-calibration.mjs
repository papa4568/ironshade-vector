import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  runBehavioralGenomeCalibration,
  validateBehavioralGenomeCalibrationCorpus,
} from '../tools/behavioral-genome-calibration.mjs';

const config = JSON.parse(await readFile(new URL('../behavioral-genome.config.json', import.meta.url), 'utf8'));
const corpus = JSON.parse(await readFile(new URL('../behavioral-genome-calibration-corpus.json', import.meta.url), 'utf8'));
const candidateSha = 'd'.repeat(40);

validateBehavioralGenomeCalibrationCorpus(corpus, config);
const first = runBehavioralGenomeCalibration(corpus, config, { candidateSha });
const second = runBehavioralGenomeCalibration(corpus, config, { candidateSha });
assert.deepEqual(second, first, 'EV-10 calibration must be deterministic for an unchanged corpus/config/candidate');
assert.equal(first.mode, 'advisory', 'EV-10 must remain advisory');
assert.equal(first.acceptedForEnforcement, false, 'EV-10 must not accept any domain for enforcement itself');
assert.equal(first.candidatePassGranted, false, 'EV-10 calibration must never grant candidate acceptance');
assert.equal(first.calibrationPass, true, 'representative calibration corpus must meet its measured error budgets');
assert.equal(first.falsePositives, 0, 'representative calibration must have zero false positives');
assert.equal(first.falseNegatives, 0, 'representative calibration must have zero false negatives');
assert.deepEqual(
  first.validatedDomains,
  ['load', 'mission', 'performance', 'presentation', 'resources', 'simulation'],
  'all six representative semantic domain probes should be detectable after configured normalization',
);
assert.equal(first.cases.filter(entry => entry.kind === 'noise-control').length, 3, 'calibration must include three behavior-preserving controls');
assert.equal(first.cases.filter(entry => entry.kind === 'semantic-change').length, 6, 'calibration must include one representative semantic mutation per domain');
assert(first.cases.every(entry => entry.pass), 'every representative control and semantic mutation must classify as expected');
for (const domain of config.requiredDomains) {
  assert.equal(first.domainMetrics[domain].semanticTrials, 1, `${domain} must have one representative semantic trial`);
  assert.equal(first.domainMetrics[domain].detectedSemanticTrials, 1, `${domain} semantic trial must be detected`);
  assert.equal(first.domainMetrics[domain].falsePositives, 0, `${domain} must have zero false positives`);
  assert.equal(first.domainMetrics[domain].falseNegatives, 0, `${domain} must have zero false negatives`);
  assert.equal(first.promotionScope[domain].status, 'eligible-for-ev11-review', `${domain} should be eligible only for EV-11 review, not auto-promotion`);
}
assert.deepEqual(
  first.unresolvedCases.map(entry => entry.id),
  ['load-duration-excluded', 'normalized-thresholds-not-semantic-resolution', 'representative-route-not-complete-product-observer'],
  'EV-10 must preserve explicit unresolved scope instead of overclaiming coverage',
);
assert(first.promotionScope.load.unresolvedCaseIds.includes('load-duration-excluded'), 'load promotion scope must disclose excluded wall-clock duration');
assert(first.promotionScope.performance.unresolvedCaseIds.includes('normalized-thresholds-not-semantic-resolution'), 'performance promotion scope must disclose bucketing limits');
assert(first.promotionScope.simulation.unresolvedCaseIds.includes('representative-route-not-complete-product-observer'), 'promotion scope must disclose representative-route coverage limits');

const falsePositiveCorpus = structuredClone(corpus);
falsePositiveCorpus.cases.push({
  id: 'dishonest-noise-label',
  kind: 'noise-control',
  description: 'A semantic change mislabeled as noise must be measured as a false positive.',
  mutations: [{ path: 'domains.simulation.player.hp', value: 75 }],
  expectedChangedDomains: [],
});
const falsePositive = runBehavioralGenomeCalibration(falsePositiveCorpus, config, { candidateSha });
assert.equal(falsePositive.calibrationPass, false, 'a false positive above the zero budget must fail calibration');
assert.equal(falsePositive.falsePositives, 1, 'the mislabeled simulation change must count as one false positive');
assert.equal(falsePositive.domainMetrics.simulation.falsePositives, 1, 'false positive must be attributed to the simulation domain');

const falseNegativeCorpus = structuredClone(corpus);
const simulationCase = falseNegativeCorpus.cases.find(entry => entry.id === 'simulation-player-health-change');
simulationCase.mutations = [{ path: 'domains.simulation.time', value: 2.0000001 }];
const falseNegative = runBehavioralGenomeCalibration(falseNegativeCorpus, config, { candidateSha });
assert.equal(falseNegative.calibrationPass, false, 'a false negative above the zero budget must fail calibration');
assert.equal(falseNegative.falseNegatives, 1, 'normalized-away semantic trial must count as one false negative');
assert.equal(falseNegative.domainMetrics.simulation.falseNegatives, 1, 'false negative must be attributed to the simulation domain');

assert.throws(
  () => runBehavioralGenomeCalibration(corpus, config, { candidateSha: 'not-a-sha' }),
  /candidateSha must be a full lowercase commit SHA/,
  'calibration evidence must bind to an exact candidate SHA',
);

const escapedCorpus = structuredClone(corpus);
escapedCorpus.cases[0].mutations = [{ path: 'domains.__proto__.polluted', value: true }];
assert.throws(
  () => validateBehavioralGenomeCalibrationCorpus(escapedCorpus, config),
  /forbidden segment __proto__/,
  'calibration mutations must not escape through prototype paths',
);

console.log(`BEHAVIORAL_GENOME_CALIBRATION_PASS cases=${first.cases.length} validated=${first.validatedDomains.join(',')} falsePositives=${first.falsePositives} falseNegatives=${first.falseNegatives} unresolved=${first.unresolvedCases.length} mode=advisory`);
