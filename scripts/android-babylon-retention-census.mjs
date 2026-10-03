import fs from 'node:fs';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const outputPath = process.env.ANDROID_P27D6_CENSUS_OUTPUT ?? 'android-p27d6-retention-census.jsonl';
const intervalMs = Number(process.env.ANDROID_P27D6_CENSUS_INTERVAL_MS ?? 30_000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') throw new Error('Node WebSocket support is required for Babylon retention census QA.');

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
  const evaluate = async (expression, timeoutMs = 5_000) => {
    const response = await call('Runtime.evaluate', { expression, returnByValue: true }, timeoutMs);
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
    return response.result?.value;
  };
  return { call, evaluate, close: () => socket.close() };
}

async function waitForSession(timeoutMs = 120_000) {
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
          const probe = await session.evaluate('({ title: document.title, url: location.href })');
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
  throw new Error(`Timed out waiting for Ironshade WebView retention census target: ${String(lastError ?? 'no target')}`);
}

async function queryPrototypeInstances(call, name, sampleId) {
  const objectGroup = `p27d6-census-${sampleId}-${name}`;
  try {
    const prototypeResult = await call('Runtime.evaluate', {
      expression: `globalThis.__ironshadeP27D6BabylonPrototypes?.[${JSON.stringify(name)}]`,
      objectGroup,
      returnByValue: false,
    }, 5_000);
    const prototypeObjectId = prototypeResult.result?.objectId;
    if (!prototypeObjectId) return null;

    const queryResult = await call('Runtime.queryObjects', {
      prototypeObjectId,
      objectGroup,
    }, 10_000);
    const objectsObjectId = queryResult.objects?.objectId;
    if (!objectsObjectId) return null;

    const summaryResult = await call('Runtime.callFunctionOn', {
      objectId: objectsObjectId,
      objectGroup,
      returnByValue: true,
      functionDeclaration: `function () {
        const values = Array.from(this);
        const disposed = values.filter(value => Boolean(value?.disposed || value?.isDisposed || value?._isDisposed)).length;
        const sceneDisposed = values.filter(value => Boolean(value?.scene?.isDisposed)).length;
        const meshCount = values.reduce((sum, value) => sum + (Array.isArray(value?.meshes) ? value.meshes.length : 0), 0);
        const rootCount = values.reduce((sum, value) => sum + (Array.isArray(value?.rootNodes) ? value.rootNodes.length : 0), 0);
        return { total: values.length, disposed, sceneDisposed, meshCount, rootCount };
      }`,
    }, 10_000);
    return summaryResult.result?.value ?? null;
  } finally {
    await call('Runtime.releaseObjectGroup', { objectGroup }, 5_000).catch(() => undefined);
  }
}

const session = await waitForSession();
const { call, evaluate } = session;
await call('HeapProfiler.enable', {}, 5_000);
fs.writeFileSync(outputPath, '');
let sampleId = 0;

try {
  while (true) {
    const startedAt = Date.now();
    try {
      const qaReady = await evaluate(`location.search.includes('p27d6Soak=1') && Boolean(globalThis.__ironshadeP27D6BabylonPrototypes)`);
      if (!qaReady) {
        console.log('ANDROID_P27D6_CENSUS_WAIT prototypes=unavailable');
      } else {
        await call('HeapProfiler.collectGarbage', {}, 20_000);
        await sleep(150);
        const heap = await call('Runtime.getHeapUsage', {}, 10_000).catch(() => null);
        const dom = await call('Memory.getDOMCounters', {}, 10_000).catch(() => null);
        const census = {};
        for (const name of ['assetRuntime', 'scene', 'engine', 'assetContainer']) {
          census[name] = await queryPrototypeInstances(call, name, sampleId);
        }
        const canvas = await evaluate(`(() => {
          const value = document.querySelector('canvas');
          return value ? {
            connected: value.isConnected,
            disposed: value.dataset.babylonDisposed ?? '',
            disposeCount: Number(value.dataset.babylonDisposeCount || 0),
            frames: Number(value.dataset.babylonFrames || 0),
          } : null;
        })()`);
        const sample = {
          sample: sampleId,
          at: new Date().toISOString(),
          heapUsedMb: typeof heap?.usedSize === 'number' ? heap.usedSize / 1048576 : null,
          heapTotalMb: typeof heap?.totalSize === 'number' ? heap.totalSize / 1048576 : null,
          dom: dom ? { documents: dom.documents, nodes: dom.nodes, jsEventListeners: dom.jsEventListeners } : null,
          canvas,
          census,
        };
        fs.appendFileSync(outputPath, `${JSON.stringify(sample)}\n`);
        console.log(`ANDROID_P27D6_CENSUS sample=${sampleId} heap=${sample.heapUsedMb ?? 'na'} runtime=${census.assetRuntime?.total ?? 'na'}/${census.assetRuntime?.disposed ?? 'na'} scene=${census.scene?.total ?? 'na'}/${census.scene?.disposed ?? 'na'} engine=${census.engine?.total ?? 'na'}/${census.engine?.disposed ?? 'na'} containers=${census.assetContainer?.total ?? 'na'} containerDisposedScenes=${census.assetContainer?.sceneDisposed ?? 'na'} dom=${dom?.documents ?? 'na'}/${dom?.nodes ?? 'na'}/${dom?.jsEventListeners ?? 'na'}`);
        sampleId += 1;
      }
    } catch (error) {
      console.warn(`ANDROID_P27D6_CENSUS_SAMPLE_ERROR ${String(error)}`);
    }
    const delay = Math.max(1_000, intervalMs - (Date.now() - startedAt));
    await sleep(delay);
  }
} finally {
  session.close();
}
