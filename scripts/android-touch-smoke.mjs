import { execFileSync } from 'node:child_process';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const timeoutMs = Number(process.env.ANDROID_TOUCH_TIMEOUT_MS ?? 75_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for Android touch smoke testing.');
}

function adb(...args) {
  return execFileSync('adb', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function waitForTarget() {
  let lastTargets = [];
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${cdpBase}/json/list`);
      if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
      const targets = await response.json();
      lastTargets = targets;
      const target = targets.find(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl && candidate.title === 'Ironshade Vector')
        ?? targets.find(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl && candidate.url?.startsWith('https://localhost'));
      if (target) return target;
    } catch {
      // WebView startup is asynchronous after a cold launch.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for Android WebView target; targets=${JSON.stringify(lastTargets)}`);
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
console.log(`ANDROID_TOUCH_CDP_TARGET title=${JSON.stringify(target.title ?? '')} url=${JSON.stringify(target.url ?? '')}`);
const socket = await connect(target.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();
const pageExceptions = [];

socket.addEventListener('message', event => {
  let message;
  try {
    message = JSON.parse(String(event.data));
  } catch {
    return;
  }

  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params?.exceptionDetails;
    pageExceptions.push(details?.exception?.description ?? details?.text ?? 'Unknown page exception');
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
    text: (document.body?.innerText ?? '').slice(0, 1800),
    buttons: [...document.querySelectorAll('button')].map(button => ({
      text: button.textContent?.trim() ?? '',
      aria: button.getAttribute('aria-label') ?? '',
      disabled: button.disabled,
    })).slice(0, 80),
    canvases: document.querySelectorAll('canvas').length,
    touchUi: !!document.querySelector('.touch-ui'),
  }))()`);
}

async function waitFor(predicateExpression, label, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(predicateExpression)) return;
    await sleep(200);
  }
  const state = await snapshot().catch(error => ({ snapshotError: String(error) }));
  throw new Error(`Timed out waiting for ${label}; state=${JSON.stringify(state)}`);
}

async function elementRect(selectorExpression, label) {
  const rect = await evaluate(`(() => {
    const element = ${selectorExpression};
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      dpr: devicePixelRatio || 1,
    };
  })()`);
  if (!rect) throw new Error(`Could not resolve visible ${label}.`);
  return rect;
}

function cssToDevice(rect, x, y) {
  const dpr = Number(rect.dpr || 1);
  if (!Number.isFinite(dpr) || dpr <= 0) throw new Error(`Invalid WebView devicePixelRatio: ${rect.dpr}`);
  return {
    x: Math.round(x * dpr),
    y: Math.round(y * dpr),
  };
}

async function tapSelector(selectorExpression, label) {
  const rect = await elementRect(selectorExpression, label);
  const point = cssToDevice(rect, rect.left + rect.width / 2, rect.top + rect.height / 2);
  adb('shell', 'input', 'tap', String(point.x), String(point.y));
  console.log(`ANDROID_TOUCH_TAP control=${JSON.stringify(label)} x=${point.x} y=${point.y}`);
  await sleep(250);
}

async function swipeSelector(selector, dxFactor, dyFactor, durationMs, label) {
  const rect = await elementRect(`document.querySelector(${JSON.stringify(selector)})`, label);
  const startCss = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const endCss = {
    x: startCss.x + rect.width * dxFactor,
    y: startCss.y + rect.height * dyFactor,
  };
  const start = cssToDevice(rect, startCss.x, startCss.y);
  const end = cssToDevice(rect, endCss.x, endCss.y);
  adb('shell', 'input', 'swipe', String(start.x), String(start.y), String(end.x), String(end.y), String(durationMs));
  console.log(`ANDROID_TOUCH_SWIPE control=${JSON.stringify(label)} from=${start.x},${start.y} to=${end.x},${end.y} duration=${durationMs}`);
  await sleep(350);
}

function buttonByText(label) {
  return `[...document.querySelectorAll('button')].find(button => button.textContent?.trim().toLowerCase() === ${JSON.stringify(label.toLowerCase())} && !button.disabled)`;
}

await call('Runtime.enable');
await call('Page.enable');

try {
  await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Ironshade document');
  await waitFor(`(() => {
    const text = (document.body?.innerText ?? '').toLowerCase();
    return text.includes('command deck') && !!${buttonByText('Contracts')};
  })()`, 'interactive Command Deck');

  await tapSelector(buttonByText('Contracts'), 'Contracts');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('contract board') && !!${buttonByText('Deploy Selected Contract')}`, 'Contract Board after physical tap');

  await tapSelector(buttonByText('Deploy Selected Contract'), 'Deploy Selected Contract');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('field coach') && document.querySelectorAll('canvas').length > 0 && !!document.querySelector('.touch-ui')`, 'touch combat surface');

  const coarsePointer = await evaluate(`matchMedia('(pointer: coarse)').matches`);
  if (!coarsePointer) throw new Error('Android WebView did not expose a coarse pointer; touch controls are not active.');

  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('left stick')`, 'movement tutorial');
  await swipeSelector('.move-stick', 0.34, 0, 650, 'Movement stick');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('hold fire')`, 'fire tutorial after movement swipe');

  const fireBefore = await evaluate(`document.querySelector('.fire-button')?.textContent ?? ''`);
  await tapSelector(`document.querySelector('.fire-button:not([disabled])')`, 'Fire');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('tap an ability')`, 'ability tutorial after fire tap');
  const fireAfter = await evaluate(`document.querySelector('.fire-button')?.textContent ?? ''`);
  if (fireBefore === fireAfter) {
    console.warn(`Fire control text did not change immediately: ${JSON.stringify(fireBefore)}`);
  }

  await tapSelector(`document.querySelector('.ability-button:not([disabled])')`, 'Ability');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('dodge')`, 'dodge tutorial after ability tap');

  await tapSelector(`document.querySelector('.dodge-button:not([disabled])')`, 'Dodge');
  await waitFor(`(() => {
    const button = document.querySelector('.dodge-button');
    return !!button && (button.disabled || !(button.textContent ?? '').includes('READY'));
  })()`, 'dodge cooldown after physical tap');

  const weaponBefore = await evaluate(`document.querySelector('.weapon-cycle small')?.textContent?.trim() ?? ''`);
  await tapSelector(`document.querySelector('.weapon-cycle')`, 'Weapon cycle');
  await waitFor(`(document.querySelector('.weapon-cycle small')?.textContent?.trim() ?? '') !== ${JSON.stringify('PLACEHOLDER')}`, 'weapon cycle response', 2_000).catch(() => undefined);
  const weaponAfter = await evaluate(`document.querySelector('.weapon-cycle small')?.textContent?.trim() ?? ''`);
  if (!weaponBefore || !weaponAfter || weaponBefore === weaponAfter) {
    throw new Error(`Weapon cycle touch did not change weapon label: before=${JSON.stringify(weaponBefore)} after=${JSON.stringify(weaponAfter)}`);
  }

  if (pageExceptions.length > 0) {
    throw new Error(`Android touch smoke observed uncaught page exceptions: ${JSON.stringify(pageExceptions)}`);
  }

  const state = await snapshot();
  console.log(`ANDROID_TOUCH_PASS route=ship>contracts>combat controls=move,fire,ability,dodge,weapon weapon=${weaponBefore}>${weaponAfter} canvases=${state.canvases}`);
} catch (error) {
  const state = await snapshot().catch(snapshotError => ({ snapshotError: String(snapshotError) }));
  console.error(`ANDROID_TOUCH_FAILURE state=${JSON.stringify(state)} exceptions=${JSON.stringify(pageExceptions)}`);
  throw error;
} finally {
  socket.close();
}
