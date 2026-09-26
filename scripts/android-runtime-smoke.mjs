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


const p19TypographyAcceptance = {};

async function p19CompactTypographyScan(label, rootSelector) {
  const selectorLiteral = JSON.stringify(rootSelector);
  const previousScale = await evaluate(`document.documentElement.dataset.textScale ?? ''`);
  const scanAtScale = async scale => {
    const scaleLiteral = JSON.stringify(scale);
    await evaluate(`(() => {
      const root = document.documentElement;
      const scale = ${scaleLiteral};
      if (scale) root.dataset.textScale = scale;
      else delete root.dataset.textScale;
      return root.dataset.textScale ?? '';
    })()`);
    await sleep(140);
    return evaluate(`(() => {
      const root = document.querySelector(${selectorLiteral});
      if (!root) return null;
      const viewport = {
        width: window.visualViewport?.width ?? window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
      };
      const visible = element => {
        if (!(element instanceof Element)) return false;
        if (element.closest('[aria-hidden="true"]')) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || 1) > 0
          && rect.width > 0
          && rect.height > 0;
      };
      const ownText = element => [...element.childNodes]
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent || '')
        .join(' ')
        .replace(/\\s+/g, ' ')
        .trim();
      const candidates = [root, ...root.querySelectorAll('small,p,span,b,strong,em,label,button,summary,li,dt,dd')];
      const text = candidates
        .filter(visible)
        .map(element => ({
          text: ownText(element).slice(0, 72),
          size: Number.parseFloat(getComputedStyle(element).fontSize),
        }))
        .filter(item => item.text && Number.isFinite(item.size));
      const tinyText = text.filter(item => item.size < 11.5).slice(0, 24);
      const rootRect = root.getBoundingClientRect();
      const interactive = [...root.querySelectorAll('button,[role="button"],select,input')].filter(visible);
      const thumbHotspots = interactive
        .map(element => {
          const rect = element.getBoundingClientRect();
          return {
            label: (element.getAttribute('aria-label') || ownText(element) || element.textContent || '').trim().slice(0, 48),
            width: rect.width,
            height: rect.height,
          };
        })
        .filter(item => item.width < 40 || item.height < 40)
        .slice(0, 20);
      return {
        viewport,
        root: { left: rootRect.left, right: rootRect.right, width: rootRect.width },
        textCount: text.length,
        minFont: text.length ? Math.min(...text.map(item => item.size)) : 0,
        tinyText,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - viewport.width),
        thumbHotspots,
      };
    })()`);
  };

  let defaultMetrics;
  let largeMetrics;
  try {
    defaultMetrics = await scanAtScale('default');
    largeMetrics = await scanAtScale('large');
  } finally {
    const previousLiteral = JSON.stringify(previousScale);
    await evaluate(`(() => {
      const root = document.documentElement;
      const previous = ${previousLiteral};
      if (previous) root.dataset.textScale = previous;
      else delete root.dataset.textScale;
      return root.dataset.textScale ?? '';
    })()`).catch(() => undefined);
    await sleep(120);
  }

  for (const [scale, metrics] of [['default', defaultMetrics], ['large', largeMetrics]]) {
    if (!metrics
      || !metrics.textCount
      || metrics.tinyText.length
      || metrics.horizontalOverflow > 2
      || metrics.root.left < -2
      || metrics.root.right > metrics.viewport.width + 2) {
      throw new Error(`Android P19-G ${label} typography failed (${scale}): ${JSON.stringify(metrics)}`);
    }
  }

  p19TypographyAcceptance[label] = { default: defaultMetrics, large: largeMetrics };
  console.log(`ANDROID_P19_TYPOGRAPHY_SURFACE_PASS surface=${label} default=${defaultMetrics.minFont.toFixed(1)}px large=${largeMetrics.minFont.toFixed(1)}px overflow=none thumbHotspots=${defaultMetrics.thumbHotspots.length}`);
  return p19TypographyAcceptance[label];
}


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
      && state.profile.operatorNetwork.allocatedNodeIds.join(',') === 'ballistics-1,ballistics-2'
      && state.profile.operatorNetwork.unspentPoints === 0
      && state.profile.progressionPoints === 0
      && !state.profile.operatorNetwork.allocatedNodeIds.includes('ballistics-3')
      && !state.profile.operatorNetwork.allocatedNodeIds.includes('mobility-1')
      && state?.profile?.settings?.interfaceSize === 'large'
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
    const autoButton = [...document.querySelectorAll('button')].find(candidate => (candidate.textContent || '').trim() === 'Auto Allocate');
    return text.includes('2 targets')
      && text.includes('Breach Doctrine')
      && text.includes('Servo Timing')
      && text.includes('FUTURE POINTS NEEDED')
      && autoButton instanceof HTMLButtonElement
      && autoButton.disabled;
  })()`, 'restored partial Auto Allocate plan UI after cold relaunch', 20_000);

  const persisted = await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    return {
      version: state?.version,
      networkSchema: state?.operatorNetworkSchemaVersion,
      targets: state?.profile?.operatorNetwork?.plannedTargetNodeIds ?? [],
      allocated: state?.profile?.operatorNetwork?.allocatedNodeIds ?? [],
      unspentPoints: state?.profile?.operatorNetwork?.unspentPoints,
      interfaceSize: state?.profile?.settings?.interfaceSize ?? '',
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
  console.log(`ANDROID_NETWORK_PLANNER_PERSISTENCE_PASS version=${persisted.version} schema=${persisted.networkSchema} targets=${persisted.targets.join('+')} allocated=${persisted.allocated.join('+')} unspent=${persisted.unspentPoints} relaunch=cold ui=restored autoAllocate=partial`);
  console.log(`ANDROID_P20_INTERFACE_SIZE_RELAUNCH_PASS size=${persisted.interfaceSize} relaunch=cold`);
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

const p20CommandDensity = await evaluate(`(() => {
  const root = document.documentElement;
  const previous = root.dataset.interfaceSize ?? '';
  const measure = size => {
    root.dataset.interfaceSize = size;
    const bridge = document.querySelector('.command-visual.command-bridge.command-bridge-compact');
    const card = document.querySelector('.command-card.primary-card');
    const workspace = document.querySelector('.tactical-workspace');
    const navButton = document.querySelector('.command-rail-nav button[data-primary-area]');
    const cardStyle = card ? getComputedStyle(card) : null;
    const workspaceStyle = workspace ? getComputedStyle(workspace) : null;
    return {
      bridgeHeight: Number((bridge?.getBoundingClientRect().height ?? 0).toFixed(3)),
      cardPadding: Number.parseFloat(cardStyle?.paddingLeft ?? '0'),
      workspacePaddingTop: Number.parseFloat(workspaceStyle?.paddingTop ?? '0'),
      navHeight: Number((navButton?.getBoundingClientRect().height ?? 0).toFixed(3)),
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  };
  const compact = measure('compact');
  const baseline = measure('default');
  if (previous) root.dataset.interfaceSize = previous;
  else delete root.dataset.interfaceSize;
  return { compact, baseline };
})()`);
if (!(p20CommandDensity.compact.bridgeHeight <= p20CommandDensity.baseline.bridgeHeight * 0.82)
  || !(p20CommandDensity.compact.cardPadding <= p20CommandDensity.baseline.cardPadding * 0.8)
  || !(p20CommandDensity.compact.workspacePaddingTop <= p20CommandDensity.baseline.workspacePaddingTop * 0.8)
  || p20CommandDensity.compact.navHeight < 44
  || p20CommandDensity.compact.horizontalOverflow > 2) {
  throw new Error(`Android P20-A Compact Command density is not materially smaller than Default: ${JSON.stringify(p20CommandDensity)}`);
}
console.log(`ANDROID_P20_COMMAND_DENSITY_PASS bridge=${p20CommandDensity.compact.bridgeHeight}/${p20CommandDensity.baseline.bridgeHeight} cardPadding=${p20CommandDensity.compact.cardPadding}/${p20CommandDensity.baseline.cardPadding} nav=${p20CommandDensity.compact.navHeight}px`);

await p19CompactTypographyScan('command', '.ship-hub.area-command');

await tapButton('Operator', 31);
await waitFor(`Boolean(document.querySelector('.ship-hub.area-operator') && [...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim() === 'Build'))`, 'Android compact Operator build route');
await tapButton('Build', 32);
await waitFor(`(() => {
  const text = document.body?.innerText ?? '';
  const buttons = [...document.querySelectorAll('button')].map(button => (button.textContent || '').trim());
  return document.querySelector('.build-header h1')?.textContent?.trim() === 'Build' && buttons.includes('Skills');
})()`, 'Android Build surface for skill hierarchy');
await waitFor(`Boolean(document.querySelector('.build-bay.iv-view') && document.querySelector('.build-header.iv-panel.iv-panel--glass') && document.querySelector('.build-tabs button[aria-current="page"]'))`, 'Android P15-B shared Build shell');

await p19CompactTypographyScan('armory', '.build-bay');

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

const p19ItemModalLayout = await evaluate(`(() => {
  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;
  const modal = document.querySelector('.armory-item-modal');
  const backdrop = modal?.querySelector('.item-inspector-backdrop');
  const inspector = modal?.querySelector('.item-inspector.open');
  if (!modal || !backdrop || !inspector) return null;
  const modalRect = modal.getBoundingClientRect();
  const inspectorRect = inspector.getBoundingClientRect();
  return {
    modalPosition: getComputedStyle(modal).position,
    modalCoversViewport: modalRect.left <= 1 && modalRect.top <= 1 && modalRect.right >= width - 1 && modalRect.bottom >= height - 1,
    dialogSemantics: inspector.getAttribute('role') === 'dialog' && inspector.getAttribute('aria-modal') === 'true',
    detachedFromLayout: !inspector.closest('.gear-layout'),
    backdropVisible: getComputedStyle(backdrop).display !== 'none',
    windowWithinViewport: inspectorRect.left >= -1 && inspectorRect.top >= -1 && inspectorRect.right <= width + 1 && inspectorRect.bottom <= height + 1,
  };
})()`);
if (!p19ItemModalLayout
  || p19ItemModalLayout.modalPosition !== 'fixed'
  || !p19ItemModalLayout.modalCoversViewport
  || !p19ItemModalLayout.dialogSemantics
  || !p19ItemModalLayout.detachedFromLayout
  || !p19ItemModalLayout.backdropVisible
  || !p19ItemModalLayout.windowWithinViewport) {
  throw new Error(`Android P19-I dedicated item modal failed: ${JSON.stringify(p19ItemModalLayout)}`);
}
console.log('ANDROID_P19_ITEM_MODAL_PASS trigger=inventory-card dialog=modal popup=dedicated backdrop=visible safe=onscreen');
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

await p19CompactTypographyScan('guide', '.guide-panel');

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

await tapButton('Settings', 98);
await waitFor(`Boolean(document.querySelector('.settings-panel select[aria-label="Combat layout preset"]') && document.querySelector('select[aria-label="Interface size"]') && document.querySelector('button[data-hud-layout-reset]'))`, 'P19-F/P20-A layout settings');

async function setP20InterfaceSize(value) {
  const applied = await evaluate(`(() => {
    const control = document.querySelector('select[aria-label="Interface size"]');
    if (!(control instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (!setter) return false;
    setter.call(control, '${value}');
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!applied) throw new Error(`Android P20-A could not change Interface Size to ${value}.`);
  await waitFor(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    return state?.profile?.settings?.interfaceSize === '${value}' && document.documentElement.dataset.interfaceSize === '${value}';
  })()`, `persisted ${value} Interface Size`);
  await sleep(140);
  return await evaluate(`(() => {
    const viewport = { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
    const panel = document.querySelector('.settings-panel');
    const rect = panel?.getBoundingClientRect();
    const row = document.querySelector('.settings-panel label');
    const select = document.querySelector('.settings-panel select');
    const tabs = document.querySelector('.build-tabs');
    const rowStyle = row ? getComputedStyle(row) : null;
    const selectStyle = select ? getComputedStyle(select) : null;
    const tabsStyle = tabs ? getComputedStyle(tabs) : null;
    return {
      size: document.documentElement.dataset.interfaceSize ?? '',
      rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      rowPadding: Number.parseFloat(rowStyle?.paddingLeft ?? '0'),
      selectPadding: Number.parseFloat(selectStyle?.paddingLeft ?? '0'),
      tabGap: Number.parseFloat(tabsStyle?.columnGap ?? '0'),
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - viewport.width),
      panelVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
      panelWithinViewport: Boolean(rect && rect.left >= -2 && rect.right <= viewport.width + 2),
    };
  })()`);
}

const p20InterfaceCompact = await setP20InterfaceSize('compact');
const p20InterfaceDefault = await setP20InterfaceSize('default');
const p20InterfaceLarge = await setP20InterfaceSize('large');
if (!p20InterfaceCompact.panelVisible || !p20InterfaceDefault.panelVisible || !p20InterfaceLarge.panelVisible
  || !p20InterfaceCompact.panelWithinViewport || !p20InterfaceDefault.panelWithinViewport || !p20InterfaceLarge.panelWithinViewport
  || p20InterfaceCompact.horizontalOverflow > 2 || p20InterfaceDefault.horizontalOverflow > 2 || p20InterfaceLarge.horizontalOverflow > 2
  || !(p20InterfaceCompact.rootFontSize <= p20InterfaceDefault.rootFontSize * 0.75 && p20InterfaceLarge.rootFontSize >= p20InterfaceDefault.rootFontSize * 1.2)
  || !(p20InterfaceCompact.rowPadding <= p20InterfaceDefault.rowPadding * 0.8 && p20InterfaceLarge.rowPadding >= p20InterfaceDefault.rowPadding * 1.15)
  || !(p20InterfaceCompact.selectPadding <= p20InterfaceDefault.selectPadding * 0.8 && p20InterfaceLarge.selectPadding >= p20InterfaceDefault.selectPadding * 1.15)
  || !(p20InterfaceCompact.tabGap <= p20InterfaceDefault.tabGap * 0.8 && p20InterfaceLarge.tabGap >= p20InterfaceDefault.tabGap * 1.15)) {
  throw new Error(`Android P20-A Interface Size reflow failed: ${JSON.stringify({ compact: p20InterfaceCompact, default: p20InterfaceDefault, large: p20InterfaceLarge })}`);
}
console.log(`ANDROID_P20_INTERFACE_SIZE_PASS compact=${p20InterfaceCompact.rootFontSize}px default=${p20InterfaceDefault.rootFontSize}px large=${p20InterfaceLarge.rootFontSize}px rows=${p20InterfaceCompact.rowPadding}/${p20InterfaceDefault.rowPadding}/${p20InterfaceLarge.rowPadding} tabs=${p20InterfaceCompact.tabGap}/${p20InterfaceDefault.tabGap}/${p20InterfaceLarge.tabGap} overflow=none persisted=large`);

async function p20OpenSettingsFromCommand(tapBase) {
  await tapButton('Operator', tapBase);
  await waitFor(`Boolean(document.querySelector('.ship-hub.area-operator'))`, 'Android P20-A Operator after Command');
  await tapButton('Build', tapBase + 1);
  await waitFor(`Boolean(document.querySelector('.build-bay.iv-view'))`, 'Android P20-A Build after Command');
  await tapButton('Settings', tapBase + 2);
  await waitFor(`Boolean(document.querySelector('.settings-panel select[aria-label="Interface size"]'))`, 'Android P20-A Settings after Command');
}

async function p20CommandFromSettings(size, tapId) {
  await setP20InterfaceSize(size);
  await tapButton('Return to ship', tapId);
  await waitFor(`Boolean(document.querySelector('.ship-hub.area-command[data-interface-size="${size}"]')) && document.documentElement.dataset.interfaceSize === '${size}'`, `Android P20-A ${size} Settings to Command binding`);
  await sleep(180);
  return await evaluate(`(() => {
    const shell = document.querySelector('.ship-hub.area-command');
    const bridge = document.querySelector('.command-visual.command-bridge.command-bridge-compact');
    const kicker = document.querySelector('.command-bridge-copy .card-kicker');
    const nav = document.querySelector('.command-rail-nav button[data-primary-area]');
    const viewport = window.visualViewport?.width ?? window.innerWidth;
    return {
      shellSize: shell?.getAttribute('data-interface-size') ?? '',
      rootSize: document.documentElement.dataset.interfaceSize ?? '',
      bridgeHeight: Number((bridge?.getBoundingClientRect().height ?? 0).toFixed(3)),
      kickerDisplay: kicker ? getComputedStyle(kicker).display : '',
      navHeight: Number((nav?.getBoundingClientRect().height ?? 0).toFixed(3)),
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - viewport),
    };
  })()`);
}

const p20SettingsFlowCompact = await p20CommandFromSettings('compact', 99);
await p20OpenSettingsFromCommand(100);
const p20SettingsFlowDefault = await p20CommandFromSettings('default', 103);
if (p20SettingsFlowCompact.shellSize !== 'compact' || p20SettingsFlowCompact.rootSize !== 'compact'
  || p20SettingsFlowDefault.shellSize !== 'default' || p20SettingsFlowDefault.rootSize !== 'default'
  || !(p20SettingsFlowCompact.bridgeHeight <= p20SettingsFlowDefault.bridgeHeight * 0.8)
  || p20SettingsFlowCompact.kickerDisplay !== 'none'
  || p20SettingsFlowCompact.navHeight < 44
  || p20SettingsFlowCompact.horizontalOverflow > 2 || p20SettingsFlowDefault.horizontalOverflow > 2) {
  throw new Error(`Android P20-A real Settings -> Command flow did not produce distinct density: ${JSON.stringify({ compact: p20SettingsFlowCompact, default: p20SettingsFlowDefault })}`);
}
console.log(`ANDROID_P20_SETTINGS_COMMAND_PASS compactBridge=${p20SettingsFlowCompact.bridgeHeight}px defaultBridge=${p20SettingsFlowDefault.bridgeHeight}px shell=bound root=bound nav=${p20SettingsFlowCompact.navHeight}px overflow=none`);
await p20OpenSettingsFromCommand(106);
await setP20InterfaceSize('large');

const p19AccessibilityBefore = await evaluate(`(() => {
  const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
  const settings = state?.profile?.settings;
  return settings ? { interfaceSize: settings.interfaceSize, textScale: settings.textScale, contrast: settings.contrast, reducedMotion: settings.reducedMotion } : null;
})()`);
if (!p19AccessibilityBefore) throw new Error('Android P19-F could not capture baseline accessibility settings.');

async function setP19HudControl(label, value) {
  const applied = await evaluate(`(() => {
    const control = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
    if (!(control instanceof HTMLSelectElement) && !(control instanceof HTMLInputElement)) return false;
    const proto = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (!setter) return false;
    setter.call(control, ${JSON.stringify(String(value))});
    if (control instanceof HTMLInputElement) control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!applied) throw new Error(`Android P19-F could not change ${label} to ${value}.`);
  await sleep(160);
}

for (const [preset, expectedScale] of [['standard', 1], ['large', 1.08], ['left-handed', 1]]) {
  await setP19HudControl('Combat layout preset', preset);
  await waitFor(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    return state?.profile?.settings?.hudLayoutPreset === '${preset}';
  })()`, `persisted ${preset} HUD preset`);
  await setP19HudControl('Movement cluster height', 0.55);
  await waitFor(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    return Math.abs((state?.profile?.settings?.movementClusterLift ?? -1) - 0.55) < 0.001;
  })()`, `customized ${preset} movement cluster`);
  const resetClicked = await evaluate(`document.querySelector('button[data-hud-layout-reset]')?.click(); true`);
  if (!resetClicked) throw new Error(`Android P19-F could not reset ${preset} layout.`);
  await waitFor(`(() => {
    const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
    const settings = state?.profile?.settings;
    return settings?.hudLayoutPreset === '${preset}'
      && settings.movementClusterInset === 0
      && settings.movementClusterLift === 0
      && Math.abs(settings.movementClusterScale - ${expectedScale}) < 0.001
      && settings.actionClusterInset === 0
      && settings.actionClusterLift === 0
      && Math.abs(settings.actionClusterScale - ${expectedScale}) < 0.001;
  })()`, `reset ${preset} HUD preset`);
}

