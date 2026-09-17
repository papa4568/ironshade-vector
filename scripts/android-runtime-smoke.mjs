const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const timeoutMs = Number(process.env.ANDROID_SMOKE_TIMEOUT_MS ?? 45_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for Android runtime smoke testing.');
}

async function waitForTarget() {
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${cdpBase}/json/list`);
      if (!response.ok) throw new Error(`CDP target listing returned HTTP ${response.status}`);
      const targets = await response.json();
      const target = targets.find(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl)
        ?? targets.find(candidate => candidate.webSocketDebuggerUrl);
      if (target) return target;
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for Android WebView CDP target${lastError ? `: ${lastError}` : ''}`);
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to Android WebView CDP socket')), 10_000);
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
    }, 10_000);
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
    throw new Error(response.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return response.result?.value;
}

async function waitFor(predicateExpression, label, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(predicateExpression)) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

await call('Runtime.enable');
await waitFor(`document.readyState === 'complete' && document.body?.innerText.includes('Command deck')`, 'Command deck');

const startup = await evaluate(`(() => {
  const text = document.body?.innerText ?? '';
  const buttons = [...document.querySelectorAll('button')].map(button => button.textContent?.trim() ?? '');
  return {
    title: document.title,
    commandDeck: text.includes('Command deck'),
    contracts: buttons.includes('Contracts'),
    deploy: buttons.includes('Deploy selected contract'),
  };
})()`);
if (startup?.title !== 'Ironshade Vector' || !startup.commandDeck || !startup.contracts || !startup.deploy) {
  throw new Error(`Unexpected Android startup surface: ${JSON.stringify(startup)}`);
}

const openedContracts = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === 'Contracts');
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!openedContracts) throw new Error('Contracts navigation button was not found.');
await waitFor(`document.body?.innerText.includes('CONTRACT BOARD // VIEW') && document.body?.innerText.includes('Deploy selected contract')`, 'Contract Board');

const deployed = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === 'Deploy selected contract');
  if (!button || button.disabled) return false;
  button.click();
  return true;
})()`);
if (!deployed) throw new Error('Selected contract could not be deployed from the Android Contract Board.');
await waitFor(`document.body?.innerText.includes('FIELD COACH') && document.querySelectorAll('canvas').length > 0`, 'Combat surface', 30_000);

const combat = await evaluate(`(() => ({
  fieldCoach: document.body?.innerText.includes('FIELD COACH'),
  canvases: document.querySelectorAll('canvas').length,
  dialogs: document.querySelectorAll('[role="dialog"]').length,
}))()`);
if (!combat?.fieldCoach || combat.canvases < 1) {
  throw new Error(`Android combat surface failed smoke validation: ${JSON.stringify(combat)}`);
}

socket.close();
console.log(`ANDROID_RUNTIME_SMOKE_PASS title=${startup.title} route=ship>contracts>combat canvases=${combat.canvases}`);
