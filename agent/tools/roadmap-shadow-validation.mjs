import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const SHA_PATTERN = /^[a-f0-9]{40}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function assertSha(value, label) {
  assertString(value, label);
  assert(SHA_PATTERN.test(value), `${label} must be a full lowercase SHA`);
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

async function git(repoRoot, args, { allowFailure = false } = {}) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: repoRoot, maxBuffer: 1024 * 1024 * 8 });
    return stdout.trim();
  } catch (error) {
    if (allowFailure) return null;
    const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
}

async function sourceAt(repoRoot, ref, path) {
  return git(repoRoot, ['show', `${ref}:${path}`], { allowFailure: true });
}

function arraysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function classifyPressurePrediction(predictedPressure, actualPressure) {
  assert(typeof predictedPressure === 'boolean', 'predictedPressure must be boolean');
  assert(typeof actualPressure === 'boolean', 'actualPressure must be boolean');
  if (predictedPressure && actualPressure) return 'true-positive';
  if (predictedPressure && !actualPressure) return 'false-positive';
  if (!predictedPressure && actualPressure) return 'false-negative';
  return 'true-negative';
}

export function summarizePressureClassifications(classifications) {
  const counts = {
    truePositives: 0,
    trueNegatives: 0,
    falsePositives: 0,
    falseNegatives: 0,
  };
  for (const classification of classifications) {
    if (classification === 'true-positive') counts.truePositives += 1;
    else if (classification === 'true-negative') counts.trueNegatives += 1;
    else if (classification === 'false-positive') counts.falsePositives += 1;
    else if (classification === 'false-negative') counts.falseNegatives += 1;
    else throw new Error(`unknown pressure classification ${classification}`);
  }
  const total = classifications.length;
  const actualPositive = counts.truePositives + counts.falseNegatives;
  const actualNegative = counts.trueNegatives + counts.falsePositives;
  return {
    ...counts,
    evaluatedSignalCount: total,
    usefulPredictionCount: counts.truePositives + counts.trueNegatives,
    falseAlarmCount: counts.falsePositives,
    missedIntegrationPressureCount: counts.falseNegatives,
    accuracy: total === 0 ? null : Number(((counts.truePositives + counts.trueNegatives) / total).toFixed(6)),
    falsePositiveRate: actualNegative === 0 ? null : Number((counts.falsePositives / actualNegative).toFixed(6)),
    falseNegativeRate: actualPositive === 0 ? null : Number((counts.falseNegatives / actualPositive).toFixed(6)),
  };
}

export function validateRoadmapShadowValidationCorpus(corpus) {
  assert(corpus && typeof corpus === 'object' && !Array.isArray(corpus), 'EV-19 corpus must be an object');
  assert(corpus.schemaVersion === 1, 'EV-19 corpus schemaVersion must be 1');
  assert(corpus.taskId === 'EV-19', 'EV-19 corpus taskId must remain EV-19');
  assert(corpus.mode === 'advisory', 'EV-19 corpus must remain advisory');
  assert(corpus.prediction?.taskId === 'P28-PLOAD2', 'EV-19 measured prediction must remain P28-PLOAD2');
  assertSha(corpus.prediction.ev7CandidateSha, 'prediction.ev7CandidateSha');
  assertSha(corpus.prediction.configBlobSha, 'prediction.configBlobSha');
  assert(corpus.prediction.expectedFrictionScore === 1, 'EV-7 P28-PLOAD2 expected friction must remain 1');
  assert(corpus.prediction.expectedRewritePressure === 'low', 'EV-7 P28-PLOAD2 expected rewrite pressure must remain low');
  assert(corpus.prediction.preferredSurfaceCount === 2, 'EV-7 P28-PLOAD2 preferred surface count must remain 2');
  assert(Array.isArray(corpus.prediction.expectedSurfaces) && corpus.prediction.expectedSurfaces.length === 2, 'EV-7 expected surfaces must remain pinned');
  assert(corpus.actualOutcome?.kind === 'implementation-attempt', 'EV-19 actual outcome must remain an implementation attempt until P28-PLOAD2 lands');
  assert(Number.isInteger(corpus.actualOutcome.pullRequest) && corpus.actualOutcome.pullRequest > 0, 'actualOutcome.pullRequest must be a positive integer');
  assertSha(corpus.actualOutcome.baseSha, 'actualOutcome.baseSha');
  assertSha(corpus.actualOutcome.headSha, 'actualOutcome.headSha');
  assert(Array.isArray(corpus.actualOutcome.requiredChangedPaths) && corpus.actualOutcome.requiredChangedPaths.length > 0, 'actualOutcome.requiredChangedPaths must be non-empty');
  assert(Array.isArray(corpus.signals) && corpus.signals.length === 3, 'EV-19 must measure exactly three P28-PLOAD2 prediction signals');
  assert(new Set(corpus.signals.map(signal => signal.id)).size === corpus.signals.length, 'EV-19 signal ids must be unique');
  assert(Array.isArray(corpus.unsupportedScenarios) && corpus.unsupportedScenarios.some(entry => entry.taskId === 'P28-G1'), 'P28-G1 must remain explicitly unsupported until later implementation evidence exists');
  assert(corpus.promotionBoundary?.acceptedForEnforcement === false, 'EV-19 cannot accept enforcement');
  assert(corpus.promotionBoundary?.candidatePassGranted === false, 'EV-19 cannot grant candidate acceptance');
  assert(corpus.promotionBoundary?.blocking === false, 'EV-19 must remain non-blocking calibration');
  return corpus;
}

