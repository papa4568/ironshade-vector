const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const timeoutMs = Number(process.env.ANDROID_SMOKE_TIMEOUT_MS ?? 75_000);
const startedAt = Date.now();
const resumeOnly = process.env.ANDROID_RESUME_CHECK === '1';
const plannerPersistenceOnly = process.env.ANDROID_PLANNER_PERSISTENCE_CHECK === '1';
const resumeProcessMode = process.env.ANDROID_RESUME_PROCESS_MODE ?? 'preserved';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function validRenderBudget(value) {
  if (typeof value !== 'string' || !value) return false;
  const parts = value.split('+');
  if (parts.length !== 7) return false;
  const fields = Object.fromEntries(parts.map(part => {
    const separator = part.indexOf(':');
    return separator > 0 ? [part.slice(0, separator), part.slice(separator + 1)] : ['', ''];
  }));
  const required = ['pixel', 'shadow', 'vfx', 'transparency', 'reflection', 'secondary', 'detail'];
  if (!required.every(key => Object.prototype.hasOwnProperty.call(fields, key))) return false;
  const pixel = Number(fields.pixel);
  const shadow = Number(fields.shadow);
  const vfx = Number(fields.vfx);
  const transparency = Number(fields.transparency);
  const reflection = Number(fields.reflection);
  const secondary = Number(fields.secondary);
  const detail = Number(fields.detail);
  return Number.isFinite(pixel) && pixel > 0 && pixel <= 1
    && Number.isInteger(shadow) && shadow >= 0 && shadow <= 2048
    && Number.isFinite(vfx) && vfx > 0 && vfx <= 1
    && Number.isFinite(transparency) && transparency > 0 && transparency <= 1
    && Number.isFinite(reflection) && reflection > 0 && reflection <= 1
    && Number.isFinite(secondary) && secondary > 0 && secondary <= 1
    && Number.isFinite(detail) && detail > 0 && detail <= 1;
}

if (typeof WebSocket !== 'function') {
  throw new Error('Node runtime does not expose WebSocket support required for Android runtime smoke testing.');
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
      reject(new Error('Timed out connecting to Android WebView CDP socket'));
    }, timeout);
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

function createSession(socket) {
  let requestId = 0;
  const pending = new Map();

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
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message ?? 'CDP request failed'));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => rejectPending(new Error('Android WebView CDP socket closed')));
  socket.addEventListener('error', () => rejectPending(new Error('Android WebView CDP socket failed')));

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
    close() {
      rejectPending(new Error('Android WebView CDP session closed'));
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
      const candidates = targets.filter(candidate => candidate.webSocketDebuggerUrl && (
        candidate.title === 'Ironshade Vector'
        || (/ironshade/i.test(candidate.title ?? '') && /localhost/i.test(candidate.url ?? ''))
      ));

      for (const target of candidates) {
        let session;
        try {
          const socket = await connect(target.webSocketDebuggerUrl, 4_000);
          session = createSession(socket);
          await session.call('Runtime.enable', {}, 4_000);
          const probe = await session.evaluate(`({ title: document.title, url: location.href, readyState: document.readyState })`, 4_000);
          if (probe?.title === 'Ironshade Vector' && /localhost/i.test(probe?.url ?? '')) {
            return { target, session };
          }
          lastError = new Error(`Android WebView target was not ready: ${JSON.stringify(probe)}`);
        } catch (error) {
          lastError = error;
        }
        session?.close();
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for responsive Android WebView CDP target; targets=${JSON.stringify(lastTargets)}${lastError ? ` error=${lastError}` : ''}`);
}

const { target, session } = await waitForResponsiveSession();
const { call, evaluate } = session;
console.log(`ANDROID_CDP_TARGET title=${JSON.stringify(target.title ?? '')} url=${JSON.stringify(target.url ?? '')}`);

async function snapshot() {
  return evaluate(`(() => ({
    readyState: document.readyState,
    title: document.title,
    url: location.href,
    text: (document.body?.innerText ?? '').slice(0, 1200),
    buttons: [...document.querySelectorAll('button')].map(button => button.getAttribute('aria-label') || button.textContent?.trim() || '').slice(0, 40),
    canvases: document.querySelectorAll('canvas').length,
  }))()`);
}

async function waitFor(predicateExpression, label, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  let lastEvaluationError = null;
  while (Date.now() < deadline) {
    try {
      const remaining = Math.max(500, deadline - Date.now());
      if (await evaluate(predicateExpression, Math.min(5_000, remaining))) return;
      lastEvaluationError = null;
    } catch (error) {
      // Android WebView can briefly expose a responsive CDP target and then
      // stall while the page finishes startup. Treat individual polling calls
      // as transient; the overall wait timeout remains the release gate.
      lastEvaluationError = error;
    }
    await sleep(300);
  }
  const state = await snapshot().catch(error => ({ snapshotError: String(error) }));
  const suffix = lastEvaluationError ? ` lastEvaluationError=${String(lastEvaluationError)}` : '';
  throw new Error(`Timed out waiting for ${label}; webview=${JSON.stringify(state)}${suffix}`);
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

async function buttonMetrics(label) {
  const target = JSON.stringify(label.toLowerCase());
  return evaluate(`(() => {
    const expected = ${target};
    const element = [...document.querySelectorAll('button')].find(candidate => (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLowerCase() === expected);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      disabled: Boolean(element.disabled),
    };
  })()`);
}

async function tapButton(label, id = 1, holdMs = 90) {
  const expected = JSON.stringify(label.toLowerCase());
  await evaluate(`(() => {
    const label = ${expected};
    const element = [...document.querySelectorAll('button')].find(candidate => (candidate.getAttribute('aria-label') || candidate.textContent || '').trim().toLowerCase() === label);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    if (rect.left < 0 || rect.top < 0 || rect.right > viewportWidth || rect.bottom > viewportHeight) {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    }
    return true;
  })()`);
  await sleep(180);
  const metrics = await buttonMetrics(label);
  if (!metrics || metrics.disabled) throw new Error(`Touch button unavailable: ${label}`);
  await dispatchTouch('touchStart', metrics.x, metrics.y, id);
  await sleep(holdMs);
  await dispatchTouch('touchEnd', metrics.x, metrics.y, id);
}

await call('Page.enable').catch(() => undefined);

if (plannerPersistenceOnly) {
  await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'cold-relaunched Ironshade document', 45_000);
  await waitFor(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    const targets = state?.profile?.operatorNetwork?.plannedTargetNodeIds;
    return state?.version === 4
      && state?.operatorNetworkSchemaVersion === 3
      && Array.isArray(targets)
      && targets.length === 2
      && targets[0] === 'ballistics-3'
      && targets[1] === 'mobility-1'
      && !state.profile.operatorNetwork.allocatedNodeIds.includes('ballistics-3')
      && !state.profile.operatorNetwork.allocatedNodeIds.includes('mobility-1')
      && state?.profile?.settings?.hudLayoutPreset === 'left-handed'
      && Math.abs(state.profile.settings.movementClusterInset - 0.35) < 0.001
      && Math.abs(state.profile.settings.movementClusterLift - 0.4) < 0.001
      && Math.abs(state.profile.settings.movementClusterScale - 1.04) < 0.001
      && Math.abs(state.profile.settings.actionClusterInset - 0.3) < 0.001
      && Math.abs(state.profile.settings.actionClusterLift - 0.25) < 0.001
      && Math.abs(state.profile.settings.actionClusterScale - 0.96) < 0.001;
  })()`, 'persisted Operator Network plan and P19-F HUD layout after cold relaunch', 45_000);

  await waitFor(`[...document.querySelectorAll('button[data-primary-area]')].some(button => (button.getAttribute('aria-label') || '').trim().toLowerCase() === 'operator')`, 'Command Deck after cold relaunch');
  await tapButton('Operator', 81);
  await waitFor(`[...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim().toLowerCase() === 'build')`, 'Operator build route after cold relaunch');
  await tapButton('Build', 82);
  await waitFor(`document.querySelector('.build-header h1')?.textContent?.trim() === 'Build'`, 'Build after cold relaunch');
  const progressionTabMarked = await evaluate(`(() => {
    const button = [...document.querySelectorAll('.build-tabs button')].find(candidate => (candidate.textContent || '').trim().toLowerCase().startsWith('progression'));
    if (!button) return false;
    button.dataset.p18ProgressionTab = 'true';
    button.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    return true;
  })()`);
  if (!progressionTabMarked) throw new Error('Android cold relaunch could not find the Progression tab.');
  await tap('button[data-p18-progression-tab="true"]', 82);
  await waitFor(`(() => {
    const text = document.querySelector('.network-plan-card')?.textContent ?? '';
    return text.includes('2 targets') && text.includes('Breach Doctrine') && text.includes('Servo Timing');
  })()`, 'restored multi-target plan UI after cold relaunch', 20_000);

  const persisted = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    return {
      version: state?.version,
      networkSchema: state?.operatorNetworkSchemaVersion,
      targets: state?.profile?.operatorNetwork?.plannedTargetNodeIds ?? [],
      allocated: state?.profile?.operatorNetwork?.allocatedNodeIds ?? [],
      hudLayout: state?.profile?.settings ? {
        preset: state.profile.settings.hudLayoutPreset,
        movementInset: state.profile.settings.movementClusterInset,
        movementLift: state.profile.settings.movementClusterLift,
        movementScale: state.profile.settings.movementClusterScale,
        actionInset: state.profile.settings.actionClusterInset,
        actionLift: state.profile.settings.actionClusterLift,
        actionScale: state.profile.settings.actionClusterScale,
      } : null,
    };
  })()`);
  console.log(`ANDROID_NETWORK_PLANNER_PERSISTENCE_PASS version=${persisted.version} schema=${persisted.networkSchema} targets=${persisted.targets.join('+')} relaunch=cold ui=restored nonDestructive=${persisted.allocated.includes('ballistics-3') || persisted.allocated.includes('mobility-1') ? 'false' : 'true'}`);
  console.log(`ANDROID_P19_HUD_LAYOUT_RELAUNCH_PASS preset=${persisted.hudLayout?.preset} movement=${persisted.hudLayout?.movementInset}/${persisted.hudLayout?.movementLift}/${persisted.hudLayout?.movementScale} action=${persisted.hudLayout?.actionInset}/${persisted.hudLayout?.actionLift}/${persisted.hudLayout?.actionScale} relaunch=cold`);
  session.close();
  await sleep(100);
  process.exit(0);
}

if (resumeOnly) {
  if (!['preserved', 'reclaimed'].includes(resumeProcessMode)) {
    throw new Error(`Unknown Android lifecycle process mode: ${resumeProcessMode}`);
  }
  await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'resumed Ironshade document', 45_000);
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas[data-render-tier]');
    return Boolean(
      canvas
      && document.querySelector('[aria-label="Touch combat controls"]')
      && document.querySelector('.move-stick')
      && document.querySelector('.fire-button')
      && document.querySelector('.dodge-button')
    );
  })()`, 'resumed Android combat surface', 45_000);

  const resumed = await evaluate(`(() => {
    const canvas = document.querySelector('canvas[data-render-tier]');
    return {
      tier: canvas?.dataset.renderTier ?? '',
      qualityMode: canvas?.dataset.graphicsQuality ?? '',
      budget: canvas?.dataset.renderBudget ?? '',
      environment: canvas?.dataset.environmentVisual ?? '',
      canvases: document.querySelectorAll('canvas').length,
      touch: Boolean(document.querySelector('[aria-label="Touch combat controls"]') && document.querySelector('.move-stick') && document.querySelector('.fire-button') && document.querySelector('.dodge-button')),
      hudLayout: (() => {
        const ui = document.querySelector('.touch-ui');
        const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
        return {
          preset: ui?.dataset.layoutPreset ?? '',
          movementInset: Number(ui?.dataset.movementInset ?? NaN),
          movementLift: Number(ui?.dataset.movementLift ?? NaN),
          movementScale: Number(ui?.dataset.movementScale ?? NaN),
          actionInset: Number(ui?.dataset.actionInset ?? NaN),
          actionLift: Number(ui?.dataset.actionLift ?? NaN),
          actionScale: Number(ui?.dataset.actionScale ?? NaN),
          savedPreset: state?.profile?.settings?.hudLayoutPreset ?? '',
        };
      })(),
    };
  })()`);
  if (resumed.qualityMode !== 'performance' || resumed.tier !== 'performance') {
    throw new Error(`Android resume did not preserve Performance graphics mode: ${JSON.stringify(resumed)}`);
  }
  if (!validRenderBudget(resumed.budget)) {
    throw new Error(`Android resume render budget telemetry is malformed: ${JSON.stringify(resumed)}`);
  }
  if (!resumed.touch || resumed.canvases < 1) {
    throw new Error(`Android resume did not restore combat/touch surfaces: ${JSON.stringify(resumed)}`);
  }
  const resumedLayout = resumed.hudLayout;
  if (resumedLayout.preset !== 'left-handed'
    || resumedLayout.savedPreset !== 'left-handed'
    || Math.abs(resumedLayout.movementInset - 0.35) > 0.001
    || Math.abs(resumedLayout.movementLift - 0.4) > 0.001
    || Math.abs(resumedLayout.movementScale - 1.04) > 0.001
    || Math.abs(resumedLayout.actionInset - 0.3) > 0.001
    || Math.abs(resumedLayout.actionLift - 0.25) > 0.001
    || Math.abs(resumedLayout.actionScale - 0.96) > 0.001) {
    throw new Error(`Android resume did not preserve the customized P19-F HUD layout: ${JSON.stringify(resumedLayout)}`);
  }
  console.log(`ANDROID_P19_HUD_LAYOUT_RESUME_PASS preset=${resumedLayout.preset} movement=${resumedLayout.movementInset}/${resumedLayout.movementLift}/${resumedLayout.movementScale} action=${resumedLayout.actionInset}/${resumedLayout.actionLift}/${resumedLayout.actionScale} process=${resumeProcessMode}`);
  console.log(`ANDROID_LIFECYCLE_RESUME_PASS process=${resumeProcessMode} mode=${resumed.qualityMode} tier=${resumed.tier} budget=${resumed.budget} environment=${resumed.environment} canvases=${resumed.canvases}`);
  session.close();
  await sleep(100);
  process.exit(0);
}
await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Ironshade document', 45_000);
await waitFor(`(() => {
  const text = (document.body?.innerText ?? '').toLowerCase();
  const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
  return text.includes('save recovery lock')
    || text.includes('operator intake')
    || ((text.includes('command ready') || text.includes('command deck')) && labels.includes('operations'));
})()`, 'interactive startup surface', 45_000);

