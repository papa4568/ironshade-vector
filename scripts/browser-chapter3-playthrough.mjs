import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const appUrl = process.env.BROWSER_E2E_APP_URL ?? 'http://127.0.0.1:4173/';
const viewport = process.env.BROWSER_E2E_VIEWPORT ?? 'desktop';
const screenshotPath = process.env.BROWSER_E2E_CHAPTER3_SCREENSHOT ?? `browser-chapter3-${viewport}.png`;
const reportPath = process.env.BROWSER_E2E_CHAPTER3_REPORT ?? `browser-chapter3-${viewport}.json`;
const interactionMode = process.env.CHAPTER3_INTERACTION_MODE ?? 'dom';
const targetTitle = process.env.CHAPTER3_TARGET_TITLE ?? '';
const runtime = interactionMode === 'touch' ? 'android-webview' : 'browser';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') throw new Error('Node WebSocket support is required for Chapter 3 browser QA.');

async function waitForTarget() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${cdpBase}/json/list`);
    if (response.ok) {
      const targets = await response.json();
      const target = targets.find(candidate => candidate.webSocketDebuggerUrl
        && candidate.url?.startsWith(appUrl.replace(/\/$/, ''))
        && (!targetTitle || candidate.title === targetTitle)
        && (candidate.type === 'page' || interactionMode === 'touch'));
      if (target) return target;
    }
    await sleep(200);
  }
  throw new Error('Timed out waiting for the Ironshade browser target.');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('Timed out connecting to Chrome CDP.')), 15_000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(socket); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chrome CDP socket failed.')); }, { once: true });
  });
}

const target = await waitForTarget();
const socket = await connect(target.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();
const exceptions = [];

socket.addEventListener('message', event => {
  let message;
  try { message = JSON.parse(String(event.data)); } catch { return; }
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params?.exceptionDetails;
    exceptions.push(details?.exception?.description ?? details?.text ?? 'Unknown browser exception');
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
      reject(new Error(`Timed out waiting for ${method}`));
    }, 20_000);
    pending.set(id, {
      resolve: value => { clearTimeout(timer); resolve(value); },
      reject: error => { clearTimeout(timer); reject(error); },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
  return response.result?.value;
}

async function waitFor(expression, label, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function activateElement(expression, label) {
  if (interactionMode === 'touch') {
    const metrics = await evaluate(`(() => {
      const element = ${expression};
      if (!element || element.disabled) return null;
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    if (!metrics) return false;
    await call('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: metrics.x, y: metrics.y, id: 41, radiusX: 1, radiusY: 1, force: 1 }],
    });
    await sleep(90);
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return true;
  }

  return evaluate(`(() => {
    const element = ${expression};
    if (!element || element.disabled) return false;
    element.click();
    return true;
  })()`);
}

async function captureScreenshot() {
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (!shot?.data) throw new Error('Chapter 3 screenshot payload was empty.');
  await writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
}

const commonEvidence = [
  'baseline-offset',
  'return-vector',
  'blind-meridian',
  'kepler-wake',
  'service-ledger',
  'residual-frame',
  'null-transit',
  'counterfactual-burn',
  'false-horizon',
];
const branchEvidence = {
  'expose-route': ['common-reference', 'witness-transit', 'released-vector'],
  'hold-route': ['dark-baseline', 'ghost-transit', 'private-vector'],
};
const xpForLevel = { 15: 7140, 16: 8100, 17: 9120, 18: 10200 };

async function seedCheckpoint({ level, step, status = 'active', choiceA = null, evidence = commonEvidence.slice(0, Math.min(step, 9)), label }) {
  const saved = await evaluate(`(() => {
    const stateKey = 'ironshade-vector-state-v1';
    const state = JSON.parse(localStorage.getItem(stateKey) || 'null');
    const profile = state?.profile;
    const campaign = state?.campaign;
    if (state?.version !== 1 || !profile || !Array.isArray(profile.inventory) || !campaign?.story?.parallaxDebt || !campaign?.story?.interdiction) return false;
    Object.assign(profile, {
      xp: ${xpForLevel[level]},
      level: ${level},
      operatorClass: 'vanguard',
      classSelectionComplete: true,
      specialization: ${level} >= 15 ? 'breach-vanguard' : null,
      specializationOverclock: ${level} >= 16,
    });
    campaign.story.interdiction.status = 'complete';
    campaign.story.parallaxDebt = {
      ...campaign.story.parallaxDebt,
      status: ${JSON.stringify(status)},
      step: ${step},
      choiceA: ${JSON.stringify(choiceA)},
      completed: Array.from({ length: ${step} }, (_, index) => 'chapter3-browser-' + index),
      evidence: ${JSON.stringify(evidence)},
      lastBeat: 'BROWSER QA CHECKPOINT // ${label}',
    };
    localStorage.setItem(stateKey, JSON.stringify({ ...state, profile, campaign, savedAt: new Date().toISOString() }));
    return true;
  })()`);
  if (!saved) throw new Error(`Could not seed Chapter 3 browser checkpoint ${label}`);

  await call('Page.reload', { ignoreCache: true });
  await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, `${label} reload`);
  await waitFor(`[...document.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === 'Intel')`, `${label} Command Deck`);
  const opened = await activateElement(
    `[...document.querySelectorAll('button')].find(candidate => candidate.getAttribute('aria-label') === 'Intel')`,
    `Intel for ${label}`,
  );
  if (!opened) throw new Error(`Could not open Intel for ${label}`);
  await waitFor(`!!document.querySelector('.parallax-intel') && (document.body?.innerText ?? '').includes('Parallax Debt')`, `${label} Parallax Intel`);
}