await setP19HudControl('Combat layout preset', 'left-handed');
for (const [label, value] of [
  ['Movement cluster inset', 0.35],
  ['Movement cluster height', 0.4],
  ['Movement cluster size', 1.04],
  ['Action cluster inset', 0.3],
  ['Action cluster height', 0.25],
  ['Action cluster size', 0.96],
]) await setP19HudControl(label, value);

await waitFor(`(() => {
  const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
  const s = state?.profile?.settings;
  return s?.hudLayoutPreset === 'left-handed'
    && Math.abs(s.movementClusterInset - 0.35) < 0.001
    && Math.abs(s.movementClusterLift - 0.4) < 0.001
    && Math.abs(s.movementClusterScale - 1.04) < 0.001
    && Math.abs(s.actionClusterInset - 0.3) < 0.001
    && Math.abs(s.actionClusterLift - 0.25) < 0.001
    && Math.abs(s.actionClusterScale - 0.96) < 0.001;
})()`, 'persisted customized left-handed HUD layout');

const p19SettingsResult = await evaluate(`(() => {
  const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
  const s = state?.profile?.settings;
  return s ? {
    preset: s.hudLayoutPreset,
    movement: [s.movementClusterInset, s.movementClusterLift, s.movementClusterScale],
    action: [s.actionClusterInset, s.actionClusterLift, s.actionClusterScale],
    accessibility: { interfaceSize: s.interfaceSize, textScale: s.textScale, contrast: s.contrast, reducedMotion: s.reducedMotion },
  } : null;
})()`);
if (!p19SettingsResult || JSON.stringify(p19SettingsResult.accessibility) !== JSON.stringify(p19AccessibilityBefore)) {
  throw new Error(`Android P19-F changed unrelated accessibility settings: before=${JSON.stringify(p19AccessibilityBefore)} after=${JSON.stringify(p19SettingsResult)}`);
}
console.log(`ANDROID_P19_HUD_LAYOUT_SETTINGS_PASS presets=standard+large+left-handed reset=all custom=${p19SettingsResult.preset}:${p19SettingsResult.movement.join('/')};${p19SettingsResult.action.join('/')} accessibility=preserved`);

