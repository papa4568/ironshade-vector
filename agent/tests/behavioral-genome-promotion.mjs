import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  calibrateBehavioralGenomePromotion,
  evaluateBehavioralGenomePromotion,
  validateBehavioralGenomePromotionPolicy,
} from '../tools/behavioral-genome-promotion-gate.mjs';

const policy = JSON.parse(await readFile(new URL('../behavioral-genome-promotion-policy.json', import.meta.url), 'utf8'));
const config = JSON.parse(await readFile(new URL('../behavioral-genome.config.json', import.meta.url), 'utf8'));
const corpus = JSON.parse(await readFile(new URL('../behavioral-genome-calibration-corpus.json', import.meta.url), 'utf8'));

function mutateAtPath(root, path, value) {
  const segments = path.split('.').filter(Boolean);
  let cursor = root;
  for (const segment of segments.slice(0, -1)) cursor = cursor[segment];
  cursor[segments.at(-1)] = structuredClone(value);
}

function observationsFor(entry) {
  const observations = structuredClone(corpus.baselineObservations);
  for (const mutation of entry.mutations) mutateAtPath(observations, mutation.path, mutation.value);
  return observations;
}

validateBehavioralGenomePromotionPolicy(policy, config, corpus);
const candidateSha = 'c'.repeat(40);
const baseSha = 'b'.repeat(40);
const calibration = calibrateBehavioralGenomePromotion(policy, config, corpus, { candidateSha });
assert.equal(calibration.calibrationPass, true, 'EV-11 calibration must preserve EV-10 zero-error evidence');
assert.equal(calibration.falsePositiveTrials, 3, 'EV-11 must measure the three EV-10 behavior-preserving controls');
assert.equal(calibration.falsePositives, 0, 'EV-11 promotion scope must have zero measured false positives');
assert.equal(calibration.falseNegativeTrials, 6, 'EV-11 must measure one representative semantic trial per validated domain');
assert.equal(calibration.falseNegatives, 0, 'EV-11 promotion scope must have zero measured false negatives');
assert.deepEqual(calibration.validatedDomains, ['load', 'mission', 'performance', 'presentation', 'resources', 'simulation']);
assert.equal(calibration.candidatePassGranted, false, 'calibration must never grant candidate acceptance');

const stable = evaluateBehavioralGenomePromotion({
  policy,
  config,
  corpus,
  baseObservations: corpus.baselineObservations,
  candidateObservations: structuredClone(corpus.baselineObservations),
  baseSha,
  candidateSha,
  taskId: 'EV-11',
});
assert.equal(stable.verdict, 'pass', 'unchanged normalized behavior must pass the promoted gate');
assert.equal(stable.blocking, false);
assert.deepEqual(stable.changedDomains, []);
assert.equal(stable.candidatePassGranted, false, 'promoted genome evidence may only block/report');

const semanticCases = corpus.cases.filter(entry => entry.kind === 'semantic-change');
for (const entry of semanticCases) {
  const candidateObservations = observationsFor(entry);
  const undeclared = evaluateBehavioralGenomePromotion({
    policy,
    config,
    corpus,
    baseObservations: corpus.baselineObservations,
    candidateObservations,
    baseSha,
    candidateSha,
    taskId: 'EV-11',
  });
  assert.equal(undeclared.blocking, true, `${entry.id} must block when its calibrated semantic delta is undeclared`);
  assert.deepEqual(undeclared.blockingDomains, [...entry.expectedChangedDomains].sort(), `${entry.id} must identify exactly its calibrated domain`);
  assert.equal(undeclared.verdict, 'fail');

  const declared = evaluateBehavioralGenomePromotion({
    policy,
    config,
    corpus,
    baseObservations: corpus.baselineObservations,
    candidateObservations,
    baseSha,
    candidateSha,
    taskId: 'EV-11',
    declaration: {
      schemaVersion: 1,
      taskId: 'EV-11',
      domains: entry.expectedChangedDomains,
      rationale: `intentional ${entry.id}`,
    },
  });
  assert.equal(declared.blocking, false, `${entry.id} must pass when the exact changed domain is explicitly declared`);
  assert.equal(declared.verdict, 'pass');
  assert.deepEqual(declared.blockingDomains, []);
  for (const domain of entry.expectedChangedDomains) {
    assert.equal(declared.domainResults.find(result => result.domain === domain)?.outcome, 'declared');
  }
}

const noiseCases = corpus.cases.filter(entry => entry.kind === 'noise-control');
for (const entry of noiseCases) {
  const noise = evaluateBehavioralGenomePromotion({
    policy,
    config,
    corpus,
    baseObservations: corpus.baselineObservations,
    candidateObservations: observationsFor(entry),
    baseSha,
    candidateSha,
    taskId: 'EV-11',
  });
  assert.equal(noise.blocking, false, `${entry.id} must not create a false-positive block`);
  assert.deepEqual(noise.changedDomains, [], `${entry.id} must remain outside promoted semantic resolution`);
}

const simulationCase = semanticCases.find(entry => entry.expectedChangedDomains.includes('simulation'));
assert(simulationCase, 'simulation semantic calibration case is required');
const rollback = evaluateBehavioralGenomePromotion({
  policy,
  config,
  corpus,
  baseObservations: corpus.baselineObservations,
  candidateObservations: observationsFor(simulationCase),
  baseSha,
  candidateSha,
  taskId: 'EV-11',
  enforcementOverride: false,
});
assert.equal(rollback.wouldBlock, true, 'rollback evidence must still expose the undeclared calibrated delta');
assert.equal(rollback.blocking, false, 'rollback must remove only the blocking decision');
assert.equal(rollback.verdict, 'disabled-advisory');
assert.equal(rollback.mode, 'advisory-rollback');
assert.deepEqual(rollback.blockingDomains, ['simulation']);

const tamperedConfig = structuredClone(config);
tamperedConfig.domains.simulation.normalizers.time.decimals = 2;
assert.throws(
  () => validateBehavioralGenomePromotionPolicy(policy, tamperedConfig, corpus),
  /config digest must remain pinned to EV-10 calibration/,
  'normalization drift must require a separate recalibration instead of silently widening EV-11',
);

assert.throws(
  () => evaluateBehavioralGenomePromotion({
    policy,
    config,
    corpus,
    baseObservations: corpus.baselineObservations,
    candidateObservations: observationsFor(simulationCase),
    baseSha,
    candidateSha,
    taskId: 'EV-11',
    declaration: {
      schemaVersion: 1,
      taskId: 'EV-11',
      domains: ['unmeasured-domain'],
      rationale: 'should fail',
    },
  }),
  /unsupported domain/,
  'declarations must not expand beyond EV-10 validated scope',
);

assert.throws(
  () => evaluateBehavioralGenomePromotion({
    policy,
    config,
    corpus,
    baseObservations: corpus.baselineObservations,
    candidateObservations: corpus.baselineObservations,
    baseSha: candidateSha,
    candidateSha,
    taskId: 'EV-11',
  }),
  /distinct base and candidate SHAs/,
  'promotion evidence must bind distinct exact base/head revisions',
);

console.log('BEHAVIORAL_GENOME_PROMOTION_PASS falsePositives=0/3 falseNegatives=0/6 declarations=required rollback=advisory exactSha=bound scope=ev10-pinned');
