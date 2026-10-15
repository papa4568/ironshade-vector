import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeClosure, validateProofCachePolicy } from './causal-proof-cache.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

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
  return createHash('sha256').update(value).digest('hex');
}

function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`expected boolean, got ${value}`);
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, canonicalJson(value), 'utf8');
}

function appendOutput(path, values) {
  if (!path) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n');
  execFileSync('bash', ['-lc', `cat >> "$1" <<'EOF'\n${lines}\nEOF`, 'bash', path], { stdio: 'ignore' });
}

export function validateProofCachePromotionPolicy(policy, { proofPolicy, ev17CorpusBlobSha, ev21CorpusBlobSha, ev21Corpus }) {
  assert(policy && typeof policy === 'object' && !Array.isArray(policy), 'EV-18 policy must be an object');
  assert(policy.schemaVersion === 1, 'EV-18 policy schemaVersion must be 1');
  assert(policy.mode === 'single-proof-reuse', 'EV-18 policy mode must be single-proof-reuse');
  assert(policy.enabled === true, 'EV-18 promotion must be enabled by policy');
  assert(policy.promotionTask === 'EV-18', 'EV-18 promotion task drifted');
  assert(policy.proofClass === 'full-repository-build-closed', 'EV-18 may promote only full-repository-build-closed');
  validateProofCachePolicy(proofPolicy);
  assert(proofPolicy.proofClasses.some(entry => entry.id === policy.proofClass), 'promoted proof class is missing from proof-cache policy');
  assert(policy.sourceEvidence?.ev17?.taskId === 'EV-17', 'EV-18 must cite EV-17');
  assert(policy.sourceEvidence.ev17.corpusGitBlobSha === ev17CorpusBlobSha, 'EV-17 corpus blob drifted');
  assert(policy.sourceEvidence?.ev21?.taskId === 'EV-21', 'EV-18 must cite EV-21');
  assert(policy.sourceEvidence.ev21.corpusGitBlobSha === ev21CorpusBlobSha, 'EV-21 corpus blob drifted');
  assert(ev21Corpus?.taskId === 'EV-21' && ev21Corpus?.promotionTarget === 'EV-18', 'EV-21 corpus no longer targets EV-18');
  assert(ev21Corpus?.proofClasses?.length === 1 && ev21Corpus.proofClasses[0].proofId === policy.proofClass, 'EV-21 calibrated scope drifted');
  assert(policy.sourceEvidence.ev21.falseHits === 0 && policy.sourceEvidence.ev21.sameClosureDisagreements === 0, 'EV-18 requires zero EV-21 unsafe errors');
  assert(policy.sourceEvidence.ev21.detectedInvalidationDefects >= 1, 'EV-18 requires a detected real invalidation defect');
  assert(JSON.stringify(policy.sourceEvidence.ev21.eligibleProofClasses) === JSON.stringify([policy.proofClass]), 'EV-18 source evidence must identify exactly one eligible proof class');
  assert(policy.cache?.provider === 'github-actions-cache', 'EV-18 cache provider drifted');
  assert(policy.cache?.exactKeyOnly === true, 'EV-18 cache must use exact keys only');
  assert(typeof policy.cache?.keyPrefix === 'string' && policy.cache.keyPrefix.length > 0, 'EV-18 cache key prefix is required');
  assert(policy.calibration?.errorBudget?.falsePositives === 0 && policy.calibration?.errorBudget?.falseNegatives === 0, 'EV-18 error budget must remain zero');
  assert(policy.rollback?.environmentVariable === 'IRONSHADE_PROOF_CACHE_REUSE' && policy.rollback?.disabledValue === '0', 'EV-18 rollback switch drifted');
  return policy;
}

