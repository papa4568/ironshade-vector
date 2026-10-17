import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './behavioral-genome.mjs';
import { runBehavioralGenomeCalibration } from './behavioral-genome-calibration.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

export function verifyBehavioralGenomeCalibrationEvidence(report, corpus, config, {
  candidateSha,
  requirePass = false,
} = {}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  const expected = runBehavioralGenomeCalibration(corpus, config, { candidateSha });
  assert(canonicalJson(report) === canonicalJson(expected), 'behavioral genome calibration report does not match exact candidate config/corpus recomputation');
  assert(report.mode === 'advisory', 'behavioral genome calibration evidence must remain advisory');
  assert(report.blocking === false, 'behavioral genome calibration evidence must remain non-blocking');
  assert(report.acceptedForEnforcement === false, 'EV-10 evidence must not accept enforcement');
  assert(report.candidatePassGranted === false, 'EV-10 evidence must not grant candidate acceptance');
  if (requirePass) {
    assert(report.calibrationPass === true, 'EV-10 closeout requires the exact-candidate calibration to meet its measured budgets');
    assert(report.falsePositives <= report.falsePositiveBudget, 'EV-10 closeout false positives exceed the recorded budget');
    assert(report.falseNegatives <= report.falseNegativeBudget, 'EV-10 closeout false negatives exceed the recorded budget');
    assert(report.validatedDomains.length === config.requiredDomains.length, 'EV-10 closeout must validate every required representative domain probe');
  }
  return report;
}

function parseArguments(argv) {
  const options = {
    candidateSha: null,
    config: 'agent/behavioral-genome.config.json',
    corpus: 'agent/behavioral-genome-calibration-corpus.json',
    report: null,
    requirePass: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--config') options.config = argv[++index] ?? null;
    else if (argument === '--corpus') options.corpus = argv[++index] ?? null;
    else if (argument === '--report') options.report = argv[++index] ?? null;
    else if (argument === '--require-pass') options.requirePass = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  assert(options.report, '--report is required');
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [config, corpus, report] = await Promise.all([
    readJson(options.config),
    readJson(options.corpus),
    readJson(options.report),
  ]);
  verifyBehavioralGenomeCalibrationEvidence(report, corpus, config, {
    candidateSha: options.candidateSha,
    requirePass: options.requirePass,
  });
  console.log(`BEHAVIORAL_GENOME_CALIBRATION_EVIDENCE_PASS candidate=${options.candidateSha} calibrationPass=${report.calibrationPass} requirePass=${options.requirePass} blocking=${report.blocking}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
