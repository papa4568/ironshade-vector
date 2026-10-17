import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
  analyzeHistoryForProof,
  buildObservationReport,
  buildPrediction,
  computeClosure,
  validateHistoryAgainstGit,
  validateProofCacheHistory,
  validateProofCachePolicy,
} from '../tools/causal-proof-cache.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function commitFile(cwd, path, content, message) {
  const fullPath = join(cwd, path);
  await mkdir(resolve(fullPath, '..'), { recursive: true });
  await writeFile(fullPath, content);
  git(cwd, 'add', path);
  git(cwd, 'commit', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

function observationFromClosure(closure, { id, outcome = 'success', workflowRunId = '1001' }) {
  return {
    id,
    source: 'candidate-rerun',
    proofId: closure.proofId,
    candidateSha: closure.candidateSha,
    repositoryDigest: closure.repositoryDigest,
    executionContextDigest: closure.executionContextDigest,
    closureDigest: closure.closureDigest,
    outcome,
    workflowRunId,
  };
}

const repositoryPolicy = validateProofCachePolicy(JSON.parse(await readFile(resolve('agent/proof-cache.json'), 'utf8')));
assert.equal(repositoryPolicy.mode, 'shadow');
assert.equal(repositoryPolicy.proofClasses[0].expensive, true);
validateProofCacheHistory(JSON.parse(await readFile(resolve('agent/proof-cache-history.json'), 'utf8')));

const fixture = await mkdtemp(join(tmpdir(), 'ironshade-proof-cache-'));
try {
  git(fixture, 'init');
  git(fixture, 'config', 'user.email', 'proof-cache@example.invalid');
  git(fixture, 'config', 'user.name', 'Proof Cache Test');
  await commitFile(fixture, 'src/app.js', 'export const value = 1;\n', 'initial source');
  await commitFile(fixture, 'package.json', '{"scripts":{"build":"echo build"}}\n', 'add package');
  await commitFile(fixture, 'agent/note.txt', 'baseline\n', 'add excluded agent note');

  const policy = validateProofCachePolicy({
    schemaVersion: 1,
    mode: 'shadow',
    proofClasses: [{
      id: 'expensive-build',
      command: 'npm run build',
      expensive: true,
      repositoryClosure: {
        strategy: 'all-tracked-except',
        excludedPrefixes: ['agent/', 'docs/', '.github/', 'android/'],
        excludedFiles: [],
      },
      runtimeClosure: {
        runnerLabel: 'ubuntu-24.04',
        captureNode: true,
        captureNpm: true,
        capturePlatform: true,
        environmentVariables: ['VITE_API_BASE_URL'],
      },
    }],
  });
  const executionContext = {
    runnerLabel: 'ubuntu-24.04',
    node: 'v22.23.2',
    npm: '10.9.8',
    platform: 'linux',
    arch: 'x64',
    env: {
      VITE_API_BASE_URL: { present: true, valueSha256: '1'.repeat(64) },
    },
  };

  const baselineSha = git(fixture, 'rev-parse', 'HEAD');
  const baselineClosure = computeClosure({ policy, proofId: 'expensive-build', revision: baselineSha, cwd: fixture, executionContext });
  const baselineHistory = validateProofCacheHistory({
    schemaVersion: 1,
    mode: 'shadow',
    observations: [observationFromClosure(baselineClosure, { id: 'baseline' })],
  });
  validateHistoryAgainstGit({ policy, history: baselineHistory, cwd: fixture });

  const excludedSha = await commitFile(fixture, 'agent/note.txt', 'changed but excluded\n', 'change excluded input');
  const excludedClosure = computeClosure({ policy, proofId: 'expensive-build', revision: excludedSha, cwd: fixture, executionContext });
  assert.equal(excludedClosure.repositoryDigest, baselineClosure.repositoryDigest, 'excluded repository changes must not perturb the causal repository digest');
  assert.equal(excludedClosure.closureDigest, baselineClosure.closureDigest, 'unchanged causal inputs must preserve the full closure digest');

  const safePrediction = buildPrediction({
    policy,
    history: baselineHistory,
    proofId: 'expensive-build',
    revision: excludedSha,
    cwd: fixture,
    executionContext,
  });
  assert.equal(safePrediction.reuseWouldBeSafe, true);
  assert.deepEqual(safePrediction.history.matchingObservationIds, ['baseline']);
  assert.equal(Object.hasOwn(safePrediction, 'changedFiles'), false, 'reuse prediction must not depend on changed-file similarity');
  const agreeingReport = buildObservationReport({ prediction: safePrediction, outcome: 'success', workflowRunId: '1002' });
  assert.equal(agreeingReport.comparison.agreement, true);
  assert.equal(agreeingReport.reuseState.disabled, false);
  assert.equal(agreeingReport.proofActuallyRerun, true);
  assert.equal(agreeingReport.acceptedForReuse, false);
  assert.equal(agreeingReport.candidatePassGranted, false);

  const changedSha = await commitFile(fixture, 'src/app.js', 'export const value = 2;\n', 'change causal source');
  const changedClosure = computeClosure({ policy, proofId: 'expensive-build', revision: changedSha, cwd: fixture, executionContext });
  assert.notEqual(changedClosure.repositoryDigest, baselineClosure.repositoryDigest, 'causal repository changes must invalidate the digest');
  assert.notEqual(changedClosure.closureDigest, baselineClosure.closureDigest, 'causal repository changes must invalidate the full closure digest');
  const changedPrediction = buildPrediction({
    policy,
    history: baselineHistory,
    proofId: 'expensive-build',
    revision: changedSha,
    cwd: fixture,
    executionContext,
  });
  assert.equal(changedPrediction.reuseWouldBeSafe, false);

  const contextChanged = computeClosure({
    policy,
    proofId: 'expensive-build',
    revision: excludedSha,
    cwd: fixture,
    executionContext: { ...executionContext, node: 'v22.24.0' },
  });
  assert.equal(contextChanged.repositoryDigest, baselineClosure.repositoryDigest);
  assert.notEqual(contextChanged.closureDigest, baselineClosure.closureDigest, 'runtime/toolchain changes must invalidate the closure digest');

  const conflictingHistory = validateProofCacheHistory({
    schemaVersion: 1,
    mode: 'shadow',
    observations: [
      observationFromClosure(baselineClosure, { id: 'baseline', outcome: 'success', workflowRunId: '1001' }),
      observationFromClosure(excludedClosure, { id: 'conflict', outcome: 'failure', workflowRunId: '1002' }),
    ],
  });
  const conflictAnalysis = analyzeHistoryForProof({ proofId: 'expensive-build', closure: excludedClosure, history: conflictingHistory });
  assert.equal(conflictAnalysis.proofDisabled, true, 'same-closure outcome disagreement must disable reuse for the proof class');
  const conflictPrediction = buildPrediction({
    policy,
    history: conflictingHistory,
    proofId: 'expensive-build',
    revision: excludedSha,
    cwd: fixture,
    executionContext,
  });
  assert.equal(conflictPrediction.reuseWouldBeSafe, false);
  assert.equal(conflictPrediction.history.proofDisabled, true);

  const failureReport = buildObservationReport({ prediction: safePrediction, outcome: 'failure', workflowRunId: '1003' });
  assert.equal(failureReport.comparison.disagreement, true);
  assert.equal(failureReport.reuseState.disabled, true, 'a real-rerun disagreement must automatically disable reuse');
  assert.match(failureReport.reuseState.reason, /real rerun was failure/);

  const tamperedHistory = structuredClone(baselineHistory);
  tamperedHistory.observations[0].repositoryDigest = '0'.repeat(64);
  assert.throws(
    () => validateHistoryAgainstGit({ policy, history: tamperedHistory, cwd: fixture }),
    /repository digest does not match/,
    'history cannot claim a repository closure digest that the exact SHA does not produce',
  );

  console.log('CAUSAL_PROOF_CACHE_TEST_PASS stableExcluded=pass causalInvalidation=pass runtimeInvalidation=pass realRerunAgreement=pass disagreementDisables=pass historyExactSha=pass changedFileSimilarity=unused mode=shadow');
} finally {
  await rm(fixture, { recursive: true, force: true });
}