export async function loadPromotionContract({ cwd = process.cwd() } = {}) {
  const policyPath = resolve(cwd, 'agent/proof-cache-promotion-policy.json');
  const proofPolicyPath = resolve(cwd, 'agent/proof-cache.json');
  const ev17Path = resolve(cwd, 'agent/proof-cache-calibration-corpus.json');
  const ev21Path = resolve(cwd, 'agent/proof-cache-closure-calibration-corpus.json');
  const [policy, proofPolicy, ev21Corpus] = await Promise.all([
    loadJson(policyPath),
    loadJson(proofPolicyPath),
    loadJson(ev21Path),
  ]);
  const ev17CorpusBlobSha = git(['hash-object', ev17Path], cwd);
  const ev21CorpusBlobSha = git(['hash-object', ev21Path], cwd);
  validateProofCachePromotionPolicy(policy, { proofPolicy, ev17CorpusBlobSha, ev21CorpusBlobSha, ev21Corpus });
  return { policy, proofPolicy, ev21Corpus, ev17CorpusBlobSha, ev21CorpusBlobSha };
}

export function isPromotionEnabled(policy, env = process.env) {
  return policy.enabled && env[policy.rollback.environmentVariable] !== policy.rollback.disabledValue;
}

export async function buildReuseRequest({ candidateSha, env = process.env, cwd = process.cwd() }) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase SHA');
  assert(git(['rev-parse', 'HEAD'], cwd) === candidateSha, 'candidateSha does not match checked-out HEAD');
  const contract = await loadPromotionContract({ cwd });
  assert(isPromotionEnabled(contract.policy, env), 'EV-18 reuse is disabled by rollback switch');
  const closure = computeClosure({
    policy: contract.proofPolicy,
    proofId: contract.policy.proofClass,
    revision: candidateSha,
    cwd,
    env,
  });
  const policyDigest = sha256(canonicalJson(contract.policy));
  const cacheKey = `${contract.policy.cache.keyPrefix}-${closure.closureDigest}`;
  return {
    schema: 'ironshade-proof-cache-reuse-request:v1',
    schemaVersion: 1,
    taskId: 'EV-18',
    candidateSha,
    proofId: contract.policy.proofClass,
    repositoryDigest: closure.repositoryDigest,
    executionContextDigest: closure.executionContextDigest,
    closureDigest: closure.closureDigest,
    cacheKey,
    policyDigest,
    sourceEvidence: contract.policy.sourceEvidence,
    acceptedForReuse: true,
    candidatePassGranted: false,
  };
}

async function directoryEntries(root, relative = '') {
  const current = relative ? join(root, relative) : root;
  const names = (await readdir(current)).sort((a, b) => a.localeCompare(b));
  const entries = [];
  for (const name of names) {
    const rel = relative ? `${relative}/${name}` : name;
    const path = join(root, rel);
    const stat = await lstat(path);
    assert(!stat.isSymbolicLink(), `cache tree may not contain symlink: ${rel}`);
    if (stat.isDirectory()) {
      entries.push({ path: rel, type: 'directory', mode: stat.mode & 0o777 });
      entries.push(...await directoryEntries(root, rel));
      continue;
    }
    assert(stat.isFile(), `cache tree contains unsupported entry type: ${rel}`);
    const bytes = await readFile(path);
    entries.push({ path: rel, type: 'file', mode: stat.mode & 0o777, size: stat.size, sha256: sha256(bytes) });
  }
  return entries;
}

export async function digestDirectory(root) {
  const stat = await lstat(root);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), `${root} must be a real directory`);
  return sha256(canonicalJson({ schema: 'ironshade-proof-cache-tree:v1', entries: await directoryEntries(root) }));
}

function validateRequest(request) {
  assert(request?.schema === 'ironshade-proof-cache-reuse-request:v1', 'unsupported EV-18 request schema');
  assert(request.taskId === 'EV-18', 'EV-18 request task mismatch');
  assert(SHA_PATTERN.test(request.candidateSha ?? ''), 'EV-18 request candidate SHA is invalid');
  assert(request.proofId === 'full-repository-build-closed', 'EV-18 request proof scope drifted');
  for (const field of ['repositoryDigest', 'executionContextDigest', 'closureDigest', 'policyDigest']) {
    assert(DIGEST_PATTERN.test(request[field] ?? ''), `EV-18 request ${field} is invalid`);
  }
  assert(typeof request.cacheKey === 'string' && request.cacheKey.endsWith(request.closureDigest), 'EV-18 request cache key is not closure-bound');
  return request;
}

