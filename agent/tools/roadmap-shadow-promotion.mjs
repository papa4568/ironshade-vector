import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const POLICY_PATH = 'agent/roadmap-shadow-promotion-policy.json';
const CORPUS_PATH = 'agent/roadmap-shadow-validation-corpus.json';
const SIMULATOR_PATH = 'agent/roadmap-shadow-simulator.json';
const PR_CANDIDATE_PATH = '.github/workflows/pr-candidate.yml';
const AGENT_ORCHESTRATION_PATH = '.github/workflows/agent-orchestration.yml';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalJson(value) {
  const normalize = entry => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(Object.keys(entry).sort((a, b) => a.localeCompare(b)).map(key => [key, normalize(entry[key])]));
  };
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

function unique(values) {
  return [...new Set(values)];
}

export function summarizeSurfacePrediction(predictedSurfaces, actualSurfaces) {
  assert(Array.isArray(predictedSurfaces) && predictedSurfaces.length > 0, 'predictedSurfaces must be non-empty');
  assert(Array.isArray(actualSurfaces) && actualSurfaces.length > 0, 'actualSurfaces must be non-empty');
  const predicted = unique(predictedSurfaces);
  const actual = unique(actualSurfaces);
  const actualSet = new Set(actual);
  const predictedSet = new Set(predicted);
  const truePositiveSurfaces = predicted.filter(path => actualSet.has(path));
  const falsePositiveSurfaces = predicted.filter(path => !actualSet.has(path));
  const falseNegativeSurfaces = actual.filter(path => !predictedSet.has(path));
  const precision = truePositiveSurfaces.length / (truePositiveSurfaces.length + falsePositiveSurfaces.length);
  const recall = truePositiveSurfaces.length / (truePositiveSurfaces.length + falseNegativeSurfaces.length);
  return {
    predictedSurfaceCount: predicted.length,
    actualSurfaceCount: actual.length,
    truePositiveSurfaces,
    falsePositiveSurfaces,
    falseNegativeSurfaces,
    usefulPredictionCount: truePositiveSurfaces.length,
    falseAlarmCount: falsePositiveSurfaces.length,
    missedIntegrationPressureCount: falseNegativeSurfaces.length,
    precision: Number(precision.toFixed(6)),
    recall: Number(recall.toFixed(6)),
  };
}

export function normalizeTrialSurfaces(trial) {
  assert(trial && typeof trial === 'object', 'trial must be an object');
  assert(Array.isArray(trial.expectedSurfaces) && trial.expectedSurfaces.length > 0, 'trial expectedSurfaces must be non-empty');
  assert(typeof trial.signalPath === 'string' && typeof trial.normalizedSignalPath === 'string', 'trial signal paths must be strings');
  return unique(trial.expectedSurfaces.map(path => path === trial.signalPath ? trial.normalizedSignalPath : path));
}

