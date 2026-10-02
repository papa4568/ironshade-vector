import { writeFileSync } from 'node:fs';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const phase = process.env.ANDROID_LARGE_SCREEN_PHASE ?? 'portrait';
const reportPath = process.env.ANDROID_LARGE_SCREEN_REPORT_PATH ?? `android-large-screen-${phase}.json`;
const sentinelToken = 'ironshade-p25b-live-resize';
const timeoutMs = Number(process.env.ANDROID_LARGE_SCREEN_TIMEOUT_MS ?? 45_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (!['portrait', 'resized'].includes(phase)) {
  throw new Error(`Unsupported ANDROID_LARGE_SCREEN_PHASE: ${phase}`);
}
if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for Android large-screen smoke testing.');
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
      reject(new Error('Timed out connecting to Android WebView CDP socket'));
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

  function call(method, params = {}, timeout = 10_000) {
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for CDP ${method}`));
      }, timeout);
      pending.set(id, {
        resolve: value => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: error => {
          clearTimeout(timer);
          reject(error);
        },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const response = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
    }
    return response.result?.value;
  }

  return { call, evaluate };
}

async function waitForSession() {
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const targets = await listTargets();
      const target = targets.find(candidate => candidate.webSocketDebuggerUrl && candidate.title === 'Ironshade Vector');
      if (target) {
        const socket = await connect(target.webSocketDebuggerUrl);
        const session = createSession(socket);
        await session.call('Runtime.enable');
        const ready = await session.evaluate('document.readyState');
        if (ready === 'complete' || ready === 'interactive') return { socket, session };
        socket.close();
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for Ironshade Vector WebView${lastError ? `: ${String(lastError)}` : ''}`);
}

const { socket, session } = await waitForSession();
const metrics = await session.evaluate(`(() => {
  const root = document.documentElement;
  const body = document.body;
  const viewport = window.visualViewport;
  return {
    title: document.title,
    href: location.href,
    readyState: document.readyState,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualWidth: viewport?.width ?? window.innerWidth,
    visualHeight: viewport?.height ?? window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    rootClientWidth: root?.clientWidth ?? 0,
    rootScrollWidth: root?.scrollWidth ?? 0,
    bodyClientWidth: body?.clientWidth ?? 0,
    bodyScrollWidth: body?.scrollWidth ?? 0,
    orientation: screen.orientation?.type ?? 'unknown',
    sentinel: window.__ironshadeP25BLargeScreenSentinel ?? null,
    babylon: (() => { const canvas = document.querySelector('canvas'); return { selection: canvas?.dataset.graphicsPathSelection ?? '', requested: canvas?.dataset.graphicsPathRequested ?? '', graphicsLoaded: canvas?.dataset.graphicsPathLoaded ?? '', backendRequested: canvas?.dataset.babylonBackendRequested ?? '', backendLoaded: canvas?.dataset.babylonBackendLoaded ?? '', init: canvas?.dataset.babylonInit ?? '', scene: canvas?.dataset.babylonScene ?? '', disposed: canvas?.dataset.babylonDisposed ?? '', disposeCount: Number(canvas?.dataset.babylonDisposeCount ?? '0'), frames: Number(canvas?.dataset.babylonFrames ?? '0') }; })(),
  };
})()`);

const width = Math.round(metrics.visualWidth);
const height = Math.round(metrics.visualHeight);
const smallestWidth = Math.min(width, height);
if (metrics.title !== 'Ironshade Vector') throw new Error(`Unexpected app title: ${metrics.title}`);
if (!/localhost/i.test(metrics.href ?? '')) throw new Error(`Unexpected WebView URL: ${metrics.href}`);
if (smallestWidth < 600) {
  throw new Error(`Large-screen viewport did not reach 600dp/CSS-px minimum: ${width}x${height}`);
}
if (metrics.rootScrollWidth > metrics.rootClientWidth + 2 || metrics.bodyScrollWidth > metrics.bodyClientWidth + 2) {
  throw new Error(`Horizontal overflow detected: root=${metrics.rootScrollWidth}/${metrics.rootClientWidth} body=${metrics.bodyScrollWidth}/${metrics.bodyClientWidth}`);
}

if (metrics.babylon.selection !== 'qa-explicit'
  || metrics.babylon.requested !== 'babylon'
  || metrics.babylon.graphicsLoaded !== 'babylon'
  || metrics.babylon.backendRequested !== 'webgl2'
  || metrics.babylon.backendLoaded !== 'webgl2'
  || metrics.babylon.init !== 'ready'
  || metrics.babylon.scene !== 'active'
  || metrics.babylon.disposed !== 'false'
  || metrics.babylon.frames < 1) {
  throw new Error(`P27-D5 Babylon large-screen renderer is not active: ${JSON.stringify(metrics.babylon)}`);
}

let babylonRendererPreserved = null;
if (phase === 'portrait') {
  if (height <= width) throw new Error(`Expected portrait large-screen launch, got ${width}x${height}`);
  await session.evaluate(`(() => { window.__ironshadeP25BLargeScreenSentinel = ${JSON.stringify(sentinelToken)}; window.__ironshadeP27D5LargeScreenCanvas = document.querySelector('canvas'); return ${JSON.stringify(sentinelToken)}; })()`);
} else {
  if (width <= height) throw new Error(`Expected resized landscape-style window, got ${width}x${height}`);
  if (metrics.sentinel !== sentinelToken) {
    throw new Error(`WebView was recreated during live large-screen resize: sentinel=${JSON.stringify(metrics.sentinel)}`);
  }
  babylonRendererPreserved = await session.evaluate(`window.__ironshadeP27D5LargeScreenCanvas === document.querySelector('canvas')`);
  if (!babylonRendererPreserved) throw new Error('P27-D5 Babylon renderer surface was recreated during live large-screen resize.');
}

const report = {
  phase,
  ...metrics,
  smallestWidth,
  horizontalOverflow: false,
  webViewPreserved: phase === 'resized' ? metrics.sentinel === sentinelToken : null,
  babylonRendererPreserved,
};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`ANDROID_P25B_LARGE_SCREEN_PHASE_PASS phase=${phase} viewport=${width}x${height} sw=${smallestWidth} orientation=${metrics.orientation} overflow=none preserved=${phase === 'resized' ? 'true' : 'armed'} babylon=webgl2 renderer=${phase === 'resized' ? 'preserved' : 'armed'}`);
socket.close();