export async function recordCacheEntry({ request, cacheDir, distDir = 'dist', workflowRunId, repository = process.env.GITHUB_REPOSITORY ?? 'unknown/unknown', workflow = process.env.GITHUB_WORKFLOW ?? 'PR Candidate Verification' }) {
  validateRequest(request);
  assert(/^\d+$/.test(String(workflowRunId ?? '')), 'workflowRunId must be numeric');
  assert(await lstat(distDir).then(stat => stat.isDirectory() && !stat.isSymbolicLink()).catch(() => false), 'distDir must be a real directory');
  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });
  const cachedDist = join(cacheDir, 'dist');
  await cp(distDir, cachedDist, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: false });
  const distDigest = await digestDirectory(cachedDist);
  const receipt = {
    schema: 'ironshade-proof-cache-reuse-receipt:v1',
    schemaVersion: 1,
    taskId: 'EV-18',
    proofId: request.proofId,
    outcome: 'success',
    cacheKey: request.cacheKey,
    closureDigest: request.closureDigest,
    repositoryDigest: request.repositoryDigest,
    executionContextDigest: request.executionContextDigest,
    policyDigest: request.policyDigest,
    distDigest,
    sourceCandidateSha: request.candidateSha,
    sourceWorkflowRunId: String(workflowRunId),
    sourceRepository: repository,
    sourceWorkflow: workflow,
    sourceProofProfile: 'scripts/run-full-repository-build-proof-closed.sh',
    createdBy: 'real-proof-rerun',
    candidatePassGranted: false,
  };
  await writeJson(join(cacheDir, 'receipt.json'), receipt);
  return receipt;
}

export async function validateCacheEntry({ request, cacheDir }) {
  validateRequest(request);
  const reasons = [];
  let receipt = null;
  try {
    receipt = await loadJson(join(cacheDir, 'receipt.json'));
  } catch {
    return { valid: false, reasons: ['missing-or-malformed-receipt'], receipt: null };
  }
  const exact = (condition, reason) => { if (!condition) reasons.push(reason); };
  exact(receipt?.schema === 'ironshade-proof-cache-reuse-receipt:v1', 'receipt-schema');
  exact(receipt?.taskId === 'EV-18', 'task-id');
  exact(receipt?.proofId === request.proofId, 'proof-id');
  exact(receipt?.outcome === 'success', 'proof-outcome');
  exact(receipt?.cacheKey === request.cacheKey, 'cache-key');
  exact(receipt?.closureDigest === request.closureDigest, 'closure-digest');
  exact(receipt?.repositoryDigest === request.repositoryDigest, 'repository-digest');
  exact(receipt?.executionContextDigest === request.executionContextDigest, 'execution-context-digest');
  exact(receipt?.policyDigest === request.policyDigest, 'policy-digest');
  exact(SHA_PATTERN.test(receipt?.sourceCandidateSha ?? ''), 'source-candidate-sha');
  exact(/^\d+$/.test(receipt?.sourceWorkflowRunId ?? ''), 'source-workflow-run-id');
  exact(typeof receipt?.sourceRepository === 'string' && receipt.sourceRepository.includes('/'), 'source-repository');
  exact(receipt?.sourceProofProfile === 'scripts/run-full-repository-build-proof-closed.sh', 'source-proof-profile');
  exact(receipt?.createdBy === 'real-proof-rerun', 'source-provenance');
  exact(receipt?.candidatePassGranted === false, 'candidate-pass-granted');
  exact(DIGEST_PATTERN.test(receipt?.distDigest ?? ''), 'dist-digest-format');
  if (reasons.length === 0) {
    try {
      const actual = await digestDirectory(join(cacheDir, 'dist'));
      exact(actual === receipt.distDigest, 'dist-digest-mismatch');
    } catch {
      reasons.push('missing-or-invalid-dist');
    }
  }
  return { valid: reasons.length === 0, reasons, receipt };
}

