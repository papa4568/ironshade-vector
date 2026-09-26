import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const appUrl = process.env.BROWSER_E2E_APP_URL ?? 'http://127.0.0.1:4173/';
const timeoutMs = Number(process.env.BROWSER_E2E_TIMEOUT_MS ?? 75_000);
const startedAt = Date.now();
const viewportMode = process.env.BROWSER_E2E_VIEWPORT ?? 'desktop';
const targetLocation = process.env.BROWSER_E2E_LOCATION ?? 'asteroid-refinery';
const screenshotPath = process.env.BROWSER_E2E_SCREENSHOT ?? 'browser-e2e-smoke.png';
const commandScreenshotPath = process.env.BROWSER_E2E_COMMAND_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-command.png');
const classScreenshotPath = process.env.BROWSER_E2E_CLASS_SCREENSHOT ?? commandScreenshotPath.replace(/command/i, 'class');
const accessibilityScreenshotPath = process.env.BROWSER_E2E_ACCESSIBILITY_SCREENSHOT ?? commandScreenshotPath.replace(/command/i, 'accessibility');
const performanceReportPath = process.env.BROWSER_E2E_PERFORMANCE_REPORT ?? screenshotPath.replace(/\.png$/i, '.performance.json');
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
    buttons: [...document.querySelectorAll('button')].map(button => button.getAttribute('aria-label') || button.textContent?.trim() || '').slice(0, 60),
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

async function captureScreenshot(path = screenshotPath) {
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

async function performanceDiagnosticsAudit() {
  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.performanceReport);
    return Number(canvas?.dataset.performanceSampleCount ?? 0) >= 12 && Boolean(canvas?.dataset.performanceBudgetVersion);
  })()`, 'P16-A performance baseline samples', 20_000);
  const result = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.performanceReport);
    if (!canvas?.dataset.performanceReport) return null;
    return {
      budgetVersion: canvas.dataset.performanceBudgetVersion ?? '',
      deviceTier: canvas.dataset.performanceDeviceTier ?? '',
      scenario: canvas.dataset.performanceScenario ?? '',
      sampleCount: Number(canvas.dataset.performanceSampleCount ?? 0),
      status: canvas.dataset.performanceStatus ?? '',
      regressions: canvas.dataset.performanceRegressions ?? '',
      report: JSON.parse(canvas.dataset.performanceReport),
    };
  })()`);
  if (!result?.report || result.budgetVersion !== 'p16-a-v1' || result.sampleCount < 12) {
    throw new Error(`P16-A performance diagnostics unavailable: ${JSON.stringify(result)}`);
  }
  const categoryKeys = Object.keys(result.report.categories ?? {}).sort().join(',');
  if (categoryKeys !== 'animation,audio,cpu,gc,gpu,render,ui') {
    throw new Error(`P16-A performance categories incomplete: ${JSON.stringify(result.report.categories ?? {})}`);
  }
  await writeFile(performanceReportPath, JSON.stringify({
    viewport: viewportMode,
    location: targetLocation,
    capturedAt: new Date().toISOString(),
    ...result,
  }, null, 2));
  console.log(`BROWSER_PERFORMANCE_BASELINE_PASS viewport=${viewportMode} location=${targetLocation} tier=${result.deviceTier} samples=${result.sampleCount} status=${result.status} regressions=${result.regressions} report=${performanceReportPath}`);
  return result;
}

async function classSelectionViewportAudit() {
  const result = await evaluate(`(() => {
    const root = document.querySelector('.class-intake');
    const shell = document.querySelector('.class-intake-shell');
    const confirm = document.querySelector('.class-confirm');
    const cards = [...document.querySelectorAll('.class-choice-card')];
    const detail = document.querySelector('.class-selected-panel');
    if (!root || !shell || !confirm || cards.length !== 3 || !detail) return null;
    const viewport = {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    };
    const rect = element => {
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const confirmRect = rect(confirm);
    const shellRect = rect(shell);
    const detailRect = rect(detail);
    const cardRects = cards.map(rect);
    const horizontalOverflow = Math.max(0, root.scrollWidth - root.clientWidth);
    const mobileLandscape = viewport.width > viewport.height && viewport.height <= 650;
    return {
      viewport,
      horizontalOverflow,
      scrollTop: root.scrollTop,
      shell: shellRect,
      detail: detailRect,
      confirm: confirmRect,
      cards: cardRects,
      confirmOnscreen: confirmRect.left >= -1 && confirmRect.right <= viewport.width + 1 && confirmRect.top >= -1 && confirmRect.bottom <= viewport.height + 1,
      detailOnscreen: detailRect.left >= -1 && detailRect.right <= viewport.width + 1,
      mobileLandscape,
    };
  })()`);
  if (!result) throw new Error('Class-selection viewport audit could not find the intake surfaces.');
  if (result.horizontalOverflow > 2 || result.scrollTop !== 0 || !result.detailOnscreen) {
    throw new Error(`Class selection has horizontal overflow or an offscreen detail panel: ${JSON.stringify(result)}`);
  }
  if (result.mobileLandscape && !result.confirmOnscreen) {
    throw new Error(`Class selection confirm action is not visible in short landscape: ${JSON.stringify(result)}`);
  }
  console.log(`BROWSER_CLASS_SELECTION_LAYOUT_PASS viewport=${Math.round(result.viewport.width)}x${Math.round(result.viewport.height)} horizontalOverflow=${result.horizontalOverflow}px confirm=${result.confirmOnscreen ? 'onscreen' : 'scroll'}`);
  return result;
}

async function commandHubViewportAudit() {
  const result = await evaluate(`(() => {
    const workspace = document.querySelector('.tactical-workspace');
    const overview = document.querySelector('.command-overview');
    if (!workspace || !overview) return null;
    const workspaceRect = workspace.getBoundingClientRect();
    const overviewRect = overview.getBoundingClientRect();
    return {
      clientHeight: workspace.clientHeight,
      scrollHeight: workspace.scrollHeight,
      scrollTop: workspace.scrollTop,
      workspaceBottom: workspaceRect.bottom,
      overviewBottom: overviewRect.bottom,
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
    };
  })()`);
  if (!result) throw new Error('Command hub viewport audit could not find the workspace or overview.');
  const overflow = result.scrollHeight - result.clientHeight;
  if (overflow > 2 || result.overviewBottom > result.workspaceBottom + 2 || result.scrollTop !== 0) {
    throw new Error(`Command hub requires vertical scrolling: ${JSON.stringify(result)}`);
  }
  console.log(`BROWSER_COMMAND_FIT_PASS viewportHeight=${Math.round(result.viewportHeight)} workspace=${result.clientHeight}px overflow=${Math.max(0, overflow)}px`);
  return result;
}

async function commandNavigationLayoutAudit() {
  const compact = viewportMode === 'mobile-landscape';
  const audit = async syntheticSafeArea => evaluate(`(() => {
    const viewport = {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    };
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    const bounds = element => {
      if (!visible(element)) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const intersects = (left, right) => !!left && !!right
      && !(left.right <= right.left + 1 || right.right <= left.left + 1 || left.bottom <= right.top + 1 || right.bottom <= left.top + 1);
    const hub = document.querySelector('.ship-hub');
    const railElement = document.querySelector('.command-rail');
    const previousSafeLeft = hub?.style.getPropertyValue('--command-safe-left') ?? '';
    const previousSafeRight = hub?.style.getPropertyValue('--command-safe-right') ?? '';
    const previousSafeBottom = hub?.style.getPropertyValue('--command-safe-bottom') ?? '';
    if (${syntheticSafeArea ? 'true' : 'false'}) {
      hub?.style.setProperty('--command-safe-left', '48px');
      hub?.style.setProperty('--command-safe-right', '36px');
      hub?.style.setProperty('--command-safe-bottom', '18px');
    }

    const rail = bounds(railElement);
    const workspace = bounds(document.querySelector('.tactical-workspace'));
    const primaryButtons = [...document.querySelectorAll('.command-rail-nav button[data-primary-area]')].filter(visible).map(button => ({
      label: button.getAttribute('aria-label') || button.textContent?.trim() || '',
      labelFontSize: Number.parseFloat(getComputedStyle(button.querySelector('b') ?? button).fontSize),
      rect: bounds(button),
    }));
    const contentSurfaces = [
      ['header', bounds(document.querySelector('.tactical-header'))],
      ['resources', bounds(document.querySelector('.hub-resource-ribbon'))],
      ['priority', bounds(document.querySelector('.qol-priority-strip'))],
      ['status', bounds(document.querySelector('.ship-status'))],
      ['overview', bounds(document.querySelector('.command-overview'))],
    ].filter(([, rect]) => rect);
    const offscreen = primaryButtons.filter(item => item.rect && (
      item.rect.left < -1 || item.rect.top < -1 || item.rect.right > viewport.width + 1 || item.rect.bottom > viewport.height + 1
    )).map(item => item.label);
    const undersized = primaryButtons.filter(item => item.rect && item.rect.height < 48).map(item => item.label);
    const navOverflow = primaryButtons.filter(item => item.rect && rail && (
      item.rect.left < rail.left - 1 || item.rect.top < rail.top - 1 || item.rect.right > rail.right + 1 || item.rect.bottom > rail.bottom + 1
    )).map(item => item.label);
    const overlap = intersects(rail, workspace);
    const contentOverlap = rail ? contentSurfaces.filter(([, rect]) => intersects(rail, rect)).map(([label]) => label) : [];
    const composition = rail && workspace && rail.top >= workspace.bottom - 2 ? 'dock' : 'rail';
    const minTargetHeight = primaryButtons.length ? Math.min(...primaryButtons.map(item => item.rect?.height ?? 0)) : 0;
    const minLabelFontSize = primaryButtons.length ? Math.min(...primaryButtons.map(item => item.labelFontSize)) : 0;
    const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - viewport.width);

    if (hub) {
      if (previousSafeLeft) hub.style.setProperty('--command-safe-left', previousSafeLeft); else hub.style.removeProperty('--command-safe-left');
      if (previousSafeRight) hub.style.setProperty('--command-safe-right', previousSafeRight); else hub.style.removeProperty('--command-safe-right');
      if (previousSafeBottom) hub.style.setProperty('--command-safe-bottom', previousSafeBottom); else hub.style.removeProperty('--command-safe-bottom');
    }

    return {
      viewport,
      rail,
      workspace,
      composition,
      primaryCount: primaryButtons.length,
      offscreen,
      undersized,
      navOverflow,
      overlap,
      contentOverlap,
      minTargetHeight,
      minLabelFontSize,
      horizontalOverflow,
      syntheticSafeArea: ${syntheticSafeArea ? 'true' : 'false'},
    };
  })()`);

  const result = await audit(false);
  const safeAreaResult = compact ? await audit(true) : result;
  const invalidBase = value => !value.rail
    || !value.workspace
    || value.primaryCount !== 5
    || value.offscreen.length
    || value.navOverflow.length
    || value.overlap
    || value.contentOverlap.length
    || value.horizontalOverflow > 2;
  if (invalidBase(result)) throw new Error(`P19-B Command navigation layout failed: ${JSON.stringify(result)}`);
  if (compact) {
    if (result.composition !== 'dock' || result.undersized.length || result.minTargetHeight < 48 || result.minLabelFontSize < 11.5) {
      throw new Error(`P19-B compact Command dock failed glance/touch checks: ${JSON.stringify(result)}`);
    }
    if (invalidBase(safeAreaResult) || safeAreaResult.composition !== 'dock' || safeAreaResult.undersized.length) {
      throw new Error(`P19-B compact Command dock safe-area simulation failed: ${JSON.stringify(safeAreaResult)}`);
    }
  } else if (result.composition !== 'rail') {
    throw new Error(`P19-B wide layout must retain the Command rail: ${JSON.stringify(result)}`);
  }
  console.log(`BROWSER_P19_COMMAND_NAV_PASS viewport=${viewportMode} composition=${result.composition} destinations=${result.primaryCount} target=${Math.round(result.minTargetHeight)}px label=${result.minLabelFontSize.toFixed(1)}px safe=${compact ? 'simulated' : 'wide'}`);
  return result;
}

