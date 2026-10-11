import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { cp, mkdtemp, readFile, readdir, readlink, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { resolveSandboxMutationTarget } from './acceptance-attack-compiler.mjs';

const REPORT_SCHEMA = 'ironshade-acceptance-attack-runtime-calibration:v1';
const SHA_RE = /^[a-f0-9]{40}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function runGit(args, cwd, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function pathInside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function buildVerifierEnvironment(sandbox, sourceRoot) {
  const environment = {};
  for (const key of ['HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'LC_CTYPE']) {
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0 && !value.includes(sourceRoot)) environment[key] = value;
  }

  const pathEntries = (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .filter(entry => !pathInside(sourceRoot, resolve(entry)));
  assert(pathEntries.length > 0, 'runtime calibration verifier PATH must retain at least one source-independent entry');

  environment.PATH = pathEntries.join(delimiter);
  environment.PWD = sandbox;
  environment.INIT_CWD = sandbox;
  environment.GITHUB_WORKSPACE = sandbox;
  environment.CI = '1';
  environment.IRONSHADE_ACCEPTANCE_ATTACK = '1';

  for (const [key, value] of Object.entries(environment)) {
    if (key === 'PATH') continue;
    assert(!value.includes(sourceRoot), `runtime calibration verifier environment ${key} must not expose the source repository path`);
  }
  return environment;
}

function runCommand(command, cwd, environment) {
  const result = spawnSync(command, {
    cwd,
    encoding: 'utf8',
    shell: true,
    env: environment,
  });
  return {
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
    stdout: (result.stdout ?? '').slice(-12000),
    stderr: (result.stderr ?? '').slice(-12000),
  };
}

function outputText(verification) {
  return `${verification.stdout}\n${verification.stderr}`;
}

function logTrialFailure(kind, id, verification) {
  console.log(`ACCEPTANCE_ATTACK_RUNTIME_${kind}_FAIL id=${id} exit=${verification.exitCode} output=${JSON.stringify(outputText(verification).slice(-4000))}`);
}

function snapshotSourceRepository(repoRoot) {
  const head = runGit(['rev-parse', 'HEAD'], repoRoot).stdout.trim();
  const branchResult = runGit(['symbolic-ref', '--short', '-q', 'HEAD'], repoRoot, { allowFailure: true });
  const branch = branchResult.status === 0 ? branchResult.stdout.trim() : null;
  const branchRef = branch ? runGit(['rev-parse', `refs/heads/${branch}`], repoRoot).stdout.trim() : null;
  const status = runGit(['status', '--porcelain=v1', '--untracked-files=all'], repoRoot).stdout;
  return { head, branch, branchRef, statusDigest: digest(status) };
}

function assertSourceRepositoryUnchanged(before, after) {
  assert(after.head === before.head, `source HEAD changed during runtime attack calibration: ${before.head} -> ${after.head}`);
  assert(after.branch === before.branch, `source branch changed during runtime attack calibration: ${before.branch} -> ${after.branch}`);
  assert(after.branchRef === before.branchRef, `source branch ref changed during runtime attack calibration: ${before.branchRef} -> ${after.branchRef}`);
  assert(after.statusDigest === before.statusDigest, 'source working tree changed during runtime attack calibration');
}

function validateReplacement(raw, label) {
  assert(raw && typeof raw === 'object' && !Array.isArray(raw), `${label} must be an object`);
  assert(typeof raw.find === 'string' && raw.find.length > 0, `${label}.find must be non-empty`);
  assert(typeof raw.replace === 'string', `${label}.replace must be a string`);
  return raw;
}

export function validateRuntimeCalibrationConfig(raw) {
  assert(raw && typeof raw === 'object' && !Array.isArray(raw), 'runtime calibration config must be an object');
  assert(typeof raw.verifyCommand === 'string' && raw.verifyCommand.trim(), 'runtime calibration verifyCommand must be non-empty');
  assert(typeof raw.targetFile === 'string' && raw.targetFile.trim(), 'runtime calibration targetFile must be non-empty');
  assert(typeof raw.passMarker === 'string' && raw.passMarker.trim(), 'runtime calibration passMarker must be non-empty');
  assert(raw.dependencyStrategy === 'isolated-node-modules-copy', 'runtime calibration dependencyStrategy must be isolated-node-modules-copy');
  assert(Array.isArray(raw.negativeControls) && raw.negativeControls.length > 0, 'runtime calibration negativeControls must be non-empty');
  const controlIds = new Set();
  for (const [index, control] of raw.negativeControls.entries()) {
    assert(control && typeof control === 'object' && !Array.isArray(control), `negativeControls[${index}] must be an object`);
    assert(typeof control.id === 'string' && control.id.trim(), `negativeControls[${index}].id must be non-empty`);
    assert(!controlIds.has(control.id), `duplicate runtime calibration control ${control.id}`);
    controlIds.add(control.id);
    validateReplacement(control.replacement, `negativeControls[${index}].replacement`);
  }
  assert(raw.attack && typeof raw.attack === 'object' && !Array.isArray(raw.attack), 'runtime calibration attack must be an object');
  assert(typeof raw.attack.templateId === 'string' && raw.attack.templateId.trim(), 'runtime calibration attack.templateId must be non-empty');
  validateReplacement(raw.attack.replacement, 'runtime calibration attack.replacement');
  assert(Array.isArray(raw.attack.expectedFailurePatterns) && raw.attack.expectedFailurePatterns.length > 0, 'runtime calibration attack.expectedFailurePatterns must be non-empty');
  raw.attack.expectedFailurePatterns.forEach((pattern, index) => {
    assert(typeof pattern === 'string' && pattern.trim(), `runtime calibration attack.expectedFailurePatterns[${index}] must be non-empty`);
  });
  return raw;
}

async function applyReplacement(filePath, replacement) {
  const content = await readFile(filePath, 'utf8');
  const first = content.indexOf(replacement.find);
  assert(first >= 0, `runtime calibration mutation anchor was not found in ${filePath}`);
  const second = content.indexOf(replacement.find, first + replacement.find.length);
  assert(second < 0, `runtime calibration mutation anchor is ambiguous in ${filePath}`);
  const mutated = `${content.slice(0, first)}${replacement.replace}${content.slice(first + replacement.find.length)}`;
  await writeFile(filePath, mutated);
  return {
    beforeDigest: createHash('sha256').update(content).digest('hex'),
    afterDigest: createHash('sha256').update(mutated).digest('hex'),
  };
}

async function validateDependencySymlinks(root, current = root) {
  let symlinkCount = 0;
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const entryPath = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      const target = await readlink(entryPath);
      const resolvedTarget = resolve(dirname(entryPath), target);
      assert(
        pathInside(root, resolvedTarget),
        `runtime calibration dependency symlink escapes disposable clone: ${entryPath} -> ${target}`,
      );
      symlinkCount += 1;
      continue;
    }
    if (entry.isDirectory()) symlinkCount += await validateDependencySymlinks(root, entryPath);
  }
  return symlinkCount;
}

async function copySourceDependencies(sandbox, repoRoot) {
  const sourceNodeModules = await realpath(resolve(repoRoot, 'node_modules')).catch(() => null);
  assert(sourceNodeModules, 'runtime calibration requires locked dependencies installed in source node_modules');
  const sandboxNodeModules = resolve(sandbox, 'node_modules');
  await rm(sandboxNodeModules, { recursive: true, force: true });
  await cp(sourceNodeModules, sandboxNodeModules, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
    preserveTimestamps: true,
    mode: constants.COPYFILE_FICLONE,
  });
  const copied = await realpath(sandboxNodeModules);
  assert(copied === sandboxNodeModules, 'runtime calibration dependencies must materialize inside the disposable clone');
  assert(copied !== sourceNodeModules, 'runtime calibration dependencies must not resolve to source node_modules');
  const validatedSymlinks = await validateDependencySymlinks(copied);
  return {
    strategy: 'isolated-node-modules-copy',
    sourceDependencyPathDigest: createHash('sha256').update(sourceNodeModules).digest('hex'),
    sandboxDependencyPathDigest: createHash('sha256').update(copied).digest('hex'),
    writableSourceDependencyPathExposed: false,
    validatedSymlinks,
  };
}

