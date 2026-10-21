import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const smokePath = fileURLToPath(new URL('./browser-runtime-smoke.mjs', import.meta.url));
const args = [smokePath, ...process.argv.slice(2)];

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const lostDevicePattern = /webgpu->webgl2:runtime-device-lost/;

// The headed Linux WebGPU CI browser can lose its Vulkan instance. Navigating
// the same process after a device loss cannot prove WebGPU parity: use exactly
// one genuinely fresh Chrome GPU process/profile and rerun the original strict
// assertion, never accept WebGL2 fallback as a substitute.
async function runFreshWebGpuSmoke() {
  const sourcePath = resolve('.babylon-webgpu-puppeteer-launch.mjs');
  if (!existsSync(sourcePath)) throw new Error('Missing headed WebGPU browser launcher');
  const original = readFileSync(sourcePath, 'utf8');
  if (!original.includes('remote-debugging-port=9223') || !original.includes('ironshade-browser-e2e')) {
    throw new Error('Headed WebGPU browser launcher has unexpected identity');
  }
  const processes = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' }).split('\n');
  let chromePath = '';
  for (const line of processes) {
    if (!line.includes('--remote-debugging-port=9223')) continue;
    const pid = Number.parseInt(line.trim().split(/\s+/)[0], 10);
    if (!Number.isInteger(pid)) continue;
    try {
      const executable = readlinkSync('/proc/' + pid + '/exe');
      if (/(^|\/)(chrome|chromium)(?:\s*\(deleted\))?$/.test(executable)) {
        chromePath = executable.replace(/\s*\(deleted\)$/, '');
        break;
      }
    } catch { /* exited process; try the next Chrome PID */ }
  }
  if (!chromePath) throw new Error('Could not locate current headed Chrome executable');
  const lavapipe = ['/usr/share/vulkan/icd.d/lvp_icd.json', '/usr/share/vulkan/icd.d/lvp_icd.x86_64.json']
    .find(existsSync);
  if (!lavapipe) throw new Error('Fresh headed WebGPU run requires Mesa Lavapipe ICD');
  const newPath = resolve('.babylon-webgpu-puppeteer-fresh.mjs');
  writeFileSync(newPath, original
    .replace('ironshade-browser-e2e', 'ironshade-browser-e2e-fresh')
    .replace('remote-debugging-port=9223', 'remote-debugging-port=9224'));
  const browser = spawn('xvfb-run',
    ['-a', '-s', '-screen 0 1280x720x24', process.execPath, newPath],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, CHROME_PATH: chromePath, BABYLON_LAVAPIPE_ICD: lavapipe },
    });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      if (browser.exitCode !== null) break;
      try {
        const response = await fetch('http://127.0.0.1:9224/json/version', {
          signal: AbortSignal.timeout(1200),
        });
        if (response.ok) { ready = true; break; }
      } catch { /* wait for fresh WebGPU Chrome CDP */ }
      await sleep(500);
    }
    if (!ready) throw new Error('Fresh headed WebGPU Chrome endpoint unavailable');
    return await runSmoke({ ...process.env, CDP_ENDPOINT: 'http://127.0.0.1:9224' });
  } finally {
    if (browser.pid) {
      try { process.kill(-browser.pid, 'SIGTERM'); } catch { /* already exited */ }
    }
  }
}

const readinessRacePattern = /"(?:environmentState|playerState|enemyState)":"loading"/;
const maxAttempts = 4;
const settleMs = 2_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function runSmoke(env = process.env) {
  return new Promise(resolve => {
    let diagnostic = '';
    const child = spawn(process.execPath, args, {
      env,
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
  if (process.env.BROWSER_E2E_VIEWPORT === 'desktop'
    && process.env.BROWSER_E2E_BABYLON_BACKEND === 'webgpu'
    && lostDevicePattern.test(result.diagnostic)) {
    console.log('BROWSER_WEBGPU_FRESH_BROWSER_RETRY reason=runtime-device-lost next=1/1');
    try {
      result = await runFreshWebGpuSmoke();
    } catch (error) {
      console.error('BROWSER_WEBGPU_FRESH_BROWSER_ERROR', error);
      result = { code: 1, diagnostic: String(error) };
    }
    if (result.code === 0) console.log('BROWSER_WEBGPU_FRESH_BROWSER_PASS backend=webgpu');
    break;
  }
  if (!readinessRacePattern.test(result.diagnostic) || attempt === maxAttempts) break;
  console.log(`BROWSER_RUNTIME_READINESS_RETRY reason=authored-scene-loading next=${attempt + 1}/${maxAttempts} settleMs=${settleMs}`);
  await sleep(settleMs);
}
process.exitCode = result.code;
