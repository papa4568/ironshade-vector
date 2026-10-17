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
  return result.ok ? result.stdout.trim() : null;
}

async function sourceAt(repoRoot, ref, path) {
  return git(repoRoot, ['show', `${ref}:${path}`], { allowFailure: true });
}

function unique(values) {
  return [...new Set(values)];
}

function arraysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function summarizeSurfacePrediction(predictedSurfaces, actualSurfaces) {
  assert(Array.isArray(predictedSurfaces) && predictedSurfaces.length > 0, 'predictedSurfaces must be non-empty');
  assert(Array.isArray(actualSurfaces) && actualSurfaces.length > 0, 'actualSurfaces must be non-empty');
  const predicted = unique(predictedSurfaces);
  const actual = unique(actualSurfaces);
  const predictedSet = new Set(predicted);
  const actualSet = new Set(actual);
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

export function evaluatePredeclaredTrialRepeatability(trials, signal) {
  assert(Array.isArray(trials) && trials.length > 0, 'trials must be non-empty');
  assert(signal && typeof signal === 'object', 'signal must be an object');
  assertString(signal.id, 'signal.id');
  assertString(signal.normalizedOutcomePath, 'signal.normalizedOutcomePath');
  assert(Number.isInteger(signal.minimumPredeclaredTrialHits) && signal.minimumPredeclaredTrialHits >= 2, 'signal.minimumPredeclaredTrialHits must be at least 2');

  const eligible = trials.filter(trial =>
    trial.predeclared === true
    && trial.directOutcomeHit === true
    && trial.normalizedExpectedSurfaces.includes(signal.normalizedOutcomePath)
  );
  const candidateShas = unique(eligible.map(trial => trial.candidateSha));
  const configBlobShas = unique(eligible.map(trial => trial.configBlobSha));
  const distinctPredictions = candidateShas.length === eligible.length && configBlobShas.length === eligible.length;
  const established = eligible.length >= signal.minimumPredeclaredTrialHits && distinctPredictions;

  return {
    signalId: signal.id,
    normalizedOutcomePath: signal.normalizedOutcomePath,
    minimumPredeclaredTrialHits: signal.minimumPredeclaredTrialHits,
    hitCount: eligible.length,
    trialIds: eligible.map(trial => trial.id),
    distinctPredictionCandidateCount: candidateShas.length,
    distinctConfigBlobCount: configBlobShas.length,
    distinctPredictions,
    established,
  };
}

export function validateRoadmapShadowValidationCorpus(corpus) {
  assert(corpus && typeof corpus === 'object' && !Array.isArray(corpus), 'EV-19 corpus must be an object');
  assert(corpus.schemaVersion === 2, 'EV-19 corpus schemaVersion must be 2');
  assert(corpus.taskId === 'EV-19', 'EV-19 corpus taskId must remain EV-19');
  assert(corpus.mode === 'advisory', 'EV-19 corpus must remain advisory');
  assert(Array.isArray(corpus.predictionTrials) && corpus.predictionTrials.length === 2, 'EV-19 must pin exactly two predeclared prediction trials');

  const ids = new Set();
  for (const trial of corpus.predictionTrials) {
    assertString(trial.id, 'predictionTrials[].id');
    assert(!ids.has(trial.id), `duplicate prediction trial ${trial.id}`);
    ids.add(trial.id);
    assertSha(trial.candidateSha, `${trial.id}.candidateSha`);
    assertSha(trial.configBlobSha, `${trial.id}.configBlobSha`);
    assertString(trial.configPath, `${trial.id}.configPath`);
    assert(trial.taskId === 'P28-PLOAD2', `${trial.id} must remain pinned to P28-PLOAD2`);
    assert(trial.probeId === 'mission-load-readiness-observer', `${trial.id} probeId drifted`);
    assert(Number.isInteger(trial.preferredSurfaceCount) && trial.preferredSurfaceCount > 0, `${trial.id} preferredSurfaceCount invalid`);
    assert(Array.isArray(trial.expectedSurfaces) && trial.expectedSurfaces.length > 0, `${trial.id} expectedSurfaces must be non-empty`);
    assertString(trial.signalPath, `${trial.id}.signalPath`);
    assertString(trial.normalizedSignalPath, `${trial.id}.normalizedSignalPath`);
    assert(trial.expectedSurfaces.includes(trial.signalPath), `${trial.id} signalPath must be a predeclared expected surface`);
  }

  const [original, migrated] = corpus.predictionTrials;
  assert(original.id === 'ev7-original', 'first trial must remain ev7-original');
  assert(original.candidateSha === 'd1ddb444ba86c9b23b97b0e1987486b6ebc6cca0', 'EV-7 original candidate drifted');
  assert(original.configBlobSha === '522efd6e86b0dfde647b3fbfc981c995c216e165', 'EV-7 original config blob drifted');
  assert(arraysEqual(original.expectedSurfaces, [
    'src/game/combatGraphicsBackend.ts',
    'src/game/missionVisualReadinessGate.ts',
  ]), 'EV-7 original expected surfaces drifted');
  assert(original.preferredSurfaceCount === 2, 'EV-7 original preferred surface count drifted');
  assert(original.lineage && typeof original.lineage === 'object', 'EV-7 original trial must pin pre-outcome lineage');
  assertSha(original.lineage.migrationCommit, 'ev7-original.lineage.migrationCommit');
  assertSha(original.lineage.migrationParent, 'ev7-original.lineage.migrationParent');
  assert(original.lineage.resolvedPath === original.normalizedSignalPath, 'EV-7 lineage must resolve the normalized signal path');
  assert(Array.isArray(original.lineage.carryoverContracts) && original.lineage.carryoverContracts.length >= 2, 'EV-7 lineage carryover contracts missing');

  assert(migrated.id === 'ao6-snapshot-isolated', 'second trial must remain ao6-snapshot-isolated');
  assert(migrated.candidateSha === '87641dba570c1c389d4878a6996ad7bf872fbf67', 'AO-6 prediction candidate drifted');
  assert(migrated.configBlobSha === '387167310ae177441d9d28a1903fdab4354c7f99', 'AO-6 prediction config blob drifted');
  assert(arraysEqual(migrated.expectedSurfaces, [
    'src/game/combatGraphicsBackend.ts',
    'src/game/combatGraphicsBackendCore.ts',
    'src/game/missionVisualReadinessGate.ts',
  ]), 'AO-6 expected surfaces drifted');
  assert(migrated.preferredSurfaceCount === 3, 'AO-6 preferred surface count drifted');

  assertSha(corpus.trialRetirement?.commit, 'trialRetirement.commit');
  assertSha(corpus.trialRetirement?.parent, 'trialRetirement.parent');
  assert(corpus.trialRetirement.parent === migrated.candidateSha, 'trial retirement must directly follow the second prediction trial');
  assert(corpus.trialRetirement.replacementTaskId === 'P28-F6', 'trial retirement replacement task drifted');

  const outcome = corpus.actualOutcome;
  assert(outcome?.kind === 'merged-implementation', 'EV-19 must calibrate against the merged implementation');
  assert(outcome.pullRequest === 366, 'EV-19 actual outcome PR must remain #366');
  assertSha(outcome.baseSha, 'actualOutcome.baseSha');
  assertSha(outcome.implementationHeadSha, 'actualOutcome.implementationHeadSha');
  assertSha(outcome.finalHeadSha, 'actualOutcome.finalHeadSha');
  assertSha(outcome.mergeCommitSha, 'actualOutcome.mergeCommitSha');
  assert(Array.isArray(outcome.expectedProductionSurfaces) && outcome.expectedProductionSurfaces.length === 4, 'P28-PLOAD2 production surface truth must contain four paths');
  assert(Array.isArray(outcome.requiredChangedPaths) && outcome.requiredChangedPaths.length >= 2, 'P28-PLOAD2 task identity paths missing');

  assert(Array.isArray(corpus.supportedSignals) && corpus.supportedSignals.length === 1, 'EV-19 may validate exactly one narrow signal');
  const signal = corpus.supportedSignals[0];
  assert(signal.id === 'expected-surface:shared-backend-readiness', 'EV-19 supported signal id drifted');
  assert(signal.normalizedOutcomePath === 'src/game/combatGraphicsBackendCore.ts', 'EV-19 supported signal path drifted');
  assert(signal.minimumPredeclaredTrialHits === 2, 'EV-19 supported signal must require two trials');
  assert(signal.scope === 'same-task forecast robustness across a pre-outcome architecture refactor', 'EV-19 supported scope must remain narrow');

  assert(Array.isArray(corpus.unsupportedSignals) && corpus.unsupportedSignals.length === 3, 'EV-19 must preserve three unsupported signal classes');
  assert(Array.isArray(corpus.unsupportedScenarios) && corpus.unsupportedScenarios.some(entry => entry.taskId === 'P28-G1'), 'P28-G1 must remain unsupported');
  assert(corpus.promotionBoundary?.acceptedForEnforcement === false, 'EV-19 cannot accept enforcement');
  assert(corpus.promotionBoundary?.candidatePassGranted === false, 'EV-19 cannot grant candidate acceptance');
  assert(corpus.promotionBoundary?.blocking === false, 'EV-19 must remain non-blocking calibration');
  assert(corpus.promotionBoundary?.crossTaskGeneralizationEstablished === false, 'EV-19 must not claim cross-task generalization');
  return corpus;
}

export async function loadRoadmapShadowValidationCorpus(path = resolve('agent/roadmap-shadow-validation-corpus.json')) {
  return validateRoadmapShadowValidationCorpus(JSON.parse(await readFile(path, 'utf8')));
}

async function authenticatePredictionTrial(repoRoot, trial, outcomeBaseSha) {
  const blob = await git(repoRoot, ['rev-parse', `${trial.candidateSha}:${trial.configPath}`]);
  assert(blob === trial.configBlobSha, `${trial.id} config blob drifted: expected ${trial.configBlobSha}, got ${blob}`);
  const configText = await sourceAt(repoRoot, trial.candidateSha, trial.configPath);
  assert(configText !== null, `${trial.id} config unavailable`);
  const config = JSON.parse(configText);
  const scenario = config.scenarios?.find(entry => entry.taskId === trial.taskId);
  assert(scenario, `${trial.id} exact config lacks ${trial.taskId}`);
  assert(scenario.probeId === trial.probeId, `${trial.id} probe id drifted`);
  assert(scenario.preferredSurfaceCount === trial.preferredSurfaceCount, `${trial.id} preferred surface count drifted`);
  assert(arraysEqual(scenario.expectedSurfaces, trial.expectedSurfaces), `${trial.id} expected surface set drifted`);

  const committedAt = Number(await git(repoRoot, ['show', '-s', '--format=%ct', trial.candidateSha]));
  const outcomeBaseAt = Number(await git(repoRoot, ['show', '-s', '--format=%ct', outcomeBaseSha]));
  assert(Number.isFinite(committedAt) && Number.isFinite(outcomeBaseAt), `${trial.id} commit timestamp unavailable`);
  assert(committedAt < outcomeBaseAt, `${trial.id} must predate the measured outcome base`);

  return {
    ...trial,
    committedAt,
    outcomeBaseAt,
    predeclared: true,
  };
}

async function authenticateLineage(repoRoot, trial, outcomeBaseSha) {
  if (!trial.lineage) return null;
  const parent = await git(repoRoot, ['rev-parse', `${trial.lineage.migrationCommit}^`]);
  assert(parent === trial.lineage.migrationParent, 'EV-19 migration parent drifted');
  const migrationAt = Number(await git(repoRoot, ['show', '-s', '--format=%ct', trial.lineage.migrationCommit]));
  const outcomeBaseAt = Number(await git(repoRoot, ['show', '-s', '--format=%ct', outcomeBaseSha]));
  assert(migrationAt < outcomeBaseAt, 'EV-19 lineage migration must predate the measured outcome base');
  const frozenSource = await sourceAt(repoRoot, trial.candidateSha, trial.signalPath);
  const migratedSource = await sourceAt(repoRoot, trial.lineage.migrationCommit, trial.lineage.resolvedPath);
  const facadeSource = await sourceAt(repoRoot, trial.lineage.migrationCommit, trial.lineage.publicFacadePath);
  assert(frozenSource !== null && migratedSource !== null, 'EV-19 lineage sources unavailable');
  assert(facadeSource?.includes(trial.lineage.publicFacadeExport), 'EV-19 public facade export missing at lineage migration');
  for (const token of trial.lineage.carryoverContracts) {
    assert(frozenSource.includes(token), `frozen EV-7 source lacks lineage contract ${token}`);
    assert(migratedSource.includes(token), `migrated EV-7 source lacks lineage contract ${token}`);
  }
  return {
    migrationCommit: trial.lineage.migrationCommit,
    migrationParent: parent,
    resolvedPath: trial.lineage.resolvedPath,
    publicFacadePath: trial.lineage.publicFacadePath,
    carryoverContracts: trial.lineage.carryoverContracts,
    predatesOutcome: true,
  };
}

async function authenticateRetirement(repoRoot, retirement, secondTrial, outcomeBaseSha) {
  const parent = await git(repoRoot, ['rev-parse', `${retirement.commit}^`]);
  assert(parent === retirement.parent && parent === secondTrial.candidateSha, 'EV-19 trial retirement parent drifted');
  const before = JSON.parse(await sourceAt(repoRoot, retirement.parent, secondTrial.configPath));
  const after = JSON.parse(await sourceAt(repoRoot, retirement.commit, secondTrial.configPath));
  const beforeScenario = before.scenarios?.find(entry => entry.probeId === secondTrial.probeId);
  const afterScenario = after.scenarios?.find(entry => entry.probeId === secondTrial.probeId);
  assert(beforeScenario?.taskId === 'P28-PLOAD2', 'retirement parent must still predict P28-PLOAD2');
  assert(afterScenario?.taskId === retirement.replacementTaskId, 'retirement commit must replace P28-PLOAD2 with the pinned later task');
  const retiredAt = Number(await git(repoRoot, ['show', '-s', '--format=%ct', retirement.commit]));
  const outcomeBaseAt = Number(await git(repoRoot, ['show', '-s', '--format=%ct', outcomeBaseSha]));
  assert(retiredAt < outcomeBaseAt, 'prediction trial must be retired before the measured outcome base');
  return {
    ...retirement,
    retiredAt,
    predatesOutcome: true,
    beforeTaskId: beforeScenario.taskId,
    afterTaskId: afterScenario.taskId,
  };
}

async function authenticateActualOutcome(repoRoot, outcome) {
  for (const sha of [outcome.baseSha, outcome.implementationHeadSha, outcome.finalHeadSha, outcome.mergeCommitSha]) {
    const exists = await git(repoRoot, ['cat-file', '-e', `${sha}^{commit}`], { allowFailure: true });
    assert(exists !== null, `actual outcome commit ${sha} is unavailable`);
  }
  const implementationBase = await git(repoRoot, ['merge-base', outcome.baseSha, outcome.implementationHeadSha]);
  assert(implementationBase === outcome.baseSha, 'P28-PLOAD2 implementation must descend from pinned base');
  const finalBase = await git(repoRoot, ['merge-base', outcome.baseSha, outcome.finalHeadSha]);
  assert(finalBase === outcome.baseSha, 'P28-PLOAD2 final head must descend from pinned base');
  const merged = await git(repoRoot, ['merge-base', '--is-ancestor', outcome.finalHeadSha, outcome.mergeCommitSha], { allowFailure: true });
  assert(merged !== null, 'P28-PLOAD2 final head must be contained in pinned merge commit');

  const changedText = await git(repoRoot, ['diff', '--name-only', `${outcome.baseSha}..${outcome.implementationHeadSha}`]);
  const changedFiles = changedText ? changedText.split('\n').filter(Boolean) : [];
  for (const requiredPath of outcome.requiredChangedPaths) {
    assert(changedFiles.includes(requiredPath), `P28-PLOAD2 implementation lacks required path ${requiredPath}`);
  }
  const productionSurfaces = changedFiles.filter(path => path.startsWith(outcome.productionPrefix));
  assert(arraysEqual(productionSurfaces, outcome.expectedProductionSurfaces), `P28-PLOAD2 production surfaces drifted: ${productionSurfaces.join(', ')}`);

  return {
    pullRequest: outcome.pullRequest,
    baseSha: outcome.baseSha,
    implementationHeadSha: outcome.implementationHeadSha,
    finalHeadSha: outcome.finalHeadSha,
    mergeCommitSha: outcome.mergeCommitSha,
    changedFiles,
    productionSurfaces,
  };
}

function normalizeTrialSurfaces(trial, lineage) {
  return unique(trial.expectedSurfaces.map(path => (
    lineage && path === trial.signalPath ? lineage.resolvedPath : path
  )));
}

export async function buildRoadmapShadowValidationReport({ candidateSha, corpus = null, repoRoot = resolve('.') } = {}) {
  const loaded = validateRoadmapShadowValidationCorpus(corpus ?? await loadRoadmapShadowValidationCorpus());
  const resolvedCandidateSha = candidateSha ?? await git(repoRoot, ['rev-parse', 'HEAD']);
  assertSha(resolvedCandidateSha, 'candidateSha');
  const exactHead = await git(repoRoot, ['rev-parse', 'HEAD']);
  assert(exactHead === resolvedCandidateSha, `candidate SHA mismatch: expected ${resolvedCandidateSha}, got ${exactHead}`);

  const outcome = await authenticateActualOutcome(repoRoot, loaded.actualOutcome);
  const authenticatedTrials = [];
  for (const trial of loaded.predictionTrials) {
    const authenticated = await authenticatePredictionTrial(repoRoot, trial, loaded.actualOutcome.baseSha);
    const lineage = await authenticateLineage(repoRoot, trial, loaded.actualOutcome.baseSha);
    const normalizedExpectedSurfaces = normalizeTrialSurfaces(trial, lineage);
    const surfacePrediction = summarizeSurfacePrediction(normalizedExpectedSurfaces, outcome.productionSurfaces);
    authenticatedTrials.push({
      id: trial.id,
      candidateSha: trial.candidateSha,
      configBlobSha: trial.configBlobSha,
      taskId: trial.taskId,
      probeId: trial.probeId,
      committedAt: authenticated.committedAt,
      predeclared: authenticated.predeclared,
      preferredSurfaceCount: trial.preferredSurfaceCount,
      rawExpectedSurfaces: trial.expectedSurfaces,
      normalizedExpectedSurfaces,
      normalizedSignalPath: trial.normalizedSignalPath,
      directOutcomeHit: surfacePrediction.truePositiveSurfaces.includes(trial.normalizedSignalPath),
      surfacePrediction,
      lineage,
    });
  }

  const retirement = await authenticateRetirement(
    repoRoot,
    loaded.trialRetirement,
    loaded.predictionTrials[1],
    loaded.actualOutcome.baseSha,
  );
  assert(authenticatedTrials[0].candidateSha !== authenticatedTrials[1].candidateSha, 'prediction trials must have distinct candidate SHAs');
  assert(authenticatedTrials[0].configBlobSha !== authenticatedTrials[1].configBlobSha, 'prediction trials must have distinct config blobs');

  const repeatability = evaluatePredeclaredTrialRepeatability(authenticatedTrials, loaded.supportedSignals[0]);
  assert(repeatability.established, 'EV-19 predeclared trial repeatability was not established');

  const detectorControls = [
    { name: 'two-distinct-predeclared-hits', expected: true, actual: repeatability.established },
    {
      name: 'duplicate-prediction-rejected',
      expected: false,
      actual: evaluatePredeclaredTrialRepeatability(
        [authenticatedTrials[0], { ...authenticatedTrials[0], id: 'duplicate' }],
        loaded.supportedSignals[0],
      ).established,
    },
    {
      name: 'post-hoc-trial-rejected',
      expected: false,
      actual: evaluatePredeclaredTrialRepeatability(
        [authenticatedTrials[0], { ...authenticatedTrials[1], predeclared: false }],
        loaded.supportedSignals[0],
      ).established,
    },
    {
      name: 'non-hit-trial-rejected',
      expected: false,
      actual: evaluatePredeclaredTrialRepeatability(
        [authenticatedTrials[0], { ...authenticatedTrials[1], directOutcomeHit: false }],
        loaded.supportedSignals[0],
      ).established,
    },
  ];
  const detectorFalsePositives = detectorControls.filter(control => control.expected === false && control.actual === true).length;
  const detectorFalseNegatives = detectorControls.filter(control => control.expected === true && control.actual === false).length;
  assert(detectorFalsePositives === 0, 'EV-19 detector calibration has false positives');
  assert(detectorFalseNegatives === 0, 'EV-19 detector calibration has false negatives');

  const report = {
    schema: 'ironshade-roadmap-shadow-validation-report:v5',
    schemaVersion: 5,
    taskId: 'EV-19',
    candidateSha: resolvedCandidateSha,
    mode: 'advisory',
    acceptedForEnforcement: false,
    candidatePassGranted: false,
    blocking: false,
    actualOutcome: outcome,
    predictionTrials: authenticatedTrials,
    trialRetirement: retirement,
    supportedSignals: [{
      ...loaded.supportedSignals[0],
      ...repeatability,
    }],
    repeatability: {
      ...repeatability,
      distinctOutcomeCount: 1,
      crossTaskGeneralizationEstablished: false,
      interpretation: 'Two distinct committed pre-outcome forecast snapshots selected the same normalized shared-backend-readiness integration surface across an AO-6 architecture refactor. This establishes only same-task forecast robustness, not accuracy across different product tasks.',
    },
    detectorCalibration: {
      controls: detectorControls,
      falsePositives: detectorFalsePositives,
      falseNegatives: detectorFalseNegatives,
      falsePositiveBudget: 0,
      falseNegativeBudget: 0,
      pass: detectorFalsePositives === 0 && detectorFalseNegatives === 0,
    },
    unsupportedSignals: loaded.unsupportedSignals,
    unsupportedScenarios: loaded.unsupportedScenarios,
    isolation: {
      simulatorMode: 'advisory',
      productRuntimeMutated: false,
      temporaryProbesPersisted: false,
      simulatorScoringChanged: false,
      rollback: 'Remove EV-19 validation-only workflow/corpus/tool/test files; the existing EV-7 simulator and all candidate proof gates continue unchanged.',
    },
    conclusion: {
      repeatablePredictiveValueFound: true,
      validatedSignalCount: 1,
      lowFrictionScoreValidated: false,
      completeExpectedSurfaceSetValidated: false,
      crossTaskGeneralizationEstablished: false,
      enforcementEligible: false,
      ev20MayReviewOnlySupportedSignals: true,
    },
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
  assert(!args.includes('--enforce'), 'EV-19 remains calibration-only; no Roadmap Shadow signal is enforcement-ready');
  const repoRoot = resolve(readArg(args, '--repo-root') ?? '.');
  const candidateSha = readArg(args, '--candidate-sha') ?? await git(repoRoot, ['rev-parse', 'HEAD']);
  const output = readArg(args, '--output');
  const report = await buildRoadmapShadowValidationReport({ candidateSha, repoRoot });
  if (output) {
    const outputPath = resolve(repoRoot, output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalJson(report), 'utf8');
  }
  console.log(`EV19_ROADMAP_SHADOW_VALIDATION_PASS candidate=${report.candidateSha} signal=${report.supportedSignals[0].id} hits=${report.repeatability.hitCount} fp=${report.detectorCalibration.falsePositives} fn=${report.detectorCalibration.falseNegatives} crossTask=false enforcement=false digest=${report.reportDigest}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`EV19_ROADMAP_SHADOW_VALIDATION_INVALID ${error.message}`);
    process.exitCode = 1;
  });
}
