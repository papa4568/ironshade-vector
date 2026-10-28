// P28-G7: exact-APK Android WebView visual proof for the Momentum Annex route.
// Screenshots and telemetry are captured from the live, deployed combat scene.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { captureAcceptedG7Frame } from './p28g7-android-frame.mjs';

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
  throw new Error('P28-G7 Android WebView CDP target did not start.');
}

// Android may replace the first WebView target while landscape/immersive mode
// settles. Always re-query the live target after a bounded socket failure.
const socket = await (async () => {
  let lastError = '';
  while (Date.now() - start < deadlineMs) {
    const target = await waitForTarget();
    try {
      return await new Promise((resolve, reject) => {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        const timer = setTimeout(() => reject(new Error('WebView socket handshake timeout')), 7_500);
        ws.addEventListener('open', () => { clearTimeout(timer); resolve(ws); }, { once: true });
        ws.addEventListener('error', () => {
          clearTimeout(timer);
          reject(new Error('WebView target closed during startup'));
        }, { once: true });
        ws.addEventListener('close', () => {
          clearTimeout(timer);
          reject(new Error('WebView target was replaced during startup'));
        }, { once: true });
      });
    } catch (error) {
      lastError = String(error);
      await sleep(500);
    }
  }
  throw new Error('P28-G7 Android WebView CDP connection never stabilized: ' + lastError);
})();
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
      reject(new Error('P28-G7 CDP timeout: ' + method));
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
  throw new Error('P28-G7 Android ' + label + ' timed out; last=' + JSON.stringify(last));
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
  if (!found) throw new Error('P28-G7 Android action unavailable: ' + label);
}
async function capture(path) {
  return await captureAcceptedG7Frame(path, 'P28-G7');
}

