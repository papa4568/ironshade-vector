import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, { env = {} } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
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

function parseArguments(argv) {
  const options = { candidateSha: null, outputDir: '.agent-genome' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--output-dir') options.outputDir = argv[++index] ?? null;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function captureRoute(output) {
  await rm('.behavioral-genome-dist', { recursive: true, force: true });
  await run(process.execPath, [
    'node_modules/vite/bin/vite.js',
    'build',
    '--ssr',
    'tests/behavioral-genome-route.ts',
    '--outDir',
    '.behavioral-genome-dist',
  ]);
  await run(process.execPath, ['.behavioral-genome-dist/behavioral-genome-route.js'], {
    env: { BEHAVIORAL_GENOME_OUTPUT: output },
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  assert(/^[a-f0-9]{40}$/.test(options.candidateSha ?? ''), '--candidate-sha must be a full lowercase commit SHA');
  assert(typeof options.outputDir === 'string' && options.outputDir.length > 0, '--output-dir is required');
  const outputDir = resolve(options.outputDir);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await run(process.execPath, ['agent/tests/behavioral-genome.mjs']);
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
  console.log(`BEHAVIORAL_GENOME_SHADOW_PASS candidate=${options.candidateSha} output=${outputDir}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
