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
  requireCurrentState = false,
  governanceOverride = null,
} = {}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  assert(!(requirePass && requireCurrentState), 'EV-13 closeout and post-EV13 current-state verification are mutually exclusive');

  // Historical EV-13 unit fixtures intentionally model the zero-decision closeout state.
  // Production current-state verification must ignore that fixture count and enumerate
  // the repository decision directory itself through runAntibodyGovernanceAssessment.
  const recomputeDecisionRecordCount = requireCurrentState
    ? null
    : (report?.lifecycle?.decisionRecordCount ?? null);
  assert(recomputeDecisionRecordCount === null || (Number.isInteger(recomputeDecisionRecordCount) && recomputeDecisionRecordCount >= 0), 'antibody governance evidence decision count must be a non-negative integer');
  const expected = await runAntibodyGovernanceAssessment(policy, calibration, ev12Corpus, memory, {
    candidateSha,
    governanceOverride,
    decisionRecordCount: recomputeDecisionRecordCount,
  });
  assert(canonicalJson(report) === canonicalJson(expected), 'antibody governance report does not match exact candidate policy/corpus/memory recomputation');
  assert(report.enforcementEnabled === false, 'EV-13 must not enable antibody enforcement');
  assert(report.acceptedForEnforcement === false, 'EV-13 must not accept an antibody for enforcement');
  assert(report.candidatePassGranted === false, 'EV-13 evidence must never grant candidate acceptance');
  assert(report.lifecycle.trustedReviewProvenanceRequired === true, 'EV-13 must require GitHub-backed trusted review provenance');
  assert(report.lifecycle.reviewBoundToDecisionDigest === true, 'EV-13 must bind trusted review to the exact committed decision digest');
  assert(report.lifecycle.exactCommittedDecisionRequired === true, 'EV-13 authorization must load the exact committed decision from the reviewed candidate');
  assert(report.lifecycle.repositoryPinnedInputsRequired === true, 'EV-13 authorization must load pinned policy/calibration inputs from the reviewed candidate');
  assert(report.lifecycle.completeReviewHistoryRequired === true, 'EV-13 authorization must inspect complete PR review history');
  assert(report.lifecycle.canonicalSourceEntryRequired === true, 'EV-13 must verify the named canonical source entry exists');
  assert(report.lifecycle.canonicalSourceContractRequired === true, 'EV-13 must bind focused-regression and telemetry sources to the exact proposed target contract');
  assert(report.lifecycle.directDecisionEvaluatorExported === false, 'EV-13 must not expose a raw decision evaluator that bypasses trusted authorization');
  assert(report.ev12.pinnedCorpusDigestVerified === true, 'EV-13 must verify the policy-pinned EV-12 corpus digest');
  assert(report.ev12.pinnedFailureMemoryDigestVerified === true, 'EV-13 must verify the policy-pinned EV-4 failure-memory digest');
  assert(report.rollback.sourceFailureMemoryUnchanged === true, 'EV-13 must prove failure memory is unchanged');
  assert(report.rollback.ev4ModeRemainsAdvisory === true, 'EV-13 must leave EV-4 failure memory advisory');
  assert(report.rollback.existingEnforcementChanged === false, 'EV-13 rollback must not change existing enforcement');
  assert(report.rollback.disabledPromotionAuthorizations === 0, 'EV-13 rollback must disable every promotion authorization');
  assert(report.rollback.evidenceStillMeasured === true, 'EV-13 rollback must preserve the same measured governance evidence');

  if (requireCurrentState) {
    assert(report.lifecycle.decisionRecordCount > 0, 'post-EV-13 current-state verification must observe committed antibody decision history');
    assert(report.lifecycle.committedDecisionAllowedInEv13 === false, 'post-EV-13 current-state verification must preserve the historical EV-13 no-decision rule');
    assert(report.governancePass === false, 'post-EV-13 current-state verification must surface that the historical EV-13 closeout predicate no longer applies');
    assert(report.ev12.calibrationPass === true && report.ev12.eligibleScopeWithinBudget === true, 'post-EV-13 current-state verification requires exact-candidate EV-12 eligibility proof');
    assert(report.calibration.withinBudget === true, 'post-EV-13 governance calibration must stay within its zero-error budget');
    for (const key of METRIC_KEYS) assert(report.calibration.measuredErrors[key] === 0, `post-EV-13 current-state ${key} must be zero`);
  }

  if (requirePass) {
    assert(report.governancePass === true, 'EV-13 closeout requires exact-candidate governance validation to pass');
    assert(report.ev12.calibrationPass === true && report.ev12.eligibleScopeWithinBudget === true, 'EV-13 closeout requires exact-candidate EV-12 eligibility proof');
    assert(report.lifecycle.decisionRecordCount === 0, 'EV-13 closeout calibration must model the EV-13 no-decision state');
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
    requireCurrentState: false,
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
    else if (argument === '--require-current-state') options.requireCurrentState = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  assert(options.report, '--report is required');
  assert(!(options.requirePass && options.requireCurrentState), '--require-pass and --require-current-state are mutually exclusive');
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
    requireCurrentState: options.requireCurrentState,
    governanceOverride: options.disabled ? false : null,
  });
  console.log(`ANTIBODY_GOVERNANCE_EVIDENCE_PASS candidate=${options.candidateSha} governancePass=${report.governancePass} requirePass=${options.requirePass} currentState=${options.requireCurrentState} decisions=${report.lifecycle.decisionRecordCount} enforcement=${report.enforcementEnabled}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
