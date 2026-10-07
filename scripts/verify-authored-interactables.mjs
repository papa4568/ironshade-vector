const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const timeoutMs = Number(process.env.AUTHORED_INTERACTABLE_TIMEOUT_MS ?? 20_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for authored-interactable verification.');
}

async function listTargets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
  return await response.json();
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to authored-interactable CDP target')), 5_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error(`Authored-interactable CDP socket error: ${String(event?.message ?? 'unknown')}`));
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
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.interactableVisual);
      if (!canvas) return { visual: '', assets: '', fallback: '', mode: '', lootVisual: '', lootAsset: '', canvases: document.querySelectorAll('canvas').length };
      const rect = canvas.getBoundingClientRect();
      return {
        visual: canvas.dataset.interactableVisual ?? '',
        assets: canvas.dataset.interactableAssets ?? '',
        fallback: canvas.dataset.interactableFallback ?? '',
        mode: canvas.dataset.interactableMode ?? '',
        lootVisual: canvas.dataset.lootVisual ?? '',
        lootAsset: canvas.dataset.lootAsset ?? '',
        lootReadability: canvas.dataset.lootReadability ?? '',
        renderTier: canvas.dataset.renderTier ?? '',
        canvases: document.querySelectorAll('canvas').length,
        width: rect.width,
        height: rect.height,
      };
    })()`);

    if (lastState?.fallback || lastState?.visual?.includes('fallback')) {
      throw new Error(`Authored interactable entered procedural fallback: ${JSON.stringify(lastState)}`);
    }
    if (lastState?.lootVisual?.includes('fallback')) {
      throw new Error(`Authored loot pickup entered procedural fallback: ${JSON.stringify(lastState)}`);
    }

    if (!['high', 'balanced', 'performance'].includes(lastState?.renderTier)) {
      throw new Error(`Authored interactable render tier telemetry is missing: ${JSON.stringify(lastState)}`);
    }
    const expectedLod = lastState.renderTier === 'performance' ? 2 : 1;
    const assets = new Set(String(lastState?.assets ?? '').split(',').filter(Boolean));
    const legacyControlAsset = `interactable-control-terminal-lod${expectedLod}`;
    const refineryControlAsset = `refinery-terminal-lod${expectedLod}`;
    const controlAsset = assets.has(refineryControlAsset) ? refineryControlAsset : legacyControlAsset;
    const validMode = controlAsset === refineryControlAsset
      ? lastState.mode === 'refinery-family-mapped'
      : lastState.mode === 'control-terminal+salvage-tag-node';
    if (lastState?.visual === 'authored-babylon' && assets.has(controlAsset)) {
      if (!validMode) {
        throw new Error(`Unexpected authored interactable mode: ${JSON.stringify(lastState)}`);
      }
      if (!(lastState.width > 0 && lastState.height > 0)) {
        throw new Error(`Authored interactable canvas is not visible: ${JSON.stringify(lastState)}`);
      }
      if (lastState.lootVisual === 'authored-babylon') {
        const expectedPickup = `pickup-recovery-capsule-lod${expectedLod}`;
        if (lastState.lootAsset !== expectedPickup || lastState.lootReadability !== 'authored-capsule+rarity-shape+ring+beam') {
          throw new Error(`Unexpected authored Babylon loot runtime state: ${JSON.stringify(lastState)}`);
        }
      }
      console.log(`AUTHORED_INTERACTABLE_RUNTIME_PASS control=${controlAsset} tier=${lastState.renderTier} lod=${expectedLod} assets=${[...assets].sort().join(',')} loot=${lastState.lootAsset || 'pending-no-drop'} canvas=${Math.round(lastState.width)}x${Math.round(lastState.height)}`);
      process.exitCode = 0;
      break;
    }
    await sleep(200);
  }

  const expectedLod = lastState?.renderTier === 'performance' ? 2 : 1;
  const assets = new Set(String(lastState?.assets ?? '').split(',').filter(Boolean));
  const expectedControlAssets = [
    `interactable-control-terminal-lod${expectedLod}`,
    `refinery-terminal-lod${expectedLod}`,
  ];
  if (lastState?.visual !== 'authored-babylon'
    || !['high', 'balanced', 'performance'].includes(lastState?.renderTier)
    || !expectedControlAssets.some(asset => assets.has(asset))) {
    throw new Error(`Timed out waiting for authored Babylon mission interactables: ${JSON.stringify(lastState)}`);
  }
} finally {
  socket.close();
}