export async function loadRoadmapShadowValidationCorpus(path = resolve('agent/roadmap-shadow-validation-corpus.json')) {
  return validateRoadmapShadowValidationCorpus(JSON.parse(await readFile(path, 'utf8')));
}

async function authenticatePrediction(repoRoot, prediction) {
  const blob = await git(repoRoot, ['rev-parse', `${prediction.ev7CandidateSha}:${prediction.configPath}`]);
  assert(blob === prediction.configBlobSha, `EV-7 config blob drifted: expected ${prediction.configBlobSha}, got ${blob}`);
  const configText = await sourceAt(repoRoot, prediction.ev7CandidateSha, prediction.configPath);
  assert(configText !== null, 'EV-7 prediction config is unavailable from its exact candidate');
  const config = JSON.parse(configText);
  const scenario = config.scenarios?.find(entry => entry.taskId === prediction.taskId);
  assert(scenario, `EV-7 exact config lacks ${prediction.taskId}`);
  assert(scenario.probeId === prediction.probeId, 'EV-7 probe id drifted');
  assert(scenario.preferredSurfaceCount === prediction.preferredSurfaceCount, 'EV-7 preferred surface count drifted');
  assert(arraysEqual(scenario.expectedSurfaces, prediction.expectedSurfaces), 'EV-7 expected surface set drifted');

  let missingExtensionPointCount = 0;
  for (const contract of scenario.extensionPoints) {
    const source = await sourceAt(repoRoot, prediction.ev7CandidateSha, contract.path);
    assert(source !== null, `EV-7 extension-point source ${contract.path} is unavailable`);
    if (!source.includes(contract.contains)) missingExtensionPointCount += 1;
  }
  let requiredBoundaryViolationCount = 0;
  for (const contract of scenario.forbiddenDependencies) {
    const source = await sourceAt(repoRoot, prediction.ev7CandidateSha, contract.path);
    assert(source !== null, `EV-7 boundary source ${contract.path} is unavailable`);
    if (source.includes(contract.contains)) requiredBoundaryViolationCount += 1;
  }
  const surfaceCount = scenario.expectedSurfaces.length;
  const excessSurfaces = Math.max(0, surfaceCount - scenario.preferredSurfaceCount);
  const frictionScore = Math.max(0, surfaceCount - 1)
    + excessSurfaces * 3
    + missingExtensionPointCount * 7
    + requiredBoundaryViolationCount * 9;
  const rewritePressure = excessSurfaces === 0 ? 'low' : excessSurfaces <= 2 ? 'medium' : 'high';
  assert(frictionScore === prediction.expectedFrictionScore, `EV-7 measured friction drifted: expected ${prediction.expectedFrictionScore}, got ${frictionScore}`);
  assert(rewritePressure === prediction.expectedRewritePressure, `EV-7 rewrite pressure drifted: expected ${prediction.expectedRewritePressure}, got ${rewritePressure}`);
  assert(missingExtensionPointCount === 0, 'EV-7 P28-PLOAD2 prediction did not have clean extension points');
  assert(requiredBoundaryViolationCount === 0, 'EV-7 P28-PLOAD2 prediction already required a forbidden dependency');

  return {
    taskId: scenario.taskId,
    probeId: scenario.probeId,
    candidateSha: prediction.ev7CandidateSha,
    configBlobSha: blob,
    frictionScore,
    rewritePressure,
    preferredSurfaceCount: scenario.preferredSurfaceCount,
    expectedSurfaces: scenario.expectedSurfaces,
    missingExtensionPointCount,
    requiredBoundaryViolationCount,
  };
}

