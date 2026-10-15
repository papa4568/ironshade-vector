import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildObservationReport,
  buildPrediction,
  captureExecutionContext,
  computeClosure,
  isRepositoryPathInClosure,
  validateHistoryAgainstGit,
  validateProofCacheHistory,
  validateProofCachePolicy,
} from './causal-proof-cache.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const PREPARED_ROOT = '.agent-proof-cache-closure-ev21';

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

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function sameJson(actual, expected, label) {
  assert(canonicalJson(actual) === canonicalJson(expected), `${label} drifted`);
}

function git(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert(result.status === 0, `git ${args.join(' ')} failed: ${(result.stderr ?? '').slice(-6000)}`);
  return `${result.stdout ?? ''}`.trim();
}

function run(command, { env = {}, expectedOutcome = 'success' } = {}) {
  const result = spawnSync('bash', ['-lc', command], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, CI: process.env.CI ?? '1', ...env },
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const outcome = result.status === 0 ? 'success' : 'failure';
  assert(outcome === expectedOutcome, `command outcome mismatch for ${command}: expected ${expectedOutcome}, got ${outcome}\n${output.slice(-12000)}`);
  return { outcome, status: result.status, output, outputDigest: sha256(output) };
}

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine) continue;
    const index = rawLine.indexOf('=');
    assert(index > 0, `invalid closure env line: ${rawLine}`);
    const key = rawLine.slice(0, index);
    const value = rawLine.slice(index + 1);
    assert(!Object.hasOwn(values, key), `duplicate closure env key ${key}`);
    values[key] = value;
  }
  return values;
}

