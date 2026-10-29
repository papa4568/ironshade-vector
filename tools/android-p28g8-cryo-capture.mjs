// P28-G8: exact-APK Android WebView visual proof for the Cryo Reserve route.
// Screenshots and telemetry are captured from the live, deployed combat scene.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { captureAcceptedG8Frame } from './p28g8-android-frame.mjs';

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
  throw new Error('P28-G8 Android WebView CDP target did not start.');
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
  throw new Error('P28-G8 Android WebView CDP connection never stabilized: ' + lastError);
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
      reject(new Error('P28-G8 CDP timeout: ' + method));
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
  throw new Error('P28-G8 Android ' + label + ' timed out; last=' + JSON.stringify(last));
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
  if (!found) throw new Error('P28-G8 Android action unavailable: ' + label);
}
async function capture(path) {
  return await captureAcceptedG8Frame(path, 'P28-G8');
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
    if (!selectedClass) throw new Error('P28-G8 cannot select Vanguard.');
    await waitFor('Boolean(document.querySelector(\'[aria-label="Confirm Vanguard"]\') && !document.querySelector(\'[aria-label="Confirm Vanguard"]\').disabled)', 'class confirm');
    await clickButton('Confirm Vanguard');
  }
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations')`, 'Command Deck');
  // Seed the same late-campaign Interdiction contract as browser E2E.
  // Do not swap to the unrelated Black Lattice finale just to get a screenshot.
  const seeded = await evaluate(`(() => {
    const seed = campaign => {
      if (!campaign?.story?.interdiction || !campaign?.story?.postKhepri) return false;
      if (campaign.story.blackLattice) {
        campaign.story.blackLattice.status = 'complete';
        campaign.story.blackLattice.step = Math.max(14, campaign.story.blackLattice.step || 0);
      }
      campaign.story.postKhepri.status = 'complete';
      campaign.story.postKhepri.step = Math.max(5, campaign.story.postKhepri.step || 0);
      const interdiction = campaign.story.interdiction;
      interdiction.status = 'active';
      interdiction.step = 1;
      interdiction.choiceA = null;
      interdiction.completed = ['interdiction-0-undecided'];
      interdiction.evidence = ['custody-rotation'];
      interdiction.identifiedTargets = ['Transfer Adjudicator Iona Vale'];
      interdiction.lastBeat = 'QA seed // Cold Relay ready at Umbra Cryogenic Propellant Reserve.';
      campaign.story.lastBeat = interdiction.lastBeat;
      campaign.lastOutcome = interdiction.lastBeat;
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
  if (!seeded) throw new Error('P28-G8 real Interdiction unlock could not be established.');
  await call('Page.reload', { ignoreCache: true });
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations')`,
    'finale Command Deck');
  await clickButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.textContent || '').trim().toLowerCase() === 'contracts')`, 'Operations');
  await clickButton('Contracts');
  await waitFor('Boolean(document.querySelector(\'button[data-location="cryo-reserve"]\'))', 'Cryo Reserve contract');
  const selected = await evaluate(`(() => {
    const b = document.querySelector('button[data-location="cryo-reserve"]');
    if (!b || b.disabled) return false;
    b.click(); return true;
  })()`);
  if (!selected) throw new Error('P28-G8 could not select Cryo Reserve.');
  await waitFor('document.querySelector(\'button[data-location="cryo-reserve"]\')?.classList.contains("selected")', 'contract selection');
  await clickButton('Deploy Selected Contract');

  const ready = `(() => {
    const d = document.querySelector('canvas')?.dataset;
    return d?.babylonScenario === 'cryo-reserve'
      && d.graphicsPathLoaded === 'babylon'
      && d.babylonBackend === 'webgl2'
      && d.renderTier === 'high'
      && d.p28FlagshipCapture === 'high-tier-qa-visual-only'
      && Boolean(d.babylonSharedWorldAssets)
      && d.babylonSharedWorldAssets.split(',').every(id => id.endsWith('-lod0'))
      && d.babylonInit === 'ready'
      && Number(d.babylonFrames || 0) >= 2
      && d.babylonEnvironmentState === 'ready'
      && d.cryoPremiumAssetState === 'ready'
      && Number(d.cryoPremiumBindings || 0) >= 70
      && d.cryoPremiumSurfaces === 'deck-plate,painted-metal,bare-metal,polymer-rubber,emissive-fixture'
      && d.environmentIbl === 'shared-prefiltered:ready'
      && d.environmentHazardLanguage === 'shared-hazards+boiloff-jet+limited-atmosphere+damaged-grid+purge-routing'
      && d.environmentSurfaceDetail?.includes('jacket-hoop:35')
      && d.environmentSurfaceDetail?.includes('thermal-sensor:14')
      && d.environmentSurfaceDetail?.includes('gallery-valve-bank:12')
      && d.babylonRouteMarkingProfile === 'cryo-recessed-service-inlay'
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
  // Do not collapse a real failure to "last=false": record each required
  // actual renderer/asset field so slow CI startup, lost WebGL context, and
  // a genuine unready material or world slot can be distinguished.
  const awaitCryoReady = async label => {
    try {
      await waitFor(ready, label, 90_000);
    } catch (error) {
      const diagnostic = await evaluate(`(() => {
        const d = document.querySelector('canvas')?.dataset ?? {};
        const fields = ['babylonScenario','graphicsPathLoaded','babylonBackend',
          'renderTier','p28FlagshipCapture','babylonSharedWorldAssets',
          'babylonInit','babylonFrames','babylonEnvironmentState',
          'cryoPremiumAssetState','cryoPremiumBindings',
          'cryoPremiumSurfaces','environmentIbl','environmentHazardLanguage',
          'environmentSurfaceDetail','cryoGrounding','cryoGroundedProps',
          'cryoWashFootprint','babylonRouteMarkingProfile',
          'babylonRouteMarkingMaxWidth','babylonSharedWorldArtState',
          'missionVisualReadiness','missionVisualMode',
          'babylonSharedWorldPendingCount','babylonSharedWorldFailedCount',
          'babylonSharedWorldMappedCount','babylonSharedWorldAuthoredCount',
          'babylonSharedWorldFallbackCount','objectiveWorldCue',
          'interactableReadability','babylonEnvironmentError',
          'cryoPremiumAssetError','babylonSharedWorldError'];
        return Object.fromEntries(fields.map(key => [key, d[key] ?? null]));
      })()`);
      throw new Error(String(error) + '; P28G8_ACTUAL_READINESS_FIELDS=' + JSON.stringify(diagnostic));
    }
  };
  await awaitCryoReady('Cryo Reserve route / authored-world visual readiness');
  // The campaign acceptance contract requires the *captured* normal and action
  // scenes to be from a real return-to-hub / redeploy cycle. This lifecycle
  // bridge is enabled only by p27d5Lifecycle=1 and calls the real App exit path.
  const exitRequested = await evaluate(`(() => {
    if (!document.querySelector('canvas')) return false;
    window.dispatchEvent(new Event('ironshade:p27d5-return-to-hub'));
    return true;
  })()`);
  if (!exitRequested) throw new Error('P28-G8 mission exit bridge unavailable.');
  await waitFor(`(() => !document.querySelector('canvas')
    && [...document.querySelectorAll('button')].some(b =>
      (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase() === 'operations'))()`,
    'returned to Command Deck before map re-entry', 20_000);
  await clickButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(b =>
    (b.textContent || '').trim().toLowerCase() === 'contracts')`,
    'post-exit Operations');
  await clickButton('Contracts');
  await waitFor('Boolean(document.querySelector(\'button[data-location="cryo-reserve"]\'))',
    're-entry Cryo Reserve contract');
  const reselected = await evaluate(`(() => {
    const contract = document.querySelector('button[data-location="cryo-reserve"]');
    if (!contract || contract.disabled) return false;
    contract.click();
    return true;
  })()`);
  if (!reselected) throw new Error('P28-G8 real Cryo Reserve redeployment unavailable.');
  await waitFor('document.querySelector(\'button[data-location="cryo-reserve"]\')?.classList.contains("selected")',
    're-entry contract selection');
  await clickButton('Deploy Selected Contract');
  await awaitCryoReady('post-reentry Cryo Reserve authored-world readiness');
  // First real boiloff purge begins at 10s, then the secondary at 21s.
  // Capture actual timed thermal danger instead of a quiet spawn scene.
  await waitFor(`(() => {
    const d = document.querySelector('canvas')?.dataset;
    return d?.environmentHazardMode === 'boiloff-purge'
      && Number(d.environmentBoiloffJets || 0) > 0;
  })()`, 'actual Cryo Reserve boiloff purge gameplay', 27_000);
  const normalBoiloff = await evaluate(
    "Number(document.querySelector('canvas')?.dataset.environmentBoiloffJets || 0)");
  if (!(normalBoiloff > 0)) throw new Error('P28-G8 capture lacks an active thermal hazard');

  console.log('ANDROID_P28G8_CRYO_REENTRY_PASS exit=command-deck redeploy=cryo-reserve state=ready');
  await sleep(650);
  const beforeVisual = await evaluate(`(() => {
    const d = document.querySelector('canvas')?.dataset ?? {};
    return { assetIds: d.babylonSharedWorldAssets ?? '',
      artState: d.babylonSharedWorldArtState ?? '',
      premium: d.cryoPremiumAssetState ?? '', ibl: d.environmentIbl ?? '' };
  })()`);
  const normalBytes = await capture('android-p28g8-cryo-reserve-normal.png');
  const before = await evaluate("document.querySelector('canvas')?.dataset.babylonCryoReservePlayerPosition ?? ''");
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(650);
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
  await sleep(500);
  await waitFor(ready, 'post-input Cryo Reserve cues', 20_000);
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
  if (!combatInput) throw new Error('P28-G8 live FIRE control is not visible');
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
        await waitFor(ready, 'live-fire Cryo authored scene', 20_000);
        actionBytes = await capture('android-p28g8-cryo-reserve-action.png');
      }
    } finally {
      await touch('touchEnd', 310 + attempt, combatInput.fireX, combatInput.fireY);
    }
    if (shotsAfter <= shotsBefore) await sleep(400);
  }
  if (shotsAfter <= shotsBefore || actionBytes < 20_000) {
    throw new Error('P28-G8 combat screenshot requires real shots after touch FIRE, got ' + shotsBefore + '->' + shotsAfter);
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
      premium: d.cryoPremiumAssetState ?? '', premiumBindings: Number(d.cryoPremiumBindings || 0),
      ibl: d.environmentIbl ?? '',
      hazardLanguage: d.environmentHazardLanguage ?? '', surfaceDetail: d.environmentSurfaceDetail ?? '',
      worldObjects: Number(d.worldObjectCount || 0),
      playerPosition: d.babylonCryoReservePlayerPosition ?? '',
      objectiveCue: d.objectiveWorldCue ?? '',
      width: canvas?.width ?? 0, height: canvas?.height ?? 0,
    };
  })()`);
  if (result.tier !== 'high' || result.captureMode !== 'high-tier-qa-visual-only'
      || before === result.playerPosition || result.capturedRoute !== 'cryo-reserve' || result.artState !== 'ready' || result.premium !== 'ready'
    || !result.assetIds || result.premiumBindings < 70 || result.fallbackObjects > 0 || result.authoredObjects !== result.mappedObjects
    || !result.tier || result.width <= 0 || result.height <= 0
    || !(shotsAfter > shotsBefore) || !(normalBytes > 20_000 && actionBytes > 20_000)) {
    throw new Error('P28-G8 actual Android visual proof incomplete: ' + JSON.stringify(result));
  }
  writeFileSync('android-p28g8-cryo-reserve.json', JSON.stringify({
    task: 'P28-G8', mapReentry: 'exit-to-command-and-redeploy:ready', deviceValidation: 'emulator-visual-evidence-not-physical-thermal-acceptance',
    normalScreenshot: 'android-p28g8-cryo-reserve-normal.png',
    actionScreenshot: 'android-p28g8-cryo-reserve-action.png',
    screenshotsBytes: [normalBytes, actionBytes], normalBoiloff, beforePosition: before,
    actionInput: 'manual-aim+live-touch-fire', shotsBefore, shotsAfter,
    beforeAssetIds: beforeVisual.assetIds, beforeArtState: beforeVisual.artState,
    beforePremium: beforeVisual.premium, beforeIbl: beforeVisual.ibl, ...result,
  }, null, 2) + '\n');
  console.log('ANDROID_P28G8_CRYO_VISUAL_CAPTURE_PASS route=cryo-reserve authored=' + result.authoredObjects + ' width=' + result.routeMaxWidth + ' tier=' + result.tier);
} finally {
  socket.close();
}
