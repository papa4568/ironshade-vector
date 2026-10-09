import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = resolve(here, 'browser-runtime-smoke-core.mjs');
const retryEligible = process.env.BROWSER_E2E_GRAPHICS_PATH === 'babylon'
  && process.env.BROWSER_E2E_LOCATION === 'damaged-vessel';

function runCore() {
  return new Promise((resolveRun, rejectRun) => {
    let output = '';
    const child = spawn(process.execPath, [corePath], {
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    child.stdout.on('data', chunk => {
      process.stdout.write(chunk);
      output += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      process.stderr.write(chunk);
      output += chunk.toString();
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => resolveRun({
      code: code ?? 1,
      signal,
      output,
    }));
  });
}

let result = await runCore();
if (result.code === 0) process.exit(0);

const transientActorReload = retryEligible
  && result.output.includes('P27-C2 Babylon Damaged Vessel parity invalid')
  && /"(playerState|enemyState)":"loading"/.test(result.output);

if (!transientActorReload) process.exit(result.code);

console.warn('BROWSER_P27C2_TRANSIENT_RETRY actorPresentation=loading attempts=2');
await new Promise(resolveDelay => setTimeout(resolveDelay, 2_000));
result = await runCore();
process.exit(result.code);
