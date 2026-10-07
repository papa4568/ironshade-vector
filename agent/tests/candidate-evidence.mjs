import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildCandidateManifest,
  buildVerificationLedger,
  canonicalJson,
  collectCandidateChangedFiles,
  resolveGitSha,
  sha256Value,
  validateCandidateManifest,
  validateVerificationLedger,
} from '../tools/candidate-evidence.mjs';

const BASE_SHA = '1111111111111111111111111111111111111111';
const HEAD_SHA = '2222222222222222222222222222222222222222';

const fixtureTask = {
  id: 'AO-TEST',
  title: 'Candidate evidence fixture',
  acceptance: ['the manifest is exact', 'the ledger cannot cross candidate revisions'],
  affectedDomains: ['verification', 'artifacts'],
  proofs: [
    {
      id: 'fixture-tests',
      kind: 'test',
      required: true,
      description: 'Fixture tests pass.',
      command: 'node fixture.mjs',
    },
    {
      id: 'fixture-ci',
      kind: 'ci',
      required: true,
      description: 'Fixture CI passes on the exact candidate.',
    },
  ],
};

const fixtureImpact = {
  mode: 'targeted',
  escalated: false,
  domains: ['verification'],
  verifications: [{ id: 'agent-orchestration' }],
  unknownFiles: [],
  escalationReasons: [],
};

const manifest = buildCandidateManifest({
  repository: 'papa4568/ironshade-vector',
  task: fixtureTask,
  taskSource: 'fixture',
  baseSha: BASE_SHA,
  headSha: HEAD_SHA,
  branch: 'fixture/ao-test',
  changedFiles: ['agent/z.mjs', 'agent/a.mjs'],
  impactSelection: fixtureImpact,
  externalQaRefs: ['QA-2', 'QA-1'],
});

const manifestSummary = validateCandidateManifest(manifest);
assert.equal(manifestSummary.taskId, 'AO-TEST');
assert.equal(manifestSummary.candidateSha, HEAD_SHA);
assert.deepEqual(manifest.changedFiles, ['agent/a.mjs', 'agent/z.mjs']);
assert.deepEqual(manifest.externalQaRefs, ['QA-1', 'QA-2']);
assert.equal(manifest.requiredProofs.length, 2);
assert.match(manifestSummary.manifestSha256, /^[a-f0-9]{64}$/);
assert.equal(sha256Value({ b: 2, a: 1 }), sha256Value({ a: 1, b: 2 }));
assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));

const completeLedger = buildVerificationLedger({
  manifest,
  passedKinds: ['test', 'ci'],
  workflow: 'Agent Orchestration',
  runId: 12345,
  job: 'validate-agent-orchestration',
});
const completeSummary = validateVerificationLedger(manifest, completeLedger);
assert.equal(completeSummary.complete, true);
assert.equal(completeSummary.proofCount, 2);

const incompleteLedger = buildVerificationLedger({
  manifest,
  passedKinds: ['test'],
  workflow: 'Agent Orchestration',
  runId: 12345,
  job: 'validate-agent-orchestration',
});
assert.equal(validateVerificationLedger(manifest, incompleteLedger, { allowIncomplete: true }).complete, false);
assert.throws(
  () => validateVerificationLedger(manifest, incompleteLedger),
  /required proofs are incomplete: fixture-ci/,
);

const wrongCandidateEvidence = structuredClone(completeLedger);
wrongCandidateEvidence.proofEvidence[0].candidateSha = '3333333333333333333333333333333333333333';
assert.throws(
  () => validateVerificationLedger(manifest, wrongCandidateEvidence),
  /evidence for a different candidate SHA/,
);

const editedManifest = structuredClone(manifest);
editedManifest.task.title = 'Changed after proof';
assert.throws(
  () => validateVerificationLedger(editedManifest, completeLedger),
  /manifestSha256 does not match canonical manifest digest/,
);

const wrongArtifact = structuredClone(completeLedger);
wrongArtifact.artifacts.push({
  name: 'Ironshade.apk',
  kind: 'apk',
  candidateSha: '4444444444444444444444444444444444444444',
  sha256: '5'.repeat(64),
});
assert.throws(
  () => validateVerificationLedger(manifest, wrongArtifact),
  /artifact Ironshade.apk is for a different candidate SHA/,
);

const duplicateEvidence = structuredClone(completeLedger);
duplicateEvidence.proofEvidence.push(structuredClone(duplicateEvidence.proofEvidence[0]));
assert.throws(
  () => validateVerificationLedger(manifest, duplicateEvidence),
  /duplicate evidence for proof fixture-tests/,
);

const tempRoot = await mkdtemp(join(tmpdir(), 'ironshade-candidate-evidence-'));
try {
  execFileSync('git', ['init', '-q'], { cwd: tempRoot });
  execFileSync('git', ['config', 'user.email', 'agent@example.invalid'], { cwd: tempRoot });
  execFileSync('git', ['config', 'user.name', 'Agent Test'], { cwd: tempRoot });
  await writeFile(join(tempRoot, 'keep.txt'), 'one\n');
  await writeFile(join(tempRoot, 'delete.txt'), 'remove me\n');
  execFileSync('git', ['add', '.'], { cwd: tempRoot });
  execFileSync('git', ['commit', '-qm', 'base'], { cwd: tempRoot });
  const gitBase = resolveGitSha('HEAD', tempRoot);

  await writeFile(join(tempRoot, 'keep.txt'), 'two\n');
  await writeFile(join(tempRoot, 'added.txt'), 'new\n');
  execFileSync('git', ['rm', '-q', 'delete.txt'], { cwd: tempRoot });
  execFileSync('git', ['add', '.'], { cwd: tempRoot });
  execFileSync('git', ['commit', '-qm', 'head'], { cwd: tempRoot });
  const gitHead = resolveGitSha('HEAD', tempRoot);

  assert.notEqual(gitBase, gitHead);
  assert.deepEqual(
    collectCandidateChangedFiles({ base: gitBase, head: gitHead, cwd: tempRoot }),
    ['added.txt', 'delete.txt', 'keep.txt'],
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log(`CANDIDATE_EVIDENCE_TEST_PASS proofs=${manifest.requiredProofs.length} manifestSha256=${manifestSummary.manifestSha256} gitDiff=pass mismatchRejection=pass`);