export function validateNoPromotionPolicy(policy) {
  assert(policy && typeof policy === 'object' && !Array.isArray(policy), 'EV-20 policy must be an object');
  assert(policy.schemaVersion === 1, 'EV-20 policy schemaVersion must be 1');
  assert(policy.taskId === 'EV-20', 'EV-20 policy taskId drifted');
  assert(policy.mode === 'no-promotion', 'EV-20 policy must remain no-promotion');
  assert(policy.sourceCalibration?.taskId === 'EV-19', 'EV-20 must use only EV-19 calibration evidence');
  assert(policy.sourceCalibration?.corpusPath === CORPUS_PATH, 'EV-20 source corpus path drifted');
  assert(SHA_PATTERN.test(policy.sourceCalibration?.corpusBlobSha ?? ''), 'EV-20 source corpus blob must be a full SHA');
  assert(policy.sourceCalibration?.reviewedCandidateSha === 'a71c963a3054143b1d722b50891a92a4f4ea52c3', 'EV-19 reviewed candidate pin drifted');
  assert(policy.sourceCalibration?.workflowRunId === 39006773190, 'EV-19 workflow run pin drifted');
  assert(policy.sourceCalibration?.artifactId === 12090922600, 'EV-19 artifact pin drifted');
  assert(policy.sourceCalibration?.artifactDigest === 'sha256:16d5f33f5e85d3eee84ab37062777d950bb4bbb34c8d402c5aff28ab0f4d84b2', 'EV-19 artifact digest pin drifted');
  assert(policy.sourceCalibration?.reportDigest === '54bfc9bd741d78f048e5abfcdd8c3f0c6ff00e0fd642e3638678dddcc5aafc4c', 'EV-19 report digest pin drifted');
  assert(policy.sourceCalibration?.independentReviewCommentId === 6230352733, 'EV-19 independent-review pin drifted');
  assert(policy.reviewedSignal?.id === 'expected-surface:shared-backend-readiness', 'EV-20 reviewed signal drifted');
  assert(policy.reviewedSignal?.normalizedOutcomePath === 'src/game/combatGraphicsBackendCore.ts', 'EV-20 reviewed signal path drifted');
  assert(policy.reviewedSignal?.scope === 'same-task forecast robustness across a pre-outcome architecture refactor', 'EV-20 reviewed scope drifted');
  assert(policy.decision?.promote === false, 'EV-20 must not promote the signal');
  assert(policy.decision?.acceptedForEnforcement === false, 'EV-20 must not accept enforcement');
  assert(policy.decision?.candidatePassGranted === false, 'EV-20 must not grant candidate acceptance');
  assert(policy.decision?.blocking === false, 'EV-20 decision must remain non-blocking');
  const reasons = new Set(policy.decision?.reasonCodes ?? []);
  for (const required of [
    'single-distinct-product-outcome',
    'cross-task-generalization-unproven',
    'forecast-false-alarms-observed',
    'forecast-misses-observed',
  ]) assert(reasons.has(required), `EV-20 decision missing reason ${required}`);
  assert(policy.decision?.futurePromotionRequiresFreshCalibration === true, 'future promotion must require fresh calibration');
  assert(policy.preservedBoundary?.simulatorMode === 'advisory', 'EV-7 simulator must remain advisory');
  for (const key of [
    'authoritativeHeuristicScore',
    'architectureInvariantAdded',
    'proofObligationAdded',
    'roadmapRuleAdded',
    'productRuntimeChanged',
    'existingProofGatesChanged',
  ]) assert(policy.preservedBoundary?.[key] === false, `EV-20 preserved boundary ${key} must remain false`);
  return policy;
}

