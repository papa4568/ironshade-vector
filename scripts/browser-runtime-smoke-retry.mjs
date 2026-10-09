import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const smokePath = fileURLToPath(new URL('./browser-runtime-smoke.mjs', import.meta.url));
const args = [smokePath, ...process.argv.slice(2)];
const readinessRacePattern = /"(?:environmentState|playerState|enemyState)":"loading"/;
const maxAttempts = 4;
const settleMs = 2_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function runSmoke() {
  return new Promise(resolve => {
    let diagnostic = '';
    const child = spawn(process.execPath, args, {
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    const relay = target => chunk => {
      const text = chunk.toString();
      diagnostic += text;
      target.write(chunk);
    };
    child.stdout.on('data', relay(process.stdout));
    child.stderr.on('data', relay(process.stderr));
    child.once('error', error => {
      console.error(error);
      resolve({ code: 1, diagnostic: `${diagnostic}\n${String(error)}` });
    });
    child.once('exit', (code, signal) => resolve({
      code: Number.isInteger(code) ? code : 1,
      diagnostic: signal ? `${diagnostic}\nterminated by ${signal}` : diagnostic,
    }));
  });
}

let result = { code: 1, diagnostic: '' };
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  result = await runSmoke();
  if (result.code === 0) break;
  if (!readinessRacePattern.test(result.diagnostic) || attempt === maxAttempts) break;
  console.log(`BROWSER_RUNTIME_READINESS_RETRY reason=authored-scene-loading next=${attempt + 1}/${maxAttempts} settleMs=${settleMs}`);
  await sleep(settleMs);
}
process.exitCode = result.code;
