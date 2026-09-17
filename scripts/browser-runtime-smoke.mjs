import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const appUrl = process.env.BROWSER_E2E_APP_URL ?? 'http://127.0.0.1:4173/';
const timeoutMs = Number(process.env.BROWSER_E2E_TIMEOUT_MS ?? 75_000);
const startedAt = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for browser E2E testing.');
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
      const candidates = targets.filter(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
      const readyTarget = candidates.find(candidate => candidate.url === appUrl)
        ?? candidates.find(candidate => candidate.url?.startsWith(appUrl.replace(/\/$/, '')))
        ?? candidates.find(candidate => candidate.title === 'Ironshade Vector');
      if (readyTarget) return readyTarget;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for browser CDP target; targets=${JSON.stringify(lastTargets)}${lastError ? ` error=${lastError}` : ''}`);
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to browser CDP socket')), 15_000);
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

const target = await waitForTarget();
console.log(`BROWSER_CDP_TARGET title=${JSON.stringify(target.title ?? '')} url=${JSON.stringify(target.url ?? '')}`);
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
    url: location.href,
    text: (document.body?.innerText ?? '').slice(0, 1600),
    buttons: [...document.querySelectorAll('button')].map(button => button.textContent?.trim() ?? '').slice(0, 60),
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
  throw new Error(`Timed out waiting for ${label}; browser=${JSON.stringify(state)}`);
}

async function captureScreenshot(path = 'browser-e2e-smoke.png') {
  const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (!result?.data) throw new Error('Browser screenshot payload was empty.');
  await writeFile(path, Buffer.from(result.data, 'base64'));
}

async function accessibilityAudit(surface) {
  const result = await evaluate(`(() => {
    const isVisible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    const labelledBy = element => (element.getAttribute('aria-labelledby') ?? '')
      .split(/\\s+/)
      .filter(Boolean)
      .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    const accessibleName = element => (
      element.getAttribute('aria-label')
      || labelledBy(element)
      || element.getAttribute('alt')
      || element.getAttribute('title')
      || (element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type) ? element.value : '')
      || element.textContent
      || ''
    ).trim();
    const descriptor = element => {
      const text = (element.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 60);
      return [element.tagName.toLowerCase(), element.id ? '#' + element.id : '', element.className && typeof element.className === 'string' ? '.' + element.className.trim().replace(/\\s+/g, '.') : '', text ? ':' + text : ''].join('');
    };

    const issues = [];
    if ((document.documentElement.getAttribute('lang') ?? '').trim().length < 2) issues.push('document language is missing');

    const ids = [...document.querySelectorAll('[id]')].map(element => element.id).filter(Boolean);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (duplicateIds.length) issues.push('duplicate ids: ' + duplicateIds.slice(0, 8).join(', '));

    const interactiveSelector = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [tabindex]';
    const visibleInteractive = [...document.querySelectorAll(interactiveSelector)].filter(isVisible);
    const unnamed = visibleInteractive.filter(element => accessibleName(element).length === 0).map(descriptor);
    if (unnamed.length) issues.push('interactive controls without accessible names: ' + unnamed.slice(0, 8).join(' | '));

    const formControls = [...document.querySelectorAll('input, select, textarea')].filter(isVisible);
    const unlabelledForms = formControls.filter(element => {
      if (accessibleName(element)) return false;
      if (element.id && document.querySelector('label[for="' + CSS.escape(element.id) + '"]')) return false;
      return !element.closest('label');
    }).map(descriptor);
    if (unlabelledForms.length) issues.push('form controls without labels: ' + unlabelledForms.slice(0, 8).join(' | '));

    const imagesWithoutAlt = [...document.querySelectorAll('img')].filter(isVisible).filter(image => !image.hasAttribute('alt')).map(descriptor);
    if (imagesWithoutAlt.length) issues.push('images without alt attributes: ' + imagesWithoutAlt.slice(0, 8).join(' | '));

    const unnamedCanvases = [...document.querySelectorAll('canvas')].filter(isVisible).filter(canvas => accessibleName(canvas).length === 0).map(descriptor);
    if (unnamedCanvases.length) issues.push('canvases without accessible names: ' + unnamedCanvases.slice(0, 8).join(' | '));

    const tinyTargets = visibleInteractive.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width < 24 || rect.height < 24;
    }).map(descriptor);

    return {
      issues,
      interactiveCount: visibleInteractive.length,
      formControlCount: formControls.length,
      canvasCount: [...document.querySelectorAll('canvas')].filter(isVisible).length,
      tinyTargets: tinyTargets.slice(0, 8),
    };
  })()`);

  if (result.issues.length) throw new Error(`Accessibility audit failed on ${surface}: ${JSON.stringify(result)}`);
  console.log(`BROWSER_A11Y_PASS surface=${surface} controls=${result.interactiveCount} forms=${result.formControlCount} canvases=${result.canvasCount} smallTargets=${result.tinyTargets.length}`);
  return result;
}

async function keyboardActivateButton(label) {
  const focused = await evaluate(`(() => {
    const target = ${JSON.stringify(label.toLowerCase())};
    const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().toLowerCase() === target);
    if (!button || button.disabled) return false;
    button.focus();
    return document.activeElement === button;
  })()`);
  if (!focused) throw new Error(`Could not keyboard-focus ${label} button.`);

  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
}

await call('Runtime.enable');
await call('Page.enable');

try {
  await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Ironshade document');
  await waitFor(`(() => {
    const text = (document.body?.innerText ?? '').toLowerCase();
    const labels = [...document.querySelectorAll('button')].map(button => button.textContent?.trim().toLowerCase() ?? '');
    return text.includes('save recovery lock') || (text.includes('command deck') && labels.includes('contracts'));
  })()`, 'interactive Command Deck');

  const startup = await snapshot();
  const startupText = startup.text ?? '';
  const startupButtons = startup.buttons ?? [];
  if (startupText.toLowerCase().includes('save recovery lock')) {
    throw new Error(`Browser startup entered save recovery lock: ${JSON.stringify(startup)}`);
  }
  if (startup.title !== 'Ironshade Vector' || !startupText.toLowerCase().includes('command deck') || !startupButtons.some(label => label.toLowerCase() === 'contracts')) {
    throw new Error(`Unexpected browser startup surface: ${JSON.stringify(startup)}`);
  }
  await accessibilityAudit('command-deck');

  await keyboardActivateButton('Contracts');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('contract board') && [...document.querySelectorAll('button')].some(button => button.textContent?.trim().toLowerCase() === 'deploy selected contract')`, 'Contract Board');
  await accessibilityAudit('contract-board');

  await keyboardActivateButton('Deploy Selected Contract');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('field coach') && document.querySelectorAll('canvas').length > 0`, 'Combat surface');

  const combat = await snapshot();
  if (!(combat.text ?? '').toLowerCase().includes('field coach') || combat.canvases < 1) {
    throw new Error(`Browser combat surface failed E2E validation: ${JSON.stringify(combat)}`);
  }
  await accessibilityAudit('combat');

  if (pageExceptions.length > 0) {
    throw new Error(`Browser E2E observed uncaught page exceptions: ${JSON.stringify(pageExceptions)}`);
  }

  await captureScreenshot();
  console.log(`BROWSER_E2E_PASS title=${startup.title} route=ship>contracts>combat input=keyboard canvases=${combat.canvases}`);
} catch (error) {
  await captureScreenshot().catch(() => undefined);
  const state = await snapshot().catch(snapshotError => ({ snapshotError: String(snapshotError) }));
  console.error(`BROWSER_E2E_FAILURE state=${JSON.stringify(state)} exceptions=${JSON.stringify(pageExceptions)}`);
  throw error;
} finally {
  socket.close();
}
