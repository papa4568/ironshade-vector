import { writeFileSync } from 'node:fs';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const soakMinutes = Number(process.env.ANDROID_P27D6_SOAK_MINUTES ?? 30);
const durationMs = Math.max(1, soakMinutes) * 60_000;
const requestedCycleMs = Number(process.env.ANDROID_P27D6_CYCLE_MS ?? 0);
const cycleEveryMs = requestedCycleMs > 0
  ? Math.max(30_000, requestedCycleMs)
  : Math.max(30_000, Math.min(5 * 60_000, durationMs / 5));
const sampleEveryMs = 5_000;
const inputEveryMs = 2_000;
const reportPath = process.env.ANDROID_P27D6_REPORT_PATH ?? 'android-p27d6-babylon-soak.json';
const runnerStartedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node WebSocket support is required for P27-D6 Babylon soak QA.');
}

async function listTargets() {
  const response = await fetch(cdpBase + '/json/list');
  if (!response.ok) throw new Error('CDP target listing returned HTTP ' + response.status);
  return await response.json();
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
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error('Android WebView CDP socket failed: ' + String(event?.message ?? 'unknown')));
    }, { once: true });
  });
}

function sessionFor(socket) {
  let sequence = 0;
  const pending = new Map();

  socket.addEventListener('message', event => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
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
      reject(new Error('Timed out waiting for CDP ' + method));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression, timeoutMs = 10_000) => {
    const response = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }, timeoutMs);
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
    }
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
          await session.call('Page.enable', {}, 5_000);
          const probe = await session.evaluate('({ title: document.title, ready: document.readyState })', 5_000);
          if (probe?.title === 'Ironshade Vector' && (probe.ready === 'complete' || probe.ready === 'interactive')) {
            return session;
          }
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
  throw new Error('Timed out waiting for Ironshade Vector WebView: ' + String(lastError ?? 'no target'));
}

const session = await waitForSession();
const { call, evaluate } = session;
await call('HeapProfiler.enable', {}, 10_000).catch(() => undefined);

async function collectGarbage(label) {
  await call('HeapProfiler.collectGarbage', {}, 30_000);
  await sleep(250);
  const usage = await call('Runtime.getHeapUsage', {}, 10_000).catch(() => null);
  const usedMb = Number.isFinite(usage?.usedSize) ? usage.usedSize / 1048576 : null;
  const totalMb = Number.isFinite(usage?.totalSize) ? usage.totalSize / 1048576 : null;
  console.log('ANDROID_P27D6_GC_PASS label=' + label
    + ' usedMb=' + (usedMb ?? 'na')
    + ' totalMb=' + (totalMb ?? 'na'));
  return { usedMb, totalMb };
}

async function waitFor(expression, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    try {
      lastValue = await evaluate(expression, 8_000);
      if (lastValue) return lastValue;
    } catch {}
    await sleep(250);
  }
  throw new Error('Timed out waiting for ' + label + '; last=' + JSON.stringify(lastValue));
}

async function navigateBabylonQa() {
  const currentUrl = await evaluate('location.href');
  const url = new URL(currentUrl);
  url.search = '';
  url.searchParams.set('graphicsCompare', '1');
  url.searchParams.set('graphicsPath', 'babylon');
  url.searchParams.set('babylonBackend', 'webgl2');
  url.searchParams.set('p27d5Lifecycle', '1');
  url.searchParams.set('p27d6Soak', '1');
  await call('Page.navigate', { url: url.toString() }, 10_000);
  await waitFor('document.readyState === "complete" && document.title === "Ironshade Vector"', 'Babylon soak QA document', 45_000);
}

async function clickButton(label) {
  const normalized = label.toLowerCase();
  const clicked = await evaluate('(() => { const expected = ' + JSON.stringify(normalized) + '; const button = [...document.querySelectorAll("button")].find(candidate => (candidate.getAttribute("aria-label") || candidate.textContent || "").trim().toLowerCase() === expected); if (!button || button.disabled) return false; button.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); button.click(); return true; })()');
  if (!clicked) throw new Error('Could not click button: ' + label);
  await sleep(220);
}

async function ensureCommandDeck() {
  const surface = await waitFor('(() => { const labels = [...document.querySelectorAll("button")].map(button => (button.getAttribute("aria-label") || button.textContent || "").trim().toLowerCase()); if (labels.includes("operations")) return "command"; if (document.querySelector(".class-intake")) return "intake"; return ""; })()', 'Command Deck or operator intake', 45_000);
  if (surface === 'intake') {
    await clickButton('Select Vanguard class');
    await clickButton('Confirm Vanguard');
  }
  await waitFor('[...document.querySelectorAll("button")].some(button => (button.getAttribute("aria-label") || button.textContent || "").trim().toLowerCase() === "operations") && !document.querySelector(".class-intake")', 'Command Deck', 45_000);
}

