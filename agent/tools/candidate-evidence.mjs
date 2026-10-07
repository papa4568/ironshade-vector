import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { materializeRoadmapGraph, parseRoadmap } from './roadmap-adapter.mjs';
import { loadImpactMap, selectAffectedVerification } from './select-affected-verification.mjs';
import { loadTaskGraph, validateTaskGraph } from './validate-task-graph.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PROOF_KINDS = new Set(['test', 'build', 'ci', 'artifact', 'review', 'invariant', 'external']);
const EVIDENCE_STATUSES = new Set(['passed', 'failed', 'pending', 'blocked_external']);
const SOURCE_TYPES = new Set(['command', 'ci', 'artifact', 'review', 'invariant', 'external']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertStringArray(value, label, { minItems = 0, sorted = false } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(value.length >= minItems, `${label} must contain at least ${minItems} item(s)`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
  if (sorted) {
    const ordered = [...value].sort((a, b) => a.localeCompare(b));
    assert(JSON.stringify(value) === JSON.stringify(ordered), `${label} must be sorted`);
  }
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function normalizeObject(value) {
  if (Array.isArray(value)) return value.map(normalizeObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .map(key => [key, normalizeObject(value[key])]),
  );
}

export function canonicalJson(value) {
  return `${JSON.stringify(normalizeObject(value), null, 2)}\n`;
}

export function sha256Value(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function resolveGitSha(ref, cwd = process.cwd()) {
  assertString(ref, 'git ref');
  const sha = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  assert(SHA_PATTERN.test(sha), `git ref ${ref} did not resolve to a full commit SHA`);
  return sha;
}

export function collectCandidateChangedFiles({ base, head, cwd = process.cwd() }) {
  const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACDMR', `${base}...${head}`], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return [...new Set(output.split(/\r?\n/).map(line => line.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

async function loadProductTask(taskId) {
  const [roadmapRaw, metadataRaw] = await Promise.all([
    readFile(resolve('docs/content-roadmap.md'), 'utf8'),
    readFile(resolve('agent/roadmap-metadata.json'), 'utf8'),
  ]);
  const graph = materializeRoadmapGraph(parseRoadmap(roadmapRaw), JSON.parse(metadataRaw));
  const task = graph.tasks.find(entry => entry.id === taskId);
  return task ? { task, source: 'docs/content-roadmap.md' } : null;
}

export async function loadCandidateTask(taskId = 'active') {
  const graph = await loadTaskGraph();
  validateTaskGraph(graph);

  if (taskId === 'active') {
    const active = graph.tasks.find(task => task.status === 'active' || task.status === 'verifying');
    assert(active, 'no active or verifying orchestration task exists');
    return { task: active, source: 'agent/task-graph.json' };
  }

  const orchestrationTask = graph.tasks.find(task => task.id === taskId);
  if (orchestrationTask) return { task: orchestrationTask, source: 'agent/task-graph.json' };

  const productTask = await loadProductTask(taskId);
  assert(productTask, `task ${taskId} was not found in the orchestration graph or active product roadmap`);
  return productTask;
}

function requiredProofShape(proof) {
  const result = {
    id: proof.id,
    kind: proof.kind,
    required: proof.required,
    description: proof.description,
  };
  if (proof.command) result.command = proof.command;
  return result;
}

export function buildCandidateManifest({
  repository,
  task,
  taskSource,
  baseSha,
  headSha,
  branch,
  changedFiles,
  impactSelection,
  externalQaRefs = [],
}) {
  const manifest = {
    $schema: 'agent/candidate-manifest.schema.json',
    schemaVersion: 1,
    repository,
    task: {
      id: task.id,
      title: task.title,
      source: taskSource,
      acceptanceDigest: sha256Value(task.acceptance),
      affectedDomains: [...task.affectedDomains].sort((a, b) => a.localeCompare(b)),
    },
    candidate: {
      baseSha,
      headSha,
      branch,
    },
    changedFiles: [...changedFiles].sort((a, b) => a.localeCompare(b)),
    impact: {
      mode: impactSelection.mode,
      escalated: impactSelection.escalated,
      domains: [...impactSelection.domains].sort((a, b) => a.localeCompare(b)),
      verificationIds: impactSelection.verifications.map(check => check.id).sort((a, b) => a.localeCompare(b)),
      unknownFiles: [...impactSelection.unknownFiles].sort((a, b) => a.localeCompare(b)),
      escalationReasons: [...impactSelection.escalationReasons].sort((a, b) => a.localeCompare(b)),
    },
    requiredProofs: task.proofs.filter(proof => proof.required).map(requiredProofShape),
    externalQaRefs: [...externalQaRefs].sort((a, b) => a.localeCompare(b)),
  };
  validateCandidateManifest(manifest);
  return manifest;
}

export function validateCandidateManifest(manifest) {
  assertObject(manifest, 'candidate manifest');
  assert(manifest.schemaVersion === 1, 'candidate manifest schemaVersion must be 1');
  assertString(manifest.repository, 'manifest.repository');

  assertObject(manifest.task, 'manifest.task');
  assertString(manifest.task.id, 'manifest.task.id');
  assertString(manifest.task.title, 'manifest.task.title');
  assertString(manifest.task.source, 'manifest.task.source');
  assert(SHA256_PATTERN.test(manifest.task.acceptanceDigest), 'manifest.task.acceptanceDigest must be SHA-256');
  assertStringArray(manifest.task.affectedDomains, 'manifest.task.affectedDomains', { sorted: true });

  assertObject(manifest.candidate, 'manifest.candidate');
  assert(SHA_PATTERN.test(manifest.candidate.baseSha), 'manifest.candidate.baseSha must be a full lowercase commit SHA');
  assert(SHA_PATTERN.test(manifest.candidate.headSha), 'manifest.candidate.headSha must be a full lowercase commit SHA');
  assert(manifest.candidate.baseSha !== manifest.candidate.headSha, 'candidate baseSha and headSha must differ');
  assertString(manifest.candidate.branch, 'manifest.candidate.branch');

  assertStringArray(manifest.changedFiles, 'manifest.changedFiles', { minItems: 1, sorted: true });

  assertObject(manifest.impact, 'manifest.impact');
  assert(['none', 'targeted', 'full'].includes(manifest.impact.mode), 'manifest.impact.mode is invalid');
  assert(typeof manifest.impact.escalated === 'boolean', 'manifest.impact.escalated must be boolean');
  assertStringArray(manifest.impact.domains, 'manifest.impact.domains', { sorted: true });
  assertStringArray(manifest.impact.verificationIds, 'manifest.impact.verificationIds', { sorted: true });
  assertStringArray(manifest.impact.unknownFiles, 'manifest.impact.unknownFiles', { sorted: true });
  assertStringArray(manifest.impact.escalationReasons, 'manifest.impact.escalationReasons', { sorted: true });
  assert((manifest.impact.mode === 'full') === manifest.impact.escalated, 'full impact mode must match escalation state');

  assert(Array.isArray(manifest.requiredProofs), 'manifest.requiredProofs must be an array');
  const proofIds = new Set();
  for (const proof of manifest.requiredProofs) {
    assertObject(proof, 'manifest.requiredProof');
    assertString(proof.id, 'manifest.requiredProof.id');
    assert(!proofIds.has(proof.id), `duplicate manifest proof id ${proof.id}`);
    proofIds.add(proof.id);
    assert(PROOF_KINDS.has(proof.kind), `manifest proof ${proof.id} has unsupported kind ${proof.kind}`);
    assert(proof.required === true, `manifest proof ${proof.id} must be required`);
    assertString(proof.description, `manifest proof ${proof.id}.description`);
    if (proof.command !== undefined) assertString(proof.command, `manifest proof ${proof.id}.command`);
  }

  assertStringArray(manifest.externalQaRefs, 'manifest.externalQaRefs', { sorted: true });
  return {
    taskId: manifest.task.id,
    candidateSha: manifest.candidate.headSha,
    changedFileCount: manifest.changedFiles.length,
    requiredProofCount: manifest.requiredProofs.length,
    manifestSha256: sha256Value(manifest),
  };
}

export function buildVerificationLedger({
  manifest,
  passedKinds = [],
  workflow,
  runId,
  job,
  artifacts = [],
  unresolvedExternalQa = [],
}) {
  const summary = validateCandidateManifest(manifest);
  const passKinds = new Set(passedKinds);
  for (const kind of passKinds) assert(PROOF_KINDS.has(kind), `unsupported pass kind ${kind}`);

  const proofEvidence = manifest.requiredProofs.map(proof => ({
    proofId: proof.id,
    kind: proof.kind,
    status: passKinds.has(proof.kind) ? 'passed' : 'pending',
    candidateSha: manifest.candidate.headSha,
    source: passKinds.has(proof.kind)
      ? {
          type: 'ci',
          workflow,
          runId,
          job,
        }
      : {
          type: proof.kind === 'external' ? 'external' : proof.kind === 'invariant' ? 'invariant' : proof.kind === 'review' ? 'review' : proof.kind === 'artifact' ? 'artifact' : 'command',
          notes: 'Evidence has not been recorded yet.',
        },
  }));

  const ledger = {
    $schema: 'agent/verification-ledger.schema.json',
    schemaVersion: 1,
    repository: manifest.repository,
    taskId: manifest.task.id,
    candidateSha: manifest.candidate.headSha,
    manifestSha256: summary.manifestSha256,
    proofEvidence,
    artifacts,
    unresolvedExternalQa,
  };
  validateVerificationLedger(manifest, ledger, { allowIncomplete: true });
  return ledger;
}

function validateEvidenceSource(source, label) {
  assertObject(source, label);
  assert(SOURCE_TYPES.has(source.type), `${label}.type is invalid`);
  if (source.command !== undefined) assertString(source.command, `${label}.command`);
  if (source.workflow !== undefined) assertString(source.workflow, `${label}.workflow`);
  if (source.runId !== undefined) assert(Number.isInteger(source.runId) && source.runId > 0, `${label}.runId must be a positive integer`);
  if (source.job !== undefined) assertString(source.job, `${label}.job`);
  if (source.artifactName !== undefined) assertString(source.artifactName, `${label}.artifactName`);
  if (source.notes !== undefined) assertString(source.notes, `${label}.notes`);
  if (source.type === 'ci') {
    assertString(source.workflow, `${label}.workflow`);
    assert(Number.isInteger(source.runId) && source.runId > 0, `${label}.runId must be a positive integer`);
  }
}

export function validateVerificationLedger(manifest, ledger, { allowIncomplete = false } = {}) {
  const manifestSummary = validateCandidateManifest(manifest);
  assertObject(ledger, 'verification ledger');
  assert(ledger.schemaVersion === 1, 'verification ledger schemaVersion must be 1');
  assert(ledger.repository === manifest.repository, 'ledger repository does not match manifest');
  assert(ledger.taskId === manifest.task.id, 'ledger taskId does not match manifest');
  assert(ledger.candidateSha === manifest.candidate.headSha, 'ledger candidateSha does not match manifest candidate');
  assert(ledger.manifestSha256 === manifestSummary.manifestSha256, 'ledger manifestSha256 does not match canonical manifest digest');

  assert(Array.isArray(ledger.proofEvidence), 'ledger.proofEvidence must be an array');
  const proofsById = new Map(manifest.requiredProofs.map(proof => [proof.id, proof]));
  const evidenceById = new Map();
  for (const evidence of ledger.proofEvidence) {
    assertObject(evidence, 'ledger proof evidence');
    assertString(evidence.proofId, 'ledger evidence.proofId');
    assert(proofsById.has(evidence.proofId), `ledger references unknown proof ${evidence.proofId}`);
    assert(!evidenceById.has(evidence.proofId), `ledger has duplicate evidence for proof ${evidence.proofId}`);
    evidenceById.set(evidence.proofId, evidence);
    assert(evidence.kind === proofsById.get(evidence.proofId).kind, `ledger proof kind mismatch for ${evidence.proofId}`);
    assert(EVIDENCE_STATUSES.has(evidence.status), `ledger proof ${evidence.proofId} has invalid status ${evidence.status}`);
    assert(evidence.candidateSha === manifest.candidate.headSha, `ledger proof ${evidence.proofId} is evidence for a different candidate SHA`);
    validateEvidenceSource(evidence.source, `ledger proof ${evidence.proofId}.source`);
  }

  const incompleteProofs = [];
  for (const proof of manifest.requiredProofs) {
    const evidence = evidenceById.get(proof.id);
    if (!evidence || evidence.status !== 'passed') incompleteProofs.push(proof.id);
  }
  if (!allowIncomplete) assert(incompleteProofs.length === 0, `required proofs are incomplete: ${incompleteProofs.join(', ')}`);

  assert(Array.isArray(ledger.artifacts), 'ledger.artifacts must be an array');
  const artifactNames = new Set();
  for (const artifact of ledger.artifacts) {
    assertObject(artifact, 'ledger artifact');
    assertString(artifact.name, 'ledger artifact.name');
    assert(!artifactNames.has(artifact.name), `duplicate ledger artifact ${artifact.name}`);
    artifactNames.add(artifact.name);
    assertString(artifact.kind, `ledger artifact ${artifact.name}.kind`);
    assert(artifact.candidateSha === manifest.candidate.headSha, `artifact ${artifact.name} is for a different candidate SHA`);
    if (artifact.sha256 !== undefined) assert(SHA256_PATTERN.test(artifact.sha256), `artifact ${artifact.name}.sha256 must be SHA-256`);
    if (artifact.location !== undefined) assertString(artifact.location, `artifact ${artifact.name}.location`);
  }

  assert(Array.isArray(ledger.unresolvedExternalQa), 'ledger.unresolvedExternalQa must be an array');
  const externalQaIds = new Set();
  for (const item of ledger.unresolvedExternalQa) {
    assertObject(item, 'ledger unresolved external QA');
    assertString(item.id, 'ledger unresolved external QA.id');
    assert(!externalQaIds.has(item.id), `duplicate unresolved external QA ${item.id}`);
    externalQaIds.add(item.id);
    assertString(item.status, `ledger unresolved external QA ${item.id}.status`);
    assertString(item.reference, `ledger unresolved external QA ${item.id}.reference`);
  }

  return {
    taskId: ledger.taskId,
    candidateSha: ledger.candidateSha,
    complete: incompleteProofs.length === 0,
    incompleteProofs,
    proofCount: ledger.proofEvidence.length,
    artifactCount: ledger.artifacts.length,
    unresolvedExternalQaCount: ledger.unresolvedExternalQa.length,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, canonicalJson(value), 'utf8');
}

function parseList(value) {
  return value ? value.split(',').map(entry => entry.trim()).filter(Boolean) : [];
}

function parseArguments(argv) {
  const options = {
    operation: null,
    taskId: null,
    base: null,
    head: null,
    branch: null,
    repository: 'papa4568/ironshade-vector',
    manifest: null,
    ledger: null,
    output: null,
    json: false,
    verifyGit: false,
    allowIncomplete: false,
    passKinds: [],
    workflow: null,
    runId: null,
    job: null,
    externalQaRefs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (['manifest', 'ledger', 'validate'].includes(argument) && options.operation === null) options.operation = argument;
    else if (argument === '--task') options.taskId = argv[++index] ?? null;
    else if (argument === '--base') options.base = argv[++index] ?? null;
    else if (argument === '--head') options.head = argv[++index] ?? null;
    else if (argument === '--branch') options.branch = argv[++index] ?? null;
    else if (argument === '--repository') options.repository = argv[++index] ?? null;
    else if (argument === '--manifest') options.manifest = argv[++index] ?? null;
    else if (argument === '--ledger') options.ledger = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--pass-kinds') options.passKinds = parseList(argv[++index] ?? '');
    else if (argument === '--workflow') options.workflow = argv[++index] ?? null;
    else if (argument === '--run-id') options.runId = Number(argv[++index]);
    else if (argument === '--job') options.job = argv[++index] ?? null;
    else if (argument === '--external-qa') options.externalQaRefs = parseList(argv[++index] ?? '');
    else if (argument === '--json') options.json = true;
    else if (argument === '--verify-git') options.verifyGit = true;
    else if (argument === '--allow-incomplete') options.allowIncomplete = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function generateManifest(options) {
  assertString(options.taskId, '--task');
  assertString(options.base, '--base');
  assertString(options.head, '--head');
  assertString(options.branch, '--branch');
  assertString(options.repository, '--repository');

  const baseSha = resolveGitSha(options.base);
  const headSha = resolveGitSha(options.head);
  const changedFiles = collectCandidateChangedFiles({ base: baseSha, head: headSha });
  assert(changedFiles.length > 0, 'candidate diff contains no changed files');
  const { task, source } = await loadCandidateTask(options.taskId);
  const impactMap = await loadImpactMap();
  const impactSelection = selectAffectedVerification(changedFiles, impactMap);
  return buildCandidateManifest({
    repository: options.repository,
    task,
    taskSource: source,
    baseSha,
    headSha,
    branch: options.branch,
    changedFiles,
    impactSelection,
    externalQaRefs: options.externalQaRefs,
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.operation === 'manifest') {
    const manifest = await generateManifest(options);
    const summary = validateCandidateManifest(manifest);
    if (options.output) await writeJson(options.output, manifest);
    if (options.json || !options.output) console.log(canonicalJson(manifest).trimEnd());
    console.error(`CANDIDATE_MANIFEST_VALID task=${summary.taskId} candidate=${summary.candidateSha} files=${summary.changedFileCount} proofs=${summary.requiredProofCount} sha256=${summary.manifestSha256}`);
    return;
  }

  if (options.operation === 'ledger') {
    assertString(options.manifest, '--manifest');
    assertString(options.workflow, '--workflow');
    assert(Number.isInteger(options.runId) && options.runId > 0, '--run-id must be a positive integer');
    assertString(options.job, '--job');
    const manifest = await readJson(options.manifest);
    const ledger = buildVerificationLedger({
      manifest,
      passedKinds: options.passKinds,
      workflow: options.workflow,
      runId: options.runId,
      job: options.job,
    });
    const summary = validateVerificationLedger(manifest, ledger, { allowIncomplete: options.allowIncomplete });
    if (options.output) await writeJson(options.output, ledger);
    if (options.json || !options.output) console.log(canonicalJson(ledger).trimEnd());
    console.error(`VERIFICATION_LEDGER_VALID task=${summary.taskId} candidate=${summary.candidateSha} complete=${summary.complete} proofs=${summary.proofCount} artifacts=${summary.artifactCount} externalQa=${summary.unresolvedExternalQaCount}`);
    return;
  }

  if (options.operation === 'validate') {
    assertString(options.manifest, '--manifest');
    const manifest = await readJson(options.manifest);
    const manifestSummary = validateCandidateManifest(manifest);
    if (options.verifyGit) {
      const actualFiles = collectCandidateChangedFiles({
        base: manifest.candidate.baseSha,
        head: manifest.candidate.headSha,
      });
      assert(JSON.stringify(actualFiles) === JSON.stringify(manifest.changedFiles), 'manifest changedFiles do not match the exact candidate diff');
    }
    if (!options.ledger) {
      console.log(`CANDIDATE_MANIFEST_VALID task=${manifestSummary.taskId} candidate=${manifestSummary.candidateSha} files=${manifestSummary.changedFileCount} proofs=${manifestSummary.requiredProofCount} sha256=${manifestSummary.manifestSha256}`);
      return;
    }
    const ledger = await readJson(options.ledger);
    const ledgerSummary = validateVerificationLedger(manifest, ledger, { allowIncomplete: options.allowIncomplete });
    console.log(`CANDIDATE_EVIDENCE_VALID task=${ledgerSummary.taskId} candidate=${ledgerSummary.candidateSha} complete=${ledgerSummary.complete} proofs=${ledgerSummary.proofCount} artifacts=${ledgerSummary.artifactCount} externalQa=${ledgerSummary.unresolvedExternalQaCount}`);
    return;
  }

  throw new Error('operation must be manifest, ledger, or validate');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`CANDIDATE_EVIDENCE_ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