async function evaluateSignalAtRevision(repoRoot, signal, revision, actualProductionFiles) {
  if (signal.kind === 'surface-count') {
    return actualProductionFiles.length > signal.preferredSurfaceCount;
  }
  const sources = [];
  for (const path of signal.paths) {
    const source = await sourceAt(repoRoot, revision, path);
    sources.push({ path, source });
  }
  if (signal.kind === 'required-contract') {
    return !signal.containsAll.every(token => sources.some(entry => entry.source?.includes(token)));
  }
  if (signal.kind === 'forbidden-contract') {
    return signal.containsAny.some(token => sources.some(entry => entry.source?.includes(token)));
  }
  throw new Error(`unsupported EV-19 signal kind ${signal.kind}`);
}

async function authenticateActualOutcome(repoRoot, corpus) {
  const { actualOutcome } = corpus;
  const baseExists = await git(repoRoot, ['cat-file', '-e', `${actualOutcome.baseSha}^{commit}`], { allowFailure: true });
  const headExists = await git(repoRoot, ['cat-file', '-e', `${actualOutcome.headSha}^{commit}`], { allowFailure: true });
  assert(baseExists !== null, `P28-PLOAD2 base ${actualOutcome.baseSha} is not available locally`);
  assert(headExists !== null, `P28-PLOAD2 head ${actualOutcome.headSha} is not available locally; fetch the pinned exact head before calibration`);
  const mergeBase = await git(repoRoot, ['merge-base', actualOutcome.baseSha, actualOutcome.headSha]);
  assert(mergeBase === actualOutcome.baseSha, 'P28-PLOAD2 actual outcome is not based on the pinned base SHA');
  const changedFilesText = await git(repoRoot, ['diff', '--name-only', `${actualOutcome.baseSha}..${actualOutcome.headSha}`]);
  const changedFiles = changedFilesText ? changedFilesText.split('\n').filter(Boolean) : [];
  for (const requiredPath of actualOutcome.requiredChangedPaths) {
    assert(changedFiles.includes(requiredPath), `P28-PLOAD2 actual outcome lacks required task-identity path ${requiredPath}`);
  }
  const revisionsText = await git(repoRoot, ['rev-list', '--reverse', `${actualOutcome.baseSha}..${actualOutcome.headSha}`]);
  const revisions = revisionsText ? revisionsText.split('\n').filter(Boolean) : [];
  assert(revisions.length > 0, 'P28-PLOAD2 actual outcome must include at least one implementation revision');
  const productionFiles = changedFiles.filter(path => path.startsWith(actualOutcome.productionPrefix));
  const testFiles = changedFiles.filter(path => path.startsWith(actualOutcome.testPrefix));
  return { mergeBase, changedFiles, revisions, productionFiles, testFiles };
}

