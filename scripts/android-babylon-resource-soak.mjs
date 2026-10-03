import fs from 'node:fs';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const soakMinutes = Number(process.env.ANDROID_P27D6_SOAK_MINUTES ?? 30);
const durationMs = Math.max(1, soakMinutes) * 60_000;
const sampleEveryMs = 5_000;
const desiredLifecycleCycles = Math.max(3, Math.min(8, Math.floor(Math.max(12, soakMinutes) / 4)));
const cycleEveryMs = Math.max(60_000, Math.floor(durationMs / (desiredLifecycleCycles + 1)));
const runnerStartedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') throw new Error('Node WebSocket support is required for Babylon Android soak QA.');

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
  let lastValue = null;
  while (Date.now() < deadline) {
    try {
      lastValue = await evaluate(expression, 5_000);
      if (lastValue) return lastValue;
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    await sleep(350);
  }
  throw new Error(`Timed out waiting for ${label}; last=${JSON.stringify(lastValue)}${lastError ? ` error=${String(lastError)}` : ''}`);
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

function parseTelemetry(value) {
  const result = {};
  for (const part of String(value ?? '').split('|')) {
    const colon = part.indexOf(':');
    if (colon <= 0) continue;
    const key = part.slice(0, colon);
    const raw = part.slice(colon + 1);
    const numeric = Number(raw.replace(/mb$/i, ''));
    result[key] = Number.isFinite(numeric) ? numeric : raw;
  }
  return result;
}

function resourceEnvelope(sample) {
  const scene = parseTelemetry(sample?.sceneTelemetry);
  const runtime = parseTelemetry(sample?.assetRuntime);
  const budget = parseTelemetry(sample?.resourceBudget);
  return {
    meshes: Number(scene.meshes ?? 0),
    materials: Number(scene.materials ?? 0),
    textures: Number(scene.textures ?? 0),
    roots: Number(scene.roots ?? 0),
    cachedAssets: Number(runtime.cached ?? 0),
    activeInstances: Number(runtime.active ?? 0),
    cachedBytes: Number(runtime.bytes ?? 0),
    cacheAssetBudget: Number(budget['cache-assets'] ?? 0),
    cacheByteBudgetMb: Number(budget['cache-bytes'] ?? 0),
  };
}

const session = await waitForSession();
const { call, evaluate } = session;
await call('Page.enable').catch(() => undefined);

const currentUrl = await evaluate('location.href', 5_000);
const qaUrl = new URL(currentUrl);
qaUrl.search = '';
qaUrl.searchParams.set('graphicsCompare', '1');
qaUrl.searchParams.set('graphicsPath', 'babylon');
qaUrl.searchParams.set('babylonBackend', 'webgl2');
qaUrl.searchParams.set('p27d5Lifecycle', '1');
qaUrl.searchParams.set('p27d6Soak', '1');
await call('Page.navigate', { url: qaUrl.toString() }, 10_000);
await waitFor(evaluate, `document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Babylon soak document', 45_000);

async function ensureCommandDeck() {
  await waitFor(evaluate, `(() => {
    if (document.querySelector('.class-intake')) return 'intake';
    return [...document.querySelectorAll('button')].some(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase() === 'operations') ? 'command' : '';
  })()`, 'Command Deck or class intake', 45_000);
  if (await evaluate(`Boolean(document.querySelector('.class-intake'))`)) {
    const selected = await evaluate(`(() => {
      const button = document.querySelector('[aria-label="Select Vanguard class"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!selected) throw new Error('Could not select Vanguard for Babylon soak.');
    await sleep(150);
    const confirmed = await evaluate(`(() => {
      const button = document.querySelector('[aria-label="Confirm Vanguard"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!confirmed) throw new Error('Could not confirm Vanguard for Babylon soak.');
  }
  await waitFor(evaluate, `[...document.querySelectorAll('button')].some(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase() === 'operations') && !document.querySelector('.class-intake')`, 'Command Deck', 45_000);
}

async function clickButton(label) {
  const normalized = label.toLowerCase();
  return evaluate(`(() => {
    const expected = ${JSON.stringify(normalized)};
    const button = [...document.querySelectorAll('button')].find(candidate => (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLowerCase() === expected);
    if (!button || button.disabled) return false;
    button.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    button.click();
    return true;
  })()`);
}

async function deployRefinery() {
  await ensureCommandDeck();
  if (!(await clickButton('Operations'))) throw new Error('Operations action unavailable during Babylon soak.');
  await waitFor(evaluate, `[...document.querySelectorAll('button')].some(button => (button.textContent || '').trim().toLowerCase() === 'contracts')`, 'Operations contracts');
  if (!(await clickButton('Contracts'))) throw new Error('Contracts action unavailable during Babylon soak.');
  await waitFor(evaluate, `[...document.querySelectorAll('button')].some(button => button.getAttribute('data-location') === 'asteroid-refinery')`, 'Asteroid Refinery contract');
  const selected = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(candidate => candidate.getAttribute('data-location') === 'asteroid-refinery');
    if (!button) return false;
    button.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    button.click();
    return true;
  })()`);
  if (!selected) throw new Error('Could not select Asteroid Refinery during Babylon soak.');
  await waitFor(evaluate, `[...document.querySelectorAll('button')].some(button => button.getAttribute('data-location') === 'asteroid-refinery' && button.classList.contains('selected'))`, 'selected Asteroid Refinery', 20_000);
  if (!(await clickButton('Deploy selected contract'))) throw new Error('Deploy selected contract action unavailable during Babylon soak.');
  await waitFor(evaluate, `(() => {
    const canvas = document.querySelector('canvas');
    return Boolean(canvas
      && canvas.dataset.graphicsPathRequested === 'babylon'
      && canvas.dataset.graphicsPathLoaded === 'babylon'
      && canvas.dataset.babylonBackendRequested === 'webgl2'
      && canvas.dataset.babylonBackendLoaded === 'webgl2'
      && canvas.dataset.babylonInit === 'ready'
      && canvas.dataset.babylonScene === 'active'
      && canvas.dataset.babylonDisposed === 'false');
  })()`, 'active Babylon WebGL2 renderer', 60_000);
  await waitFor(evaluate, `Number(document.querySelector('canvas')?.dataset.babylonFrames ?? '0') >= 20`, 'Babylon rendered frames', 30_000);
  await waitFor(evaluate, `Boolean(document.querySelector('canvas')?.dataset.babylonSceneTelemetry)`, 'Babylon scene telemetry', 30_000);
}

async function readSample(atMs) {
  return evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    let report = null;
    try { report = JSON.parse(canvas.dataset.performanceReport || 'null'); } catch {}
    const memory = performance.memory;
    const assetRuntime = canvas.dataset.babylonEnvironmentRuntime || canvas.dataset.babylonPlayerRuntime || canvas.dataset.babylonEnemyRuntime || '';
    return {
      atMs: ${Math.round(atMs)},
      mission: document.querySelector('.mission-chip')?.textContent ?? '',
      requested: canvas.dataset.graphicsPathRequested ?? '',
      loaded: canvas.dataset.graphicsPathLoaded ?? '',
      backendRequested: canvas.dataset.babylonBackendRequested ?? '',
      backendLoaded: canvas.dataset.babylonBackendLoaded ?? '',
      scene: canvas.dataset.babylonScene ?? '',
      disposed: canvas.dataset.babylonDisposed ?? '',
      disposeCount: Number(canvas.dataset.babylonDisposeCount || 0),
      frames: Number(canvas.dataset.babylonFrames || 0),
      tier: canvas.dataset.renderTier ?? '',
      frameMs: Number(canvas.dataset.renderFrameMs || 0),
      regressions: canvas.dataset.performanceRegressions ?? '',
      report,
      jsHeapMb: typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize / 1048576 : null,
      sceneTelemetry: canvas.dataset.babylonSceneTelemetry ?? '',
      assetRuntime,
      resourceBudget: canvas.dataset.babylonResourceBudget ?? '',
      environmentState: canvas.dataset.babylonEnvironmentState ?? '',
      playerState: canvas.dataset.babylonPlayerState ?? '',
      enemyState: canvas.dataset.babylonEnemyState ?? '',
    };
  })()`);
}

async function exitMission(cycle) {
  const stored = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    globalThis.__ironshadeP27D6ExitedCanvas = canvas;
    window.dispatchEvent(new Event('ironshade:p27d5-return-to-hub'));
    return true;
  })()`);
  if (!stored) throw new Error(`P27-D6 lifecycle cycle ${cycle} could not retain the exiting canvas.`);
  await waitFor(evaluate, `[...document.querySelectorAll('button')].some(button => button.getAttribute('data-primary-area') === 'operations') && !document.querySelector('canvas')`, `Command Deck after lifecycle cycle ${cycle}`, 25_000);
  const disposed = await evaluate(`(() => {
    const canvas = globalThis.__ironshadeP27D6ExitedCanvas;
    if (!canvas) return null;
    const result = {
      connected: canvas.isConnected,
      disposed: canvas.dataset.babylonDisposed ?? '',
      scene: canvas.dataset.babylonScene ?? '',
      disposeCount: Number(canvas.dataset.babylonDisposeCount || 0),
      frames: Number(canvas.dataset.babylonFrames || 0),
      sceneTelemetry: canvas.dataset.babylonSceneTelemetry ?? '',
      assetRuntime: canvas.dataset.babylonEnvironmentRuntime || canvas.dataset.babylonPlayerRuntime || canvas.dataset.babylonEnemyRuntime || '',
    };
    delete globalThis.__ironshadeP27D6ExitedCanvas;
    return result;
  })()`);
  if (!disposed || disposed.connected || disposed.disposed !== 'true' || disposed.scene !== 'disposed' || disposed.disposeCount < 1) {
    throw new Error(`Babylon renderer did not dispose cleanly during lifecycle cycle ${cycle}: ${JSON.stringify(disposed)}`);
  }
  return disposed;
}

await deployRefinery();
const samples = [];
const lifecycle = [];
const missionEntries = [];
let inputBursts = 0;
let restarts = 0;
let reruns = 0;
let deepTransitions = 0;
let nextSampleAt = Date.now();
let nextInputAt = Date.now();
let nextCycleAt = Date.now() + cycleEveryMs;
let lastMinuteLogged = -1;
const soakStartedAt = Date.now();

const initialEntry = await readSample(0);
if (!initialEntry) throw new Error('No initial Babylon telemetry sample after deployment.');
missionEntries.push(initialEntry);

while (Date.now() - soakStartedAt < durationMs) {
  const now = Date.now();
  const elapsed = now - soakStartedAt;

  if (lifecycle.length < desiredLifecycleCycles && now >= nextCycleAt) {
    const cycle = lifecycle.length + 1;
    const before = await readSample(elapsed);
    const disposed = await exitMission(cycle);
    await deployRefinery();
    await sleep(1_500);
    const after = await readSample(Date.now() - soakStartedAt);
    if (!after) throw new Error(`No Babylon telemetry after lifecycle re-entry ${cycle}.`);
    lifecycle.push({ cycle, before, disposed, after });
    missionEntries.push(after);
    console.log(`ANDROID_P27D6_LIFECYCLE_PASS cycle=${cycle}/${desiredLifecycleCycles} oldDisposeCount=${disposed.disposeCount} oldFrames=${disposed.frames} reentryFrames=${after.frames} resources=${after.sceneTelemetry} cache=${after.assetRuntime}`);
    nextCycleAt = Date.now() + cycleEveryMs;
    nextInputAt = Date.now() + 1_000;
    nextSampleAt = Date.now();
    continue;
  }

  if (now >= nextInputAt) {
    const action = await evaluate(`(() => {
      const labels = [...document.querySelectorAll('button')].map(button => ({ button, text: (button.textContent || '').trim().toLowerCase() }));
      const restart = labels.find(item => item.text === 'restart contract');
      if (restart) { restart.button.click(); return 'restart'; }
      const rerun = labels.find(item => item.text === 'run contract again');
      if (rerun) { rerun.button.click(); return 'rerun'; }
      const deep = labels.find(item => item.text.includes('continue deeper') || item.text.includes('breach command zone') || item.text.includes('enter finale zone'));
      if (deep) { deep.button.click(); return 'deep'; }
      const interact = document.querySelector('.interact-button:not(:disabled)');
      if (interact) interact.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 81, pointerType: 'touch' }));
      const ability = document.querySelector('.ability-button:not(:disabled)');
      if (ability) ability.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 82, pointerType: 'touch' }));
      const dodge = document.querySelector('.dodge-button:not(:disabled)');
      if (dodge) dodge.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 83, pointerType: 'touch' }));
      const fire = document.querySelector('.fire-button:not(:disabled)');
      if (fire) {
        fire.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 84, pointerType: 'touch' }));
        setTimeout(() => fire.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 84, pointerType: 'touch' })), 800);
        return 'input';
      }
      return 'idle';
    })()`);
    if (action === 'restart') restarts += 1;
    else if (action === 'rerun') reruns += 1;
    else if (action === 'deep') deepTransitions += 1;
    else if (action === 'input') inputBursts += 1;
    nextInputAt = now + 2_000;
  }

  if (now >= nextSampleAt) {
    const sample = await readSample(elapsed);
    if (sample) samples.push(sample);
    nextSampleAt = now + sampleEveryMs;
  }

  const minute = Math.floor(elapsed / 60_000);
  if (minute !== lastMinuteLogged) {
    lastMinuteLogged = minute;
    const latest = samples.at(-1) ?? initialEntry;
    console.log(`ANDROID_P27D6_SOAK_PROGRESS minute=${minute}/${soakMinutes} samples=${samples.length} cycles=${lifecycle.length}/${desiredLifecycleCycles} frameP95=${latest?.report?.frameP95Ms ?? 'na'} heap=${latest?.report?.categories?.gc?.heapMb?.actual ?? latest?.jsHeapMb ?? 'na'} resources=${latest?.sceneTelemetry ?? 'na'}`);
  }
  await sleep(250);
}

session.close();

if (samples.length < Math.max(6, Math.floor(durationMs / sampleEveryMs * 0.5))) {
  throw new Error(`Insufficient Babylon soak telemetry samples: ${samples.length}`);
}
if (lifecycle.length < desiredLifecycleCycles) {
  throw new Error(`Insufficient Babylon renderer lifecycle cycles: ${lifecycle.length}/${desiredLifecycleCycles}`);
}
if (samples.some(sample => sample.requested !== 'babylon' || sample.loaded !== 'babylon' || sample.backendRequested !== 'webgl2' || sample.backendLoaded !== 'webgl2')) {
  throw new Error('Babylon soak left the explicit Babylon WebGL2 path.');
}

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

const entryResources = missionEntries.map(resourceEnvelope);
const initialResources = entryResources[0];
const finalResources = entryResources.at(-1);
const maxResources = Object.fromEntries(['meshes', 'materials', 'textures', 'roots', 'cachedAssets', 'activeInstances', 'cachedBytes'].map(key => [key, Math.max(...entryResources.map(entry => Number(entry[key] ?? 0)))]));
const cacheBudgetViolations = entryResources.filter(entry =>
  (entry.cacheAssetBudget > 0 && entry.cachedAssets > entry.cacheAssetBudget)
  || (entry.cacheByteBudgetMb > 0 && entry.cachedBytes > entry.cacheByteBudgetMb * 1024 * 1024));
const resourceRegressed = Boolean(initialResources && finalResources) && (
  finalResources.meshes > initialResources.meshes * 1.35 + 24
  || finalResources.materials > initialResources.materials * 1.35 + 12
  || finalResources.textures > initialResources.textures * 1.35 + 8
  || finalResources.roots > initialResources.roots * 1.35 + 12
  || finalResources.activeInstances > initialResources.activeInstances + 10
  || cacheBudgetViolations.length > 0
);

const summary = {
  version: 'p27-d6-babylon-v1',
  requestedMinutes: soakMinutes,
  elapsedSeconds: Math.round((Date.now() - soakStartedAt) / 1000),
  setupSeconds: Math.round((soakStartedAt - runnerStartedAt) / 1000),
  sampleCount: samples.length,
  rendererLifecycleCycles: lifecycle.length,
  missionEntries: missionEntries.length,
  activity: { inputBursts, restarts, reruns, deepTransitions },
  frameP95: { baselineMs: frameBaseline, finalMs: frameFinal, deltaMs: frameDelta, regressed: frameRegressed },
  heap: { source: heapP95.length >= 6 ? 'performance-diagnostics' : jsHeap.length ? 'performance.memory' : 'unavailable', baselineMb: heapBaseline, finalMb: heapFinal, deltaMb: heapDelta, regressed: heapRegressed },
  resources: { initial: initialResources, final: finalResources, max: maxResources, cacheBudgetViolations: cacheBudgetViolations.length, regressed: resourceRegressed },
  final: samples.at(-1),
};
fs.writeFileSync('android-p27d6-babylon-soak.json', JSON.stringify({ summary, lifecycle, missionEntries, samples }, null, 2));

if (frameRegressed) throw new Error(`Sustained Babylon frame pacing regressed: baseline=${frameBaseline}ms final=${frameFinal}ms`);
if (heapRegressed) throw new Error(`Sustained Babylon JS heap growth exceeded leak gate: baseline=${heapBaseline}MB final=${heapFinal}MB`);
if (resourceRegressed) throw new Error(`Babylon renderer resources did not remain bounded across recreation: ${JSON.stringify(summary.resources)}`);

console.log(`ANDROID_P27D6_WEBVIEW_PASS duration=${summary.elapsedSeconds}s samples=${samples.length} cycles=${lifecycle.length} entries=${missionEntries.length} frameBaseline=${frameBaseline ?? 'na'} frameFinal=${frameFinal ?? 'na'} heapBaseline=${heapBaseline ?? 'na'} heapFinal=${heapFinal ?? 'na'} resourcesInitial=${JSON.stringify(initialResources)} resourcesFinal=${JSON.stringify(finalResources)} cacheBudgetViolations=${cacheBudgetViolations.length}`);
