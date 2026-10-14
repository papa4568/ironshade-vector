import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './repository-immune-system.mjs';
import { runAntibodyGovernanceAssessment } from './antibody-governance.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const METRIC_KEYS = [
  'transitionFalsePositives',
  'transitionFalseNegatives',
  'promotionFalsePositives',
  'promotionFalseNegatives',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

export async function verifyAntibodyGovernanceEvidence(report, policy, calibration, ev12Corpus, memory, {
  candidateSha,
  requirePass = false,
  governanceOverride = null,
} = {}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  const expected = await runAntibodyGovernanceAssessment(policy, calibration, ev12Corpus, memory, {
    candidateSha,
    governanceOverride,
  });
  assert(canonicalJson(report) === canonicalJson(expected), 'antibody governance report does not match exact candidate policy/corpus/memory recomputation');
  assert(report.enforcementEnabled === false, 'EV-13 must not enable antibody enforcement');
  assert(report.acceptedForEnforcement === false, 'EV-13 must not accept an antibody for enforcement');
  assert(report.candidatePassGranted === false, 'EV-13 evidence must never grant candidate acceptance');
  assert(report.lifecycle.trustedReviewProvenanceRequired === true, 'EV-13 must require GitHub-backed trusted review provenance');
  assert(report.lifecycle.canonicalSourceEntryRequired === true, 'EV-13 must verify the named canonical source entry exists');
  assert(report.lifecycle.directDecisionEvaluatorExported === false, 'EV-13 must not expose a raw decision evaluator that bypasses trusted authorization');
  assert(report.ev12.pinnedCorpusDigestVerified === true, 'EV-13 must verify the policy-pinned EV-12 corpus digest');
  assert(report.ev12.pinnedFailureMemoryDigestVerified === true, 'EV-13 must verify the policy-pinned EV-4 failure-memory digest');
  assert(report.rollback.sourceFailureMemoryUnchanged === true, 'EV-13 must prove failure memory is unchanged');
  assert(report.rollback.ev4ModeRemainsAdvisory === true, 'EV-13 must leave EV-4 failure memory advisory');
  assert(report.rollback.existingEnforcementChanged === false, 'EV-13 rollback must not change existing enforcement');
  assert(report.rollback.disabledPromotionAuthorizations === 0, 'EV-13 rollback must disable every promotion authorization');
  assert(report.rollback.evidenceStillMeasured === true, 'EV-13 rollback must preserve the same measured governance evidence');

  if (requirePass) {
    assert(report.governancePass === true, 'EV-13 closeout requires exact-candidate governance validation to pass');
    assert(report.ev12.calibrationPass === true && report.ev12.eligibleScopeWithinBudget === true, 'EV-13 closeout requires exact-candidate EV-12 eligibility proof');
    assert(report.lifecycle.decisionRecordCount === 0, 'EV-13 closeout must not commit an accepted antibody decision');
    assert(report.calibration.withinBudget === true, 'EV-13 governance calibration must stay within its zero-error budget');
    for (const key of METRIC_KEYS) assert(report.calibration.measuredErrors[key] === 0, `EV-13 closeout ${key} must be zero`);
  }
  return report;
}

function parseArguments(argv) {
  const options = {
    candidateSha: null,
    policy: 'agent/antibody-governance-policy.json',
    calibration: 'agent/antibody-governance-calibration-corpus.json',
    ev12Corpus: 'agent/failure-recurrence-calibration-corpus.json',
    memory: 'agent/failure-memory.json',
    report: null,
    disabled: false,
    requirePass: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--policy') options.policy = argv[++index] ?? null;
    else if (argument === '--calibration') options.calibration = argv[++index] ?? null;
    else if (argument === '--ev12-corpus') options.ev12Corpus = argv[++index] ?? null;
    else if (argument === '--memory') options.memory = argv[++index] ?? null;
    else if (argument === '--report') options.report = argv[++index] ?? null;
    else if (argument === '--disabled') options.disabled = true;
    else if (argument === '--require-pass') options.requirePass = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  assert(options.report, '--report is required');
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [policy, calibration, ev12Corpus, memory, report] = await Promise.all([
    readJson(options.policy),
    readJson(options.calibration),
    readJson(options.ev12Corpus),
    readJson(options.memory),
    readJson(options.report),
  ]);
  await verifyAntibodyGovernanceEvidence(report, policy, calibration, ev12Corpus, memory, {
    candidateSha: options.candidateSha,
    requirePass: options.requirePass,
    governanceOverride: options.disabled ? false : null,
  });
  console.log(`ANTIBODY_GOVERNANCE_EVIDENCE_PASS candidate=${options.candidateSha} governancePass=${report.governancePass} requirePass=${options.requirePass} enforcement=${report.enforcementEnabled}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