export async function decideReuse({ request, cacheHit, cacheDir, env = process.env, policy = null }) {
  const resolvedPolicy = policy ?? (await loadPromotionContract()).policy;
  if (!isPromotionEnabled(resolvedPolicy, env)) {
    return { reuse: false, proofMode: 'legacy', reason: 'rollback-disabled', cacheValid: false, cacheReasons: [] };
  }
  validateRequest(request);
  if (!cacheHit) {
    return { reuse: false, proofMode: 'closed', reason: 'cache-miss', cacheValid: false, cacheReasons: [] };
  }
  const validation = await validateCacheEntry({ request, cacheDir });
  if (!validation.valid) {
    return { reuse: false, proofMode: 'closed', reason: 'cache-rejected', cacheValid: false, cacheReasons: validation.reasons };
  }
  return {
    reuse: true,
    proofMode: 'reused',
    reason: 'validated-exact-closure-success-entry',
    cacheValid: true,
    cacheReasons: [],
    sourceCandidateSha: validation.receipt.sourceCandidateSha,
    sourceWorkflowRunId: validation.receipt.sourceWorkflowRunId,
    distDigest: validation.receipt.distDigest,
  };
}

export async function materializeCacheEntry({ request, cacheDir, distDir = 'dist' }) {
  const validation = await validateCacheEntry({ request, cacheDir });
  assert(validation.valid, `refusing invalid EV-18 cache entry: ${validation.reasons.join(',')}`);
  await rm(distDir, { recursive: true, force: true });
  await cp(join(cacheDir, 'dist'), distDir, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: false });
  const actual = await digestDirectory(distDir);
  assert(actual === validation.receipt.distDigest, 'materialized dist digest mismatch');
  return validation.receipt;
}

export async function auditProducerIntegration({ cwd = process.cwd() } = {}) {
  const workflow = await readFile(resolve(cwd, '.github/workflows/pr-candidate.yml'), 'utf8');
  const checks = {
    rollbackSwitch: workflow.includes('IRONSHADE_PROOF_CACHE_REUSE'),
    preflight: workflow.includes('bash scripts/prepare-full-repository-build-proof-closed.sh'),
    exactCacheRestore: workflow.includes('uses: actions/cache/restore@v5') && !workflow.includes('restore-keys:'),
    cacheDecision: workflow.includes('proof-cache-promotion.mjs decide'),
    cacheMaterialization: workflow.includes('proof-cache-promotion.mjs materialize'),
    closedFallback: workflow.includes('bash scripts/run-full-repository-build-proof-closed.sh'),
    legacyRollback: workflow.includes('bash scripts/run-full-repository-build-proof.sh'),
    realProofReceipt: workflow.includes('proof-cache-promotion.mjs record'),
    cacheSave: workflow.includes('uses: actions/cache/save@v5'),
  };
  return { checks, pass: Object.values(checks).every(Boolean) };
}

async function fixtureRequest(policy) {
  const digest = value => sha256(value);
  const closureDigest = digest('ev18-fixture-closure');
  return {
    schema: 'ironshade-proof-cache-reuse-request:v1',
    schemaVersion: 1,
    taskId: 'EV-18',
    candidateSha: '1'.repeat(40),
    proofId: policy.proofClass,
    repositoryDigest: digest('repository'),
    executionContextDigest: digest('execution-context'),
    closureDigest,
    cacheKey: `${policy.cache.keyPrefix}-${closureDigest}`,
    policyDigest: digest(canonicalJson(policy)),
    sourceEvidence: policy.sourceEvidence,
    acceptedForReuse: true,
    candidatePassGranted: false,
  };
}

