// P28-G2: exact-APK Android WebView visual proof for the Orbital Station route.
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
  throw new Error('P28-G2 Android WebView CDP target did not start.');
}

const target = await waitForTarget();
const socket = await new Promise((resolve, reject) => {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('open', () => resolve(ws), { once: true });
  ws.addEventListener('error', () => reject(new Error('P28-G2 Android WebView CDP connection failed')), { once: true });
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
      reject(new Error('P28-G2 CDP timeout: ' + method));
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
  throw new Error('P28-G2 Android ' + label + ' timed out; last=' + JSON.stringify(last));
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
  if (!found) throw new Error('P28-G2 Android action unavailable: ' + label);
}
async function capture(path) {
  // Render evidence comes from the Android device framebuffer, not a synthetic
  // canvas export or a desktop browser masquerading as an Android screen.
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 16 * 1024 * 1024 });
  if (png.length < 20_000 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('P28-G2 screenshot blank or invalid: ' + path + ' bytes=' + png.length);
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
  const surface = await waitFor(`(() => {
    if (document.readyState !== 'complete') return '';
    if (document.querySelector('.class-intake')) return 'intake';
    return [...document.querySelectorAll('button')].some(b =>
      (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations')
      ? 'command' : '';
  })()`, 'command/intake');
  if (surface === 'intake') {
    const selectedClass = await evaluate(`(() => {
      const b = document.querySelector('[aria-label="Select Vanguard class"]');
      if (!b) return false;
      b.click(); return true;
    })()`);
    if (!selectedClass) throw new Error('P28-G2 cannot select Vanguard.');
    await waitFor('Boolean(document.querySelector(\'[aria-label="Confirm Vanguard"]\') && !document.querySelector(\'[aria-label="Confirm Vanguard"]\').disabled)', 'class confirm');
    await clickButton('Confirm Vanguard');
  }
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations')`, 'Command Deck');
  await clickButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.textContent || '').trim().toLowerCase() === 'contracts')`, 'Operations');
  await clickButton('Contracts');
  await waitFor('Boolean(document.querySelector(\'button[data-location="damaged-vessel"]\'))', 'Damaged Vessel contract');
  const selected = await evaluate(`(() => {
    const b = document.querySelector('button[data-location="damaged-vessel"]');
    if (!b || b.disabled) return false;
    b.click(); return true;
  })()`);
  if (!selected) throw new Error('P28-G2 could not select Damaged Vessel.');
  await waitFor('document.querySelector(\'button[data-location="damaged-vessel"]\')?.classList.contains("selected")', 'contract selection');
  await clickButton('Deploy Selected Contract');

  const ready = `(() => {
    const d = document.querySelector('canvas')?.dataset;
    return d?.babylonScenario === 'damaged-vessel'
      && d.graphicsPathLoaded === 'babylon'
      && d.babylonBackend === 'webgl2'
      && d.babylonInit === 'ready'
      && Number(d.babylonFrames || 0) >= 2
      && d.babylonEnvironmentState === 'ready'
      && d.damagedPremiumAssetState === 'ready'
      && Number(d.damagedPremiumBindings || 0) >= 35
      && d.damagedPremiumSurfaces === 'deck-plate,painted-metal,bare-metal,polymer-rubber,emissive-fixture'
      && d.environmentIbl === 'shared-prefiltered:ready'
      && d.damagedGrounding === 'player+enemies:soft-contact'
      && Number(d.damagedGroundedProps) === 11
      && d.babylonRouteMarkingProfile === 'damaged-recessed-deck-inlay'
      && Number(d.babylonRouteMarkingMaxWidth) > 0
      && Number(d.babylonRouteMarkingMaxWidth) <= 0.20
      && d.babylonSharedWorldArtState === 'ready'
      && d.missionVisualReadiness === 'ready'
      && d.missionVisualMode === 'authored'
      && Number(d.babylonSharedWorldPendingCount || 0) === 0
      && Number(d.babylonSharedWorldFailedCount || 0) === 0
      && Number(d.babylonSharedWorldMappedCount || 0) > 0
      && Number(d.babylonSharedWorldAuthoredCount || 0) === Number(d.babylonSharedWorldMappedCount || 0)
      && Number(d.babylonSharedWorldFallbackCount || 0) === 0
      && d.objectiveWorldCue === 'beacon+navigation-path'
      && d.interactableReadability === 'shape-coded+state-emissive+floor-cue:quality-safe';
  })()`;
  await waitFor(ready, 'Damaged Vessel route / authored-world visual readiness', 90_000);
  await sleep(650);
  const normalBytes = await capture('android-p28g2-damaged-vessel-normal.png');
  const before = await evaluate("document.querySelector('canvas')?.dataset.babylonDamagedPlayerPosition ?? ''");
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(650);
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(500);
  await waitFor(ready, 'post-input Damaged Vessel cues', 20_000);
  const actionBytes = await capture('android-p28g2-damaged-vessel-action.png');
  const result = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    const d = canvas?.dataset ?? {};
    return {
      capturedRoute: d.babylonScenario ?? '',
      tier: d.renderTier ?? '',
      backend: d.babylonBackend ?? '',
      routeStyle: d.babylonRouteMarkingProfile ?? '',
      routeMaxWidth: Number(d.babylonRouteMarkingMaxWidth || 0),
      mappedObjects: Number(d.babylonSharedWorldMappedCount || 0),
      authoredObjects: Number(d.babylonSharedWorldAuthoredCount || 0),
      fallbackObjects: Number(d.babylonSharedWorldFallbackCount || 0),
      assetIds: d.babylonSharedWorldAssets ?? '',
      artState: d.babylonSharedWorldArtState ?? '',
      premium: d.damagedPremiumAssetState ?? '', premiumBindings: Number(d.damagedPremiumBindings || 0),
      ibl: d.environmentIbl ?? '', groundProps: Number(d.damagedGroundedProps || 0),
      worldObjects: Number(d.worldObjectCount || 0),
      playerPosition: d.babylonDamagedPlayerPosition ?? '',
      objectiveCue: d.objectiveWorldCue ?? '',
      width: canvas?.width ?? 0, height: canvas?.height ?? 0,
    };
  })()`);
  if (result.capturedRoute !== 'damaged-vessel' || result.artState !== 'ready' || result.premium !== 'ready'
    || !result.assetIds || result.fallbackObjects > 0 || result.authoredObjects !== result.mappedObjects
    || !result.tier || result.width <= 0 || result.height <= 0
    || !(normalBytes > 20_000 && actionBytes > 20_000)) {
    throw new Error('P28-G2 actual Android visual proof incomplete: ' + JSON.stringify(result));
  }
  writeFileSync('android-p28g2-damaged-vessel.json', JSON.stringify({
    task: 'P28-G2', deviceValidation: 'emulator-visual-evidence-not-physical-thermal-acceptance',
    normalScreenshot: 'android-p28g2-damaged-vessel-normal.png',
    actionScreenshot: 'android-p28g2-damaged-vessel-action.png',
    screenshotsBytes: [normalBytes, actionBytes], beforePosition: before, ...result,
  }, null, 2) + '\n');
  console.log('ANDROID_P28G2_DAMAGED_VISUAL_CAPTURE_PASS route=damaged-vessel authored=' + result.authoredObjects + ' width=' + result.routeMaxWidth + ' tier=' + result.tier);
} finally {
  socket.close();
}
