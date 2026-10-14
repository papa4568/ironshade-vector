import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseFailedNpmScript } from './impact-map-calibration.mjs';
import { loadImpactMap, selectAffectedVerification, validateImpactMap } from './select-affected-verification.mjs';

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

function orderedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function run(command, { expectFailure = false } = {}) {
  const result = spawnSync('bash', ['-lc', command], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, CI: process.env.CI ?? '1' },
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) throw result.error;
  if (expectFailure) assert(result.status !== 0, `expected command to fail: ${command}`);
  else assert(result.status === 0, `command failed (${result.status}): ${command}\n${output.slice(-4000)}`);
  return { status: result.status, output };
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

export function validateImpactCalibrationCorpus(corpus, impactMap) {
  assert(corpus && typeof corpus === 'object' && !Array.isArray(corpus), 'impact calibration corpus must be an object');
  assert(corpus.schemaVersion === 1, 'impact calibration corpus schemaVersion must be 1');
  assert(corpus.mode === 'advisory', 'EV-15 corpus must remain advisory');
  assert(corpus.promotionTarget === 'EV-16', 'EV-15 corpus promotionTarget must be EV-16');
  assert(Number.isInteger(corpus.minimumIndependentMissesForWidening) && corpus.minimumIndependentMissesForWidening >= 2, 'minimumIndependentMissesForWidening must be at least 2');
  assert(corpus.errorBudget?.falsePositiveWidenings === 0, 'EV-15 false-positive widening budget must be zero');
  assert(corpus.errorBudget?.falseNegativeWidenings === 0, 'EV-15 false-negative widening budget must be zero');
  assert(Array.isArray(corpus.historicalObservations) && corpus.historicalObservations.length > 0, 'historicalObservations must be non-empty');
  assert(Array.isArray(corpus.executableMissProbes) && corpus.executableMissProbes.length >= 2, 'executableMissProbes must contain at least two probes');
  validateImpactMap(impactMap);

  const ids = new Set();
  for (const observation of corpus.historicalObservations) {
    assertString(observation.id, 'historical observation id');
    assert(!ids.has(observation.id), `duplicate corpus id ${observation.id}`);
    ids.add(observation.id);
    assert(SHA_PATTERN.test(observation.candidateSha ?? ''), `${observation.id}.candidateSha must be a full lowercase SHA`);
    assert(Number.isInteger(observation.pullRequest) && observation.pullRequest > 0, `${observation.id}.pullRequest must be positive`);
    assert(Number.isInteger(observation.fullVerificationRunId) && observation.fullVerificationRunId > 0, `${observation.id}.fullVerificationRunId must be positive`);
    assert(observation.fullVerificationOutcome === 'success', `${observation.id} historical control must be a successful full-verification observation`);
    assert(Array.isArray(observation.changedFiles) && observation.changedFiles.length > 0, `${observation.id}.changedFiles must be non-empty`);
    observation.changedFiles.forEach(file => assertString(file, `${observation.id}.changedFiles`));
    assertString(observation.rationale, `${observation.id}.rationale`);
  }

  for (const probe of corpus.executableMissProbes) {
    assertString(probe.id, 'probe id');
    assert(!ids.has(probe.id), `duplicate corpus id ${probe.id}`);
    ids.add(probe.id);
    assertString(probe.targetPath, `${probe.id}.targetPath`);
    assert(Array.isArray(probe.changedFiles) && probe.changedFiles.length === 1 && probe.changedFiles[0] === probe.targetPath, `${probe.id}.changedFiles must contain only targetPath`);
    assertString(probe.expectedRuleId, `${probe.id}.expectedRuleId`);
    assert(impactMap.rules.some(rule => rule.id === probe.expectedRuleId), `${probe.id} references unknown impact rule ${probe.expectedRuleId}`);
    assert(probe.expectedMode === 'targeted', `${probe.id}.expectedMode must be targeted`);
    assert(Array.isArray(probe.expectedVerificationIds) && probe.expectedVerificationIds.length > 0, `${probe.id}.expectedVerificationIds must be non-empty`);
    probe.expectedVerificationIds.forEach(id => assert(impactMap.verifications[id], `${probe.id} references unknown verification ${id}`));
    assertString(probe.mutationSuffix, `${probe.id}.mutationSuffix`);
    assertString(probe.expectedFailureScript, `${probe.id}.expectedFailureScript`);
    assertString(probe.expectedFailurePattern, `${probe.id}.expectedFailurePattern`);
    assert(probe.wideningAction === 'escalate-rule-to-full', `${probe.id}.wideningAction must be escalate-rule-to-full`);
  }

  assert(Array.isArray(corpus.decisionCalibration?.positive) && corpus.decisionCalibration.positive.length > 0, 'decisionCalibration.positive must be non-empty');
  assert(Array.isArray(corpus.decisionCalibration?.negative) && corpus.decisionCalibration.negative.length > 0, 'decisionCalibration.negative must be non-empty');
  return corpus;
}