const firstSurface = await snapshot();
if ((firstSurface.text ?? '').toLowerCase().includes('operator intake')) {
  const classLayout = await evaluate(`(() => {
    const root = document.querySelector('.class-intake');
    const shell = document.querySelector('.class-intake-shell');
    const confirm = document.querySelector('.class-confirm');
    const detail = document.querySelector('.class-selected-panel');
    const cards = [...document.querySelectorAll('.class-choice-card')];
    if (!root || !shell || !confirm || !detail || cards.length !== 3) return null;
    const viewport = {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    };
    const rect = element => {
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const confirmRect = rect(confirm);
    const detailRect = rect(detail);
    return {
      viewport,
      horizontalOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
      scrollTop: root.scrollTop,
      confirm: confirmRect,
      detail: detailRect,
      cardCount: cards.length,
      confirmOnscreen: confirmRect.left >= -1 && confirmRect.right <= viewport.width + 1 && confirmRect.top >= -1 && confirmRect.bottom <= viewport.height + 1,
      detailOnscreen: detailRect.left >= -1 && detailRect.right <= viewport.width + 1,
    };
  })()`);
  if (!classLayout || classLayout.horizontalOverflow > 2 || classLayout.scrollTop !== 0 || !classLayout.detailOnscreen || !classLayout.confirmOnscreen) {
    throw new Error(`Android class selection layout is not first-screen safe: ${JSON.stringify(classLayout)}`);
  }
  console.log(`ANDROID_CLASS_SELECTION_LAYOUT_PASS viewport=${Math.round(classLayout.viewport.width)}x${Math.round(classLayout.viewport.height)} horizontalOverflow=${classLayout.horizontalOverflow}px confirm=onscreen`);
  await tapButton('Select Vanguard class', 11);
  await tapButton('Confirm Vanguard', 12);
  await waitFor(`(() => {
    const text = (document.body?.innerText ?? '').toLowerCase();
    const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
    return (text.includes('command ready') || text.includes('command deck')) && labels.includes('operations');
  })()`, 'Command deck after class selection', 45_000);
  console.log('ANDROID_CLASS_SELECTION_PASS class=Vanguard');
}

const startup = await snapshot();
const startupText = startup.text ?? '';
if (startupText.toLowerCase().includes('save recovery lock')) {
  throw new Error(`Android startup entered save recovery lock: ${JSON.stringify(startup)}`);
}
const startupButtons = startup.buttons ?? [];
if (startup.title !== 'Ironshade Vector' || !(startupText.toLowerCase().includes('command ready') || startupText.toLowerCase().includes('command deck')) || !startupButtons.some(label => label.toLowerCase() === 'operations')) {
  throw new Error(`Unexpected Android startup surface: ${JSON.stringify(startup)}`);
}

const commandLayout = await evaluate(`(() => {
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
  const rail = bounds(document.querySelector('.command-rail'));
  const workspaceElement = document.querySelector('.tactical-workspace');
  const workspace = bounds(workspaceElement);
  const overview = bounds(document.querySelector('.command-overview'));
  const primaryButtons = [...document.querySelectorAll('.command-rail-nav button')].filter(visible).map(button => ({
    label: button.getAttribute('aria-label') || button.textContent?.trim() || '',
    rect: bounds(button),
  }));
  const offscreen = primaryButtons.filter(item => item.rect && (item.rect.left < -1 || item.rect.top < -1 || item.rect.right > viewport.width + 1 || item.rect.bottom > viewport.height + 1)).map(item => item.label);
  const undersized = primaryButtons.filter(item => item.rect && item.rect.height < 40).map(item => item.label);
  const overlap = !!rail && !!workspace && !(rail.right <= workspace.left || workspace.right <= rail.left || rail.bottom <= workspace.top || workspace.bottom <= rail.top);
  const verticalOverflow = workspaceElement ? workspaceElement.scrollHeight - workspaceElement.clientHeight : null;
  const scrollTop = workspaceElement?.scrollTop ?? null;
  return { viewport, rail, workspace, overview, primaryCount: primaryButtons.length, offscreen, undersized, overlap, verticalOverflow, scrollTop, landscape: viewport.width > viewport.height };
})()`);
const commandDoesNotFit = commandLayout.verticalOverflow === null
  || commandLayout.verticalOverflow > 2
  || commandLayout.scrollTop !== 0
  || !commandLayout.overview
  || commandLayout.overview.bottom > commandLayout.workspace.bottom + 2;
if (!commandLayout.landscape || !commandLayout.rail || !commandLayout.workspace || commandLayout.primaryCount !== 5 || commandLayout.offscreen.length || commandLayout.undersized.length || commandLayout.overlap || commandDoesNotFit) {
  throw new Error(`Android Tactical Command navigation/fit failed viewport checks: ${JSON.stringify(commandLayout)}`);
}
console.log(`ANDROID_MOBILE_MENU_PASS viewport=${Math.round(commandLayout.viewport.width)}x${Math.round(commandLayout.viewport.height)} destinations=${commandLayout.primaryCount} safe=onscreen+separated overflow=${Math.max(0, commandLayout.verticalOverflow)}px`);

await tapButton('Operator', 31);
await waitFor(`Boolean(document.querySelector('.ship-hub.area-operator') && [...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim() === 'Build'))`, 'Android compact Operator build route');
await tapButton('Build', 32);
await waitFor(`(() => {
  const text = document.body?.innerText ?? '';
  const buttons = [...document.querySelectorAll('button')].map(button => (button.textContent || '').trim());
  return document.querySelector('.build-header h1')?.textContent?.trim() === 'Build' && buttons.includes('Skills');
})()`, 'Android Build surface for skill hierarchy');
await waitFor(`Boolean(document.querySelector('.build-bay.iv-view') && document.querySelector('.build-header.iv-panel.iv-panel--glass') && document.querySelector('.build-tabs button[aria-current="page"]'))`, 'Android P15-B shared Build shell');

const p19ArmoryCardScan = await evaluate(`(() => {
  const storageCards = [...document.querySelectorAll('.inventory-card')].filter(card => card.getBoundingClientRect().width > 0);
  const equippedCards = [...document.querySelectorAll('.equipped-card')].filter(card => card.getBoundingClientRect().width > 0);
  if (!storageCards.length || !equippedCards.length) return null;
  const readableSize = element => element ? Number.parseFloat(getComputedStyle(element).fontSize) : 0;
  const storage = storageCards.map(card => ({
    state: card.getAttribute('data-requirement-state'),
    hasRarity: Boolean(card.querySelector('.rarity-pill')),
    hasEffect: Boolean(card.querySelector('.item-effect-preview')),
    hasDecision: Boolean(card.querySelector('.inventory-card-decision[data-requirement-state]')),
    hasDelta: Boolean(card.querySelector('.inventory-card-delta')),
    hasDepthStack: Boolean(card.querySelector('.item-depth-line')),
    effectFont: readableSize(card.querySelector('.item-effect-preview')),
    decisionFont: readableSize(card.querySelector('.inventory-card-decision > span')),
    deltaFont: readableSize(card.querySelector('.inventory-card-delta')),
  }));
  const equipped = equippedCards.filter(card => card.querySelector('.rarity-pill')).map(card => ({
    state: card.getAttribute('data-requirement-state'),
    hasEffect: Boolean(card.querySelector('.item-effect-preview')),
    hasDecision: Boolean(card.querySelector('.inventory-card-decision[data-requirement-state]')),
    hasDelta: Boolean(card.querySelector('.inventory-card-delta')),
    effectFont: readableSize(card.querySelector('.item-effect-preview')),
    decisionFont: readableSize(card.querySelector('.inventory-card-decision > span')),
  }));
  return {
    storageCount: storage.length,
    equippedCount: equipped.length,
    blockedStorageCount: storage.filter(card => card.state === 'blocked').length,
    storageDecisionFirst: storage.every(card => card.hasRarity && card.hasEffect && card.hasDecision && card.hasDelta && !card.hasDepthStack),
    equippedDecisionFirst: equipped.length > 0 && equipped.every(card => card.state === 'active' && card.hasEffect && card.hasDecision && card.hasDelta),
    minReadableFont: Math.min(...storage.flatMap(card => [card.effectFont, card.decisionFont, card.deltaFont]), ...equipped.flatMap(card => [card.effectFont, card.decisionFont])),
  };
})()`);
if (!p19ArmoryCardScan
  || !p19ArmoryCardScan.storageDecisionFirst
  || !p19ArmoryCardScan.equippedDecisionFirst
  || p19ArmoryCardScan.blockedStorageCount < 1
  || p19ArmoryCardScan.minReadableFont < 11.5) {
  throw new Error(`Android P19-D decision-first Armory card scan failed: ${JSON.stringify(p19ArmoryCardScan)}`);
}


