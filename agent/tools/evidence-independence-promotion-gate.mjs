import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson, loadEvidenceGraph, sha256Value } from './evidence-independence.mjs';
import {
  resolveEvidenceIndependenceEnforcement,
  runEvidenceIndependenceGate,
  validateEvidenceIndependencePolicy,
} from './evidence-independence-gate.mjs';
import {
  calibratePrCandidateHeadObserver,
  observePrCandidateHeadContract,
} from './pr-candidate-head-observer.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DEFAULT_GRAPH = 'agent/evidence-independence.json';
const DEFAULT_POLICY = 'agent/evidence-independence-policy.json';
const REQUIRED_SEMANTIC_WORKFLOW = '.github/workflows/pr-candidate.yml';
const PROMOTION_SCHEMA = 'ironshade-evidence-independence-promotion-gate:v2';
const PR_HEAD_REF = '${{ github.event.pull_request.head.sha }}';
const SYNTHETIC_EVENT_REF = '${{ github.sha }}';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim(), `${label} must be a non-empty string`);
}

function loadCandidateGitObjectText(candidateSha, path) {
  assert(typeof candidateSha === 'string' && SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase Git SHA');
  assertString(path, 'candidate Git object path');
  const gitObject = `${candidateSha}:${path}`;
  try {
    const text = execFileSync('git', ['show', gitObject], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert(text.trim().length > 0, `candidate Git object ${gitObject} must be non-empty`);
    return { gitObject, text, sha256: sha256Value(text) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`unable to load immutable candidate Git object ${gitObject}: ${detail}`);
  }
}

function calibrateWorkflowSourceProvenance({ candidateSha, workflowPath, candidateWorkflowText, workspaceWorkflowText }) {
  const dishonestWorkspaceText = candidateWorkflowText.replace(
    `ref: ${PR_HEAD_REF}`,
    `ref: ${SYNTHETIC_EVENT_REF}`,
  );
  assert(dishonestWorkspaceText !== candidateWorkflowText, 'workflow provenance calibration mutation target is missing');
  const exactCandidateObservation = observePrCandidateHeadContract({
    workflowText: candidateWorkflowText,
    candidateSha,
  });
  const substitutedWorkspaceObservation = observePrCandidateHeadContract({
    workflowText: dishonestWorkspaceText,
    candidateSha,
  });
  const substitutedWorkspaceRejected = substitutedWorkspaceObservation.pass === false
    && substitutedWorkspaceObservation.failedCheckIds.includes('candidate-build-checkout')
    && substitutedWorkspaceObservation.failedCheckIds.includes('no-synthetic-merge-ref');
  const falseNegatives = substitutedWorkspaceRejected ? 0 : 1;
  const pass = exactCandidateObservation.pass === true && falseNegatives === 0;
  return {
    schema: 'ironshade-semantic-workflow-provenance:v1',
    candidateSha,
    workflowPath,
    source: 'candidate-git-object',
    gitObject: `${candidateSha}:${workflowPath}`,
    candidateWorkflowSha256: sha256Value(candidateWorkflowText),
    workingTreeWorkflowSha256: sha256Value(workspaceWorkflowText),
    workingTreeMatchesCandidate: workspaceWorkflowText === candidateWorkflowText,
    workingTreeAuthoritative: false,
    trials: 1,
    falseNegatives,
    falseNegativeRate: falseNegatives,
    attack: {
      id: 'mutable-workspace-substitution',
      exactCandidateObserved: exactCandidateObservation.pass,
      substitutedWorkspaceRejected,
      substitutedWorkspaceFailedCheckIds: substitutedWorkspaceObservation.failedCheckIds,
      authoritativeSourceUnaffected: true,
    },
    pass,
  };
}

export function validateSemanticObserverPolicy(policy, graph) {
  validateEvidenceIndependencePolicy(policy, graph);
  assertObject(policy.semanticObserver, 'evidence independence policy semanticObserver');
  const semantic = policy.semanticObserver;
  assertString(semantic.criterionId, 'semanticObserver.criterionId');
  assertString(semantic.observerSourceId, 'semanticObserver.observerSourceId');
  assertString(semantic.workflowPath, 'semanticObserver.workflowPath');
  assert(
    semantic.workflowPath === REQUIRED_SEMANTIC_WORKFLOW,
    `semanticObserver.workflowPath must remain ${REQUIRED_SEMANTIC_WORKFLOW}`,
  );
  assert(semantic.falsePositiveBudget === 0, 'semanticObserver.falsePositiveBudget must be zero');
  assert(semantic.falseNegativeBudget === 0, 'semanticObserver.falseNegativeBudget must be zero');
  assert(policy.enforcedCriterionIds.length === 1, 'EV-9 semantic observer currently supports exactly one enforced criterion');
  assert(policy.enforcedCriterionIds[0] === semantic.criterionId, 'semanticObserver.criterionId must match the enforced criterion');

  const source = graph.sources.find(entry => entry.id === semantic.observerSourceId);
  assert(source, `semantic observer source ${semantic.observerSourceId} is missing from evidence graph`);
  assert(source.kind === 'observer', `semantic observer source ${semantic.observerSourceId} must have kind observer`);
  assert(source.path === 'agent/tools/pr-candidate-head-observer.mjs', 'semantic observer source path must remain agent/tools/pr-candidate-head-observer.mjs');

  const criterion = graph.criteria.find(entry => entry.id === semantic.criterionId);
  assert(criterion, `semantic observer criterion ${semantic.criterionId} is missing from evidence graph`);
  const proofIds = new Set(criterion.proofRecordIds);
  const proofSignalIds = new Set(
    graph.proofRecords
      .filter(proof => proofIds.has(proof.id))
      .flatMap(proof => proof.signalIds),
  );
  const observerIsMaterial = graph.signals.some(signal =>
    proofSignalIds.has(signal.id)
    && signal.materiality === 'material'
    && signal.sourceDependencies.some(dependency => dependency.role === 'derives' && dependency.sourceId === semantic.observerSourceId),
  );
  assert(observerIsMaterial, `semantic observer ${semantic.observerSourceId} must materially derive the enforced criterion`);
  return semantic;
}

export function buildEvidenceIndependencePromotionDecision({
  policy,
  graph,
  baseDecision,
  semanticObservation,
  semanticCalibration,
  semanticWorkflowProvenance = null,
  candidateSha,
  enforcementOverride,
  env = process.env,
} = {}) {
  assert(typeof candidateSha === 'string' && SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase Git SHA');
  const semanticPolicy = validateSemanticObserverPolicy(policy, graph);
  assertObject(baseDecision, 'base evidence independence decision');
  assert(baseDecision.candidateSha === candidateSha, 'base evidence independence decision candidate SHA mismatch');
  assertObject(semanticObservation, 'semantic observation');
  assert(semanticObservation.schema === 'ironshade-pr-candidate-head-observer:v2', 'unsupported semantic observation schema');
  assert(semanticObservation.parsingMode === 'structured-jobs-steps', 'semantic observation must use structured workflow parsing');
  assert(semanticObservation.candidateSha === candidateSha, 'semantic observation candidate SHA mismatch');
  assert(semanticObservation.criterionId === semanticPolicy.criterionId, 'semantic observation criterion mismatch');
  assert(semanticObservation.observerSource === 'agent/tools/pr-candidate-head-observer.mjs', 'semantic observation source mismatch');
  assertObject(semanticCalibration, 'semantic calibration');
  assert(semanticCalibration.schema === 'ironshade-pr-candidate-head-observer-calibration:v2', 'unsupported semantic calibration schema');
  assert(semanticCalibration.candidateSha === candidateSha, 'semantic calibration candidate SHA mismatch');

  const semanticFailures = [];
  if (semanticObservation.pass !== true) semanticFailures.push(`semantic observer failed: ${semanticObservation.failedCheckIds.join(', ') || 'unknown'}`);
  if (semanticCalibration.baselinePass !== true) semanticFailures.push('semantic calibration baseline failed');
  if (semanticCalibration.falsePositives > semanticPolicy.falsePositiveBudget) {
    semanticFailures.push(`semantic false positives ${semanticCalibration.falsePositives} exceed budget ${semanticPolicy.falsePositiveBudget}`);
  }
  if (semanticCalibration.falseNegatives > semanticPolicy.falseNegativeBudget) {
    semanticFailures.push(`semantic false negatives ${semanticCalibration.falseNegatives} exceed budget ${semanticPolicy.falseNegativeBudget}`);
  }
  if (!semanticWorkflowProvenance) {
    semanticFailures.push('semantic workflow provenance is missing');
  } else {
    const expectedGitObject = `${candidateSha}:${semanticPolicy.workflowPath}`;
    if (semanticWorkflowProvenance.source !== 'candidate-git-object') {
      semanticFailures.push(`semantic workflow source must be candidate-git-object, got ${semanticWorkflowProvenance.source ?? 'missing'}`);
    }
    if (semanticWorkflowProvenance.gitObject !== expectedGitObject) {
      semanticFailures.push(`semantic workflow Git object must be ${expectedGitObject}`);
    }
    if (semanticWorkflowProvenance.candidateSha !== candidateSha) {
      semanticFailures.push('semantic workflow provenance candidate SHA mismatch');
    }
    if (semanticWorkflowProvenance.workflowPath !== semanticPolicy.workflowPath) {
      semanticFailures.push('semantic workflow provenance path mismatch');
    }
    if (semanticWorkflowProvenance.workingTreeAuthoritative !== false) {
      semanticFailures.push('mutable working-tree workflow must remain non-authoritative');
    }
    if (semanticWorkflowProvenance.falseNegatives > 0 || semanticWorkflowProvenance.pass !== true) {
      semanticFailures.push(`semantic workflow provenance calibration false negatives ${semanticWorkflowProvenance.falseNegatives ?? 'unknown'}/${semanticWorkflowProvenance.trials ?? 'unknown'}`);
    }
  }

  const enforcementEnabled = resolveEvidenceIndependenceEnforcement(policy, enforcementOverride, env);
  const wouldBlock = baseDecision.wouldBlock || semanticFailures.length > 0;
  const blocking = enforcementEnabled && wouldBlock;
  const core = {
    schema: PROMOTION_SCHEMA,
    candidateSha,
    mode: enforcementEnabled ? 'enforced' : 'advisory-rollback',
    enforcementEnabled,
    policyDigest: sha256Value(policy),
    graphDigest: baseDecision.graphDigest,
    baseDecision,
    semanticObserver: {
      criterionId: semanticPolicy.criterionId,
      sourceId: semanticPolicy.observerSourceId,
      workflowPath: semanticPolicy.workflowPath,
      workflowProvenance: semanticWorkflowProvenance,
      observation: semanticObservation,
      calibration: semanticCalibration,
      failures: semanticFailures,
      pass: semanticFailures.length === 0,
    },
    wouldBlock,
    blocking,
    verdict: enforcementEnabled ? (blocking ? 'fail' : 'pass') : 'disabled-advisory',
    rollback: {
      environmentVariable: policy.rollback.environmentVariable,
      disabledValue: policy.rollback.disabledValue,
      restoresAdvisoryBehavior: true,
    },
    existingExactShaEvidenceRemainsAuthoritative: true,
    proofSynthesisAllowed: false,
    candidatePassGranted: false,
  };
  return { ...core, reportDigest: sha256Value(core) };
}

export async function runEvidenceIndependencePromotionGate({
  policyPath = DEFAULT_POLICY,
  graphPath = DEFAULT_GRAPH,
  candidateSha,
  enforcementOverride,
  env = process.env,
} = {}) {
  assert(typeof candidateSha === 'string' && SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase Git SHA');
  const graph = await loadEvidenceGraph(graphPath);
  const policy = JSON.parse(await readFile(resolve(policyPath), 'utf8'));
  const semanticPolicy = validateSemanticObserverPolicy(policy, graph);
  const baseDecision = await runEvidenceIndependenceGate({
    policyPath,
    graphPath,
    candidateSha,
    enforcementOverride: false,
    env,
  });
  const candidateWorkflow = loadCandidateGitObjectText(candidateSha, semanticPolicy.workflowPath);
  const workspaceWorkflowText = await readFile(resolve(semanticPolicy.workflowPath), 'utf8');
  const observation = observePrCandidateHeadContract({
    workflowText: candidateWorkflow.text,
    candidateSha,
  });
  const calibration = calibratePrCandidateHeadObserver({
    workflowText: candidateWorkflow.text,
    candidateSha,
  });
  const workflowProvenance = calibrateWorkflowSourceProvenance({
    candidateSha,
    workflowPath: semanticPolicy.workflowPath,
    candidateWorkflowText: candidateWorkflow.text,
    workspaceWorkflowText,
  });
  assert(workflowProvenance.candidateWorkflowSha256 === candidateWorkflow.sha256, 'candidate workflow provenance digest mismatch');
  return buildEvidenceIndependencePromotionDecision({
    policy,
    graph,
    baseDecision,
    semanticObservation: observation,
    semanticCalibration: calibration,
    semanticWorkflowProvenance: workflowProvenance,
    candidateSha,
    enforcementOverride,
    env,
  });
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert(index + 1 < args.length, `${name} requires a value`);
  return args[index + 1];
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, canonicalJson(value), 'utf8');
}

async function main() {
  const [, , command, ...args] = process.argv;
  assert(command === 'gate', 'usage: evidence-independence-promotion-gate.mjs gate --candidate-sha <sha> [--graph <path>] [--policy <path>] [--output <path>]');
  const candidateSha = optionValue(args, '--candidate-sha');
  const graphPath = optionValue(args, '--graph', DEFAULT_GRAPH);
  const policyPath = optionValue(args, '--policy', DEFAULT_POLICY);
  const output = optionValue(args, '--output');
  const decision = await runEvidenceIndependencePromotionGate({ candidateSha, graphPath, policyPath });
  if (output) await writeJson(output, decision);
  else process.stdout.write(canonicalJson(decision));
  const semantic = decision.semanticObserver.calibration;
  const provenance = decision.semanticObserver.workflowProvenance;
  console.log(
    `EVIDENCE_INDEPENDENCE_PROMOTION_GATE verdict=${decision.verdict} candidate=${decision.candidateSha} mode=${decision.mode} observer=${decision.semanticObserver.pass} workflowSource=${provenance?.source ?? 'missing'} workspaceAuthoritative=${provenance?.workingTreeAuthoritative ?? 'unknown'} sourceFalseNegatives=${provenance?.falseNegatives ?? 'unknown'}/${provenance?.trials ?? 'unknown'} semanticFalsePositives=${semantic.falsePositives}/${semantic.falsePositiveTrials} semanticFalseNegatives=${semantic.falseNegatives}/${semantic.falseNegativeTrials} classifierFalsePositives=${decision.baseDecision.calibration.falsePositives}/${decision.baseDecision.calibration.falsePositiveTrials} classifierFalseNegatives=${decision.baseDecision.calibration.falseNegatives}/${decision.baseDecision.calibration.falseNegativeTrials} candidatePassGranted=false`,
  );
  if (decision.blocking) {
    const reasons = [
      ...decision.baseDecision.failedCriteria,
      ...decision.baseDecision.calibrationFailures,
      ...decision.semanticObserver.failures,
    ];
    throw new Error(`promoted evidence independence scope failed: ${reasons.join('; ') || 'unknown'}`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`EVIDENCE_INDEPENDENCE_PROMOTION_GATE_ERROR ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
