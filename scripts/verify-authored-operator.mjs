const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const timeoutMs = Number(process.env.AUTHORED_OPERATOR_TIMEOUT_MS ?? 20_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for authored-operator verification.');
}

async function listTargets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
  return await response.json();
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to authored-operator CDP target')), 5_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error(`Authored-operator CDP socket error: ${String(event?.message ?? 'unknown')}`));
    }, { once: true });
  });
}

async function createSession() {
  let lastTargets = [];
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
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
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`Timed out finding Ironshade CDP target; targets=${JSON.stringify(lastTargets)}${lastError ? ` error=${lastError}` : ''}`);
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
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.operatorVisual);
      if (!canvas) return { visual: '', asset: '', canvases: document.querySelectorAll('canvas').length };
      const rect = canvas.getBoundingClientRect();
      return {
        visual: canvas.dataset.operatorVisual ?? '',
        asset: canvas.dataset.operatorAsset ?? '',
        rig: canvas.dataset.operatorRig ?? '',
        socket: canvas.dataset.operatorSocket ?? '',
        animation: canvas.dataset.operatorAnimation ?? '',
        blend: canvas.dataset.operatorBlend ?? '',
        canvases: document.querySelectorAll('canvas').length,
        width: rect.width,
        height: rect.height,
      };
    })()`);

    if (lastState?.visual === 'procedural-fallback') {
      throw new Error(`Authored operator entered procedural fallback: ${JSON.stringify(lastState)}`);
    }
    if (lastState?.visual?.startsWith('authored-')) {
      if (lastState.asset !== 'operator-field-suit-lod1') {
        throw new Error(`Unexpected authored operator asset: ${JSON.stringify(lastState)}`);
      }
      if (lastState.rig !== 'articulated' || lastState.socket !== 'weapon-socket') {
        throw new Error(`Authored operator rig/socket contract is not active: ${JSON.stringify(lastState)}`);
      }
      if (!['idle', 'locomotion', 'recoil', 'reload', 'dodge', 'hit', 'down'].includes(lastState.animation)) {
        throw new Error(`Unexpected authored operator animation state: ${JSON.stringify(lastState)}`);
      }
      if (!/move:\d+\.\d+,recoil:\d+\.\d+,reload:\d+\.\d+,dodge:\d+\.\d+,hit:\d+\.\d+/.test(lastState.blend)) {
        throw new Error(`Authored operator animation blend telemetry is missing: ${JSON.stringify(lastState)}`);
      }
      if (!(lastState.width > 0 && lastState.height > 0)) {
        throw new Error(`Authored operator canvas is not visible: ${JSON.stringify(lastState)}`);
      }
      console.log(`AUTHORED_OPERATOR_RUNTIME_PASS visual=${lastState.visual} asset=${lastState.asset} rig=${lastState.rig} socket=${lastState.socket} animation=${lastState.animation} blend=${lastState.blend} canvas=${Math.round(lastState.width)}x${Math.round(lastState.height)}`);
      process.exitCode = 0;
      break;
    }
    await sleep(200);
  }

  if (!lastState?.visual?.startsWith('authored-')) {
    throw new Error(`Timed out waiting for authored operator GLB to replace the procedural fallback: ${JSON.stringify(lastState)}`);
  }
} finally {
  socket.close();
}
