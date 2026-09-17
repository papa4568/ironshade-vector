const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const timeoutMs = Number(process.env.ANDROID_SMOKE_TIMEOUT_MS ?? 75_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for Android runtime smoke testing.');
}

async function waitForTarget() {
  let lastError = null;
  let lastTargets = [];
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${cdpBase}/json/list`);
      if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
      const targets = await response.json();
      lastTargets = targets;
      const candidates = targets.filter(candidate => candidate.webSocketDebuggerUrl);
      const readyTarget = candidates.find(candidate => candidate.title === 'Ironshade Vector')
        ?? candidates.find(candidate => /ironshade/i.test(candidate.title ?? '') && /localhost/i.test(candidate.url ?? ''));
      if (readyTarget) return readyTarget;
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ready Android WebView CDP target; targets=${JSON.stringify(lastTargets)}${lastError ? ` error=${lastError}` : ''}`);
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to Android WebView CDP socket')), 15_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error(`Android WebView CDP socket error: ${String(event?.message ?? 'unknown')}`));
    }, { once: true });
  });
}

const target = await waitForTarget();
console.log(`ANDROID_CDP_TARGET title=${JSON.stringify(target.title ?? '')} url=${JSON.stringify(target.url ?? '')}`);
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

function call(method, params = {}) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for CDP ${method}`));
    }, 20_000);
    pending.set(id, {
      resolve: value => { clearTimeout(timer); resolve(value); },
      reject: error => { clearTimeout(timer); reject(error); },
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

async function snapshot() {
  return evaluate(`(() => ({
    readyState: document.readyState,
    title: document.title,
    url: location.href,
    text: (document.body?.innerText ?? '').slice(0, 1200),
    buttons: [...document.querySelectorAll('button')].map(button => button.textContent?.trim() ?? '').slice(0, 40),
    canvases: document.querySelectorAll('canvas').length,
  }))()`);
}

async function waitFor(predicateExpression, label, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(predicateExpression)) return;
    await sleep(250);
  }
  const state = await snapshot().catch(error => ({ snapshotError: String(error) }));
  throw new Error(`Timed out waiting for ${label}; webview=${JSON.stringify(state)}`);
}

async function elementMetrics(selector) {
  const encoded = JSON.stringify(selector);
  return evaluate(`(() => {
    const element = document.querySelector(${encoded});
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      text: element.textContent?.trim() ?? '',
      disabled: 'disabled' in element ? Boolean(element.disabled) : false,
    };
  })()`);
}

async function dispatchTouch(type, x, y, id = 1) {
  const touchPoints = type === 'touchEnd' || type === 'touchCancel'
    ? []
    : [{ x, y, id, radiusX: 1, radiusY: 1, force: 1 }];
  await call('Input.dispatchTouchEvent', { type, touchPoints });
}

async function tap(selector, id = 1, holdMs = 90) {
  const metrics = await elementMetrics(selector);
  if (!metrics || metrics.disabled) throw new Error(`Touch target unavailable: ${selector}`);
  await dispatchTouch('touchStart', metrics.x, metrics.y, id);
  await sleep(holdMs);
  await dispatchTouch('touchEnd', metrics.x, metrics.y, id);
  return metrics;
}

await call('Runtime.enable');
await call('Page.enable').catch(() => undefined);
await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Ironshade document', 45_000);
await waitFor(`(() => {
  const text = (document.body?.innerText ?? '').toLowerCase();
  const labels = [...document.querySelectorAll('button')].map(button => button.textContent?.trim().toLowerCase() ?? '');
  return text.includes('save recovery lock') || (text.includes('command deck') && labels.includes('contracts'));
})()`, 'interactive Command deck', 45_000);

const startup = await snapshot();
const startupText = startup.text ?? '';
if (startupText.toLowerCase().includes('save recovery lock')) {
  throw new Error(`Android startup entered save recovery lock: ${JSON.stringify(startup)}`);
}
const startupButtons = startup.buttons ?? [];
if (startup.title !== 'Ironshade Vector' || !startupText.toLowerCase().includes('command deck') || !startupButtons.some(label => label.toLowerCase() === 'contracts')) {
  throw new Error(`Unexpected Android startup surface: ${JSON.stringify(startup)}`);
}

const openedContracts = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().toLowerCase() === 'contracts');
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!openedContracts) throw new Error('Contracts navigation button was not found.');
await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('contract board') && [...document.querySelectorAll('button')].some(button => button.textContent?.trim().toLowerCase() === 'deploy selected contract')`, 'Contract Board');

const deployed = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().toLowerCase() === 'deploy selected contract');
  if (!button || button.disabled) return false;
  button.click();
  return true;
})()`);
if (!deployed) throw new Error(`Selected contract could not be deployed from the Android Contract Board: ${JSON.stringify(await snapshot())}`);
await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('field coach') && document.querySelectorAll('canvas').length > 0`, 'Combat surface', 45_000);

