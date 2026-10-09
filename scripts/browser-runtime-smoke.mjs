import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const corePath = fileURLToPath(new URL('./browser-runtime-smoke-core.mjs', import.meta.url));
const args = [corePath, ...process.argv.slice(2)];
const readinessRacePattern = /"(?:environmentState|enemyState)":"loading"/;

function runCore() {
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

let result = await runCore();
if (result.code !== 0 && readinessRacePattern.test(result.diagnostic)) {
  console.log('BROWSER_RUNTIME_READINESS_RETRY reason=authored-scene-loading attempts=1');
  result = await runCore();
}
process.exitCode = result.code;