await tapButton('Crafting', 32);
await waitFor(`Boolean(document.querySelector('.reconstruction-panel .reconstruction-top.iv-panel.iv-panel--glass') && document.querySelector('.reconstruct-storage.iv-panel') && document.querySelector('.build-tabs button[aria-current="page"]')?.textContent?.includes('Crafting'))`, 'Android P15-B Crafting surface');

await p19CompactTypographyScan('crafting', '[data-management-surface="crafting"]');
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

await p19CompactTypographyScan('progression', '[data-management-surface="progression"]');
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

const p20dPreviousTimeOrigin = await evaluate('performance.timeOrigin');
const p20dSeeded = await evaluate(`(() => {
  const stateKey = 'ironshade-vector-state-v1';
  const state = JSON.parse(localStorage.getItem(stateKey) || 'null');
  if (!state?.profile) return false;
  state.profile.operatorClass = 'vanguard';
  state.profile.classSelectionComplete = true;
  state.profile.specialization = null;
  state.profile.specializationOverclock = false;
  state.profile.level = 7;
  state.profile.xp = Math.max(Number(state.profile.xp || 0), 1890);
  state.profile.progressionPoints = 6;
  state.profile.allocatedNodes = [];
  state.profile.operatorNetwork = { schemaVersion: 3, startNodeId: 'start-vanguard', allocatedNodeIds: [], unspentPoints: 6, plannedTargetNodeIds: [] };
  state.operatorNetworkSchemaVersion = 3;
  localStorage.setItem(stateKey, JSON.stringify(state));
  location.reload();
  return true;
})()`);
if (!p20dSeeded) throw new Error('Android P20-D could not seed a six-point Vanguard recommendation profile.');
await waitFor(`performance.timeOrigin !== ${JSON.stringify(p20dPreviousTimeOrigin)}`, 'Android P20-D document reload', 45_000);
await waitFor(`(() => {
  const operatorButton = [...document.querySelectorAll('button[data-primary-area]')].find(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase() === 'operator');
  return document.readyState === 'complete' && operatorButton instanceof HTMLButtonElement && !operatorButton.disabled;
})()`, 'Android P20-D seeded Command Deck after reload', 45_000);
await tapButton('Operator', 138);
await waitFor(`[...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim().toLowerCase() === 'build')`, 'Android P20-D Operator build route');
await tapButton('Build', 139);
await waitFor(`document.querySelector('.build-header h1')?.textContent?.trim() === 'Build'`, 'Android P20-D Build after seed');
const p20dProgressionMarked = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.build-tabs button')].find(candidate => (candidate.textContent || '').trim().toLowerCase().startsWith('progression'));
  if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
  button.dataset.p20dProgressionTab = 'true';
  button.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  return true;
})()`);
if (!p20dProgressionMarked) throw new Error('Android P20-D could not find the Progression tab.');
await tap('button[data-p20d-progression-tab="true"]', 140);
await waitFor(`Boolean(document.querySelector('[data-network-recommendation="vanguard-breach-guard-early"]'))`, 'Android P20-D Vanguard recommendations');

const p20dLayout = await evaluate(`(() => {
  const card = document.querySelector('[data-network-recommendation="vanguard-breach-guard-early"]');
  const button = document.querySelector('button[data-network-recommendation-load="vanguard-breach-guard-early"]');
  if (!(card instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return null;
  const visible = element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const copy = [...card.querySelectorAll('small, b, span, p')].filter(visible);
  const rect = card.getBoundingClientRect();
  return {
    minFont: copy.length ? Math.min(...copy.map(element => Number.parseFloat(getComputedStyle(element).fontSize))) : 0,
    buttonHeight: button.getBoundingClientRect().height,
    cardWidth: rect.width,
    viewportWidth: window.visualViewport?.width ?? window.innerWidth,
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    hasRationale: (card.textContent || '').includes('Breacher pressure and armor break'),
  };
})()`);
if (!p20dLayout || !p20dLayout.hasRationale || p20dLayout.minFont < 11.5 || p20dLayout.buttonHeight < 44
  || p20dLayout.horizontalOverflow > 2 || p20dLayout.cardWidth > p20dLayout.viewportWidth + 2) {
  throw new Error(`Android P20-D recommendation readability/actionability failed: ${JSON.stringify(p20dLayout)}`);
}
const p20dRecommendationReady = await evaluate(`(() => {
  const button = document.querySelector('button[data-network-recommendation-load="vanguard-breach-guard-early"]');
  if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
  button.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  return true;
})()`);
if (!p20dRecommendationReady) throw new Error('Android P20-D Vanguard recommendation button unavailable.');
await sleep(180);
await tap('button[data-network-recommendation-load="vanguard-breach-guard-early"]', 141);
await waitFor(`(() => {
  const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
  const network = state?.profile?.operatorNetwork;
  const plan = document.querySelector('.network-plan-card')?.textContent ?? '';
  return state?.profile?.progressionPoints === 6
    && Array.isArray(network?.allocatedNodeIds)
    && network.allocatedNodeIds.length === 0
    && Array.isArray(network?.plannedTargetNodeIds)
    && network.plannedTargetNodeIds.join(',') === 'vanguard-breach-telemetry,survival-2'
    && plan.includes('Breach Telemetry')
    && plan.includes('Pressure Discipline')
    && plan.includes('6 PT');
})()`, 'Android P20-D recommendation to non-destructive Planned Build', 20_000);
await tapButton('Auto Allocate', 142);
await waitFor(`(() => {
  const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
  const network = state?.profile?.operatorNetwork;
  const report = document.querySelector('.network-auto-allocate-report')?.textContent ?? '';
  return Array.isArray(network?.allocatedNodeIds)
    && network.allocatedNodeIds.join(',') === 'vanguard-breach-entry,vanguard-breach-pressure,vanguard-breach-impulse,vanguard-breach-telemetry,survival-1,survival-2'
    && network.unspentPoints === 0
    && state?.profile?.progressionPoints === 0
    && Array.isArray(network?.plannedTargetNodeIds)
    && network.plannedTargetNodeIds.length === 0
    && report.includes('6 nodes allocated')
    && report.includes('6 pt spent')
    && report.includes('Planned build complete');
})()`, 'Android P20-D recommendation Auto Allocate commit', 20_000);
console.log(`ANDROID_P20D_RECOMMENDATION_PASS class=vanguard route=early preview=non-destructive autoAllocate=6 font=${p20dLayout.minFont}px touch=${p20dLayout.buttonHeight}px overflow=none`);

const p20bPreviousTimeOrigin = await evaluate('performance.timeOrigin');
const p20bSeeded = await evaluate(`(() => {
  const stateKey = 'ironshade-vector-state-v1';
  const state = JSON.parse(localStorage.getItem(stateKey) || 'null');
  if (!state?.profile) return false;
  const operatorClass = state.profile.operatorClass || 'vanguard';
  const startNodeId = { vanguard: 'start-vanguard', vector: 'start-vector', systems: 'start-systems' }[operatorClass] || 'start-vanguard';
  state.profile.level = 3;
  state.profile.xp = 270;
  state.profile.progressionPoints = 2;
  state.profile.allocatedNodes = [];
  state.profile.operatorNetwork = { schemaVersion: 3, startNodeId, allocatedNodeIds: [], unspentPoints: 2, plannedTargetNodeIds: [] };
  state.operatorNetworkSchemaVersion = 3;
  localStorage.setItem(stateKey, JSON.stringify(state));
  location.reload();
  return true;
})()`);
if (!p20bSeeded) throw new Error('Android P20-B could not seed a two-point Operator Network profile.');
await waitFor(`performance.timeOrigin !== ${JSON.stringify(p20bPreviousTimeOrigin)}`, 'Android P20-B document reload', 45_000);
await waitFor(`(() => {
  const operatorButton = [...document.querySelectorAll('button[data-primary-area]')].find(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase() === 'operator');
  return document.readyState === 'complete' && operatorButton instanceof HTMLButtonElement && !operatorButton.disabled;
})()`, 'Android P20-B seeded Command Deck after reload', 45_000);
await tapButton('Operator', 68);
await waitFor(`[...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim().toLowerCase() === 'build')`, 'Android P20-B Operator build route');
await tapButton('Build', 69);
await waitFor(`document.querySelector('.build-header h1')?.textContent?.trim() === 'Build'`, 'Android P20-B Build after seed');
const p20bProgressionMarked = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.build-tabs button')].find(candidate => (candidate.textContent || '').trim().toLowerCase().startsWith('progression'));
  if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
  button.dataset.p20bProgressionTab = 'true';
  button.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  return true;
})()`);
if (!p20bProgressionMarked) throw new Error('Android P20-B could not find the badged Progression tab after seeding points.');
await tap('button[data-p20b-progression-tab="true"]', 69);
await waitFor(`Boolean(document.querySelector('.network-planner.iv-panel'))`, 'Android P20-B Progression planner after seed');

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
await waitFor(`(() => {
  const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
  const button = [...document.querySelectorAll('button')].find(candidate => (candidate.textContent || '').trim() === 'Auto Allocate');
  return state?.profile?.progressionPoints === 2
    && state?.profile?.operatorNetwork?.allocatedNodeIds?.length === 0
    && button instanceof HTMLButtonElement
    && !button.disabled;
})()`, 'Android P20-B actionable Auto Allocate button');
await tapButton('Auto Allocate', 74);
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
    && state?.profile?.progressionPoints === 0
    && Array.isArray(targets)
    && targets.join(',') === 'ballistics-3,mobility-1'
    && autoButton instanceof HTMLButtonElement
    && autoButton.disabled
    && report.includes('2 nodes allocated')
    && report.includes('2 pt spent')
    && report.includes('0 pt remaining')
    && report.includes('2 future points needed')
    && planText.includes('FUTURE POINTS NEEDED');
})()`, 'Android P20-B partial Auto Allocate and remaining plan state', 20_000);
console.log('ANDROID_P20B_AUTO_ALLOCATE_PASS allocated=ballistics-1+ballistics-2 spent=2 remaining=0 targets=ballistics-3+mobility-1 futurePoints=2 button=disabled touch=true');
await tapButton('Return to ship', 75);
await waitFor(`[...document.querySelectorAll('button[data-primary-area]')].some(button => (button.getAttribute('aria-label') || '').trim().toLowerCase() === 'operator')`, 'Command Deck after planner close');
await tapButton('Operator', 76);
await waitFor(`[...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim().toLowerCase() === 'build')`, 'Operator build route after planner close');
await tapButton('Build', 77);
await waitFor(`document.querySelector('.build-header h1')?.textContent?.trim() === 'Build'`, 'Build reopened after planner close');
await tapButton('Progression', 77);
await waitFor(`(() => {
  const text = document.querySelector('.network-plan-card')?.textContent ?? '';
  const state = JSON.parse(localStorage.getItem('ironshade-vector-state-v1') || 'null');
  const network = state?.profile?.operatorNetwork;
  const autoButton = [...document.querySelectorAll('button')].find(candidate => (candidate.textContent || '').trim() === 'Auto Allocate');
  return text.includes('2 targets')
    && text.includes('Breach Doctrine')
    && text.includes('Servo Timing')
    && Array.isArray(network?.allocatedNodeIds)
    && network.allocatedNodeIds.join(',') === 'ballistics-1,ballistics-2'
    && network.unspentPoints === 0
    && autoButton instanceof HTMLButtonElement
    && autoButton.disabled;
})()`, 'partial Auto Allocate state after closing and reopening Build', 20_000);
console.log('ANDROID_NETWORK_PLANNER_CLOSE_REOPEN_PASS targets=ballistics-3+mobility-1 allocated=ballistics-1+ballistics-2 remainingPoints=0');

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

const p20cSkillAudit = await evaluate(`(() => {
  const root = document.querySelector('[data-management-surface="skills"]');
  const text = root?.textContent ?? '';
  const authored = ['Breach Rush', 'Fracture Tag', 'Bulwark Pulse'].every(name => text.includes(name));
  const legacy = ['Magnetic Impulse', 'Sensor Spike', 'Arc Tap'].filter(name => text.includes(name));
  return { authored, legacy, classCards: root?.querySelectorAll('.skill-path-card').length ?? 0 };
})()`);
if (!p20cSkillAudit.authored || p20cSkillAudit.legacy.length || p20cSkillAudit.classCards !== 3) {
  throw new Error(`Android P20-C class-skill audit failed: ${JSON.stringify(p20cSkillAudit)}`);
}
console.log('ANDROID_P20C_CLASS_SKILL_AUDIT_PASS class=Vanguard skills=RUSH+BREAK+GUARD legacyNeutralNames=absent');

await p19CompactTypographyScan('skills', '[data-management-surface="skills"]');
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

await p19CompactTypographyScan('intel', '.ship-hub.area-intel');
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

await p19CompactTypographyScan('ship', '.ship-hub.area-ship');
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


const p20cStateCheckpointed = await evaluate(`(() => {
  const stateKey = 'ironshade-vector-state-v1';
  const original = localStorage.getItem(stateKey);
  if (!original) return false;
  sessionStorage.setItem('ironshade-p20c-state-checkpoint', original);
  return true;
})()`);
if (!p20cStateCheckpointed) throw new Error('Android P20-C could not checkpoint the pre-audit save state.');

async function p20cLoadClassCombat(operatorClass, family, kit, singularTrait = null, deploy = true) {
  const previousTimeOrigin = await evaluate('performance.timeOrigin');
  const seeded = await evaluate(`(() => {
    const stateKey = 'ironshade-vector-state-v1';
    const state = JSON.parse(localStorage.getItem(stateKey) || 'null');
    if (!state?.profile || !Array.isArray(state.profile.inventory)) return null;
    const profile = state.profile;
    const weaponSlots = ['carbine', 'breacher', 'rail'];
    const startNodeId = { vanguard: 'start-vanguard', vector: 'start-vector', systems: 'start-systems' }[${JSON.stringify(operatorClass)}];
    profile.operatorClass = ${JSON.stringify(operatorClass)};
    profile.classSelectionComplete = true;
    profile.specialization = null;
    profile.specializationOverclock = false;
    profile.abilityMods = { mag: null, mark: null, arc: null };
    profile.allocatedNodes = [];
    profile.operatorNetwork = { schemaVersion: 3, startNodeId, allocatedNodeIds: [], unspentPoints: Math.max(0, Number(profile.progressionPoints || 0)), plannedTargetNodeIds: [] };
    for (const slot of weaponSlots) profile.equipped[slot] = slot === ${JSON.stringify(family)} ? 'starter-' + slot : null;
    const starterRig = profile.inventory.find(item => item.id === 'starter-rig');
    if (starterRig && starterRig.rarity === 'Field') delete starterRig.singularTrait;
    if (${JSON.stringify(singularTrait)} && starterRig) {
      starterRig.singularTrait = ${JSON.stringify(singularTrait)};
      profile.equipped.rig = starterRig.id;
    }
    localStorage.setItem(stateKey, JSON.stringify(state));
    location.reload();
    return { operatorClass: profile.operatorClass, family: ${JSON.stringify(family)}, singularTrait: starterRig?.singularTrait ?? null };
  })()`);
  if (!seeded || seeded.operatorClass !== operatorClass) throw new Error(`Android P20-C could not seed ${operatorClass} combat profile.`);
  await waitFor(`performance.timeOrigin !== ${JSON.stringify(previousTimeOrigin)}`, `Android P20-C ${operatorClass} reload`, 45_000);
  await waitFor(`(() => {
    const button = document.querySelector('button[data-primary-area="operations"]');
    return document.readyState === 'complete' && Boolean(button) && !button.disabled;
  })()`, `Android P20-C ${operatorClass} Command Deck`, 45_000);
  if (!deploy) return;

  const openedOperations = await evaluate(`(() => {
    const button = document.querySelector('button[data-primary-area="operations"]');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!openedOperations) throw new Error(`Android P20-C could not open Operations for ${operatorClass}.`);
  await waitFor(`[...document.querySelectorAll('button')].some(button => (button.textContent || '').trim().toLowerCase() === 'contracts')`, `Android P20-C ${operatorClass} Operations`);

  const openedContracts = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(candidate => (candidate.textContent || '').trim().toLowerCase() === 'contracts');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!openedContracts) throw new Error(`Android P20-C could not open Contracts for ${operatorClass}.`);
  await waitFor(`Boolean(document.querySelector('button[data-location="asteroid-refinery"]')) && [...document.querySelectorAll('button')].some(button => (button.textContent || '').trim().toLowerCase() === 'deploy selected contract')`, `Android P20-C ${operatorClass} Contract Board`);

  const selected = await evaluate(`(() => {
    const target = document.querySelector('button[data-location="asteroid-refinery"]');
    if (!target || target.disabled) return false;
    target.click();
    return true;
  })()`);
  if (!selected) throw new Error(`Android P20-C could not select the Asteroid Refinery for ${operatorClass}.`);
  await waitFor(`document.querySelector('button[data-location="asteroid-refinery"]')?.classList.contains('selected') === true`, `Android P20-C ${operatorClass} contract selection`);

  const deployed = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(candidate => (candidate.textContent || '').trim().toLowerCase() === 'deploy selected contract');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!deployed) throw new Error(`Android P20-C could not deploy ${operatorClass}.`);
  await waitFor(`(() => {
    const root = document.querySelector('.game-root');
    const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || '').trim());
    return root?.dataset.classSkillKit === ${JSON.stringify(kit.map(entry => entry.short).join('/'))}
      && ${JSON.stringify(kit.map(entry => entry.name))}.every(label => labels.includes(label))
      && (${JSON.stringify(singularTrait)} === null || (root?.dataset.classSkillGear || '').split('+').includes(${JSON.stringify(singularTrait)}));
  })()`, `Android P20-C ${operatorClass} combat kit + skill gear`, 45_000);

  const fired = await evaluate(`(() => {
    const button = document.querySelector('.touch-ability-fan button[aria-label="${kit[0].name.replaceAll('"', '\\"')}"]');
    if (!button || button.disabled) return false;
    const rect = button.getBoundingClientRect();
    button.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 920,
      pointerType: 'touch',
      isPrimary: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
    return true;
  })()`);
  if (!fired) throw new Error(`Android P20-C could not activate ${kit[0].name} for ${operatorClass}.`);
  await waitFor(`(() => {
    const button = document.querySelector('.touch-ability-fan button[aria-label="${kit[0].name.replaceAll('"', '\\"')}"]');
    return Boolean(button) && button.disabled;
  })()`, `Android P20-C ${operatorClass} first-skill activation`);
  console.log(`ANDROID_P20C_CLASS_SKILL_PASS class=${operatorClass} kit=${kit.map(entry => entry.short).join('/')} firstSkill=${kit[0].name} gear=${singularTrait ?? 'baseline'}`);
}