export function validateEv19EvidenceBoundary(corpus, policy) {
  assert(corpus?.schemaVersion === 2 && corpus?.taskId === 'EV-19' && corpus?.mode === 'advisory', 'EV-19 corpus identity drifted');
  assert(Array.isArray(corpus.predictionTrials) && corpus.predictionTrials.length === 2, 'EV-19 must retain exactly two prediction trials');
  assert(Array.isArray(corpus.actualOutcome?.expectedProductionSurfaces) && corpus.actualOutcome.expectedProductionSurfaces.length === 4, 'EV-19 actual outcome surface truth drifted');
  assert(Array.isArray(corpus.supportedSignals) && corpus.supportedSignals.length === 1, 'EV-19 supported signal count drifted');
  const signal = corpus.supportedSignals[0];
  assert(signal.id === policy.reviewedSignal.id, 'EV-19 supported signal differs from EV-20 reviewed signal');
  assert(signal.normalizedOutcomePath === policy.reviewedSignal.normalizedOutcomePath, 'EV-19 normalized signal path differs from EV-20 policy');
  assert(signal.scope === policy.reviewedSignal.scope, 'EV-19 signal scope differs from EV-20 policy');
  assert(corpus.promotionBoundary?.acceptedForEnforcement === false, 'EV-19 unexpectedly accepts enforcement');
  assert(corpus.promotionBoundary?.candidatePassGranted === false, 'EV-19 unexpectedly grants candidate acceptance');
  assert(corpus.promotionBoundary?.blocking === false, 'EV-19 unexpectedly became blocking');
  assert(corpus.promotionBoundary?.crossTaskGeneralizationEstablished === false, 'EV-19 unexpectedly claims cross-task generalization');

  const actual = corpus.actualOutcome.expectedProductionSurfaces;
  const trials = corpus.predictionTrials.map(trial => ({
    id: trial.id,
    candidateSha: trial.candidateSha,
    configBlobSha: trial.configBlobSha,
    normalizedExpectedSurfaces: normalizeTrialSurfaces(trial),
    surfacePrediction: summarizeSurfacePrediction(normalizeTrialSurfaces(trial), actual),
  }));
  const [original, migrated] = trials;
  assert(original.id === 'ev7-original', 'EV-19 original trial id drifted');
  assert(original.surfacePrediction.usefulPredictionCount === 1, 'EV-19 original true-positive count drifted');
  assert(original.surfacePrediction.falseAlarmCount === 1, 'EV-19 original false-alarm count drifted');
  assert(original.surfacePrediction.missedIntegrationPressureCount === 3, 'EV-19 original miss count drifted');
  assert(original.surfacePrediction.precision === 0.5 && original.surfacePrediction.recall === 0.25, 'EV-19 original precision/recall drifted');
  assert(migrated.id === 'ao6-snapshot-isolated', 'EV-19 migrated trial id drifted');
  assert(migrated.surfacePrediction.usefulPredictionCount === 1, 'EV-19 migrated true-positive count drifted');
  assert(migrated.surfacePrediction.falseAlarmCount === 2, 'EV-19 migrated false-alarm count drifted');
  assert(migrated.surfacePrediction.missedIntegrationPressureCount === 3, 'EV-19 migrated miss count drifted');
  assert(migrated.surfacePrediction.precision === 0.333333 && migrated.surfacePrediction.recall === 0.25, 'EV-19 migrated precision/recall drifted');
  return trials;
}

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function grepTracked(repoRoot, needle) {
  try {
    const output = execFileSync('git', ['grep', '-l', '--', needle, 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    return output ? output.split('\n').filter(Boolean).sort((a, b) => a.localeCompare(b)) : [];
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

export function validateAdvisoryRollbackBoundary({ simulator, prCandidateWorkflow, agentOrchestrationWorkflow, referencePaths }) {
  assert(simulator?.mode === 'advisory', 'live EV-7 simulator must remain advisory');
  const captureMatch = prCandidateWorkflow.match(/- name: Capture EV-7 roadmap shadow simulator advisory evidence[\s\S]*?continue-on-error:\s*true[\s\S]*?node agent\/tools\/roadmap-shadow-simulator\.mjs/);
  assert(captureMatch, 'PR candidate Roadmap Shadow capture must remain continue-on-error advisory evidence');
  const regressionMatch = agentOrchestrationWorkflow.match(/- name: Run roadmap shadow simulator regressions\s+run: node agent\/tests\/roadmap-shadow-simulator\.mjs/);
  assert(regressionMatch, 'Agent Orchestration Roadmap Shadow use must remain a focused regression only');

  const disallowedRuntimeConsumers = referencePaths.filter(path =>
    (path.startsWith('src/') || path.startsWith('android/') || path.startsWith('server/'))
    && !path.startsWith('src/test/')
  );
  assert(disallowedRuntimeConsumers.length === 0, `Roadmap Shadow leaked into product/runtime consumers: ${disallowedRuntimeConsumers.join(', ')}`);

  const disallowedAcceptanceConsumers = referencePaths.filter(path => [
    'agent/tools/candidate-evidence.mjs',
    'agent/tools/select-review-task.mjs',
    'agent/tools/candidate-artifact.mjs',
    'agent/architecture-invariants.json',
    'agent/impact-map.json',
  ].includes(path));
  assert(disallowedAcceptanceConsumers.length === 0, `Roadmap Shadow leaked into candidate acceptance: ${disallowedAcceptanceConsumers.join(', ')}`);

  return {
    simulatorMode: simulator.mode,
    prCaptureContinueOnError: true,
    orchestrationUse: 'regression-only',
    runtimeConsumerCount: disallowedRuntimeConsumers.length,
    acceptanceConsumerCount: disallowedAcceptanceConsumers.length,
    simulatorDisableRestoresPreviousAcceptancePath: true,
  };
}

export async function buildRoadmapShadowPromotionDecision({ candidateSha, repoRoot = process.cwd() } = {}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase SHA');
  const exactHead = git(repoRoot, ['rev-parse', 'HEAD']);
  assert(exactHead === candidateSha, `candidate SHA mismatch: expected ${candidateSha}, got ${exactHead}`);

  const policy = validateNoPromotionPolicy(JSON.parse(await readFile(resolve(repoRoot, POLICY_PATH), 'utf8')));
  const corpus = JSON.parse(await readFile(resolve(repoRoot, CORPUS_PATH), 'utf8'));
  const corpusBlob = git(repoRoot, ['rev-parse', `HEAD:${CORPUS_PATH}`]);
  assert(corpusBlob === policy.sourceCalibration.corpusBlobSha, `EV-19 corpus blob drifted: expected ${policy.sourceCalibration.corpusBlobSha}, got ${corpusBlob}`);
  const trials = validateEv19EvidenceBoundary(corpus, policy);
  const simulator = JSON.parse(await readFile(resolve(repoRoot, SIMULATOR_PATH), 'utf8'));
  const prCandidateWorkflow = await readFile(resolve(repoRoot, PR_CANDIDATE_PATH), 'utf8');
  const agentOrchestrationWorkflow = await readFile(resolve(repoRoot, AGENT_ORCHESTRATION_PATH), 'utf8');
  const referencePaths = grepTracked(repoRoot, 'roadmap-shadow-simulator');
  const rollback = validateAdvisoryRollbackBoundary({
    simulator,
    prCandidateWorkflow,
    agentOrchestrationWorkflow,
    referencePaths,
  });

  const report = {
    schema: 'ironshade-roadmap-shadow-promotion-decision:v1',
    schemaVersion: 1,
    taskId: 'EV-20',
    candidateSha,
    mode: policy.mode,
    decision: 'no-promotion',
    sourceCalibration: policy.sourceCalibration,
    reviewedSignal: policy.reviewedSignal,
    forecastMeasurements: trials,
    detectorCalibration: {
      source: 'EV-19 exact-SHA report pinned by digest',
      falsePositives: 0,
      falseNegatives: 0,
      falsePositiveBudget: 0,
      falseNegativeBudget: 0,
    },
    promotionBoundary: {
      distinctPredictionSnapshots: 2,
      distinctProductOutcomes: 1,
      crossTaskGeneralizationEstablished: false,
      completeExpectedSurfaceSetValidated: false,
      lowFrictionScoreValidated: false,
      acceptedForEnforcement: false,
      candidatePassGranted: false,
      blocking: false,
      futurePromotionRequiresFreshCalibration: true,
    },
    rollback,
    preservedBoundary: policy.preservedBoundary,
    repositoryReferences: referencePaths,
  };
  report.reportDigest = sha256(report);
  return report;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--candidate-sha') args.candidateSha = argv[++index];
    else if (value === '--output') args.output = argv[++index];
    else throw new Error(`unknown argument ${value}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await buildRoadmapShadowPromotionDecision({ candidateSha: args.candidateSha });
  if (args.output) {
    const outputPath = resolve(args.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalJson(report), 'utf8');
  }
  console.log(`EV20_ROADMAP_SHADOW_NO_PROMOTION_PASS candidate=${report.candidateSha} signal=shared-backend-readiness original=1tp/1fp/3fn migrated=1tp/2fp/3fn detector=0fp/0fn outcomes=1 crossTask=false enforcement=false rollback=advisory-removable digest=${report.reportDigest}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  main().catch(error => {
    console.error(`EV20_ROADMAP_SHADOW_NO_PROMOTION_INVALID ${error.message}`);
    process.exitCode = 1;
  });
}
