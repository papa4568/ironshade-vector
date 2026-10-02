import { writeFileSync } from 'node:fs';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const phase = process.env.ANDROID_P27D5_PHASE ?? 'interaction';
const reportPath = process.env.ANDROID_P27D5_REPORT_PATH ?? ('android-p27d5-babylon-' + phase + '.json');
const timeoutMs = Number(process.env.ANDROID_P27D5_TIMEOUT_MS ?? 75_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (!['interaction', 'resume', 'large-screen'].includes(phase)) {
  throw new Error('Unsupported ANDROID_P27D5_PHASE: ' + phase);
}
if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for Babylon Android lifecycle smoke testing.');
}

async function listTargets() {
  const response = await fetch(cdpBase + '/json/list');
  if (!response.ok) throw new Error('CDP target listing returned HTTP ' + response.status);
  return await response.json();
}

function connect(url, timeout = 5_000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Timed out connecting to Android WebView CDP socket'));
    }, timeout);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error('Android WebView CDP socket error: ' + String(event?.message ?? 'unknown')));
    }, { once: true });
  });
}

function createSession(socket) {
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

  function call(method, params = {}, timeout = 10_000) {
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Timed out waiting for CDP ' + method));
      }, timeout);
      pending.set(id, {
        resolve: value => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: error => {
          clearTimeout(timer);
          reject(error);
        },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

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

  return { call, evaluate };
}

async function waitForSession() {
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const targets = await listTargets();
      const target = targets.find(candidate => candidate.webSocketDebuggerUrl && candidate.title === 'Ironshade Vector');
      if (target) {
        const socket = await connect(target.webSocketDebuggerUrl);
        const session = createSession(socket);
        await session.call('Runtime.enable');
        await session.call('Page.enable');
        const ready = await session.evaluate('document.readyState');
        if (ready === 'complete' || ready === 'interactive') return { socket, session };
        socket.close();
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error('Timed out waiting for Ironshade Vector WebView' + (lastError ? ': ' + String(lastError) : ''));
}

const { socket, session } = await waitForSession();
const { call, evaluate } = session;

async function waitFor(expression, label, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  let lastValue = null;
  while (Date.now() < deadline) {
    try {
      lastValue = await evaluate(expression);
      if (lastValue) return lastValue;
    } catch {}
    await sleep(200);
  }
  throw new Error('Timed out waiting for ' + label + '; last=' + JSON.stringify(lastValue));
}

async function elementCenter(selector) {
  return await evaluate('(() => { const element = document.querySelector(' + JSON.stringify(selector) + '); if (!element) return null; const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) return null; return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, left: rect.left, top: rect.top, width: rect.width, height: rect.height, disabled: Boolean(element.disabled) }; })()');
}

async function buttonCenter(label) {
  const normalized = label.toLowerCase();
  return await evaluate('(() => { const target = [...document.querySelectorAll("button")].find(button => (button.textContent || "").trim().toLowerCase() === ' + JSON.stringify(normalized) + '); if (!target) return null; const rect = target.getBoundingClientRect(); const style = getComputedStyle(target); if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) return null; return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, disabled: Boolean(target.disabled) }; })()');
}

async function dispatchTouch(type, x, y, id) {
  const touchPoints = type === 'touchEnd' || type === 'touchCancel'
    ? []
    : [{ x: Math.round(x), y: Math.round(y), radiusX: 4, radiusY: 4, force: 1, id }];
  await call('Input.dispatchTouchEvent', {
    type,
    touchPoints,
    modifiers: 0,
  });
}

async function tapPoint(point, id, holdMs = 90) {
  if (!point || point.disabled) return false;
  await dispatchTouch('touchStart', point.x, point.y, id);
  await sleep(holdMs);
  await dispatchTouch('touchEnd', point.x, point.y, id);
  await sleep(180);
  return true;
}

async function tapSelector(selector, id, holdMs = 90) {
  return await tapPoint(await elementCenter(selector), id, holdMs);
}

async function tapButton(label, id, holdMs = 90) {
  return await tapPoint(await buttonCenter(label), id, holdMs);
}

async function navigateBabylonQa() {
  const currentUrl = await evaluate('location.href');
  const url = new URL(currentUrl);
  url.search = '';
  url.searchParams.set('graphicsCompare', '1');
  url.searchParams.set('graphicsPath', 'babylon');
  url.searchParams.set('babylonBackend', 'webgl2');
  url.searchParams.set('p27d5Lifecycle', '1');
  await call('Page.navigate', { url: url.toString() }, 10_000);
  await waitFor('document.readyState === "complete" && document.title === "Ironshade Vector"', 'Babylon QA document', 45_000);
}

async function ensureCommandDeck(idBase) {
  await waitFor('document.readyState === "complete" && document.title === "Ironshade Vector"', 'Ironshade document', 45_000);
  const needsIntake = await evaluate('Boolean(document.querySelector(".class-intake"))');
  if (needsIntake) {
    if (!(await tapSelector('[aria-label="Select Vanguard class"]', idBase))) {
      throw new Error('P27-D5 could not select Vanguard during fresh Android intake.');
    }
    if (!(await tapSelector('[aria-label="Confirm Vanguard"]', idBase + 1))) {
      throw new Error('P27-D5 could not confirm Vanguard during fresh Android intake.');
    }
  }
  await waitFor('[...document.querySelectorAll("button")].some(button => button.getAttribute("data-primary-area") === "operations")', 'P27-D5 Command Deck', 45_000);
}

async function deployRefinery(idBase) {
  await ensureCommandDeck(idBase);
  if (!(await tapSelector('button[data-primary-area="operations"]', idBase + 2))) {
    throw new Error('P27-D5 Operations touch target unavailable.');
  }
  await waitFor('[...document.querySelectorAll("button")].some(button => (button.textContent || "").trim().toLowerCase() === "contracts")', 'P27-D5 Operations contracts');
  if (!(await tapButton('Contracts', idBase + 3))) {
    throw new Error('P27-D5 Contracts touch target unavailable.');
  }
  await waitFor('[...document.querySelectorAll("button")].some(button => button.getAttribute("data-location") === "asteroid-refinery")', 'P27-D5 refinery contract');
  if (!(await tapSelector('button[data-location="asteroid-refinery"]', idBase + 4))) {
    throw new Error('P27-D5 refinery contract touch target unavailable.');
  }
  await waitFor('[...document.querySelectorAll("button")].some(button => button.getAttribute("data-location") === "asteroid-refinery" && button.classList.contains("selected"))', 'P27-D5 refinery selection');
  if (!(await tapButton('Deploy selected contract', idBase + 5, 120))) {
    throw new Error('P27-D5 deploy touch target unavailable.');
  }
  await waitFor('(() => { const canvas = document.querySelector("canvas"); return Boolean(canvas && canvas.dataset.graphicsPathSelection === "qa-explicit" && canvas.dataset.graphicsPathRequested === "babylon" && canvas.dataset.babylonBackendRequested === "webgl2" && canvas.dataset.graphicsPathLoaded === "webgl2" && canvas.dataset.babylonBackendLoaded === "webgl2" && canvas.dataset.babylonInit === "ready" && canvas.dataset.babylonScene === "active" && canvas.dataset.babylonDisposed === "false"); })()', 'P27-D5 Babylon WebGL2 combat', 45_000);
  await waitFor('Number(document.querySelector("canvas")?.dataset.babylonFrames ?? "0") >= 2', 'P27-D5 Babylon rendered frames', 30_000);
}

async function readBabylonState() {
  return await evaluate('(() => { const canvas = document.querySelector("canvas"); const root = document.querySelector(".game-root"); return { title: document.title, href: location.href, canvas: Boolean(canvas), selection: canvas?.dataset.graphicsPathSelection ?? "", requested: canvas?.dataset.graphicsPathRequested ?? "", graphicsLoaded: canvas?.dataset.graphicsPathLoaded ?? "", backendRequested: canvas?.dataset.babylonBackendRequested ?? "", backendLoaded: canvas?.dataset.babylonBackendLoaded ?? "", init: canvas?.dataset.babylonInit ?? "", scene: canvas?.dataset.babylonScene ?? "", disposed: canvas?.dataset.babylonDisposed ?? "", disposeCount: Number(canvas?.dataset.babylonDisposeCount ?? "0"), frames: Number(canvas?.dataset.babylonFrames ?? "0"), controls: [...document.querySelectorAll("[aria-label]")].some(element => element.getAttribute("aria-label") === "Touch combat controls"), shots: Number(root?.dataset.weaponShots ?? "0"), tutorialStep: Number(root?.dataset.tutorialStep ?? "0"), mission: document.querySelector(".mission-chip")?.textContent?.trim() ?? "" }; })()');
}

function requireBabylonState(state, label, requireTouch = true) {
  if (!state
    || !state.canvas
    || state.selection !== 'qa-explicit'
    || state.requested !== 'babylon'
    || state.graphicsLoaded !== 'webgl2'
    || state.backendRequested !== 'webgl2'
    || state.backendLoaded !== 'webgl2'
    || state.init !== 'ready'
    || state.scene !== 'active'
    || state.disposed !== 'false'
    || state.frames < 1
    || (requireTouch && !state.controls)) {
    throw new Error(label + ' Babylon state invalid: ' + JSON.stringify(state));
  }
}

async function exerciseRealTouch(idBase) {
  const scrollBefore = await evaluate('({ x: window.scrollX, y: window.scrollY })');
  const move = await elementCenter('.move-stick');
  if (!move) throw new Error('P27-D5 movement stick unavailable.');
  await dispatchTouch('touchStart', move.x, move.y, idBase);
  await dispatchTouch('touchMove', move.x + Math.min(34, move.width * 0.26), move.y - Math.min(18, move.height * 0.18), idBase);
  await sleep(450);
  await dispatchTouch('touchEnd', move.x + Math.min(34, move.width * 0.26), move.y - Math.min(18, move.height * 0.18), idBase);
  await sleep(180);

  const canvas = await elementCenter('canvas');
  if (!canvas) throw new Error('P27-D5 Babylon canvas unavailable for touch aim.');
  const aimStartX = canvas.left + canvas.width * 0.72;
  const aimStartY = canvas.top + canvas.height * 0.5;
  const aimEndX = Math.min(canvas.left + canvas.width - 12, aimStartX + Math.min(46, canvas.width * 0.08));
  const aimEndY = Math.max(canvas.top + 12, aimStartY - Math.min(22, canvas.height * 0.08));
  await dispatchTouch('touchStart', aimStartX, aimStartY, idBase + 1);
  await dispatchTouch('touchMove', aimEndX, aimEndY, idBase + 1);
  await sleep(120);
  await dispatchTouch('touchEnd', aimEndX, aimEndY, idBase + 1);
  await sleep(900);

  let fireObserved = false;
  for (let attempt = 0; attempt < 3 && !fireObserved; attempt += 1) {
    const fire = await elementCenter('.fire-button');
    if (!fire || fire.disabled) throw new Error('P27-D5 FIRE control unavailable.');
    const before = Number(await evaluate('document.querySelector(".game-root")?.dataset.weaponShots ?? "0"'));
    await dispatchTouch('touchStart', fire.x, fire.y, idBase + 10 + attempt);
    await sleep(850);
    await dispatchTouch('touchEnd', fire.x, fire.y, idBase + 10 + attempt);
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const after = Number(await evaluate('document.querySelector(".game-root")?.dataset.weaponShots ?? "0"'));
      if (after > before) {
        fireObserved = true;
        break;
      }
      await sleep(180);
    }
    if (!fireObserved) await sleep(500);
  }
  if (!fireObserved) throw new Error('P27-D5 real-touch FIRE did not increment Babylon combat shot telemetry.');

  const ability = await elementCenter('.ability-button:not(:disabled)');
  if (!ability || ability.disabled) throw new Error('P27-D5 class-skill touch target unavailable.');
  await tapPoint(ability, idBase + 20, 100);
  await waitFor('document.querySelector(".ability-button")?.disabled === true || Number(document.querySelector(".game-root")?.dataset.tutorialStep ?? "0") >= 3', 'P27-D5 ability touch response', 12_000);

  const scrollAfter = await evaluate('({ x: window.scrollX, y: window.scrollY })');
  if (scrollAfter.x !== scrollBefore.x || scrollAfter.y !== scrollBefore.y) {
    throw new Error('P27-D5 Babylon touch gestures moved the page: before=' + JSON.stringify(scrollBefore) + ' after=' + JSON.stringify(scrollAfter));
  }
  console.log('ANDROID_P27D5_TOUCH_PASS move=drag aim=drag fire=hold ability=tap scroll=' + scrollAfter.x + ',' + scrollAfter.y);
}

async function exerciseControllerDodge() {
  const installed = await evaluate('(() => { globalThis.__ironshadeP27D5Gamepad = { connected: true, axes: [0,0,0,0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }; globalThis.__ironshadeP27D5OriginalGetGamepads = typeof navigator.getGamepads === "function" ? navigator.getGamepads.bind(navigator) : null; Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [globalThis.__ironshadeP27D5Gamepad] }); return typeof navigator.getGamepads === "function"; })()');
  if (!installed) throw new Error('P27-D5 could not install controller QA gamepad.');
  await waitFor('Boolean(document.querySelector(".dodge-button:not(:disabled)"))', 'P27-D5 controller dodge ready', 12_000);
  await evaluate('(() => { const button = globalThis.__ironshadeP27D5Gamepad?.buttons?.[0]; if (!button) return false; button.pressed = true; button.value = 1; return true; })()');
  await sleep(140);
  await evaluate('(() => { const button = globalThis.__ironshadeP27D5Gamepad?.buttons?.[0]; if (!button) return false; button.pressed = false; button.value = 0; return true; })()');
  await waitFor('document.querySelector(".dodge-button")?.disabled === true', 'P27-D5 controller dodge response', 8_000);
  await evaluate('(() => { const original = globalThis.__ironshadeP27D5OriginalGetGamepads; if (original) Object.defineProperty(navigator, "getGamepads", { configurable: true, value: original }); delete globalThis.__ironshadeP27D5Gamepad; delete globalThis.__ironshadeP27D5OriginalGetGamepads; return true; })()');
  console.log('ANDROID_P27D5_CONTROLLER_PASS input=gamepad-a dodge=triggered');
}

async function proveRendererReentry() {
  const before = Number(await evaluate('document.querySelector("canvas")?.dataset.babylonDisposeCount ?? "0"'));
  const armed = await evaluate('(() => { const canvas = document.querySelector("canvas"); if (!canvas) return false; globalThis.__ironshadeP27D5RestartCanvas = canvas; window.dispatchEvent(new Event("ironshade:p27d5-restart-renderer")); return true; })()');
  if (!armed) throw new Error('P27-D5 could not arm renderer re-entry.');
  await waitFor('(() => { const canvas = document.querySelector("canvas"); return Boolean(canvas && canvas === globalThis.__ironshadeP27D5RestartCanvas && Number(canvas.dataset.babylonDisposeCount ?? "0") > ' + before + ' && canvas.dataset.babylonInit === "ready" && canvas.dataset.babylonScene === "active" && canvas.dataset.babylonDisposed === "false" && canvas.dataset.babylonBackendLoaded === "webgl2"); })()', 'P27-D5 Babylon renderer re-entry', 30_000);
  const after = Number(await evaluate('document.querySelector("canvas")?.dataset.babylonDisposeCount ?? "0"'));
  console.log('ANDROID_P27D5_RENDERER_REENTRY_PASS backend=webgl2 disposeCount=' + before + '->' + after + ' surface=reused');
  return { before, after };
}

async function proveMissionExitAndReentry() {
  const exited = await evaluate('(() => { const canvas = document.querySelector("canvas"); if (!canvas) return false; globalThis.__ironshadeP27D5ExitedCanvas = canvas; window.dispatchEvent(new Event("ironshade:p27d5-return-to-hub")); return true; })()');
  if (!exited) throw new Error('P27-D5 could not request mission exit.');
  await waitFor('[...document.querySelectorAll("button")].some(button => button.getAttribute("data-primary-area") === "operations") && !document.querySelector("canvas")', 'P27-D5 return to Command Deck', 20_000);
  const disposed = await evaluate('(() => { const canvas = globalThis.__ironshadeP27D5ExitedCanvas; return canvas ? { connected: canvas.isConnected, disposed: canvas.dataset.babylonDisposed ?? "", scene: canvas.dataset.babylonScene ?? "", disposeCount: Number(canvas.dataset.babylonDisposeCount ?? "0") } : null; })()');
  if (!disposed || disposed.connected || disposed.disposed !== 'true' || disposed.scene !== 'disposed' || disposed.disposeCount < 1) {
    throw new Error('P27-D5 mission exit did not dispose Babylon renderer: ' + JSON.stringify(disposed));
  }
  await deployRefinery(700);
  const reentered = await readBabylonState();
  requireBabylonState(reentered, 'P27-D5 mission re-entry');
  console.log('ANDROID_P27D5_MISSION_REENTRY_PASS exit=disposed reentry=ready backend=webgl2 oldDisposeCount=' + disposed.disposeCount);
  return { disposed, reentered };
}

async function fireAfterResume(idBase) {
  const canvasPreserved = await evaluate('globalThis.__ironshadeP27D5ResumeCanvas === document.querySelector("canvas")');
  const sentinel = await evaluate('globalThis.__ironshadeP27D5ResumeToken ?? ""');
  if (!canvasPreserved || sentinel !== 'p27-d5-preserved-webview') {
    throw new Error('P27-D5 pause/resume did not preserve WebView renderer identity: canvas=' + canvasPreserved + ' sentinel=' + sentinel);
  }

  const canvas = await elementCenter('canvas');
  if (!canvas) throw new Error('P27-D5 resumed canvas unavailable for aim.');
  const aimX = canvas.left + canvas.width * 0.78;
  const aimY = canvas.top + canvas.height * 0.48;
  await dispatchTouch('touchStart', aimX, aimY, idBase);
  await dispatchTouch('touchMove', Math.min(canvas.left + canvas.width - 12, aimX + 32), Math.max(canvas.top + 12, aimY - 14), idBase);
  await sleep(100);
  await dispatchTouch('touchEnd', Math.min(canvas.left + canvas.width - 12, aimX + 32), Math.max(canvas.top + 12, aimY - 14), idBase);
  await sleep(650);

  let fired = false;
  for (let attempt = 0; attempt < 3 && !fired; attempt += 1) {
    const fire = await elementCenter('.fire-button');
    if (!fire || fire.disabled) throw new Error('P27-D5 resumed FIRE control unavailable.');
    const before = Number(await evaluate('document.querySelector(".game-root")?.dataset.weaponShots ?? "0"'));
    await dispatchTouch('touchStart', fire.x, fire.y, idBase + 10 + attempt);
    await sleep(800);
    await dispatchTouch('touchEnd', fire.x, fire.y, idBase + 10 + attempt);
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const after = Number(await evaluate('document.querySelector(".game-root")?.dataset.weaponShots ?? "0"'));
      if (after > before) {
        fired = true;
        break;
      }
      await sleep(180);
    }
  }
  if (!fired) throw new Error('P27-D5 resumed real-touch FIRE did not increment shot telemetry.');
  return true;
}

