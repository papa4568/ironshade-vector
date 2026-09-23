const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const timeoutMs = Number(process.env.AUTHORED_WEAPON_TIMEOUT_MS ?? 20_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for authored-weapon verification.');
}

async function listTargets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
  return await response.json();
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to authored-weapon CDP target')), 5_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error(`Authored-weapon CDP socket error: ${String(event?.message ?? 'unknown')}`));
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
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.weaponVisual);
      if (!canvas) return { visual: '', roles: '', fallback: '', active: '', asset: '', fx: '', canvases: document.querySelectorAll('canvas').length };
      const rect = canvas.getBoundingClientRect();
      return {
        visual: canvas.dataset.weaponVisual ?? '',
        roles: canvas.dataset.weaponRoles ?? '',
        fallback: canvas.dataset.weaponFallback ?? '',
        active: canvas.dataset.weaponActive ?? '',
        asset: canvas.dataset.weaponAsset ?? '',
        fx: canvas.dataset.weaponFx ?? '',
        heat: canvas.dataset.weaponHeat ?? '',
        canvases: document.querySelectorAll('canvas').length,
        width: rect.width,
        height: rect.height,
      };
    })()`);

    if (lastState?.fallback) {
      throw new Error(`Authored weapon asset entered procedural fallback: ${JSON.stringify(lastState)}`);
    }

    const roles = new Set(String(lastState?.roles ?? '').split(',').filter(Boolean));
    const allRoles = ['carbine', 'breacher', 'rail'].every(role => roles.has(role));
    if (lastState?.visual === 'authored' && allRoles) {
      if (!['carbine', 'breacher', 'rail'].includes(lastState.active)) {
        await sleep(200);
        continue;
      }
      const mobileViewport = ['mobile-landscape', 'android-emulator'].includes(process.env.BROWSER_E2E_VIEWPORT ?? '');
      const expectedLod = mobileViewport ? 2 : 1;
      if (lastState.asset !== `weapon-${lastState.active}-lod${expectedLod}`) {
        throw new Error(`Unexpected authored weapon asset id for LOD${expectedLod}: ${JSON.stringify(lastState)}`);
      }
      const expectedFx = lastState.active === 'rail' ? 'lance' : lastState.active === 'breacher' ? 'scatter' : 'tracer';
      if (lastState.fx !== expectedFx) {
        throw new Error(`Unexpected authored weapon FX language: ${JSON.stringify(lastState)}`);
      }
      if (!(lastState.width > 0 && lastState.height > 0)) {
        throw new Error(`Authored weapon canvas is not visible: ${JSON.stringify(lastState)}`);
      }
      console.log(`AUTHORED_WEAPON_RUNTIME_PASS active=${lastState.active} asset=${lastState.asset} roles=${[...roles].sort().join(',')} fx=${lastState.fx} heat=${lastState.heat} canvas=${Math.round(lastState.width)}x${Math.round(lastState.height)}`);
      process.exitCode = 0;
      break;
    }
    await sleep(200);
  }

  const roles = new Set(String(lastState?.roles ?? '').split(',').filter(Boolean));
  const activeWeapon = ['carbine', 'breacher', 'rail'].includes(lastState?.active) ? lastState.active : null;
  const expectedLod = ['mobile-landscape', 'android-emulator'].includes(process.env.BROWSER_E2E_VIEWPORT ?? '') ? 2 : 1;
  const activeAuthored = activeWeapon && lastState?.asset === `weapon-${activeWeapon}-lod${expectedLod}`;
  if (lastState?.visual !== 'authored' || !['carbine', 'breacher', 'rail'].every(role => roles.has(role)) || !activeAuthored) {
    throw new Error(`Timed out waiting for active authored weapon asset: ${JSON.stringify(lastState)}`);
  }
} finally {
  socket.close();
}