const combat = await snapshot();
if (!(combat.text ?? '').toLowerCase().includes('field coach') || combat.canvases < 1) {
  throw new Error(`Android combat surface failed smoke validation: ${JSON.stringify(combat)}`);
}

await waitFor(`Boolean(document.querySelector('[aria-label="Touch combat controls"]') && document.querySelector('.move-stick') && document.querySelector('.fire-button') && document.querySelector('.dodge-button'))`, 'Android touch controls');
const scrollBefore = await evaluate(`({ x: window.scrollX, y: window.scrollY })`);

const move = await elementMetrics('.move-stick');
if (!move) throw new Error('Android movement stick was not found.');
await dispatchTouch('touchStart', move.x, move.y, 11);
await dispatchTouch('touchMove', move.x + Math.min(36, move.width * 0.3), move.y - Math.min(18, move.height * 0.15), 11);
await waitFor(`(() => {
  const stick = document.querySelector('.move-stick');
  const coach = document.querySelector('.tutorial-coach')?.textContent ?? '';
  return Boolean(stick && stick.style.getPropertyValue('--knob-x') && stick.style.getPropertyValue('--knob-x') !== '0px' && coach.includes('FIELD COACH // 2/5'));
})()`, 'movement touch response', 15_000);
await dispatchTouch('touchEnd', move.x, move.y, 11);
await waitFor(`document.querySelector('.move-stick')?.style.getPropertyValue('--knob-x') === '0px' && document.querySelector('.move-stick')?.style.getPropertyValue('--knob-y') === '0px'`, 'movement stick release', 10_000);

const canvas = await elementMetrics('canvas');
if (!canvas) throw new Error('Android combat canvas was not found for manual aim test.');
const aimStartX = canvas.left + canvas.width * 0.72;
const aimStartY = canvas.top + canvas.height * 0.5;
const aimEndX = Math.min(canvas.left + canvas.width - 12, aimStartX + Math.min(52, canvas.width * 0.08));
const aimEndY = Math.max(canvas.top + 12, aimStartY - Math.min(28, canvas.height * 0.08));
await dispatchTouch('touchStart', aimStartX, aimStartY, 12);
await dispatchTouch('touchMove', aimEndX, aimEndY, 12);
await sleep(120);
await dispatchTouch('touchEnd', aimEndX, aimEndY, 12);
await waitFor(`(document.querySelector('.tutorial-coach')?.textContent ?? '').includes('FIELD COACH // 3/5')`, 'manual aim touch response', 15_000);

const fireBefore = await evaluate(`document.querySelector('.fire-button small')?.textContent ?? ''`);
const fire = await elementMetrics('.fire-button');
if (!fire || fire.disabled) throw new Error('Android FIRE control was unavailable.');
await dispatchTouch('touchStart', fire.x, fire.y, 13);
await sleep(420);
await dispatchTouch('touchEnd', fire.x, fire.y, 13);
await waitFor(`(document.querySelector('.fire-button small')?.textContent ?? '') !== ${JSON.stringify(fireBefore)}`, 'hold-to-fire response', 15_000);

const weaponBefore = await evaluate(`document.querySelector('.weapon-cycle small')?.textContent ?? ''`);
await tap('.weapon-cycle', 14);
await waitFor(`(document.querySelector('.weapon-cycle small')?.textContent ?? '') !== ${JSON.stringify(weaponBefore)}`, 'weapon cycle response', 15_000);

await tap('.ability-button:not(:disabled)', 15);
await waitFor(`(document.querySelector('.tutorial-coach')?.textContent ?? '').includes('FIELD COACH // 4/5')`, 'ability touch response', 15_000);

await tap('.dodge-button:not(:disabled)', 16);
await waitFor(`document.querySelector('.dodge-button')?.disabled === true`, 'dodge touch response', 15_000);

const scrollAfter = await evaluate(`({ x: window.scrollX, y: window.scrollY })`);
if (scrollAfter.x !== scrollBefore.x || scrollAfter.y !== scrollBefore.y) {
  throw new Error(`Android combat touch gestures moved the page: before=${JSON.stringify(scrollBefore)} after=${JSON.stringify(scrollAfter)}`);
}

console.log(`ANDROID_TOUCH_SMOKE_PASS move=drag aim=drag fire=hold ability=tap dodge=tap weapon=cycle scroll=${scrollAfter.x},${scrollAfter.y}`);
socket.close();
console.log(`ANDROID_RUNTIME_SMOKE_PASS title=${startup.title} route=ship>contracts>combat canvases=${combat.canvases}`);
