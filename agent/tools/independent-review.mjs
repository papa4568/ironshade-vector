import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  collectCandidateChangedFiles,
  loadCandidateTask,
  sha256Value,
  validateCandidateManifest,
} from './candidate-evidence.mjs';
import {
  evaluateArchitectureInvariants,
  loadArchitectureInvariantConfig,
} from './check-architecture-invariants.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

export function buildIndependentReviewPacket({ manifest, task, architectureResults }) {
  validateCandidateManifest(manifest);
  assert(sha256Value(task.acceptance) === manifest.task.acceptanceDigest, 'review packet task acceptance does not match candidate manifest');
  assert(Array.isArray(architectureResults) && architectureResults.every(result => result.status === 'passed'), 'architecture invariants must pass before independent review');

  return {
    schemaVersion: 1,
    taskId: manifest.task.id,
    candidateSha: manifest.candidate.headSha,
    branch: manifest.candidate.branch,
    mode: 'read-only-adversarial',
    mutationsAllowed: false,
    changedFiles: [...manifest.changedFiles],
    impact: manifest.impact,
    acceptance: task.acceptance.map((text, index) => ({ index, text })),
    requiredProofs: manifest.requiredProofs.map(proof => ({ ...proof })),
    architectureInvariants: architectureResults.map(result => ({ id: result.id, status: result.status, file: result.file, type: result.type })),
    verifierInstructions: [
      'Do not modify repository files, branches, pull requests, workflow state, or artifacts.',
      'Try to disprove completion rather than improve or reimplement the solution.',
      'Check every acceptance criterion against the candidate diff and available evidence.',
      'Challenge test adequacy, scope, exact-SHA provenance, and architecture-boundary assumptions.',
      'Return fail when a required claim is unsupported; implementation fixes belong to the writer on the same branch.',
    ],
    adversarialQuestions: [
      'Does every acceptance criterion have concrete evidence in this exact candidate?',
      'Do the changed files contain unrelated scope or omit files necessary for the claimed behavior?',
      'Could the impact selection or proof set under-test a changed behavior?',
      'Are all credited proofs and artifacts tied to the exact candidate SHA?',
      'Could this change violate a stable architecture boundary even if tests pass?',
      'Is any unresolved technical failure being mislabeled as external or complete?',
    ],
  };
}

export function validateIndependentReviewPacket(packet) {
  assert(packet && typeof packet === 'object' && !Array.isArray(packet), 'independent review packet must be an object');
  assert(packet.schemaVersion === 1, 'review packet schemaVersion must be 1');
  assertString(packet.taskId, 'review packet taskId');
  assert(/^[a-f0-9]{40}$/.test(packet.candidateSha), 'review packet candidateSha must be a full lowercase SHA');
  assertString(packet.branch, 'review packet branch');
  assert(packet.mode === 'read-only-adversarial', 'review packet mode must be read-only-adversarial');
  assert(packet.mutationsAllowed === false, 'independent review must prohibit mutations');
  assert(Array.isArray(packet.changedFiles) && packet.changedFiles.length > 0, 'review packet changedFiles must not be empty');
  assert(Array.isArray(packet.acceptance) && packet.acceptance.length > 0, 'review packet acceptance must not be empty');
  assert(Array.isArray(packet.requiredProofs) && packet.requiredProofs.length > 0, 'review packet requiredProofs must not be empty');
  assert(Array.isArray(packet.architectureInvariants) && packet.architectureInvariants.length > 0, 'review packet architectureInvariants must not be empty');
  assert(packet.architectureInvariants.every(item => item.status === 'passed'), 'review packet may only be emitted after architecture invariants pass');
  assert(Array.isArray(packet.verifierInstructions) && packet.verifierInstructions.length >= 4, 'review packet verifierInstructions are incomplete');
  assert(Array.isArray(packet.adversarialQuestions) && packet.adversarialQuestions.length >= 4, 'review packet adversarialQuestions are incomplete');
  return { taskId: packet.taskId, candidateSha: packet.candidateSha };
}

