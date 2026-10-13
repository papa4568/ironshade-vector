import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  runFailureRecurrenceCalibration,
  validateFailureRecurrenceCalibrationCorpus,
} from '../tools/failure-recurrence-calibration.mjs';
import { verifyFailureRecurrenceCalibrationEvidence } from '../tools/failure-recurrence-calibration-evidence.mjs';
import { canonicalJson } from '../tools/repository-immune-system.mjs';

const corpus = JSON.parse(await readFile(new URL('../failure-recurrence-calibration-corpus.json', import.meta.url), 'utf8'));
const memory = JSON.parse(await readFile(new URL('../failure-memory.json', import.meta.url), 'utf8'));
const candidateSha = 'c'.repeat(40);

validateFailureRecurrenceCalibrationCorpus(corpus, memory);
const memoryBefore = canonicalJson(memory);
const first = runFailureRecurrenceCalibration(corpus, memory, { candidateSha });
const second = runFailureRecurrenceCalibration(corpus, memory, { candidateSha });
assert.deepEqual(second, first, 'EV-12 calibration must be deterministic for an unchanged corpus, memory, and candidate');
assert.equal(canonicalJson(memory), memoryBefore, 'EV-12 calibration must not mutate EV-4 failure memory');
assert.equal(first.mode, 'advisory', 'EV-12 must remain advisory');
assert.equal(first.blocking, false, 'EV-12 must not become a blocking decision');
assert.equal(first.acceptedForEnforcement, false, 'EV-12 must not accept any antibody for enforcement');
assert.equal(first.candidatePassGranted, false, 'EV-12 must never grant candidate acceptance');
assert.equal(first.calibrationPass, true, 'reviewed EV-12 calibration corpus must pass its measured contract');
assert.deepEqual(first.measuredErrors, {
  overClusteringPairs: 1,
  underClusteringPairs: 1,
  recurrenceFalsePositiveRecords: 2,
  recurrenceFalseNegativeRecords: 2,
}, 'EV-12 must expose the reviewed global over/under-clustering and recurrence error controls instead of hiding them');
assert.equal(first.expectedErrorsMatch, true, 'measured known-limit errors must match the reviewed corpus');
assert.deepEqual(first.eligibleScope.measuredErrors, {
  overClusteringPairs: 0,
  underClusteringPairs: 0,
  recurrenceFalsePositiveRecords: 0,
  recurrenceFalseNegativeRecords: 0,
}, 'governance-candidate signatures must have zero measured errors');
assert.equal(first.eligibleScope.withinBudget, true, 'governance-candidate scope must remain inside its zero-error budget');
assert.deepEqual(
  first.eligibleScope.stableForGovernance.map(entry => entry.truthId),
  ['android-screenshot-capture-transport-timeout', 'candidate-artifact-integrity-drift'],
  'only the two measured deterministic recurrence signatures should be eligible for EV-13 governance review',
);
assert.deepEqual(
  first.advisoryOnly.map(entry => entry.truthId),
  ['android-evidence-ready-state-timeout-alias', 'artifact-upload-dns-resolution', 'artifact-upload-storage-throttle'],
  'known naming-sensitive and detail-only ambiguity must remain advisory',
);
assert.equal(first.pairwiseCases.filter(entry => entry.kind === 'over-clustering').length, 1, 'detail-only ambiguity must produce one measured over-clustering pair');
assert.equal(first.pairwiseCases.filter(entry => entry.kind === 'under-clustering').length, 1, 'failureClass aliasing must produce one measured under-clustering pair');
assert.equal(first.recurrenceCases.filter(entry => entry.kind === 'false-positive').length, 2, 'over-clustered singleton truth groups must produce two recurrence false-positive records');
assert.equal(first.recurrenceCases.filter(entry => entry.kind === 'false-negative').length, 2, 'under-clustered recurrence aliases must produce two recurrence false-negative records');
assert(first.sourceMemoryBindings.every(entry => entry.pass), 'historical screenshot calibration records must bind to EV-4 repository memory');
assert(first.rejectionControls.every(entry => entry.pass), 'incompatible same-label identities must be rejected instead of silently over-clustered');
assert.equal(first.compaction.pass, true, 'bounded compaction proof must pass');
assert.equal(first.compaction.deterministic, true, 'bounded compaction must be input-order deterministic');
assert.equal(first.compaction.occurrences, 100, 'compaction probe must measure one hundred recurrence observations');
assert.equal(first.compaction.retainedSamples, 3, 'compaction probe must retain only the configured bounded sample count');
assert(first.compaction.compactBytes <= first.compaction.maxSerializedBytes, 'compaction probe must stay inside the measured byte budget');
assert.equal(first.compaction.rejectBudgetPass, true, 'too-small byte budget must fail closed instead of silently discarding evidence');
assert.equal(first.rollback.sourceFailureMemoryUnchanged, true, 'rollback evidence must prove source failure memory is unchanged');
assert.equal(first.rollback.ev4ModeRemainsAdvisory, true, 'EV-4 must remain advisory throughout EV-12');
assert.equal(first.rollback.enforcementChanged, false, 'EV-12 must not change enforcement semantics');
assert(first.proposalFailureClasses.length >= 3, 'calibration should surface repeated actual failureClass proposals for measurement');
assert(first.proposalFailureClasses.every(entry => entry.acceptedForEnforcement === false), 'calibration proposals must remain unaccepted and non-enforcing');
verifyFailureRecurrenceCalibrationEvidence(first, corpus, memory, { candidateSha, requirePass: true });