if (phase === 'interaction' || phase === 'large-screen') {
  await navigateBabylonQa();
  await deployRefinery(300);
  const initial = await readBabylonState();
  requireBabylonState(initial, 'P27-D5 initial Babylon', phase === 'interaction');
  console.log('ANDROID_P27D5_BABYLON_WEBGL2_PASS requested=babylon backendRequested=webgl2 loaded=' + initial.backendLoaded + ' frames=' + initial.frames);

  if (phase === 'large-screen') {
    await evaluate('globalThis.__ironshadeP27D5LargeScreenEntry = "babylon-webgl2-ready"');
    console.log('ANDROID_P27D5_LARGE_SCREEN_READY_PASS backend=webgl2 mission=' + JSON.stringify(initial.mission) + ' frames=' + initial.frames);
    socket.close();
    process.exit(0);
  }

  await exerciseRealTouch(400);
  await exerciseControllerDodge();
  const rendererReentry = await proveRendererReentry();
  const missionLifecycle = await proveMissionExitAndReentry();
  const finalState = await readBabylonState();
  requireBabylonState(finalState, 'P27-D5 final Babylon');
  await evaluate('(() => { globalThis.__ironshadeP27D5ResumeCanvas = document.querySelector("canvas"); globalThis.__ironshadeP27D5ResumeToken = "p27-d5-preserved-webview"; return true; })()');

  const report = {
    schema: 'p27-d5-babylon-android-v1',
    phase,
    backend: {
      requested: finalState.requested,
      babylonRequested: finalState.backendRequested,
      loaded: finalState.backendLoaded,
      graphicsLoaded: finalState.graphicsLoaded,
    },
    touch: 'move+aim+fire+ability',
    controller: 'gamepad-dodge',
    rendererReentry,
    missionLifecycle,
    finalState,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log('ANDROID_P27D5_INTERACTION_PASS backend=webgl2 touch=move+aim+fire+ability controller=dodge rendererReentry=verified missionExitReentry=verified report=' + reportPath);
  socket.close();
  process.exit(0);
}

await waitFor('(() => { const canvas = document.querySelector("canvas"); return Boolean(canvas && canvas.dataset.graphicsPathRequested === "babylon" && canvas.dataset.babylonBackendRequested === "webgl2" && canvas.dataset.babylonBackendLoaded === "webgl2" && canvas.dataset.babylonInit === "ready" && canvas.dataset.babylonScene === "active" && canvas.dataset.babylonDisposed === "false"); })()', 'P27-D5 resumed Babylon renderer', 45_000);
const resumedBefore = await readBabylonState();
requireBabylonState(resumedBefore, 'P27-D5 resumed Babylon');
await fireAfterResume(900);
const resumedAfter = await readBabylonState();
requireBabylonState(resumedAfter, 'P27-D5 resumed Babylon after touch');
if (resumedAfter.disposeCount !== resumedBefore.disposeCount) {
  throw new Error('P27-D5 renderer was recreated across preserved-process pause/resume: ' + resumedBefore.disposeCount + '->' + resumedAfter.disposeCount);
}
const resumeReport = {
  schema: 'p27-d5-babylon-android-v1',
  phase,
  process: 'preserved',
  webView: 'preserved',
  renderer: 'preserved',
  backend: 'webgl2',
  inputAfterResume: 'real-touch-fire',
  before: resumedBefore,
  after: resumedAfter,
};
writeFileSync(reportPath, JSON.stringify(resumeReport, null, 2) + '\n');
console.log('ANDROID_P27D5_LIFECYCLE_RESUME_PASS process=preserved webView=preserved renderer=preserved backend=webgl2 input=real-touch-fire disposeCount=' + resumedAfter.disposeCount + ' report=' + reportPath);
socket.close();