export function recommendWidening({ missCount, independentTargetCount }, minimumIndependentMissesForWidening) {
  return missCount >= minimumIndependentMissesForWidening && independentTargetCount >= minimumIndependentMissesForWidening;
}

function calibrateDecision(corpus) {
  let falsePositiveWidenings = 0;
  let falseNegativeWidenings = 0;
  const cases = [];
  for (const [kind, entries] of Object.entries({ positive: corpus.decisionCalibration.positive, negative: corpus.decisionCalibration.negative })) {
    for (const entry of entries) {
      const observedRecommend = recommendWidening(entry, corpus.minimumIndependentMissesForWidening);
      const pass = observedRecommend === entry.expectedRecommend;
      if (!pass && entry.expectedRecommend) falseNegativeWidenings += 1;
      if (!pass && !entry.expectedRecommend) falsePositiveWidenings += 1;
      cases.push({ id: entry.id, kind, expectedRecommend: entry.expectedRecommend, observedRecommend, pass });
    }
  }
  return {
    cases,
    falsePositiveWidenings,
    falseNegativeWidenings,
    falsePositiveRate: corpus.decisionCalibration.negative.length === 0 ? 0 : falsePositiveWidenings / corpus.decisionCalibration.negative.length,
    falseNegativeRate: corpus.decisionCalibration.positive.length === 0 ? 0 : falseNegativeWidenings / corpus.decisionCalibration.positive.length,
    pass: falsePositiveWidenings <= corpus.errorBudget.falsePositiveWidenings && falseNegativeWidenings <= corpus.errorBudget.falseNegativeWidenings,
  };
}

function wilson95(successes, trials) {
  if (trials === 0) return { lower: 0, upper: 1 };
  const z = 1.959963984540054;
  const p = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const centre = (p + (z * z) / (2 * trials)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / denominator;
  return { lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) };
}

function verifyHistoricalCommitExists(candidateSha) {
  const result = spawnSync('git', ['cat-file', '-e', `${candidateSha}^{commit}`], { cwd: process.cwd(), encoding: 'utf8' });
  return result.status === 0;
}