const falseNegativeCorpus = structuredClone(corpus);
const artifactGroup = falseNegativeCorpus.truthGroups.find(entry => entry.truthId === 'candidate-artifact-integrity-drift');
artifactGroup.records[1].failureClass = 'candidate-artifact-integrity-drift-alias';
const falseNegative = runFailureRecurrenceCalibration(falseNegativeCorpus, memory, { candidateSha });
assert.equal(falseNegative.calibrationPass, false, 'splitting a governance-candidate recurrence must fail the calibration contract');
assert(falseNegative.eligibleScope.measuredErrors.underClusteringPairs > 0, 'eligible under-clustering must be measured');
assert(falseNegative.eligibleScope.measuredErrors.recurrenceFalseNegativeRecords > 0, 'eligible recurrence false negatives must be measured');
assert.equal(falseNegative.blocking, false, 'failed advisory calibration must still not become a repository blocker by itself');

const falsePositiveCorpus = structuredClone(corpus);
const screenshotGroup = falsePositiveCorpus.truthGroups.find(entry => entry.truthId === 'android-screenshot-capture-transport-timeout');
const movedSynthetic = screenshotGroup.records.pop();
falsePositiveCorpus.truthGroups.push({
  truthId: 'android-screenshot-capture-transport-timeout-distinct-control',
  governance: 'advisory-only',
  rationale: 'Injected test-only ground truth split must expose over-clustering against the otherwise eligible historical screenshot signature.',
  records: [movedSynthetic],
});
const falsePositive = runFailureRecurrenceCalibration(falsePositiveCorpus, memory, { candidateSha });
assert.equal(falsePositive.calibrationPass, false, 'merging a distinct truth group into a governance-candidate failureClass must fail calibration');
assert(falsePositive.eligibleScope.measuredErrors.overClusteringPairs > 0, 'eligible over-clustering must be measured');
assert(falsePositive.measuredErrors.recurrenceFalsePositiveRecords > first.measuredErrors.recurrenceFalsePositiveRecords, 'injected singleton merge must increase recurrence false positives');

