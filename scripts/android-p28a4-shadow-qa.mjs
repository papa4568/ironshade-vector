import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const outputDir = process.env.ANDROID_P28A4_OUT_DIR ?? 'p28a4-physical-qa';
const timeoutMs = Number(process.env.ANDROID_P28A4_TIMEOUT_MS ?? 90_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for P28-A4 physical QA.');
}

async function listTargets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
  return await response.json();
}

function connect(url, timeout = 5_000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Timed out connecting to Android WebView CDP socket.'));
    }, timeout);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error(`Android WebView CDP socket error: ${String(event?.message ?? 'unknown')}`));
    }, { once: true });
  });
}

function createSession(socket) {
  let requestId = 0;
  const pending = new Map();

  const rejectPending = error => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  socket.addEventListener('message', event => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message ?? 'CDP request failed'));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => rejectPending(new Error('Android WebView CDP socket closed')));
  socket.addEventListener('error', () => rejectPending(new Error('Android WebView CDP socket failed')));

  function call(method, params = {}, timeout = 20_000) {
    if (socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error(`CDP socket is not open for ${method}`));
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for CDP ${method}`));
      }, timeout);
      pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression, timeout) {
    const response = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }, timeout);
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
    }
    return response.result?.value;
  }

  return {
    call,
    evaluate,
    close() {
      rejectPending(new Error('Android WebView CDP session closed'));
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    },
  };
}

async function waitForResponsiveSession() {
  let lastError = null;
  let lastTargets = [];
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const targets = await listTargets();
      lastTargets = targets;
      const candidates = targets.filter(candidate => candidate.webSocketDebuggerUrl && /ironshade/i.test(candidate.title ?? ''));
      for (const target of candidates) {
        let session;
        try {
          const socket = await connect(target.webSocketDebuggerUrl, 4_000);
          session = createSession(socket);
          await session.call('Runtime.enable', {}, 4_000);
          const probe = await session.evaluate(`({ title: document.title, url: location.href, readyState: document.readyState })`, 4_000);
          if (probe?.title === 'Ironshade Vector') return { target, session };
          lastError = new Error(`Android WebView target was not ready: ${JSON.stringify(probe)}`);
        } catch (error) {
          lastError = error;
        }
        session?.close();
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for responsive Android WebView target; targets=${JSON.stringify(lastTargets)}${lastError ? ` error=${lastError}` : ''}`);
}

const { target, session } = await waitForResponsiveSession();
const { call, evaluate } = session;
await call('Page.enable').catch(() => undefined);
await mkdir(outputDir, { recursive: true });
console.log(`P28A4_CDP_TARGET title=${JSON.stringify(target.title ?? '')} url=${JSON.stringify(target.url ?? '')}`);

async function waitFor(expression, label, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const remaining = Math.max(500, deadline - Date.now());
      if (await evaluate(expression, Math.min(5_000, remaining))) return;
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${String(lastError)}` : ''}`);
}

async function clickExactButton(label) {
  const literal = JSON.stringify(label.toLowerCase());
  const clicked = await evaluate(`(() => {
    const expected = ${literal};
    const button = [...document.querySelectorAll('button')].find(candidate =>
      (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLowerCase() === expected
    );
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Button unavailable: ${label}`);
}

async function ensureRefineryCombat() {
  await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Ironshade document');

  const alreadyInRefinery = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return Boolean(canvas?.dataset.environmentVisual === 'authored-refinery' && document.querySelector('.move-stick'));
  })()`);
  if (alreadyInRefinery) return;

  const intake = await evaluate(`document.querySelector('.class-intake') !== null`);
  if (intake) {
    await clickExactButton('Select Vanguard class');
    await clickExactButton('Confirm Vanguard');
  }

  await waitFor(`[...document.querySelectorAll('button')].some(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase() === 'operations')`, 'Command Deck operations button');
  await clickExactButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(button => (button.textContent || '').trim().toLowerCase() === 'contracts')`, 'Operations contracts button');
  await clickExactButton('Contracts');
  await waitFor(`Boolean(document.querySelector('button[data-location="asteroid-refinery"]'))`, 'Asteroid Refinery contract');

  const selected = await evaluate(`(() => {
    const target = document.querySelector('button[data-location="asteroid-refinery"]');
    if (!target || target.disabled) return false;
    target.click();
    return true;
  })()`);
  if (!selected) throw new Error('Asteroid Refinery contract is unavailable.');
  await waitFor(`document.querySelector('button[data-location="asteroid-refinery"]')?.classList.contains('selected') === true`, 'Asteroid Refinery selection');

  const deployed = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(candidate => (candidate.textContent || '').trim().toLowerCase() === 'deploy selected contract');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!deployed) throw new Error('Deploy selected contract action is unavailable.');

  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    return Boolean(
      canvas?.dataset.environmentVisual === 'authored-refinery'
      && canvas.dataset.environmentShadowBudget
      && document.querySelector('.move-stick')
      && document.querySelector('.fire-button')
    );
  })()`, 'Asteroid Refinery combat renderer', 60_000);
}

async function deviceRendererInfo() {
  return evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    let glVendor = '';
    let glRenderer = '';
    try {
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      glVendor = debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) || '') : String(gl?.getParameter(gl.VENDOR) || '');
      glRenderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || '') : String(gl?.getParameter(gl.RENDERER) || '');
    } catch {}
    return {
      userAgent: navigator.userAgent,
      viewport: [window.innerWidth, window.innerHeight],
      devicePixelRatio: window.devicePixelRatio,
      glVendor,
      glRenderer,
    };
  })()`);
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