const p18GearStorageCandidate = await evaluate(`(() => {
  const card = [...document.querySelectorAll('.inventory-card')].find(candidate => {
    const slot = candidate.querySelector('small')?.textContent ?? '';
    return slot.includes('Carbine') || slot.includes('Rail Lance');
  });
  if (!(card instanceof HTMLButtonElement)) return null;
  card.dataset.p18GearStorageCandidate = 'true';
  card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  return card.textContent?.trim() ?? '';
})()`);
if (!p18GearStorageCandidate) throw new Error('Android P18-E could not find an off-class weapon in ship storage.');
await sleep(180);
await tap('button[data-p18-gear-storage-candidate="true"]', 87);
await waitFor(`(() => {
  const requirement = document.querySelector('.item-inspector .iv-requirement--blocked');
  const action = document.querySelector('.item-inspector .inspector-actions .primary');
  const text = requirement?.textContent ?? '';
  return Boolean(
    document.querySelector('.item-inspector.open')
    && document.querySelector('.gear-quick-read')
    && document.querySelector('.quick-loadout-impact .impact-grid--quick')
    && requirement
    && text.includes('Class-family armament locked')
    && text.includes('Why blocked:')
    && text.includes('Next:')
    && action instanceof HTMLButtonElement
    && action.disabled
  );
})()`, 'Android P18-E blocked storage comparison');
const p18GearDecisionLayout = await evaluate(`(() => {
  const scroll = document.querySelector('.item-inspector .inspector-scroll');
  const requirement = document.querySelector('.item-inspector .iv-requirement');
  const effect = document.querySelector('.item-inspector .gear-quick-read');
  const firstStat = document.querySelector('.item-inspector .impact-grid--quick .impact-stat');
  const action = document.querySelector('.item-inspector .inspector-actions .primary');
  if (!scroll || !requirement || !effect || !firstStat || !(action instanceof HTMLButtonElement)) return null;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const scrollRect = scroll.getBoundingClientRect();
  const requirementRect = requirement.getBoundingClientRect();
  const effectRect = effect.getBoundingClientRect();
  const statRect = firstStat.getBoundingClientRect();
  const actionRect = action.getBoundingClientRect();
  return {
    scrollTop: scroll.scrollTop,
    requirementVisible: requirementRect.top >= scrollRect.top - 2 && requirementRect.bottom <= scrollRect.bottom + 2,
    effectVisible: effectRect.top < scrollRect.bottom - 2 && effectRect.bottom > scrollRect.top + 2,
    firstStatVisible: statRect.top < scrollRect.bottom - 2 && statRect.bottom > scrollRect.top + 2,
    actionVisible: actionRect.top >= -1 && actionRect.bottom <= viewportHeight + 1,
    expertMounted: Boolean(document.querySelector('.item-inspector .explicit-modifiers-panel') || document.querySelector('.item-inspector .augment-layer-panel') || document.querySelector('.item-inspector .advanced-identity-grid')),
  };
})()`);
if (!p18GearDecisionLayout || p18GearDecisionLayout.scrollTop !== 0 || !p18GearDecisionLayout.requirementVisible || !p18GearDecisionLayout.effectVisible || !p18GearDecisionLayout.firstStatVisible || !p18GearDecisionLayout.actionVisible || p18GearDecisionLayout.expertMounted) {
  throw new Error(`Android P18-E decision-first layout failed: ${JSON.stringify(p18GearDecisionLayout)}`);
}
await tapButton('Details', 88);
await waitFor(`(() => {
  const sheet = document.querySelector('.iv-disclosure-sheet.gear-details-sheet[role="dialog"][aria-modal="true"]');
  const text = sheet?.textContent ?? '';
  return Boolean(
    sheet
    && text.includes('EXPLICIT MODIFIERS')
    && text.includes('AUGMENTS')
    && text.includes('GENERATED BUILD LINKS')
    && text.includes('PROVENANCE / REGISTRY')
    && document.querySelector('.gear-details-sheet .advanced-identity-grid')
  );
})()`, 'Android P18-E expert gear Details sheet');
await tapButton('Close details', 89);
await waitFor(`!document.querySelector('.iv-disclosure-sheet.gear-details-sheet')`, 'Android P18-E Details close');
await tapButton('Back to ship storage', 90);
await waitFor(`!document.querySelector('.item-inspector.open')`, 'Android P18-E storage return');

const p18GearEquippedSuit = await evaluate(`(() => {
  const card = [...document.querySelectorAll('.equipped-card')].find(candidate => (candidate.querySelector('small')?.textContent ?? '').trim() === 'Combat Suit');
  if (!(card instanceof HTMLButtonElement)) return null;
  card.dataset.p18GearEquippedSuit = 'true';
  card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  return card.querySelector('b')?.textContent?.trim() ?? '';
})()`);
if (!p18GearEquippedSuit || p18GearEquippedSuit === 'Empty') throw new Error('Android P18-E could not find the equipped Combat Suit.');
await sleep(180);
await tap('button[data-p18-gear-equipped-suit="true"]', 91);
await waitFor(`(() => {
  const requirement = document.querySelector('.item-inspector .iv-requirement--active');
  const unequip = [...document.querySelectorAll('.item-inspector .inspector-actions button')].find(button => (button.textContent || '').trim() === 'Unequip');
  return Boolean(requirement && (requirement.textContent ?? '').includes('Equipped in Combat Suit') && unequip);
})()`, 'Android P18-E active Combat Suit decision');
await tapButton('Unequip', 92);
await waitFor(`(() => {
  const requirement = document.querySelector('.item-inspector .iv-requirement--ready');
  const equip = [...document.querySelectorAll('.item-inspector .inspector-actions button')].find(button => (button.textContent || '').trim() === 'Equip Combat Suit');
  return Boolean(requirement && (requirement.textContent ?? '').includes('Ready to equip Combat Suit') && equip && !equip.disabled);
})()`, 'Android P18-E unequipped Combat Suit ready state');

const p18GearRestoreCard = await evaluate(`(() => {
  const expectedName = ${JSON.stringify(p18GearEquippedSuit)};
  const card = [...document.querySelectorAll('.inventory-card')].find(candidate => {
    const slot = candidate.querySelector('small')?.textContent ?? '';
    const name = candidate.querySelector('b')?.textContent?.trim() ?? '';
    return slot.includes('Combat Suit') && name === expectedName;
  });
  if (!(card instanceof HTMLButtonElement)) return null;
  card.dataset.p18GearRestoreCard = 'true';
  card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  return card.textContent?.trim() ?? '';
})()`);
if (!p18GearRestoreCard) throw new Error('Android P18-E unequipped Combat Suit did not return to ship storage.');
await sleep(180);
await tap('button[data-p18-gear-restore-card="true"]', 93);
await tapButton('Equip Combat Suit', 94);
await waitFor(`(() => {
  const requirement = document.querySelector('.item-inspector .iv-requirement--active');
  const unequip = [...document.querySelectorAll('.item-inspector .inspector-actions button')].find(button => (button.textContent || '').trim() === 'Unequip');
  const equippedBadge = document.querySelector('.item-inspector .equipped-badge');
  return Boolean(requirement && unequip && equippedBadge);
})()`, 'Android P18-E Combat Suit re-equip');
console.log(`ANDROID_P18_GEAR_INSPECTOR_PASS storage=off-class compare=quick-read blocker=class-family details=shared-sheet equip=support-slot-restored viewportDecision=top-level candidate=${JSON.stringify(p18GearStorageCandidate)}`);
await tapButton('Back to ship storage', 95);
await waitFor(`!document.querySelector('.item-inspector.open')`, 'Android P18-E inspector close after equip restore');
await waitFor(`[...document.querySelectorAll('button')].some(button => (button.textContent || '').trim() === 'How equipment discovery works')`, 'Android P18-D disclosure trigger');
const p18NativeViewport = await evaluate(`({ width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight })`);
await tapButton('How equipment discovery works', 83);
await waitFor(`Boolean(document.querySelector('.iv-disclosure-sheet[role="dialog"][aria-modal="true"]') && document.querySelector('.iv-disclosure-sheet__close'))`, 'Android P18-D landscape disclosure');
const p18LandscapeDisclosure = await evaluate(`(() => {
  const sheet = document.querySelector('.iv-disclosure-sheet');
  const close = document.querySelector('.iv-disclosure-sheet__close');
  if (!sheet || !close) return null;
  const sheetRect = sheet.getBoundingClientRect();
  const closeRect = close.getBoundingClientRect();
  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;
  return {
    width,
    height,
    sheet: { left: sheetRect.left, top: sheetRect.top, right: sheetRect.right, bottom: sheetRect.bottom },
    close: { width: closeRect.width, height: closeRect.height },
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - width),
  };
})()`);
if (!p18LandscapeDisclosure
  || p18LandscapeDisclosure.width <= p18LandscapeDisclosure.height
  || p18LandscapeDisclosure.sheet.left < -2
  || p18LandscapeDisclosure.sheet.top < -2
  || p18LandscapeDisclosure.sheet.right > p18LandscapeDisclosure.width + 2
  || p18LandscapeDisclosure.sheet.bottom > p18LandscapeDisclosure.height + 2
  || p18LandscapeDisclosure.close.width < 40
  || p18LandscapeDisclosure.close.height < 40
  || p18LandscapeDisclosure.horizontalOverflow > 2) {
  throw new Error(`Android P18-D landscape disclosure layout failed: ${JSON.stringify(p18LandscapeDisclosure)}`);
}
console.log(`ANDROID_P18_DISCLOSURE_LANDSCAPE_PASS viewport=${Math.round(p18LandscapeDisclosure.width)}x${Math.round(p18LandscapeDisclosure.height)} touch=trigger+close safe=onscreen`);
await tapButton('Close details', 84);
await waitFor(`!document.querySelector('.iv-disclosure-sheet')`, 'Android P18-D landscape disclosure close');

