import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const OUTCOMES = new Set(['success', 'failure', 'skipped', 'cancelled']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertStringArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function canonicalJson(value) {
  const normalize = entry => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(Object.keys(entry).sort((a, b) => a.localeCompare(b)).map(key => [key, normalize(entry[key])]));
  };
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Json(value) {
  return sha256Text(canonicalJson(value));
}

function runGit(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trimEnd();
}

function normalizePath(value) {
  return value.replaceAll('\\\\', '/').replace(/^\.\//, '');
}

function proofDefinitionForDigest(proof) {
  return {
    id: proof.id,
    command: proof.command,
    expensive: proof.expensive,
    repositoryClosure: proof.repositoryClosure,
    runtimeClosure: proof.runtimeClosure,
  };
}

export function validateProofCachePolicy(policy) {
  assertObject(policy, 'proof cache policy');
  assert(policy.schemaVersion === 1, 'proof cache policy schemaVersion must be 1');
  assert(policy.mode === 'shadow', 'proof cache policy mode must remain shadow until promoted');
  assert(Array.isArray(policy.proofClasses) && policy.proofClasses.length >= 1, 'proofClasses must contain at least one proof class');
  const ids = new Set();
  for (const [index, proof] of policy.proofClasses.entries()) {
    const label = `proofClasses[${index}]`;
    assertObject(proof, label);
    assertString(proof.id, `${label}.id`);
    assert(!ids.has(proof.id), `${label}.id must be unique`);
    ids.add(proof.id);
    assertString(proof.command, `${label}.command`);
    assert(proof.expensive === true, `${label}.expensive must be true for EV-6 shadow sampling`);
    assertObject(proof.repositoryClosure, `${label}.repositoryClosure`);
    assert(proof.repositoryClosure.strategy === 'all-tracked-except', `${label}.repositoryClosure.strategy must be all-tracked-except`);
    assertStringArray(proof.repositoryClosure.excludedPrefixes, `${label}.repositoryClosure.excludedPrefixes`);
    assertStringArray(proof.repositoryClosure.excludedFiles, `${label}.repositoryClosure.excludedFiles`);
    assertObject(proof.runtimeClosure, `${label}.runtimeClosure`);
    assertString(proof.runtimeClosure.runnerLabel, `${label}.runtimeClosure.runnerLabel`);
    assertStringArray(proof.runtimeClosure.environmentVariables, `${label}.runtimeClosure.environmentVariables`);
    assert(proof.runtimeClosure.captureNode === true, `${label}.runtimeClosure.captureNode must be true`);
    assert(proof.runtimeClosure.captureNpm === true, `${label}.runtimeClosure.captureNpm must be true`);
    assert(proof.runtimeClosure.capturePlatform === true, `${label}.runtimeClosure.capturePlatform must be true`);
  }
  return policy;
}

export function findProofClass(policy, proofId) {
  validateProofCachePolicy(policy);
  const proof = policy.proofClasses.find(entry => entry.id === proofId);
  assert(proof, `unknown proof class: ${proofId}`);
  return proof;
}

export function validateProofCacheHistory(history) {
  assertObject(history, 'proof cache history');
  assert(history.schemaVersion === 1, 'proof cache history schemaVersion must be 1');
  assert(history.mode === 'shadow', 'proof cache history mode must remain shadow');
  assert(Array.isArray(history.observations), 'proof cache history observations must be an array');
  assert(history.observations.length <= 50, 'proof cache history must remain bounded to 50 observations');
  const ids = new Set();
  for (const [index, observation] of history.observations.entries()) {
    const label = `observations[${index}]`;
    assertObject(observation, label);
    assertString(observation.id, `${label}.id`);
    assert(!ids.has(observation.id), `${label}.id must be unique`);
    ids.add(observation.id);
    assert(observation.source === 'candidate-rerun', `${label}.source must be candidate-rerun`);
    assertString(observation.proofId, `${label}.proofId`);
    assertString(observation.candidateSha, `${label}.candidateSha`);
    assert(SHA_PATTERN.test(observation.candidateSha), `${label}.candidateSha must be a full lowercase SHA`);
    for (const field of ['repositoryDigest', 'executionContextDigest', 'closureDigest']) {
      assertString(observation[field], `${label}.${field}`);
      assert(/^[a-f0-9]{64}$/.test(observation[field]), `${label}.${field} must be a SHA-256 digest`);
    }
    assert(OUTCOMES.has(observation.outcome), `${label}.outcome is invalid`);
    assertString(observation.workflowRunId, `${label}.workflowRunId`);
    assert(/^[0-9]+$/.test(observation.workflowRunId), `${label}.workflowRunId must be numeric`);
  }
  return history;
}

export function isRepositoryPathInClosure(filePath, proof) {
  const normalized = normalizePath(filePath);
  if (proof.repositoryClosure.excludedFiles.includes(normalized)) return false;
  return !proof.repositoryClosure.excludedPrefixes.some(prefix => normalized.startsWith(normalizePath(prefix)));
}

export function repositoryClosureEntries({ proof, revision = 'HEAD', cwd = process.cwd() }) {
  const raw = execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', revision], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const entries = [];
  for (const record of raw.split('\0')) {
    if (!record) continue;
    const match = /^(\d+)\s+(\S+)\s+([a-f0-9]{40})\t(.+)$/.exec(record);
    assert(match, `unable to parse git tree record for ${revision}`);
    const [, mode, type, object, path] = match;
    if (!isRepositoryPathInClosure(path, proof)) continue;
    entries.push({ mode, type, object, path: normalizePath(path) });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  assert(entries.length > 0, `proof ${proof.id} repository closure is empty at ${revision}`);
  return entries;
}

export function repositoryDigest({ proof, revision = 'HEAD', cwd = process.cwd() }) {
  return sha256Json({
    proofId: proof.id,
    strategy: proof.repositoryClosure.strategy,
    entries: repositoryClosureEntries({ proof, revision, cwd }),
  });
}

function npmVersion(cwd = process.cwd()) {
  return execFileSync('npm', ['--version'], { cwd, encoding: 'utf8' }).trim();
}

export function captureExecutionContext(proof, { env = process.env, cwd = process.cwd(), npm = null } = {}) {
  const envFingerprints = Object.fromEntries(
    [...proof.runtimeClosure.environmentVariables]
      .sort((a, b) => a.localeCompare(b))
      .map(name => {
        const present = Object.hasOwn(env, name);
        return [name, { present, valueSha256: sha256Text(present ? String(env[name]) : '') }];
      }),
  );
  return {
    runnerLabel: proof.runtimeClosure.runnerLabel,
    node: process.version,
    npm: npm ?? npmVersion(cwd),
    platform: process.platform,
    arch: process.arch,
    env: envFingerprints,
  };
}

export function executionContextDigest(context) {
  assertObject(context, 'execution context');
  return sha256Json(context);
}

export function closureDigest({ proof, repositoryDigest: repoDigest, executionContextDigest: contextDigest }) {
  return sha256Json({
    schema: 'ironshade-proof-input-closure:v1',
    proofDefinition: proofDefinitionForDigest(proof),
    repositoryDigest: repoDigest,
    executionContextDigest: contextDigest,
  });
}

export function computeClosure({ policy, proofId, revision = 'HEAD', cwd = process.cwd(), executionContext = null, env = process.env, npm = null }) {
  const proof = findProofClass(policy, proofId);
  const candidateSha = runGit(['rev-parse', revision], cwd);
  assert(SHA_PATTERN.test(candidateSha), `revision ${revision} did not resolve to a full SHA`);
  const repoDigest = repositoryDigest({ proof, revision: candidateSha, cwd });
  const context = executionContext ?? captureExecutionContext(proof, { env, cwd, npm });
  const contextDigest = executionContextDigest(context);
  return {
    schema: 'ironshade-proof-input-closure:v1',
    proofId,
    candidateSha,
    repositoryDigest: repoDigest,
    executionContext: context,
    executionContextDigest: contextDigest,
    closureDigest: closureDigest({ proof, repositoryDigest: repoDigest, executionContextDigest: contextDigest }),
  };
}

export function validateHistoryAgainstGit({ policy, history, cwd = process.cwd() }) {
  validateProofCachePolicy(policy);
  validateProofCacheHistory(history);
  const validated = [];
  for (const observation of history.observations) {
    const proof = findProofClass(policy, observation.proofId);
    const repoDigest = repositoryDigest({ proof, revision: observation.candidateSha, cwd });
    assert(repoDigest === observation.repositoryDigest, `history observation ${observation.id} repository digest does not match ${observation.candidateSha}`);
    const expectedClosureDigest = closureDigest({
      proof,
      repositoryDigest: repoDigest,
      executionContextDigest: observation.executionContextDigest,
    });
    assert(expectedClosureDigest === observation.closureDigest, `history observation ${observation.id} closure digest is inconsistent`);
    validated.push(observation.id);
  }
  return { schema: 'ironshade-proof-cache-history-validation:v1', validatedObservationIds: validated.sort() };
}

export function analyzeHistoryForProof({ proofId, closure, history }) {
  validateProofCacheHistory(history);
  const sameProof = history.observations.filter(observation => observation.proofId === proofId);
  const grouped = new Map();
  for (const observation of sameProof) {
    const outcomes = grouped.get(observation.closureDigest) ?? new Set();
    outcomes.add(observation.outcome);
    grouped.set(observation.closureDigest, outcomes);
  }
  const disagreementDigests = [...grouped.entries()]
    .filter(([, outcomes]) => outcomes.size > 1)
    .map(([digest]) => digest)
    .sort();
  const proofDisabled = disagreementDigests.length > 0;
  const matching = sameProof.filter(observation => observation.closureDigest === closure.closureDigest);
  const matchingOutcomes = [...new Set(matching.map(observation => observation.outcome))].sort();
  const stableSuccess = matching.length > 0 && matchingOutcomes.length === 1 && matchingOutcomes[0] === 'success';
  return {
    proofDisabled,
    disagreementDigests,
    matchingObservationIds: matching.map(observation => observation.id).sort(),
    matchingOutcomes,
    stableSuccess,
  };
}

export function buildPrediction({ policy, history, proofId, revision = 'HEAD', cwd = process.cwd(), executionContext = null, env = process.env, npm = null }) {
  validateHistoryAgainstGit({ policy, history, cwd });
  const closure = computeClosure({ policy, proofId, revision, cwd, executionContext, env, npm });
  const historyAnalysis = analyzeHistoryForProof({ proofId, closure, history });
  const reuseWouldBeSafe = !historyAnalysis.proofDisabled && historyAnalysis.stableSuccess;
  return {
    schema: 'ironshade-causal-proof-cache-prediction:v1',
    schemaVersion: 1,
    mode: 'shadow',
    proofId,
    candidateSha: closure.candidateSha,
    closure,
    history: historyAnalysis,
    reuseWouldBeSafe,
    expectedOutcome: reuseWouldBeSafe ? 'success' : null,
    proofWillStillRerun: true,
    acceptedForReuse: false,
    candidatePassGranted: false,
  };
}

export function buildObservationReport({ prediction, outcome, workflowRunId = '0' }) {
  assertObject(prediction, 'prediction');
  assert(prediction.schema === 'ironshade-causal-proof-cache-prediction:v1', 'unsupported prediction schema');
  assert(OUTCOMES.has(outcome), 'proof outcome is invalid');
  assertString(String(workflowRunId), 'workflowRunId');
  const disagreement = prediction.reuseWouldBeSafe && prediction.expectedOutcome !== outcome;
  const proofDisabled = prediction.history.proofDisabled || disagreement;
  const disableReason = disagreement
    ? `predicted ${prediction.expectedOutcome} for unchanged causal closure but real rerun was ${outcome}`
    : (prediction.history.proofDisabled ? 'historical observations already disagree for one causal closure' : null);
  return {
    schema: 'ironshade-causal-proof-cache-report:v1',
    schemaVersion: 1,
    mode: 'shadow',
    proofId: prediction.proofId,
    candidateSha: prediction.candidateSha,
    prediction: {
      reuseWouldBeSafe: prediction.reuseWouldBeSafe,
      expectedOutcome: prediction.expectedOutcome,
      matchingObservationIds: prediction.history.matchingObservationIds,
      closureDigest: prediction.closure.closureDigest,
    },
    realRerun: {
      outcome,
      workflowRunId: String(workflowRunId),
      executed: true,
    },
    comparison: {
      applicable: prediction.reuseWouldBeSafe,
      agreement: prediction.reuseWouldBeSafe ? !disagreement : null,
      disagreement,
    },
    reuseState: {
      disabled: proofDisabled,
      reason: disableReason,
    },
    historyObservation: {
      id: `candidate-${prediction.candidateSha.slice(0, 12)}-${prediction.proofId}`,
      source: 'candidate-rerun',
      proofId: prediction.proofId,
      candidateSha: prediction.candidateSha,
      repositoryDigest: prediction.closure.repositoryDigest,
      executionContextDigest: prediction.closure.executionContextDigest,
      closureDigest: prediction.closure.closureDigest,
      outcome,
      workflowRunId: String(workflowRunId),
    },
    proofActuallyRerun: true,
    acceptedForReuse: false,
    candidatePassGranted: false,
  };
}

export async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, canonicalJson(value));
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    assert(token.startsWith('--'), `unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = rest[index + 1];
    assert(value !== undefined && !value.startsWith('--'), `missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

async function main(argv) {
  const { command, options } = parseArgs(argv);
  const policyPath = resolve(options.policy ?? 'agent/proof-cache.json');
  const historyPath = resolve(options.history ?? 'agent/proof-cache-history.json');
  const policy = validateProofCachePolicy(await loadJson(policyPath));
  const history = validateProofCacheHistory(await loadJson(historyPath));

  if (command === 'history-check') {
    const result = validateHistoryAgainstGit({ policy, history });
    console.log(`CAUSAL_PROOF_CACHE_HISTORY_PASS observations=${result.validatedObservationIds.length}`);
    return;
  }

  if (command === 'predict') {
    assertString(options.proof, '--proof');
    assertString(options.candidate, '--candidate');
    const prediction = buildPrediction({ policy, history, proofId: options.proof, revision: options.candidate });
    if (options.output) await writeJson(resolve(options.output), prediction);
    console.log(`CAUSAL_PROOF_CACHE_PREDICTION proof=${prediction.proofId} candidate=${prediction.candidateSha} closure=${prediction.closure.closureDigest} reuseWouldBeSafe=${prediction.reuseWouldBeSafe} matching=${prediction.history.matchingObservationIds.length} disabled=${prediction.history.proofDisabled}`);
    return;
  }

  if (command === 'observe') {
    assertString(options.prediction, '--prediction');
    assertString(options.outcome, '--outcome');
    const prediction = await loadJson(resolve(options.prediction));
    const report = buildObservationReport({ prediction, outcome: options.outcome, workflowRunId: options['run-id'] ?? process.env.GITHUB_RUN_ID ?? '0' });
    if (options.output) await writeJson(resolve(options.output), report);
    console.log(`CAUSAL_PROOF_CACHE_REPORT proof=${report.proofId} candidate=${report.candidateSha} predictedReuse=${report.prediction.reuseWouldBeSafe} outcome=${report.realRerun.outcome} agreement=${report.comparison.agreement} disabled=${report.reuseState.disabled}`);
    return;
  }

  throw new Error('usage: causal-proof-cache.mjs <history-check|predict|observe> [options]');
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`CAUSAL_PROOF_CACHE_FAIL ${error.message}`);
    process.exitCode = 1;
  });
}
