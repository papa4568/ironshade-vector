import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './repository-immune-system.mjs';
import { runFailureRecurrenceCalibration } from './failure-recurrence-calibration.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const METRIC_KEYS = [
  'overClusteringPairs',
  'underClusteringPairs',
  'recurrenceFalsePositiveRecords',
  'recurrenceFalseNegativeRecords',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

export function verifyFailureRecurrenceCalibrationEvidence(report, corpus, memory, {
  candidateSha,
  requirePass = false,
} = {}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  const expected = runFailureRecurrenceCalibration(corpus, memory, { candidateSha });
  assert(canonicalJson(report) === canonicalJson(expected), 'failure recurrence calibration report does not match exact candidate corpus/memory recomputation');
  assert(report.mode === 'advisory', 'EV-12 evidence must remain advisory');
  assert(report.blocking === false, 'EV-12 evidence must remain non-blocking');
  assert(report.acceptedForEnforcement === false, 'EV-12 evidence must not accept an antibody for enforcement');
  assert(report.candidatePassGranted === false, 'EV-12 evidence must never grant candidate acceptance');
  assert(report.rollback.sourceFailureMemoryUnchanged === true, 'EV-12 evidence must prove the EV-4 source failure memory is unchanged');
  assert(report.rollback.ev4ModeRemainsAdvisory === true, 'EV-12 evidence must leave EV-4 in advisory mode');
  assert(report.rollback.enforcementChanged === false, 'EV-12 evidence must not change enforcement semantics');

  if (requirePass) {
    assert(report.calibrationPass === true, 'EV-12 closeout requires the exact-candidate calibration contract to pass');
    assert(report.expectedErrorsMatch === true, 'EV-12 closeout requires all measured known-limit errors to match the reviewed corpus');
    assert(report.eligibleScope.withinBudget === true, 'EV-12 closeout requires the governance-candidate scope to remain within its error budget');
    for (const key of METRIC_KEYS) {
      assert(
        report.eligibleScope.measuredErrors[key] <= report.eligibleScope.errorBudget[key],
        `EV-12 closeout ${key} exceeds the governance-candidate error budget`,
      );
    }
    assert(report.eligibleScope.stableForGovernance.length > 0, 'EV-12 closeout must identify at least one measured signature eligible for EV-13 governance review');
    assert(report.compaction.pass === true, 'EV-12 closeout requires deterministic bounded compaction proof');
    assert(report.rejectionControls.every(entry => entry.pass), 'EV-12 closeout requires incompatible-class rejection controls to pass');
    assert(report.sourceMemoryBindings.every(entry => entry.pass), 'EV-12 closeout requires historical calibration records to bind to repository failure memory');
  }
  return report;
}

function parseArguments(argv) {
  const options = {
    candidateSha: null,
    corpus: 'agent/failure-recurrence-calibration-corpus.json',
    memory: 'agent/failure-memory.json',
    report: null,
    requirePass: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--corpus') options.corpus = argv[++index] ?? null;
    else if (argument === '--memory') options.memory = argv[++index] ?? null;
    else if (argument === '--report') options.report = argv[++index] ?? null;
    else if (argument === '--require-pass') options.requirePass = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  assert(options.report, '--report is required');
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [corpus, memory, report] = await Promise.all([
    readJson(options.corpus),
    readJson(options.memory),
    readJson(options.report),
  ]);
  verifyFailureRecurrenceCalibrationEvidence(report, corpus, memory, {
    candidateSha: options.candidateSha,
    requirePass: options.requirePass,
  });
  console.log(`FAILURE_RECURRENCE_CALIBRATION_EVIDENCE_PASS candidate=${options.candidateSha} calibrationPass=${report.calibrationPass} requirePass=${options.requirePass} blocking=${report.blocking}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