async function primaryNavigationInputAudit() {
  const dispatchKey = async (key, code, virtualKeyCode) => {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
  };

  await evaluate(`document.querySelector('.command-rail-nav button[data-primary-area="command"]')?.focus()`);
  await dispatchKey('ArrowRight', 'ArrowRight', 39);
  await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Operations'`, 'P19-B keyboard focus movement');
  await keyboardActivateButton('Operations');
  await waitFor(`document.querySelector('.ship-hub.area-operations') !== null`, 'P19-B keyboard area activation');
  await dispatchKey('Escape', 'Escape', 27);
  await waitFor(`document.querySelector('.ship-hub.area-command') !== null && document.activeElement?.getAttribute('aria-label') === 'Command'`, 'P19-B keyboard back to Command');

  await evaluate(`(() => {
    globalThis.__p19OriginalGetGamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads.bind(navigator) : null;
    globalThis.__p19CommandGamepad = {
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [globalThis.__p19CommandGamepad],
    });
    document.querySelector('.command-rail-nav button[data-primary-area="command"]')?.focus();
    return true;
  })()`);

  const pressGamepad = async index => {
    await evaluate(`(() => { const button = globalThis.__p19CommandGamepad?.buttons?.[${index}]; if (button) { button.pressed = true; button.value = 1; } })()`);
    await sleep(160);
    await evaluate(`(() => { const button = globalThis.__p19CommandGamepad?.buttons?.[${index}]; if (button) { button.pressed = false; button.value = 0; } })()`);
    await sleep(80);
  };

  try {
    await sleep(120);
    await pressGamepad(15);
    await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Operations'`, 'P19-B controller focus movement');
    await pressGamepad(0);
    await waitFor(`document.querySelector('.ship-hub.area-operations') !== null`, 'P19-B controller activation');
    await pressGamepad(1);
    await waitFor(`document.querySelector('.ship-hub.area-command') !== null && document.activeElement?.getAttribute('aria-label') === 'Command'`, 'P19-B controller back to Command');
  } finally {
    await evaluate(`(() => {
      const original = globalThis.__p19OriginalGetGamepads;
      if (original) Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: original });
      else delete navigator.getGamepads;
      delete globalThis.__p19OriginalGetGamepads;
      delete globalThis.__p19CommandGamepad;
      return true;
    })()`).catch(() => undefined);
  }
  console.log('BROWSER_P19_COMMAND_INPUT_PASS keyboard=arrows+space+escape controller=dpad+a+b routing=shared');
}

async function mobileCombatLayoutAudit() {
  const result = await evaluate(`(() => {
    const viewport = {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    };
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    const rect = element => {
      if (!visible(element)) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const withinViewport = value => !value || (
      value.left >= -1 && value.top >= -1
      && value.right <= viewport.width + 1
      && value.bottom <= viewport.height + 1
    );
    const intersects = (a, b) => !!a && !!b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

    const canvas = rect(document.querySelector('canvas'));
    const move = rect(document.querySelector('.move-stick'));
    const dock = rect(document.querySelector('.combat-dock'));
    const fire = rect(document.querySelector('.fire-button'));
    const dodge = rect(document.querySelector('.dodge-button'));
    const tutorial = rect(document.querySelector('.tutorial-coach'));
    const topHud = rect(document.querySelector('.hud-top'));
    const visibleTouchButtons = [...document.querySelectorAll('.touch-button')].filter(visible).map(button => ({
      label: button.getAttribute('aria-label') || button.textContent?.trim().slice(0, 40) || button.className,
      rect: rect(button),
    }));
    const undersized = visibleTouchButtons.filter(item => item.rect && (item.rect.width < 40 || item.rect.height < 40));
    const offscreen = [
      ['canvas', canvas], ['move', move], ['dock', dock], ['fire', fire], ['dodge', dodge], ['tutorial', tutorial], ['hud', topHud],
      ...visibleTouchButtons.map(item => [item.label, item.rect]),
    ].filter(([, value]) => !withinViewport(value)).map(([label]) => label);

    return {
      viewport,
      canvas,
      move,
      dock,
      fire,
      dodge,
      tutorial,
      topHud,
      touchUi: Boolean(document.querySelector('[aria-label="Touch combat controls"]')),
      touchButtons: visibleTouchButtons.length,
      undersized: undersized.map(item => item.label),
      offscreen,
      moveDockOverlap: intersects(move, dock),
      landscape: viewport.width > viewport.height,
    };
  })()`);

  if (!result.landscape || result.viewport.width > 900 || !result.touchUi) {
    throw new Error(`Mobile landscape emulation did not activate coarse combat controls: ${JSON.stringify(result)}`);
  }
  if (!result.canvas || result.canvas.width < result.viewport.width * 0.95 || result.canvas.height < result.viewport.height * 0.9) {
    throw new Error(`Combat canvas does not cover the mobile viewport: ${JSON.stringify(result)}`);
  }
  if (result.offscreen.length || result.undersized.length || result.moveDockOverlap) {
    throw new Error(`Mobile combat controls/HUD failed viewport or touch-target checks: ${JSON.stringify(result)}`);
  }

  const interfaceInvariant = await evaluate(`(() => {
    const root = document.documentElement;
    const previous = root.dataset.interfaceSize ?? '';
    const rect = element => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return [value.left, value.top, value.width, value.height].map(number => Number(number.toFixed(3)));
    };
    const controlSnapshot = () => ({
      move: rect(document.querySelector('.move-stick')),
      dock: rect(document.querySelector('.combat-dock')),
      controls: [...document.querySelectorAll('.touch-button')].map((button, index) => ({
        key: button.getAttribute('aria-label') || button.className || String(index),
        rect: rect(button),
      })),
    });
    const hudSnapshot = () => {
      const vitals = document.querySelector('.vitals');
      const mission = document.querySelector('.mission-card');
      const vitalsStyle = vitals ? getComputedStyle(vitals) : null;
      const missionStyle = mission ? getComputedStyle(mission) : null;
      return {
        vitalsPadding: Number.parseFloat(vitalsStyle?.paddingLeft ?? '0'),
        missionPadding: Number.parseFloat(missionStyle?.paddingLeft ?? '0'),
      };
    };
    root.dataset.interfaceSize = 'compact';
    const compact = controlSnapshot();
    const compactHud = hudSnapshot();
    root.dataset.interfaceSize = 'default';
    const baselineHud = hudSnapshot();
    root.dataset.interfaceSize = 'large';
    const large = controlSnapshot();
    const largeHud = hudSnapshot();
    if (previous) root.dataset.interfaceSize = previous;
    else delete root.dataset.interfaceSize;
    return { compact, large, hud: { compact: compactHud, baseline: baselineHud, large: largeHud }, restored: root.dataset.interfaceSize ?? '' };
  })()`);
  if (JSON.stringify(interfaceInvariant.compact) !== JSON.stringify(interfaceInvariant.large)) {
    throw new Error(`P20-A changed combat-control geometry across Interface Size values: ${JSON.stringify(interfaceInvariant)}`);
  }
  if (!(interfaceInvariant.hud.compact.vitalsPadding < interfaceInvariant.hud.baseline.vitalsPadding
    && interfaceInvariant.hud.baseline.vitalsPadding < interfaceInvariant.hud.large.vitalsPadding)
    || !(interfaceInvariant.hud.compact.missionPadding < interfaceInvariant.hud.baseline.missionPadding
      && interfaceInvariant.hud.baseline.missionPadding < interfaceInvariant.hud.large.missionPadding)) {
    throw new Error(`P20-A informational HUD chrome did not scale while controls stayed fixed: ${JSON.stringify(interfaceInvariant)}`);
  }
  console.log(`BROWSER_P20_HUD_SCALE_PASS viewport=${viewportMode} vitalsPadding=${interfaceInvariant.hud.compact.vitalsPadding}/${interfaceInvariant.hud.baseline.vitalsPadding}/${interfaceInvariant.hud.large.vitalsPadding} missionPadding=${interfaceInvariant.hud.compact.missionPadding}/${interfaceInvariant.hud.baseline.missionPadding}/${interfaceInvariant.hud.large.missionPadding}`);
  console.log(`BROWSER_P20_COMBAT_CONTROL_INVARIANT_PASS viewport=${viewportMode} controls=${interfaceInvariant.compact.controls.length} compact=large geometry=identical`);
  console.log(`BROWSER_MOBILE_LAYOUT_PASS viewport=${Math.round(result.viewport.width)}x${Math.round(result.viewport.height)} touchButtons=${result.touchButtons} safe=onscreen+separated`);
  return result;
}

async function targetFeedbackAudit(includeTouch) {
  if (includeTouch) {
    const touchStarted = await evaluate(`(() => {
      const button = document.querySelector('.fire-button');
      if (!button || button.disabled) return false;
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 71, pointerType: 'touch', isPrimary: true, buttons: 1 }));
      return true;
    })()`);
    if (!touchStarted) throw new Error('P8-C touch target audit could not press FIRE.');
    await waitFor(`(() => {
      const canvas = document.querySelector('canvas');
      const readout = document.querySelector('.target-readout[data-target-id]');
      return Boolean(canvas?.dataset.assistedTargetId)
        && readout?.dataset.targetId === canvas.dataset.assistedTargetId
        && (document.querySelector('#target-lock-status')?.textContent ?? '').toLowerCase().includes('locked');
    })()`, 'touch assisted target lock', 8_000);
    await evaluate(`(() => {
      const button = document.querySelector('.fire-button');
      button?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 71, pointerType: 'touch', isPrimary: true }));
    })()`);
    await waitFor(`(() => {
      const canvas = document.querySelector('canvas');
      return canvas?.dataset.assistedTargetId === '' && !document.querySelector('.target-readout[data-target-id]');
    })()`, 'touch target release', 5_000);
  }

  const installed = await evaluate(`(() => {
    if (!window.__p8cOriginalGetGamepads) window.__p8cOriginalGetGamepads = navigator.getGamepads?.bind(navigator);
    window.__p8cTargetRumbleCount = 0;
    window.__p8cQaGamepad = {
      connected: true,
      index: 0,
      id: 'P8-C QA Gamepad',
      mapping: 'standard',
      timestamp: performance.now(),
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 8 }, () => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: {
        playEffect: () => {
          window.__p8cTargetRumbleCount += 1;
          return Promise.resolve('complete');
        },
      },
    };
    try {
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () => [window.__p8cQaGamepad],
      });
      return true;
    } catch {
      return false;
    }
  })()`);
  if (!installed) throw new Error('P8-C controller target audit could not install the gamepad shim.');

  try {
    await waitFor(`document.querySelector('canvas')?.dataset.controllerInput === 'connected'`, 'controller polling', 5_000);
    await evaluate(`(() => {
      const button = window.__p8cQaGamepad.buttons[7];
      button.pressed = true;
      button.touched = true;
      button.value = 1;
      window.__p8cQaGamepad.timestamp = performance.now();
    })()`);
    await waitFor(`(() => {
      const canvas = document.querySelector('canvas');
      const readout = document.querySelector('.target-readout[data-target-id]');
      const targetId = canvas?.dataset.assistedTargetId ?? '';
      if (!targetId || readout?.dataset.targetId !== targetId) return false;
      window.__p8cControllerLockEvidence = {
        targetId,
        rumbleCount: window.__p8cTargetRumbleCount ?? 0,
        liveText: document.querySelector('#target-lock-status')?.textContent ?? '',
      };
      return true;
    })()`, 'controller RT assisted target lock', 8_000);

    const controllerLock = await evaluate(`window.__p8cControllerLockEvidence ?? ({
      targetId: document.querySelector('canvas')?.dataset.assistedTargetId ?? '',
      rumbleCount: window.__p8cTargetRumbleCount ?? 0,
      liveText: document.querySelector('#target-lock-status')?.textContent ?? '',
    })`);
    if (!controllerLock.targetId || controllerLock.rumbleCount < 1 || !controllerLock.liveText.toLowerCase().includes('locked')) {
      throw new Error(`Controller target acquisition feedback failed: ${JSON.stringify(controllerLock)}`);
    }

    await evaluate(`(() => {
      window.__p8cQaGamepad.axes[2] = 0.8;
      window.__p8cQaGamepad.timestamp = performance.now();
    })()`);
    await waitFor(`(() => {
      const canvas = document.querySelector('canvas');
      return canvas?.dataset.assistedTargetId === '' && !document.querySelector('.target-readout[data-target-id]');
    })()`, 'controller manual-aim target release', 5_000);

    const manualOverride = await evaluate(`document.querySelector('#target-lock-status')?.textContent ?? ''`);
    if (!manualOverride.toLowerCase().includes('manual controller aim')) {
      throw new Error(`Controller manual override was not announced: ${JSON.stringify(manualOverride)}`);
    }

    await evaluate(`(() => {
      window.__p8cQaGamepad.axes[2] = 0;
      const button = window.__p8cQaGamepad.buttons[7];
      button.pressed = false;
      button.touched = false;
      button.value = 0;
      window.__p8cQaGamepad.timestamp = performance.now();
    })()`);
    console.log(`BROWSER_TARGET_FEEDBACK_PASS touch=${includeTouch ? 'verified' : 'not-applicable'} controller=rt-assist+manual-override rumble=${controllerLock.rumbleCount}`);
  } finally {
    await evaluate(`(() => {
      try {
        if (window.__p8cOriginalGetGamepads) {
          Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: window.__p8cOriginalGetGamepads });
        } else {
          delete navigator.getGamepads;
        }
      } catch {}
      delete window.__p8cQaGamepad;
    })()`).catch(() => undefined);
  }
}

async function keyboardActivateButton(label) {
  await call('Page.bringToFront');
  const focused = await evaluate(`(() => {
    const target = ${JSON.stringify(label.toLowerCase())};
    const button = [...document.querySelectorAll('button')].find(candidate => (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLowerCase() === target);
    if (!button || button.disabled) return false;
    button.focus();
    return document.activeElement === button;
  })()`);
  if (!focused) throw new Error(`Could not keyboard-focus ${label} button.`);

  await call('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: ' ',
    code: 'Space',
    text: ' ',
    unmodifiedText: ' ',
    windowsVirtualKeyCode: 32,
    nativeVirtualKeyCode: 32,
  });
  await call('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: ' ',
    code: 'Space',
    windowsVirtualKeyCode: 32,
    nativeVirtualKeyCode: 32,
  });
}