assert.throws(
  () => verifyFailureRecurrenceCalibrationEvidence(first, corpus, memory, { candidateSha: 'd'.repeat(40), requirePass: true }),
  /does not match exact candidate corpus\/memory recomputation/,
  'EV-12 exact evidence must reject a report bound to another candidate SHA',
);
assert.throws(
  () => runFailureRecurrenceCalibration(corpus, memory, { candidateSha: 'not-a-sha' }),
  /candidateSha must be a full lowercase commit SHA/,
  'EV-12 reports must bind to a full exact candidate SHA',
);

const cliTemp = await mkdtemp(join(tmpdir(), 'ironshade-ev12-calibration-'));
try {
  const passingReportPath = join(cliTemp, 'passing-report.json');
  const failingCorpusPath = join(cliTemp, 'failing-corpus.json');
  const failingReportPath = join(cliTemp, 'failing-report.json');
  await writeFile(failingCorpusPath, JSON.stringify(falseNegativeCorpus), 'utf8');

  const passingCli = spawnSync(process.execPath, [
    'agent/tools/failure-recurrence-calibration.mjs',
    '--candidate-sha',
    candidateSha,
    '--output',
    passingReportPath,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(passingCli.status, 0, `passing calibration CLI should succeed: ${passingCli.stderr}`);
  const passingReport = JSON.parse(await readFile(passingReportPath, 'utf8'));
  assert.equal(passingReport.calibrationPass, true, 'CLI must persist the passing measured report');

  const passingEvidenceCli = spawnSync(process.execPath, [
    'agent/tools/failure-recurrence-calibration-evidence.mjs',
    '--candidate-sha',
    candidateSha,
    '--report',
    passingReportPath,
    '--require-pass',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(passingEvidenceCli.status, 0, `exact-candidate EV-12 evidence verifier should accept the measured passing report: ${passingEvidenceCli.stderr}`);

  const advisoryFailingCli = spawnSync(process.execPath, [
    'agent/tools/failure-recurrence-calibration.mjs',
    '--candidate-sha',
    candidateSha,
    '--corpus',
    failingCorpusPath,
    '--output',
    failingReportPath,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(advisoryFailingCli.status, 0, `a measured calibration miss must remain advisory rather than turning the analyzer into a blocking gate: ${advisoryFailingCli.stderr}`);
  const failingReport = JSON.parse(await readFile(failingReportPath, 'utf8'));
  assert.equal(failingReport.calibrationPass, false, 'advisory CLI must preserve the failed calibration signal');
  assert.equal(failingReport.blocking, false, 'advisory CLI failure must remain explicitly non-blocking');

  const failingCloseoutCli = spawnSync(process.execPath, [
    'agent/tools/failure-recurrence-calibration-evidence.mjs',
    '--candidate-sha',
    candidateSha,
    '--corpus',
    failingCorpusPath,
    '--report',
    failingReportPath,
    '--require-pass',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.notEqual(failingCloseoutCli.status, 0, 'EV-12 closeout proof must fail when the measured governance-candidate scope misses its contract');

  const malformedCli = spawnSync(process.execPath, [
    'agent/tools/failure-recurrence-calibration.mjs',
    '--candidate-sha',
    'not-a-sha',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.notEqual(malformedCli.status, 0, 'malformed EV-12 calibration invocation must fail closed as a tooling error');
} finally {
  await rm(cliTemp, { recursive: true, force: true });
}

console.log(`FAILURE_RECURRENCE_CALIBRATION_PASS globalOver=${first.measuredErrors.overClusteringPairs} globalUnder=${first.measuredErrors.underClusteringPairs} recurrenceFp=${first.measuredErrors.recurrenceFalsePositiveRecords} recurrenceFn=${first.measuredErrors.recurrenceFalseNegativeRecords} eligibleOver=${first.eligibleScope.measuredErrors.overClusteringPairs} eligibleUnder=${first.eligibleScope.measuredErrors.underClusteringPairs} stable=${first.eligibleScope.stableForGovernance.map(entry => entry.truthId).join(',')} compaction=${first.compaction.retainedSamples}/${first.compaction.occurrences} blocking=${first.blocking} mode=${first.mode}`);
