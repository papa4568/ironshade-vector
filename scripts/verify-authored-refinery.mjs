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
      if (!canvas) return { visual: '', state: '', kit: '', lod: '', instances: 0, terminals: 0, canvases: document.querySelectorAll('canvas').length };
      const rect = canvas.getBoundingClientRect();
      return {
        visual: canvas.dataset.environmentVisual ?? '',
        state: canvas.dataset.babylonEnvironmentState ?? '',
        kit: canvas.dataset.environmentKit ?? '',
        lod: canvas.dataset.environmentLod ?? '',
        instances: Number(canvas.dataset.environmentInstances ?? 0),
        terminals: Number(canvas.dataset.environmentTerminals ?? 0),
        landmark: canvas.dataset.environmentLandmark ?? '',
        serviceDetails: canvas.dataset.environmentServiceDetails ?? '',
        surfaceDetail: canvas.dataset.environmentSurfaceDetail ?? '',
        machineDetail: canvas.dataset.environmentMachineDetail ?? '',
        composition: canvas.dataset.environmentComposition ?? '',
        lightingProfile: canvas.dataset.babylonLightingProfile ?? '',
        materialIntent: canvas.dataset.babylonMaterialIntent ?? '',
        lightingBudget: canvas.dataset.babylonLightingBudget ?? '',
        lighting: canvas.dataset.environmentLighting ?? '',
        actorGrounding: canvas.dataset.environmentActorGrounding ?? '',
        ibl: canvas.dataset.environmentIbl ?? '',
        tone: canvas.dataset.environmentTone ?? '',
        postProcessing: canvas.dataset.babylonPostProcessing ?? '',
        postBudget: canvas.dataset.babylonPostBudget ?? '',
        postStack: canvas.dataset.babylonPostStack ?? '',
        renderTier: canvas.dataset.renderTier ?? '',
        renderFrameMs: canvas.dataset.renderFrameMs ?? '',
        renderBudget: canvas.dataset.renderBudget ?? '',
        canvases: document.querySelectorAll('canvas').length,
        width: rect.width,
        height: rect.height,
      };
    })()`);

    if (lastState?.visual?.includes('fallback') || lastState?.state === 'error') {
      throw new Error(`Authored Babylon Asteroid Refinery entered fallback/error state: ${JSON.stringify(lastState)}`);
    }

    if (lastState?.visual === 'authored-refinery-babylon' && lastState.state === 'ready') {
      const expectedKit = new Set(['floor', 'floor-grate', 'bulkhead', 'processor', 'pipe-rack', 'wall-panel', 'cable-tray', 'service-conduit', 'gantry', 'crate', 'terminal']);
      const kit = new Set(String(lastState.kit ?? '').split(',').filter(Boolean));
      if (![...expectedKit].every(item => kit.has(item))) {
        throw new Error(`Authored Babylon refinery kit is incomplete: ${JSON.stringify(lastState)}`);
      }
      const lods = String(lastState.lod).split(',').filter(Boolean);
      if (lods.length === 0 || !lods.every(value => value === '1' || value === '2')) {
        throw new Error(`Unexpected authored Babylon refinery LOD: ${JSON.stringify(lastState)}`);
      }
      if (lastState.instances < 40) {
        throw new Error(`Authored Babylon refinery instancing coverage is too low: ${JSON.stringify(lastState)}`);
      }
      if (lastState.terminals < 1) {
        throw new Error(`Authored Babylon refinery interactive terminals were not mounted: ${JSON.stringify(lastState)}`);
      }
      if (lastState.landmark !== 'ore-smelter-gantry') {
        throw new Error(`Authored Babylon refinery bespoke landmark is missing: ${JSON.stringify(lastState)}`);
      }
      if (lastState.serviceDetails !== 'service-conduit:6') {
        throw new Error(`Authored Babylon refinery service-detail coverage is incomplete: ${JSON.stringify(lastState)}`);
      }
      if (lastState.surfaceDetail !== 'wall-panel:6+cable-tray:6') {
        throw new Error(`Authored Babylon refinery wall/cable detail coverage is incomplete: ${JSON.stringify(lastState)}`);
      }
      if (lastState.machineDetail !== 'processor-functional:3+floor-grate:8') {
        throw new Error(`Authored Babylon refinery processor/floor detail coverage is incomplete: ${JSON.stringify(lastState)}`);
      }
      if (lastState.composition !== 'clear-center-lane+processor-triangle+gantry-focal+perimeter-clutter') {
        throw new Error(`Authored Babylon refinery composition/readability hierarchy is missing: ${JSON.stringify(lastState)}`);
      }
      if (!lastState.lightingProfile || lastState.materialIntent !== 'authored-gltf-pbr+procedural-world-pbr') {
        throw new Error(`Babylon refinery lighting/material ownership telemetry is missing: ${JSON.stringify(lastState)}`);
      }
      if (!/^tier:(high|balanced|performance)\|ibl:\d+\.\d{2}\|shadow:\d+\|practical:[12]\|max-lights:[356]$/.test(lastState.lightingBudget)) {
        throw new Error(`Babylon refinery lighting budget telemetry is malformed: ${JSON.stringify(lastState)}`);
      }
      if (!/^refinery-key\+rim\+ibl:(?:raw-cube|off)\+practical:[12]\+shadow:(?:off|\d+)\+actor-grounding:key-linked$/.test(lastState.lighting)) {
        throw new Error(`Babylon refinery lighting telemetry is malformed: ${JSON.stringify(lastState)}`);
      }
      if (!/^p28-a2:refinery-actor-grounding-v1:quality-64:actors-\d+\/\d+:contact-and-key-projected:instances:core\+penumbra:cue-priority-preserved$/.test(lastState.actorGrounding)) {
        throw new Error(`Babylon refinery actor-grounding telemetry is malformed: ${JSON.stringify(lastState)}`);
      }
      if (!/^(?:raw-cube:[a-z0-9-]+(?:\+[a-z0-9-]+)*:intensity-\d+\.\d{2}|off:(?:qa-baseline|adaptive-budget))$/.test(lastState.ibl)) {
        throw new Error(`Babylon refinery IBL telemetry is malformed: ${JSON.stringify(lastState)}`);
      }
      if (!/^aces-\d+\.\d{2}\+ibl-(?:\d+\.\d{2}|off)$/.test(lastState.tone)) {
        throw new Error(`Babylon refinery tone telemetry is malformed: ${JSON.stringify(lastState)}`);
      }
      if (lastState.postProcessing !== 'selective-glow+instanced-contact+linear-fog+image-processing') {
        throw new Error(`Babylon refinery post-processing ownership telemetry is missing: ${JSON.stringify(lastState)}`);
      }
      if (!/^tier:(high|balanced|performance)\|bloom:\d+\.\d{2}\|contact:\d+\.\d{2}\|atmosphere:\d+\.\d{2}\|critical:1\.00$/.test(lastState.postBudget)
        || !['on:adaptive', 'on:qa-explicit', 'off:qa-baseline'].includes(lastState.postStack)) {
        throw new Error(`Babylon refinery post-processing budget telemetry is malformed: ${JSON.stringify(lastState)}`);
      }
      if (!['high', 'balanced', 'performance'].includes(lastState.renderTier)) {
        throw new Error(`Adaptive Babylon render tier telemetry is missing: ${JSON.stringify(lastState)}`);
      }
      if (!/^\d+\.\d{2}$/.test(lastState.renderFrameMs)
        || !/^pixel:\d+\.\d{2}\+shadow:\d+\+reflection:\d+\.\d{2}\+detail:\d+\.\d{2}$/.test(lastState.renderBudget)) {
        throw new Error(`Adaptive Babylon render telemetry is malformed: ${JSON.stringify(lastState)}`);
      }
      if (!(lastState.width > 0 && lastState.height > 0)) {
        throw new Error(`Authored Babylon refinery canvas is not visible: ${JSON.stringify(lastState)}`);
      }
      console.log(`AUTHORED_REFINERY_RUNTIME_PASS lod=${lastState.lod} kit=${[...kit].sort().join(',')} instances=${lastState.instances} terminals=${lastState.terminals} landmark=${lastState.landmark} lighting=${lastState.lighting} grounding=${lastState.actorGrounding} ibl=${lastState.ibl} post=${lastState.postStack} tier=${lastState.renderTier} frame=${lastState.renderFrameMs}ms budget=${lastState.renderBudget} canvas=${Math.round(lastState.width)}x${Math.round(lastState.height)}`);
      process.exitCode = 0;
      break;
    }

    await sleep(200);
  }

  if (lastState?.visual !== 'authored-refinery-babylon' || lastState.state !== 'ready') {
    throw new Error(`Timed out waiting for authored Babylon Asteroid Refinery environment: ${JSON.stringify(lastState)}`);
  }
} finally {
  socket.close();
}