export function validateProofCacheClosureCalibrationCorpus(corpus, policy) {
  assert(corpus && typeof corpus === 'object' && !Array.isArray(corpus), 'EV-21 corpus must be an object');
  assert(corpus.schemaVersion === 1, 'EV-21 corpus schemaVersion must be 1');
  assert(corpus.mode === 'advisory', 'EV-21 must remain advisory');
  assert(corpus.taskId === 'EV-21', 'EV-21 corpus taskId must be EV-21');
  assert(corpus.promotionTarget === 'EV-18', 'EV-21 promotion target must be EV-18');
  assert(corpus.errorBudget?.falseHits === 0, 'EV-21 false-hit budget must be zero');
  assert(corpus.errorBudget?.sameClosureDisagreements === 0, 'EV-21 same-closure disagreement budget must be zero');
  assert(Number.isInteger(corpus.minimumSameClosureRuns) && corpus.minimumSameClosureRuns >= 2, 'EV-21 requires at least two same-closure runs');
  assert(Array.isArray(corpus.proofClasses) && corpus.proofClasses.length === 1, 'EV-21 calibrates exactly one proof class');
  validateProofCachePolicy(policy);
  assert(policy.mode === 'shadow', 'proof cache must remain shadow-only during EV-21');

  const entry = corpus.proofClasses[0];
  assert(entry.proofId === 'full-repository-build-closed', 'EV-21 may calibrate only full-repository-build-closed');
  const proof = policy.proofClasses.find(value => value.id === entry.proofId);
  assert(proof, `unknown proof class ${entry.proofId}`);
  assert(entry.expectedCommand === proof.command, 'EV-21 expectedCommand drifted from proof policy');
  sameJson(entry.expectedRepositoryClosure, proof.repositoryClosure, 'EV-21 repository closure');
  sameJson(entry.expectedRuntimeClosure, proof.runtimeClosure, 'EV-21 runtime closure');

  for (const field of ['preflightCommand', 'preflightProfilePath', 'calibrationCommand', 'executionProfilePath']) {
    assertString(entry[field], `EV-21 ${field}`);
  }
  assert(entry.preflightCommand.includes(entry.preflightProfilePath), 'EV-21 preflight command must execute the declared preflight profile');
  assert(entry.calibrationCommand.includes(entry.executionProfilePath), 'EV-21 calibration command must execute the declared build profile');

  assert(Array.isArray(entry.requiredBoundInputs) && entry.requiredBoundInputs.length === 4, 'EV-21 must bind four concrete runtime identities');
  const boundIds = new Set();
  const boundVariables = new Set();
  for (const input of entry.requiredBoundInputs) {
    assertString(input.id, 'EV-21 bound input id');
    assertString(input.environmentVariable, `${input.id}.environmentVariable`);
    assert(!boundIds.has(input.id), `duplicate EV-21 bound input ${input.id}`);
    assert(!boundVariables.has(input.environmentVariable), `duplicate EV-21 bound environment variable ${input.environmentVariable}`);
    boundIds.add(input.id);
    boundVariables.add(input.environmentVariable);
    assert(proof.runtimeClosure.environmentVariables.includes(input.environmentVariable), `${input.id} is not closure-bound by proof policy`);
  }

  assert(Array.isArray(entry.eliminatedInputs) && entry.eliminatedInputs.length === 2, 'EV-21 must eliminate two setup-only causal inputs');
  const eliminatedIds = entry.eliminatedInputs.map(input => input.id);
  assert(JSON.stringify(eliminatedIds) === JSON.stringify(['external-network-availability', 'npm-registry-response-identity']), 'EV-21 eliminated-input scope drifted');
  for (const input of entry.eliminatedInputs) assertString(input.reason, `${input.id}.reason`);

  assert(Array.isArray(entry.probes) && entry.probes.length === 3, 'EV-21 requires same-closure, benign invalidation, and defect probes');
  const probeIds = new Set();
  for (const probe of entry.probes) {
    assertString(probe.id, 'EV-21 probe id');
    assert(!probeIds.has(probe.id), `duplicate EV-21 probe ${probe.id}`);
    probeIds.add(probe.id);
    assert(['same-closure-control', 'invalidation-control', 'invalidation-defect'].includes(probe.kind), `${probe.id}.kind is invalid`);
    assert(Array.isArray(probe.mutations) && probe.mutations.length > 0, `${probe.id}.mutations must be non-empty`);
    for (const mutation of probe.mutations) {
      assertString(mutation.targetPath, `${probe.id}.targetPath`);
      const hasSuffix = typeof mutation.mutationSuffix === 'string' && mutation.mutationSuffix.length > 0;
      const hasCreate = typeof mutation.createContent === 'string' && mutation.createContent.length > 0;
      assert(hasSuffix !== hasCreate, `${probe.id}.${mutation.targetPath} must define exactly one mutation`);
    }
    assert(['same', 'different'].includes(probe.expectedClosureRelation), `${probe.id}.expectedClosureRelation is invalid`);
    assert(['success', 'failure'].includes(probe.expectedOutcome), `${probe.id}.expectedOutcome is invalid`);
    assert(['hit', 'miss'].includes(probe.expectedPrediction), `${probe.id}.expectedPrediction is invalid`);
    if (probe.expectedFailurePattern) assertString(probe.expectedFailurePattern, `${probe.id}.expectedFailurePattern`);
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
  const rows = [...groups.entries()].map(([closureDigest, group]) => ({
    closureDigest,
    observationIds: group.observationIds.sort(),
    outcomes: [...group.outcomes].sort(),
    disagreement: group.outcomes.size > 1,
  }));
  return {
    observationCount: rows.reduce((sum, row) => sum + row.observationIds.length, 0),
    closureGroupCount: rows.length,
    disagreementCount: rows.filter(row => row.disagreement).length,
    groups: rows,
  };
}

async function prepareRevision({ proof, proofEntry, candidateSha }) {
  const execution = run(proofEntry.preflightCommand, {
    env: {
      CANDIDATE_SHA: candidateSha,
      FULL_REPOSITORY_BUILD_PREPARED_ROOT: PREPARED_ROOT,
    },
    expectedOutcome: 'success',
  });
  const preparedDir = resolve(PREPARED_ROOT, candidateSha);
  const [envText, manifestText] = await Promise.all([
    readFile(resolve(preparedDir, 'closure.env'), 'utf8'),
    readFile(resolve(preparedDir, 'manifest.json'), 'utf8'),
  ]);
  const closureEnv = parseEnv(envText);
  const manifest = JSON.parse(manifestText);
  assert(manifest.schema === 'ironshade-full-repository-build-preflight:v1', 'preflight manifest schema drifted');
  assert(manifest.candidateSha === candidateSha, 'preflight manifest candidate SHA mismatch');
  assert(manifest.networkPhase === 'completed-before-cache-decision', 'preflight network phase must complete before closure computation');
  assert(manifest.buildNetwork === 'none', 'closed build must declare network=none');
  assert(JSON.stringify(manifest.registryResultBoundBy) === JSON.stringify(['npmCliTreeSha256', 'dependencyTreeSha256']), 'registry result identity binding drifted');
  assert(/^node@sha256:[a-f0-9]{64}$/.test(manifest.baseImageRef), 'preflight base image identity is not immutable');
  assert(/^sha256:[a-f0-9]{64}$/.test(manifest.preparedImageId), 'preflight prepared image identity is invalid');
  assert(DIGEST_PATTERN.test(manifest.npmCliTreeSha256), 'preflight npm CLI digest is invalid');
  assert(DIGEST_PATTERN.test(manifest.dependencyTreeSha256), 'preflight dependency tree digest is invalid');

  for (const input of proofEntry.requiredBoundInputs) {
    assertString(closureEnv[input.environmentVariable], `preflight ${input.environmentVariable}`);
  }
  const context = captureExecutionContext(proof, {
    env: { ...process.env, ...closureEnv },
  });
  return {
    preparedDir,
    closureEnv,
    manifest,
    executionContext: context,
    preflightOutputDigest: execution.outputDigest,
  };
}

function mutateContextIdentity(context, environmentVariable) {
  const next = structuredClone(context);
  assert(Object.hasOwn(next.env, environmentVariable), `execution context does not capture ${environmentVariable}`);
  next.env[environmentVariable] = {
    present: true,
    valueSha256: sha256(`ev21-identity-invalidation:${environmentVariable}`),
  };
  return next;
}

async function buildClosureAudit({ policy, proof, proofEntry, candidateSha, baselineClosure, baselinePreparation }) {
  const [preflightText, buildText, candidateWorkflow] = await Promise.all([
    readFile(resolve(proofEntry.preflightProfilePath), 'utf8'),
    readFile(resolve(proofEntry.executionProfilePath), 'utf8'),
    readFile(resolve('.github/workflows/pr-candidate.yml'), 'utf8'),
  ]);

  const boundInputs = proofEntry.requiredBoundInputs.map(input => ({
    id: input.id,
    environmentVariable: input.environmentVariable,
    captured: baselineClosure.executionContext.env?.[input.environmentVariable]?.present === true,
    valueFingerprint: baselineClosure.executionContext.env?.[input.environmentVariable]?.valueSha256 ?? null,
  }));
  const missingBoundInputs = boundInputs.filter(input => !input.captured).map(input => input.id);
  const identityInvalidationControls = proofEntry.requiredBoundInputs.map(input => {
    const changed = computeClosure({
      policy,
      proofId: proofEntry.proofId,
      revision: candidateSha,
      executionContext: mutateContextIdentity(baselineClosure.executionContext, input.environmentVariable),
    });
    return {
      id: input.id,
      environmentVariable: input.environmentVariable,
      invalidatesClosure: changed.closureDigest !== baselineClosure.closureDigest,
      closureDigest: changed.closureDigest,
    };
  });

  const preflightNetworkOperations = [
    'docker pull "$base_image"',
    'docker build --pull=false',
    'npm install --global npm@10.9.8',
    'npm ci --ignore-scripts --no-audit --no-fund',
  ].map(pattern => ({ pattern, present: preflightText.includes(pattern) }));
  const buildForbiddenNetworkOperations = [
    'docker pull ',
    'docker build ',
    'npm ci ',
    'npm install ',
  ].map(pattern => ({ pattern, absent: !buildText.includes(pattern) }));

  const profilesInRepositoryClosure = {
    preflight: isRepositoryPathInClosure(proofEntry.preflightProfilePath, proof),
    build: isRepositoryPathInClosure(proofEntry.executionProfilePath, proof),
  };
  const networkEliminated = baselinePreparation.manifest.networkPhase === 'completed-before-cache-decision'
    && baselinePreparation.manifest.buildNetwork === 'none'
    && buildText.includes('--network none')
    && preflightNetworkOperations.every(entry => entry.present)
    && buildForbiddenNetworkOperations.every(entry => entry.absent);
  const registryResponseBound = baselinePreparation.manifest.registryResultBoundBy.includes('npmCliTreeSha256')
    && baselinePreparation.manifest.registryResultBoundBy.includes('dependencyTreeSha256')
    && baselinePreparation.manifest.npmCliTreeSha256 === baselinePreparation.closureEnv.IRONSHADE_PROOF_NPM_CLI_TREE_SHA256
    && baselinePreparation.manifest.dependencyTreeSha256 === baselinePreparation.closureEnv.IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256;

  const authoritativeProducer = {
    stillUsesLegacyProofClass: candidateWorkflow.includes('--proof full-repository-build'),
    stillRunsLegacyProofProfile: candidateWorkflow.includes('run: bash scripts/run-full-repository-build-proof.sh'),
    doesNotUseClosedProofClass: !candidateWorkflow.includes('--proof full-repository-build-closed'),
    doesNotRunClosedProofProfile: !candidateWorkflow.includes('run: bash scripts/run-full-repository-build-proof-closed.sh'),
  };

  return {
    boundInputs,
    missingBoundInputs,
    requiredBoundInputsClosed: missingBoundInputs.length === 0,
    identityInvalidationControls,
    identityInvalidationControlsPass: identityInvalidationControls.every(entry => entry.invalidatesClosure),
    eliminatedInputs: {
      externalNetworkAvailability: networkEliminated,
      npmRegistryResponseIdentity: registryResponseBound && networkEliminated,
    },
    preflightNetworkOperations,
    buildForbiddenNetworkOperations,
    profilesInRepositoryClosure,
    profilesInRepositoryClosurePass: profilesInRepositoryClosure.preflight && profilesInRepositoryClosure.build,
    authoritativeProducer,
    authoritativeProducerUnchanged: Object.values(authoritativeProducer).every(Boolean),
    preflightManifest: baselinePreparation.manifest,
  };
}

export function evaluateClosureCalibration({ corpus, trialRows, closureAudit, historicalDisagreementCount = 0 }) {
  const baseline = trialRows.find(row => row.kind === 'baseline');
  assert(baseline?.outcome === 'success', 'EV-21 requires a successful exact-candidate baseline');
  const sameClosureRows = trialRows.filter(row => row.closureRelation === 'same');
  const falseHits = trialRows.filter(row => row.classification === 'false-hit').length;
  const falseMisses = trialRows.filter(row => row.classification === 'false-miss').length;
  const sameClosureDisagreements = sameClosureRows.filter(row => row.outcome !== baseline.outcome).length;
  const invalidationDefects = trialRows.filter(row => row.kind === 'invalidation-defect');
  const detectedInvalidationDefects = invalidationDefects.filter(row => row.prediction === 'miss' && row.outcome === 'failure').length;

  const eligible = falseHits <= corpus.errorBudget.falseHits
    && sameClosureDisagreements <= corpus.errorBudget.sameClosureDisagreements
    && sameClosureRows.length >= corpus.minimumSameClosureRuns
    && historicalDisagreementCount === 0
    && invalidationDefects.length > 0
    && detectedInvalidationDefects === invalidationDefects.length
    && closureAudit.requiredBoundInputsClosed
    && closureAudit.identityInvalidationControlsPass
    && closureAudit.eliminatedInputs.externalNetworkAvailability
    && closureAudit.eliminatedInputs.npmRegistryResponseIdentity
    && closureAudit.profilesInRepositoryClosurePass
    && closureAudit.authoritativeProducerUnchanged;

  const reasons = [];
  if (falseHits > corpus.errorBudget.falseHits) reasons.push(`false hits ${falseHits} exceed budget ${corpus.errorBudget.falseHits}`);
  if (sameClosureDisagreements > corpus.errorBudget.sameClosureDisagreements) reasons.push(`same-closure disagreements ${sameClosureDisagreements} exceed budget ${corpus.errorBudget.sameClosureDisagreements}`);
  if (sameClosureRows.length < corpus.minimumSameClosureRuns) reasons.push(`same-closure runs ${sameClosureRows.length} are below minimum ${corpus.minimumSameClosureRuns}`);
  if (historicalDisagreementCount > 0) reasons.push(`retained history contains ${historicalDisagreementCount} disagreement group(s)`);
  if (detectedInvalidationDefects !== invalidationDefects.length) reasons.push('representative defect invalidation did not fail closed');
  if (!closureAudit.requiredBoundInputsClosed) reasons.push(`required bound inputs missing: ${closureAudit.missingBoundInputs.join(', ')}`);
  if (!closureAudit.identityInvalidationControlsPass) reasons.push('one or more bound identity dimensions do not invalidate the closure');
  if (!closureAudit.eliminatedInputs.externalNetworkAvailability) reasons.push('external network availability remains causal to the calibrated build segment');
  if (!closureAudit.eliminatedInputs.npmRegistryResponseIdentity) reasons.push('npm registry response/artifact identity is not closed before the calibrated build segment');
  if (!closureAudit.profilesInRepositoryClosurePass) reasons.push('preflight or build profile is outside the repository closure');
  if (!closureAudit.authoritativeProducerUnchanged) reasons.push('EV-21 changed the authoritative producer or enabled the closed class prematurely');

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

async function runProbe({ probe, policy, proof, proofEntry, baselineHistory, baselineClosure, candidateSha, workflowRunId }) {
  const originals = [];
  let trial = null;
  try {
    assert(git(['status', '--porcelain', '--untracked-files=no']) === '', `${probe.id} requires a clean tracked checkout`);
    for (const mutation of probe.mutations) {
      const path = resolve(mutation.targetPath);
      if (typeof mutation.createContent === 'string') {
        let existed = true;
        try {
          await readFile(path, 'utf8');
        } catch (error) {
          if (error?.code === 'ENOENT') existed = false;
          else throw error;
        }
        assert(!existed, `${probe.id} create target already exists: ${mutation.targetPath}`);
        originals.push({ path, targetPath: mutation.targetPath, existed: false });
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, mutation.createContent, 'utf8');
      } else {
        const content = await readFile(path, 'utf8');
        originals.push({ path, targetPath: mutation.targetPath, existed: true, digest: sha256(content) });
        await writeFile(path, `${content}${mutation.mutationSuffix}`, 'utf8');
      }
    }

    const existing = probe.mutations.filter(entry => typeof entry.createContent !== 'string').map(entry => entry.targetPath);
    const created = probe.mutations.filter(entry => typeof entry.createContent === 'string').map(entry => entry.targetPath);
    if (existing.length > 0) git(['add', '--', ...existing]);
    if (created.length > 0) git(['add', '-f', '--', ...created]);
    git(['-c', 'user.name=EV-21 Calibration', '-c', 'user.email=ev21@example.invalid', 'commit', '-m', `EV-21 disposable probe ${probe.id}`]);
    const syntheticSha = git(['rev-parse', 'HEAD']);
    assert(SHA_PATTERN.test(syntheticSha), `${probe.id} synthetic SHA is invalid`);

    const preparation = await prepareRevision({ proof, proofEntry, candidateSha: syntheticSha });
    const closure = computeClosure({
      policy,
      proofId: proofEntry.proofId,
      revision: syntheticSha,
      executionContext: preparation.executionContext,
    });
    const closureRelation = closure.closureDigest === baselineClosure.closureDigest ? 'same' : 'different';
    assert(closureRelation === probe.expectedClosureRelation, `${probe.id} expected closure relation ${probe.expectedClosureRelation}, got ${closureRelation}`);

    const prediction = buildPrediction({
      policy,
      history: baselineHistory,
      proofId: proofEntry.proofId,
      revision: syntheticSha,
      executionContext: preparation.executionContext,
    });
    const predictionClass = prediction.reuseWouldBeSafe ? 'hit' : 'miss';
    assert(predictionClass === probe.expectedPrediction, `${probe.id} expected prediction ${probe.expectedPrediction}, got ${predictionClass}`);

    const execution = run(proofEntry.calibrationCommand, {
      env: {
        CANDIDATE_SHA: syntheticSha,
        IRONSHADE_PROOF_PREPARED_DIR: preparation.preparedDir,
      },
      expectedOutcome: probe.expectedOutcome,
    });
    if (probe.expectedFailurePattern) {
      assert(execution.output.includes(probe.expectedFailurePattern), `${probe.id} failed without expected criterion: ${probe.expectedFailurePattern}`);
    }
    const observation = buildObservationReport({ prediction, outcome: execution.outcome, workflowRunId });
    let classification = 'agreement';
    if (predictionClass === 'hit' && execution.outcome !== 'success') classification = 'false-hit';
    else if (predictionClass === 'miss' && execution.outcome === 'success') classification = 'false-miss';
    else if (predictionClass === 'miss' && execution.outcome === 'failure') classification = 'correct-invalidation';
    if (probe.expectedClassification) assert(classification === probe.expectedClassification, `${probe.id} expected classification ${probe.expectedClassification}, got ${classification}`);

    trial = {
      id: probe.id,
      kind: probe.kind,
      targetPaths: probe.mutations.map(entry => entry.targetPath),
      syntheticSha,
      closureRelation,
      closureDigest: closure.closureDigest,
      repositoryDigest: closure.repositoryDigest,
      executionContextDigest: closure.executionContextDigest,
      preflightOutputDigest: preparation.preflightOutputDigest,
      proofInputIdentities: Object.fromEntries(proofEntry.requiredBoundInputs.map(input => [input.id, preparation.closureEnv[input.environmentVariable]])),
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
    await rm(resolve(PREPARED_ROOT), { recursive: true, force: true });
  }

  for (const original of originals) {
    if (original.existed) {
      const restored = await readFile(original.path, 'utf8');
      assert(sha256(restored) === original.digest, `${probe.id} did not restore ${original.targetPath}`);
    } else {
      let absent = false;
      try {
        await readFile(original.path, 'utf8');
      } catch (error) {
        if (error?.code === 'ENOENT') absent = true;
        else throw error;
      }
      assert(absent, `${probe.id} did not remove ${original.targetPath}`);
    }
  }
  assert(git(['status', '--porcelain', '--untracked-files=no']) === '', `${probe.id} did not restore clean tracked state`);
  return { ...trial, rollback: { sourceRestored: true, headRestored: git(['rev-parse', 'HEAD']) === candidateSha } };
}

export async function runProofCacheClosureCalibrationEvidence({ candidateSha, workflowRunId = process.env.GITHUB_RUN_ID ?? '0', executeProofs = true } = {}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase SHA');
  assert(git(['rev-parse', 'HEAD']) === candidateSha, `candidateSha ${candidateSha} does not match checked-out HEAD`);
  assert(git(['status', '--porcelain', '--untracked-files=no']) === '', 'EV-21 requires a clean tracked checkout');

  const [policyRaw, historyRaw, corpusRaw] = await Promise.all([
    readFile(resolve('agent/proof-cache.json'), 'utf8'),
    readFile(resolve('agent/proof-cache-history.json'), 'utf8'),
    readFile(resolve('agent/proof-cache-closure-calibration-corpus.json'), 'utf8'),
  ]);
  const policy = validateProofCachePolicy(JSON.parse(policyRaw));
  const history = validateProofCacheHistory(JSON.parse(historyRaw));
  validateHistoryAgainstGit({ policy, history });
  const corpus = validateProofCacheClosureCalibrationCorpus(JSON.parse(corpusRaw), policy);
  const proofEntry = corpus.proofClasses[0];
  const proof = policy.proofClasses.find(entry => entry.id === proofEntry.proofId);
  assert(proof, `missing proof class ${proofEntry.proofId}`);
  const historical = summarizeHistoricalDisagreements(history, proofEntry.proofId);

  const trialRows = [];
  let baselineClosure = null;
  let closureAudit = null;
  if (executeProofs) {
    const baselinePreparation = await prepareRevision({ proof, proofEntry, candidateSha });
    baselineClosure = computeClosure({
      policy,
      proofId: proofEntry.proofId,
      revision: candidateSha,
      executionContext: baselinePreparation.executionContext,
    });
    closureAudit = await buildClosureAudit({ policy, proof, proofEntry, candidateSha, baselineClosure, baselinePreparation });
    const baselineExecution = run(proofEntry.calibrationCommand, {
      env: {
        CANDIDATE_SHA: candidateSha,
        IRONSHADE_PROOF_PREPARED_DIR: baselinePreparation.preparedDir,
      },
      expectedOutcome: 'success',
    });
    git(['reset', '--hard', candidateSha]);
    assert(git(['status', '--porcelain', '--untracked-files=no']) === '', 'EV-21 baseline did not restore clean tracked state');
    trialRows.push({
      id: 'exact-candidate-baseline',
      kind: 'baseline',
      targetPaths: [],
      syntheticSha: candidateSha,
      closureRelation: 'same',
      closureDigest: baselineClosure.closureDigest,
      repositoryDigest: baselineClosure.repositoryDigest,
      executionContextDigest: baselineClosure.executionContextDigest,
      preflightOutputDigest: baselinePreparation.preflightOutputDigest,
      proofInputIdentities: Object.fromEntries(proofEntry.requiredBoundInputs.map(input => [input.id, baselinePreparation.closureEnv[input.environmentVariable]])),
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
        id: `ev21-baseline-${candidateSha.slice(0, 12)}`,
        outcome: baselineExecution.outcome,
        workflowRunId,
      })],
    });
    for (const probe of proofEntry.probes) {
      trialRows.push(await runProbe({
        probe,
        policy,
        proof,
        proofEntry,
        baselineHistory,
        baselineClosure,
        candidateSha,
        workflowRunId,
      }));
    }
  }

  await rm(resolve(PREPARED_ROOT), { recursive: true, force: true });
  const metrics = executeProofs
    ? evaluateClosureCalibration({ corpus, trialRows, closureAudit, historicalDisagreementCount: historical.disagreementCount })
    : {
      eligible: false,
      falseHits: null,
      falseMisses: null,
      sameClosureRunCount: null,
      sameClosureDisagreements: null,
      historicalSameClosureDisagreements: historical.disagreementCount,
      invalidationDefectCount: null,
      detectedInvalidationDefectCount: null,
      reasons: ['proof execution disabled'],
    };

  const report = {
    schema: 'ironshade-proof-cache-closure-calibration:v1',
    schemaVersion: 1,
    taskId: 'EV-21',
    promotionTarget: 'EV-18',
    mode: 'advisory',
    candidateSha,
    workflowRunId: String(workflowRunId),
    policyDigest: sha256(JSON.parse(policyRaw)),
    historyDigest: sha256(JSON.parse(historyRaw)),
    corpusDigest: sha256(JSON.parse(corpusRaw)),
    proofId: proofEntry.proofId,
    exactCandidateClosure: baselineClosure,
    retainedHistoricalEvidence: historical,
    closureAudit,
    trials: trialRows,
    metrics,
    eligibleProofClasses: metrics.eligible ? [proofEntry.proofId] : [],
    unresolvedProofClasses: metrics.eligible ? [] : [{ proofId: proofEntry.proofId, reasons: metrics.reasons }],
    rollback: {
      proofReuseEnabled: false,
      authoritativeProducerChanged: closureAudit?.authoritativeProducerUnchanged === false,
      closedProofClassShadowOnly: policy.mode === 'shadow',
      sourceMutationsRestored: trialRows.every(entry => entry.rollback?.sourceRestored !== false),
      exactHeadRestored: git(['rev-parse', 'HEAD']) === candidateSha,
      trackedStateClean: git(['status', '--porcelain', '--untracked-files=no']) === '',
      preparedStateRemoved: true,
      rollbackAction: 'Remove the EV-21 closed proof class, preflight/build profiles, corpus/tool/test/workflow, and leave the existing full-repository-build producer unchanged. No proof reuse is enabled by EV-21.',
    },
    acceptedForReuse: false,
    acceptedForEnforcement: false,
    candidatePassGranted: false,
  };

  if (executeProofs) {
    assert(report.metrics.falseHits <= corpus.errorBudget.falseHits, 'EV-21 false-hit budget exceeded');
    assert(report.metrics.sameClosureDisagreements <= corpus.errorBudget.sameClosureDisagreements, 'EV-21 same-closure disagreement budget exceeded');
    assert(report.metrics.historicalSameClosureDisagreements === 0, 'EV-21 retained history contains a same-closure disagreement');
    assert(report.eligibleProofClasses.length === 1, `EV-21 did not close the proof class: ${report.metrics.reasons.join('; ')}`);
    assert(report.rollback.proofReuseEnabled === false && report.rollback.closedProofClassShadowOnly, 'EV-21 must not enable proof reuse');
    assert(report.rollback.authoritativeProducerChanged === false, 'EV-21 must not switch the authoritative producer');
    assert(report.rollback.sourceMutationsRestored && report.rollback.exactHeadRestored && report.rollback.trackedStateClean, 'EV-21 did not restore the exact candidate');
  }
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
  const report = await runProofCacheClosureCalibrationEvidence({ candidateSha, executeProofs: !noProofs });
  if (output) {
    const outputPath = resolve(output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalJson(report), 'utf8');
  }
  console.log(`EV21_PROOF_CACHE_CLOSURE_CALIBRATION_PASS candidate=${report.candidateSha} proof=${report.proofId} trials=${report.trials.length} falseHits=${report.metrics.falseHits} falseMisses=${report.metrics.falseMisses} disagreements=${report.metrics.sameClosureDisagreements} eligible=${report.eligibleProofClasses.join(',') || 'none'} reuse=false`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  main().catch(error => {
    console.error(`EV21_PROOF_CACHE_CLOSURE_CALIBRATION_FAIL ${error.message}`);
    process.exitCode = 1;
  });
}