await call('Emulation.setDeviceMetricsOverride', {
  width: 720,
  height: 1080,
  deviceScaleFactor: 1,
  mobile: true,
  screenWidth: 720,
  screenHeight: 1080,
  screenOrientation: { type: 'portraitPrimary', angle: 0 },
});
await sleep(220);
await tapButton('How equipment discovery works', 85);
await waitFor(`Boolean(document.querySelector('.iv-disclosure-sheet[role="dialog"][aria-modal="true"]'))`, 'Android P18-D portrait disclosure');
const p18PortraitDisclosure = await evaluate(`(() => {
  const sheet = document.querySelector('.iv-disclosure-sheet');
  const close = document.querySelector('.iv-disclosure-sheet__close');
  if (!sheet || !close) return null;
  const sheetRect = sheet.getBoundingClientRect();
  const closeRect = close.getBoundingClientRect();
  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;
  return {
    width,
    height,
    sheet: { left: sheetRect.left, top: sheetRect.top, right: sheetRect.right, bottom: sheetRect.bottom },
    close: { width: closeRect.width, height: closeRect.height },
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - width),
  };
})()`);
if (!p18PortraitDisclosure
  || p18PortraitDisclosure.width >= p18PortraitDisclosure.height
  || p18PortraitDisclosure.sheet.left < -2
  || p18PortraitDisclosure.sheet.top < -2
  || p18PortraitDisclosure.sheet.right > p18PortraitDisclosure.width + 2
  || p18PortraitDisclosure.sheet.bottom > p18PortraitDisclosure.height + 2
  || p18PortraitDisclosure.close.width < 40
  || p18PortraitDisclosure.close.height < 40
  || p18PortraitDisclosure.horizontalOverflow > 2) {
  throw new Error(`Android P18-D portrait disclosure layout failed: ${JSON.stringify(p18PortraitDisclosure)}`);
}
console.log(`ANDROID_P18_DISCLOSURE_PORTRAIT_PASS viewport=${Math.round(p18PortraitDisclosure.width)}x${Math.round(p18PortraitDisclosure.height)} touch=trigger safe=onscreen`);
await evaluate(`history.back()`);
await waitFor(`(() => {
  const active = document.activeElement;
  return !document.querySelector('.iv-disclosure-sheet')
    && active instanceof HTMLButtonElement
    && (active.textContent || '').trim() === 'How equipment discovery works';
})()`, 'Android P18-D history-back dismissal and focus restore');
console.log('ANDROID_P18_DISCLOSURE_BACK_PASS navigation=history-back focus=restored');
await call('Emulation.clearDeviceMetricsOverride');
await sleep(220);
const p18RestoredViewport = await evaluate(`({ width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight })`);
if (p18RestoredViewport.width <= p18RestoredViewport.height || Math.abs(p18RestoredViewport.width - p18NativeViewport.width) > 4 || Math.abs(p18RestoredViewport.height - p18NativeViewport.height) > 4) {
  throw new Error(`Android P18-D viewport restoration failed native=${JSON.stringify(p18NativeViewport)} restored=${JSON.stringify(p18RestoredViewport)}`);
}
const p19GuideMetrics = async () => evaluate(`(() => {
  const root = document.querySelector('.guide-panel');
  const section = document.querySelector('[data-guide-section="equipment-rarity"]');
  const navButtons = [...document.querySelectorAll('.guide-section-nav button')].filter(button => button.getBoundingClientRect().width > 0);
  const copy = [...document.querySelectorAll('.guide-topic p, .guide-topic li')].filter(element => element.getBoundingClientRect().width > 0);
  if (!root || !section || !navButtons.length || !copy.length) return null;
  const rootRect = root.getBoundingClientRect();
  const viewport = { width: window.visualViewport?.width ?? innerWidth, height: window.visualViewport?.height ?? innerHeight };
  return {
    viewport,
    root: { left: rootRect.left, top: rootRect.top, right: rootRect.right, bottom: rootRect.bottom },
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - viewport.width),
    minNavHeight: Math.min(...navButtons.map(button => button.getBoundingClientRect().height)),
    minCopyFont: Math.min(...copy.map(element => Number.parseFloat(getComputedStyle(element).fontSize))),
  };
})()`);
const assertP19GuideMetrics = (value, label) => {
  if (!value
    || value.horizontalOverflow > 2
    || value.root.left < -2
    || value.root.right > value.viewport.width + 2
    || value.minNavHeight < 40
    || value.minCopyFont < 11.5) {
    throw new Error('Android P19-C Guide layout failed (' + label + '): ' + JSON.stringify(value));
  }
};

await tapButton('Open Guide // Equipment & Rarity', 86);
await waitFor(`Boolean(document.querySelector('.ship-hub.area-intel') && document.querySelector('.section-tabs button[aria-current="page"]')?.textContent?.includes('Guide') && document.querySelector('[data-guide-section="equipment-rarity"]'))`, 'Android P19-C Equipment Guide deep-link');
const p19GuideLandscape = await p19GuideMetrics();
assertP19GuideMetrics(p19GuideLandscape, 'native landscape');

await evaluate(`(() => { const root = document.documentElement; globalThis.__p19GuideTextScale = root.dataset.textScale ?? ''; root.dataset.textScale = 'large'; return true; })()`);
await sleep(120);
const p19GuideLarge = await p19GuideMetrics();
assertP19GuideMetrics(p19GuideLarge, 'large text');
if (p19GuideLarge.minCopyFont <= p19GuideLandscape.minCopyFont) throw new Error('Android P19-C Guide Large text did not increase readable copy size.');

await call('Emulation.setDeviceMetricsOverride', {
  width: 412,
  height: 915,
  deviceScaleFactor: 2.5,
  mobile: true,
  screenWidth: 412,
  screenHeight: 915,
  screenOrientation: { type: 'portraitPrimary', angle: 0 },
});
await sleep(220);
const p19GuidePortrait = await p19GuideMetrics();
assertP19GuideMetrics(p19GuidePortrait, 'portrait');

await call('Emulation.clearDeviceMetricsOverride');
await sleep(220);
await evaluate(`(() => { const root = document.documentElement; const previous = globalThis.__p19GuideTextScale; if (previous) root.dataset.textScale = previous; else delete root.dataset.textScale; delete globalThis.__p19GuideTextScale; return true; })()`);
await evaluate(`history.back()`);
await waitFor(`(() => {
  const active = document.activeElement;
  return Boolean(document.querySelector('.build-bay.iv-view'))
    && active instanceof HTMLButtonElement
    && active.getAttribute('data-guide-link') === 'equipment-rarity';
})()`, 'Android P19-C Guide history-back and Build focus restore');
console.log('ANDROID_P19_GUIDE_DEEPLINK_PASS section=equipment-rarity touch=link back=history+focus text=large rotation=landscape+portrait safe=onscreen');
console.log(`ANDROID_P19_ARMORY_CARD_PASS storage=${p19ArmoryCardScan.storageCount} equipped=${p19ArmoryCardScan.equippedCount} blocked=${p19ArmoryCardScan.blockedStorageCount} fontFloor=${p19ArmoryCardScan.minReadableFont.toFixed(1)}px compare=quick-read details=shared-sheet equip=restored guide=equipment-rarity`);

await tapButton('Crafting', 32);
await waitFor(`Boolean(document.querySelector('.reconstruction-panel .reconstruction-top.iv-panel.iv-panel--glass') && document.querySelector('.reconstruct-storage.iv-panel') && document.querySelector('.build-tabs button[aria-current="page"]')?.textContent?.includes('Crafting'))`, 'Android P15-B Crafting surface');
const p19CraftingHierarchy = await evaluate(`(() => {
  const root = document.querySelector('[data-management-surface="crafting"]');
  const requirement = root?.querySelector('.reconstruction-bench > .iv-requirement[data-requirement-state]');
  const guide = root?.querySelector('button[data-guide-link="crafting"]');
  const oldHelp = [...(root?.querySelectorAll('button') ?? [])].some(button => (button.textContent || '').trim() === 'How Reconstruction rules work');
  const visible = element => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const copy = [...(root?.querySelectorAll('.iv-requirement__state small, .iv-requirement__copy span, .bench-actions button small, .precision-target small') ?? [])].filter(visible);
  const costLabels = [...(root?.querySelectorAll('.bench-actions button small, .precision-target small, .add-mod-row button small, .augment-bench button small') ?? [])].filter(visible);
  const state = requirement?.getAttribute('data-requirement-state') ?? '';
  const requirementText = requirement?.textContent ?? '';
  return {
    root: Boolean(root),
    guide: Boolean(guide),
    oldHelp,
    state,
    blockerExplained: state !== 'blocked' || (requirementText.includes('Why blocked:') && requirementText.includes('Next:')),
    costVisible: costLabels.some(label => /\\d|no salvage cost|credit|alloy|circuit|component|trace/i.test(label.textContent ?? '')),
    minFont: copy.length ? Math.min(...copy.map(element => Number.parseFloat(getComputedStyle(element).fontSize))) : 0,
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  };
})()`);
if (!p19CraftingHierarchy.root
  || !p19CraftingHierarchy.guide
  || p19CraftingHierarchy.oldHelp
  || !['ready', 'blocked'].includes(p19CraftingHierarchy.state)
  || !p19CraftingHierarchy.blockerExplained
  || !p19CraftingHierarchy.costVisible
  || p19CraftingHierarchy.minFont < 11.5
  || p19CraftingHierarchy.horizontalOverflow > 2) {
  throw new Error(`Android P19-E Crafting hierarchy failed: ${JSON.stringify(p19CraftingHierarchy)}`);
}
console.log(`ANDROID_P18F_CRAFTING_REQUIREMENT_PASS state=${p19CraftingHierarchy.state} classFamily=visible microforge=visible sockets=visible guide=crafting`);