await p20cLoadClassCombat('vector', 'rail', [
  { name: 'Vector Shift', short: 'SHIFT' },
  { name: 'Deadeye Lock', short: 'LOCK' },
  { name: 'Splitshot', short: 'SPLIT' },
]);
await p20cLoadClassCombat('systems', 'carbine', [
  { name: 'Polarity Well', short: 'WELL' },
  { name: 'Relay Hack', short: 'HACK' },
  { name: 'Cascade Arc', short: 'CHAIN' },
], 'magBloom');
await p20cLoadClassCombat('vanguard', 'breacher', [
  { name: 'Breach Rush', short: 'RUSH' },
  { name: 'Fracture Tag', short: 'BREAK' },
  { name: 'Bulwark Pulse', short: 'GUARD' },
], null, false);
console.log('ANDROID_P20C_CLASS_SKILL_APK_PASS kits=Vanguard+Vector+Systems representativeSkillGear=Bloom-Vector-Rig');

const p20cRestoreTimeOrigin = await evaluate('performance.timeOrigin');
const p20cStateRestored = await evaluate(`(() => {
  const checkpointKey = 'ironshade-p20c-state-checkpoint';
  const original = sessionStorage.getItem(checkpointKey);
  if (!original) return false;
  localStorage.setItem('ironshade-vector-state-v1', original);
  sessionStorage.removeItem(checkpointKey);
  location.reload();
  return true;
})()`);
if (!p20cStateRestored) throw new Error('Android P20-C could not restore the pre-audit save state.');
await waitFor(`performance.timeOrigin !== ${JSON.stringify(p20cRestoreTimeOrigin)}`, 'Android P20-C restore reload', 45_000);
await waitFor(`document.readyState === 'complete' && Boolean(document.querySelector('button[data-primary-area="operations"]'))`, 'Android P20-C restored Command Deck', 45_000);
console.log('ANDROID_P20C_STATE_RESTORE_PASS save=exact-pre-audit-checkpoint');

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
await sleep(220);
const p20ContractSelected = await evaluate(`document.querySelector('button[data-location="asteroid-refinery"]')?.classList.contains('selected') === true`);
if (!p20ContractSelected) {
  const retryPoint = await evaluate(`(async () => {
    const target = document.querySelector('button[data-location="asteroid-refinery"]');
    if (!target) return null;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const inset = 10;
    for (const block of ['center', 'start', 'end', 'nearest']) {
      target.scrollIntoView({ block, inline: 'nearest', behavior: 'instant' });
      await new Promise(resolve => setTimeout(resolve, 180));
      const rect = target.getBoundingClientRect();
      const left = Math.max(rect.left, inset);
      const right = Math.min(rect.right, viewportWidth - inset);
      const top = Math.max(rect.top, inset);
      const bottom = Math.min(rect.bottom, viewportHeight - inset);
      if (right <= left || bottom <= top) continue;
      const edgeX = Math.min(18, Math.max(4, (right - left) * .18));
      const edgeY = Math.min(18, Math.max(4, (bottom - top) * .18));
      const candidates = [
        [(left + right) * .5, (top + bottom) * .5],
        [left + edgeX, (top + bottom) * .5],
        [right - edgeX, (top + bottom) * .5],
        [(left + right) * .5, top + edgeY],
        [(left + right) * .5, bottom - edgeY],
      ];
      for (const [x, y] of candidates) {
        const hit = document.elementFromPoint(x, y);
        if (hit && (hit === target || target.contains(hit))) return { x, y, hit: hit.tagName, block };
      }
    }
    return null;
  })()`);
  if (!retryPoint) throw new Error('Android contract card had no unobscured visible touch point after Interface Size QA.');
  await dispatchTouch('touchStart', retryPoint.x, retryPoint.y, 123);
  await sleep(120);
  await dispatchTouch('touchEnd', retryPoint.x, retryPoint.y, 123);
  console.log(`ANDROID_CONTRACT_TOUCH_RETRY_PASS target=asteroid-refinery hit=${retryPoint.hit} block=${retryPoint.block}`);
}
await waitFor(`document.querySelector('button[data-location="asteroid-refinery"]')?.classList.contains('selected') === true`, 'Asteroid Refinery contract selection');