export async function calibratePromotionDecision({ policy }) {
  const root = await mkdtemp(join(tmpdir(), 'ironshade-ev18-'));
  const cacheDir = join(root, 'cache');
  const distDir = join(root, 'dist');
  await mkdir(distDir, { recursive: true });
  await writeFile(join(distDir, 'index.html'), '<!doctype html><title>ev18</title>\n', 'utf8');
  const request = await fixtureRequest(policy);
  await recordCacheEntry({ request, cacheDir, distDir, workflowRunId: '12345', repository: 'papa4568/ironshade-vector', workflow: 'fixture' });

  const trials = [];
  let falsePositives = 0;
  let falseNegatives = 0;
  const evaluate = async (id, expectedReuse, mutate, { cacheHit = true, env = {} } = {}) => {
    const receiptPath = join(cacheDir, 'receipt.json');
    const originalReceipt = await readFile(receiptPath, 'utf8');
    const originalDist = await readFile(join(cacheDir, 'dist/index.html'), 'utf8');
    try {
      if (mutate) await mutate({ receiptPath, cacheDir });
      const decision = await decideReuse({ request, cacheHit, cacheDir, env, policy });
      const pass = decision.reuse === expectedReuse;
      if (!pass && expectedReuse) falseNegatives += 1;
      if (!pass && !expectedReuse) falsePositives += 1;
      trials.push({ id, expectedReuse, observedReuse: decision.reuse, proofMode: decision.proofMode, reason: decision.reason, pass });
    } finally {
      await writeFile(receiptPath, originalReceipt, 'utf8');
      await writeFile(join(cacheDir, 'dist/index.html'), originalDist, 'utf8');
    }
  };

  await evaluate('valid-exact-closure-success-entry', true);
  await evaluate('cache-miss', false, null, { cacheHit: false });
  await evaluate('closure-mismatch', false, async ({ receiptPath }) => {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    receipt.closureDigest = '2'.repeat(64);
    await writeJson(receiptPath, receipt);
  });
  await evaluate('failed-proof-receipt', false, async ({ receiptPath }) => {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    receipt.outcome = 'failure';
    await writeJson(receiptPath, receipt);
  });
  await evaluate('invalid-source-candidate', false, async ({ receiptPath }) => {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    receipt.sourceCandidateSha = 'not-a-sha';
    await writeJson(receiptPath, receipt);
  });
  await evaluate('dist-digest-mismatch', false, async ({ cacheDir: path }) => {
    await writeFile(join(path, 'dist/index.html'), 'tampered\n', 'utf8');
  });
  const rollbackEnv = { [policy.rollback.environmentVariable]: policy.rollback.disabledValue };
  await evaluate('rollback-forces-legacy-proof', false, null, { env: rollbackEnv });
  const rollback = trials.find(entry => entry.id === 'rollback-forces-legacy-proof');
  await rm(root, { recursive: true, force: true });
  return {
    trials,
    falsePositives,
    falseNegatives,
    rollbackPass: rollback?.proofMode === 'legacy' && rollback?.reason === 'rollback-disabled',
    pass: falsePositives === 0 && falseNegatives === 0 && rollback?.proofMode === 'legacy',
  };
}

export async function generatePromotionEvidence({ candidateSha, cwd = process.cwd() }) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase SHA');
  assert(git(['rev-parse', 'HEAD'], cwd) === candidateSha, 'candidateSha does not match exact HEAD');
  const contract = await loadPromotionContract({ cwd });
  const calibration = await calibratePromotionDecision({ policy: contract.policy });
  assert(calibration.pass, `EV-18 calibration failed fp=${calibration.falsePositives} fn=${calibration.falseNegatives} rollback=${calibration.rollbackPass}`);
  const producer = await auditProducerIntegration({ cwd });
  assert(producer.pass, 'EV-18 producer integration is incomplete');
  return {
    schema: 'ironshade-proof-cache-promotion:v1',
    schemaVersion: 1,
    taskId: 'EV-18',
    candidateSha,
    mode: 'single-proof-reuse',
    proofId: contract.policy.proofClass,
    sourceEvidence: contract.policy.sourceEvidence,
    calibration: {
      errorBudget: contract.policy.calibration.errorBudget,
      measuredErrors: { falsePositives: calibration.falsePositives, falseNegatives: calibration.falseNegatives },
      trials: calibration.trials,
    },
    producer,
    rollback: {
      environmentVariable: contract.policy.rollback.environmentVariable,
      disabledValue: contract.policy.rollback.disabledValue,
      forcesPrePromotionLegacyProof: calibration.rollbackPass,
      behavior: contract.policy.rollback.behavior,
    },
    cache: {
      provider: contract.policy.cache.provider,
      exactKeyOnly: contract.policy.cache.exactKeyOnly,
      keyPrefix: contract.policy.cache.keyPrefix,
      provenanceFields: ['sourceCandidateSha', 'sourceWorkflowRunId', 'sourceRepository', 'sourceWorkflow', 'sourceProofProfile', 'closureDigest', 'repositoryDigest', 'executionContextDigest', 'policyDigest', 'distDigest'],
    },
    acceptedForReuse: true,
    blocking: true,
    candidatePassGranted: false,
  };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    assert(token.startsWith('--'), `unexpected argument ${token}`);
    const value = rest[index + 1];
    assert(value !== undefined && !value.startsWith('--'), `missing value for ${token}`);
    options[token.slice(2)] = value;
    index += 1;
  }
  return { command, options };
}

