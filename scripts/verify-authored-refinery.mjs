const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const timeoutMs = Number(process.env.AUTHORED_REFINERY_TIMEOUT_MS ?? 25_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for authored-refinery verification.');
}

async function listTargets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
  return await response.json();
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to authored-refinery CDP target')), 5_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error(`Authored-refinery CDP socket error: ${String(event?.message ?? 'unknown')}`));
    }, { once: true });
  });
}

async function createSession() {
  let lastTargets = [];
  while (Date.now() - startedAt < timeoutMs) {
    const targets = await listTargets();
    lastTargets = targets;
    const target = targets.find(candidate => candidate.webSocketDebuggerUrl && candidate.title === 'Ironshade Vector')
      ?? targets.find(candidate => candidate.webSocketDebuggerUrl && /ironshade/i.test(candidate.title ?? ''));
    if (target) {
      const socket = await connect(target.webSocketDebuggerUrl);
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
      const call = (method, params = {}) => {
        const id = ++requestId;
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`Timed out waiting for CDP ${method}`));
          }, 5_000);
          pending.set(id, {
            resolve: value => { clearTimeout(timer); resolve(value); },
            reject: error => { clearTimeout(timer); reject(error); },
          });
          socket.send(JSON.stringify({ id, method, params }));
        });
      };
      await call('Runtime.enable');
      return { socket, call };
    }
    await sleep(250);
  }
  throw new Error(`Timed out finding Ironshade CDP target; targets=${JSON.stringify(lastTargets)}`);
}

const { socket, call } = await createSession();

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

try {
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual);
      if (!canvas) return { visual: '', kit: '', lod: '', instances: 0, terminals: 0, canvases: document.querySelectorAll('canvas').length };
      const rect = canvas.getBoundingClientRect();
      return {
        visual: canvas.dataset.environmentVisual ?? '',
        kit: canvas.dataset.environmentKit ?? '',
        lod: canvas.dataset.environmentLod ?? '',
        instances: Number(canvas.dataset.environmentInstances ?? 0),
        terminals: Number(canvas.dataset.environmentTerminals ?? 0),
        canvases: document.querySelectorAll('canvas').length,
        width: rect.width,
        height: rect.height,
      };
    })()`);

    if (lastState?.visual === 'procedural-fallback') {
      throw new Error(`Authored Asteroid Refinery entered procedural fallback: ${JSON.stringify(lastState)}`);
    }

    if (lastState?.visual === 'authored-refinery') {
      const expectedKit = new Set(['floor', 'bulkhead', 'processor', 'pipe-rack', 'crate', 'terminal']);
      const kit = new Set(String(lastState.kit ?? '').split(',').filter(Boolean));
      if (![...expectedKit].every(item => kit.has(item))) {
        throw new Error(`Authored refinery kit is incomplete: ${JSON.stringify(lastState)}`);
      }
      if (!String(lastState.lod).split(',').every(value => value === '1' || value === '2')) {
        throw new Error(`Unexpected authored refinery LOD: ${JSON.stringify(lastState)}`);
      }
      if (!(lastState.instances >= 40)) {
        throw new Error(`Authored refinery instancing coverage is too low: ${JSON.stringify(lastState)}`);
      }
      if (!(lastState.terminals >= 1)) {
        throw new Error(`Authored refinery interactive terminals were not mounted: ${JSON.stringify(lastState)}`);
      }
      if (!(lastState.width > 0 && lastState.height > 0)) {
        throw new Error(`Authored refinery canvas is not visible: ${JSON.stringify(lastState)}`);
      }
      console.log(`AUTHORED_REFINERY_RUNTIME_PASS lod=${lastState.lod} kit=${[...kit].sort().join(',')} instances=${lastState.instances} terminals=${lastState.terminals} canvas=${Math.round(lastState.width)}x${Math.round(lastState.height)}`);
      process.exitCode = 0;
      break;
    }

    await sleep(200);
  }

  if (lastState?.visual !== 'authored-refinery') {
    throw new Error(`Timed out waiting for authored Asteroid Refinery environment: ${JSON.stringify(lastState)}`);
  }
} finally {
  socket.close();
}