export function validateIndependentReviewResult(packet, result) {
  validateIndependentReviewPacket(packet);
  assert(result && typeof result === 'object' && !Array.isArray(result), 'independent review result must be an object');
  assert(result.schemaVersion === 1, 'review result schemaVersion must be 1');
  assert(result.taskId === packet.taskId, 'review result taskId does not match packet');
  assert(result.candidateSha === packet.candidateSha, 'review result candidateSha does not match packet');
  assert(result.mode === 'read-only-adversarial', 'review result must use read-only-adversarial mode');
  assert(['pass', 'fail'].includes(result.verdict), 'review result verdict must be pass or fail');
  assert(Array.isArray(result.acceptanceChecks), 'review result acceptanceChecks must be an array');
  assert(Array.isArray(result.proofChecks), 'review result proofChecks must be an array');
  assert(Array.isArray(result.findings), 'review result findings must be an array');

  const acceptanceByIndex = new Map(result.acceptanceChecks.map(check => [check.index, check]));
  for (const criterion of packet.acceptance) {
    const check = acceptanceByIndex.get(criterion.index);
    assert(check, `review result is missing acceptance check ${criterion.index}`);
    assert(['satisfied', 'not_satisfied'].includes(check.status), `acceptance check ${criterion.index} has invalid status`);
    assertString(check.notes, `acceptance check ${criterion.index}.notes`);
  }
  assert(acceptanceByIndex.size === packet.acceptance.length, 'review result contains unknown or duplicate acceptance checks');

  const proofById = new Map(result.proofChecks.map(check => [check.proofId, check]));
  for (const proof of packet.requiredProofs) {
    const check = proofById.get(proof.id);
    assert(check, `review result is missing proof check ${proof.id}`);
    assert(['credible', 'insufficient'].includes(check.status), `proof check ${proof.id} has invalid status`);
    assertString(check.notes, `proof check ${proof.id}.notes`);
  }
  assert(proofById.size === packet.requiredProofs.length, 'review result contains unknown or duplicate proof checks');

  for (const [index, finding] of result.findings.entries()) {
    assert(finding && typeof finding === 'object' && !Array.isArray(finding), `finding ${index} must be an object`);
    assert(['blocking', 'major', 'minor'].includes(finding.severity), `finding ${index} has invalid severity`);
    assertString(finding.summary, `finding ${index}.summary`);
    assert(Array.isArray(finding.evidence) && finding.evidence.length > 0, `finding ${index}.evidence must not be empty`);
    finding.evidence.forEach((entry, evidenceIndex) => assertString(entry, `finding ${index}.evidence[${evidenceIndex}]`));
  }

  const acceptanceFailed = result.acceptanceChecks.some(check => check.status !== 'satisfied');
  const proofFailed = result.proofChecks.some(check => check.status !== 'credible');
  const severeFinding = result.findings.some(finding => finding.severity === 'blocking' || finding.severity === 'major');
  if (result.verdict === 'pass') {
    assert(!acceptanceFailed, 'pass verdict cannot contain unsatisfied acceptance criteria');
    assert(!proofFailed, 'pass verdict cannot contain insufficient required proofs');
    assert(!severeFinding, 'pass verdict cannot contain blocking or major findings');
  } else {
    assert(acceptanceFailed || proofFailed || result.findings.length > 0, 'fail verdict must identify at least one unsupported claim or finding');
  }
  return { verdict: result.verdict, findingCount: result.findings.length };
}

async function createPacket({ manifest, output, verifyGit }) {
  assertString(manifest, '--manifest');
  assertString(output, '--output');
  const candidateManifest = JSON.parse(await readFile(manifest, 'utf8'));
  validateCandidateManifest(candidateManifest);
  if (verifyGit) {
    const changedFiles = collectCandidateChangedFiles({ base: candidateManifest.candidate.baseSha, head: candidateManifest.candidate.headSha });
    assert(JSON.stringify(changedFiles) === JSON.stringify(candidateManifest.changedFiles), 'review packet manifest changed files do not match the exact git candidate diff');
  }
  const { task } = await loadCandidateTask(candidateManifest.task.id);
  const architectureConfig = await loadArchitectureInvariantConfig();
  const architectureResults = await evaluateArchitectureInvariants(architectureConfig);
  const packet = buildIndependentReviewPacket({ manifest: candidateManifest, task, architectureResults });
  validateIndependentReviewPacket(packet);
  await writeFile(output, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  console.log(`INDEPENDENT_REVIEW_PACKET_PASS task=${packet.taskId} candidate=${packet.candidateSha} acceptance=${packet.acceptance.length} proofs=${packet.requiredProofs.length} invariants=${packet.architectureInvariants.length}`);
}

async function validateResult({ packet, result }) {
  assertString(packet, '--packet');
  assertString(result, '--result');
  const reviewPacket = JSON.parse(await readFile(packet, 'utf8'));
  const reviewResult = JSON.parse(await readFile(result, 'utf8'));
  const summary = validateIndependentReviewResult(reviewPacket, reviewResult);
  console.log(`INDEPENDENT_REVIEW_RESULT_${summary.verdict.toUpperCase()} findings=${summary.findingCount}`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--verify-git') options.verifyGit = true;
    else if (arg.startsWith('--')) options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = args[++index];
    else throw new Error(`unknown argument ${arg}`);
  }
  if (command === 'packet') return createPacket(options);
  if (command === 'validate-result') return validateResult(options);
  throw new Error('usage: independent-review.mjs packet --manifest <path> --output <path> [--verify-git] | validate-result --packet <path> --result <path>');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
