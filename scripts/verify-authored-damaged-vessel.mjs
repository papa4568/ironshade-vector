const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const timeoutMs = Number(process.env.AUTHORED_DAMAGED_VESSEL_TIMEOUT_MS ?? 45_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for authored Damaged Vessel verification.');
}

async function listTargets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
  return await response.json();
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to authored Damaged Vessel CDP target')), 5_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error(`Authored Damaged Vessel CDP socket error: ${String(event?.message ?? 'unknown')}`));
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
        try { message = JSON.parse(String(event.data)); } catch { return; }
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
  const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
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
      if (!canvas) return { visual: '', canvases: document.querySelectorAll('canvas').length };
      const rect = canvas.getBoundingClientRect();
      return {
        visual: canvas.dataset.environmentVisual ?? '',
        kit: canvas.dataset.environmentKit ?? '',
        lod: canvas.dataset.environmentLod ?? '',
        instances: Number(canvas.dataset.environmentInstances ?? 0),
        landmark: canvas.dataset.environmentLandmark ?? '',
        serviceDetails: canvas.dataset.environmentServiceDetails ?? '',
        surfaceDetail: canvas.dataset.environmentSurfaceDetail ?? '',
        composition: canvas.dataset.environmentComposition ?? '',
        materials: canvas.dataset.environmentMaterials ?? '',
        vfx: canvas.dataset.environmentVfx ?? '',
        environmentLighting: canvas.dataset.environmentLighting ?? '',
        environmentTone: canvas.dataset.environmentTone ?? '',
        readability: canvas.dataset.readabilityLanguage ?? '',
        locationArt: canvas.dataset.locationArt ?? '',
        locationLighting: canvas.dataset.locationLighting ?? '',
        locationProps: canvas.dataset.locationProps ?? '',
        renderTier: canvas.dataset.renderTier ?? '',
        renderBudget: canvas.dataset.renderBudget ?? '',
        width: rect.width,
        height: rect.height,
      };
    })()`);

    if (lastState?.visual === 'procedural-fallback') {
      throw new Error(`Authored Damaged Vessel entered procedural fallback: ${JSON.stringify(lastState)}`);
    }

    if (lastState?.visual === 'authored-damaged-vessel') {
      const expectedKit = new Set(['broken-rib', 'breach-frame', 'salvage-rack', 'torn-plate', 'service-bundle']);
      const kit = new Set(String(lastState.kit ?? '').split(',').filter(Boolean));
      if (![...expectedKit].every(item => kit.has(item))) throw new Error(`Authored Damaged Vessel kit is incomplete: ${JSON.stringify(lastState)}`);
      if (!String(lastState.lod).split(',').every(value => value === '1' || value === '2')) throw new Error(`Unexpected Damaged Vessel LOD: ${JSON.stringify(lastState)}`);
      if (!(lastState.instances >= 50)) throw new Error(`Damaged Vessel instancing coverage is too low: ${JSON.stringify(lastState)}`);
      if (lastState.landmark !== 'starboard-hull-breach') throw new Error(`Damaged Vessel breach landmark is missing: ${JSON.stringify(lastState)}`);
      if (lastState.serviceDetails !== 'salvage-rack:6+service-bundle:5') throw new Error(`Damaged Vessel salvage/service coverage is incomplete: ${JSON.stringify(lastState)}`);
      if (lastState.surfaceDetail !== 'broken-rib:5+torn-plate:6+scorch:6') throw new Error(`Damaged Vessel surface damage coverage is incomplete: ${JSON.stringify(lastState)}`);
      if (lastState.composition !== 'broken-rib-corridor+starboard-breach+torn-shell+perimeter-salvage') throw new Error(`Damaged Vessel composition contract is missing: ${JSON.stringify(lastState)}`);
      if (lastState.materials !== 'scarred-hull+torn-edge+warning-emissive+salvage-status') throw new Error(`Damaged Vessel material language is missing: ${JSON.stringify(lastState)}`);
      if (lastState.vfx !== 'breach-vapor:18+scorch:6') throw new Error(`Damaged Vessel bounded breach VFX are missing: ${JSON.stringify(lastState)}`);
      if (!/^damaged-vessel-emergency:breach\+salvage\+contact:player\+enemy\+practical:[12]\+shadow:key$/.test(lastState.environmentLighting)) throw new Error(`Damaged Vessel emergency lighting recipe is missing: ${JSON.stringify(lastState)}`);
      if (!/^aces-\d+\.\d{2}$/.test(lastState.environmentTone)) throw new Error(`Damaged Vessel authored tone telemetry is malformed: ${JSON.stringify(lastState)}`);
      if (lastState.readability !== 'silhouette+damage-edge+breach-vapor+luminance') throw new Error(`Damaged Vessel readability language is missing: ${JSON.stringify(lastState)}`);
      if (!String(lastState.locationArt).startsWith('damaged-vessel:broken-ribs:scarred-hull')) throw new Error(`Damaged Vessel campaign art identity is not active: ${JSON.stringify(lastState)}`);
      if (!String(lastState.locationLighting).startsWith('damaged-vessel:emergency-amber:aces-')) throw new Error(`Damaged Vessel lighting profile is not active: ${JSON.stringify(lastState)}`);
      if (lastState.locationProps !== 'salvage-cases:instanced-shared-library') throw new Error(`Damaged Vessel shared salvage props are not active: ${JSON.stringify(lastState)}`);
      if (!['high', 'balanced', 'performance'].includes(lastState.renderTier)) throw new Error(`Adaptive render tier telemetry is missing: ${JSON.stringify(lastState)}`);
      if (!/^pixel:\d+\.\d{2}\+shadow:\d+\+vfx:\d+\.\d{2}\+transparency:\d+\.\d{2}\+detail:\d+\.\d{2}$/.test(lastState.renderBudget)) throw new Error(`Adaptive render budget telemetry is malformed: ${JSON.stringify(lastState)}`);
      if (!(lastState.width > 0 && lastState.height > 0)) throw new Error(`Authored Damaged Vessel canvas is not visible: ${JSON.stringify(lastState)}`);
      console.log(`AUTHORED_DAMAGED_VESSEL_RUNTIME_PASS lod=${lastState.lod} kit=${[...kit].sort().join(',')} instances=${lastState.instances} landmark=${lastState.landmark} service=${lastState.serviceDetails} surface=${lastState.surfaceDetail} composition=${lastState.composition} materials=${lastState.materials} vfx=${lastState.vfx} lighting=${lastState.environmentLighting} tone=${lastState.environmentTone} readability=${lastState.readability} location=${lastState.locationArt} props=${lastState.locationProps} tier=${lastState.renderTier} budget=${lastState.renderBudget} canvas=${Math.round(lastState.width)}x${Math.round(lastState.height)}`);
      process.exitCode = 0;
      break;
    }
    await sleep(200);
  }

  if (lastState?.visual !== 'authored-damaged-vessel') {
    throw new Error(`Timed out waiting for authored Damaged Vessel environment: ${JSON.stringify(lastState)}`);
  }
} finally {
  socket.close();
}
