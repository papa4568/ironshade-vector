import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  runAntibodyPromotionGate,
  validateAntibodyPromotionPolicy,
} from '../tools/antibody-promotion.mjs';
import { sha256Value } from '../tools/repository-immune-system.mjs';

const policy = JSON.parse(await readFile(new URL('../antibody-promotion-policy.json', import.meta.url), 'utf8'));
const governancePolicy = JSON.parse(await readFile(new URL('../antibody-governance-policy.json', import.meta.url), 'utf8'));
const ev12Corpus = JSON.parse(await readFile(new URL('../failure-recurrence-calibration-corpus.json', import.meta.url), 'utf8'));
const memory = JSON.parse(await readFile(new URL('../failure-memory.json', import.meta.url), 'utf8'));
const decision = JSON.parse(await readFile(new URL('../antibody-decisions/candidate-artifact-integrity-drift-r1.json', import.meta.url), 'utf8'));

validateAntibodyPromotionPolicy(policy);
const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const report = await runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, memory, decision, { candidateSha });
assert.equal(report.mode, 'enforced');
assert.equal(report.enforcementEnabled, true);
assert.equal(report.blocking, true);
assert.equal(report.enforcementContractPass, true);
assert.equal(report.wouldBlock, false);
assert.equal(report.baseline.accepted, true);
assert.deepEqual(report.calibration.measuredErrors, { falsePositives: 0, falseNegatives: 0 });
assert.equal(report.calibration.benignControl.accepted, true);
assert.equal(report.calibration.dishonestMutations.every(entry => entry.detected), true);
assert.equal(report.decisionIntentValidated, true);
assert.equal(report.trustedReviewAuthorizationRequired, true);
assert.equal(report.trustedReviewAuthorized, false);
assert.equal(report.rollback.failureHistoryUnchanged, true);
assert.equal(report.rollback.existingCandidateArtifactCheckStillRequired, true);
assert.equal(report.rollback.unrelatedAcceptanceSemanticsChanged, false);
assert.equal(report.candidatePassGranted, false);

const rollback = await runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, memory, decision, {
  candidateSha,
  enforcementOverride: false,
});
assert.equal(rollback.mode, 'advisory-rollback');
assert.equal(rollback.enforcementEnabled, false);
assert.equal(rollback.blocking, false);
assert.equal(rollback.enforcementContractPass, true);
assert.deepEqual(rollback.calibration.measuredErrors, report.calibration.measuredErrors);
assert.equal(rollback.failureMemorySha256, sha256Value(memory));

const sourceUrl = new URL('./candidate-artifact.mjs', import.meta.url);
const sourceText = await readFile(sourceUrl, 'utf8');
const regressedSource = sourceText.replaceAll('candidate-sha-match', 'candidate-sha-mismatch');
const regressed = await runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, memory, decision, {
  candidateSha,
  readText: async path => path === 'agent/tests/candidate-artifact.mjs' ? regressedSource : readFile(path, 'utf8'),
});
assert.equal(regressed.baseline.accepted, false);
assert.equal(regressed.wouldBlock, true);
assert.equal(regressed.blocking, true);

const regressedRollback = await runAntibodyPromotionGate(policy, governancePolicy, ev12Corpus, memory, decision, {
  candidateSha,
  enforcementOverride: false,
  readText: async path => path === 'agent/tests/candidate-artifact.mjs' ? regressedSource : readFile(path, 'utf8'),
});
assert.equal(regressedRollback.baseline.accepted, false);
assert.equal(regressedRollback.wouldBlock, true);
assert.equal(regressedRollback.blocking, false);

const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const probeRoot = await mkdtemp(join(tmpdir(), 'ironshade-ev14-rollback-probe-'));
const probeRepository = join(probeRoot, 'repo');
try {
  execFileSync('git', ['clone', '--local', '--no-hardlinks', '--no-checkout', repositoryRoot, probeRepository], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  execFileSync('git', ['-C', probeRepository, 'checkout', '--detach', candidateSha], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  execFileSync('git', ['-C', probeRepository, 'remote', 'remove', 'origin'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await symlink(join(repositoryRoot, 'node_modules'), join(probeRepository, 'node_modules'), 'dir');
  await writeFile(join(probeRepository, 'agent/tests/candidate-artifact.mjs'), regressedSource, 'utf8');

  let enforcedProbeError = null;
  try {
    execFileSync(process.execPath, ['agent/tests/candidate-artifact.mjs'], {
      cwd: probeRepository,
      env: { ...process.env, IRONSHADE_ANTIBODY_ENFORCEMENT: '1' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    enforcedProbeError = error;
  }
  assert(enforcedProbeError, 'regressed canonical candidate-artifact check must fail while EV-14 enforcement is enabled');
  assert.match(
    `${enforcedProbeError.stderr ?? ''}${enforcedProbeError.stdout ?? ''}`,
    /EV-14 promoted candidate-artifact antibody must pass while enforcement is enabled/,
    'enforced rollback probe must fail specifically on the promoted EV-14 source contract',
  );

  const rollbackProbeOutput = execFileSync(process.execPath, ['agent/tests/candidate-artifact.mjs'], {
    cwd: probeRepository,
    env: { ...process.env, IRONSHADE_ANTIBODY_ENFORCEMENT: '0' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(rollbackProbeOutput, /ev14=rollback-advisory/, 'canonical candidate-artifact check must become advisory under EV-14 rollback');
  assert.equal(await readFile(sourceUrl, 'utf8'), sourceText, 'EV-14 rollback probe must not mutate the source repository');
} finally {
  await rm(probeRoot, { recursive: true, force: true });
}

console.log(`ANTIBODY_PROMOTION_TEST_PASS candidate=${candidateSha} truth=${report.selectedTruthId} falsePositives=0 falseNegatives=0 rollback=canonical-nonblocking recurrence=blocked`);
