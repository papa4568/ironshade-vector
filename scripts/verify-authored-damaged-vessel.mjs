import { writeFileSync } from 'node:fs';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const timeoutMs = Number(process.env.AUTHORED_DAMAGED_VESSEL_TIMEOUT_MS ?? 45_000);
const viewport = process.env.BROWSER_E2E_VIEWPORT ?? 'unknown';
const reportPath = `browser-e2e-${viewport}-authored-damaged-vessel.performance.json`;
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for Damaged Vessel verification.');
}

async function listTargets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
  return await response.json();
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to Damaged Vessel CDP target')), 5_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error(`Damaged Vessel CDP socket error: ${String(event?.message ?? 'unknown')}`));
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

function validateBabylonState(state) {
  const expectedKit = new Set([
    'floor',
    'broken-rib',
    'breach-frame',
    'salvage-rack',
    'torn-plate',
    'service-bundle',
    'wayfinding',
    'breach-vapor',
    'scorch',
  ]);
  const kit = new Set(String(state.kit ?? '').split(',').filter(Boolean));
  if (state.rendererState !== 'ready') return 'Babylon Damaged Vessel renderer is not ready';
  if (![...expectedKit].every(item => kit.has(item))) return 'Babylon Damaged Vessel kit is incomplete';
  if (!(state.instances >= 50)) return 'Damaged Vessel environment coverage is too low';
  if (state.landmark !== 'starboard-hull-breach') return 'Damaged Vessel breach landmark is missing';
  if (state.serviceDetails !== 'salvage-rack:6+service-bundle:5') return 'Damaged Vessel salvage/service coverage is incomplete';
  if (state.surfaceDetail !== 'broken-rib:5+torn-plate:6+scorch:6') return 'Damaged Vessel surface damage coverage is incomplete';
  if (state.composition !== 'broken-rib-corridor+starboard-breach+torn-shell+perimeter-salvage') return 'Damaged Vessel composition contract is missing';
  if (state.materials !== 'scarred-hull+torn-edge+warning-emissive+salvage-status') return 'Damaged Vessel material language is missing';
  if (state.vfx !== 'breach-vapor:18+scorch:6') return 'Damaged Vessel bounded breach VFX are missing';
  if (!/^damaged-vessel-emergency:breach\+salvage\+contact:player\+enemy\+practical:[12]\+shadow:off$/.test(state.environmentLighting)) return 'Damaged Vessel Babylon emergency lighting recipe is missing';
  if (!/^aces-\d+\.\d{2}$/.test(state.environmentTone)) return 'Damaged Vessel tone telemetry is malformed';
  if (state.readability !== 'silhouette+damage-edge+breach-vapor+luminance') return 'Damaged Vessel readability language is missing';
  if (!String(state.locationArt).startsWith('damaged-vessel:broken-ribs:scarred-hull')) return 'Damaged Vessel campaign art identity is not active';
  if (!String(state.locationLighting).startsWith('damaged-vessel:emergency-amber:aces-')) return 'Damaged Vessel lighting profile is not active';
  if (state.locationProps !== 'salvage-cases:procedural-babylon') return 'Damaged Vessel Babylon salvage props are not active';
  if (!['high', 'balanced', 'performance'].includes(state.renderTier)) return 'Adaptive render tier telemetry is missing';
  if (!/^pixel:\d+\.\d{2}\+shadow:\d+\+reflection:\d+\.\d{2}\+detail:\d+\.\d{2}$/.test(state.renderBudget)) return 'Adaptive render budget telemetry is malformed';
  if (!(state.width > 0 && state.height > 0)) return 'Damaged Vessel canvas is not visible';
  return '';
}

const { socket, call } = await createSession();
let lastState = null;
let lastMismatch = 'Babylon Damaged Vessel environment not observed';
let stableSamples = 0;

async function evaluate(expression) {
  const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return response.result?.value;
}

try {
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual);
      if (!canvas) return { visual: '', canvases: document.querySelectorAll('canvas').length };
      const rect = canvas.getBoundingClientRect();
      return {
        rendererState: canvas.dataset.babylonEnvironmentState ?? '',
        visual: canvas.dataset.environmentVisual ?? '',
        kit: canvas.dataset.environmentKit ?? '',
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
      throw new Error(`Damaged Vessel entered generic procedural fallback: ${JSON.stringify(lastState)}`);
    }

    if (lastState?.visual === 'procedural-damaged-vessel-babylon') {
      lastMismatch = validateBabylonState(lastState);
      if (!lastMismatch) {
        stableSamples += 1;
        if (stableSamples >= 2) {
          const kit = new Set(String(lastState.kit ?? '').split(',').filter(Boolean));
          console.log(`AUTHORED_DAMAGED_VESSEL_RUNTIME_PASS visual=${lastState.visual} kit=${[...kit].sort().join(',')} instances=${lastState.instances} landmark=${lastState.landmark} service=${lastState.serviceDetails} surface=${lastState.surfaceDetail} composition=${lastState.composition} materials=${lastState.materials} vfx=${lastState.vfx} lighting=${lastState.environmentLighting} tone=${lastState.environmentTone} readability=${lastState.readability} location=${lastState.locationArt} props=${lastState.locationProps} tier=${lastState.renderTier} budget=${lastState.renderBudget} canvas=${Math.round(lastState.width)}x${Math.round(lastState.height)}`);
          writeFileSync(reportPath, JSON.stringify({ pass: true, elapsedMs: Date.now() - startedAt, stableSamples, state: lastState }, null, 2));
          process.exitCode = 0;
          break;
        }
      } else {
        stableSamples = 0;
      }
    } else {
      stableSamples = 0;
      lastMismatch = `waiting for Babylon Damaged Vessel visual; observed=${lastState?.visual ?? ''}`;
    }
    await sleep(200);
  }

  if (stableSamples < 2) {
    writeFileSync(reportPath, JSON.stringify({ pass: false, elapsedMs: Date.now() - startedAt, stableSamples, mismatch: lastMismatch, state: lastState }, null, 2));
    throw new Error(`Timed out waiting for complete stable Babylon Damaged Vessel environment (${lastMismatch}): ${JSON.stringify(lastState)}`);
  }
} catch (error) {
  writeFileSync(reportPath, JSON.stringify({ pass: false, elapsedMs: Date.now() - startedAt, stableSamples, mismatch: lastMismatch, state: lastState, error: String(error?.stack ?? error) }, null, 2));
  throw error;
} finally {
  socket.close();
}