async function deployRefinery() {
  await ensureCommandDeck();
  await clickButton('Operations');
  await waitFor('[...document.querySelectorAll("button")].some(button => (button.getAttribute("aria-label") || button.textContent || "").trim().toLowerCase() === "contracts")', 'Operations contracts');
  await clickButton('Contracts');
  await waitFor('[...document.querySelectorAll("button")].some(button => button.getAttribute("data-location") === "asteroid-refinery")', 'Asteroid Refinery contract');

  const selected = await evaluate('(() => { const button = [...document.querySelectorAll("button")].find(candidate => candidate.getAttribute("data-location") === "asteroid-refinery"); if (!button) return false; button.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); button.click(); return true; })()');
  if (!selected) throw new Error('Could not select Asteroid Refinery contract.');
  await waitFor('[...document.querySelectorAll("button")].some(button => button.getAttribute("data-location") === "asteroid-refinery" && button.classList.contains("selected"))', 'Asteroid Refinery selection');
  await clickButton('Deploy selected contract');

  await waitFor('(() => { const canvas = document.querySelector("canvas"); return Boolean(canvas && canvas.dataset.graphicsPathSelection === "qa-explicit" && canvas.dataset.graphicsPathRequested === "babylon" && canvas.dataset.graphicsPathLoaded === "babylon" && canvas.dataset.babylonBackendRequested === "webgl2" && canvas.dataset.babylonBackendLoaded === "webgl2" && canvas.dataset.babylonInit === "ready" && canvas.dataset.babylonScene === "active" && canvas.dataset.babylonDisposed === "false"); })()', 'P27-D6 Babylon WebGL2 combat', 60_000);
  await waitFor('Number(document.querySelector("canvas")?.dataset.babylonFrames ?? "0") >= 30', 'P27-D6 Babylon warm frames', 45_000);
}

function parsePipeStats(value) {
  const result = {};
  for (const part of String(value ?? '').split('|')) {
    const index = part.indexOf(':');
    if (index <= 0) continue;
    const key = part.slice(0, index);
    const raw = part.slice(index + 1);
    const number = Number(raw.replace(/mb$/i, ''));
    result[key] = Number.isFinite(number) ? number : raw;
  }
  return result;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function edgeMedian(values, atEnd = false) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  const count = Math.max(3, Math.ceil(finite.length * 0.2));
  return median(atEnd ? finite.slice(-count) : finite.slice(0, count));
}

async function sampleRuntime(atMs) {
  const sample = await evaluate('(() => { const canvas = document.querySelector("canvas"); if (!canvas || canvas.dataset.graphicsPathRequested !== "babylon") return null; let report = null; try { report = JSON.parse(canvas.dataset.performanceReport || "null"); } catch {} const memory = performance.memory; return { atMs: ' + Math.round(atMs) + ', mission: document.querySelector(".mission-chip")?.textContent?.trim() ?? "", frames: Number(canvas.dataset.babylonFrames ?? "0"), graphicsLoaded: canvas.dataset.graphicsPathLoaded ?? "", backendLoaded: canvas.dataset.babylonBackendLoaded ?? "", init: canvas.dataset.babylonInit ?? "", scene: canvas.dataset.babylonScene ?? "", disposed: canvas.dataset.babylonDisposed ?? "", sceneTelemetry: canvas.dataset.babylonSceneTelemetry ?? "", geometryStats: canvas.dataset.babylonGeometryStats ?? "", resourceBudget: canvas.dataset.babylonResourceBudget ?? "", performanceStatus: canvas.dataset.performanceStatus ?? "", performanceRegressions: canvas.dataset.performanceRegressions ?? "", report, jsHeapMb: typeof memory?.usedJSHeapSize === "number" ? memory.usedJSHeapSize / 1048576 : null }; })()');
  if (!sample) return null;
  const heapUsage = await call('Runtime.getHeapUsage', {}, 10_000).catch(() => null);
  sample.cdpHeapUsedMb = Number.isFinite(heapUsage?.usedSize) ? heapUsage.usedSize / 1048576 : null;
  sample.cdpHeapTotalMb = Number.isFinite(heapUsage?.totalSize) ? heapUsage.totalSize / 1048576 : null;
  return sample;
}

