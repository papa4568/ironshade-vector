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

async function mobileMenuLayoutAudit() {
  const audit = async syntheticSafeLeft => evaluate(`(() => {
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
    const hub = document.querySelector('.ship-hub');
    const railElement = document.querySelector('.command-rail');
    const previousSafeLeft = hub?.style.getPropertyValue('--command-safe-left') ?? '';
    const previousRailPaddingLeft = railElement?.style.paddingLeft ?? '';
    if (${syntheticSafeLeft ? 'true' : 'false'}) {
      hub?.style.setProperty('--command-safe-left', '48px');
      if (railElement) railElement.style.paddingLeft = '48px';
    }

    const rail = bounds(railElement);
    const workspace = bounds(document.querySelector('.tactical-workspace'));
    const primaryButtons = [...document.querySelectorAll('.command-rail-nav button')].filter(visible).map(button => ({
      label: button.textContent?.trim() ?? '',
      rect: bounds(button),
    }));
    const contentSurfaces = [
      ['header', bounds(document.querySelector('.tactical-header'))],
      ['resources', bounds(document.querySelector('.hub-resource-ribbon'))],
      ['priority', bounds(document.querySelector('.qol-priority-strip'))],
      ['status', bounds(document.querySelector('.ship-status'))],
      ['overview', bounds(document.querySelector('.command-overview'))],
    ].filter(([, rect]) => rect);
    const offscreen = primaryButtons.filter(item => item.rect && (item.rect.left < -1 || item.rect.top < -1 || item.rect.right > viewport.width + 1 || item.rect.bottom > viewport.height + 1)).map(item => item.label);
    const undersized = primaryButtons.filter(item => item.rect && item.rect.height < 40).map(item => item.label);
    const railOverflow = primaryButtons.filter(item => item.rect && rail && (item.rect.left < rail.left - 1 || item.rect.right > rail.right + 1)).map(item => item.label);
    const overlap = !!rail && !!workspace && !(rail.right <= workspace.left || workspace.right <= rail.left || rail.bottom <= workspace.top || workspace.bottom <= rail.top);
    const contentOverlap = rail ? contentSurfaces.filter(([, rect]) => rect && rect.left < rail.right - 1).map(([label]) => label) : [];
    const buildButton = document.querySelector('.tactical-header .hub-build-button');
    const deployButton = document.querySelector('.command-card.primary-card button');
    const buildFontSize = buildButton ? Number.parseFloat(getComputedStyle(buildButton).fontSize) : 0;
    const deployFontSize = deployButton ? Number.parseFloat(getComputedStyle(deployButton).fontSize) : 0;

    if (hub) {
      if (previousSafeLeft) hub.style.setProperty('--command-safe-left', previousSafeLeft);
      else hub.style.removeProperty('--command-safe-left');
    }
    if (railElement) railElement.style.paddingLeft = previousRailPaddingLeft;

    return {
      viewport,
      rail,
      workspace,
      primaryCount: primaryButtons.length,
      offscreen,
      undersized,
      railOverflow,
      overlap,
      contentOverlap,
      buildFontSize,
      deployFontSize,
      syntheticSafeLeft: ${syntheticSafeLeft ? 'true' : 'false'},
      landscape: viewport.width > viewport.height,
    };
  })()`);

  const result = await audit(false);
  const cutoutResult = await audit(true);

  const invalid = value => !value.rail || !value.workspace || value.primaryCount !== 5 || value.offscreen.length || value.undersized.length || value.railOverflow.length || value.overlap || value.contentOverlap.length || value.buildFontSize > 11 || value.deployFontSize > 11;
  if (!result.landscape || result.viewport.width > 900) throw new Error(`Mobile command audit did not run in the expected landscape viewport: ${JSON.stringify(result)}`);
  if (invalid(result)) throw new Error(`Mobile Tactical Command navigation failed viewport/touch checks: ${JSON.stringify(result)}`);
  if (invalid(cutoutResult)) throw new Error(`Mobile Tactical Command safe-area simulation failed: ${JSON.stringify(cutoutResult)}`);
  console.log(`BROWSER_MOBILE_MENU_PASS viewport=${Math.round(result.viewport.width)}x${Math.round(result.viewport.height)} destinations=${result.primaryCount} safe=onscreen+separated cutout=48px`);
  return result;
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
  console.log(`BROWSER_MOBILE_LAYOUT_PASS viewport=${Math.round(result.viewport.width)}x${Math.round(result.viewport.height)} touchButtons=${result.touchButtons} safe=onscreen+separated`);
  return result;
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
  if (viewportMode === 'mobile-landscape') await mobileMenuLayoutAudit();
  await captureScreenshot(commandScreenshotPath);

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
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('field coach') && document.querySelectorAll('canvas').length > 0`, 'Combat surface');
  await waitFor(`(() => {
    const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || '').trim());
    return ['Breach Rush', 'Fracture Tag', 'Bulwark Pulse'].every(label => labels.includes(label));
  })()`, 'Vanguard level-one skill kit');
  console.log(`BROWSER_CLASS_KIT_PASS viewport=${viewportMode} kit=RUSH/BREAK/GUARD`);
  await waitFor(`(() => {
    const icons = [...document.querySelectorAll('img[src*="/assets/ui/skills/"], img[src*="/assets/ui/weapons/"]')];
    return icons.length >= 4 && icons.every(image => image.complete && image.naturalWidth > 0);
  })()`, 'Mobile combat SVG assets', 20_000);
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
    console.log(`BROWSER_ICE_MINE_PASS viewport=${viewportMode} lod=${iceMineEnvironment?.lod} instances=${iceMineEnvironment?.instances} kit=${iceMineEnvironment?.kit} composition=${iceMineEnvironment?.composition} sequence=${iceMineEnvironment?.sequence} service=${iceMineEnvironment?.service} surface=${iceMineEnvironment?.surface} machinery=${iceMineEnvironment?.machinery} brittle=${iceMineEnvironment?.brittleState}:${iceMineEnvironment?.brittle}`);
  }

  const coarseCombatSurface = await evaluate(`window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900`);
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
  if (!(combat.text ?? '').toLowerCase().includes('field coach') || combat.canvases < 1) {
    throw new Error(`Browser combat surface failed E2E validation: ${JSON.stringify(combat)}`);
  }
  await accessibilityAudit('combat');
  if (viewportMode === 'mobile-landscape') await mobileCombatLayoutAudit();

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