const p19ManagementControllerSetup = await evaluate(`(() => {
  const original = typeof navigator.getGamepads === 'function' ? navigator.getGamepads.bind(navigator) : null;
  globalThis.__p19ManagementOriginalGetGamepads = original;
  globalThis.__p19ManagementGamepad = {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  };
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [globalThis.__p19ManagementGamepad] });
  return true;
})()`);
if (!p19ManagementControllerSetup) throw new Error('Android P19-E could not install management controller.');
await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[13]; button.pressed = true; button.value = 1; return true; })()`);
await waitFor(`Boolean(document.activeElement?.closest?.('[data-crafting-surface="true"]'))`, 'Android P19-E Crafting controller D-pad focus');
await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[13]; button.pressed = false; button.value = 0; return true; })()`);
await sleep(120);
if (p19CraftingHierarchy.state === 'blocked') {
  const guideFocused = await evaluate(`(() => {
    const guide = document.querySelector('[data-crafting-surface="true"] button[data-guide-link="crafting"]');
    if (!(guide instanceof HTMLButtonElement)) return false;
    guide.focus();
    return document.activeElement === guide;
  })()`);
  if (!guideFocused) throw new Error('Android P19-E blocked Crafting state could not focus the contextual Guide action.');
  await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[0]; button.pressed = true; button.value = 1; return true; })()`);
  await waitFor(`Boolean(document.querySelector('.ship-hub.area-intel') && document.querySelector('[data-guide-section="crafting"]'))`, 'Android P19-E Crafting controller A opens Guide');
  await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[0]; button.pressed = false; button.value = 0; return true; })()`);
  await sleep(120);
  await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[1]; button.pressed = true; button.value = 1; return true; })()`);
  await waitFor(`(() => {
    const active = document.activeElement;
    return Boolean(document.querySelector('[data-management-surface="crafting"]'))
      && active instanceof HTMLButtonElement
      && active.getAttribute('data-guide-link') === 'crafting';
  })()`, 'Android P19-E Crafting controller B returns from Guide');
  await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[1]; button.pressed = false; button.value = 0; return true; })()`);
  await sleep(120);
} else {
  const previewFocused = await evaluate(`(() => {
    const action = document.querySelector('[data-crafting-surface="true"] .bench-frame button:not(:disabled)');
    if (!(action instanceof HTMLButtonElement)) return false;
    action.focus();
    return document.activeElement === action;
  })()`);
  if (!previewFocused) throw new Error('Android P19-E ready Crafting state could not focus a legal preview action.');
  await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[0]; button.pressed = true; button.value = 1; return true; })()`);
  await waitFor(`Boolean(document.querySelector('.craft-review'))`, 'Android P19-E Crafting controller A opens review');
  await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[0]; button.pressed = false; button.value = 0; return true; })()`);
  await sleep(120);
  await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[1]; button.pressed = true; button.value = 1; return true; })()`);
  await waitFor(`!document.querySelector('.craft-review')`, 'Android P19-E Crafting controller B closes review');
  await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[1]; button.pressed = false; button.value = 0; return true; })()`);
  await sleep(120);
}

await tapButton('Open Guide // Crafting', 98);
await waitFor(`Boolean(document.querySelector('.ship-hub.area-intel') && document.querySelector('[data-guide-section="crafting"]'))`, 'Android P19-E Crafting Guide deep-link');
await evaluate(`history.back()`);
await waitFor(`(() => {
  const active = document.activeElement;
  return Boolean(document.querySelector('[data-management-surface="crafting"]'))
    && active instanceof HTMLButtonElement
    && active.getAttribute('data-guide-link') === 'crafting';
})()`, 'Android P19-E Crafting Guide history-back focus');
await tapButton('Progression', 33);
await waitFor(`Boolean(document.querySelector('.network-panel .section-copy.iv-panel.iv-panel--glass') && document.querySelector('.network-planner.iv-panel') && document.querySelector('.operator-class-panel.iv-panel') && document.querySelector('.specialization-panel.iv-panel') && document.querySelector('.build-tabs button[aria-current="page"]')?.textContent?.includes('Progression'))`, 'Android P15-B Progression surface');
const p15BuildLayout = await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('.build-tabs button')];
  return {
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    tabCount: buttons.length,
    minTabHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height)),
  };
})()`);
if (p15BuildLayout.horizontalOverflow > 2 || p15BuildLayout.tabCount !== 5 || p15BuildLayout.minTabHeight < 40) {
  throw new Error(`Android P15-B Build/Crafting/Progression layout failed: ${JSON.stringify(p15BuildLayout)}`);
}
const p19ProgressionHierarchy = await evaluate(`(() => {
  const root = document.querySelector('[data-management-surface="progression"]');
  const visible = element => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const copy = [...(root?.querySelectorAll('.network-focus-card p, .network-focus-card small, .network-focus-card span, .network-plan-card small, .network-plan-card span, .network-grid button small, .network-grid button em') ?? [])].filter(visible);
  const focusRequirement = root?.querySelector('.network-focus-card .iv-requirement[data-requirement-state]');
  const guide = root?.querySelector('button[data-guide-link="builds-progression"]');
  const math = [...(root?.querySelectorAll('.iv-disclosure-trigger') ?? [])].some(button => (button.textContent || '').trim() === 'View planned build math');
  const summary = root?.querySelector('.network-plan-summary')?.textContent ?? '';
  return {
    root: Boolean(root),
    guide: Boolean(guide),
    math,
    requirementState: focusRequirement?.getAttribute('data-requirement-state') ?? '',
    costVisible: summary.includes('TOTAL COST') && summary.includes('AVAILABLE NOW'),
    minFont: copy.length ? Math.min(...copy.map(element => Number.parseFloat(getComputedStyle(element).fontSize))) : 0,
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  };
})()`);
if (!p19ProgressionHierarchy.root
  || !p19ProgressionHierarchy.guide
  || !p19ProgressionHierarchy.math
  || !['ready', 'active', 'blocked'].includes(p19ProgressionHierarchy.requirementState)
  || !p19ProgressionHierarchy.costVisible
  || p19ProgressionHierarchy.minFont < 11.5
  || p19ProgressionHierarchy.horizontalOverflow > 2) {
  throw new Error(`Android P19-E Progression hierarchy failed: ${JSON.stringify(p19ProgressionHierarchy)}`);
}
await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[13]; button.pressed = true; button.value = 1; return true; })()`);
await waitFor(`document.activeElement?.matches?.('button[data-network-node="true"]') === true`, 'Android P19-E Progression controller D-pad focus');
const p19NetworkControllerNode = await evaluate(`document.activeElement?.textContent?.trim()?.slice(0, 80) ?? ''`);
await evaluate(`(() => { const button = globalThis.__p19ManagementGamepad.buttons[13]; button.pressed = false; button.value = 0; return true; })()`);
await tapButton('View planned build math', 96);
await waitFor(`Boolean(document.querySelector('.iv-disclosure-sheet .network-stat-preview[aria-label="Planned build before and after math"]'))`, 'Android P18-F planned build math disclosure');
await tapButton('Close details', 97);
await waitFor(`!document.querySelector('.iv-disclosure-sheet')`, 'Android P18-F planned build math close');

const preExistingPlannerTargets = await evaluate(`(() => {
  const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
  const targets = state?.profile?.operatorNetwork?.plannedTargetNodeIds;
  return Array.isArray(targets) ? targets : [];
})()`);
if (preExistingPlannerTargets.length > 0) {
  await tapButton('Clear plan', 70);
  await waitFor(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    const targets = state?.profile?.operatorNetwork?.plannedTargetNodeIds;
    const planText = document.querySelector('.network-plan-card')?.textContent ?? '';
    return Array.isArray(targets) && targets.length === 0 && planText.includes('No targets yet');
  })()`, 'clear pre-existing QA planner targets');
}

const plannerTargets = [
  ['ballistics-3', 'Breach Doctrine', 71],
  ['mobility-1', 'Servo Timing', 72],
];
for (let index = 0; index < plannerTargets.length; index += 1) {
  const [nodeId, nodeName, touchId] = plannerTargets[index];
  const marked = await evaluate(`(() => {
    const nodeName = ${JSON.stringify(nodeName)};
    const nodeId = ${JSON.stringify(nodeId)};
    const button = [...document.querySelectorAll('button[data-network-node="true"]')].find(candidate => (candidate.textContent ?? '').includes(nodeName));
    if (!button) return false;
    button.dataset.p18PlanNode = nodeId;
    button.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    return true;
  })()`);
  if (!marked) throw new Error(`Android could not find Network planner target ${nodeName}.`);
  await sleep(180);
  await tap(`button[data-p18-plan-node="${nodeId}"]`, touchId);
  await waitFor(`[...document.querySelectorAll('button')].some(button => (button.textContent || '').trim() === 'Plan this route')`, `plan action for ${nodeName}`);
  if (index === 0) {
    await waitFor(`(() => {
      const requirement = document.querySelector('.iv-requirement[data-requirement-state]');
      const text = requirement?.textContent ?? '';
      return requirement?.getAttribute('data-requirement-state') === 'blocked'
        && text.includes('Why blocked:')
        && text.includes('Next:');
    })()`, 'Android P18-D explicit blocked requirement state');
    console.log('ANDROID_P18F_PROGRESSION_REQUIREMENT_PASS state=blocked reason=visible next=visible math=shared-sheet');
  }
  await tapButton('Plan this route', touchId + 10);

  const expectedIds = plannerTargets.slice(0, index + 1).map(([id]) => id);
  const expectedNames = plannerTargets.slice(0, index + 1).map(([, name]) => name);
  await waitFor(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    const targets = state?.profile?.operatorNetwork?.plannedTargetNodeIds;
    const planText = document.querySelector('.network-plan-card')?.textContent ?? '';
    return state?.version === 4
      && state?.operatorNetworkSchemaVersion === 3
      && Array.isArray(targets)
      && targets.join(',') === ${JSON.stringify(expectedIds.join(','))}
      && planText.includes(${JSON.stringify(`${index + 1} target${index === 0 ? '' : 's'}`)})
      && ${JSON.stringify(expectedNames)}.every(name => planText.includes(name));
  })()`, `planner commit ${index + 1}/${plannerTargets.length} after ${nodeName}`, 20_000);
}

await waitFor(`(() => {
  const text = document.querySelector('.network-plan-card')?.textContent ?? '';
  const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
  const targets = state?.profile?.operatorNetwork?.plannedTargetNodeIds;
  return text.includes('2 targets')
    && text.includes('Breach Doctrine')
    && text.includes('Servo Timing')
    && state?.version === 4
    && state?.operatorNetworkSchemaVersion === 3
    && Array.isArray(targets)
    && targets.join(',') === 'ballistics-3,mobility-1'
    && !state.profile.operatorNetwork.allocatedNodeIds.includes('ballistics-3')
    && !state.profile.operatorNetwork.allocatedNodeIds.includes('mobility-1');
})()`, 'persisted multi-target Operator Network plan', 20_000);
await tapButton('Return to ship', 75);
await waitFor(`[...document.querySelectorAll('button[data-primary-area]')].some(button => (button.getAttribute('aria-label') || '').trim().toLowerCase() === 'operator')`, 'Command Deck after planner close');
await tapButton('Operator', 76);
await waitFor(`[...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim().toLowerCase() === 'build')`, 'Operator build route after planner close');
await tapButton('Build', 77);
await waitFor(`document.querySelector('.build-header h1')?.textContent?.trim() === 'Build'`, 'Build reopened after planner close');
await tapButton('Progression', 77);
await waitFor(`(() => {
  const text = document.querySelector('.network-plan-card')?.textContent ?? '';
  return text.includes('2 targets') && text.includes('Breach Doctrine') && text.includes('Servo Timing');
})()`, 'multi-target plan after closing and reopening Build', 20_000);
console.log('ANDROID_NETWORK_PLANNER_CLOSE_REOPEN_PASS targets=ballistics-3+mobility-1 nonDestructive=true');