async function assertCheckpoint(label, snippets) {
  const result = await evaluate(`(() => {
    const panel = document.querySelector('.parallax-intel');
    const workspace = document.querySelector('.tactical-workspace');
    if (!panel || !workspace) return null;
    const text = panel.textContent || '';
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const panelRect = panel.getBoundingClientRect();
    const docOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const workspaceOverflow = Math.max(0, workspace.scrollWidth - workspace.clientWidth);
    return {
      text,
      viewportWidth,
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      docOverflow,
      workspaceOverflow,
    };
  })()`);
  if (!result) throw new Error(`Chapter 3 panel missing at ${label}`);
  const missing = snippets.filter(snippet => !result.text.toLowerCase().includes(snippet.toLowerCase()));
  if (missing.length) throw new Error(`Chapter 3 checkpoint ${label} missing text: ${missing.join(' | ')}`);
  if (result.docOverflow > 2 || result.workspaceOverflow > 2 || result.panelLeft < -2 || result.panelRight > result.viewportWidth + 2) {
    throw new Error(`Chapter 3 checkpoint ${label} overflows viewport: ${JSON.stringify(result)}`);
  }
  return { label, snippets, viewportWidth: Math.round(result.viewportWidth), docOverflow: result.docOverflow, workspaceOverflow: result.workspaceOverflow };
}

await call('Runtime.enable');
await call('Page.enable');

const results = [];
try {
  await seedCheckpoint({ level: 15, step: 0, label: 'lv15-start' });
  results.push(await assertCheckpoint('lv15-start', ['0 / 12 CONTRACTS', 'LV15 // FALSE BASELINE', 'Baseline Zero', 'Open contract 1']));

  const openedContract = await activateElement(
    `[...document.querySelectorAll('.parallax-intel button')].find(candidate => (candidate.textContent || '').trim() === 'Open contract 1')`,
    'Open contract 1',
  );
  if (!openedContract) throw new Error('Chapter 3 browser QA could not open the first campaign contract.');
  await waitFor(`(document.body?.innerText ?? '').includes('PARALLAX DEBT // CONTRACT 1/12') && (document.body?.innerText ?? '').includes('Baseline Zero')`, 'first Chapter 3 Contract Board integration');

  await seedCheckpoint({ level: 15, step: 3, label: 'lv16-gate' });
  results.push(await assertCheckpoint('lv16-gate', ['3 / 12 CONTRACTS', 'NEXT GATE', 'LV16', 'NEXT PHASE LOCK // reach LV16']));

  await seedCheckpoint({ level: 16, step: 6, label: 'lv17-gate' });
  results.push(await assertCheckpoint('lv17-gate', ['6 / 12 CONTRACTS', 'NEXT GATE', 'LV17', 'NEXT PHASE LOCK // reach LV17']));

  await seedCheckpoint({ level: 17, step: 8, label: 'lv18-gate' });
  results.push(await assertCheckpoint('lv18-gate', ['8 / 12 CONTRACTS', 'NEXT GATE', 'LV18', 'NEXT PHASE LOCK // reach LV18']));

  await seedCheckpoint({ level: 18, step: 9, label: 'route-decision' });
  results.push(await assertCheckpoint('route-decision', ['9 / 12 CONTRACTS', 'ROUTE DECISION', 'Expose the route', 'Keep the route dark', 'Open Reference', 'Quiet Custody']));
  await captureScreenshot();

  const choseExpose = await activateElement(
    `[...document.querySelectorAll('.parallax-route-choice button')].find(candidate => (candidate.textContent || '').includes('Expose the route'))`,
    'Expose the route',
  );
  if (!choseExpose) throw new Error('Could not select the exposed route from the Chapter 3 decision UI.');
  await waitFor(`(document.body?.innerText ?? '').includes('OPEN REFERENCE') && (document.body?.innerText ?? '').includes('Open contract 10')`, 'exposed route activation');
  results.push(await assertCheckpoint('exposed-route-live', ['OPEN REFERENCE', 'Common Reference', 'Open contract 10']));

  await seedCheckpoint({
    level: 18,
    step: 12,
    status: 'complete',
    choiceA: 'expose-route',
    evidence: [...commonEvidence, ...branchEvidence['expose-route']],
    label: 'exposed-complete',
  });
  results.push(await assertCheckpoint('exposed-complete', ['12 / 12 CONTRACTS', 'CAMPAIGN CLOSED', 'OPEN REFERENCE', 'route is independently reproducible']));

  await seedCheckpoint({
    level: 18,
    step: 12,
    status: 'complete',
    choiceA: 'hold-route',
    evidence: [...commonEvidence, ...branchEvidence['hold-route']],
    label: 'held-complete',
  });
  results.push(await assertCheckpoint('held-complete', ['12 / 12 CONTRACTS', 'CAMPAIGN CLOSED', 'QUIET CUSTODY', 'retains covert access']));

  if (exceptions.length) throw new Error(`Chapter 3 browser QA observed page exceptions: ${JSON.stringify(exceptions)}`);
  await writeFile(reportPath, JSON.stringify({ viewport, runtime, interactionMode, result: 'PASS', checkpoints: results }, null, 2));
  const passLabel = interactionMode === 'touch' ? 'ANDROID_CHAPTER3_PLAYTHROUGH_PASS' : 'BROWSER_CHAPTER3_PLAYTHROUGH_PASS';
  console.log(`${passLabel} viewport=${viewport} runtime=${runtime} interaction=${interactionMode} checkpoints=${results.length} routeDecision=interactive branches=2`);
} catch (error) {
  await captureScreenshot().catch(() => undefined);
  await writeFile(reportPath, JSON.stringify({ viewport, runtime, interactionMode, result: 'FAIL', error: String(error), exceptions, checkpoints: results }, null, 2)).catch(() => undefined);
  throw error;
} finally {
  socket.close();
}
