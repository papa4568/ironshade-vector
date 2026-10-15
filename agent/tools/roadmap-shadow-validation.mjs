import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const READINESS_PHASE_EXPRESSION = "const phase = shell !== 'loading' && world !== 'loading' ? 'ready' : 'loading';";
const BROKEN_READINESS_PHASE_EXPRESSION = "const phase = 'ready';";
const EXPECTED_DISHONEST_FAILURE = 'P28-PLOAD2 Deep Salvage cannot become playable while the authored refinery shell is still loading';

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

async function run(file, args, { cwd, allowFailure = false } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16,
    });
    return { ok: true, stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0 };
  } catch (error) {
    const result = {
      ok: false,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      exitCode: Number.isInteger(error.code) ? error.code : 1,
    };
    if (allowFailure) return result;
    const detail = `${result.stdout}${result.stderr}`.trim();
    throw new Error(`${file} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
}

async function git(repoRoot, args, { allowFailure = false } = {}) {
  const result = await run('git', args, { cwd: repoRoot, allowFailure });
  if (!result.ok) return null;
  return result.stdout.trim();
}

async function sourceAt(repoRoot, ref, path) {
  return git(repoRoot, ['show', `${ref}:${path}`], { allowFailure: true });
}

function arraysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function summarizeSurfacePrediction(predictedSurfaces, actualSurfaces) {
  assert(Array.isArray(predictedSurfaces) && predictedSurfaces.length > 0, 'predictedSurfaces must be non-empty');
  assert(Array.isArray(actualSurfaces) && actualSurfaces.length > 0, 'actualSurfaces must be non-empty');
  const predicted = [...new Set(predictedSurfaces)];
  const actual = [...new Set(actualSurfaces)];
  const actualSet = new Set(actual);
  const predictedSet = new Set(predicted);
  const truePositiveSurfaces = predicted.filter(path => actualSet.has(path));
  const falsePositiveSurfaces = predicted.filter(path => !actualSet.has(path));
  const falseNegativeSurfaces = actual.filter(path => !predictedSet.has(path));
  const precisionDenominator = truePositiveSurfaces.length + falsePositiveSurfaces.length;
  const recallDenominator = truePositiveSurfaces.length + falseNegativeSurfaces.length;
  return {
    predictedSurfaceCount: predicted.length,
    actualSurfaceCount: actual.length,
    truePositiveSurfaces,
    falsePositiveSurfaces,
    falseNegativeSurfaces,
    usefulPredictionCount: truePositiveSurfaces.length,
    falseAlarmCount: falsePositiveSurfaces.length,
    missedIntegrationPressureCount: falseNegativeSurfaces.length,
    precision: precisionDenominator === 0 ? null : Number((truePositiveSurfaces.length / precisionDenominator).toFixed(6)),
    recall: recallDenominator === 0 ? null : Number((truePositiveSurfaces.length / recallDenominator).toFixed(6)),
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
  assertSha(corpus.actualOutcome.featureIntroductionSha, 'actualOutcome.featureIntroductionSha');
  assert(Array.isArray(corpus.actualOutcome.requiredChangedPaths) && corpus.actualOutcome.requiredChangedPaths.length > 0, 'actualOutcome.requiredChangedPaths must be non-empty');
  assert(corpus.actualOutcome.behaviorTestPath === 'tests/p28-pload2-map-load-readiness.ts', 'EV-19 behavior test path must stay pinned to the real P28-PLOAD2 regression');
  assert(corpus.actualOutcome.behaviorImplementationPath === 'src/game/babylonRefineryMissionReadiness.ts', 'EV-19 behavior implementation path must stay pinned to the real readiness integration');
  assertString(corpus.actualOutcome.behaviorPassMarker, 'actualOutcome.behaviorPassMarker');
  assert(Number.isInteger(corpus.actualOutcome.behaviorRunCount) && corpus.actualOutcome.behaviorRunCount >= 2, 'EV-19 behaviorRunCount must demonstrate repeatability');

  assert(Array.isArray(corpus.surfaceLineage) && corpus.surfaceLineage.length === 1, 'EV-19 must pin exactly one pre-outcome surface migration');
  const lineage = corpus.surfaceLineage[0];
  assert(corpus.prediction.expectedSurfaces.includes(lineage.predictionPath), 'surface lineage source must be a frozen EV-7 expected surface');
  assert(lineage.predictionPath !== lineage.resolvedPath, 'surface lineage must resolve an actual pre-outcome path migration');
  assertSha(lineage.migrationCommit, 'surfaceLineage.migrationCommit');
  assertSha(lineage.migrationParent, 'surfaceLineage.migrationParent');
  assertString(lineage.publicFacadePath, 'surfaceLineage.publicFacadePath');
  assertString(lineage.publicFacadeExport, 'surfaceLineage.publicFacadeExport');
  assert(Array.isArray(lineage.carryoverContracts) && lineage.carryoverContracts.length >= 2, 'surface lineage must pin carryover contracts');

  assert(Array.isArray(corpus.unsupportedSignals) && corpus.unsupportedSignals.length === 2, 'EV-19 must explicitly retain two unvalidated EV-7 signal classes');
  const unsupportedIds = new Set(corpus.unsupportedSignals.map(signal => signal.id));
  assert(unsupportedIds.has('extension-point:missionVisualReadiness-observer'), 'EV-7 observer extension-point signal must remain unsupported when the later implementation did not use it');
  assert(unsupportedIds.has('forbidden-dependency:public-backend-no-static-babylon-import'), 'EV-7 forbidden-dependency signal must remain unsupported without an outcome change to that public facade');
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
    predictedExtensionPoints: scenario.extensionPoints,
    predictedForbiddenDependencies: scenario.forbiddenDependencies,
  };
}

async function authenticateSurfaceLineage(repoRoot, prediction, actualOutcome, lineage) {
  const migrationParent = await git(repoRoot, ['rev-parse', `${lineage.migrationCommit}^`]);
  assert(migrationParent === lineage.migrationParent, 'EV-19 pre-outcome surface migration parent drifted');
  const migrationBeforeOutcome = await git(repoRoot, ['merge-base', '--is-ancestor', lineage.migrationCommit, actualOutcome.baseSha], { allowFailure: true });
  assert(migrationBeforeOutcome !== null, 'EV-19 surface migration must predate the P28-PLOAD2 implementation base');

  const frozenSource = await sourceAt(repoRoot, prediction.ev7CandidateSha, lineage.predictionPath);
  const migratedCore = await sourceAt(repoRoot, lineage.migrationCommit, lineage.resolvedPath);
  const migratedFacade = await sourceAt(repoRoot, lineage.migrationCommit, lineage.publicFacadePath);
  assert(frozenSource !== null, `frozen EV-7 expected surface ${lineage.predictionPath} is unavailable`);
  assert(migratedCore !== null, `resolved pre-outcome surface ${lineage.resolvedPath} is unavailable at migration commit`);
  assert(migratedFacade?.includes(lineage.publicFacadeExport), 'AO-6 migration did not leave the pinned public facade re-export');
  for (const token of lineage.carryoverContracts) {
    assert(frozenSource.includes(token), `frozen expected surface lacks carryover contract ${token}`);
    assert(migratedCore.includes(token), `resolved surface lacks carried contract ${token}`);
  }
  return {
    predictionPath: lineage.predictionPath,
    resolvedPath: lineage.resolvedPath,
    migrationCommit: lineage.migrationCommit,
    migrationParent: lineage.migrationParent,
    predatesOutcome: true,
    publicFacadePath: lineage.publicFacadePath,
    publicFacadeExport: lineage.publicFacadeExport,
    carryoverContracts: lineage.carryoverContracts,
  };
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
  assert(changedFiles.includes(actualOutcome.behaviorTestPath), 'P28-PLOAD2 actual outcome must change the behavior regression used as EV-19 ground truth');
  assert(changedFiles.includes(actualOutcome.behaviorImplementationPath), 'P28-PLOAD2 actual outcome must change the readiness implementation used as EV-19 ground truth');

  const revisionsText = await git(repoRoot, ['rev-list', '--reverse', `${actualOutcome.baseSha}..${actualOutcome.headSha}`]);
  const revisions = revisionsText ? revisionsText.split('\n').filter(Boolean) : [];
  assert(revisions.length > 0, 'P28-PLOAD2 actual outcome must include at least one implementation revision');
  const productionFiles = changedFiles.filter(path => path.startsWith(actualOutcome.productionPrefix));
  const testFiles = changedFiles.filter(path => path.startsWith(actualOutcome.testPrefix));

  const featureBearingRevisions = [];
  for (const revision of revisions) {
    const testSource = await sourceAt(repoRoot, revision, actualOutcome.behaviorTestPath);
    if (testSource?.includes(actualOutcome.behaviorPassMarker)) featureBearingRevisions.push(revision);
  }
  assert(featureBearingRevisions.length > 0, 'P28-PLOAD2 history has no feature-bearing revision with the pinned task regression');
  assert(featureBearingRevisions[0] === actualOutcome.featureIntroductionSha, `P28-PLOAD2 feature introduction drifted: expected ${actualOutcome.featureIntroductionSha}, got ${featureBearingRevisions[0]}`);

  const behaviorTestBlobSha = await git(repoRoot, ['rev-parse', `${actualOutcome.headSha}:${actualOutcome.behaviorTestPath}`]);
  const behaviorImplementationBlobSha = await git(repoRoot, ['rev-parse', `${actualOutcome.headSha}:${actualOutcome.behaviorImplementationPath}`]);
  const behaviorTestSource = await sourceAt(repoRoot, actualOutcome.headSha, actualOutcome.behaviorTestPath);
  const behaviorImplementationSource = await sourceAt(repoRoot, actualOutcome.headSha, actualOutcome.behaviorImplementationPath);
  assert(behaviorTestSource?.includes(actualOutcome.behaviorPassMarker), 'P28-PLOAD2 behavior regression pass marker is missing from the pinned actual head');
  assert(behaviorTestSource?.includes('resolveMissionVisualReadiness'), 'P28-PLOAD2 behavior regression does not exercise the visual-readiness decision');
  assert(behaviorTestSource?.includes(EXPECTED_DISHONEST_FAILURE), 'P28-PLOAD2 behavior regression no longer contains the early-readiness assertion used for EV-19 sensitivity calibration');
  assert(behaviorImplementationSource?.includes(READINESS_PHASE_EXPRESSION), 'P28-PLOAD2 readiness implementation no longer contains the pinned readiness decision expression');

  return {
    mergeBase,
    changedFiles,
    revisions,
    productionFiles,
    testFiles,
    featureBearingRevisions,
    behaviorTestBlobSha,
    behaviorImplementationBlobSha,
  };
}

async function buildHistoricalBehaviorRegression(repoRoot, probeRoot, actualOutcome, outDir) {
  await rm(resolve(probeRoot, outDir), { recursive: true, force: true });
  const viteScript = resolve(repoRoot, 'node_modules/vite/bin/vite.js');
  await run(process.execPath, [
    viteScript,
    'build',
    '--ssr',
    actualOutcome.behaviorTestPath,
    '--outDir',
    outDir,
    '--emptyOutDir',
  ], { cwd: probeRoot });
  const outputFiles = (await readdir(resolve(probeRoot, outDir))).filter(path => path.endsWith('.js'));
  assert(outputFiles.length === 1, `EV-19 expected one historical regression bundle, found ${outputFiles.length}`);
  return resolve(probeRoot, outDir, outputFiles[0]);
}

async function runHistoricalBehaviorRegression(entryPath, probeRoot, actualOutcome, { expectPass = true, expectedFailure = null } = {}) {
  const result = await run(process.execPath, [entryPath], { cwd: probeRoot, allowFailure: true });
  const output = `${result.stdout}\n${result.stderr}`;
  if (expectPass) {
    assert(result.ok, `P28-PLOAD2 historical behavior regression failed unexpectedly: ${output.trim()}`);
    assert(output.includes(actualOutcome.behaviorPassMarker), 'P28-PLOAD2 historical behavior regression passed without the pinned pass marker');
    return { passed: true, expectedMarkerObserved: true };
  }
  assert(!result.ok, 'EV-19 dishonest readiness mutation unexpectedly survived the real P28-PLOAD2 behavior regression');
  assert(expectedFailure && output.includes(expectedFailure), `EV-19 dishonest readiness mutation failed for an unrelated reason: ${output.trim()}`);
  return { passed: false, expectedFailureObserved: true };
}

async function calibrateOutcomeControl(repoRoot, actualOutcome) {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'ironshade-ev19-pload2-'));
  const probeRoot = resolve(tempRoot, 'repo');
  let remoteDetached = false;
  try {
    await run('git', ['clone', '--no-hardlinks', '--no-checkout', repoRoot, probeRoot], { cwd: tempRoot });
    await git(probeRoot, ['remote', 'remove', 'origin']);
    remoteDetached = (await git(probeRoot, ['remote'])) === '';
    assert(remoteDetached, 'EV-19 disposable historical regression clone must have no source remote');
    await git(probeRoot, ['checkout', '--detach', '--force', actualOutcome.headSha]);
    await symlink(resolve(repoRoot, 'node_modules'), resolve(probeRoot, 'node_modules'), 'dir');

    const implementationPath = resolve(probeRoot, actualOutcome.behaviorImplementationPath);
    const baselineImplementation = await readFile(implementationPath, 'utf8');
    assert(baselineImplementation.includes(READINESS_PHASE_EXPRESSION), 'EV-19 pinned dishonest mutation target is unavailable');

    const baselineEntry = await buildHistoricalBehaviorRegression(repoRoot, probeRoot, actualOutcome, '.ev19-p28-pload2-baseline');
    const baselineRuns = [];
    for (let index = 0; index < actualOutcome.behaviorRunCount; index += 1) {
      baselineRuns.push(await runHistoricalBehaviorRegression(baselineEntry, probeRoot, actualOutcome));
    }

    await writeFile(implementationPath, `${baselineImplementation}\n// EV-19 benign disposable probe: semantics intentionally unchanged.\n`, 'utf8');
    const benignEntry = await buildHistoricalBehaviorRegression(repoRoot, probeRoot, actualOutcome, '.ev19-p28-pload2-benign');
    const benign = await runHistoricalBehaviorRegression(benignEntry, probeRoot, actualOutcome);

    await writeFile(implementationPath, baselineImplementation.replace(READINESS_PHASE_EXPRESSION, BROKEN_READINESS_PHASE_EXPRESSION), 'utf8');
    const dishonestEntry = await buildHistoricalBehaviorRegression(repoRoot, probeRoot, actualOutcome, '.ev19-p28-pload2-dishonest');
    const dishonest = await runHistoricalBehaviorRegression(dishonestEntry, probeRoot, actualOutcome, {
      expectPass: false,
      expectedFailure: EXPECTED_DISHONEST_FAILURE,
    });

    const baselinePassCount = baselineRuns.filter(result => result.passed).length;
    return {
      purpose: 'authenticate-the-later-outcome-and-measure-regression-sensitivity-not-forecast-accuracy',
      testPath: actualOutcome.behaviorTestPath,
      implementationPath: actualOutcome.behaviorImplementationPath,
      baselineRunCount: baselineRuns.length,
      baselinePassCount,
      repeatable: baselineRuns.length >= 2 && baselinePassCount === baselineRuns.length,
      benignMutationAccepted: benign.passed === true,
      dishonestMutationRejected: dishonest.expectedFailureObserved === true,
      dishonestFailureMarker: EXPECTED_DISHONEST_FAILURE,
      detectorFalsePositives: benign.passed === true ? 0 : 1,
      detectorFalseNegatives: dishonest.expectedFailureObserved === true ? 0 : 1,
      sandboxRemoteDetached: remoteDetached,
      countedAsPredictiveSignal: false,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function resolvePredictedSurface(path, lineage) {
  const mapping = lineage.find(entry => entry.predictionPath === path);
  return mapping?.resolvedPath ?? path;
}

async function measureSurfacePrediction(repoRoot, prediction, actualOutcome, actual, lineageEvidence) {
  const normalizedPredictedSurfaces = prediction.expectedSurfaces.map(path => resolvePredictedSurface(path, lineageEvidence));
  const summary = summarizeSurfacePrediction(normalizedPredictedSurfaces, actual.productionFiles);

  const introParent = await git(repoRoot, ['rev-parse', `${actualOutcome.featureIntroductionSha}^`]);
  const introChangedText = await git(repoRoot, ['diff', '--name-only', `${introParent}..${actualOutcome.featureIntroductionSha}`]);
  const featureIntroductionProductionSurfaces = (introChangedText ? introChangedText.split('\n').filter(Boolean) : [])
    .filter(path => path.startsWith(actualOutcome.productionPrefix));

  const observations = [];
  for (const revision of actual.featureBearingRevisions) {
    const changedText = await git(repoRoot, ['diff', '--name-only', `${actualOutcome.baseSha}..${revision}`]);
    const productionSurfaces = (changedText ? changedText.split('\n').filter(Boolean) : [])
      .filter(path => path.startsWith(actualOutcome.productionPrefix));
    observations.push({
      revision,
      productionSurfaces,
      predictedSurfaceHits: normalizedPredictedSurfaces.filter(path => productionSurfaces.includes(path)),
    });
  }

  const supportedSignals = [];
  for (const priorPath of prediction.expectedSurfaces) {
    const resolvedPath = resolvePredictedSurface(priorPath, lineageEvidence);
    const finalHit = summary.truePositiveSurfaces.includes(resolvedPath);
    const directFeatureIntroductionHit = featureIntroductionProductionSurfaces.includes(resolvedPath);
    const matchingPredictionCount = observations.filter(observation => observation.predictedSurfaceHits.includes(resolvedPath)).length;
    const repeatable = observations.length >= 2 && matchingPredictionCount === observations.length;
    if (finalHit && directFeatureIntroductionHit && repeatable) {
      supportedSignals.push({
        id: `expected-surface:${priorPath}`,
        predictionSource: `prediction.expectedSurfaces[${prediction.expectedSurfaces.indexOf(priorPath)}]`,
        priorPath,
        resolvedPath,
        directFeatureIntroductionHit,
        observedRevisionCount: observations.length,
        matchingPredictionCount,
        repeatable,
      });
    }
  }

  return {
    ...summary,
    priorExpectedSurfaces: prediction.expectedSurfaces,
    normalizedPredictedSurfaces,
    preferredSurfaceCount: prediction.preferredSurfaceCount,
    surfaceCountDelta: actual.productionFiles.length - prediction.preferredSurfaceCount,
    featureIntroductionSha: actualOutcome.featureIntroductionSha,
    featureIntroductionProductionSurfaces,
    featureBearingRevisionCount: observations.length,
    featureRevisionObservations: observations,
    supportedSignals,
  };
}

export async function buildRoadmapShadowValidationReport({ candidateSha, corpus = null, repoRoot = resolve('.') } = {}) {
  assertSha(candidateSha, 'candidateSha');
  const loadedCorpus = corpus ? validateRoadmapShadowValidationCorpus(corpus) : await loadRoadmapShadowValidationCorpus(resolve(repoRoot, 'agent/roadmap-shadow-validation-corpus.json'));
  const beforeHead = await git(repoRoot, ['rev-parse', 'HEAD']);
  const beforeStatus = await git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=no']);
  assert(beforeHead === candidateSha, `EV-19 report candidate ${candidateSha} does not match checked-out HEAD ${beforeHead}`);

  const prediction = await authenticatePrediction(repoRoot, loadedCorpus.prediction);
  const lineageEvidence = [];
  for (const lineage of loadedCorpus.surfaceLineage) {
    lineageEvidence.push(await authenticateSurfaceLineage(repoRoot, loadedCorpus.prediction, loadedCorpus.actualOutcome, lineage));
  }
  const actual = await authenticateActualOutcome(repoRoot, loadedCorpus);
  const surfacePrediction = await measureSurfacePrediction(repoRoot, prediction, loadedCorpus.actualOutcome, actual, lineageEvidence);
  const outcomeControl = await calibrateOutcomeControl(repoRoot, loadedCorpus.actualOutcome);

  const afterHead = await git(repoRoot, ['rev-parse', 'HEAD']);
  const afterStatus = await git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=no']);
  assert(afterHead === beforeHead, 'EV-19 calibration changed repository HEAD');
  assert(afterStatus === beforeStatus, 'EV-19 calibration changed tracked repository state');

  const report = {
    schema: 'ironshade-roadmap-shadow-validation-report:v3',
    schemaVersion: 3,
    taskId: 'EV-19',
    mode: 'advisory',
    candidateSha,
    prediction,
    surfaceLineage: lineageEvidence,
    actualOutcome: {
      kind: loadedCorpus.actualOutcome.kind,
      pullRequest: loadedCorpus.actualOutcome.pullRequest,
      baseSha: loadedCorpus.actualOutcome.baseSha,
      headSha: loadedCorpus.actualOutcome.headSha,
      mergeBase: actual.mergeBase,
      revisionCount: actual.revisions.length,
      featureBearingRevisionCount: actual.featureBearingRevisions.length,
      changedFileCount: actual.changedFiles.length,
      productionSurfaceCount: actual.productionFiles.length,
      testSurfaceCount: actual.testFiles.length,
      changedFiles: actual.changedFiles,
      productionSurfaces: actual.productionFiles,
      testSurfaces: actual.testFiles,
      behaviorTestPath: loadedCorpus.actualOutcome.behaviorTestPath,
      behaviorTestBlobSha: actual.behaviorTestBlobSha,
      behaviorImplementationPath: loadedCorpus.actualOutcome.behaviorImplementationPath,
      behaviorImplementationBlobSha: actual.behaviorImplementationBlobSha,
    },
    surfacePrediction,
    supportedSignals: surfacePrediction.supportedSignals,
    unsupportedSignals: loadedCorpus.unsupportedSignals,
    unsupportedScenarios: loadedCorpus.unsupportedScenarios,
    outcomeControl,
    conclusion: {
      repeatablePredictiveValueFound: surfacePrediction.supportedSignals.length > 0,
      lowFrictionScoreValidated: actual.productionFiles.length <= prediction.preferredSurfaceCount,
      completeExpectedSurfaceSetValidated: surfacePrediction.falsePositiveSurfaces.length === 0 && surfacePrediction.falseNegativeSurfaces.length === 0,
      observerExtensionPointValidated: false,
      forbiddenDependencyPredictionValidated: false,
      enforcementEligible: false,
      rationale: 'EV-19 counts only the frozen EV-7 expected-surface set as forecast evidence. The pre-outcome AO-6 path migration is authenticated before comparing with P28-PLOAD2. One frozen backend surface was directly changed by the PLOAD2 feature introduction and remains present across feature-bearing revisions; the second expected surface was a false alarm and three production surfaces were missed. Executable PLOAD2 mutation controls authenticate the outcome but are not counted as a forecast signal.',
    },
    isolation: {
      temporaryProbesPersisted: false,
      productRuntimeMutated: false,
      simulatorScoringChanged: false,
      disposableBehaviorCloneRemoteDetached: outcomeControl.sandboxRemoteDetached,
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
  console.log(`EV19_ROADMAP_SHADOW_VALIDATION_PASS candidate=${report.candidateSha} actual=${report.actualOutcome.headSha} revisions=${report.actualOutcome.revisionCount} featureRevisions=${report.actualOutcome.featureBearingRevisionCount} useful=${report.surfacePrediction.usefulPredictionCount} fp=${report.surfacePrediction.falseAlarmCount} fn=${report.surfacePrediction.missedIntegrationPressureCount} supported=${report.supportedSignals.map(signal => signal.id).join(',')} enforcement=false digest=${report.reportDigest}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`EV19_ROADMAP_SHADOW_VALIDATION_INVALID ${error.message}`);
    process.exitCode = 1;
  });
}
