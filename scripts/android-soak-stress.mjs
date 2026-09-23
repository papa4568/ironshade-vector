import fs from 'node:fs';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const soakMinutes = Number(process.env.ANDROID_SOAK_MINUTES ?? 30);
const durationMs = Math.max(1, soakMinutes) * 60_000;
const sampleEveryMs = 5_000;
const runnerStartedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') throw new Error('Node WebSocket support is required for Android soak QA.');

async function listTargets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
  return response.json();
}

function connect(url, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Timed out connecting to Android WebView CDP socket.'));
    }, timeoutMs);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('Android WebView CDP socket failed.'));
    }, { once: true });
  });
}

function sessionFor(socket) {
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message ?? 'CDP request failed'));
    else request.resolve(message.result);
  });
  const call = (method, params = {}, timeoutMs = 20_000) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for CDP ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression, timeoutMs) => {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeoutMs);
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
    return response.result?.value;
  };
  return { call, evaluate, close: () => socket.close() };
}

async function waitForSession(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const targets = await listTargets();
      for (const target of targets.filter(item => item.webSocketDebuggerUrl)) {
        let socket;
        try {
          socket = await connect(target.webSocketDebuggerUrl);
          const session = sessionFor(socket);
          await session.call('Runtime.enable', {}, 5_000);
          const probe = await session.evaluate('({ title: document.title, url: location.href, ready: document.readyState })', 5_000);
          if (probe?.title === 'Ironshade Vector' && /localhost/i.test(probe?.url ?? '')) return session;
          session.close();
        } catch (error) {
          lastError = error;
          socket?.close();
        }
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for Ironshade WebView: ${String(lastError ?? 'no target')}`);
}

async function waitFor(evaluate, expression, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression, 5_000)) return;
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${String(lastError)}` : ''}`);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function edgeMedian(values, atEnd = false) {
  const finite = values.filter(value => Number.isFinite(value));
  if (!finite.length) return null;
  const count = Math.max(3, Math.ceil(finite.length * 0.2));
  return median(atEnd ? finite.slice(-count) : finite.slice(0, count));
}

const session = await waitForSession();
const { call, evaluate } = session;
await call('Page.enable').catch(() => undefined);
await waitFor(evaluate, `Boolean(localStorage.getItem('ironshade-vector-state-v1'))`, 'initial persisted game state', 60_000);

const seeded = await evaluate(`(() => {
  const key = 'ironshade-vector-state-v1';
  const raw = localStorage.getItem(key);
  const state = JSON.parse(raw || 'null');
  if (!state?.profile || !state?.campaign) return false;
  Object.assign(state.profile, {
    level: Math.max(18, state.profile.level || 1),
    xp: Math.max(10200, state.profile.xp || 0),
    operatorClass: 'vanguard',
    classSelectionComplete: true,
    specialization: 'breach-vanguard',
    specializationOverclock: true,
  });
  const directive = {
    id: 'directive-12-p16e-soak',
    seed: 416021,
    tier: 12,
    location: 'solar-yard',
    locationName: 'Solar Fabrication Yard',
    sponsor: 'heliostat',
    archetype: 'stabilization',
    objectiveMode: 'grid-isolation',
    modifierIds: ['protocol-density', 'elite-reinforcements', 'event-cascade', 'overloaded-bus', 'unstable-mass', 'compromised-shell'],
    targetClass: 'command-target',
    deepTarget: 'Sunward Fabrication Command',
    codename: 'Thermal Crown',
    sourceLabel: 'P16-E worst-case soak QA',
  };
  state.campaign.directives = {
    ...state.campaign.directives,
    unlocked: true,
    inventory: [directive],
    preparedId: directive.id,
    highestTier: 12,
    lastBeat: 'P16-E SOAK // worst-case T12 prepared',
  };
  localStorage.setItem(key, JSON.stringify({ ...state, savedAt: new Date().toISOString() }));
  localStorage.setItem('ironshade-vector-campaign-v1', JSON.stringify(state.campaign));
  return true;
})()`);
if (!seeded) throw new Error('Could not seed a valid P16-E T12 Directive checkpoint.');

await call('Page.reload', { ignoreCache: true });
await waitFor(evaluate, `document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'reloaded app');
await waitFor(evaluate, `[...document.querySelectorAll('button')].some(button => (button.textContent || '').trim().toLowerCase() === 'deploy selected contract')`, 'T12 deployment action');