async function runProbe(probe, impactMap) {
  const selection = selectAffectedVerification(probe.changedFiles, impactMap);
  assert(selection.mode === probe.expectedMode, `${probe.id} expected mode ${probe.expectedMode}, got ${selection.mode}`);
  assert(selection.matchedRuleIds.includes(probe.expectedRuleId), `${probe.id} did not match ${probe.expectedRuleId}`);
  const selectedIds = selection.verifications.map(entry => entry.id);
  assert(canonicalJson(selectedIds) === canonicalJson(probe.expectedVerificationIds), `${probe.id} focused verification drifted: ${selectedIds.join(', ')}`);

  const targetPath = resolve(probe.targetPath);
  const original = await readFile(targetPath, 'utf8');
  const originalDigest = sha256(original);
  const trackedBefore = run('git status --porcelain --untracked-files=no').output;
  assert(trackedBefore.trim() === '', `${probe.id} requires a clean tracked workspace before mutation`);
  let focused = [];
  let full;
  try {
    await writeFile(targetPath, `${original}${probe.mutationSuffix}`, 'utf8');
    for (const verification of selection.verifications) {
      const result = run(verification.command);
      focused.push({ id: verification.id, command: verification.command, outcome: 'success', outputDigest: sha256(result.output) });
    }
    full = run('npm run verify:full', { expectFailure: true });
  } finally {
    await writeFile(targetPath, original, 'utf8');
  }

  const restored = await readFile(targetPath, 'utf8');
  const trackedAfter = run('git status --porcelain --untracked-files=no').output;
  const failedScript = parseFailedNpmScript(full.output);
  const criterionMatched = full.output.includes(probe.expectedFailurePattern);
  const sourceRestored = sha256(restored) === originalDigest && trackedAfter === trackedBefore;
  assert(sourceRestored, `${probe.id} did not restore tracked source state exactly`);
  assert(failedScript === probe.expectedFailureScript, `${probe.id} expected full verification to fail in ${probe.expectedFailureScript}, got ${failedScript ?? 'unknown'}`);
  assert(criterionMatched, `${probe.id} full verification failed without the expected typecheck criterion`);

  return {
    id: probe.id,
    targetPath: probe.targetPath,
    ruleId: probe.expectedRuleId,
    selection: {
      mode: selection.mode,
      verificationIds: selectedIds,
      domains: selection.domains,
    },
    focusedVerification: focused,
    fullVerification: {
      outcome: 'failure',
      command: 'npm run verify:full',
      failedScript,
      criterionMatched,
      outputDigest: sha256(full.output),
    },
    comparison: {
      falseNegative: true,
      reason: `all predicted focused checks passed, but full verification failed in unpredicted ${failedScript}`,
      overSelectedVerificationIdsForThisTrial: selectedIds,
      overSelectionRateForThisTrial: selectedIds.length === 0 ? 0 : 1,
    },
    sourceRestored,
    wideningAction: probe.wideningAction,
  };
}