await tapButton('Settings', 64);
await waitFor(`Boolean(document.querySelector('select[aria-label="Graphics quality"]'))`, 'Android graphics quality setting');
const graphicsModeChanged = await evaluate(`(() => {
  const select = document.querySelector('select[aria-label="Graphics quality"]');
  if (!(select instanceof HTMLSelectElement)) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setter) return false;
  setter.call(select, 'performance');
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
if (!graphicsModeChanged) throw new Error('Android could not select Performance graphics mode.');
await waitFor(`document.querySelector('select[aria-label="Graphics quality"]')?.value === 'performance'`, 'Android Performance graphics selection');
await tapButton('Skills', 34);
await waitFor(`(() => {
  const text = document.body?.innerText ?? '';
  const cards = [...document.querySelectorAll('.skill-path-card')];
  const details = [...document.querySelectorAll('.skill-path-card .iv-disclosure-trigger')].filter(button => (button.textContent || '').trim() === 'View current skill path');
  return text.includes('Choose Standard, a Lens, or a class Evolution.')
    && Boolean(document.querySelector('button[data-guide-link="builds-progression"]'))
    && !text.includes('How Skills progression works')
    && text.includes('SHARED LENSES')
    && text.includes('CLASS EVOLUTIONS')
    && document.querySelectorAll('.skill-path-overview > article').length === 4
    && cards.length === 3
    && details.length === 3
    && cards.every(card => card.querySelector('.skill-hierarchy-grid') === null)
    && Boolean(document.querySelector('button[data-skill-mod="mag-revector"]'))
    && Boolean(document.querySelector('button[data-skill-slot="mag"][data-skill-mod="standard"]'));
})()`, 'Android P19-E decision-first skill hierarchy', 20_000);
const p18fSkillRequirements = await evaluate(`(() => {
  const root = document.querySelector('[data-management-surface="skills"]');
  const evolutions = [...(root?.querySelectorAll('.skill-evolution-group > button[data-skill-mod]') ?? [])];
  const guide = Boolean(root?.querySelector('button[data-guide-link="builds-progression"]'));
  const details = [...(root?.querySelectorAll('.skill-path-card .iv-disclosure-trigger') ?? [])].filter(button => (button.textContent || '').trim() === 'View current skill path');
  const visible = element => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const copy = [...(root?.querySelectorAll('.protocol-skill-copy, .skill-option-group > small, .skill-option-group > button span, .skill-option-group > button small, .iv-requirement__copy span') ?? [])].filter(visible);
  const states = evolutions.map(button => {
    const requirement = button.nextElementSibling;
    return {
      disabled: button instanceof HTMLButtonElement ? button.disabled : false,
      state: requirement?.getAttribute('data-requirement-state') ?? '',
      copy: requirement?.textContent ?? '',
      tradeoff: /TRADEOFF/i.test(button.textContent ?? ''),
    };
  });
  return {
    count: evolutions.length,
    guide,
    detailCount: details.length,
    allExplicit: states.every(entry => ['ready', 'active', 'blocked'].includes(entry.state)),
    allTradeoffsVisible: states.every(entry => entry.tradeoff),
    disabledExplained: states.filter(entry => entry.disabled).every(entry => entry.state === 'blocked' && entry.copy.includes('Why blocked:') && entry.copy.includes('Next:')),
    minFont: copy.length ? Math.min(...copy.map(element => Number.parseFloat(getComputedStyle(element).fontSize))) : 0,
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  };
})()`);
if (!p18fSkillRequirements.guide
  || p18fSkillRequirements.detailCount !== 3
  || p18fSkillRequirements.count < 3
  || !p18fSkillRequirements.allExplicit
  || !p18fSkillRequirements.allTradeoffsVisible
  || !p18fSkillRequirements.disabledExplained
  || p18fSkillRequirements.minFont < 11.5
  || p18fSkillRequirements.horizontalOverflow > 2) {
  throw new Error(`Android P18-F/P19-E Skills requirement-state failed: ${JSON.stringify(p18fSkillRequirements)}`);
}
console.log(`ANDROID_P18F_SKILLS_REQUIREMENT_PASS evolutions=${p18fSkillRequirements.count} states=ready+active+blocked levelBlocker=explained guide=builds-progression details=shared-sheet`);
const skillHierarchyLayout = await evaluate(`(() => {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const buttons = [...document.querySelectorAll('.skill-option-group > button')];
  const undersized = buttons.filter(button => {
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.height < 40;
  }).map(button => button.dataset.skillMod || (button.textContent || '').trim().slice(0, 32));
  const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - viewport.width);
  return { viewport, buttonCount: buttons.length, undersized, horizontalOverflow };
})()`);
if (skillHierarchyLayout.buttonCount < 9 || skillHierarchyLayout.undersized.length || skillHierarchyLayout.horizontalOverflow > 2) {
  throw new Error(`Android P8-H skill hierarchy layout failed: ${JSON.stringify(skillHierarchyLayout)}`);
}
await evaluate(`document.querySelector('button[data-skill-mod="mag-revector"]')?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })`);
await sleep(200);
await tap('button[data-skill-mod="mag-revector"]', 35);
await waitFor(`document.querySelector('button[data-skill-mod="mag-revector"]')?.getAttribute('aria-pressed') === 'true'`, 'Android touch Lens selection');
await tapButton('View current skill path', 99);
await waitFor(`(() => {
  const sheet = document.querySelector('.iv-disclosure-sheet');
  return Boolean(sheet?.querySelector('.skill-hierarchy-grid')) && (sheet?.textContent ?? '').includes('Lens · Revector Lens');
})()`, 'Android P19-E current skill path Details selection state');
await tapButton('Close details', 100);
await waitFor(`!document.querySelector('.iv-disclosure-sheet')`, 'Android P19-E current skill path Details close');
await evaluate(`document.querySelector('button[data-skill-slot="mag"][data-skill-mod="standard"]')?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })`);
await sleep(200);
await tap('button[data-skill-slot="mag"][data-skill-mod="standard"]', 36);
await waitFor(`document.querySelector('button[data-skill-slot="mag"][data-skill-mod="standard"]')?.getAttribute('aria-pressed') === 'true'`, 'Android touch Lens restore');
console.log(`ANDROID_SKILL_HIERARCHY_PASS stages=4 skills=3 options=${skillHierarchyLayout.buttonCount} touch=select+restore details=shared-sheet guide=builds-progression`);
await evaluate(`(() => {
  const original = globalThis.__p19ManagementOriginalGetGamepads;
  if (original) Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: original });
  delete globalThis.__p19ManagementGamepad;
  delete globalThis.__p19ManagementOriginalGetGamepads;
  return true;
})()`);
console.log(`ANDROID_P19_MANAGEMENT_HIERARCHY_PASS crafting=decision+cost+requirement progression=decision+cost+requirement skills=tradeoff+requirement fontFloor=12px guide=crafting+builds-progression details=planner+skill-path controller=craft-dpad+a+b+network-dpad networkNode=${p19NetworkControllerNode}`);
await tapButton('Settings', 65);
await waitFor(`document.querySelector('select[aria-label="Graphics quality"]')?.value === 'performance'`, 'Android graphics setting persistence across Build tabs');
console.log('ANDROID_QUALITY_SETTING_PASS mode=performance persisted=build-navigation');
await tapButton('Return to ship', 37);
await waitFor(`(() => {
  const text = (document.body?.innerText ?? '').toLowerCase();
  const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
  return (text.includes('command ready') || text.includes('command deck')) && labels.includes('operations');
})()`, 'Android Command Deck after skill hierarchy');


function assertP19CommandNavMetrics(value, expectedComposition, label) {
  const invalid = !value?.rail
    || !value?.workspace
    || value.primaryCount !== 5
    || value.offscreen.length
    || value.navOverflow.length
    || value.overlap
    || value.horizontalOverflow > 2
    || value.composition !== expectedComposition;
  if (invalid) throw new Error(`Android P19-B ${label} navigation failed: ${JSON.stringify(value)}`);
  if (expectedComposition === 'dock' && (value.undersized.length || value.minTargetHeight < 48 || value.minLabelFontSize < 11.5)) {
    throw new Error(`Android P19-B ${label} dock failed glance/touch checks: ${JSON.stringify(value)}`);
  }
}

async function p19CommandNavMetrics() {
  return evaluate(`(() => {
    const viewport = { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
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
    const rail = bounds(document.querySelector('.command-rail'));
    const workspace = bounds(document.querySelector('.tactical-workspace'));
    const buttons = [...document.querySelectorAll('.command-rail-nav button[data-primary-area]')].filter(visible).map(button => ({
      label: button.getAttribute('aria-label') || button.textContent?.trim() || '',
      labelFontSize: Number.parseFloat(getComputedStyle(button.querySelector('b') ?? button).fontSize),
      rect: bounds(button),
    }));
    const offscreen = buttons.filter(item => item.rect && (
      item.rect.left < -1 || item.rect.top < -1 || item.rect.right > viewport.width + 1 || item.rect.bottom > viewport.height + 1
    )).map(item => item.label);
    const undersized = buttons.filter(item => item.rect && item.rect.height < 48).map(item => item.label);
    const navOverflow = buttons.filter(item => item.rect && rail && (
      item.rect.left < rail.left - 1 || item.rect.top < rail.top - 1 || item.rect.right > rail.right + 1 || item.rect.bottom > rail.bottom + 1
    )).map(item => item.label);
    return {
      viewport,
      rail,
      workspace,
      composition: rail && workspace && rail.top >= workspace.bottom - 2 ? 'dock' : 'rail',
      primaryCount: buttons.length,
      offscreen,
      undersized,
      navOverflow,
      overlap: intersects(rail, workspace),
      minTargetHeight: buttons.length ? Math.min(...buttons.map(item => item.rect?.height ?? 0)) : 0,
      minLabelFontSize: buttons.length ? Math.min(...buttons.map(item => item.labelFontSize)) : 0,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - viewport.width),
    };
  })()`);
}

const p19NativeViewport = await evaluate(`({ width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight })`);
const p19NativeNav = await p19CommandNavMetrics();
assertP19CommandNavMetrics(p19NativeNav, 'dock', 'native landscape');

await tapButton('Intel', 96);
await waitFor(`document.querySelector('.ship-hub.area-intel') !== null`, 'Android P19-B Intel touch navigation');
await tapButton('Command', 97);
await waitFor(`document.querySelector('.ship-hub.area-command') !== null`, 'Android P19-B Command touch navigation');

await evaluate(`(() => {
  globalThis.__p19OriginalGetGamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads.bind(navigator) : null;
  globalThis.__p19CommandGamepad = {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  };
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [globalThis.__p19CommandGamepad] });
  document.querySelector('.command-rail-nav button[data-primary-area="command"]')?.focus();
  return true;
})()`);
const pressP19Gamepad = async index => {
  await evaluate(`(() => { const button = globalThis.__p19CommandGamepad?.buttons?.[${index}]; if (button) { button.pressed = true; button.value = 1; } })()`);
  await sleep(160);
  await evaluate(`(() => { const button = globalThis.__p19CommandGamepad?.buttons?.[${index}]; if (button) { button.pressed = false; button.value = 0; } })()`);
  await sleep(80);
};
try {
  await sleep(120);
  await pressP19Gamepad(15);
  await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Operations'`, 'Android P19-B controller focus');
  await pressP19Gamepad(0);
  await waitFor(`document.querySelector('.ship-hub.area-operations') !== null`, 'Android P19-B controller activation');
  await pressP19Gamepad(1);
  await waitFor(`document.querySelector('.ship-hub.area-command') !== null && document.activeElement?.getAttribute('aria-label') === 'Command'`, 'Android P19-B controller back');
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