const selected = await evaluate(`(() => {
  const body = document.body?.innerText ?? '';
  const button = [...document.querySelectorAll('button')].find(candidate => (candidate.textContent || '').trim().toLowerCase() === 'deploy selected contract');
  if (!button) return null;
  return { text: body.slice(0, 2400), disabled: Boolean(button.disabled) };
})()`);
if (!selected || selected.disabled || !selected.text.includes('Directive T12 // Thermal Crown')) {
  throw new Error(`Prepared T12 Directive was not selected after reload: ${JSON.stringify(selected)}`);
}
await evaluate(`[...document.querySelectorAll('button')].find(button => (button.textContent || '').trim().toLowerCase() === 'deploy selected contract')?.click()`);
await waitFor(evaluate, `(document.querySelector('.mission-chip')?.textContent ?? '').includes('OP T12') && Boolean(document.querySelector('canvas[data-performance-report]'))`, 'T12 combat telemetry', 90_000);

const samples = [];
let restarts = 0;
let deepTransitions = 0;
let completedRuns = 0;
let inputBursts = 0;
let nextSampleAt = Date.now();
let nextInputAt = Date.now();
let lastMinuteLogged = -1;

const soakStartedAt = Date.now();
while (Date.now() - soakStartedAt < durationMs) {
  const now = Date.now();
  if (now >= nextInputAt) {
    const action = await evaluate(`(() => {
      const labels = [...document.querySelectorAll('button')].map(button => ({ button, text: (button.textContent || '').trim().toLowerCase(), label: (button.getAttribute('aria-label') || '').trim().toLowerCase() }));
      const restart = labels.find(item => item.text === 'restart contract');
      if (restart) { restart.button.click(); return 'restart'; }
      const rerun = labels.find(item => item.text === 'run contract again');
      if (rerun) { rerun.button.click(); return 'rerun'; }
      const deep = labels.find(item => item.text.includes('continue deeper') || item.text.includes('breach command zone') || item.text.includes('enter finale zone'));
      if (deep) { deep.button.click(); return 'deep'; }
      const interact = document.querySelector('.interact-button:not(:disabled)');
      if (interact) interact.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 71, pointerType: 'touch' }));
      const ability = document.querySelector('.ability-button:not(:disabled)');
      if (ability) ability.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 72, pointerType: 'touch' }));
      const dodge = document.querySelector('.dodge-button:not(:disabled)');
      if (dodge) dodge.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 73, pointerType: 'touch' }));
      const fire = document.querySelector('.fire-button:not(:disabled)');
      if (fire) {
        fire.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 74, pointerType: 'touch' }));
        setTimeout(() => fire.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 74, pointerType: 'touch' })), 900);
        return 'input';
      }
      return 'idle';
    })()`);
    if (action === 'restart') restarts += 1;
    else if (action === 'rerun') { restarts += 1; completedRuns += 1; }
    else if (action === 'deep') deepTransitions += 1;
    else if (action === 'input') inputBursts += 1;
    nextInputAt = now + 2_000;
  }

  if (now >= nextSampleAt) {
    const sample = await evaluate(`(() => {
      const canvas = document.querySelector('canvas[data-performance-report]');
      if (!canvas) return null;
      let report = null;
      try { report = JSON.parse(canvas.dataset.performanceReport || 'null'); } catch {}
      const memory = performance.memory;
      return {
        atMs: ${now} - ${soakStartedAt},
        mission: document.querySelector('.mission-chip')?.textContent ?? '',
        tier: canvas.dataset.renderTier ?? '',
        frameMs: Number(canvas.dataset.renderFrameMs || 0),
        frameBudget: canvas.dataset.renderFrameBudget ?? '',
        performanceStatus: canvas.dataset.performanceStatus ?? '',
        regressions: canvas.dataset.performanceRegressions ?? '',
        report,
        jsHeapMb: typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize / 1048576 : null,
        dead: Boolean(document.querySelector('[aria-label="Operator down"]')),
        complete: Boolean(document.querySelector('[aria-label="Deep zone complete"]')),
        pools: canvas.dataset.runtimePools ?? '',
      };
    })()`);
    if (sample) samples.push(sample);
    nextSampleAt = now + sampleEveryMs;
  }

  const minute = Math.floor((now - soakStartedAt) / 60_000);
  if (minute !== lastMinuteLogged) {
    lastMinuteLogged = minute;
    const latest = samples.at(-1);
    console.log(`ANDROID_P16E_SOAK_PROGRESS minute=${minute}/${soakMinutes} samples=${samples.length} restarts=${restarts} frameP95=${latest?.report?.frameP95Ms ?? 'na'} heap=${latest?.report?.categories?.gc?.heapMb?.actual ?? latest?.jsHeapMb ?? 'na'} tier=${latest?.tier ?? 'na'}`);
  }
  await sleep(250);
}