async function armoryInspectorViewportAudit() {
  const prepared = await evaluate(`(() => {
    const build = document.querySelector('.build-bay');
    const layout = document.querySelector('.gear-layout');
    const storage = document.querySelector('.gear-storage');
    const grid = document.querySelector('.inventory-grid');
    const cards = [...document.querySelectorAll('.inventory-card')].filter(card => {
      const rect = card.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const card = cards[0];
    if (!(build instanceof HTMLElement) || !layout || !storage || !grid || !(card instanceof HTMLButtonElement)) return null;

    card.dataset.p19ArmoryViewportCandidate = 'true';
    card.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });

    const cardRect = card.getBoundingClientRect();
    const storageRect = storage.getBoundingClientRect();
    const layoutRect = layout.getBoundingClientRect();
    const gridColumns = getComputedStyle(grid).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length;
    return {
      item: card.querySelector('b')?.textContent?.trim() ?? '',
      scrollTop: build.scrollTop,
      maxScroll: Math.max(0, build.scrollHeight - build.clientHeight),
      cardTop: cardRect.top,
      cardBottom: cardRect.bottom,
      storageWidth: storageRect.width,
      layoutWidth: layoutRect.width,
      gridColumns,
    };
  })()`);

  if (!prepared || !prepared.item || prepared.gridColumns < 1) {
    throw new Error(`P19-I could not establish a Ship Storage item context: ${JSON.stringify(prepared)}`);
  }

  const openedCandidate = await evaluate(`(() => {
    const card = document.querySelector('button[data-p19-armory-viewport-candidate="true"]');
    if (!(card instanceof HTMLButtonElement)) return false;
    card.click();
    return true;
  })()`);
  if (!openedCandidate) throw new Error('P19-I Ship Storage candidate could not be selected.');

  await waitFor(`Boolean(
    document.querySelector('.armory-item-modal')
    && document.querySelector('.armory-item-modal .item-inspector.open[role="dialog"][aria-modal="true"]')
    && document.querySelector('.armory-item-modal .item-inspector .inspector-header')
    && document.querySelector('.armory-item-modal .item-inspector .gear-quick-read')
    && document.querySelector('.armory-item-modal .item-inspector .inspector-actions')
  )`, 'P19-I dedicated Armory item modal');

  const opened = await evaluate(`(() => {
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;
    const build = document.querySelector('.build-bay');
    const layout = document.querySelector('.gear-layout');
    const storage = document.querySelector('.gear-storage');
    const grid = document.querySelector('.inventory-grid');
    const card = document.querySelector('button[data-p19-armory-viewport-candidate="true"]');
    const modal = document.querySelector('.armory-item-modal');
    const backdrop = modal?.querySelector('.item-inspector-backdrop');
    const inspector = modal?.querySelector('.item-inspector.open');
    const header = inspector?.querySelector('.inspector-header');
    const quickRead = inspector?.querySelector('.gear-quick-read');
    const actions = inspector?.querySelector('.inspector-actions');
    if (!(build instanceof HTMLElement) || !layout || !storage || !grid || !card || !modal || !backdrop || !inspector || !header || !quickRead || !actions) return null;

    const rect = element => {
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const modalRect = rect(modal);
    const inspectorRect = rect(inspector);
    const headerRect = rect(header);
    const quickReadRect = rect(quickRead);
    const actionsRect = rect(actions);
    const storageRect = rect(storage);
    const layoutRect = rect(layout);
    const gridColumns = getComputedStyle(grid).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length;
    return {
      width,
      height,
      scrollTop: build.scrollTop,
      modalPosition: getComputedStyle(modal).position,
      inspectorPosition: getComputedStyle(inspector).position,
      modalCoversViewport: modalRect.left <= 1 && modalRect.top <= 1 && modalRect.right >= width - 1 && modalRect.bottom >= height - 1,
      detachedFromLayout: !inspector.closest('.gear-layout'),
      dialogSemantics: inspector.getAttribute('role') === 'dialog' && inspector.getAttribute('aria-modal') === 'true',
      backdropVisible: getComputedStyle(backdrop).display !== 'none',
      windowWithinViewport: inspectorRect.left >= -1 && inspectorRect.top >= -1 && inspectorRect.right <= width + 1 && inspectorRect.bottom <= height + 1,
      windowCentered: Math.abs((inspectorRect.left + inspectorRect.right) / 2 - width / 2) <= 3,
      headerOnscreen: headerRect.top >= -1 && headerRect.bottom <= height + 1,
      quickReadOnscreen: quickReadRect.top < inspectorRect.bottom && quickReadRect.bottom > inspectorRect.top,
      actionsOnscreen: actionsRect.top >= -1 && actionsRect.bottom <= height + 1,
      storageWidth: storageRect.width,
      layoutWidth: layoutRect.width,
      gridColumns,
      selectedCard: card.classList.contains('selected'),
    };
  })()`);

  if (!opened
    || opened.modalPosition !== 'fixed'
    || opened.inspectorPosition !== 'relative'
    || Math.abs(opened.scrollTop - prepared.scrollTop) > 2
    || Math.abs(opened.storageWidth - prepared.storageWidth) > 2
    || opened.gridColumns !== prepared.gridColumns
    || !opened.modalCoversViewport
    || !opened.detachedFromLayout
    || !opened.dialogSemantics
    || !opened.backdropVisible
    || !opened.windowWithinViewport
    || !opened.windowCentered
    || !opened.selectedCard
    || !opened.headerOnscreen
    || !opened.quickReadOnscreen
    || !opened.actionsOnscreen) {
    throw new Error(`P19-I item details did not open as a dedicated modal: before=${JSON.stringify(prepared)} open=${JSON.stringify(opened)}`);
  }

  const closedInspector = await evaluate(`(() => {
    const button = document.querySelector('.armory-item-modal .item-inspector .sheet-close[aria-label="Back to ship storage"]');
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  })()`);
  if (!closedInspector) throw new Error('P19-I Back to storage control could not close the item modal.');
  await waitFor(`!document.querySelector('.armory-item-modal') && !document.querySelector('.item-inspector.open')`, 'P19-I item modal dismissal');

  const closed = await evaluate(`(() => {
    const build = document.querySelector('.build-bay');
    const storage = document.querySelector('.gear-storage');
    const grid = document.querySelector('.inventory-grid');
    const card = document.querySelector('button[data-p19-armory-viewport-candidate="true"]');
    if (!(build instanceof HTMLElement) || !storage || !grid || !card) return null;
    const cardRect = card.getBoundingClientRect();
    return {
      scrollTop: build.scrollTop,
      storageWidth: storage.getBoundingClientRect().width,
      gridColumns: getComputedStyle(grid).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length,
      cardTop: cardRect.top,
      cardStillVisible: cardRect.bottom > 0 && cardRect.top < window.innerHeight,
    };
  })()`);

  if (!closed
    || Math.abs(closed.scrollTop - prepared.scrollTop) > 2
    || Math.abs(closed.storageWidth - prepared.storageWidth) > 2
    || closed.gridColumns !== prepared.gridColumns
    || Math.abs(closed.cardTop - prepared.cardTop) > 2
    || !closed.cardStillVisible) {
    throw new Error(`P19-I item modal dismissal did not preserve Ship Storage context: before=${JSON.stringify(prepared)} closed=${JSON.stringify(closed)}`);
  }

  console.log(`BROWSER_P19_ITEM_MODAL_PASS viewport=${viewportMode} item=${JSON.stringify(prepared.item)} grid=${prepared.gridColumns} dialog=modal popup=centered context=preserved`);
}

await call('Runtime.enable');
await call('Page.enable');
if (viewportMode === 'mobile-landscape') {
  await call('Emulation.setDeviceMetricsOverride', {
    width: 851,
    height: 360,
    deviceScaleFactor: 2.5,
    mobile: true,
    screenWidth: 851,
    screenHeight: 360,
    screenOrientation: { type: 'landscapePrimary', angle: 90 },
  });
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
} else {
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1280,
    screenHeight: 720,
  });
}

await call('Page.navigate', { url: appUrl });
await sleep(250);