export async function buildRoadmapShadowValidationReport({ candidateSha, corpus = null, repoRoot = resolve('.') } = {}) {
  assertSha(candidateSha, 'candidateSha');
  const loadedCorpus = corpus ? validateRoadmapShadowValidationCorpus(corpus) : await loadRoadmapShadowValidationCorpus(resolve(repoRoot, 'agent/roadmap-shadow-validation-corpus.json'));
  const beforeHead = await git(repoRoot, ['rev-parse', 'HEAD']);
  const beforeStatus = await git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=no']);
  assert(beforeHead === candidateSha, `EV-19 report candidate ${candidateSha} does not match checked-out HEAD ${beforeHead}`);

  const prediction = await authenticatePrediction(repoRoot, loadedCorpus.prediction);
  const actual = await authenticateActualOutcome(repoRoot, loadedCorpus);
  const signals = [];

  for (const signal of loadedCorpus.signals) {
    const actualPressure = await evaluateSignalAtRevision(repoRoot, signal, loadedCorpus.actualOutcome.headSha, actual.productionFiles);
    const classification = classifyPressurePrediction(signal.predictedPressure, actualPressure);
    let revisionObservations = null;
    if (signal.repeatAcrossActualRevisions) {
      let matchingPredictionCount = 0;
      for (const revision of actual.revisions) {
        const pressure = await evaluateSignalAtRevision(repoRoot, signal, revision, actual.productionFiles);
        if (pressure === signal.predictedPressure) matchingPredictionCount += 1;
      }
      revisionObservations = {
        observedRevisionCount: actual.revisions.length,
        matchingPredictionCount,
        repeatable: matchingPredictionCount === actual.revisions.length && actual.revisions.length >= 2,
      };
    }
    signals.push({
      id: signal.id,
      description: signal.description,
      predictedPressure: signal.predictedPressure,
      actualPressure,
      classification,
      revisionObservations,
      supportedForEV20Review: classification === 'true-negative' && revisionObservations?.repeatable === true,
    });
  }

  const metrics = summarizePressureClassifications(signals.map(signal => signal.classification));
  const supportedSignals = signals.filter(signal => signal.supportedForEV20Review).map(signal => signal.id);
  const exactSurfaceMatches = prediction.expectedSurfaces.filter(path => actual.productionFiles.includes(path));
  const unpredictedProductionSurfaces = actual.productionFiles.filter(path => !prediction.expectedSurfaces.includes(path));

  const afterHead = await git(repoRoot, ['rev-parse', 'HEAD']);
  const afterStatus = await git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=no']);
  assert(afterHead === beforeHead, 'EV-19 calibration changed repository HEAD');
  assert(afterStatus === beforeStatus, 'EV-19 calibration changed tracked repository state');

  const report = {
    schema: 'ironshade-roadmap-shadow-validation-report:v1',
    schemaVersion: 1,
    taskId: 'EV-19',
    mode: 'advisory',
    candidateSha,
    prediction,
    actualOutcome: {
      kind: loadedCorpus.actualOutcome.kind,
      pullRequest: loadedCorpus.actualOutcome.pullRequest,
      baseSha: loadedCorpus.actualOutcome.baseSha,
      headSha: loadedCorpus.actualOutcome.headSha,
      mergeBase: actual.mergeBase,
      revisionCount: actual.revisions.length,
      changedFileCount: actual.changedFiles.length,
      productionSurfaceCount: actual.productionFiles.length,
      testSurfaceCount: actual.testFiles.length,
      changedFiles: actual.changedFiles,
      productionSurfaces: actual.productionFiles,
      testSurfaces: actual.testFiles,
      exactPredictedSurfaceMatches: exactSurfaceMatches,
      unpredictedProductionSurfaces,
    },
    signals,
    metrics,
    supportedSignals,
    unsupportedScenarios: loadedCorpus.unsupportedScenarios,
    conclusion: {
      repeatablePredictiveValueFound: supportedSignals.length > 0,
      lowFrictionScoreValidated: metrics.falseNegatives === 0,
      surfacePressurePredictionValidated: !signals.some(signal => signal.id === 'surface-count-pressure' && signal.classification === 'false-negative'),
      enforcementEligible: false,
      rationale: 'The shared readiness and renderer-independence boundaries held across the measured implementation revisions, but EV-7 missed broader production-surface pressure and P28-G1 has no later outcome yet.',
    },
    isolation: {
      temporaryProbesPersisted: false,
      productRuntimeMutated: false,
      simulatorScoringChanged: false,
      exactHeadRestored: afterHead === beforeHead,
      trackedStateRestored: afterStatus === beforeStatus,
    },
    acceptedForEnforcement: false,
    candidatePassGranted: false,
    blocking: false,
  };
  return { ...report, reportDigest: sha256(report) };
}

function readArg(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  assert(index + 1 < args.length, `${name} requires a value`);
  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  assert(!args.includes('--enforce'), 'EV-19 is calibration-only; Roadmap Shadow enforcement belongs to EV-20 after review');
  const repoRoot = resolve(readArg(args, '--repo-root') ?? '.');
  const candidateSha = readArg(args, '--candidate-sha') ?? await git(repoRoot, ['rev-parse', 'HEAD']);
  const output = readArg(args, '--output');
  const report = await buildRoadmapShadowValidationReport({ candidateSha, repoRoot });
  if (output) {
    const outputPath = resolve(repoRoot, output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalJson(report), 'utf8');
  }
  console.log(`EV19_ROADMAP_SHADOW_VALIDATION_PASS candidate=${report.candidateSha} actual=${report.actualOutcome.headSha} revisions=${report.actualOutcome.revisionCount} productionSurfaces=${report.actualOutcome.productionSurfaceCount} useful=${report.metrics.usefulPredictionCount} fp=${report.metrics.falsePositives} fn=${report.metrics.falseNegatives} supported=${report.supportedSignals.join(',')} enforcement=false digest=${report.reportDigest}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`EV19_ROADMAP_SHADOW_VALIDATION_INVALID ${error.message}`);
    process.exitCode = 1;
  });
}