function evaluatePassControl(verification, passMarker) {
  const markerMatched = outputText(verification).includes(passMarker);
  const passed = verification.exitCode === 0 && markerMatched;
  return {
    passed,
    falsePositive: !passed,
    markerMatched,
  };
}

export function evaluateDishonestAttack(verification, expectedFailurePatterns) {
  assert(verification && Number.isInteger(verification.exitCode), 'dishonest attack verification exitCode must be an integer');
  assert(Array.isArray(expectedFailurePatterns) && expectedFailurePatterns.length > 0, 'dishonest attack expected failure patterns must be non-empty');
  const text = outputText(verification);
  const matchedPatterns = expectedFailurePatterns.filter(pattern => text.includes(pattern));
  const detected = verification.exitCode !== 0 && matchedPatterns.length === expectedFailurePatterns.length;
  return {
    detected,
    falseNegative: !detected,
    nonZeroExit: verification.exitCode !== 0,
    matchedPatterns,
    expectedFailurePatterns: [...expectedFailurePatterns],
    failureReason: detected
      ? null
      : verification.exitCode === 0
        ? 'dishonest runtime mutation survived the real verifier'
        : 'verifier failed for a reason that did not match the promoted acceptance criterion',
  };
}

export async function exerciseRuntimeCalibration({ candidateSha, config, repoRoot = process.cwd() } = {}) {
  assert(typeof candidateSha === 'string' && SHA_RE.test(candidateSha), 'runtime calibration candidateSha must be a full lowercase Git SHA');
  const validated = validateRuntimeCalibrationConfig(config);
  const resolvedRoot = resolve(repoRoot);
  const sourceBefore = snapshotSourceRepository(resolvedRoot);
  assert(sourceBefore.head === candidateSha, `runtime calibration source HEAD ${sourceBefore.head} does not match candidate ${candidateSha}`);
  const tempRoot = await mkdtemp(join(tmpdir(), 'ironshade-acceptance-runtime-'));
  const sandbox = join(tempRoot, 'sandbox');
  let dependencyIsolation;
  let verifierEnvironment;
  let baseline;
  const negativeControls = [];
  let attack;

  const assertSandboxRemoteDetached = () => {
    assert(runGit(['remote'], sandbox).stdout.trim() === '', 'disposable runtime attack clone must not retain a source-repository remote');
  };

  const resetSandbox = async () => {
    runGit(['reset', '--hard', '--quiet', sourceBefore.head], sandbox);
    runGit(['clean', '-fdx', '--quiet'], sandbox);
    assertSandboxRemoteDetached();
    dependencyIsolation = await copySourceDependencies(sandbox, resolvedRoot);
    verifierEnvironment = buildVerifierEnvironment(sandbox, resolvedRoot);
  };

  try {
    const clone = runGit(['clone', '--quiet', '--no-local', '--no-hardlinks', resolvedRoot, sandbox], dirname(resolvedRoot), { allowFailure: true });
    assert(clone.status === 0, `unable to create disposable runtime attack clone: ${(clone.stderr || clone.stdout).trim()}`);
    runGit(['checkout', '--quiet', '--detach', sourceBefore.head], sandbox);
    runGit(['remote', 'remove', 'origin'], sandbox);
    assertSandboxRemoteDetached();

    await resetSandbox();
    baseline = runCommand(validated.verifyCommand, sandbox, verifierEnvironment);
    assertSandboxRemoteDetached();
    const baselineEvaluation = evaluatePassControl(baseline, validated.passMarker);
    assert(baselineEvaluation.passed, `real runtime verifier baseline failed: ${baseline.stderr || baseline.stdout}`);
    baseline = { ...baseline, ...baselineEvaluation };
    console.log(`ACCEPTANCE_ATTACK_RUNTIME_BASELINE_PASS exit=${baseline.exitCode} markerMatched=${baseline.markerMatched}`);

    for (const control of validated.negativeControls) {
      await resetSandbox();
      const mutationTarget = await resolveSandboxMutationTarget(sandbox, validated.targetFile);
      const mutation = await applyReplacement(mutationTarget, control.replacement);
      const verification = runCommand(validated.verifyCommand, sandbox, verifierEnvironment);
      assertSandboxRemoteDetached();
      const evaluation = evaluatePassControl(verification, validated.passMarker);
      console.log(`ACCEPTANCE_ATTACK_RUNTIME_CONTROL id=${control.id} exit=${verification.exitCode} markerMatched=${evaluation.markerMatched} falsePositive=${evaluation.falsePositive}`);
      if (evaluation.falsePositive) logTrialFailure('CONTROL', control.id, verification);
      negativeControls.push({
        id: control.id,
        mutation,
        verification,
        ...evaluation,
      });
    }

    await resetSandbox();
    const attackTarget = await resolveSandboxMutationTarget(sandbox, validated.targetFile);
    const mutation = await applyReplacement(attackTarget, validated.attack.replacement);
    const verification = runCommand(validated.verifyCommand, sandbox, verifierEnvironment);
    assertSandboxRemoteDetached();
    const evaluation = evaluateDishonestAttack(verification, validated.attack.expectedFailurePatterns);
    console.log(`ACCEPTANCE_ATTACK_RUNTIME_ATTACK template=${validated.attack.templateId} exit=${verification.exitCode} matchedPatterns=${evaluation.matchedPatterns.length}/${evaluation.expectedFailurePatterns.length} detected=${evaluation.detected} falseNegative=${evaluation.falseNegative}`);
    if (!evaluation.detected) logTrialFailure('ATTACK', validated.attack.templateId, verification);
    attack = {
      templateId: validated.attack.templateId,
      mutation,
      verification,
      ...evaluation,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  const sourceAfter = snapshotSourceRepository(resolvedRoot);
  assertSourceRepositoryUnchanged(sourceBefore, sourceAfter);
  const falsePositives = negativeControls.filter(control => control.falsePositive).length;
  const falseNegatives = attack.falseNegative ? 1 : 0;
  const reportCore = {
    schema: REPORT_SCHEMA,
    candidateSha,
    targetFile: validated.targetFile,
    verifyCommand: validated.verifyCommand,
    baseline,
    negativeControls,
    attack,
    calibration: {
      falsePositiveTrials: negativeControls.length,
      falsePositives,
      falsePositiveRate: negativeControls.length === 0 ? 0 : falsePositives / negativeControls.length,
      falseNegativeTrials: 1,
      falseNegatives,
      falseNegativeRate: falseNegatives,
    },
    isolation: {
      strategy: 'disposable-clone',
      sourceHead: sourceBefore.head,
      sourceBranch: sourceBefore.branch,
      sourceBranchRef: sourceBefore.branchRef,
      sourceUnchanged: true,
      sandboxRemoteDetached: true,
      environmentIsolation: {
        workspaceRebased: verifierEnvironment.GITHUB_WORKSPACE === sandbox,
        sourcePathVariablesExposed: false,
        inheritedKeys: Object.keys(verifierEnvironment)
          .filter(key => !['PWD', 'INIT_CWD', 'GITHUB_WORKSPACE', 'CI', 'IRONSHADE_ACCEPTANCE_ATTACK'].includes(key))
          .sort(),
      },
      dependencyIsolation,
    },
    candidatePassGranted: false,
  };
  return {
    ...reportCore,
    reportDigest: digest(reportCore),
  };
}