try {
  await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Ironshade document');
  await waitFor(`(() => {
    const text = (document.body?.innerText ?? '').toLowerCase();
    const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
    return text.includes('save recovery lock')
      || text.includes('operator intake')
      || ((text.includes('command ready') || text.includes('command deck')) && labels.includes('operations'));
  })()`, 'interactive startup surface');

  const firstSurface = await snapshot();
  if ((firstSurface.text ?? '').toLowerCase().includes('operator intake')) {
    await accessibilityAudit('class-selection');
    await classSelectionViewportAudit();
    await captureScreenshot(classScreenshotPath);
    await keyboardActivateButton('Select Vanguard class');
    await keyboardActivateButton('Confirm Vanguard');
    await waitFor(`(() => {
      const text = (document.body?.innerText ?? '').toLowerCase();
      const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
      return (text.includes('command ready') || text.includes('command deck')) && labels.includes('operations');
    })()`, 'Command Deck after class selection');
    console.log(`BROWSER_CLASS_SELECTION_PASS viewport=${viewportMode} class=Vanguard`);
  }

  if (viewportMode === 'mobile-landscape') {
    const reducedEffectsSeed = await evaluate(`(() => {
      const stateKey = 'ironshade-vector-state-v1';
      const profileKey = 'ironshade-vector-profile-v3';
      const stateRaw = localStorage.getItem(stateKey);
      if (stateRaw) {
        const state = JSON.parse(stateRaw);
        if (!state?.profile) return { found: false, changed: false, source: 'state' };
        const changed = state.profile.settings?.effectIntensity !== 'reduced';
        state.profile.settings = { ...(state.profile.settings ?? {}), effectIntensity: 'reduced' };
        localStorage.setItem(stateKey, JSON.stringify(state));
        return { found: true, changed, source: 'state' };
      }
      const profileRaw = localStorage.getItem(profileKey);
      if (!profileRaw) return { found: false, changed: false, source: 'none' };
      const profile = JSON.parse(profileRaw);
      const changed = profile.settings?.effectIntensity !== 'reduced';
      profile.settings = { ...(profile.settings ?? {}), effectIntensity: 'reduced' };
      localStorage.setItem(profileKey, JSON.stringify(profile));
      return { found: true, changed, source: 'legacy-profile' };
    })()`);
    if (!reducedEffectsSeed?.found) throw new Error('Mobile Reduced Effects QA could not find the persisted profile.');
    if (reducedEffectsSeed.changed) {
      await call('Page.reload', { ignoreCache: true });
      await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Ironshade document after Reduced Effects seed');
      await waitFor(`(() => {
        const text = (document.body?.innerText ?? '').toLowerCase();
        const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
        return (text.includes('command ready') || text.includes('command deck')) && labels.includes('operations');
      })()`, 'Command Deck after Reduced Effects seed');
    }
    console.log(`BROWSER_REDUCED_EFFECTS_QA_PASS viewport=${viewportMode} source=${reducedEffectsSeed.source} changed=${reducedEffectsSeed.changed}`);
  }

  const startup = await snapshot();
  const startupText = startup.text ?? '';
  const startupButtons = startup.buttons ?? [];
  if (startupText.toLowerCase().includes('save recovery lock')) {
    throw new Error(`Browser startup entered save recovery lock: ${JSON.stringify(startup)}`);
  }
  if (startup.title !== 'Ironshade Vector' || !(startupText.toLowerCase().includes('command ready') || startupText.toLowerCase().includes('command deck')) || !startupButtons.some(label => label.toLowerCase() === 'operations')) {
    throw new Error(`Unexpected browser startup surface: ${JSON.stringify(startup)}`);
  }
  await accessibilityAudit('command-deck');
  await commandHubViewportAudit();
  await commandNavigationLayoutAudit();
  await primaryNavigationInputAudit();

  const p20CommandScale = await evaluate(`(() => {
    const root = document.documentElement;
    const previous = root.dataset.interfaceSize ?? '';
    const measure = size => {
      root.dataset.interfaceSize = size;
      const card = document.querySelector('.command-card.primary-card');
      const style = card ? getComputedStyle(card) : null;
      const rect = card?.getBoundingClientRect();
      return {
        size,
        paddingLeft: Number.parseFloat(style?.paddingLeft ?? '0'),
        height: Number((rect?.height ?? 0).toFixed(3)),
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      };
    };
    const compact = measure('compact');
    const baseline = measure('default');
    const large = measure('large');
    if (previous) root.dataset.interfaceSize = previous;
    else delete root.dataset.interfaceSize;
    return { compact, baseline, large };
  })()`);
  if (!(p20CommandScale.compact.paddingLeft < p20CommandScale.baseline.paddingLeft
    && p20CommandScale.baseline.paddingLeft < p20CommandScale.large.paddingLeft)
    || p20CommandScale.compact.horizontalOverflow > 2
    || p20CommandScale.baseline.horizontalOverflow > 2
    || p20CommandScale.large.horizontalOverflow > 2) {
    throw new Error(`P20-A Command surface did not visibly reflow across Interface Size: ${JSON.stringify(p20CommandScale)}`);
  }
  console.log(`BROWSER_P20_COMMAND_SCALE_PASS viewport=${viewportMode} padding=${p20CommandScale.compact.paddingLeft}/${p20CommandScale.baseline.paddingLeft}/${p20CommandScale.large.paddingLeft} overflow=none`);
  await captureScreenshot(commandScreenshotPath);

  const equipmentShortcutVisible = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(candidate => (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLowerCase() === 'equipment');
    if (!button) return false;
    const style = getComputedStyle(button);
    const rect = button.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  })()`);
  if (equipmentShortcutVisible) {
    await keyboardActivateButton('Equipment');
  } else {
    await keyboardActivateButton('Operator');
    await waitFor(`Boolean(document.querySelector('.ship-hub.area-operator') && [...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim() === 'Build'))`, 'compact Operator build route');
    await keyboardActivateButton('Build');
  }
  await waitFor(`(() => {
    const text = document.body?.innerText ?? '';
    const labels = [...document.querySelectorAll('button')].map(button => (button.textContent || '').trim());
    return document.querySelector('.build-header h1')?.textContent?.trim() === 'Build' && labels.includes('Skills');
  })()`, 'Build surface for skill hierarchy');
  await waitFor(`Boolean(document.querySelector('.build-bay.iv-view') && document.querySelector('.build-header.iv-panel.iv-panel--glass') && document.querySelector('.build-tabs button[aria-current="page"]'))`, 'P15-B shared Build shell');
  await armoryInspectorViewportAudit();
  await keyboardActivateButton('Crafting');
  await waitFor(`Boolean(document.querySelector('.reconstruction-panel .reconstruction-top.iv-panel.iv-panel--glass') && document.querySelector('.reconstruct-storage.iv-panel') && document.querySelector('.build-tabs button[aria-current="page"]')?.textContent?.includes('Crafting'))`, 'P15-B Crafting surface');
  await keyboardActivateButton('Progression');
  await waitFor(`Boolean(document.querySelector('.network-panel .section-copy.iv-panel.iv-panel--glass') && document.querySelector('.network-planner.iv-panel') && document.querySelector('.operator-class-panel.iv-panel') && document.querySelector('.specialization-panel.iv-panel') && document.querySelector('.build-tabs button[aria-current="page"]')?.textContent?.includes('Progression'))`, 'P15-B Progression surface');
  const p15BuildLayout = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('.build-tabs button')];
    return {
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      tabCount: buttons.length,
      minTabHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height)),
    };
  })()`);
  if (p15BuildLayout.horizontalOverflow > 2 || p15BuildLayout.tabCount !== 5 || (viewportMode === 'mobile-landscape' && p15BuildLayout.minTabHeight < 40)) {
    throw new Error(`P15-B Build/Crafting/Progression layout failed: ${JSON.stringify(p15BuildLayout)}`);
  }

  const p20BuildPreviousInterfaceSize = await evaluate(`document.documentElement.dataset.interfaceSize ?? 'default'`);
  async function p20BuildSurfaceMetric(size, tab, selector, property) {
    await evaluate(`document.documentElement.dataset.interfaceSize = ${JSON.stringify(size)}; true`);
    await keyboardActivateButton(tab);
    await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`, `P20-A ${size} ${tab} representative surface`);
    await sleep(80);
    return await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        value: Number.parseFloat(style[${JSON.stringify(property)}] || '0'),
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      };
    })()`);
  }

  const p20BuildScale = {};
  for (const size of ['compact', 'default', 'large']) {
    const loadout = await p20BuildSurfaceMetric(size, 'Loadout', '.equipment-slots', 'columnGap');
    const crafting = await p20BuildSurfaceMetric(size, 'Crafting', '.reconstruct-layout', 'columnGap');
    const progression = await p20BuildSurfaceMetric(size, 'Progression', '.network-planner', 'paddingLeft');
    const skills = await p20BuildSurfaceMetric(size, 'Skills', '.skill-path-overview', 'columnGap');
    const settings = await p20BuildSurfaceMetric(size, 'Settings', '.settings-panel label', 'paddingLeft');
    const tabs = await p20BuildSurfaceMetric(size, 'Loadout', '.build-tabs', 'columnGap');
    p20BuildScale[size] = {
      loadout: loadout?.value ?? 0,
      crafting: crafting?.value ?? 0,
      progression: progression?.value ?? 0,
      skills: skills?.value ?? 0,
      settings: settings?.value ?? 0,
      tabs: tabs?.value ?? 0,
      horizontalOverflow: Math.max(loadout?.horizontalOverflow ?? 0, crafting?.horizontalOverflow ?? 0, progression?.horizontalOverflow ?? 0, skills?.horizontalOverflow ?? 0, settings?.horizontalOverflow ?? 0, tabs?.horizontalOverflow ?? 0),
    };
  }
  await evaluate(`document.documentElement.dataset.interfaceSize = ${JSON.stringify(p20BuildPreviousInterfaceSize)}; true`);
  for (const metric of ['loadout', 'crafting', 'progression', 'skills', 'settings', 'tabs']) {
    if (!(p20BuildScale.compact[metric] < p20BuildScale.default[metric]
      && p20BuildScale.default[metric] < p20BuildScale.large[metric])) {
      throw new Error(`P20-A rendered ${metric} geometry is not ordered Compact < Default < Large: ${JSON.stringify(p20BuildScale)}`);
    }
  }
  if (p20BuildScale.compact.horizontalOverflow > 2 || p20BuildScale.default.horizontalOverflow > 2 || p20BuildScale.large.horizontalOverflow > 2) {
    throw new Error(`P20-A Build surface overflow across Interface Size: ${JSON.stringify(p20BuildScale)}`);
  }
  console.log(`BROWSER_P20_BUILD_SCALE_PASS viewport=${viewportMode} loadout+crafting+progression+skills+settings+tabs=ordered overflow=none`);

  const p20bPreviousTimeOrigin = await evaluate('performance.timeOrigin');
  const p20bSeeded = await evaluate(`(() => {
    const stateKey = 'ironshade-vector-state-v1';
    const state = JSON.parse(localStorage.getItem(stateKey) || 'null');
    if (!state?.profile) return false;
    const operatorClass = state.profile.operatorClass || 'vanguard';
    const startNodeId = { vanguard: 'start-vanguard', vector: 'start-vector', systems: 'start-systems' }[operatorClass] || 'start-vanguard';
    state.profile.level = 3;
    state.profile.xp = Math.max(Number(state.profile.xp || 0), 270);
    state.profile.progressionPoints = 2;
    state.profile.allocatedNodes = [];
    state.profile.operatorNetwork = { schemaVersion: 3, startNodeId, allocatedNodeIds: [], unspentPoints: 2, plannedTargetNodeIds: [] };
    state.operatorNetworkSchemaVersion = 3;
    localStorage.setItem(stateKey, JSON.stringify(state));
    location.reload();
    return true;
  })()`);
  if (!p20bSeeded) throw new Error('P20-B could not seed a two-point Operator Network profile.');
  await waitFor(`performance.timeOrigin !== ${JSON.stringify(p20bPreviousTimeOrigin)}`, 'P20-B browser document reload');
  await waitFor(`(() => {
    const operatorButton = [...document.querySelectorAll('button[data-primary-area]')].find(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase() === 'operator');
    return document.readyState === 'complete' && operatorButton instanceof HTMLButtonElement && !operatorButton.disabled;
  })()`, 'P20-B seeded Command Deck after reload');
  await keyboardActivateButton('Operator');
  await waitFor(`[...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim() === 'Build')`, 'P20-B Operator build route');
  await keyboardActivateButton('Build');
  await waitFor(`document.querySelector('.build-header h1')?.textContent?.trim() === 'Build'`, 'P20-B Build after seed');
  const p20bProgressionOpened = await evaluate(`(() => {
    const button = [...document.querySelectorAll('.build-tabs button')].find(candidate => (candidate.textContent || '').trim().toLowerCase().startsWith('progression'));
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.focus();
    button.click();
    return true;
  })()`);
  if (!p20bProgressionOpened) throw new Error('P20-B could not open the Progression tab after seeding points.');
  await waitFor(`Boolean(document.querySelector('.network-planner.iv-panel'))`, 'P20-B Progression planner after seed');

  const p20bTargets = [
    ['ballistics-3', 'Breach Doctrine'],
    ['mobility-1', 'Servo Timing'],
  ];
  for (let index = 0; index < p20bTargets.length; index += 1) {
    const [nodeId, nodeName] = p20bTargets[index];
    const selected = await evaluate(`(() => {
      const name = ${JSON.stringify(nodeName)};
      const button = [...document.querySelectorAll('button[data-network-node="true"]')].find(candidate => (candidate.textContent || '').includes(name));
      if (!button) return false;
      button.focus();
      button.click();
      return true;
    })()`);
    if (!selected) throw new Error(`P20-B could not focus planned target ${nodeName}.`);
    await waitFor(`[...document.querySelectorAll('button')].some(button => (button.textContent || '').trim() === 'Plan this route')`, `P20-B plan action for ${nodeName}`);
    await keyboardActivateButton('Plan this route');
    const expectedIds = p20bTargets.slice(0, index + 1).map(([id]) => id);
    await waitFor(`(() => {
      const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
      const targets = state?.profile?.operatorNetwork?.plannedTargetNodeIds;
      return Array.isArray(targets) && targets.join(',') === ${JSON.stringify(expectedIds.join(','))};
    })()`, `P20-B persisted planned target ${nodeName}`);
  }

  await waitFor(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    const button = [...document.querySelectorAll('button')].find(candidate => (candidate.textContent || '').trim() === 'Auto Allocate');
    return state?.profile?.progressionPoints === 2
      && state?.profile?.operatorNetwork?.allocatedNodeIds?.length === 0
      && button instanceof HTMLButtonElement
      && !button.disabled;
  })()`, 'P20-B actionable Auto Allocate button');
  await keyboardActivateButton('Auto Allocate');
  await waitFor(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    const network = state?.profile?.operatorNetwork;
    const targets = network?.plannedTargetNodeIds;
    const autoButton = [...document.querySelectorAll('button')].find(candidate => (candidate.textContent || '').trim() === 'Auto Allocate');
    const report = document.querySelector('.network-auto-allocate-report')?.textContent ?? '';
    const planText = document.querySelector('.network-plan-card')?.textContent ?? '';
    return Array.isArray(network?.allocatedNodeIds)
      && network.allocatedNodeIds.join(',') === 'ballistics-1,ballistics-2'
      && network.unspentPoints === 0
      && Array.isArray(targets)
      && targets.join(',') === 'ballistics-3,mobility-1'
      && autoButton instanceof HTMLButtonElement
      && autoButton.disabled
      && report.includes('2 nodes allocated')
      && report.includes('2 pt spent')
      && report.includes('0 pt remaining')
      && report.includes('2 future points needed')
      && planText.includes('FUTURE POINTS NEEDED')
      && planText.includes('2');
  })()`, 'P20-B partial Auto Allocate and remaining plan state', 20_000);
  console.log(`BROWSER_P20B_AUTO_ALLOCATE_PASS viewport=${viewportMode} allocated=ballistics-1+ballistics-2 spent=2 remaining=0 targets=ballistics-3+mobility-1 futurePoints=2 button=disabled`);

  await keyboardActivateButton('Settings');
  await waitFor(`Boolean(document.querySelector('.settings-panel') && document.querySelector('.build-tabs button[aria-current="page"]')?.textContent?.includes('Settings'))`, 'P15-E accessibility settings surface');

  async function setP20InterfaceSize(value) {
    const changed = await evaluate(`(() => {
      const control = document.querySelector('select[aria-label="Interface size"]');
      if (!(control instanceof HTMLSelectElement)) return false;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (!valueSetter) return false;
      valueSetter.call(control, '${value}');
      control.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    if (!changed) throw new Error(`P20-A Interface Size control unavailable for ${value}.`);
    await waitFor(`(() => {
      const raw = localStorage.getItem('ironshade-vector-state-v1');
      const settings = raw ? JSON.parse(raw)?.profile?.settings : null;
      return settings?.interfaceSize === '${value}' && document.documentElement.dataset.interfaceSize === '${value}';
    })()`, `P20-A persisted ${value} Interface Size`);
    await sleep(100);
    return await evaluate(`(() => {
      const panel = document.querySelector('.settings-panel');
      const rootStyle = getComputedStyle(document.documentElement);
      const panelRect = panel?.getBoundingClientRect();
      const row = document.querySelector('.settings-panel label');
      const select = document.querySelector('.settings-panel select');
      const tabs = document.querySelector('.build-tabs');
      const rowStyle = row ? getComputedStyle(row) : null;
      const selectStyle = select ? getComputedStyle(select) : null;
      const tabsStyle = tabs ? getComputedStyle(tabs) : null;
      return {
        size: document.documentElement.dataset.interfaceSize ?? '',
        rootFontSize: Number.parseFloat(rootStyle.fontSize),
        rowPadding: Number.parseFloat(rowStyle?.paddingLeft ?? '0'),
        selectPadding: Number.parseFloat(selectStyle?.paddingLeft ?? '0'),
        tabGap: Number.parseFloat(tabsStyle?.columnGap ?? '0'),
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        panelVisible: Boolean(panelRect && panelRect.width > 0 && panelRect.height > 0),
      };
    })()`);
  }

  const p20InterfaceCompact = await setP20InterfaceSize('compact');
  const p20InterfaceDefault = await setP20InterfaceSize('default');
  const p20InterfaceLarge = await setP20InterfaceSize('large');
  if (!p20InterfaceCompact.panelVisible || !p20InterfaceDefault.panelVisible || !p20InterfaceLarge.panelVisible
    || p20InterfaceCompact.horizontalOverflow > 2 || p20InterfaceDefault.horizontalOverflow > 2 || p20InterfaceLarge.horizontalOverflow > 2
    || !(p20InterfaceCompact.rootFontSize < p20InterfaceDefault.rootFontSize && p20InterfaceDefault.rootFontSize < p20InterfaceLarge.rootFontSize)
    || !(p20InterfaceCompact.rowPadding < p20InterfaceDefault.rowPadding && p20InterfaceDefault.rowPadding < p20InterfaceLarge.rowPadding)
    || !(p20InterfaceCompact.selectPadding < p20InterfaceDefault.selectPadding && p20InterfaceDefault.selectPadding < p20InterfaceLarge.selectPadding)
    || !(p20InterfaceCompact.tabGap < p20InterfaceDefault.tabGap && p20InterfaceDefault.tabGap < p20InterfaceLarge.tabGap)) {
    throw new Error(`P20-A Interface Size reflow failed: ${JSON.stringify({ compact: p20InterfaceCompact, default: p20InterfaceDefault, large: p20InterfaceLarge })}`);
  }
  await setP20InterfaceSize('default');
  console.log(`BROWSER_P20_INTERFACE_SIZE_PASS viewport=${viewportMode} compact=${p20InterfaceCompact.rootFontSize}px default=${p20InterfaceDefault.rootFontSize}px large=${p20InterfaceLarge.rootFontSize}px overflow=none persisted=true`);

  const textScaleChanged = await evaluate(`(() => {
    const control = document.querySelector('select[aria-label="Interface text size"]');
    if (!(control instanceof HTMLSelectElement)) return false;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (!valueSetter) return false;
    valueSetter.call(control, 'large');
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!textScaleChanged) throw new Error('P15-E interface text-size control unavailable.');
  await waitFor(`document.documentElement.dataset.textScale === 'large'`, 'P15-E large text setting');

  const contrastChanged = await evaluate(`(() => {
    const control = document.querySelector('input[aria-label="High contrast"]');
    if (!(control instanceof HTMLInputElement)) return false;
    if (!control.checked) control.click();
    return true;
  })()`);
  if (!contrastChanged) throw new Error('P15-E high-contrast control unavailable.');
  await waitFor(`document.documentElement.dataset.contrast === 'high'`, 'P15-E high contrast setting');

  const motionChanged = await evaluate(`(() => {
    const control = document.querySelector('input[aria-label="Reduce motion"]');
    if (!(control instanceof HTMLInputElement)) return false;
    if (!control.checked) control.click();
    return true;
  })()`);
  if (!motionChanged) throw new Error('P15-E reduced-motion control unavailable.');
  await waitFor(`document.documentElement.dataset.reducedMotion === 'true'`, 'P15-E reduced motion setting');
  await waitFor(`(() => {
    const raw = localStorage.getItem('ironshade-vector-state-v1');
    if (!raw) return false;
    const settings = JSON.parse(raw)?.profile?.settings;
    return settings?.textScale === 'large' && settings?.contrast === 'high' && settings?.reducedMotion === true;
  })()`, 'P15-E persisted accessibility settings');

  const accessibilityLayout = await evaluate(`(() => {
    const panel = document.querySelector('.settings-panel');
    const view = document.querySelector('.build-bay.iv-view');
    const rootStyle = getComputedStyle(document.documentElement);
    const viewStyle = view ? getComputedStyle(view) : null;
    return {
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      panelVisible: Boolean(panel && panel.getBoundingClientRect().width > 0 && panel.getBoundingClientRect().height > 0),
      rootFontSize: Number.parseFloat(rootStyle.fontSize),
      contrastText: rootStyle.getPropertyValue('--iv-text-secondary').trim().toLowerCase(),
      animationName: viewStyle?.animationName ?? '',
      transitionDuration: viewStyle?.transitionDuration ?? '',
      settings: {
        textScale: document.documentElement.dataset.textScale,
        contrast: document.documentElement.dataset.contrast,
        reducedMotion: document.documentElement.dataset.reducedMotion,
      },
    };
  })()`);
  if (
    accessibilityLayout.horizontalOverflow > 2
    || !accessibilityLayout.panelVisible
    || accessibilityLayout.rootFontSize < 17.5
    || accessibilityLayout.contrastText !== '#dfeae6'
    || accessibilityLayout.animationName !== 'none'
    || accessibilityLayout.settings.textScale !== 'large'
    || accessibilityLayout.settings.contrast !== 'high'
    || accessibilityLayout.settings.reducedMotion !== 'true'
  ) {
    throw new Error(`P15-E accessibility presentation gate failed: ${JSON.stringify(accessibilityLayout)}`);
  }
  await accessibilityAudit('settings-accessibility');
  await captureScreenshot(accessibilityScreenshotPath);
  console.log(`BROWSER_P15_ACCESSIBILITY_PASS viewport=${viewportMode} text=large contrast=high motion=reduced persisted=true screenshot=${accessibilityScreenshotPath}`);

  await keyboardActivateButton('Skills');
  await waitFor(`(() => {
    const text = document.body?.innerText ?? '';
    const stages = [...document.querySelectorAll('.skill-path-overview > article')].map(node => (node.textContent || '').trim());
    const cards = [...document.querySelectorAll('.skill-path-card')];
    const details = [...document.querySelectorAll('.skill-path-card .iv-disclosure-trigger')].filter(button => (button.textContent || '').trim() === 'View current skill path');
    return text.includes('Choose Standard, a Lens, or a class Evolution.')
      && Boolean(document.querySelector('button[data-guide-link="builds-progression"]'))
      && !text.includes('How Skills progression works')
      && text.includes('SHARED LENSES')
      && text.includes('CLASS EVOLUTIONS')
      && stages.length === 4
      && cards.length === 3
      && details.length === 3
      && cards.every(card => card.querySelector('.skill-hierarchy-grid') === null);
  })()`, 'P19-E decision-first skill hierarchy');
  await keyboardActivateButton('View current skill path');
  await waitFor(`document.querySelectorAll('.iv-disclosure-sheet .skill-hierarchy-grid > div').length === 4`, 'P19-E current skill path Details');
  await keyboardActivateButton('Close details');
  await waitFor(`!document.querySelector('.iv-disclosure-sheet')`, 'P19-E current skill path Details close');
  const hierarchyLayout = await evaluate(`(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const buttons = [...document.querySelectorAll('.skill-option-group > button')].filter(button => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const undersized = buttons.filter(button => button.getBoundingClientRect().height < 40).map(button => (button.textContent || '').trim().slice(0, 40));
    const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - viewport.width);
    return { viewport, buttonCount: buttons.length, undersized, horizontalOverflow };
  })()`);
  if (hierarchyLayout.buttonCount < 9 || hierarchyLayout.undersized.length || hierarchyLayout.horizontalOverflow > 2) {
    throw new Error(`P8-H skill hierarchy layout failed: ${JSON.stringify(hierarchyLayout)}`);
  }
  console.log(`BROWSER_SKILL_HIERARCHY_PASS viewport=${viewportMode} stages=4 skills=3 options=${hierarchyLayout.buttonCount} details=shared-sheet guide=builds-progression`);
  await keyboardActivateButton('Return to ship');
  await waitFor(`(() => {
    const text = (document.body?.innerText ?? '').toLowerCase();
    const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
    return (text.includes('command ready') || text.includes('command deck')) && labels.includes('operations');
  })()`, 'Command Deck after Build skill hierarchy');

  await keyboardActivateButton('Ship');
  await waitFor(`Boolean(document.querySelector('.ship-hub.iv-view.area-ship') && document.querySelector('.tactical-header.iv-panel.iv-panel--glass') && document.querySelector('.ship-systems-intro.iv-panel.iv-panel--glass') && document.querySelector('.ship-hardware-bay.iv-panel') && document.querySelectorAll('.ship-systems-panel .upgrade-card.iv-panel').length >= 6)`, 'P15-B Ship Systems surface');
  const p15ShipLayout = await evaluate(`(() => {
    const tabs = [...document.querySelectorAll('.section-tabs button')].filter(button => button.getBoundingClientRect().height > 0);
    return {
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      visibleTabs: tabs.length,
      minTabHeight: tabs.length ? Math.min(...tabs.map(button => button.getBoundingClientRect().height)) : 0,
    };
  })()`);
  if (p15ShipLayout.horizontalOverflow > 2 || p15ShipLayout.visibleTabs < 2 || (viewportMode === 'mobile-landscape' && p15ShipLayout.minTabHeight < 40)) {
    throw new Error(`P15-B Ship Systems layout failed: ${JSON.stringify(p15ShipLayout)}`);
  }
  console.log(`BROWSER_P15_MENU_PRESENTATION_PASS viewport=${viewportMode} input=keyboard flows=class+crafting+progression+ship-systems shared=iv-panel transition=iv-view`);

  await keyboardActivateButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(button => button.textContent?.trim().toLowerCase() === 'contracts')`, 'Operations navigation');
  await keyboardActivateButton('Contracts');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('contract board') && [...document.querySelectorAll('button')].some(button => button.textContent?.trim().toLowerCase() === 'deploy selected contract')`, 'Contract Board');
  await accessibilityAudit('contract-board');

  const targetSelected = await evaluate(`(() => {
    const target = ${JSON.stringify(targetLocation)};
    const button = [...document.querySelectorAll('button[data-location]')].find(candidate => candidate.dataset.location === target);
    if (!button || button.disabled) return false;
    button.click();
    return button.classList.contains('selected') || true;
  })()`);
  if (!targetSelected) throw new Error(`Target contract ${targetLocation} was not available on the fresh Contract Board.`);
  await waitFor(`[...document.querySelectorAll('button[data-location]')].some(button => button.dataset.location === ${JSON.stringify(targetLocation)} && button.classList.contains('selected'))`, `${targetLocation} contract selection`);

  await keyboardActivateButton('Deploy Selected Contract');
  await waitFor(`Boolean(document.querySelectorAll('canvas').length > 0 && (document.querySelector('[data-presentation="deployment"]') || document.querySelector('.transient-alert-lane.event')))`, 'Combat surface');
  await waitFor(`Boolean(document.querySelector('.game-root[data-mission-presentation="non-blocking-cues"]') && (document.querySelector('[data-presentation="deployment"]') || document.querySelector('.transient-alert-lane.event')))`, 'P15-C deployment presentation');
  const p15MissionPresentation = await evaluate(`(() => {
    const compact = ${JSON.stringify(viewportMode)} === 'mobile-landscape';
    const cue = compact ? document.querySelector('.transient-alert-lane.event .combat-alert') : document.querySelector('[data-presentation="deployment"]');
    const rect = cue?.getBoundingClientRect();
    const style = cue ? getComputedStyle(cue) : null;
    return {
      mode: compact ? 'shared-transient' : 'cinematic',
      pointerEvents: style?.pointerEvents ?? '',
      title: cue?.querySelector('b')?.textContent?.trim() ?? '',
      left: rect?.left ?? -1,
      right: rect?.right ?? -1,
      top: rect?.top ?? -1,
      bottom: rect?.bottom ?? -1,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  })()`);
  if (p15MissionPresentation.pointerEvents !== 'none' || !p15MissionPresentation.title || p15MissionPresentation.left < 0 || p15MissionPresentation.right > p15MissionPresentation.viewportWidth || p15MissionPresentation.top < 0 || p15MissionPresentation.bottom > p15MissionPresentation.viewportHeight) {
    throw new Error(`P15-C deployment presentation blocks input or leaves the viewport: ${JSON.stringify(p15MissionPresentation)}`);
  }
  console.log(`BROWSER_P15_MISSION_PRESENTATION_PASS viewport=${viewportMode} deployment=non-blocking mode=${p15MissionPresentation.mode} title=${p15MissionPresentation.title}`);
  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.worldReadability);
    return canvas?.dataset.worldReadability === 'interactables:shape+state|hazards:shape+motion|loot:shape+rarity'
      && canvas?.dataset.interactableReadability === 'shape-coded+state-emissive+floor-cue:quality-safe'
      && canvas?.dataset.hazardReadability === 'shape-coded+floor-bound+quality-safe'
      && (canvas?.dataset.worldMaterialDepth ?? '').includes('material-response')
      && Boolean(canvas?.dataset.biomeState)
      && Boolean(canvas?.dataset.biomeStateAnimation)
      && Boolean(canvas?.dataset.biomeStateAudio);
  })()`, 'P15-D world material readability', 20_000);
  const p15WorldPolish = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.worldReadability);
    return {
      readability: canvas?.dataset.worldReadability ?? '',
      materialDepth: canvas?.dataset.worldMaterialDepth ?? '',
      biomeState: canvas?.dataset.biomeState ?? '',
      biomeAnimation: canvas?.dataset.biomeStateAnimation ?? '',
      biomeAudio: canvas?.dataset.biomeStateAudio ?? '',
      interactables: canvas?.dataset.interactableReadability ?? '',
      hazards: canvas?.dataset.hazardReadability ?? '',
    };
  })()`);
  console.log(`BROWSER_P15_WORLD_POLISH_PASS viewport=${viewportMode} location=${targetLocation} state=${p15WorldPolish.biomeState} depth=${p15WorldPolish.materialDepth}`);
  if (targetLocation === 'asteroid-refinery') await performanceDiagnosticsAudit();
  await waitFor(`(() => {
    const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || '').trim());
    return ['Breach Rush', 'Fracture Tag', 'Bulwark Pulse'].every(label => labels.includes(label));
  })()`, 'Vanguard level-one skill kit');
  console.log(`BROWSER_CLASS_KIT_PASS viewport=${viewportMode} kit=RUSH/BREAK/GUARD`);
  if (viewportMode === 'mobile-landscape') {
    await waitFor(`(() => {
      const icons = [...document.querySelectorAll('img[src*="/assets/ui/skills/"], img[src*="/assets/ui/weapons/"]')];
      return icons.length >= 4 && icons.every(image => image.complete && image.naturalWidth > 0);
    })()`, 'Mobile combat SVG assets', 20_000);
  }
  if (targetLocation === 'spin-habitat') {
    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat');
      return canvas?.dataset.environmentMotion === 'gravity-coupled-rigid-rotation'
        && canvas?.dataset.environmentSpinSource === 'sector-A-gravity'
        && canvas?.dataset.environmentZoneIdentity === 'rim:plated-green-deck|spoke:skeletal-cyan-truss|axis:bright-stationary-tower'
        && canvas?.dataset.readabilityLanguage === 'rim-plated-green+spoke-skeletal-cyan+axis-bright-stationary'
        && canvas?.dataset.environmentSpindownSource === 'sector-B-transfer-gravity'
        && canvas?.dataset.environmentVfx === 'spindown-brake-arcs+axis-warning-pulse'
        && canvas?.dataset.interactableBiome === 'spin-habitat'
        && canvas?.dataset.interactableMode === 'spin-habitat-machinery+mission-controls'
        && canvas?.dataset.interactableKit === 'spin-bus-isolator+gravity-trim+bearing-control+attitude-flywheel+pressure-lock'
        && canvas?.dataset.interactableVisual === 'authored'
        && !(canvas?.dataset.interactableFallback ?? '')
        && (canvas?.dataset.interactableAssets ?? '').includes('spin-habitat-gravity-trim-lod')
        && canvas?.dataset.enemyBiome === 'spin-habitat'
        && canvas?.dataset.enemyLocalVisual === 'authored'
        && canvas?.dataset.enemyLocalKit === 'spoke-marksman+spin-trim-specialist+ring-drone-carrier+axis-shield-boarder'
        && !(canvas?.dataset.enemyLocalFallback ?? '')
        && ['spin-habitat-spoke-marksman-lod', 'spin-habitat-spin-trim-specialist-lod', 'spin-habitat-ring-drone-carrier-lod', 'spin-habitat-axis-shield-boarder-lod'].every(asset => (canvas?.dataset.enemyLocalAssets ?? '').includes(asset))
        && canvas?.dataset.bossBiome === 'spin-habitat'
        && canvas?.dataset.bossPresentation === 'sable-voss'
        && canvas?.dataset.bossVisual === 'authored'
        && (canvas?.dataset.bossAsset ?? '').includes('spin-habitat-sable-voss-lod')
        && canvas?.dataset.bossSilhouette === 'counterspin-mantle+governor-towers+command-visor'
        && !(canvas?.dataset.bossFallback ?? '')
        && canvas?.dataset.environmentAmbient === 'rim-light-sweep+spin-dust+axis-haze'
        && canvas?.dataset.environmentAmbientMotion === 'gravity-coupled-sweep+counterspin-drift+stationary-axis-pulse'
        && (canvas?.dataset.environmentAmbientDetail ?? '').includes('motes+axis-haze')
        && Number.isFinite(Number(canvas?.dataset.environmentAmbientIntensity))
        && (canvas?.dataset.environmentPerformanceProfile ?? '').includes('lod')
        && (canvas?.dataset.environmentInstanceBudget ?? '').includes('ring:')
        && ['rotor+axis', 'axis-only'].includes(canvas?.dataset.environmentShadowCasters ?? '')
        && ['idle', 'active'].includes(canvas?.dataset.environmentSpindown ?? '')
        && Number.isFinite(Number(canvas?.dataset.environmentSpindownIntensity))
        && Number.isFinite(Number(canvas?.dataset.environmentSpinPhase));
    })()`, 'Spin Habitat authored rotating architecture', 20_000);
    const firstPhase = Number(await evaluate(`[...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat')?.dataset.environmentSpinPhase`));
    if (!Number.isFinite(firstPhase)) throw new Error(`Spin Habitat rotation phase was not observable: ${firstPhase}`);
    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat');
      const phase = Number(canvas?.dataset.environmentSpinPhase);
      return Number.isFinite(phase) && Math.abs(phase - ${JSON.stringify(firstPhase)}) >= 0.015;
    })()`, 'Spin Habitat rotation phase advance', 5_000);
    const nextPhase = Number(await evaluate(`[...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat')?.dataset.environmentSpinPhase`));
    if (!Number.isFinite(nextPhase)) {
      throw new Error(`Spin Habitat rotation phase became unavailable after advancing from ${firstPhase}`);
    }
    const spindownState = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat');
      return {
        mode: canvas?.dataset.environmentSpindown ?? 'missing',
        intensity: Number(canvas?.dataset.environmentSpindownIntensity),
        detail: canvas?.dataset.environmentSpindownDetail ?? 'missing',
      };
    })()`);
    if (!Number.isFinite(spindownState?.intensity)) {
      throw new Error(`Spin Habitat spindown VFX state was not observable: ${JSON.stringify(spindownState)}`);
    }
    const habitatInteractables = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat');
      return canvas?.dataset.interactableAssets ?? '';
    })()`);
    const habitatEnemies = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat');
      return canvas?.dataset.enemyLocalAssets ?? '';
    })()`);
    const habitatBoss = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat');
      return canvas?.dataset.bossAsset ?? '';
    })()`);
    const habitatAmbient = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat');
      return canvas?.dataset.environmentAmbientDetail ?? '';
    })()`);
    const habitatPerformance = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-spin-habitat');
      return {
        lod: canvas?.dataset.environmentLod ?? '',
        profile: canvas?.dataset.environmentPerformanceProfile ?? '',
        instances: canvas?.dataset.environmentInstanceBudget ?? '',
        shadows: canvas?.dataset.environmentShadowCasters ?? '',
        renderTier: canvas?.dataset.renderTier ?? '',
      };
    })()`);
    if (viewportMode === 'mobile-landscape') {
      if (habitatPerformance?.lod !== '2') throw new Error(`Spin Habitat mobile environment did not select LOD2: ${JSON.stringify(habitatPerformance)}`);
      if (!/^(mobile|performance):lod2:rotor-shadows-off$/.test(habitatPerformance?.profile ?? '')) throw new Error(`Spin Habitat mobile performance profile is invalid: ${JSON.stringify(habitatPerformance)}`);
      if (habitatPerformance?.instances !== 'ring:4+spoke:4+axis:1+service:2') throw new Error(`Spin Habitat mobile instance budget regressed: ${JSON.stringify(habitatPerformance)}`);
      if (habitatPerformance?.shadows !== 'axis-only') throw new Error(`Spin Habitat mobile moving shadows were not suppressed: ${JSON.stringify(habitatPerformance)}`);
      if (spindownState.detail !== '3-arcs+axis-pulse') throw new Error(`Spin Habitat mobile spindown VFX kept excess arcs: ${JSON.stringify(spindownState)}`);
    }
    console.log(`BROWSER_SPIN_HABITAT_PASS viewport=${viewportMode} identity=rim/spoke/axis machinery=${habitatInteractables} enemies=${habitatEnemies} boss=${habitatBoss} ambient=${habitatAmbient} performance=${habitatPerformance.profile}:${habitatPerformance.instances}:${habitatPerformance.shadows} vfx=spindown:${spindownState.mode}:${spindownState.detail} phase=${firstPhase.toFixed(3)}->${nextPhase.toFixed(3)}`);
  }

  if (targetLocation === 'jovian-harvester') {
    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-jovian-harvester');
      return canvas?.dataset.environmentKit === 'deck-span,skimmer-tower,transfer-bridge,ballast-pod'
        && canvas?.dataset.environmentLandmark === 'five-skimmer-tower-spine'
        && canvas?.dataset.environmentComposition === 'elevated-skimmer-decks+five-tower-spine+transfer-bridges+ballast-pods'
        && canvas?.dataset.environmentZoneIdentity === 'deck:weathered-plate|tower:vertical-skimmer-spine|bridge:dark-transfer-truss|ballast:light-suspended-pod'
        && canvas?.dataset.readabilityLanguage === 'tower-height+bridge-lines+amber-wayfinding+pressure-shear+storm-charge'
        && canvas?.dataset.environmentStormLanguage === 'storm-charge-sweeps+pressure-shear-bands+relief-pulse'
        && canvas?.dataset.environmentStormSource === 'live-sector-pressure+service-breach+contract-conditions'
        && canvas?.dataset.environmentVfx === 'storm-charge-sweeps+pressure-shear-bands+relief-pulse'
        && canvas?.dataset.environmentAmbient === 'upper-haze+pressure-clouds+charged-particulate'
        && canvas?.dataset.environmentAmbientMotion === 'crosswind-drift+pressure-breath+charged-drift'
        && ['2-clouds+20-motes+spine-haze', '3-clouds+36-motes+spine-haze', '5-clouds+56-motes+spine-haze'].includes(canvas?.dataset.environmentAmbientDetail ?? '')
        && Number.isFinite(Number(canvas?.dataset.environmentAmbientIntensity))
        && Number.isFinite(Number(canvas?.dataset.environmentStormIntensity))
        && Number.isFinite(Number(canvas?.dataset.environmentPressureShear))
        && ['2-sweeps+2-bands+relief-pulse', '4-sweeps+3-bands+relief-pulse'].includes(canvas?.dataset.environmentStormDetail ?? '')
        && canvas?.dataset.interactableBiome === 'jovian-harvester'
        && canvas?.dataset.interactableMode === 'jovian-gas-machinery+mission-controls'
        && canvas?.dataset.interactableKit === 'storm-bus-isolator+deck-mass-trim+skimmer-compressor+separator-package'
        && canvas?.dataset.interactablePressureKit === 'storm-pressure-lock+relief-manifold'
        && canvas?.dataset.interactablePressureSource === 'live-pressure-links+breach-state+sector-pressure'
        && ['normal', 'leaking', 'decompressing', 'vacuum', 'venting'].includes(canvas?.dataset.interactablePressureState ?? '')
        && ['open', 'sealed'].includes(canvas?.dataset.interactablePressureDoor ?? '')
        && canvas?.dataset.interactableVisual === 'authored'
        && !(canvas?.dataset.interactableFallback ?? '')
        && (canvas?.dataset.interactableAssets ?? '').includes('jovian-harvester-deck-mass-trim-lod')
        && (canvas?.dataset.interactableAssets ?? '').includes('jovian-harvester-storm-pressure-lock-lod')
        && (canvas?.dataset.interactableAssets ?? '').includes('jovian-harvester-relief-manifold-lod')
        && canvas?.dataset.bossBiome === 'jovian-harvester'
        && canvas?.dataset.bossPresentation === 'stormline-foreman-ilex'
        && canvas?.dataset.bossVisual === 'authored'
        && (canvas?.dataset.bossAsset ?? '').includes('jovian-harvester-stormline-foreman-lod')
        && canvas?.dataset.bossSilhouette === 'storm-cowl+pressure-crown+relief-stacks'
        && canvas?.dataset.bossPalette === 'storm-orange+pressure-cyan+vent-red-phase-two'
        && !(canvas?.dataset.bossFallback ?? '')
        && Number(canvas?.dataset.environmentInstances) > 0
        && ['1', '2'].includes(canvas?.dataset.environmentLod ?? '')
        && /^(full|balanced|mobile|performance):lod[12]:structure-shadows-(on|off)$/.test(canvas?.dataset.environmentPerformanceProfile ?? '')
        && (canvas?.dataset.environmentInstanceBudget ?? '').includes('tower:5')
        && ['jovian-structures', 'off'].includes(canvas?.dataset.environmentShadowCasters ?? '');
    })()`, 'Jovian Harvester authored environment and gas machinery kit', 20_000);
    const jovianEnvironment = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-jovian-harvester');
      return {
        lod: canvas?.dataset.environmentLod ?? '',
        instances: canvas?.dataset.environmentInstances ?? '',
        profile: canvas?.dataset.environmentPerformanceProfile ?? '',
        instanceBudget: canvas?.dataset.environmentInstanceBudget ?? '',
        shadows: canvas?.dataset.environmentShadowCasters ?? '',
        kit: canvas?.dataset.environmentKit ?? '',
        composition: canvas?.dataset.environmentComposition ?? '',
        machinery: canvas?.dataset.interactableAssets ?? '',
        pressureKit: canvas?.dataset.interactablePressureKit ?? '',
        pressureState: canvas?.dataset.interactablePressureState ?? '',
        pressureDoor: canvas?.dataset.interactablePressureDoor ?? '',
        stormMode: canvas?.dataset.environmentStormMode ?? '',
        stormIntensity: Number(canvas?.dataset.environmentStormIntensity),
        pressureShear: Number(canvas?.dataset.environmentPressureShear),
        pressureRange: canvas?.dataset.environmentPressureRange ?? '',
        stormDetail: canvas?.dataset.environmentStormDetail ?? '',
        atmosphereDetail: canvas?.dataset.environmentAmbientDetail ?? '',
        atmosphereIntensity: Number(canvas?.dataset.environmentAmbientIntensity),
        bossAsset: canvas?.dataset.bossAsset ?? '',
        bossPresentation: canvas?.dataset.bossPresentation ?? '',
      };
    })()`);
    if (!Number.isFinite(jovianEnvironment?.stormIntensity) || !Number.isFinite(jovianEnvironment?.pressureShear) || !Number.isFinite(jovianEnvironment?.atmosphereIntensity)) {
      throw new Error(`Jovian Harvester storm/pressure/atmosphere state was not observable: ${JSON.stringify(jovianEnvironment)}`);
    }
    if (viewportMode === 'mobile-landscape') {
      if (jovianEnvironment?.lod !== '2') throw new Error(`Jovian Harvester mobile environment did not select LOD2: ${JSON.stringify(jovianEnvironment)}`);
      if (!/^(mobile|performance):lod2:structure-shadows-off$/.test(jovianEnvironment?.profile ?? '')) throw new Error(`Jovian Harvester mobile performance profile is invalid: ${JSON.stringify(jovianEnvironment)}`);
      if (jovianEnvironment?.instanceBudget !== 'deck:4+tower:5+bridge:2+ballast:2') throw new Error(`Jovian Harvester mobile instance budget regressed: ${JSON.stringify(jovianEnvironment)}`);
      if (jovianEnvironment?.shadows !== 'off') throw new Error(`Jovian Harvester mobile structural shadows were not suppressed: ${JSON.stringify(jovianEnvironment)}`);
      if (jovianEnvironment?.stormDetail !== '2-sweeps+2-bands+relief-pulse') {
        throw new Error(`Jovian Harvester mobile storm/pressure detail did not reduce: ${JSON.stringify(jovianEnvironment)}`);
      }
    }
    if (viewportMode === 'mobile-landscape' && jovianEnvironment?.atmosphereDetail !== '2-clouds+20-motes+spine-haze') {
      throw new Error(`Jovian Harvester mobile atmosphere detail did not reduce: ${JSON.stringify(jovianEnvironment)}`);
    }
    console.log(`BROWSER_JOVIAN_HARVESTER_PASS viewport=${viewportMode} lod=${jovianEnvironment?.lod} instances=${jovianEnvironment?.instances} performance=${jovianEnvironment?.profile}:${jovianEnvironment?.instanceBudget}:${jovianEnvironment?.shadows} kit=${jovianEnvironment?.kit} composition=${jovianEnvironment?.composition} machinery=${jovianEnvironment?.machinery} pressureKit=${jovianEnvironment?.pressureKit} boss=${jovianEnvironment?.bossPresentation}:${jovianEnvironment?.bossAsset} pressure=${jovianEnvironment?.pressureState} door=${jovianEnvironment?.pressureDoor} atmosphere=${jovianEnvironment?.atmosphereDetail}:${jovianEnvironment?.atmosphereIntensity.toFixed(2)} storm=${jovianEnvironment?.stormMode}:${jovianEnvironment?.stormIntensity.toFixed(2)} shear=${jovianEnvironment?.pressureShear.toFixed(2)} range=${jovianEnvironment?.pressureRange} detail=${jovianEnvironment?.stormDetail}`);
  }

  if (targetLocation === 'ice-mine') {
    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-ice-mine');
      return canvas?.dataset.environmentKit === 'frost-wall,support-frame,service-deck,ice-pillar,cryo-pump,coolant-manifold,freeze-compressor'
        && canvas?.dataset.environmentLandmark === 'subglacial-vault-ice-pillars'
        && canvas?.dataset.environmentComposition === 'access-bore+reinforced-extraction-tunnel+subglacial-vault'
        && canvas?.dataset.environmentTunnelSequence === 'access-bore>extraction-tunnel>subglacial-vault'
        && canvas?.dataset.environmentZoneIdentity === 'access-bore:frost-wall-cut|extraction-tunnel:steel-support-frames+service-deck+cryo-pumps|subglacial-vault:ice-pillar-cluster+coolant-manifolds+freeze-compressors'
        && canvas?.dataset.readabilityLanguage === 'frost-wall-corridor+support-frame-rhythm+cyan-service-deck+vault-pillars+cold-cyan-machinery'
        && (canvas?.dataset.environmentServiceDetails ?? '').includes('support-frame:6')
        && (canvas?.dataset.environmentServiceDetails ?? '').includes('service-deck:4')
        && (canvas?.dataset.environmentSurfaceDetail ?? '').includes('frost-wall:10')
        && (canvas?.dataset.environmentSurfaceDetail ?? '').includes('ice-pillar:5')
        && canvas?.dataset.environmentMachineDetail === 'cryo-pump:2+coolant-manifold:3+freeze-compressor:2'
        && canvas?.dataset.environmentBrittleSupportIds === 'ice-brittle-gate-a,ice-brittle-gate-b'
        && /^(intact|damaged|partial|cleared)$/.test(canvas?.dataset.environmentBrittleSupportState ?? '')
        && canvas?.dataset.environmentFractureVfx === 'support-cracks+shard-burst+frost-pulse'
        && /^(idle|cracking|collapsing|settled)$/.test(canvas?.dataset.environmentFractureState ?? '')
        && ['4-shards+2-cracks+frost-pulse', '8-shards+3-cracks+frost-pulse'].includes(canvas?.dataset.environmentFractureDetail ?? '')
        && canvas?.dataset.bossBiome === 'ice-mine'
        && canvas?.dataset.bossPresentation === 'rhea-kade'
        && canvas?.dataset.bossVisual === 'authored'
        && (canvas?.dataset.bossAsset ?? '').includes('ice-mine-rhea-kade-lod')
        && canvas?.dataset.bossSilhouette === 'bore-cowl+cryo-tanks+fracture-ram'
        && canvas?.dataset.bossPalette === 'mine-steel+frost-cyan+fracture-amber-phase-two'
        && !(canvas?.dataset.bossFallback ?? '')
        && Number(canvas?.dataset.environmentInstances) > 0
        && ['1', '2'].includes(canvas?.dataset.environmentLod ?? '');
    })()`, 'Ice Mine authored bore/tunnel geometry', 20_000);
    const iceMineEnvironment = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-ice-mine');
      return {
        lod: canvas?.dataset.environmentLod ?? '',
        instances: canvas?.dataset.environmentInstances ?? '',
        kit: canvas?.dataset.environmentKit ?? '',
        composition: canvas?.dataset.environmentComposition ?? '',
        sequence: canvas?.dataset.environmentTunnelSequence ?? '',
        service: canvas?.dataset.environmentServiceDetails ?? '',
        surface: canvas?.dataset.environmentSurfaceDetail ?? '',
        machinery: canvas?.dataset.environmentMachineDetail ?? '',
        brittle: canvas?.dataset.environmentBrittleSupports ?? '',
        brittleState: canvas?.dataset.environmentBrittleSupportState ?? '',
        fractureVfx: canvas?.dataset.environmentFractureVfx ?? '',
        fractureState: canvas?.dataset.environmentFractureState ?? '',
        fractureDetail: canvas?.dataset.environmentFractureDetail ?? '',
        fractureSupports: canvas?.dataset.environmentFractureSupports ?? '',
        bossAsset: canvas?.dataset.bossAsset ?? '',
        bossPresentation: canvas?.dataset.bossPresentation ?? '',
      };
    })()`);
    if (viewportMode === 'mobile-landscape' && iceMineEnvironment?.lod !== '2') {
      throw new Error(`Ice Mine mobile environment did not select LOD2: ${JSON.stringify(iceMineEnvironment)}`);
    }
    if (iceMineEnvironment?.machinery !== 'cryo-pump:2+coolant-manifold:3+freeze-compressor:2') {
      throw new Error(`Ice Mine cryogenic machinery runtime telemetry was not observable: ${JSON.stringify(iceMineEnvironment)}`);
    }
    if (!iceMineEnvironment?.brittle || !/^(intact|damaged|partial|cleared)$/.test(iceMineEnvironment?.brittleState ?? '')) {
      throw new Error(`Ice Mine brittle support runtime telemetry was not observable: ${JSON.stringify(iceMineEnvironment)}`);
    }
    if (iceMineEnvironment?.fractureVfx !== 'support-cracks+shard-burst+frost-pulse' || !/^(idle|cracking|collapsing|settled)$/.test(iceMineEnvironment?.fractureState ?? '')) {
      throw new Error(`Ice Mine fracture/collapse VFX telemetry was not observable: ${JSON.stringify(iceMineEnvironment)}`);
    }
    if (viewportMode === 'mobile-landscape' && iceMineEnvironment?.fractureDetail !== '4-shards+2-cracks+frost-pulse') {
      throw new Error(`Ice Mine mobile fracture VFX did not reduce detail: ${JSON.stringify(iceMineEnvironment)}`);
    }
    if (viewportMode === 'mobile-landscape' && !iceMineEnvironment?.bossAsset.includes('ice-mine-rhea-kade-lod2')) {
      throw new Error(`Rhea Kade mobile presentation did not select boss LOD2: ${JSON.stringify(iceMineEnvironment)}`);
    }
    console.log(`BROWSER_ICE_MINE_PASS viewport=${viewportMode} lod=${iceMineEnvironment?.lod} instances=${iceMineEnvironment?.instances} kit=${iceMineEnvironment?.kit} composition=${iceMineEnvironment?.composition} sequence=${iceMineEnvironment?.sequence} service=${iceMineEnvironment?.service} surface=${iceMineEnvironment?.surface} machinery=${iceMineEnvironment?.machinery} brittle=${iceMineEnvironment?.brittleState}:${iceMineEnvironment?.brittle} fracture=${iceMineEnvironment?.fractureState}:${iceMineEnvironment?.fractureDetail}:${iceMineEnvironment?.fractureSupports} boss=${iceMineEnvironment?.bossPresentation}:${iceMineEnvironment?.bossAsset}`);
  }

  if (targetLocation === 'solar-yard') {
    const solarExpectedByProfile = {
      full: {
        profile: 'full:lod1:structure-shadows-on',
        lod: '1',
        instanceBudget: 'deck:6+truss:5+radiator:4+reflector:3+machines:7+rail:3+crane:2+shutter:1',
        shadowCasters: 'solar-yard-structures+gameplay-actors',
        service: 'ceramic-deck:6+truss-frame:5+radiator-tower:4+thermal-shutter:1',
        surface: 'reflector-pylon:3+ceramic-deck:6',
        machinery: 'sinter-forge:2+printer-spindle:3+feedstock-press:2',
        transport: 'transfer-rail:3+gantry-crane:2',
        sunPatches: 'sun:3+shade:3',
        craneCount: 2,
      },
      balanced: {
        profile: 'balanced:lod1:structure-shadows-off',
        lod: '1',
        instanceBudget: 'deck:4+truss:3+radiator:2+reflector:3+machines:4+rail:2+crane:2+shutter:1',
        shadowCasters: 'gameplay-actors-only',
        service: 'ceramic-deck:4+truss-frame:3+radiator-tower:2+thermal-shutter:1',
        surface: 'reflector-pylon:3+ceramic-deck:4',
        machinery: 'sinter-forge:1+printer-spindle:2+feedstock-press:1',
        transport: 'transfer-rail:2+gantry-crane:2',
        sunPatches: 'sun:2+shade:2',
        craneCount: 2,
      },
      mobile: {
        profile: 'mobile:lod2:structure-shadows-off',
        lod: '2',
        instanceBudget: 'deck:4+truss:3+radiator:2+reflector:3+machines:4+rail:2+crane:2+shutter:1',
        shadowCasters: 'gameplay-actors-only',
        service: 'ceramic-deck:4+truss-frame:3+radiator-tower:2+thermal-shutter:1',
        surface: 'reflector-pylon:3+ceramic-deck:4',
        machinery: 'sinter-forge:1+printer-spindle:2+feedstock-press:1',
        transport: 'transfer-rail:2+gantry-crane:2',
        sunPatches: 'sun:2+shade:2',
        craneCount: 2,
      },
      performance: {
        profile: 'performance:lod2:structure-shadows-off',
        lod: '2',
        instanceBudget: 'deck:4+truss:3+radiator:2+reflector:3+machines:4+rail:2+crane:1+shutter:1',
        shadowCasters: 'gameplay-actors-only',
        service: 'ceramic-deck:4+truss-frame:3+radiator-tower:2+thermal-shutter:1',
        surface: 'reflector-pylon:3+ceramic-deck:4',
        machinery: 'sinter-forge:1+printer-spindle:2+feedstock-press:1',
        transport: 'transfer-rail:2+gantry-crane:1',
        sunPatches: 'sun:1+shade:1',
        craneCount: 1,
      },
    };
    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-solar-yard');
      return canvas?.dataset.environmentKit === 'ceramic-deck,truss-frame,radiator-tower,reflector-pylon,sinter-forge,printer-spindle,feedstock-press,transfer-rail,gantry-crane,thermal-shutter'
        && canvas?.dataset.environmentLandmark === 'gold-reflector-pylon-row'
        && canvas?.dataset.environmentComposition === 'shade-service-deck+fabrication-spine+sunward-work-yard'
        && canvas?.dataset.environmentZoneIdentity === 'shade:ceramic-deck+radiator-towers+thermal-shutter|spine:truss-frames+sinter-forges+transfer-rails+gantry-cranes|sunward:reflector-pylons+printer-spindles+feedstock-presses'
        && canvas?.dataset.readabilityLanguage === 'hard-sun-edge+cool-shade-mass+gold-reflectors+amber-hot-work+moving-gantry-cues'
        && canvas?.dataset.environmentSunShadow === 'hard-sun+cool-shade+long-shadow'
        && canvas?.dataset.environmentSunDirection === 'fixed-sunward-east-to-west'
        && /^(hard-sun|solar-surge)$/.test(canvas?.dataset.environmentSunMode ?? '')
        && /^(sun:[123]\\+shade:[123])$/.test(canvas?.dataset.environmentSunPatches ?? '')
        && /^(full|balanced|mobile|performance):lod[12]:structure-shadows-(on|off)$/.test(canvas?.dataset.environmentPerformanceProfile ?? '')
        && (canvas?.dataset.environmentInstanceBudget ?? '').includes('reflector:3')
        && ['solar-yard-structures+gameplay-actors', 'gameplay-actors-only'].includes(canvas?.dataset.environmentShadowCasters ?? '')
        && (canvas?.dataset.environmentServiceDetails ?? '').includes('thermal-shutter:1')
        && canvas?.dataset.environmentThermalShutters === 'authored:open'
        && /^(shutters-open|solar-surge-exposed)$/.test(canvas?.dataset.environmentThermalProtection ?? '')
        && canvas?.dataset.environmentThermalShutterControl === 'solar-shutter:state-linked'
        && (canvas?.dataset.environmentSurfaceDetail ?? '').includes('reflector-pylon:3')
        && (canvas?.dataset.environmentMachineDetail ?? '').includes('sinter-forge:')
        && (canvas?.dataset.environmentTransport ?? '').includes('transfer-rail:')
        && /^reciprocating-trolleys:[12]$/.test(canvas?.dataset.environmentCraneMotion ?? '')
        && /^-?\\d+\\.\\d{2}(,-?\\d+\\.\\d{2})?$/.test(canvas?.dataset.environmentCraneOffsets ?? '')
        && canvas?.dataset.bossBiome === 'solar-yard'
        && canvas?.dataset.bossPresentation === 'helios-9'
        && canvas?.dataset.bossVisual === 'authored'
        && (canvas?.dataset.bossAsset ?? '').includes('solar-yard-helios-9-lod')
        && canvas?.dataset.bossSilhouette === 'sunshield-crown+reflector-wings+fabricator-core'
        && canvas?.dataset.bossPalette === 'ceramic-white+solar-gold+heat-amber+overheat-red-phase-two'
        && !(canvas?.dataset.bossFallback ?? '')
        && Number(canvas?.dataset.environmentInstances) > 0
        && ['1', '2'].includes(canvas?.dataset.environmentLod ?? '');
    })()`, 'Solar Yard authored sun/shadow fabrication yard', 20_000);
    const solarYardEnvironment = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-solar-yard');
      return {
        lod: canvas?.dataset.environmentLod ?? '',
        instances: canvas?.dataset.environmentInstances ?? '',
        kit: canvas?.dataset.environmentKit ?? '',
        composition: canvas?.dataset.environmentComposition ?? '',
        service: canvas?.dataset.environmentServiceDetails ?? '',
        surface: canvas?.dataset.environmentSurfaceDetail ?? '',
        machinery: canvas?.dataset.environmentMachineDetail ?? '',
        transport: canvas?.dataset.environmentTransport ?? '',
        craneMotion: canvas?.dataset.environmentCraneMotion ?? '',
        craneOffsets: canvas?.dataset.environmentCraneOffsets ?? '',
        materials: canvas?.dataset.environmentMaterials ?? '',
        lighting: canvas?.dataset.environmentLighting ?? '',
        sunShadow: canvas?.dataset.environmentSunShadow ?? '',
        sunDirection: canvas?.dataset.environmentSunDirection ?? '',
        sunMode: canvas?.dataset.environmentSunMode ?? '',
        sunPatches: canvas?.dataset.environmentSunPatches ?? '',
        thermalShutters: canvas?.dataset.environmentThermalShutters ?? '',
        thermalProtection: canvas?.dataset.environmentThermalProtection ?? '',
        thermalControl: canvas?.dataset.environmentThermalShutterControl ?? '',
        shadowBudget: canvas?.dataset.environmentShadowBudget ?? '',
        tone: canvas?.dataset.environmentTone ?? '',
        bossAsset: canvas?.dataset.bossAsset ?? '',
        bossPresentation: canvas?.dataset.bossPresentation ?? '',
        bossPhaseVisual: canvas?.dataset.bossPhaseVisual ?? '',
        performanceProfile: canvas?.dataset.environmentPerformanceProfile ?? '',
        instanceBudget: canvas?.dataset.environmentInstanceBudget ?? '',
        shadowCasters: canvas?.dataset.environmentShadowCasters ?? '',
        renderTier: canvas?.dataset.renderTier ?? '',
      };
    })()`);
    const profileName = solarYardEnvironment?.performanceProfile?.split(':')[0] ?? '';
    const allowedProfiles = viewportMode === 'mobile-landscape' ? ['mobile', 'performance'] : ['full', 'balanced', 'mobile', 'performance'];
    if (!allowedProfiles.includes(profileName)) {
      throw new Error(`Solar Yard active profile is invalid for ${viewportMode}: ${JSON.stringify(solarYardEnvironment)}`);
    }
    const solarExpected = solarExpectedByProfile[profileName];
    if (!solarExpected) {
      throw new Error(`Solar Yard active profile has no QA contract: ${JSON.stringify(solarYardEnvironment)}`);
    }
    if (solarYardEnvironment?.lod !== solarExpected.lod || solarYardEnvironment?.performanceProfile !== solarExpected.profile) {
      throw new Error(`Solar Yard P3.13 adaptive LOD/profile regressed: ${JSON.stringify(solarYardEnvironment)}`);
    }
    if (solarYardEnvironment?.machinery !== solarExpected.machinery || solarYardEnvironment?.service !== solarExpected.service || solarYardEnvironment?.surface !== solarExpected.surface) {
      throw new Error(`Solar Yard adaptive authored budget was not observable: ${JSON.stringify(solarYardEnvironment)}`);
    }
    if (solarYardEnvironment?.instanceBudget !== solarExpected.instanceBudget || solarYardEnvironment?.shadowCasters !== solarExpected.shadowCasters) {
      throw new Error(`Solar Yard P3.13 render profile telemetry was not observable: ${JSON.stringify(solarYardEnvironment)}`);
    }
    if (solarYardEnvironment?.sunPatches !== solarExpected.sunPatches) {
      throw new Error(`Solar Yard P3.13 overlay density was not observable: ${JSON.stringify(solarYardEnvironment)}`);
    }
    if (solarYardEnvironment?.sunShadow !== 'hard-sun+cool-shade+long-shadow' || solarYardEnvironment?.sunDirection !== 'fixed-sunward-east-to-west') {
      throw new Error(`Solar Yard P3.9 sun/shadow identity was not observable: ${JSON.stringify(solarYardEnvironment)}`);
    }
    if (solarYardEnvironment?.thermalShutters !== 'authored:open' || solarYardEnvironment?.thermalControl !== 'solar-shutter:state-linked') {
      throw new Error(`Solar Yard P3.10 thermal shutter state linkage was not observable: ${JSON.stringify(solarYardEnvironment)}`);
    }
    const expectedCraneMotion = `reciprocating-trolleys:${solarExpected.craneCount}`;
    if (solarYardEnvironment?.transport !== solarExpected.transport || solarYardEnvironment?.craneMotion !== expectedCraneMotion) {
      throw new Error(`Solar Yard P3.11 transport telemetry was not observable: ${JSON.stringify(solarYardEnvironment)}`);
    }
    const initialCraneOffsets = solarYardEnvironment?.craneOffsets ?? '';
    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-solar-yard');
      const offsets = canvas?.dataset.environmentCraneOffsets ?? '';
      return Boolean(offsets) && offsets !== ${JSON.stringify(initialCraneOffsets)};
    })()`, 'Solar Yard gantry trolley motion', 5_000);
    if (viewportMode === 'mobile-landscape' && !solarYardEnvironment?.bossAsset.includes('solar-yard-helios-9-lod2')) {
      throw new Error(`HELIOS-9 mobile presentation did not select boss LOD2: ${JSON.stringify(solarYardEnvironment)}`);
    }
    console.log(`BROWSER_SOLAR_YARD_PASS viewport=${viewportMode} profile=${solarYardEnvironment?.performanceProfile} budget=${solarYardEnvironment?.instanceBudget} casters=${solarYardEnvironment?.shadowCasters} lod=${solarYardEnvironment?.lod} instances=${solarYardEnvironment?.instances} kit=${solarYardEnvironment?.kit} composition=${solarYardEnvironment?.composition} service=${solarYardEnvironment?.service} surface=${solarYardEnvironment?.surface} machinery=${solarYardEnvironment?.machinery} transport=${solarYardEnvironment?.transport}:${solarYardEnvironment?.craneMotion}:${solarYardEnvironment?.craneOffsets} shutters=${solarYardEnvironment?.thermalShutters}:${solarYardEnvironment?.thermalProtection}:${solarYardEnvironment?.thermalControl} materials=${solarYardEnvironment?.materials} lighting=${solarYardEnvironment?.lighting} sun=${solarYardEnvironment?.sunMode}:${solarYardEnvironment?.sunShadow}:${solarYardEnvironment?.sunDirection} patches=${solarYardEnvironment?.sunPatches} shadow=${solarYardEnvironment?.shadowBudget} tone=${solarYardEnvironment?.tone} boss=${solarYardEnvironment?.bossPresentation}:${solarYardEnvironment?.bossAsset} phase=${solarYardEnvironment?.bossPhaseVisual}`);
  }

  const coarseCombatSurface = await evaluate(`window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900`);
  const enemyHudReadability = await evaluate(`document.querySelector('canvas')?.dataset.enemyHudReadability ?? ''`);
  const expectedHudTier = coarseCombatSurface ? 'mobile-lod2|priority-bars+focused-tags' : 'desktop|full-bars+full-tags';
  const expectedEffectsMarker = viewportMode === 'mobile-landscape' ? 'reduced-effects:identity-preserved' : 'effects:full';
  if (!enemyHudReadability.startsWith(expectedHudTier)
    || !enemyHudReadability.includes('tells:telegraph+protocol+mutation+status+lifecycle')
    || !enemyHudReadability.includes(expectedEffectsMarker)) {
    throw new Error(`P13-G enemy HUD readability telemetry regressed for ${viewportMode}: ${enemyHudReadability}`);
  }
  console.log(`BROWSER_P13G_READABILITY_PASS viewport=${viewportMode} coarse=${coarseCombatSurface} policy=${enemyHudReadability}`);

  const expectedCombatLod = coarseCombatSurface ? '2' : '1';
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.dataset.operatorClassAsset === 'vanguard'
      && canvas?.dataset.operatorVisual === 'authored-${expectedCombatLod}'
      && (canvas?.dataset.operatorAsset ?? '').includes('operator-vanguard-lod${expectedCombatLod}')
      && (canvas?.dataset.weaponAsset ?? '').includes('weapon-breacher-lod${expectedCombatLod}');
  })()`, 'Vanguard authored mobile combat assets', 20_000);
  console.log(`BROWSER_MOBILE_ASSET_PASS viewport=${viewportMode} icons=loaded operatorLod=${expectedCombatLod} weaponLod=${expectedCombatLod}`);
  console.log(`BROWSER_CLASS_ASSET_PASS viewport=${viewportMode} operator=vanguard`);

  const combat = await snapshot();
  const combatGuidanceVisible = coarseCombatSurface
    ? await evaluate(`Boolean(document.querySelector('.transient-alert-lane[data-hud-layer="transient"]'))`)
    : (combat.text ?? '').toLowerCase().includes('field coach');
  if (!combatGuidanceVisible || combat.canvases < 1) {
    throw new Error(`Browser combat surface failed E2E validation: ${JSON.stringify({ ...combat, combatGuidanceVisible })}`);
  }
  await accessibilityAudit('combat');
  if (viewportMode === 'mobile-landscape') await mobileCombatLayoutAudit();
  await targetFeedbackAudit(viewportMode === 'mobile-landscape');

  if (pageExceptions.length > 0) {
    throw new Error(`Browser E2E observed uncaught page exceptions: ${JSON.stringify(pageExceptions)}`);
  }

  await captureScreenshot();
  console.log(`BROWSER_E2E_PASS title=${startup.title} route=command>operations>contracts>combat location=${targetLocation} input=keyboard viewport=${viewportMode} canvases=${combat.canvases}`);
} catch (error) {
  await captureScreenshot().catch(() => undefined);
  const state = await snapshot().catch(snapshotError => ({ snapshotError: String(snapshotError) }));
  console.error(`BROWSER_E2E_FAILURE state=${JSON.stringify(state)} exceptions=${JSON.stringify(pageExceptions)}`);
  throw error;
} finally {
  socket.close();
}
