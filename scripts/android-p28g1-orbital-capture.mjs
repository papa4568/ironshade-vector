// P28-G1: exact-APK Android WebView visual proof for the Orbital Station route.
// Screenshots and telemetry are captured from the live, deployed combat scene.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const endpoint = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const start = Date.now();
const deadlineMs = 120_000;
if (typeof WebSocket !== 'function') throw new Error('Node 22 WebSocket is required for Android visual QA.');

async function waitForTarget() {
  while (Date.now() - start < deadlineMs) {
    try {
      const response = await fetch(endpoint + '/json/list');
      if (!response.ok) throw new Error('CDP returned ' + response.status);
      const targets = await response.json();
      const target = targets.find(item => item.title === 'Ironshade Vector' && item.webSocketDebuggerUrl);
      if (target) return target;
    } catch {}
    await sleep(400);
  }
  throw new Error('P28-G1 Android WebView CDP target did not start.');
}

const target = await waitForTarget();
const socket = await new Promise((resolve, reject) => {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('open', () => resolve(ws), { once: true });
  ws.addEventListener('error', () => reject(new Error('P28-G1 Android WebView CDP connection failed')), { once: true });
});
const pending = new Map();
let nextId = 0;
socket.addEventListener('message', event => {
  let message;
  try { message = JSON.parse(String(event.data)); } catch { return; }
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timer);
  if (message.error) request.reject(new Error(message.error.message ?? 'CDP failure'));
  else request.resolve(message.result);
});
async function call(method, params = {}) {
  return await new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('P28-G1 CDP timeout: ' + method));
    }, 25_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await call('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? 'JavaScript evaluation failed');
  return response.result?.value;
}
async function waitFor(expression, label, ms = 60_000) {
  const until = Date.now() + ms;
  let last = null;
  while (Date.now() < until) {
    try { last = await evaluate(expression); if (last) return last; } catch {}
    await sleep(250);
  }
  throw new Error('P28-G1 Android ' + label + ' timed out; last=' + JSON.stringify(last));
}
async function clickButton(label) {
  const found = await evaluate(`(() => {
    const label = ${JSON.stringify(label.toLowerCase())};
    const button = [...document.querySelectorAll('button')].find(candidate =>
      (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLowerCase() === label);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!found) throw new Error('P28-G1 Android action unavailable: ' + label);
}
async function capture(path) {
  // Render evidence comes from the Android device framebuffer, not a synthetic
  // canvas export or a desktop browser masquerading as an Android screen.
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 16 * 1024 * 1024 });
  if (png.length < 20_000 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('P28-G1 screenshot blank or invalid: ' + path + ' bytes=' + png.length);
  }
  writeFileSync(path, png);
  return png.length;
}

try {
  await call('Runtime.enable');
  await call('Page.enable');
  const current = await evaluate('location.href');
  const url = new URL(current);
  url.search = '';
  url.searchParams.set('graphicsCompare', '1');
  url.searchParams.set('graphicsPath', 'babylon');
  url.searchParams.set('babylonBackend', 'webgl2');
  await call('Page.navigate', { url: url.toString() });

  const startSurface = await waitFor(`(() => {
    if (document.readyState !== 'complete') return '';
    if (document.querySelector('.class-intake')) return 'intake';
    return [...document.querySelectorAll('button')].some(b =>
      (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations')
      ? 'command' : '';
  })()`, 'command/intake');
  if (startSurface === 'intake') {
    const chosen = await evaluate(`(() => {
      const choice = document.querySelector('[aria-label="Select Vanguard class"]');
      if (!choice) return false;
      choice.click();
      return true;
    })()`);
    if (!chosen) throw new Error('P28-G1 Android cannot select Vanguard for the capture.');
    await waitFor('(() => { const b = document.querySelector(\'[aria-label="Confirm Vanguard"]\'); return Boolean(b && !b.disabled); })()', 'Vanguard confirm');
    const confirmed = await evaluate(`(() => {
      const button = document.querySelector('[aria-label="Confirm Vanguard"]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (!confirmed) throw new Error('P28-G1 Android cannot confirm Vanguard.');
  }
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations')`, 'Command Deck');
  await clickButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.textContent || '').trim().toLowerCase() === 'contracts')`, 'Operations');
  await clickButton('Contracts');
  await waitFor('Boolean(document.querySelector(\'button[data-location="orbital-station"]\'))', 'Orbital Station contract');
  const selected = await evaluate(`(() => {
    const button = document.querySelector('button[data-location="orbital-station"]');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!selected) throw new Error('P28-G1 Android Orbital Station contract could not be selected.');
  await waitFor('document.querySelector(\'button[data-location="orbital-station"]\')?.classList.contains("selected")', 'Orbital Station selection');
  await clickButton('Deploy Selected Contract');

  const readyExpression = `(() => {
    const d = document.querySelector('canvas')?.dataset;
    return d?.babylonScenario === 'orbital-station'
      && d.graphicsPathLoaded === 'babylon'
      && d.babylonBackend === 'webgl2'
      && d.babylonInit === 'ready'
      && Number(d.babylonFrames || 0) >= 2
      && d.orbitalPremiumAssetState === 'ready'
      && d.babylonSharedWorldArtState === 'ready'
      && d.missionVisualReadiness === 'ready'
      && d.missionVisualMode === 'authored'
      && Number(d.babylonSharedWorldPendingCount || 0) === 0
      && Number(d.babylonSharedWorldFailedCount || 0) === 0
      && Number(d.orbitalPremiumBindings || 0) >= 40
      && d.orbitalPremiumSurfaces === 'deck-plate,painted-metal,bare-metal,polymer-rubber,emissive-fixture'
      && d.orbitalGrounding === 'player+enemies:soft-contact'
      && Number(d.orbitalGroundedProps || 0) === 25
      && d.environmentIbl === 'shared-prefiltered:ready'
      && d.objectiveWorldCue === 'beacon+navigation-path'
      && d.interactableReadability === 'shape-coded+state-emissive+floor-cue:quality-safe'
      && d.hazardReadability === 'shape-coded+floor-bound+quality-safe';
  })()`;
  await waitFor(readyExpression, 'premium Orbital Station combat/material/cue readiness', 90_000);
  await sleep(650);
  const initialBytes = await capture('android-p28g1-orbital-station-normal.png');
  const beforePosition = await evaluate(`document.querySelector('canvas')?.dataset.babylonOrbitalPlayerPosition ?? ''`);
  // Exercise the same real WebView input path as the browser Orbital Station route.
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(650);
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(500);
  await waitFor(readyExpression, 'post-input gameplay cue continuity', 20_000);
  const afterBytes = await capture('android-p28g1-orbital-station-action.png');
  const state = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    const d = canvas?.dataset ?? {};
    return {
      location: d.babylonScenario ?? '', graphics: d.graphicsPathLoaded ?? '',
      backend: d.babylonBackend ?? '', tier: d.renderTier ?? '',
      frameCount: Number(d.babylonFrames || 0),
      premium: d.orbitalPremiumAssetState ?? '', bindings: Number(d.orbitalPremiumBindings || 0),
      surfaces: d.orbitalPremiumSurfaces ?? '', ibl: d.environmentIbl ?? '',
      grounding: d.orbitalGrounding ?? '', groundedProps: Number(d.orbitalGroundedProps || 0),
      groundedEnemies: Number(d.orbitalGroundedEnemies || 0),
      worldObjects: Number(d.worldObjectCount || 0), interactables: Number(d.interactableActive || 0),
      objectiveCue: d.objectiveWorldCue ?? '', hazardCue: d.hazardReadability ?? '',
      playerPosition: d.babylonOrbitalPlayerPosition ?? '',
      width: canvas?.width ?? 0, height: canvas?.height ?? 0,
    };
  })()`);
  if (state.location !== 'orbital-station' || state.premium !== 'ready'
      || state.bindings < 40 || state.groundedProps !== 25 || state.worldObjects < 1
      || state.interactables < 1 || !state.tier || state.width <= 0 || state.height <= 0
      || beforePosition === state.playerPosition
      || !(state.frameCount >= 2) || !(afterBytes > 20_000)) {
    throw new Error('P28-G1 Android capture contains incomplete presentation: ' + JSON.stringify(state));
  }
  writeFileSync('android-p28g1-orbital-station.json', JSON.stringify({
    task: 'P28-G1', platform: 'Android-WebView-Pixel-7-Pro-API35',
    deviceValidation: 'emulator-visual-evidence-not-physical-thermal-acceptance',
    capturedRoute: 'orbital-station', normalScreenshot: 'android-p28g1-orbital-station-normal.png',
    actionScreenshot: 'android-p28g1-orbital-station-action.png',
    imageBytes: [initialBytes, afterBytes], beforePosition, ...state,
  }, null, 2) + '\n');
  console.log('ANDROID_P28G1_ORBITAL_CAPTURE_PASS route=orbital-station backend=webgl2 premium=ready surfaces=5 meshBindings=' + state.bindings + ' groundedProps=25 screenshots=2 tier=' + state.tier + ' player=' + beforePosition + '->' + state.playerPosition);
} finally {
  socket.close();
}
