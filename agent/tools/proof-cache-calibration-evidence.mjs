import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildObservationReport,
  buildPrediction,
  computeClosure,
  validateHistoryAgainstGit,
  validateProofCacheHistory,
  validateProofCachePolicy,
} from './causal-proof-cache.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;

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

function run(command, { env = {}, expectedOutcome = 'success' } = {}) {
  const result = spawnSync('bash', ['-lc', command], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, CI: process.env.CI ?? '1', ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const outcome = result.status === 0 ? 'success' : 'failure';
  assert(outcome === expectedOutcome, `command outcome mismatch for ${command}: expected ${expectedOutcome}, got ${outcome}\n${output.slice(-6000)}`);
  return { outcome, status: result.status, output, outputDigest: sha256(output) };
}

function git(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert(result.status === 0, `git ${args.join(' ')} failed: ${(result.stderr ?? '').slice(-4000)}`);
  return `${result.stdout ?? ''}`.trim();
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function sameJson(actual, expected, label) {
  assert(canonicalJson(actual) === canonicalJson(expected), `${label} does not match the EV-6 proof policy`);
}

export function validateProofCacheCalibrationCorpus(corpus, policy) {
  assert(corpus && typeof corpus === 'object' && !Array.isArray(corpus), 'proof-cache calibration corpus must be an object');
  assert(corpus.schemaVersion === 1, 'proof-cache calibration corpus schemaVersion must be 1');
  assert(corpus.mode === 'advisory', 'EV-17 must remain advisory');
  assert(corpus.taskId === 'EV-17', 'calibration taskId must be EV-17');
  assert(corpus.promotionTarget === 'EV-18', 'calibration promotionTarget must be EV-18');
  assert(corpus.errorBudget?.falseHits === 0, 'EV-17 false-hit budget must be zero');
  assert(corpus.errorBudget?.sameClosureDisagreements === 0, 'EV-17 same-closure disagreement budget must be zero');
  assert(Number.isInteger(corpus.minimumSameClosureRuns) && corpus.minimumSameClosureRuns >= 2, 'minimumSameClosureRuns must be at least two');
  assert(Array.isArray(corpus.proofClasses) && corpus.proofClasses.length > 0, 'proofClasses must be non-empty');
  validateProofCachePolicy(policy);

  const ids = new Set();
  for (const entry of corpus.proofClasses) {
    assertString(entry.proofId, 'proofId');
    assert(!ids.has(entry.proofId), `duplicate proof class ${entry.proofId}`);
    ids.add(entry.proofId);
    const proof = policy.proofClasses.find(value => value.id === entry.proofId);
    assert(proof, `unknown EV-6 proof class ${entry.proofId}`);
    assert(entry.expectedCommand === proof.command, `${entry.proofId} expectedCommand drifted`);
    sameJson(entry.expectedRepositoryClosure, proof.repositoryClosure, `${entry.proofId}.expectedRepositoryClosure`);
    sameJson(entry.expectedRuntimeClosure, proof.runtimeClosure, `${entry.proofId}.expectedRuntimeClosure`);
    assert(Array.isArray(entry.requiredEnvironmentInputs) && entry.requiredEnvironmentInputs.length > 0, `${entry.proofId}.requiredEnvironmentInputs must be non-empty`);
    assert(Array.isArray(entry.knownClosureGaps), `${entry.proofId}.knownClosureGaps must be an array`);
    for (const gap of entry.knownClosureGaps) {
      assertString(gap.id, `${entry.proofId}.knownClosureGaps.id`);
      assertString(gap.input, `${entry.proofId}.knownClosureGaps.input`);
      assertString(gap.reason, `${entry.proofId}.knownClosureGaps.reason`);
      assert(typeof gap.blocksEligibility === 'boolean', `${entry.proofId}.knownClosureGaps.blocksEligibility must be boolean`);
    }
    assert(Array.isArray(entry.probes) && entry.probes.length >= 3, `${entry.proofId}.probes must contain representative controls and a defect`);
    const probeIds = new Set();
    for (const probe of entry.probes) {
      assertString(probe.id, 'probe id');
      assert(!probeIds.has(probe.id), `duplicate probe id ${probe.id}`);
      probeIds.add(probe.id);
      assert(['same-closure-control', 'invalidation-control', 'invalidation-defect'].includes(probe.kind), `${probe.id}.kind is invalid`);
      assert(Array.isArray(probe.mutations) && probe.mutations.length > 0, `${probe.id}.mutations must be non-empty`);
      const targets = new Set();
      for (const mutation of probe.mutations) {
        assertString(mutation.targetPath, `${probe.id}.mutations.targetPath`);
        assertString(mutation.mutationSuffix, `${probe.id}.mutations.mutationSuffix`);
        assert(!targets.has(mutation.targetPath), `${probe.id} repeats target ${mutation.targetPath}`);
        targets.add(mutation.targetPath);
      }
      assert(['same', 'different'].includes(probe.expectedClosureRelation), `${probe.id}.expectedClosureRelation is invalid`);
      assert(['success', 'failure'].includes(probe.expectedOutcome), `${probe.id}.expectedOutcome is invalid`);
      assert(['hit', 'miss'].includes(probe.expectedPrediction), `${probe.id}.expectedPrediction is invalid`);
      if (probe.expectedOutcome === 'failure') assertString(probe.expectedFailurePattern, `${probe.id}.expectedFailurePattern`);
    }
  }
  return corpus;
}

function observationFromClosure(closure, { id, outcome, workflowRunId }) {
  return {
    id,
    source: 'candidate-rerun',
    proofId: closure.proofId,
    candidateSha: closure.candidateSha,
    repositoryDigest: closure.repositoryDigest,
    executionContextDigest: closure.executionContextDigest,
    closureDigest: closure.closureDigest,
    outcome,
    workflowRunId: String(workflowRunId),
  };
}

function summarizeHistoricalDisagreements(history, proofId) {
  const groups = new Map();
  for (const observation of history.observations.filter(entry => entry.proofId === proofId)) {
    const group = groups.get(observation.closureDigest) ?? { observationIds: [], outcomes: new Set() };
    group.observationIds.push(observation.id);
    group.outcomes.add(observation.outcome);
    groups.set(observation.closureDigest, group);
  }
  const sameClosureGroups = [...groups.entries()].map(([closureDigest, group]) => ({
    closureDigest,
    observationIds: group.observationIds.sort(),
    outcomes: [...group.outcomes].sort(),
    disagreement: group.outcomes.size > 1,
  }));
  return {
    observationCount: sameClosureGroups.reduce((sum, group) => sum + group.observationIds.length, 0),
    closureGroupCount: sameClosureGroups.length,
    disagreementCount: sameClosureGroups.filter(group => group.disagreement).length,
    groups: sameClosureGroups,
  };
}

function runtimeVariant(context, dimension) {
  const next = structuredClone(context);
  if (dimension === 'runnerLabel') next.runnerLabel = `${next.runnerLabel}-ev17-probe`;
  else if (dimension === 'node') next.node = `${next.node}-ev17-probe`;
  else if (dimension === 'npm') next.npm = `${next.npm}-ev17-probe`;
  else if (dimension === 'platform') next.platform = `${next.platform}-ev17-probe`;
  else if (dimension === 'arch') next.arch = `${next.arch}-ev17-probe`;
  else {
    assert(dimension.startsWith('env:'), `unknown runtime dimension ${dimension}`);
    const name = dimension.slice(4);
    assert(Object.hasOwn(next.env, name), `runtime context does not capture ${name}`);
    next.env[name] = { present: true, valueSha256: sha256(`ev17-runtime-probe:${name}`) };
  }
  return next;
}

function runtimeClosureAudit({ proofEntry, policy, candidateSha, baselineClosure }) {
  const context = baselineClosure.executionContext;
  const captured = {
    'runner-image-os': context.env?.ImageOS?.present === true,
    'runner-image-version': context.env?.ImageVersion?.present === true,
    'node-version': typeof context.node === 'string' && context.node.length > 0,
    'npm-version': typeof context.npm === 'string' && context.npm.length > 0,
    platform: typeof context.platform === 'string' && context.platform.length > 0,
    architecture: typeof context.arch === 'string' && context.arch.length > 0,
    VITE_API_BASE_URL: Object.hasOwn(context.env ?? {}, 'VITE_API_BASE_URL'),
  };
  const missingInputs = proofEntry.requiredEnvironmentInputs.filter(input => captured[input] !== true);
  const dimensions = ['runnerLabel', 'node', 'npm', 'platform', 'arch', ...proofEntry.expectedRuntimeClosure.environmentVariables.map(name => `env:${name}`)];
  const invalidationControls = dimensions.map(dimension => {
    const changed = computeClosure({
      policy,
      proofId: proofEntry.proofId,
      revision: candidateSha,
      executionContext: runtimeVariant(context, dimension),
    });
    return {
      dimension,
      invalidatesClosure: changed.closureDigest !== baselineClosure.closureDigest,
      closureDigest: changed.closureDigest,
    };
  });
  const invalidationControlsPass = invalidationControls.every(entry => entry.invalidatesClosure);
  return {
    requiredInputs: proofEntry.requiredEnvironmentInputs,
    captured,
    missingInputs,
    requiredInputsClosed: missingInputs.length === 0,
    runnerLabel: context.runnerLabel,
    runnerImageIdentityBound: captured['runner-image-os'] && captured['runner-image-version'],
    invalidationControls,
    invalidationControlsPass,
  };
}

export function evaluateProofClassEligibility({ corpus, proofEntry, trialRows, runtimeAudit, historicalDisagreementCount = 0 }) {
  const baseline = trialRows.find(row => row.kind === 'baseline');
  assert(baseline?.outcome === 'success', `${proofEntry.proofId} requires a successful baseline rerun`);
  const sameClosureRows = trialRows.filter(row => row.closureRelation === 'same');
  const falseHits = trialRows.filter(row => row.classification === 'false-hit').length;
  const falseMisses = trialRows.filter(row => row.classification === 'false-miss').length;
  const sameClosureDisagreements = sameClosureRows.filter(row => row.outcome !== baseline.outcome).length;
  const invalidationDefects = trialRows.filter(row => row.kind === 'invalidation-defect');
  const detectedInvalidationDefects = invalidationDefects.filter(row => row.prediction === 'miss' && row.outcome === 'failure').length;
  const blockingGaps = proofEntry.knownClosureGaps.filter(gap => gap.blocksEligibility);
  const eligible = falseHits <= corpus.errorBudget.falseHits
    && sameClosureDisagreements <= corpus.errorBudget.sameClosureDisagreements
    && historicalDisagreementCount === 0
    && sameClosureRows.length >= corpus.minimumSameClosureRuns
    && invalidationDefects.length > 0
    && detectedInvalidationDefects === invalidationDefects.length
    && runtimeAudit.requiredInputsClosed
    && runtimeAudit.invalidationControlsPass !== false
    && blockingGaps.length === 0;
  const reasons = [];
  if (falseHits > corpus.errorBudget.falseHits) reasons.push(`false hits ${falseHits} exceed budget ${corpus.errorBudget.falseHits}`);
  if (sameClosureDisagreements > corpus.errorBudget.sameClosureDisagreements) reasons.push(`same-closure disagreements ${sameClosureDisagreements} exceed budget ${corpus.errorBudget.sameClosureDisagreements}`);
  if (historicalDisagreementCount > 0) reasons.push(`retained history contains ${historicalDisagreementCount} same-closure disagreement group(s)`);
  if (sameClosureRows.length < corpus.minimumSameClosureRuns) reasons.push(`same-closure runs ${sameClosureRows.length} are below minimum ${corpus.minimumSameClosureRuns}`);
  if (detectedInvalidationDefects !== invalidationDefects.length) reasons.push('representative defect invalidation did not fail closed');
  if (!runtimeAudit.requiredInputsClosed) reasons.push(`runtime closure missing required inputs: ${runtimeAudit.missingInputs.join(', ')}`);
  if (runtimeAudit.invalidationControlsPass === false) reasons.push('one or more declared runtime inputs do not invalidate the closure digest');
  for (const gap of blockingGaps) reasons.push(gap.reason);
  return {
    eligible,
    falseHits,
    falseMisses,
    sameClosureRunCount: sameClosureRows.length,
    sameClosureDisagreements,
    historicalSameClosureDisagreements: historicalDisagreementCount,
    invalidationDefectCount: invalidationDefects.length,
    detectedInvalidationDefectCount: detectedInvalidationDefects,
    reasons,
  };
}

async function runProbe({ probe, policy, proofEntry, baselineClosure, baselineHistory, candidateSha, workflowRunId }) {
  const originals = [];
  const cleanBefore = git(['status', '--porcelain', '--untracked-files=no']);
  assert(cleanBefore === '', `${probe.id} requires a clean tracked checkout`);
  let syntheticSha = null;
  let trial = null;
  try {
    for (const mutation of probe.mutations) {
      const path = resolve(mutation.targetPath);
      const content = await readFile(path, 'utf8');
      originals.push({ targetPath: mutation.targetPath, path, content, digest: sha256(content) });
      await writeFile(path, `${content}${mutation.mutationSuffix}`, 'utf8');
    }
    git(['add', '--', ...probe.mutations.map(entry => entry.targetPath)]);
    git(['-c', 'user.name=EV-17 Calibration', '-c', 'user.email=ev17@example.invalid', 'commit', '-m', `EV-17 disposable probe ${probe.id}`]);
    syntheticSha = git(['rev-parse', 'HEAD']);
    assert(SHA_PATTERN.test(syntheticSha), `${probe.id} synthetic commit SHA is invalid`);
    const closure = computeClosure({
      policy,
      proofId: proofEntry.proofId,
      revision: syntheticSha,
      executionContext: baselineClosure.executionContext,
    });
    const closureRelation = closure.closureDigest === baselineClosure.closureDigest ? 'same' : 'different';
    assert(closureRelation === probe.expectedClosureRelation, `${probe.id} closure relation expected ${probe.expectedClosureRelation}, got ${closureRelation}`);
    const prediction = buildPrediction({
      policy,
      history: baselineHistory,
      proofId: proofEntry.proofId,
      revision: syntheticSha,
      executionContext: baselineClosure.executionContext,
    });
    const predictionClass = prediction.reuseWouldBeSafe ? 'hit' : 'miss';
    assert(predictionClass === probe.expectedPrediction, `${probe.id} prediction expected ${probe.expectedPrediction}, got ${predictionClass}`);
    const execution = run(proofEntry.expectedCommand, { expectedOutcome: probe.expectedOutcome });
    if (probe.expectedFailurePattern) assert(execution.output.includes(probe.expectedFailurePattern), `${probe.id} failed without expected criterion: ${probe.expectedFailurePattern}`);
    const observation = buildObservationReport({ prediction, outcome: execution.outcome, workflowRunId });
    let classification = 'agreement';
    if (predictionClass === 'hit' && execution.outcome !== 'success') classification = 'false-hit';
    else if (predictionClass === 'miss' && execution.outcome === 'success') classification = 'false-miss';
    else if (predictionClass === 'miss' && execution.outcome === 'failure') classification = 'correct-invalidation';
    if (probe.expectedClassification) assert(classification === probe.expectedClassification, `${probe.id} classification expected ${probe.expectedClassification}, got ${classification}`);
    trial = {
      id: probe.id,
      kind: probe.kind,
      targetPaths: probe.mutations.map(entry => entry.targetPath),
      syntheticSha,
      closureRelation,
      closureDigest: closure.closureDigest,
      repositoryDigest: closure.repositoryDigest,
      prediction: predictionClass,
      predictionReuseWouldBeSafe: prediction.reuseWouldBeSafe,
      outcome: execution.outcome,
      outputDigest: execution.outputDigest,
      classification,
      observationAgreement: observation.comparison.agreement,
      proofActuallyRerun: observation.proofActuallyRerun,
      acceptedForReuse: observation.acceptedForReuse,
      candidatePassGranted: observation.candidatePassGranted,
    };
  } finally {
    git(['reset', '--hard', candidateSha]);
  }
  for (const original of originals) {
    const restored = await readFile(original.path, 'utf8');
    assert(sha256(restored) === original.digest, `${probe.id} did not restore ${original.targetPath}`);
  }
  const cleanAfter = git(['status', '--porcelain', '--untracked-files=no']);
  assert(cleanAfter === '', `${probe.id} did not restore exact candidate tracked state`);
  return { ...trial, rollback: { sourceRestored: true, headRestored: git(['rev-parse', 'HEAD']) === candidateSha } };
}

export async function runProofCacheCalibrationEvidence({ candidateSha, workflowRunId = process.env.GITHUB_RUN_ID ?? '0', executeProofs = true } = {}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  assert(git(['rev-parse', 'HEAD']) === candidateSha, `candidateSha ${candidateSha} does not match checked-out HEAD`);
  assert(git(['status', '--porcelain', '--untracked-files=no']) === '', 'EV-17 evidence requires a clean tracked checkout');

  const [policyRaw, historyRaw, corpusRaw] = await Promise.all([
    readFile(resolve('agent/proof-cache.json'), 'utf8'),
    readFile(resolve('agent/proof-cache-history.json'), 'utf8'),
    readFile(resolve('agent/proof-cache-calibration-corpus.json'), 'utf8'),
  ]);
  const policy = validateProofCachePolicy(JSON.parse(policyRaw));
  const retainedHistory = validateProofCacheHistory(JSON.parse(historyRaw));
  validateHistoryAgainstGit({ policy, history: retainedHistory });
  const corpus = validateProofCacheCalibrationCorpus(JSON.parse(corpusRaw), policy);
  assert(policy.mode === 'shadow', 'EV-17 must not enable proof reuse');

  const proofReports = [];
  for (const proofEntry of corpus.proofClasses) {
    const baselineClosure = computeClosure({ policy, proofId: proofEntry.proofId, revision: candidateSha });
    const runtimeAudit = runtimeClosureAudit({ proofEntry, policy, candidateSha, baselineClosure });
    const historical = summarizeHistoricalDisagreements(retainedHistory, proofEntry.proofId);
    const trialRows = [];

    if (executeProofs) {
      const baselineExecution = run(proofEntry.expectedCommand, { expectedOutcome: 'success' });
      trialRows.push({
        id: 'exact-candidate-baseline',
        kind: 'baseline',
        targetPaths: [],
        syntheticSha: candidateSha,
        closureRelation: 'same',
        closureDigest: baselineClosure.closureDigest,
        repositoryDigest: baselineClosure.repositoryDigest,
        prediction: 'baseline',
        predictionReuseWouldBeSafe: false,
        outcome: baselineExecution.outcome,
        outputDigest: baselineExecution.outputDigest,
        classification: 'baseline',
        proofActuallyRerun: true,
        acceptedForReuse: false,
        candidatePassGranted: false,
        rollback: { sourceRestored: true, headRestored: true },
      });
      const baselineHistory = validateProofCacheHistory({
        schemaVersion: 1,
        mode: 'shadow',
        observations: [observationFromClosure(baselineClosure, {
          id: `ev17-baseline-${candidateSha.slice(0, 12)}`,
          outcome: baselineExecution.outcome,
          workflowRunId,
        })],
      });
      for (const probe of proofEntry.probes) {
        trialRows.push(await runProbe({ probe, policy, proofEntry, baselineClosure, baselineHistory, candidateSha, workflowRunId }));
      }
    }

    const eligibility = executeProofs
      ? evaluateProofClassEligibility({
        corpus,
        proofEntry,
        trialRows,
        runtimeAudit,
        historicalDisagreementCount: historical.disagreementCount,
      })
      : { eligible: false, falseHits: null, falseMisses: null, sameClosureRunCount: null, sameClosureDisagreements: null, reasons: ['proof execution disabled'] };

    proofReports.push({
      proofId: proofEntry.proofId,
      command: proofEntry.expectedCommand,
      repositoryClosure: proofEntry.expectedRepositoryClosure,
      runtimeClosure: proofEntry.expectedRuntimeClosure,
      exactCandidateClosure: baselineClosure,
      retainedHistoricalEvidence: historical,
      runtimeClosureAudit: runtimeAudit,
      knownClosureGaps: proofEntry.knownClosureGaps,
      trials: trialRows,
      metrics: eligibility,
      eligibleForEV18: eligibility.eligible,
    });
  }

  const eligibleProofClasses = proofReports.filter(entry => entry.eligibleForEV18).map(entry => entry.proofId);
  const unresolvedProofClasses = proofReports.filter(entry => !entry.eligibleForEV18).map(entry => ({
    proofId: entry.proofId,
    reasons: entry.metrics.reasons,
  }));
  const allTrials = proofReports.flatMap(entry => entry.trials);
  const report = {
    schema: 'ironshade-proof-cache-calibration-evidence:v1',
    schemaVersion: 1,
    taskId: 'EV-17',
    mode: 'advisory',
    candidateSha,
    workflowRunId: String(workflowRunId),
    policyDigest: sha256(JSON.parse(policyRaw)),
    historyDigest: sha256(JSON.parse(historyRaw)),
    corpusDigest: sha256(JSON.parse(corpusRaw)),
    proofReports,
    metrics: {
      proofClassCount: proofReports.length,
      executedTrialCount: allTrials.length,
      falseHits: proofReports.reduce((sum, entry) => sum + (entry.metrics.falseHits ?? 0), 0),
      falseMisses: proofReports.reduce((sum, entry) => sum + (entry.metrics.falseMisses ?? 0), 0),
      sameClosureDisagreements: proofReports.reduce((sum, entry) => sum + (entry.metrics.sameClosureDisagreements ?? 0), 0),
      retainedHistoricalSameClosureDisagreements: proofReports.reduce((sum, entry) => sum + entry.retainedHistoricalEvidence.disagreementCount, 0),
    },
    eligibleProofClasses,
    unresolvedProofClasses,
    rollback: {
      proofReuseEnabled: false,
      proofPolicyChanged: false,
      sourceMutationsRestored: allTrials.every(entry => entry.rollback?.sourceRestored !== false),
      exactHeadRestored: git(['rev-parse', 'HEAD']) === candidateSha,
      trackedStateClean: git(['status', '--porcelain', '--untracked-files=no']) === '',
      rollbackAction: 'Remove the EV-17 calibration corpus/tool/test/workflow. EV-6 remains shadow-only and every real proof continues to rerun.',
    },
    acceptedForReuse: false,
    acceptedForEnforcement: false,
    candidatePassGranted: false,
  };

  assert(report.metrics.falseHits <= corpus.errorBudget.falseHits, 'EV-17 false-hit budget exceeded');
  assert(report.metrics.sameClosureDisagreements <= corpus.errorBudget.sameClosureDisagreements, 'EV-17 same-closure disagreement budget exceeded');
  assert(report.metrics.retainedHistoricalSameClosureDisagreements === 0, 'EV-17 retained history contains a same-closure disagreement');
  assert(report.rollback.proofReuseEnabled === false && report.rollback.proofPolicyChanged === false, 'EV-17 must not change reuse enforcement');
  assert(report.rollback.sourceMutationsRestored && report.rollback.exactHeadRestored && report.rollback.trackedStateClean, 'EV-17 did not restore exact candidate state');
  if (executeProofs) assert(report.eligibleProofClasses.length === corpus.proofClasses.length, 'EV-17 measured proof class did not satisfy the calibrated EV-18 eligibility boundary');
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  let candidateSha = null;
  let output = null;
  let noProofs = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--candidate-sha') candidateSha = args[++index] ?? null;
    else if (arg === '--output') output = args[++index] ?? null;
    else if (arg === '--no-proofs') noProofs = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  const report = await runProofCacheCalibrationEvidence({ candidateSha, executeProofs: !noProofs });
  if (output) {
    const outputPath = resolve(output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalJson(report), 'utf8');
  }
  console.log(`EV17_PROOF_CACHE_CALIBRATION_PASS candidate=${report.candidateSha} trials=${report.metrics.executedTrialCount} falseHits=${report.metrics.falseHits} falseMisses=${report.metrics.falseMisses} disagreements=${report.metrics.sameClosureDisagreements} eligible=${report.eligibleProofClasses.join(',') || 'none'} reuse=false`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  main().catch(error => {
    console.error(`EV17_PROOF_CACHE_CALIBRATION_FAIL ${error.message}`);
    process.exitCode = 1;
  });
}