async function exerciseCombatInput() {
  return await evaluate('(() => { const buttons = [...document.querySelectorAll("button")].map(button => ({ button, text: (button.textContent || "").trim().toLowerCase() })); const restart = buttons.find(item => item.text === "restart contract"); if (restart && !restart.button.disabled) { restart.button.click(); return "restart"; } const rerun = buttons.find(item => item.text === "run contract again"); if (rerun && !rerun.button.disabled) { rerun.button.click(); return "rerun"; } const interact = document.querySelector(".interact-button:not(:disabled)"); if (interact) interact.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 201, pointerType: "touch" })); const ability = document.querySelector(".ability-button:not(:disabled)"); if (ability) ability.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 202, pointerType: "touch" })); const dodge = document.querySelector(".dodge-button:not(:disabled)"); if (dodge) dodge.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 203, pointerType: "touch" })); const fire = document.querySelector(".fire-button:not(:disabled)"); if (fire) { fire.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 204, pointerType: "touch" })); setTimeout(() => fire.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 204, pointerType: "touch" })), 700); return "combat"; } return "idle"; })()');
}

async function cycleMission(index) {
  const armed = await evaluate('(() => { const canvas = document.querySelector("canvas"); if (!canvas) return false; globalThis.__ironshadeP27D6ExitedCanvas = canvas; window.dispatchEvent(new Event("ironshade:p27d5-return-to-hub")); return true; })()');
  if (!armed) throw new Error('P27-D6 cycle ' + index + ' could not request mission exit.');

  await waitFor('[...document.querySelectorAll("button")].some(button => (button.getAttribute("aria-label") || button.textContent || "").trim().toLowerCase() === "operations") && !document.querySelector("canvas")', 'P27-D6 cycle ' + index + ' return to hub', 30_000);

  const disposed = await evaluate('(() => { const canvas = globalThis.__ironshadeP27D6ExitedCanvas; if (!canvas) return null; let resources = null; try { resources = JSON.parse(canvas.dataset.babylonDisposeResources || "null"); } catch {} return { connected: canvas.isConnected, disposed: canvas.dataset.babylonDisposed ?? "", scene: canvas.dataset.babylonScene ?? "", disposeCount: Number(canvas.dataset.babylonDisposeCount ?? "0"), cacheReclaimed: canvas.dataset.babylonAssetCacheReclaimed ?? "", resources }; })()');
  if (!disposed || disposed.connected || disposed.disposed !== 'true' || disposed.scene !== 'disposed' || disposed.disposeCount < 1) {
    throw new Error('P27-D6 cycle ' + index + ' renderer did not dispose cleanly: ' + JSON.stringify(disposed));
  }

  const after = disposed.resources?.after;
  const before = disposed.resources?.before;
  const keys = ['meshes', 'materials', 'textures', 'roots', 'cachedAssets', 'activeInstances', 'estimatedCachedCompressedBytes'];
  if (!before || !after || before.meshes < 1 || keys.some(key => Number(after[key]) !== 0) || disposed.cacheReclaimed !== 'true') {
    throw new Error('P27-D6 cycle ' + index + ' retained Babylon renderer resources: ' + JSON.stringify(disposed));
  }

  const heapAfterGc = await collectGarbage('cycle-' + index + '-disposed');
  disposed.heapAfterGc = heapAfterGc;

  await deployRefinery();
  const reentered = await sampleRuntime(0);
  if (!reentered || reentered.graphicsLoaded !== 'babylon' || reentered.backendLoaded !== 'webgl2' || reentered.scene !== 'active' || reentered.disposed !== 'false') {
    throw new Error('P27-D6 cycle ' + index + ' Babylon re-entry invalid: ' + JSON.stringify(reentered));
  }

  console.log('ANDROID_P27D6_DISPOSAL_CYCLE_PASS cycle=' + index
    + ' beforeMeshes=' + before.meshes
    + ' beforeCached=' + before.cachedAssets
    + ' afterMeshes=' + after.meshes
    + ' afterCached=' + after.cachedAssets
    + ' disposeCount=' + disposed.disposeCount);
  return { index, disposed, reentered };
}

await navigateBabylonQa();
await deployRefinery();
await collectGarbage('initial-warmup');

const samples = [];
const cycles = [];
let inputBursts = 0;
let restartActions = 0;
let rerunActions = 0;
let nextSampleAt = Date.now();
let nextInputAt = Date.now();
const soakStartedAt = Date.now();
let nextCycleAt = soakStartedAt + cycleEveryMs;
let lastMinuteLogged = -1;

