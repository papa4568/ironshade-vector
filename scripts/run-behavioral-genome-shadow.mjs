import { spawn } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { selectReviewTask } from '../agent/tools/select-review-task.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, { env = {}, cwd = process.cwd() } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('error', rejectRun);
    child.on('exit', code => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function pipeArchive(baseSha, destination) {
  return new Promise((resolveRun, rejectRun) => {
    const archive = spawn('git', ['archive', '--format=tar', baseSha], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const extract = spawn('tar', ['-xf', '-', '-C', destination], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    archive.stdout.pipe(extract.stdin);
    let archiveCode = null;
    let extractCode = null;
    const finish = () => {
      if (archiveCode === null || extractCode === null) return;
      if (archiveCode === 0 && extractCode === 0) resolveRun();
      else rejectRun(new Error(`base archive extraction failed archive=${archiveCode} extract=${extractCode}`));
    };
    archive.on('error', rejectRun);
    extract.on('error', rejectRun);
    archive.on('exit', code => { archiveCode = code; finish(); });
    extract.on('exit', code => { extractCode = code; finish(); });
  });
}

function parseArguments(argv) {
  const options = { baseSha: null, candidateSha: null, outputDir: '.agent-genome' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--base-sha') options.baseSha = argv[++index] ?? null;
    else if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--output-dir') options.outputDir = argv[++index] ?? null;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function captureRoute(output, { cwd = process.cwd() } = {}) {
  await rm(join(cwd, '.behavioral-genome-dist'), { recursive: true, force: true });
  await run(process.execPath, [
    'node_modules/vite/bin/vite.js',
    'build',
    '--ssr',
    'tests/behavioral-genome-route.ts',
    '--outDir',
    '.behavioral-genome-dist',
  ], { cwd });
  await run(process.execPath, ['.behavioral-genome-dist/behavioral-genome-route.js'], {
    cwd,
    env: { BEHAVIORAL_GENOME_OUTPUT: output },
  });
}

async function captureBaseRoute(baseSha, output) {
  const baseRoot = await mkdtemp(join(tmpdir(), 'ironshade-behavioral-genome-base-'));
  try {
    await pipeArchive(baseSha, baseRoot);
    const [baseLock, candidateLock] = await Promise.all([
      readFile(join(baseRoot, 'package-lock.json')),
      readFile(resolve('package-lock.json')),
    ]);
    if (baseLock.equals(candidateLock)) {
      await symlink(resolve('node_modules'), join(baseRoot, 'node_modules'), 'dir');
      console.log('BEHAVIORAL_GENOME_BASE_DEPENDENCIES strategy=exact-lock-node-modules-reuse');
    } else {
      console.log('BEHAVIORAL_GENOME_BASE_DEPENDENCIES strategy=isolated-npm-ci reason=lockfile-changed');
      await run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: baseRoot });
    }
    await run('npm', ['run', 'prepare:graphics-assets'], { cwd: baseRoot });
    await captureRoute(output, { cwd: baseRoot });
  } finally {
    await rm(baseRoot, { recursive: true, force: true });
  }
}

async function optionalDeclarationPath(taskId, policy) {
  const path = resolve(policy.declarations.directory, `${taskId}.json`);
  try {
    await access(path);
    return path;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  assert(/^[a-f0-9]{40}$/.test(options.baseSha ?? ''), '--base-sha must be a full lowercase commit SHA');
  assert(/^[a-f0-9]{40}$/.test(options.candidateSha ?? ''), '--candidate-sha must be a full lowercase commit SHA');
  assert(options.baseSha !== options.candidateSha, '--base-sha and --candidate-sha must differ');
  assert(typeof options.outputDir === 'string' && options.outputDir.length > 0, '--output-dir is required');
  const actualHead = (await new Promise((resolveRun, rejectRun) => {
    const child = spawn('git', ['rev-parse', 'HEAD'], { stdio: ['ignore', 'pipe', 'inherit'] });
    let value = '';
    child.stdout.on('data', chunk => { value += chunk.toString(); });
    child.on('error', rejectRun);
    child.on('exit', code => code === 0 ? resolveRun(value.trim()) : rejectRun(new Error(`git rev-parse HEAD exited with ${code}`)));
  }));
  assert(actualHead === options.candidateSha, `behavioral genome runner HEAD ${actualHead} does not match candidate ${options.candidateSha}`);

  const outputDir = resolve(options.outputDir);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await run(process.execPath, ['agent/tests/behavioral-genome.mjs']);
  await run(process.execPath, ['agent/tests/behavioral-genome-calibration.mjs']);
  await run(process.execPath, ['agent/tests/behavioral-genome-promotion.mjs']);
  await captureRoute(resolve(outputDir, 'observations-a.json'));
  await captureRoute(resolve(outputDir, 'observations-b.json'));

  for (const suffix of ['a', 'b']) {
    await run(process.execPath, [
      'agent/tools/behavioral-genome.mjs',
      'create',
      '--observations',
      resolve(outputDir, `observations-${suffix}.json`),
      '--config',
      'agent/behavioral-genome.config.json',
      '--candidate-sha',
      options.candidateSha,
      '--output',
      resolve(outputDir, `genome-${suffix}.json`),
    ]);
  }

  await run(process.execPath, [
    'agent/tools/behavioral-genome.mjs',
    'compare',
    '--base',
    resolve(outputDir, 'genome-a.json'),
    '--candidate',
    resolve(outputDir, 'genome-b.json'),
    '--declared-domains',
    '',
    '--output',
    resolve(outputDir, 'repeat-comparison.json'),
    '--enforce',
  ]);

  await run(process.execPath, [
    'agent/tools/behavioral-genome-calibration.mjs',
    '--candidate-sha',
    options.candidateSha,
    '--config',
    'agent/behavioral-genome.config.json',
    '--corpus',
    'agent/behavioral-genome-calibration-corpus.json',
    '--output',
    resolve(outputDir, 'calibration.json'),
  ]);

  await captureBaseRoute(options.baseSha, resolve(outputDir, 'base-observations.json'));
  const selection = await selectReviewTask({
    baseRef: options.baseSha,
    headRef: options.candidateSha,
    useEventRefs: false,
  });
  const policy = JSON.parse(await readFile(resolve('agent/behavioral-genome-promotion-policy.json'), 'utf8'));
  const declaration = await optionalDeclarationPath(selection.taskId, policy);
  const gateArgs = [
    'agent/tools/behavioral-genome-promotion-gate.mjs',
    'gate',
    '--base-observations',
    resolve(outputDir, 'base-observations.json'),
    '--candidate-observations',
    resolve(outputDir, 'observations-a.json'),
    '--base-sha',
    options.baseSha,
    '--candidate-sha',
    options.candidateSha,
    '--task-id',
    selection.taskId,
    '--output',
    resolve(outputDir, 'promotion-gate.json'),
  ];
  if (declaration) gateArgs.push('--declaration', declaration);
  await run(process.execPath, gateArgs);

  console.log(`BEHAVIORAL_GENOME_SHADOW_PASS base=${options.baseSha} candidate=${options.candidateSha} task=${selection.taskId} declaration=${declaration ?? 'none'} output=${outputDir}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