session.close();

if (samples.length < Math.max(6, Math.floor(durationMs / sampleEveryMs * 0.6))) {
  throw new Error(`Insufficient soak telemetry samples: ${samples.length}`);
}
if (samples.some(sample => !sample.mission.includes('OP T12'))) throw new Error('Soak left the prepared T12 mission unexpectedly.');

const frameP95 = samples.map(sample => Number(sample.report?.frameP95Ms)).filter(Number.isFinite);
const heapP95 = samples.map(sample => Number(sample.report?.categories?.gc?.heapMb?.actual)).filter(value => Number.isFinite(value) && value > 0);
const jsHeap = samples.map(sample => Number(sample.jsHeapMb)).filter(value => Number.isFinite(value) && value > 0);
const frameBaseline = edgeMedian(frameP95);
const frameFinal = edgeMedian(frameP95, true);
const heapSeries = heapP95.length >= 6 ? heapP95 : jsHeap;
const heapBaseline = edgeMedian(heapSeries);
const heapFinal = edgeMedian(heapSeries, true);
const frameDelta = frameBaseline != null && frameFinal != null ? frameFinal - frameBaseline : null;
const heapDelta = heapBaseline != null && heapFinal != null ? heapFinal - heapBaseline : null;
const frameRegressed = frameBaseline != null && frameFinal != null && frameFinal > frameBaseline * 1.5 && frameFinal - frameBaseline > 8;
const heapRegressed = heapBaseline != null && heapFinal != null && heapFinal - heapBaseline > Math.max(96, heapBaseline * 0.5);

const summary = {
  version: 'p16-e-v1',
  requestedMinutes: soakMinutes,
  elapsedSeconds: Math.round((Date.now() - soakStartedAt) / 1000),
  setupSeconds: Math.round((soakStartedAt - runnerStartedAt) / 1000),
  sampleCount: samples.length,
  t12: { directive: 'Thermal Crown', location: 'solar-yard', modifiers: 6, targetClass: 'command-target' },
  activity: { restarts, completedRuns, deepTransitions, inputBursts },
  frameP95: { baselineMs: frameBaseline, finalMs: frameFinal, deltaMs: frameDelta, regressed: frameRegressed },
  heap: { source: heapP95.length >= 6 ? 'performance-diagnostics' : jsHeap.length ? 'performance.memory' : 'unavailable', baselineMb: heapBaseline, finalMb: heapFinal, deltaMb: heapDelta, regressed: heapRegressed },
  final: samples.at(-1),
};
fs.writeFileSync('android-soak-webview.json', JSON.stringify({ summary, samples }, null, 2));

if (frameRegressed) throw new Error(`Sustained frame pacing regressed: baseline=${frameBaseline}ms final=${frameFinal}ms`);
if (heapRegressed) throw new Error(`Sustained JS heap growth exceeded leak gate: baseline=${heapBaseline}MB final=${heapFinal}MB`);

console.log(`ANDROID_P16E_WEBVIEW_PASS duration=${summary.elapsedSeconds}s samples=${samples.length} restarts=${restarts} frameBaseline=${frameBaseline ?? 'na'} frameFinal=${frameFinal ?? 'na'} heapBaseline=${heapBaseline ?? 'na'} heapFinal=${heapFinal ?? 'na'}`);