while (Date.now() - soakStartedAt < durationMs) {
  const now = Date.now();

  if (now >= nextCycleAt && Date.now() - soakStartedAt < durationMs - 20_000) {
    cycles.push(await cycleMission(cycles.length + 1));
    nextCycleAt = Date.now() + cycleEveryMs;
    nextSampleAt = Date.now();
    nextInputAt = Date.now();
    continue;
  }

  if (now >= nextInputAt) {
    const action = await exerciseCombatInput();
    if (action === 'combat') inputBursts += 1;
    else if (action === 'restart') restartActions += 1;
    else if (action === 'rerun') rerunActions += 1;
    nextInputAt = now + inputEveryMs;
  }

  if (now >= nextSampleAt) {
    const sample = await sampleRuntime(now - soakStartedAt);
    if (sample) samples.push(sample);
    nextSampleAt = now + sampleEveryMs;
  }

  const minute = Math.floor((now - soakStartedAt) / 60_000);
  if (minute !== lastMinuteLogged) {
    lastMinuteLogged = minute;
    const latest = samples.at(-1);
    console.log('ANDROID_P27D6_SOAK_PROGRESS minute=' + minute + '/' + soakMinutes
      + ' samples=' + samples.length
      + ' cycles=' + cycles.length
      + ' inputBursts=' + inputBursts
      + ' frameP95=' + (latest?.report?.frameP95Ms ?? 'na')
      + ' heap=' + (latest?.report?.categories?.gc?.heapMb?.actual ?? latest?.jsHeapMb ?? 'na'));
  }

  await sleep(250);
}

const elapsedSeconds = Math.round((Date.now() - soakStartedAt) / 1000);
const minimumSamples = Math.max(6, Math.floor(durationMs / sampleEveryMs * 0.55));
const requiredCycles = Math.max(1, Math.min(4, Math.floor(durationMs / cycleEveryMs) - 1));
const frameP95 = samples.map(sample => Number(sample.report?.frameP95Ms)).filter(Number.isFinite);
const cdpHeap = samples.map(sample => Number(sample.cdpHeapUsedMb)).filter(value => Number.isFinite(value) && value > 0);
const diagnosticHeap = samples.map(sample => Number(sample.report?.categories?.gc?.heapMb?.actual)).filter(value => Number.isFinite(value) && value > 0);
const browserHeap = samples.map(sample => Number(sample.jsHeapMb)).filter(value => Number.isFinite(value) && value > 0);
const heapSeries = cdpHeap.length >= 6 ? cdpHeap : diagnosticHeap.length >= 6 ? diagnosticHeap : browserHeap;
const heapSource = cdpHeap.length >= 6 ? 'cdp-runtime-heap' : diagnosticHeap.length >= 6 ? 'performance-diagnostics' : browserHeap.length ? 'performance.memory' : 'unavailable';
const frameBaseline = edgeMedian(frameP95);
const frameFinal = edgeMedian(frameP95, true);
const heapBaseline = edgeMedian(heapSeries);
const heapFinal = edgeMedian(heapSeries, true);
const frameDelta = frameBaseline != null && frameFinal != null ? frameFinal - frameBaseline : null;
const heapDelta = heapBaseline != null && heapFinal != null ? heapFinal - heapBaseline : null;
const frameRegressed = frameBaseline != null && frameFinal != null && frameFinal > frameBaseline * 1.5 && frameFinal - frameBaseline > 8;
const heapRegressed = heapBaseline != null && heapFinal != null && heapFinal - heapBaseline > Math.max(96, heapBaseline * 0.5);

const settledAfterMs = Math.min(60_000, durationMs * 0.1);
const settled = samples.filter(sample => sample.atMs >= settledAfterMs);
const resourceKeys = ['meshes', 'materials', 'textures', 'roots'];
const resourceSummary = {};
let resourceRegressed = false;
for (const key of resourceKeys) {
  const values = settled.map(sample => Number(parsePipeStats(sample.sceneTelemetry)[key])).filter(Number.isFinite);
  const baseline = edgeMedian(values);
  const final = edgeMedian(values, true);
  const allowance = key === 'meshes' ? 16 : 6;
  const regressed = baseline != null && final != null && final > baseline * 1.35 + allowance;
  resourceSummary[key] = { baseline, final, delta: baseline != null && final != null ? final - baseline : null, regressed };
  resourceRegressed ||= regressed;
}