async function main(argv) {
  const { command, options } = parseArgs(argv);
  if (command === 'request') {
    const request = await buildReuseRequest({ candidateSha: options['candidate-sha'] });
    if (options.output) await writeJson(resolve(options.output), request);
    appendOutput(options['github-output'], { 'cache-key': request.cacheKey, 'closure-digest': request.closureDigest });
    console.log(`EV18_PROOF_CACHE_REQUEST candidate=${request.candidateSha} proof=${request.proofId} closure=${request.closureDigest}`);
    return;
  }
  if (command === 'decide') {
    const request = await loadJson(resolve(options.request));
    const decision = await decideReuse({ request, cacheHit: parseBoolean(options['cache-hit']), cacheDir: resolve(options['cache-dir']) });
    if (options.output) await writeJson(resolve(options.output), decision);
    appendOutput(options['github-output'], { reuse: decision.reuse, 'proof-mode': decision.proofMode, reason: decision.reason });
    console.log(`EV18_PROOF_CACHE_DECISION reuse=${decision.reuse} proofMode=${decision.proofMode} reason=${decision.reason}${decision.sourceCandidateSha ? ` sourceCandidate=${decision.sourceCandidateSha} sourceRun=${decision.sourceWorkflowRunId}` : ''}`);
    return;
  }
  if (command === 'record') {
    const request = await loadJson(resolve(options.request));
    const receipt = await recordCacheEntry({ request, cacheDir: resolve(options['cache-dir']), distDir: resolve(options.dist ?? 'dist'), workflowRunId: options['run-id'] ?? process.env.GITHUB_RUN_ID, repository: process.env.GITHUB_REPOSITORY, workflow: process.env.GITHUB_WORKFLOW });
    console.log(`EV18_PROOF_CACHE_RECORD sourceCandidate=${receipt.sourceCandidateSha} sourceRun=${receipt.sourceWorkflowRunId} distDigest=${receipt.distDigest}`);
    return;
  }
  if (command === 'materialize') {
    const request = await loadJson(resolve(options.request));
    const receipt = await materializeCacheEntry({ request, cacheDir: resolve(options['cache-dir']), distDir: resolve(options.dist ?? 'dist') });
    console.log(`EV18_PROOF_CACHE_REUSE_PASS sourceCandidate=${receipt.sourceCandidateSha} sourceRun=${receipt.sourceWorkflowRunId} closure=${receipt.closureDigest} distDigest=${receipt.distDigest}`);
    return;
  }
  if (command === 'evidence') {
    const report = await generatePromotionEvidence({ candidateSha: options['candidate-sha'] });
    if (options.output) await writeJson(resolve(options.output), report);
    console.log(`EV18_PROMOTION_EVIDENCE_PASS candidate=${report.candidateSha} proof=${report.proofId} fp=${report.calibration.measuredErrors.falsePositives} fn=${report.calibration.measuredErrors.falseNegatives} rollback=${report.rollback.forcesPrePromotionLegacyProof}`);
    return;
  }
  throw new Error('usage: proof-cache-promotion.mjs <request|decide|record|materialize|evidence> [options]');
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : null;
if (invoked && fileURLToPath(import.meta.url) === invoked) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`EV18_PROOF_CACHE_ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