await call('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 720,
  deviceScaleFactor: 2,
  mobile: true,
  screenWidth: 1280,
  screenHeight: 720,
  screenOrientation: { type: 'landscapePrimary', angle: 90 },
});
await sleep(220);
const p19WideNav = await p19CommandNavMetrics();
assertP19CommandNavMetrics(p19WideNav, 'rail', 'wide landscape breakpoint');

await call('Emulation.setDeviceMetricsOverride', {
  width: 412,
  height: 915,
  deviceScaleFactor: 2.5,
  mobile: true,
  screenWidth: 412,
  screenHeight: 915,
  screenOrientation: { type: 'portraitPrimary', angle: 0 },
});
await sleep(220);
const p19PortraitNav = await p19CommandNavMetrics();
assertP19CommandNavMetrics(p19PortraitNav, 'dock', 'portrait rotation');

await call('Emulation.clearDeviceMetricsOverride');
await sleep(220);
const p19RestoredViewport = await evaluate(`({ width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight })`);
const p19RestoredNav = await p19CommandNavMetrics();
assertP19CommandNavMetrics(p19RestoredNav, 'dock', 'restored landscape');
if (Math.abs(p19RestoredViewport.width - p19NativeViewport.width) > 4 || Math.abs(p19RestoredViewport.height - p19NativeViewport.height) > 4) {
  throw new Error(`Android P19-B native viewport did not restore after rotation/breakpoint QA: native=${JSON.stringify(p19NativeViewport)} restored=${JSON.stringify(p19RestoredViewport)}`);
}
console.log(`ANDROID_P19_COMMAND_NAV_PASS destinations=5 touch=command+intel controller=dpad+a+b back=controller-b breakpoint=dock+rail rotation=portrait+landscape native=${Math.round(p19NativeViewport.width)}x${Math.round(p19NativeViewport.height)}`);

await tapButton('Ship', 38);
await waitFor(`Boolean(document.querySelector('.ship-hub.iv-view.area-ship') && document.querySelector('.tactical-header.iv-panel.iv-panel--glass') && document.querySelector('.ship-systems-intro.iv-panel.iv-panel--glass') && document.querySelector('.ship-hardware-bay.iv-panel') && document.querySelectorAll('.ship-systems-panel .upgrade-card.iv-panel').length >= 6)`, 'Android P15-B Ship Systems surface');
const p15ShipLayout = await evaluate(`(() => {
  const tabs = [...document.querySelectorAll('.section-tabs button')].filter(button => button.getBoundingClientRect().height > 0);
  return {
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    visibleTabs: tabs.length,
    minTabHeight: tabs.length ? Math.min(...tabs.map(button => button.getBoundingClientRect().height)) : 0,
  };
})()`);
if (p15ShipLayout.horizontalOverflow > 2 || p15ShipLayout.visibleTabs < 2 || p15ShipLayout.minTabHeight < 40) {
  throw new Error(`Android P15-B Ship Systems layout failed: ${JSON.stringify(p15ShipLayout)}`);
}
console.log('ANDROID_P15_MENU_PRESENTATION_PASS input=touch flows=class+crafting+progression+ship-systems shared=iv-panel transition=iv-view');

await tapButton('Operations', 39);
await waitFor(`[...document.querySelectorAll('button')].some(button => button.textContent?.trim().toLowerCase() === 'contracts')`, 'Operations navigation');