const cachedSeries = settled.map(sample => Number(parsePipeStats(sample.geometryStats).cached)).filter(Number.isFinite);
const cachedBaseline = edgeMedian(cachedSeries);
const cachedFinal = edgeMedian(cachedSeries, true);
const cachedRegressed = cachedBaseline != null && cachedFinal != null && cachedFinal > cachedBaseline * 1.35 + 2;
resourceSummary.cachedAssets = {
  baseline: cachedBaseline,
  final: cachedFinal,
  delta: cachedBaseline != null && cachedFinal != null ? cachedFinal - cachedBaseline : null,
  regressed: cachedRegressed,
};
resourceRegressed ||= cachedRegressed;

const cacheBudgetViolations = samples.flatMap(sample => {
  const cached = Number(parsePipeStats(sample.geometryStats).cached);
  const budget = Number(parsePipeStats(sample.resourceBudget)['cache-assets']);
  return Number.isFinite(cached) && Number.isFinite(budget) && cached > budget
    ? [{ atMs: sample.atMs, cached, budget }]
    : [];
});

const invalidBackendSamples = samples.filter(sample =>
  sample.graphicsLoaded !== 'babylon'
  || sample.backendLoaded !== 'webgl2'
  || sample.init !== 'ready'
  || sample.scene !== 'active'
  || sample.disposed !== 'false'
).length;

const summary = {
  schema: 'p27-d6-babylon-resource-stability-v1',
  requestedMinutes: soakMinutes,
  elapsedSeconds,
  sampleCount: samples.length,
  requiredSamples: minimumSamples,
  cycleEverySeconds: Math.round(cycleEveryMs / 1000),
  requiredCycles,
  completedCycles: cycles.length,
  activity: { inputBursts, restartActions, rerunActions },
  backend: { requested: 'babylon', loaded: 'babylon', babylonBackend: 'webgl2', invalidSamples: invalidBackendSamples },
  frameP95: { baselineMs: frameBaseline, finalMs: frameFinal, deltaMs: frameDelta, regressed: frameRegressed },
  heap: {
    source: heapSource,
    baselineMb: heapBaseline,
    finalMb: heapFinal,
    deltaMb: heapDelta,
    regressed: heapRegressed,
    coarsePerformanceMemory: {
      baselineMb: edgeMedian(browserHeap),
      finalMb: edgeMedian(browserHeap, true),
    },
  },
  resources: {
    ...resourceSummary,
    cacheBudgetViolations,
    disposalCyclesReclaimed: cycles.every(cycle => cycle.disposed?.cacheReclaimed === 'true'),
    postDisposalGcHeapMb: cycles.map(cycle => cycle.disposed?.heapAfterGc?.usedMb).filter(Number.isFinite),
  },
  final: samples.at(-1) ?? null,
};

writeFileSync(reportPath, JSON.stringify({ summary, cycles, samples }, null, 2) + '\n');

if (samples.length < minimumSamples) throw new Error('Insufficient P27-D6 soak telemetry samples: ' + samples.length + ' < ' + minimumSamples);
if (cycles.length < requiredCycles) throw new Error('Insufficient P27-D6 mission lifecycle cycles: ' + cycles.length + ' < ' + requiredCycles);
if (invalidBackendSamples > 0) throw new Error('P27-D6 observed invalid Babylon backend samples: ' + invalidBackendSamples);
if (cacheBudgetViolations.length > 0) throw new Error('P27-D6 Babylon asset cache exceeded configured budget: ' + JSON.stringify(cacheBudgetViolations.slice(0, 4)));
if (frameRegressed) throw new Error('P27-D6 sustained frame pacing regressed: baseline=' + frameBaseline + 'ms final=' + frameFinal + 'ms');
if (heapRegressed) throw new Error('P27-D6 sustained JS heap growth exceeded leak gate: baseline=' + heapBaseline + 'MB final=' + heapFinal + 'MB');
if (resourceRegressed) throw new Error('P27-D6 persistent Babylon scene/cache resource growth detected: ' + JSON.stringify(resourceSummary));

console.log('ANDROID_P27D6_BABYLON_SOAK_PASS duration=' + elapsedSeconds
  + 's samples=' + samples.length
  + ' cycles=' + cycles.length
  + ' inputBursts=' + inputBursts
  + ' frameBaseline=' + (frameBaseline ?? 'na')
  + ' frameFinal=' + (frameFinal ?? 'na')
  + ' heapBaseline=' + (heapBaseline ?? 'na')
  + ' heapFinal=' + (heapFinal ?? 'na')
  + ' cacheBaseline=' + (cachedBaseline ?? 'na')
  + ' cacheFinal=' + (cachedFinal ?? 'na')
  + ' heapSource=' + heapSource
  + ' postDisposalGc=' + cycles.map(cycle => cycle.disposed?.heapAfterGc?.usedMb ?? 'na').join(',')
  + ' report=' + reportPath);

session.close();