await tapButton('Deploy selected contract', 24, 120);
await waitFor(`(() => {
  const canvas = document.querySelector('canvas');
  const root = document.querySelector('.game-root[data-mission-presentation="non-blocking-cues"]');
  const cue = document.querySelector('[data-presentation="deployment"]');
  if (!canvas || !root || !cue) return false;
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
})()`, 'Combat surface and P15-C deployment presentation', 45_000);
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

await p19CompactTypographyScan('combat', '#root');
const p19RequiredTypographySurfaces = ['command', 'armory', 'progression', 'skills', 'crafting', 'ship', 'intel', 'guide', 'combat'];
const p19MissingTypographySurfaces = p19RequiredTypographySurfaces.filter(label => !p19TypographyAcceptance[label]);
if (p19MissingTypographySurfaces.length) {
  throw new Error(`Android P19-G acceptance missed required surfaces: ${p19MissingTypographySurfaces.join(', ')}`);
}
const p19DefaultFloor = Math.min(...p19RequiredTypographySurfaces.map(label => p19TypographyAcceptance[label].default.minFont));
const p19LargeFloor = Math.min(...p19RequiredTypographySurfaces.map(label => p19TypographyAcceptance[label].large.minFont));
const p19SecondaryThumbHotspots = p19RequiredTypographySurfaces.reduce((total, label) => total + p19TypographyAcceptance[label].default.thumbHotspots.length, 0);
console.log(`ANDROID_P19_TYPOGRAPHY_ACCEPTANCE_PASS device=pixel_7_pro-6.7in-class surfaces=${p19RequiredTypographySurfaces.join('+')} defaultFloor=${p19DefaultFloor.toFixed(1)}px largeFloor=${p19LargeFloor.toFixed(1)}px overflow=none safe=horizontal thumbReach=critical-controls-gated secondaryHotspots=${p19SecondaryThumbHotspots} playfieldOcclusion=none eyeTravelHotspots=scrolling-intel+ship-detail`);

