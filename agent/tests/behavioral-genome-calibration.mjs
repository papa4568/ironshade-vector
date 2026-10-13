import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  runBehavioralGenomeCalibration,
  validateBehavioralGenomeCalibrationCorpus,
} from '../tools/behavioral-genome-calibration.mjs';
import { verifyBehavioralGenomeCalibrationEvidence } from '../tools/behavioral-genome-calibration-evidence.mjs';

const config = JSON.parse(await readFile(new URL('../behavioral-genome.config.json', import.meta.url), 'utf8'));
const corpus = JSON.parse(await readFile(new URL('../behavioral-genome-calibration-corpus.json', import.meta.url), 'utf8'));
const candidateSha = 'd'.repeat(40);

validateBehavioralGenomeCalibrationCorpus(corpus, config);
const first = runBehavioralGenomeCalibration(corpus, config, { candidateSha });
const second = runBehavioralGenomeCalibration(corpus, config, { candidateSha });
assert.deepEqual(second, first, 'EV-10 calibration must be deterministic for an unchanged corpus/config/candidate');
assert.equal(first.mode, 'advisory', 'EV-10 must remain advisory');
assert.equal(first.blocking, false, 'EV-10 calibration must never become a blocking decision');
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
verifyBehavioralGenomeCalibrationEvidence(first, corpus, config, { candidateSha, requirePass: true });

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
assert.equal(falsePositive.blocking, false, 'a calibration-budget failure must remain advisory');
assert.equal(falsePositive.falsePositives, 1, 'the mislabeled simulation change must count as one false positive');
assert.equal(falsePositive.domainMetrics.simulation.falsePositives, 1, 'false positive must be attributed to the simulation domain');
verifyBehavioralGenomeCalibrationEvidence(falsePositive, falsePositiveCorpus, config, { candidateSha });
assert.throws(
  () => verifyBehavioralGenomeCalibrationEvidence(falsePositive, falsePositiveCorpus, config, { candidateSha, requirePass: true }),
  /EV-10 closeout requires the exact-candidate calibration to meet its measured budgets/,
  'EV-10 closeout proof must reject a measured calibration failure without changing advisory runtime semantics',
);

const falseNegativeCorpus = structuredClone(corpus);
const simulationCase = falseNegativeCorpus.cases.find(entry => entry.id === 'simulation-player-health-change');
simulationCase.mutations = [{ path: 'domains.simulation.time', value: 2.0000001 }];
const falseNegative = runBehavioralGenomeCalibration(falseNegativeCorpus, config, { candidateSha });
assert.equal(falseNegative.calibrationPass, false, 'a false negative above the zero budget must fail calibration');
assert.equal(falseNegative.blocking, false, 'a false-negative calibration result must remain advisory');
assert.equal(falseNegative.falseNegatives, 1, 'normalized-away semantic trial must count as one false negative');
assert.equal(falseNegative.domainMetrics.simulation.falseNegatives, 1, 'false negative must be attributed to the simulation domain');
assert.throws(
  () => verifyBehavioralGenomeCalibrationEvidence(first, corpus, config, { candidateSha: 'e'.repeat(40), requirePass: true }),
  /does not match exact candidate config\/corpus recomputation/,
  'EV-10 closeout evidence must reject a report from a different candidate SHA',
);

const cliTemp = await mkdtemp(join(tmpdir(), 'ironshade-ev10-calibration-'));
try {
  const failingCorpusPath = join(cliTemp, 'failing-corpus.json');
  const passingReportPath = join(cliTemp, 'passing-report.json');
  const failingReportPath = join(cliTemp, 'failing-report.json');
  await writeFile(failingCorpusPath, JSON.stringify(falsePositiveCorpus), 'utf8');
  await writeFile(passingReportPath, JSON.stringify(first), 'utf8');
  await writeFile(failingReportPath, JSON.stringify(falsePositive), 'utf8');

  const advisoryCli = spawnSync(process.execPath, [
    'agent/tools/behavioral-genome-calibration.mjs',
    '--candidate-sha',
    candidateSha,
    '--config',
    'agent/behavioral-genome.config.json',
    '--corpus',
    failingCorpusPath,
    '--json',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(advisoryCli.status, 0, `advisory calibration-budget failure must not fail CI: ${advisoryCli.stderr}`);
  const advisoryReport = JSON.parse(advisoryCli.stdout);
  assert.equal(advisoryReport.calibrationPass, false, 'CLI must preserve the failed calibration signal');
  assert.equal(advisoryReport.blocking, false, 'CLI report must explicitly remain non-blocking');

  const passingEvidenceCli = spawnSync(process.execPath, [
    'agent/tools/behavioral-genome-calibration-evidence.mjs',
    '--candidate-sha',
    candidateSha,
    '--report',
    passingReportPath,
    '--require-pass',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(passingEvidenceCli.status, 0, `exact-candidate EV-10 closeout proof should accept the measured passing report: ${passingEvidenceCli.stderr}`);

  const advisoryEvidenceCli = spawnSync(process.execPath, [
    'agent/tools/behavioral-genome-calibration-evidence.mjs',
    '--candidate-sha',
    candidateSha,
    '--corpus',
    failingCorpusPath,
    '--report',
    failingReportPath,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(advisoryEvidenceCli.status, 0, `advisory evidence verification should preserve a measured failing report: ${advisoryEvidenceCli.stderr}`);

  const failingCloseoutCli = spawnSync(process.execPath, [
    'agent/tools/behavioral-genome-calibration-evidence.mjs',
    '--candidate-sha',
    candidateSha,
    '--corpus',
    failingCorpusPath,
    '--report',
    failingReportPath,
    '--require-pass',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.notEqual(failingCloseoutCli.status, 0, 'EV-10 closeout proof must fail when the exact report misses its measured budgets');

  const malformedCli = spawnSync(process.execPath, [
    'agent/tools/behavioral-genome-calibration.mjs',
    '--candidate-sha',
    'not-a-sha',
    '--config',
    'agent/behavioral-genome.config.json',
    '--corpus',
    failingCorpusPath,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.notEqual(malformedCli.status, 0, 'invalid calibration invocation must still fail closed as a tooling error');
} finally {
  await rm(cliTemp, { recursive: true, force: true });
}

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

console.log(`BEHAVIORAL_GENOME_CALIBRATION_PASS cases=${first.cases.length} validated=${first.validatedDomains.join(',')} falsePositives=${first.falsePositives} falseNegatives=${first.falseNegatives} unresolved=${first.unresolvedCases.length} blocking=${first.blocking} mode=advisory closeoutProof=exact-sha`);