await tapButton('Contracts', 22);
await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('contract board') && [...document.querySelectorAll('button')].some(button => button.textContent?.trim().toLowerCase() === 'deploy selected contract')`, 'Contract Board');

await evaluate(`(() => {
  const target = document.querySelector('button[data-location="asteroid-refinery"]');
  if (!target) return false;
  target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  return true;
})()`);
await sleep(300);
await tap('button[data-location="asteroid-refinery"]', 23);
await waitFor(`document.querySelector('button[data-location="asteroid-refinery"]')?.classList.contains('selected') === true`, 'Asteroid Refinery contract selection');

await tapButton('Deploy selected contract', 24, 120);
await waitFor(`Boolean(document.querySelectorAll('canvas').length > 0 && (document.querySelector('[data-presentation="deployment"]') || document.querySelector('.transient-alert-lane[data-hud-layer="transient"]')))`, 'Combat surface', 45_000);
await waitFor(`(() => {
  const root = document.querySelector('.game-root[data-mission-presentation="non-blocking-cues"]');
  const cue = document.querySelector('[data-presentation="deployment"]');
  if (!root || !cue) return false;
  const rect = cue.getBoundingClientRect();
  const style = getComputedStyle(cue);
  const sample = {
    pointerEvents: style.pointerEvents,
    title: cue.querySelector('b')?.textContent?.trim() ?? '',
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
  window.__ironshadeP15MissionPresentation = sample;
  return sample.pointerEvents === 'none'
    && Boolean(sample.title)
    && sample.left >= 0
    && sample.right <= sample.viewportWidth
    && sample.top >= 0
    && sample.bottom <= sample.viewportHeight;
})()`, 'P15-C deployment presentation', 20_000);
const p15MissionPresentation = await evaluate(`window.__ironshadeP15MissionPresentation ?? null`);
if (!p15MissionPresentation) {
  throw new Error('P15-C Android deployment presentation was not captured while visible.');
}
console.log(`ANDROID_P15_MISSION_PRESENTATION_PASS deployment=non-blocking+onscreen title=${p15MissionPresentation.title}`);
await waitFor(`(() => {
  const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || '').trim());
  return ['Breach Rush', 'Fracture Tag', 'Bulwark Pulse'].every(label => labels.includes(label));
})()`, 'Vanguard level-one skill kit', 20_000);
console.log('ANDROID_CLASS_KIT_PASS kit=RUSH/BREAK/GUARD');
await waitFor(`(() => {
  const icons = [...document.querySelectorAll('img[src*="/assets/ui/skills/"], img[src*="/assets/ui/weapons/"]')];
  return icons.length >= 4 && icons.every(image => image.complete && image.naturalWidth > 0);
})()`, 'Android mobile combat SVG assets', 20_000);
await waitFor(`(() => {
  const canvas = document.querySelector('canvas');
  return canvas?.dataset.operatorClassAsset === 'vanguard'
    && canvas?.dataset.operatorVisual === 'authored-2'
    && (canvas?.dataset.operatorAsset ?? '').includes('operator-vanguard-lod2')
    && (canvas?.dataset.weaponAsset ?? '').includes('weapon-breacher-lod2');
})()`, 'Android Vanguard authored mobile assets', 20_000);
console.log('ANDROID_MOBILE_ASSET_PASS icons=loaded operatorLod=2 weaponLod=2');
console.log('ANDROID_CLASS_ASSET_PASS operator=vanguard');

const combat = await snapshot();
const combatGuidanceVisible = await evaluate(`Boolean(document.querySelector('.transient-alert-lane[data-hud-layer="transient"]'))`);
if (!combatGuidanceVisible || combat.canvases < 1) {
  throw new Error(`Android combat surface failed smoke validation: ${JSON.stringify({ ...combat, combatGuidanceVisible })}`);
}

await waitFor(`(() => {
  const canvas = document.querySelector('canvas[data-render-tier]');
  return Boolean(
    canvas?.dataset.renderTier
    && canvas?.dataset.graphicsQuality
    && canvas?.dataset.renderBudget
    && canvas?.dataset.runtimeAnimationLod
    && canvas?.dataset.runtimePools
    && canvas?.dataset.assetStreaming
    && canvas?.dataset.audioVirtualization
  );
})()`, 'Android runtime scalability telemetry', 20_000);

const renderTier = await evaluate(`(() => {
  const canvas = document.querySelector('canvas[data-render-tier]');
  return {
    tier: canvas?.dataset.renderTier ?? '',
    qualityMode: canvas?.dataset.graphicsQuality ?? '',
    budget: canvas?.dataset.renderBudget ?? '',
    animationLod: canvas?.dataset.runtimeAnimationLod ?? '',
    pools: canvas?.dataset.runtimePools ?? '',
    assetStreaming: canvas?.dataset.assetStreaming ?? '',
    audioVirtualization: canvas?.dataset.audioVirtualization ?? '',
  };
})()`);
if (renderTier.qualityMode !== 'performance' || renderTier.tier !== 'performance') {
  throw new Error(`Android renderer did not honor Performance graphics mode: ${JSON.stringify(renderTier)}`);
}
if (!validRenderBudget(renderTier.budget)) {
  throw new Error(`Android render budget telemetry is malformed: ${JSON.stringify(renderTier)}`);
}
console.log(`ANDROID_RENDER_TIER_PASS mode=${renderTier.qualityMode} tier=${renderTier.tier} budget=${renderTier.budget}`);
if (!/^(balanced|performance):max-stride-[123]:deferred-\d+$/.test(renderTier.animationLod)) {
  throw new Error(`Android runtime animation LOD telemetry is malformed: ${JSON.stringify(renderTier)}`);
}
if (!/^damage:\d+\/\d+\|effects:\d+\/\d+\|sparks:\d+\/\d+\|debris:\d+\/\d+$/.test(renderTier.pools)) {
  throw new Error(`Android runtime pool telemetry is malformed: ${JSON.stringify(renderTier)}`);
}
const startupStreamingValid = /^startup-deferred:\d+(?:\.\d+)?s@[12]$/.test(renderTier.assetStreaming)
  || /^bounded-preload:\d+@[12]$/.test(renderTier.assetStreaming);
if (!startupStreamingValid) {
  throw new Error(`Android startup asset streaming telemetry is malformed: ${JSON.stringify(renderTier)}`);
}
if (!/^active:\d+\/18\+tails:\d+\/5\+virtualized:\d+\+tail-virtualized:\d+\+reason:[a-z-]+$/.test(renderTier.audioVirtualization)) {
  throw new Error(`Android audio virtualization telemetry is malformed: ${JSON.stringify(renderTier)}`);
}

if (renderTier.assetStreaming.startsWith('startup-deferred:')) {
  await waitFor(`document.querySelector('canvas[data-render-tier]')?.dataset.assetStreaming?.startsWith('bounded-preload:') === true`, 'Android bounded asset streaming activation', 15_000);
}
const activeAssetStreaming = await evaluate(`document.querySelector('canvas[data-render-tier]')?.dataset.assetStreaming ?? ''`);
if (!/^bounded-preload:\d+@[12]$/.test(activeAssetStreaming)) {
  throw new Error(`Android bounded asset streaming never activated: startup=${renderTier.assetStreaming} active=${activeAssetStreaming}`);
}
console.log(`ANDROID_RUNTIME_SCALABILITY_PASS animation=${renderTier.animationLod} pools=${renderTier.pools} assets=${activeAssetStreaming} startupAssets=${renderTier.assetStreaming} audio=${renderTier.audioVirtualization}`);

const mobileLayout = await evaluate(`(() => {
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
  const within = value => !value || (
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
  const hud = rect(document.querySelector('.hud-top'));
  const vitals = rect(document.querySelector('.vitals'));
  const objective = rect(document.querySelector('.mission-card'));
  const transient = rect(document.querySelector('.transient-alert-lane'));
  const contextSelectors = ['.target-readout', '.boss-hud', '.loot-radar', '.mega-objective-chip', '.post-clear-objective', '.class-mechanic-hud'];
  const contexts = contextSelectors.map(selector => ({ selector, rect: rect(document.querySelector(selector)) })).filter(item => item.rect);
  const touchButtons = [...document.querySelectorAll('.touch-button')].filter(visible).map(button => ({
    label: button.getAttribute('aria-label') || button.textContent?.trim().slice(0, 40) || button.className,
    rect: rect(button),
  }));
  const readableText = [...document.querySelectorAll([
    '.vitals .barline > span', '.vitals .barline > b',
    '.mission-card b', '.mission-card span',
    '.touch-button span', '.touch-button small',
    '.transient-alert-lane small', '.transient-alert-lane b', '.transient-alert-lane span',
    '.target-readout header small', '.target-readout header b', '.target-values span',
    '.boss-title span', '.boss-title b', '.boss-values span', '.boss-hud .boss-tell',
    '.loot-radar > small', '.loot-radar > b', '.loot-radar > span',
    '.mega-objective-chip small', '.mega-objective-chip b', '.mega-objective-chip span',
    '.post-clear-objective small', '.post-clear-objective b', '.post-clear-objective span',
    '.class-mechanic-hud small', '.class-mechanic-hud b',
  ].join(','))].filter(element => visible(element) && (element.textContent || '').trim());
  const tinyText = readableText
    .map(element => ({ text: (element.textContent || '').trim().slice(0, 48), size: Number.parseFloat(getComputedStyle(element).fontSize) }))
    .filter(item => Number.isFinite(item.size) && item.size < 11.5);
  const coreOverlap = intersects(vitals, objective) || intersects(vitals, dock) || intersects(objective, dock);
  const transientOverlap = intersects(transient, move) || intersects(transient, dock) || intersects(transient, vitals) || intersects(transient, objective);
  const contextControlOverlap = contexts.filter(item => intersects(item.rect, move) || intersects(item.rect, dock)).map(item => item.selector);
  return {
    viewport,
    canvas,
    move,
    dock,
    fire,
    dodge,
    hud,
    vitals,
    objective,
    transient,
    contexts,
    landscape: viewport.width > viewport.height,
    offscreen: [
      ['canvas', canvas], ['move', move], ['dock', dock], ['fire', fire], ['dodge', dodge], ['hud', hud], ['vitals', vitals], ['objective', objective], ['transient', transient],
      ...contexts.map(item => [item.selector, item.rect]),
      ...touchButtons.map(item => [item.label, item.rect]),
    ].filter(([, value]) => !within(value)).map(([label]) => label),
    undersized: touchButtons.filter(item => item.rect && (item.rect.width < 40 || item.rect.height < 40)).map(item => item.label),
    moveDockOverlap: intersects(move, dock),
    coreOverlap,
    transientOverlap,
    contextControlOverlap,
    tinyText,
    touchButtons: touchButtons.length,
  };
})()`);
if (!mobileLayout.landscape || !mobileLayout.canvas || mobileLayout.canvas.width < mobileLayout.viewport.width * 0.95 || mobileLayout.canvas.height < mobileLayout.viewport.height * 0.9) {
  throw new Error(`Android combat viewport/layout is invalid: ${JSON.stringify(mobileLayout)}`);
}
if (mobileLayout.offscreen.length || mobileLayout.undersized.length || mobileLayout.moveDockOverlap) {
  throw new Error(`Android combat controls failed safe-area/touch-target checks: ${JSON.stringify(mobileLayout)}`);
}
if (!mobileLayout.vitals || !mobileLayout.objective || mobileLayout.coreOverlap || mobileLayout.transientOverlap || mobileLayout.contextControlOverlap.length || mobileLayout.tinyText.length) {
  throw new Error(`Android glance-first combat HUD failed overlap/type-floor checks: ${JSON.stringify(mobileLayout)}`);
}
console.log(`ANDROID_MOBILE_LAYOUT_PASS viewport=${Math.round(mobileLayout.viewport.width)}x${Math.round(mobileLayout.viewport.height)} touchButtons=${mobileLayout.touchButtons} safe=onscreen+separated`);
console.log(`ANDROID_COMBAT_HUD_PASS layers=core+context+transient typeFloor=12px overlaps=none touch=clear`);

await waitFor(`Boolean(document.querySelector('[aria-label="Touch combat controls"]') && document.querySelector('.move-stick') && document.querySelector('.fire-button') && document.querySelector('.dodge-button'))`, 'Android touch controls');
const scrollBefore = await evaluate(`({ x: window.scrollX, y: window.scrollY })`);

const move = await elementMetrics('.move-stick');
if (!move) throw new Error('Android movement stick was not found.');
await dispatchTouch('touchStart', move.x, move.y, 11);
await dispatchTouch('touchMove', move.x + Math.min(36, move.width * 0.3), move.y - Math.min(18, move.height * 0.15), 11);
await waitFor(`(() => {
  const stick = document.querySelector('.move-stick');
  const tutorialStep = document.querySelector('.game-root')?.getAttribute('data-tutorial-step') ?? '';
  return Boolean(stick && stick.style.getPropertyValue('--knob-x') && stick.style.getPropertyValue('--knob-x') !== '0px' && tutorialStep === '1');
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
await waitFor(`document.querySelector('.game-root')?.getAttribute('data-tutorial-step') === '2'`, 'manual aim touch response', 15_000);

// Manual aim can fire the class-preferred weapon immediately before this check.
// Vanguard begins on the slower Breacher and authored mobile asset loading can
// temporarily reduce simulation cadence on SwiftShader, so clear the full
// weapon cooldown before validating the FIRE control itself.
await sleep(1_250);
const fire = await elementMetrics('.fire-button');
if (!fire || fire.disabled) throw new Error('Android FIRE control was unavailable.');
let fireObserved = false;
for (let attempt = 0; attempt < 3 && !fireObserved; attempt += 1) {
  const fireBefore = await evaluate(`document.querySelector('.fire-button small')?.textContent ?? ''`);
  await dispatchTouch('touchStart', fire.x, fire.y, 13 + attempt);
  await sleep(900);
  await dispatchTouch('touchEnd', fire.x, fire.y, 13 + attempt);
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const fireAfter = await evaluate(`document.querySelector('.fire-button small')?.textContent ?? ''`);
    if (fireAfter !== fireBefore) {
      fireObserved = true;
      break;
    }
    await sleep(250);
  }
  if (!fireObserved) await sleep(900);
}
if (!fireObserved) {
  const state = await snapshot().catch(error => ({ snapshotError: String(error) }));
  throw new Error(`Android FIRE control did not change magazine/heat after retry; webview=${JSON.stringify(state)}`);
}

await sleep(1_800);
const controllerBefore = await evaluate(`document.querySelector('.fire-button small')?.textContent ?? ''`);
const controllerSetup = await evaluate(`(() => {
  const original = typeof navigator.getGamepads === 'function' ? navigator.getGamepads.bind(navigator) : null;
  globalThis.__ironshadeSmokeOriginalGetGamepads = original;
  globalThis.__ironshadeSmokeGamepad = {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  };
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: () => [globalThis.__ironshadeSmokeGamepad],
  });
  return typeof navigator.getGamepads === 'function';
})()`);
if (!controllerSetup) throw new Error('Android controller smoke could not install a synthetic connected gamepad.');
await waitFor(`document.querySelector('canvas')?.dataset.controllerInput === 'connected'`, 'controller connection', 10_000);
await evaluate(`(() => {
  const button = globalThis.__ironshadeSmokeGamepad?.buttons?.[7];
  if (!button) return false;
  button.pressed = true;
  button.value = 1;
  return true;
})()`);
await waitFor(`Boolean(document.querySelector('canvas')?.dataset.assistedTargetId)`, 'controller assisted target acquisition', 10_000);
await waitFor(`(document.querySelector('.fire-button small')?.textContent ?? '') !== ${JSON.stringify(controllerBefore)}`, 'controller assisted FIRE response', 12_000);
const controllerTargetId = await evaluate(`document.querySelector('canvas')?.dataset.assistedTargetId ?? ''`);
await evaluate(`(() => {
  const button = globalThis.__ironshadeSmokeGamepad?.buttons?.[7];
  if (button) { button.pressed = false; button.value = 0; }
  const original = globalThis.__ironshadeSmokeOriginalGetGamepads;
  if (original) Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: original });
  delete globalThis.__ironshadeSmokeGamepad;
  delete globalThis.__ironshadeSmokeOriginalGetGamepads;
  return true;
})()`);
console.log(`ANDROID_CONTROLLER_TARGETING_SMOKE_PASS target=${controllerTargetId} trigger=R2 acquisition=assisted fire=confirmed`);

const arsenalLock = await evaluate(`({
  mobileCycleAbsent: document.querySelector('.weapon-cycle') === null,
  desktopSelectorAbsent: document.querySelector('.desktop-weapons') === null,
  weapon: document.querySelector('.weapon-hud small')?.textContent ?? '',
})`);
if (!arsenalLock.mobileCycleAbsent || !arsenalLock.desktopSelectorAbsent || !/B-4|BREACH/i.test(arsenalLock.weapon)) {
  throw new Error(`Android class arsenal lock mismatch: ${JSON.stringify(arsenalLock)}`);
}

await tap('.ability-button:not(:disabled)', 15);
await waitFor(`document.querySelector('.game-root')?.getAttribute('data-tutorial-step') === '3'`, 'ability touch response', 15_000);

await tap('.dodge-button:not(:disabled)', 16);
await waitFor(`document.querySelector('.dodge-button')?.disabled === true && document.querySelector('.game-root')?.getAttribute('data-tutorial-step') === '4'`, 'dodge touch response', 15_000);

const scrollAfter = await evaluate(`({ x: window.scrollX, y: window.scrollY })`);
if (scrollAfter.x !== scrollBefore.x || scrollAfter.y !== scrollBefore.y) {
  throw new Error(`Android combat touch gestures moved the page: before=${JSON.stringify(scrollBefore)} after=${JSON.stringify(scrollAfter)}`);
}

console.log(`ANDROID_TOUCH_SMOKE_PASS move=drag aim=drag fire=hold ability=tap dodge=tap weapon=class-locked scroll=${scrollAfter.x},${scrollAfter.y}`);
session.close();
console.log(`ANDROID_RUNTIME_SMOKE_PASS title=${startup.title} route=ship>contracts>combat canvases=${combat.canvases}`);