async function sampleFrameTimes(durationMs = 1800) {
  const samples = await evaluate(`new Promise(resolve => {
    const duration = ${Math.max(500, durationMs)};
    const samples = [];
    let first = 0;
    let previous = 0;
    function frame(now) {
      if (!first) {
        first = now;
        previous = now;
      } else {
        samples.push(now - previous);
        previous = now;
      }
      if (now - first >= duration) resolve(samples);
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })()`, durationMs + 5_000);
  return {
    count: samples.length,
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    maxMs: samples.length ? Math.max(...samples) : null,
  };
}

async function pressKey(key, code, durationMs) {
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) });
  await sleep(durationMs);
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) });
  await sleep(450);
}

async function shadowTelemetry() {
  return evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return {
      renderTier: canvas?.dataset.renderTier ?? '',
      graphicsQuality: canvas?.dataset.graphicsQuality ?? '',
      renderFrameMs: Number(canvas?.dataset.renderFrameMs ?? NaN),
      lightingBudget: canvas?.dataset.babylonLightingBudget ?? '',
      shadowBudget: canvas?.dataset.environmentShadowBudget ?? '',
      shadowAnchor: canvas?.dataset.environmentShadowAnchor ?? '',
      environmentVisual: canvas?.dataset.environmentVisual ?? '',
      environmentLighting: canvas?.dataset.environmentLighting ?? '',
      actorGrounding: canvas?.dataset.actorGrounding ?? '',
      actorGroundingActors: canvas?.dataset.actorGroundingActors ?? '',
      ssao: canvas?.dataset.environmentSsao ?? canvas?.dataset.environmentContactDepth ?? '',
    };
  })()`);
}

async function captureScreenshot(name) {
  const result = await call('Page.captureScreenshot', { format: 'png', fromSurface: true }, 20_000);
  if (!result?.data) throw new Error(`No screenshot data returned for ${name}.`);
  const screenshotPath = path.join(outputDir, `${name}.png`);
  await writeFile(screenshotPath, Buffer.from(result.data, 'base64'));
  return screenshotPath;
}

function assertFlagshipShadowState(state, label) {
  if (state.environmentVisual !== 'authored-refinery') {
    throw new Error(`${label}: refinery presentation is not active: ${JSON.stringify(state)}`);
  }
  if (state.renderTier !== 'high' || state.graphicsQuality !== 'high') {
    throw new Error(`${label}: target phone did not remain on flagship High quality: ${JSON.stringify(state)}`);
  }
  if (!state.lightingBudget.includes('shadow:2048')) {
    throw new Error(`${label}: flagship lighting budget is not using 2048 shadows: ${JSON.stringify(state)}`);
  }
  if (!state.shadowBudget.includes('key:2048:pcf-high') || !state.shadowBudget.includes(':bias-0.00035:normal-0.012:')) {
    throw new Error(`${label}: P28-A4 high-PCF/bias telemetry is incomplete: ${JSON.stringify(state)}`);
  }
  if (!state.shadowAnchor) {
    throw new Error(`${label}: shadow-anchor telemetry is missing: ${JSON.stringify(state)}`);
  }
}

await ensureRefineryCombat();
await sleep(1_000);
const device = await deviceRendererInfo();
const waypoints = [];
const movements = [
  null,
  { key: 'w', code: 'KeyW', durationMs: 1800 },
  { key: 'd', code: 'KeyD', durationMs: 1800 },
  { key: 'w', code: 'KeyW', durationMs: 1800 },
];

for (let index = 0; index < movements.length; index += 1) {
  const movement = movements[index];
  if (movement) await pressKey(movement.key, movement.code, movement.durationMs);
  const state = await shadowTelemetry();
  assertFlagshipShadowState(state, `waypoint-${index}`);
  const frames = await sampleFrameTimes();
  const screenshot = await captureScreenshot(`p28a4-shadow-waypoint-${index}`);
  waypoints.push({ index, movement, ...state, frames, screenshot });
  console.log(`P28A4_WAYPOINT index=${index} anchor=${state.shadowAnchor} shadow=${state.shadowBudget} frameP95=${frames.p95Ms?.toFixed(2) ?? 'n/a'} screenshot=${screenshot}`);
}

const uniqueAnchors = new Set(waypoints.map(waypoint => waypoint.shadowAnchor));
if (uniqueAnchors.size < 2) {
  throw new Error(`P28-A4 movement did not cross a snapped shadow-anchor boundary: anchors=${JSON.stringify([...uniqueAnchors])}`);
}

const report = {
  schema: 'ironshade-p28a4-physical-shadow-qa-v1',
  capturedAt: new Date().toISOString(),
  device,
  acceptance: {
    emulatorRejectedByWrapper: true,
    flagshipTier: waypoints.every(waypoint => waypoint.renderTier === 'high' && waypoint.graphicsQuality === 'high'),
    shadowMap2048: waypoints.every(waypoint => waypoint.lightingBudget.includes('shadow:2048')),
    highPcfBiasProfile: waypoints.every(waypoint => waypoint.shadowBudget.includes('key:2048:pcf-high') && waypoint.shadowBudget.includes(':bias-0.00035:normal-0.012:')),
    anchorTransitions: uniqueAnchors.size,
    screenshotCount: waypoints.length,
  },
  waypoints,
};

const reportPath = path.join(outputDir, 'p28a4-shadow-qa.json');
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`ANDROID_P28A4_PHYSICAL_SHADOW_QA_PASS renderer=${JSON.stringify(device.glRenderer)} anchors=${uniqueAnchors.size} screenshots=${waypoints.length} report=${reportPath}`);
session.close();
await sleep(100);