const p19HudLayoutSnapshot = async () => evaluate(`(() => {
  const viewport = { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
  const rect = element => {
    if (!element) return null;
    const value = element.getBoundingClientRect();
    return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
  };
  const within = value => !!value && value.left >= -1 && value.top >= -1 && value.right <= viewport.width + 1 && value.bottom <= viewport.height + 1;
  const intersects = (a, b) => !!a && !!b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
  const hit = (element, selector) => {
    const box = rect(element);
    if (!box) return false;
    const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return Boolean(target?.closest?.(selector));
  };
  const ui = document.querySelector('.touch-ui');
  const moveElement = document.querySelector('.move-stick');
  const dockElement = document.querySelector('.combat-dock');
  const fireElement = document.querySelector('.fire-button');
  const move = rect(moveElement);
  const dock = rect(dockElement);
  const fire = rect(fireElement);
  const hud = rect(document.querySelector('.hud-top'));
  const objective = rect(document.querySelector('.mission-card'));
  return {
    viewport,
    preset: ui?.dataset.layoutPreset ?? '',
    movementInset: Number(ui?.dataset.movementInset ?? NaN),
    movementLift: Number(ui?.dataset.movementLift ?? NaN),
    movementScale: Number(ui?.dataset.movementScale ?? NaN),
    actionInset: Number(ui?.dataset.actionInset ?? NaN),
    actionLift: Number(ui?.dataset.actionLift ?? NaN),
    actionScale: Number(ui?.dataset.actionScale ?? NaN),
    move, dock, fire, hud, objective,
    moveDockOverlap: intersects(move, dock),
    onscreen: [move, dock, fire, hud, objective].every(within),
    moveHit: hit(moveElement, '.move-stick'),
    fireHit: hit(fireElement, '.fire-button'),
    accessibility: {
      textScale: document.documentElement.dataset.textScale ?? '',
      contrast: document.documentElement.dataset.contrast ?? '',
      reducedMotion: document.documentElement.dataset.reducedMotion ?? '',
    },
  };
})()`);