export async function runImpactCalibrationEvidence({ candidateSha, executeProbes = true } = {}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  const head = run('git rev-parse HEAD').output.trim();
  assert(head === candidateSha, `candidateSha ${candidateSha} does not match checked-out HEAD ${head}`);

  const [impactMap, corpusRaw, impactMapRaw] = await Promise.all([
    loadImpactMap(resolve('agent/impact-map.json')),
    readFile(resolve('agent/impact-calibration-corpus.json'), 'utf8'),
    readFile(resolve('agent/impact-map.json'), 'utf8'),
  ]);
  const corpus = validateImpactCalibrationCorpus(JSON.parse(corpusRaw), impactMap);
  const decisionCalibration = calibrateDecision(corpus);
  assert(decisionCalibration.pass, 'EV-15 widening decision calibration exceeded its zero-error budget');

  const historical = corpus.historicalObservations.map(observation => {
    const selection = selectAffectedVerification(observation.changedFiles, impactMap);
    return {
      ...observation,
      candidateCommitAvailable: verifyHistoricalCommitExists(observation.candidateSha),
      currentPrediction: {
        mode: selection.mode,
        ruleIds: selection.matchedRuleIds,
        verificationIds: selection.verifications.map(entry => entry.id),
        unknownFiles: selection.unknownFiles,
      },
      comparison: {
        falseNegative: false,
        overSelectionKnown: false,
        reason: 'successful full verification proves no observed miss; it does not prove that selected checks are unnecessary, so narrowing is not inferred',
      },
    };
  });
  assert(historical.every(entry => entry.candidateCommitAvailable), 'one or more historical candidate SHAs are unavailable from the exact checkout history');

  const probes = [];
  if (executeProbes) {
    for (const probe of corpus.executableMissProbes) probes.push(await runProbe(probe, impactMap));
  }

  const byRule = new Map();
  for (const entry of probes) {
    const group = byRule.get(entry.ruleId) ?? [];
    group.push(entry);
    byRule.set(entry.ruleId, group);
  }

  const safeWideningCandidates = [];
  for (const [ruleId, entries] of byRule) {
    const missCount = entries.filter(entry => entry.comparison.falseNegative).length;
    const targetCount = new Set(entries.map(entry => entry.targetPath)).size;
    if (!recommendWidening({ missCount, independentTargetCount: targetCount }, corpus.minimumIndependentMissesForWidening)) continue;
    assert(entries.every(entry => entry.wideningAction === 'escalate-rule-to-full'), `${ruleId} probes disagree on widening action`);
    safeWideningCandidates.push({
      ruleId,
      action: 'set-risk-high',
      resultingVerification: 'verify-full',
      missCount,
      trialCount: entries.length,
      observedMissRate: missCount / entries.length,
      missRateWilson95: wilson95(missCount, entries.length),
      trialOverSelectionRate: entries.reduce((sum, entry) => sum + entry.comparison.overSelectionRateForThisTrial, 0) / entries.length,
      evidenceProbeIds: entries.map(entry => entry.id).sort(),
      scopeLimit: 'Evidence proves a deterministic client-TypeScript typecheck gap for this rule class only. It does not justify narrowing any existing check or widening any unmeasured rule class.',
    });
  }

  const calibratedRuleIds = new Set(safeWideningCandidates.map(entry => entry.ruleId));
  const unresolvedClasses = impactMap.rules
    .filter(rule => !calibratedRuleIds.has(rule.id))
    .map(rule => ({
      ruleId: rule.id,
      currentRisk: rule.risk,
      status: rule.risk === 'high' ? 'already-fail-safe' : 'unresolved',
      reason: rule.risk === 'high'
        ? 'Current policy already escalates this class to full verification; EV-15 provides no evidence for narrowing.'
        : 'No two independent executable full-verification miss probes establish a widening for this class; preserve current behavior until separately calibrated.',
    }));

  const report = {
    schema: 'ironshade-impact-calibration-evidence:v1',
    schemaVersion: 1,
    taskId: 'EV-15',
    mode: 'advisory',
    candidateSha,
    corpusDigest: sha256(JSON.parse(corpusRaw)),
    impactMapDigest: sha256(impactMapRaw),
    historicalObservations: historical,
    executableMissProbes: probes,
    metrics: {
      historicalObservationCount: historical.length,
      executableProbeCount: probes.length,
      falseNegativeCount: probes.filter(entry => entry.comparison.falseNegative).length,
      falseNegativeRate: probes.length === 0 ? 0 : probes.filter(entry => entry.comparison.falseNegative).length / probes.length,
      trialOverSelectionRate: probes.length === 0 ? 0 : probes.reduce((sum, entry) => sum + entry.comparison.overSelectionRateForThisTrial, 0) / probes.length,
      decisionCalibration,
    },
    safeWideningCandidates,
    unresolvedClasses,
    confidenceLimits: {
      method: corpus.confidence.interval,
      note: corpus.confidence.interpretation,
      minimumIndependentMissesForWidening: corpus.minimumIndependentMissesForWidening,
    },
    rollback: {
      defaultImpactMapChanged: false,
      enforcementEnabled: false,
      sourceMutationsRestored: probes.every(entry => entry.sourceRestored),
      rollbackAction: 'remove EV-15 calibration-only corpus/tool/test/workflow; agent/impact-map.json and existing candidate proof gates remain unchanged',
    },
    acceptedForEnforcement: false,
    candidatePassGranted: false,
  };
  assert(report.safeWideningCandidates.length <= 1, 'EV-15 must not silently expand beyond the single measured widening candidate');
  assert(report.rollback.defaultImpactMapChanged === false && report.rollback.enforcementEnabled === false, 'EV-15 must remain calibration-only');
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  let candidateSha = null;
  let output = null;
  let noProbes = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--candidate-sha') candidateSha = args[++index] ?? null;
    else if (arg === '--output') output = args[++index] ?? null;
    else if (arg === '--no-probes') noProbes = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  const report = await runImpactCalibrationEvidence({ candidateSha, executeProbes: !noProbes });
  if (output) {
    const outputPath = resolve(output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalJson(report), 'utf8');
  }
  console.log(`EV15_IMPACT_CALIBRATION_PASS candidate=${report.candidateSha} historical=${report.metrics.historicalObservationCount} probes=${report.metrics.executableProbeCount} misses=${report.metrics.falseNegativeCount} widenings=${report.safeWideningCandidates.length} fp=${report.metrics.decisionCalibration.falsePositiveWidenings} fn=${report.metrics.decisionCalibration.falseNegativeWidenings} advisory=true`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`EV15_IMPACT_CALIBRATION_ERROR ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}
