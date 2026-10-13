import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './behavioral-genome.mjs';
import { evaluateBehavioralGenomePromotion } from './behavioral-genome-promotion-gate.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function readOptionalJson(path) {
  if (!path) return null;
  try {
    return await readJson(path);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
    throw error;
  }
}

export function verifyBehavioralGenomePromotionEvidence(report, {
  policy,
  config,
  corpus,
  baseObservations,
  candidateObservations,
  declaration = null,
  baseSha,
  candidateSha,
  taskId,
  requirePass = false,
} = {}) {
  assert(SHA_PATTERN.test(baseSha ?? ''), 'baseSha must be a full lowercase commit SHA');
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  assert(typeof taskId === 'string' && taskId.trim(), 'taskId must be non-empty');
  const expected = evaluateBehavioralGenomePromotion({
    policy,
    config,
    corpus,
    baseObservations,
    candidateObservations,
    declaration,
    baseSha,
    candidateSha,
    taskId,
    enforcementOverride: report.enforcementEnabled,
  });
  assert(canonicalJson(report) === canonicalJson(expected), 'behavioral genome promotion report does not match exact base/head evidence recomputation');
  assert(report.baseSha === baseSha, 'behavioral genome promotion evidence base SHA mismatch');
  assert(report.candidateSha === candidateSha, 'behavioral genome promotion evidence candidate SHA mismatch');
  assert(report.taskId === taskId, 'behavioral genome promotion evidence task mismatch');
  assert(report.calibration.falsePositives === 0, 'behavioral genome promotion evidence contains false positives');
  assert(report.calibration.falseNegatives === 0, 'behavioral genome promotion evidence contains false negatives');
  assert(report.candidatePassGranted === false, 'behavioral genome promotion evidence must never grant candidate acceptance');
  if (requirePass) {
    assert(report.enforcementEnabled === true, 'EV-11 closeout requires default behavioral genome enforcement to be enabled');
    assert(report.mode === 'enforced', 'EV-11 closeout requires enforced mode');
    assert(report.blocking === false, 'EV-11 closeout behavioral genome evidence must not be blocking');
    assert(report.verdict === 'pass', 'EV-11 closeout requires a passing behavioral genome promotion verdict');
    assert(report.calibration.calibrationPass === true, 'EV-11 closeout requires the pinned EV-10 calibration to pass');
  }
  return report;
}

function parseArguments(argv) {
  const options = {
    policy: 'agent/behavioral-genome-promotion-policy.json',
    config: 'agent/behavioral-genome.config.json',
    corpus: 'agent/behavioral-genome-calibration-corpus.json',
    baseObservations: null,
    candidateObservations: null,
    declaration: null,
    report: null,
    baseSha: null,
    candidateSha: null,
    taskId: null,
    requirePass: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--policy') options.policy = argv[++index] ?? null;
    else if (argument === '--config') options.config = argv[++index] ?? null;
    else if (argument === '--corpus') options.corpus = argv[++index] ?? null;
    else if (argument === '--base-observations') options.baseObservations = argv[++index] ?? null;
    else if (argument === '--candidate-observations') options.candidateObservations = argv[++index] ?? null;
    else if (argument === '--declaration') options.declaration = argv[++index] ?? null;
    else if (argument === '--report') options.report = argv[++index] ?? null;
    else if (argument === '--base-sha') options.baseSha = argv[++index] ?? null;
    else if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--task-id') options.taskId = argv[++index] ?? null;
    else if (argument === '--require-pass') options.requirePass = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  assert(options.baseObservations, '--base-observations is required');
  assert(options.candidateObservations, '--candidate-observations is required');
  assert(options.report, '--report is required');
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [policy, config, corpus, baseObservations, candidateObservations, declaration, report] = await Promise.all([
    readJson(options.policy),
    readJson(options.config),
    readJson(options.corpus),
    readJson(options.baseObservations),
    readJson(options.candidateObservations),
    readOptionalJson(options.declaration),
    readJson(options.report),
  ]);
  verifyBehavioralGenomePromotionEvidence(report, {
    policy,
    config,
    corpus,
    baseObservations,
    candidateObservations,
    declaration,
    baseSha: options.baseSha,
    candidateSha: options.candidateSha,
    taskId: options.taskId,
    requirePass: options.requirePass,
  });
  console.log(`BEHAVIORAL_GENOME_PROMOTION_EVIDENCE_PASS task=${options.taskId} base=${options.baseSha} candidate=${options.candidateSha} verdict=${report.verdict} falsePositives=${report.calibration.falsePositives} falseNegatives=${report.calibration.falseNegatives} blocking=${report.blocking}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(`BEHAVIORAL_GENOME_PROMOTION_EVIDENCE_ERROR ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