try {
  await call('Runtime.enable');
  await call('Page.enable');
  // A cold Android WebView can stall while compiling the flagship client.
  // Retry only startup; all route, pixel and asset assertions remain strict.
  const current = await waitFor('location.href', 'initial cold WebView URL', 120_000);
  const url = new URL(current);
  url.search = '';
  url.searchParams.set('graphicsCompare', '1');
  url.searchParams.set('graphicsPath', 'babylon');
  url.searchParams.set('babylonBackend', 'webgl2');
  url.searchParams.set('p28FlagshipVisualQa', '1');
  // Re-entry proof uses the existing QA-only bridge, never production UI bypass.
  url.searchParams.set('p27d5Lifecycle', '1');
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
    if (!selectedClass) throw new Error('P28-G7 cannot select Vanguard.');
    await waitFor('Boolean(document.querySelector(\'[aria-label="Confirm Vanguard"]\') && !document.querySelector(\'[aria-label="Confirm Vanguard"]\').disabled)', 'class confirm');
    await clickButton('Confirm Vanguard');
  }
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations')`, 'Command Deck');
  // Use the actual finale unlock from browser E2E; retain real contract selection.
  const seeded = await evaluate(`(() => {
    const seed = campaign => {
      const story = campaign?.story?.blackMomentum;
      if (!story) return false;
      campaign.anomalyRecovered = true;
      story.status = 'active'; story.step = 13;
      story.choiceA ||= 'joint-lab'; story.choiceB ||= 'ledger'; story.choiceC ||= 'publish';
      story.lastBeat = 'QA seed // Black Momentum finale ready at Momentum Exchange.';
      campaign.story.lastBeat = story.lastBeat;
      return true;
    };
    let success = false;
    for (const key of ['ironshade-vector-state-v1', 'ironshade-vector-campaign-v1']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      if (seed(key.endsWith('state-v1') ? obj.campaign : obj)) {
        localStorage.setItem(key, JSON.stringify(obj)); success = true;
      }
    }
    return success;
  })()`);
  if (!seeded) throw new Error('P28-G7 real finale unlock could not be established.');
  await call('Page.reload', { ignoreCache: true });
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations')`,
    'finale Command Deck');
  await clickButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.textContent || '').trim().toLowerCase() === 'contracts')`, 'Operations');
  await clickButton('Contracts');
  await waitFor('Boolean(document.querySelector(\'button[data-location="momentum-annex"]\'))', 'Momentum Annex contract');
  const selected = await evaluate(`(() => {
    const b = document.querySelector('button[data-location="momentum-annex"]');
    if (!b || b.disabled) return false;
    b.click(); return true;
  })()`);
  if (!selected) throw new Error('P28-G7 could not select Momentum Annex.');
  await waitFor('document.querySelector(\'button[data-location="momentum-annex"]\')?.classList.contains("selected")', 'contract selection');
  await clickButton('Deploy Selected Contract');

  const ready = `(() => {
    const d = document.querySelector('canvas')?.dataset;
    return d?.babylonScenario === 'momentum-annex'
      && d.graphicsPathLoaded === 'babylon'
      && d.babylonBackend === 'webgl2'
      && d.renderTier === 'high'
      && d.p28FlagshipCapture === 'high-tier-qa-visual-only'
      && Boolean(d.babylonSharedWorldAssets)
      && d.babylonSharedWorldAssets.split(',').every(id => id.endsWith('-lod0'))
      && d.babylonInit === 'ready'
      && Number(d.babylonFrames || 0) >= 2
      && d.babylonEnvironmentState === 'ready'
      && d.momentumPremiumAssetState === 'ready'
      && Number(d.momentumPremiumBindings || 0) >= 100
      && d.momentumPremiumSurfaces === 'deck-plate,painted-metal,bare-metal,polymer-rubber,emissive-fixture'
      && d.environmentIbl === 'shared-prefiltered:ready'
      && d.environmentHazardLanguage === 'shared-hazards+countermass-wash+vector-wash+near-zero-g+magnetic-transfer'
      && d.environmentSurfaceDetail?.includes('laminated-rim:6') && d.environmentSurfaceDetail?.includes('flux-tooth:48')
      && d.momentumGrounding === 'player+enemies:soft-contact'
      && Number(d.momentumGroundedProps) === 6
      && d.babylonRouteMarkingProfile === 'momentum-recessed-transfer-inlay'
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
  await waitFor(ready, 'Momentum Annex route / authored-world visual readiness', 90_000);
  // The campaign acceptance contract requires the *captured* normal and action
  // scenes to be from a real return-to-hub / redeploy cycle. This lifecycle
  // bridge is enabled only by p27d5Lifecycle=1 and calls the real App exit path.
  const exitRequested = await evaluate(`(() => {
    if (!document.querySelector('canvas')) return false;
    window.dispatchEvent(new Event('ironshade:p27d5-return-to-hub'));
    return true;
  })()`);
  if (!exitRequested) throw new Error('P28-G7 mission exit bridge unavailable.');
  await waitFor(`(() => !document.querySelector('canvas')
    && [...document.querySelectorAll('button')].some(b =>
      (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations'))()`,
    'returned to Command Deck before map re-entry', 20_000);
  await clickButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.textContent || '').trim().toLowerCase() === 'contracts')`,
    'post-exit Operations');
  await clickButton('Contracts');
  await waitFor('Boolean(document.querySelector(\'button[data-location="momentum-annex"]\'))',
    're-entry Momentum Annex contract');
  const reselected = await evaluate(`(() => {
    const contract = document.querySelector('button[data-location="momentum-annex"]');
    if (!contract || contract.disabled) return false;
    contract.click();
    return true;
  })()`);
  if (!reselected) throw new Error('P28-G7 real Momentum Annex redeployment unavailable.');
  await waitFor('document.querySelector(\'button[data-location="momentum-annex"]\')?.classList.contains("selected")',
    're-entry contract selection');
  await clickButton('Deploy Selected Contract');
  await waitFor(ready, 'post-reentry Momentum Annex authored-world readiness', 90_000);
  console.log('ANDROID_P28G7_MOMENTUM_REENTRY_PASS exit=command-deck redeploy=momentum-annex state=ready');
  await sleep(650);
  const beforeVisual = await evaluate(`(() => {
    const d = document.querySelector('canvas')?.dataset ?? {};
    return { assetIds: d.babylonSharedWorldAssets ?? '',
      artState: d.babylonSharedWorldArtState ?? '',
      premium: d.momentumPremiumAssetState ?? '', ibl: d.environmentIbl ?? '' };
  })()`);
  const normalBytes = await capture('android-p28g7-momentum-annex-normal.png');
  const before = await evaluate("document.querySelector('canvas')?.dataset.babylonMomentumExchangePlayerPosition ?? ''");
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(650);
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(500);
  await waitFor(ready, 'post-input Momentum Annex cues', 20_000);
  // Capture ACTIVE combat, not merely a different walking pose. This is the
  // real touch FIRE control on the deployed Android WebView, not fabricated
  // counters or synthetic projectiles. Manual aim mirrors the fast smoke path.
  const combatInput = await evaluate(`(() => {
    const canvas = document.querySelector('canvas')?.getBoundingClientRect();
    const fire = document.querySelector('.fire-button');
    const target = fire?.getBoundingClientRect();
    if (!canvas || !target || !target.width || !target.height || fire.disabled) return null;
    return {
      aimX: canvas.left + canvas.width * 0.72,
      aimY: canvas.top + canvas.height * 0.50,
      fireX: target.left + target.width / 2,
      fireY: target.top + target.height / 2,
    };
  })()`);
  if (!combatInput) throw new Error('P28-G7 live FIRE control is not visible');
  const touch = async (type, id, x, y) => await call('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ id, x, y }],
  });
  await touch('touchStart', 297, combatInput.aimX, combatInput.aimY);
  await touch('touchMove', 297, combatInput.aimX + 38, combatInput.aimY - 16);
  await sleep(130);
  await touch('touchEnd', 297, combatInput.aimX + 38, combatInput.aimY - 16);
  await sleep(400);
  const shotsBefore = await evaluate("Number(document.querySelector('.game-root')?.dataset.weaponShots ?? '0')");
  let shotsAfter = shotsBefore;
  let actionBytes = 0;
  for (let attempt = 0; attempt < 3 && shotsAfter <= shotsBefore; attempt += 1) {
    await touch('touchStart', 310 + attempt, combatInput.fireX, combatInput.fireY);
    try {
      for (let i = 0; i < 5 && shotsAfter <= shotsBefore; i += 1) {
        await sleep(280);
        shotsAfter = await evaluate("Number(document.querySelector('.game-root')?.dataset.weaponShots ?? '0')");
      }
      if (shotsAfter > shotsBefore) {
        await waitFor(ready, 'live-fire Annex authored scene', 20_000);
        actionBytes = await capture('android-p28g7-momentum-annex-action.png');
      }
    } finally {
      await touch('touchEnd', 310 + attempt, combatInput.fireX, combatInput.fireY);
    }
    if (shotsAfter <= shotsBefore) await sleep(400);
  }
  if (shotsAfter <= shotsBefore || actionBytes < 20_000) {
    throw new Error('P28-G7 combat screenshot requires real shots after touch FIRE, got ' + shotsBefore + '->' + shotsAfter);
  }
  const result = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    const d = canvas?.dataset ?? {};
    return {
      capturedRoute: d.babylonScenario ?? '',
      tier: d.renderTier ?? '', captureMode: d.p28FlagshipCapture ?? '',
      backend: d.babylonBackend ?? '',
      routeStyle: d.babylonRouteMarkingProfile ?? '',
      routeMaxWidth: Number(d.babylonRouteMarkingMaxWidth || 0),
      mappedObjects: Number(d.babylonSharedWorldMappedCount || 0),
      authoredObjects: Number(d.babylonSharedWorldAuthoredCount || 0),
      fallbackObjects: Number(d.babylonSharedWorldFallbackCount || 0),
      assetIds: d.babylonSharedWorldAssets ?? '',
      artState: d.babylonSharedWorldArtState ?? '',
      premium: d.momentumPremiumAssetState ?? '', premiumBindings: Number(d.momentumPremiumBindings || 0),
      ibl: d.environmentIbl ?? '', groundProps: Number(d.momentumGroundedProps || 0),
      hazardLanguage: d.environmentHazardLanguage ?? '', surfaceDetail: d.environmentSurfaceDetail ?? '',
      worldObjects: Number(d.worldObjectCount || 0),
      playerPosition: d.babylonMomentumExchangePlayerPosition ?? '',
      objectiveCue: d.objectiveWorldCue ?? '',
      width: canvas?.width ?? 0, height: canvas?.height ?? 0,
    };
  })()`);
  if (result.tier !== 'high' || result.captureMode !== 'high-tier-qa-visual-only'
      || before === result.playerPosition || result.capturedRoute !== 'momentum-annex' || result.artState !== 'ready' || result.premium !== 'ready'
    || !result.assetIds || result.fallbackObjects > 0 || result.authoredObjects !== result.mappedObjects
    || !result.tier || result.width <= 0 || result.height <= 0
    || !(shotsAfter > shotsBefore) || !(normalBytes > 20_000 && actionBytes > 20_000)) {
    throw new Error('P28-G7 actual Android visual proof incomplete: ' + JSON.stringify(result));
  }
  writeFileSync('android-p28g7-momentum-annex.json', JSON.stringify({
    task: 'P28-G7', mapReentry: 'exit-to-command-and-redeploy:ready', deviceValidation: 'emulator-visual-evidence-not-physical-thermal-acceptance',
    normalScreenshot: 'android-p28g7-momentum-annex-normal.png',
    actionScreenshot: 'android-p28g7-momentum-annex-action.png',
    screenshotsBytes: [normalBytes, actionBytes], beforePosition: before,
    actionInput: 'manual-aim+live-touch-fire', shotsBefore, shotsAfter,
    beforeAssetIds: beforeVisual.assetIds, beforeArtState: beforeVisual.artState,
    beforePremium: beforeVisual.premium, beforeIbl: beforeVisual.ibl, ...result,
  }, null, 2) + '\n');
  console.log('ANDROID_P28G7_MOMENTUM_VISUAL_CAPTURE_PASS route=momentum-annex authored=' + result.authoredObjects + ' width=' + result.routeMaxWidth + ' tier=' + result.tier);
} finally {
  socket.close();
}
