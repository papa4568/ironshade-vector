const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const expectedOrigin = process.env.BROWSER_E2E_ORIGIN ?? 'http://127.0.0.1:4173';
const timeoutMs = Number(process.env.BROWSER_E2E_TIMEOUT_MS ?? 60_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for browser E2E testing.');
}

async function listTargets() {
  const response = await fetch(`${cdpBase}/json/list`);
  if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
  return await response.json();
}

function connect(url, timeout = 5_000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Timed out connecting to browser CDP socket'));
    }, timeout);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', event => {
      clearTimeout(timer);
      reject(new Error(`Browser CDP socket error: ${String(event?.message ?? 'unknown')}`));
    }, { once: true });
  });
}

function createSession(socket) {
  let requestId = 0;
  const pending = new Map();
  const events = [];

  const rejectPending = error => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  socket.addEventListener('message', event => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!message.id) {
      events.push(message);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message ?? 'CDP request failed'));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => rejectPending(new Error('Browser CDP socket closed')));
  socket.addEventListener('error', () => rejectPending(new Error('Browser CDP socket failed')));

  function call(method, params = {}, timeout = 20_000) {
    if (socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error(`CDP socket is not open for ${method}`));
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for CDP ${method}`));
      }, timeout);
      pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression, timeout) {
    const response = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }, timeout);
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
    }
    return response.result?.value;
  }

  return {
    call,
    evaluate,
    events,
    close() {
      rejectPending(new Error('Browser CDP session closed'));
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    },
  };
}

async function waitForResponsiveSession() {
  let lastError = null;
  let lastTargets = [];
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const targets = await listTargets();
      lastTargets = targets;
      const candidates = targets.filter(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl && (candidate.url ?? '').startsWith(expectedOrigin));
      for (const target of candidates) {
        let session;
        try {
          const socket = await connect(target.webSocketDebuggerUrl, 4_000);
          session = createSession(socket);
          await session.call('Runtime.enable', {}, 4_000);
          await session.call('Page.enable', {}, 4_000);
          await session.call('Log.enable', {}, 4_000).catch(() => undefined);
          const probe = await session.evaluate(`({ title: document.title, url: location.href, readyState: document.readyState })`, 4_000);
          if (probe?.title === 'Ironshade Vector' && (probe?.url ?? '').startsWith(expectedOrigin)) return { target, session };
          lastError = new Error(`Browser target was not ready: ${JSON.stringify(probe)}`);
        } catch (error) {
          lastError = error;
        }
        session?.close();
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for responsive browser CDP target; targets=${JSON.stringify(lastTargets)}${lastError ? ` error=${lastError}` : ''}`);
}

const { target, session } = await waitForResponsiveSession();
const { call, evaluate, events } = session;
console.log(`BROWSER_CDP_TARGET title=${JSON.stringify(target.title ?? '')} url=${JSON.stringify(target.url ?? '')}`);

async function snapshot() {
  return evaluate(`(() => ({
    readyState: document.readyState,
    title: document.title,
    url: location.href,
    text: (document.body?.innerText ?? '').slice(0, 1600),
    buttons: [...document.querySelectorAll('button')].map(button => button.textContent?.trim() ?? '').slice(0, 50),
    canvases: document.querySelectorAll('canvas').length,
  }))()`);
}

async function waitFor(predicateExpression, label, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(predicateExpression)) return;
    await sleep(200);
  }
  const state = await snapshot().catch(error => ({ snapshotError: String(error) }));
  throw new Error(`Timed out waiting for ${label}; browser=${JSON.stringify(state)}`);
}

function runtimeFailures() {
  const relevant = events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && ['error', 'assert'].includes(event.params?.entry?.level)));
  return relevant.map(event => {
    if (event.method === 'Runtime.exceptionThrown') return event.params?.exceptionDetails?.exception?.description ?? event.params?.exceptionDetails?.text ?? 'Runtime exception';
    return event.params?.entry?.text ?? 'Browser log error';
  });
}

await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Ironshade document');
await waitFor(`(() => {
  const text = (document.body?.innerText ?? '').toLowerCase();
  const labels = [...document.querySelectorAll('button')].map(button => button.textContent?.trim().toLowerCase() ?? '');
  return text.includes('save recovery lock') || (text.includes('command deck') && labels.includes('contracts'));
})()`, 'interactive Command deck');

const startup = await snapshot();
const startupText = (startup.text ?? '').toLowerCase();
if (startupText.includes('save recovery lock')) throw new Error(`Browser startup entered save recovery lock: ${JSON.stringify(startup)}`);
if (!startupText.includes('command deck') || !(startup.buttons ?? []).some(label => label.toLowerCase() === 'contracts')) {
  throw new Error(`Unexpected browser startup surface: ${JSON.stringify(startup)}`);
}

const openedContracts = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().toLowerCase() === 'contracts');
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!openedContracts) throw new Error('Contracts navigation button was not found in browser E2E.');
await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('contract board') && [...document.querySelectorAll('button')].some(button => button.textContent?.trim().toLowerCase() === 'deploy selected contract')`, 'Contract Board');

const deployed = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().toLowerCase() === 'deploy selected contract');
  if (!button || button.disabled) return false;
  button.click();
  return true;
})()`);
if (!deployed) throw new Error(`Selected contract could not be deployed in browser E2E: ${JSON.stringify(await snapshot())}`);
await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('field coach') && document.querySelectorAll('canvas').length > 0`, 'Combat surface');

const combat = await snapshot();
if (!(combat.text ?? '').toLowerCase().includes('field coach') || combat.canvases < 1) {
  throw new Error(`Browser combat surface failed E2E validation: ${JSON.stringify(combat)}`);
}

const screenshot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
if (!screenshot?.data) throw new Error('Browser E2E screenshot capture returned no data.');
const { writeFile } = await import('node:fs/promises');
await writeFile('browser-e2e-combat.png', Buffer.from(screenshot.data, 'base64'));

const failures = runtimeFailures();
if (failures.length) throw new Error(`Browser runtime errors detected: ${JSON.stringify(failures.slice(0, 10))}`);

session.close();
console.log(`BROWSER_E2E_PASS title=${startup.title} route=ship>contracts>combat canvases=${combat.canvases}`);