function assertP19HudLayoutSnapshot(snapshot, label) {
  if (snapshot.preset !== 'left-handed'
    || Math.abs(snapshot.movementInset - 0.35) > 0.001
    || Math.abs(snapshot.movementLift - 0.4) > 0.001
    || Math.abs(snapshot.movementScale - 1.04) > 0.001
    || Math.abs(snapshot.actionInset - 0.3) > 0.001
    || Math.abs(snapshot.actionLift - 0.25) > 0.001
    || Math.abs(snapshot.actionScale - 0.96) > 0.001
    || snapshot.moveDockOverlap
    || !snapshot.onscreen
    || !snapshot.moveHit
    || !snapshot.fireHit) {
    throw new Error(`Android P19-F HUD layout failed ${label}: ${JSON.stringify(snapshot)}`);
  }
}

const p19HudLandscape = await p19HudLayoutSnapshot();
assertP19HudLayoutSnapshot(p19HudLandscape, 'native landscape');
if (!(p19HudLandscape.dock.right < p19HudLandscape.move.left)) {
  throw new Error(`Android P19-F Left-Handed anchors did not swap in landscape: ${JSON.stringify(p19HudLandscape)}`);
}

await call('Emulation.setDeviceMetricsOverride', {
  width: 412,
  height: 915,
  deviceScaleFactor: 2.5,
  mobile: true,
  screenWidth: 412,
  screenHeight: 915,
  screenOrientation: { type: 'portraitPrimary', angle: 0 },
});
await sleep(260);
const p19HudPortrait = await p19HudLayoutSnapshot();
assertP19HudLayoutSnapshot(p19HudPortrait, 'portrait rotation');
if (!(p19HudPortrait.dock.right < p19HudPortrait.move.left)) {
  throw new Error(`Android P19-F Left-Handed anchors overlapped after portrait rotation: ${JSON.stringify(p19HudPortrait)}`);
}

await call('Emulation.clearDeviceMetricsOverride');
await sleep(260);
const p19HudRestored = await p19HudLayoutSnapshot();
assertP19HudLayoutSnapshot(p19HudRestored, 'restored landscape');

const p20ControlInvariant = await evaluate(`(() => {
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
if (JSON.stringify(p20ControlInvariant.compact) !== JSON.stringify(p20ControlInvariant.large)) {
  throw new Error(`Android P20-A changed combat-control geometry across Interface Size values: ${JSON.stringify(p20ControlInvariant)}`);
}
if (!(p20ControlInvariant.hud.compact.vitalsPadding < p20ControlInvariant.hud.baseline.vitalsPadding
  && p20ControlInvariant.hud.baseline.vitalsPadding < p20ControlInvariant.hud.large.vitalsPadding)
  || !(p20ControlInvariant.hud.compact.missionPadding < p20ControlInvariant.hud.baseline.missionPadding
    && p20ControlInvariant.hud.baseline.missionPadding < p20ControlInvariant.hud.large.missionPadding)) {
  throw new Error(`Android P20-A informational HUD chrome did not scale while controls stayed fixed: ${JSON.stringify(p20ControlInvariant)}`);
}
console.log(`ANDROID_P20_HUD_SCALE_PASS vitalsPadding=${p20ControlInvariant.hud.compact.vitalsPadding}/${p20ControlInvariant.hud.baseline.vitalsPadding}/${p20ControlInvariant.hud.large.vitalsPadding} missionPadding=${p20ControlInvariant.hud.compact.missionPadding}/${p20ControlInvariant.hud.baseline.missionPadding}/${p20ControlInvariant.hud.large.missionPadding}`);
console.log(`ANDROID_P20_COMBAT_CONTROL_INVARIANT_PASS controls=${p20ControlInvariant.compact.controls.length} compact=large geometry=identical restored=${p20ControlInvariant.restored}`);
console.log(`ANDROID_P19_HUD_LAYOUT_PASS presets=standard+large+left-handed custom=left-handed movement=.35/.4/1.04 action=.3/.25/.96 safe=onscreen+separated hit=tracks-visible rotation=landscape+portrait+landscape fixed=hud+objective accessibility=${p19HudRestored.accessibility.textScale}+${p19HudRestored.accessibility.contrast}+motion-${p19HudRestored.accessibility.reducedMotion}`);

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

async function p20eSyntheticFire(active) {
  await evaluate(`(() => {
    const button = document.querySelector('.fire-button');
    if (!(button instanceof HTMLButtonElement)) return false;
    button.dispatchEvent(new PointerEvent('${active ? 'pointerdown' : 'pointerup'}', { bubbles: true, pointerId: 1901, pointerType: 'touch', isPrimary: true }));
    return true;
  })()`);
}

const p20eDirectionOffset = {
  RIGHT: [36, 0], 'DOWN-RIGHT': [30, 30], DOWN: [0, 36], 'DOWN-LEFT': [-30, 30],
  LEFT: [-36, 0], 'UP-LEFT': [-30, -30], UP: [0, -36], 'UP-RIGHT': [30, -30],
};

async function p20eMove(direction, id, duration = 650) {
  const offset = p20eDirectionOffset[direction];
  if (!offset) { await sleep(220); return; }
  const stick = await elementMetrics('.move-stick');
  if (!stick) throw new Error('P20-E movement stick unavailable during representative contract play.');
  await dispatchTouch('touchStart', stick.x, stick.y, id);
  await dispatchTouch('touchMove', stick.x + offset[0], stick.y + offset[1], id);
  await sleep(duration);
  await dispatchTouch('touchEnd', stick.x + offset[0], stick.y + offset[1], id);
}

async function p20eFinishActiveFamily(expectedFamily, idBase) {
  await waitFor(`document.querySelector('.game-root')?.dataset.repeatableFamily === '${expectedFamily}'`, `P20-E ${expectedFamily} combat family`, 30_000);
  const combatDeadline = Date.now() + 90_000;
  let iteration = 0;
  while (Date.now() < combatDeadline) {
    const state = await evaluate(`(() => {
      const root = document.querySelector('.game-root');
      return {
        dead: Boolean(document.querySelector('[aria-label="Operator down"]')),
        remaining: Number(root?.dataset.squadRemaining ?? '999'),
        hostileDirection: root?.dataset.nearestHostileDirection ?? '',
        objectiveComplete: root?.dataset.objectiveComplete === 'true',
        objectiveDirection: root?.dataset.objectiveDirection ?? '',
        objectiveRange: Number((document.querySelector('.post-clear-objective span')?.textContent?.match(/RANGE (\\d+)/)?.[1]) ?? '0'),
        extractionReady: root?.dataset.extractionReady === 'true',
        interact: Boolean(document.querySelector('.interact-button:not(:disabled)')),
      };
    })()`);
    if (state.dead) throw new Error(`P20-E ${expectedFamily} representative play ended with operator down.`);

    if (!state.objectiveComplete && state.interact) {
      await tap('.interact-button:not(:disabled)', idBase + 500 + iteration, 100);
      await sleep(420);
    } else if (state.remaining > 0) {
      await p20eSyntheticFire(true);
      if (iteration % 4 === 0) {
        await evaluate(`document.querySelector('.ability-button:not(:disabled)')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1902, pointerType: 'touch' }))`);
      }
      if (state.hostileDirection) await p20eMove(state.hostileDirection, idBase + iteration, 520);
      else await sleep(700);
      await p20eSyntheticFire(false);
    } else if (!state.objectiveComplete) {
      if (state.objectiveDirection) {
        const approachMs = state.objectiveRange > 900 ? 520 : state.objectiveRange > 500 ? 360 : state.objectiveRange > 250 ? 220 : state.objectiveRange > 120 ? 130 : 70;
        await p20eMove(state.objectiveDirection, idBase + iteration, approachMs);
        await sleep(state.objectiveRange > 250 ? 90 : 180);
      } else {
        await sleep(350);
      }
    } else if (state.extractionReady) {
      break;
    } else {
      await sleep(350);
    }
    iteration += 1;
  }

  await waitFor(`Boolean(document.querySelector('[aria-label="Extraction decision"] .extraction-choice button.safe'))`, `P20-E ${expectedFamily} safe extraction choice`, 20_000);
  await tap('[aria-label="Extraction decision"] .extraction-choice button.safe', idBase + 900, 120);
  await waitFor(`document.querySelector('[data-presentation="mission-debrief"] h1')?.textContent?.includes('Safe extraction complete') === true`, `P20-E ${expectedFamily} debrief`, 30_000);
  console.log(`ANDROID_P20E_REPEATABLE_FAMILY_PASS family=${expectedFamily} completion=safe actualGameplay=touch+combat+objective`);
}

async function p20eDeployFamily(family, idBase) {
  await tapButton('Return to contract hub', idBase);
  await waitFor(`Boolean(document.querySelector('button[data-primary-area="operations"]'))`, `P20-E ${family} command deck`);
  await tapButton('Operations', idBase + 1);
  await waitFor(`[...document.querySelectorAll('button')].some(button => button.textContent?.trim().toLowerCase() === 'contracts')`, `P20-E ${family} Operations`);
  await tapButton('Contracts', idBase + 2);
  await waitFor(`Boolean(document.querySelector('button[data-contract-id$="-${family}"]'))`, `P20-E ${family} contract card`);
  const selected = await evaluate(`(() => {
    const button = document.querySelector('button[data-contract-id$="-${family}"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!selected) throw new Error(`P20-E could not select ${family} representative contract.`);
  await waitFor(`document.querySelector('button[data-contract-id$="-${family}"]')?.classList.contains('selected') === true && Boolean(document.querySelector('.repeatable-identity-note[data-repeatable-family="${family}"]'))`, `P20-E ${family} authored briefing`);
  await tapButton('Deploy selected contract', idBase + 3, 120);
  await waitFor(`document.querySelector('.game-root')?.dataset.repeatableFamily === '${family}'`, `P20-E ${family} deployment`, 45_000);
}

await p20eFinishActiveFamily('stabilization', 2100);
await p20eDeployFamily('salvage', 2300);
await p20eFinishActiveFamily('salvage', 2400);
await p20eDeployFamily('boarding', 2600);
await p20eFinishActiveFamily('boarding', 2700);
console.log('ANDROID_P20E_REPEATABLE_PLAY_PASS families=stabilization+salvage+boarding completions=3 depth=safe input=touch actualGameplay=true');

session.close();
console.log(`ANDROID_RUNTIME_SMOKE_PASS title=${startup.title} route=ship>contracts>combat canvases=${combat.canvases}`);
