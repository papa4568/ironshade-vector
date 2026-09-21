const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const timeoutMs = Number(process.env.ANDROID_SMOKE_TIMEOUT_MS ?? 75_000);
const startedAt = Date.now();
const resumeOnly = process.env.ANDROID_RESUME_CHECK === '1';
const resumeProcessMode = process.env.ANDROID_RESUME_PROCESS_MODE ?? 'preserved';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function validRenderBudget(value) {
  if (typeof value !== 'string' || !value) return false;
  const parts = value.split('+');
  if (parts.length !== 5) return false;
  const fields = Object.fromEntries(parts.map(part => {
    const separator = part.indexOf(':');
    return separator > 0 ? [part.slice(0, separator), part.slice(separator + 1)] : ['', ''];
  }));
  const required = ['pixel', 'shadow', 'vfx', 'transparency', 'detail'];
  if (!required.every(key => Object.prototype.hasOwnProperty.call(fields, key))) return false;
  const pixel = Number(fields.pixel);
  const shadow = Number(fields.shadow);
  const vfx = Number(fields.vfx);
  const transparency = Number(fields.transparency);
  const detail = Number(fields.detail);
  return Number.isFinite(pixel) && pixel > 0 && pixel <= 1
    && Number.isInteger(shadow) && shadow >= 0 && shadow <= 2048
    && Number.isFinite(vfx) && vfx > 0 && vfx <= 1
    && Number.isFinite(transparency) && transparency > 0 && transparency <= 1
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
      budget: canvas?.dataset.renderBudget ?? '',
      environment: canvas?.dataset.environmentVisual ?? '',
      canvases: document.querySelectorAll('canvas').length,
      touch: Boolean(document.querySelector('[aria-label="Touch combat controls"]') && document.querySelector('.move-stick') && document.querySelector('.fire-button') && document.querySelector('.dodge-button')),
    };
  })()`);
  if (!['balanced', 'performance'].includes(resumed.tier)) {
    throw new Error(`Android resume did not restore a mobile render tier: ${JSON.stringify(resumed)}`);
  }
  if (!validRenderBudget(resumed.budget)) {
    throw new Error(`Android resume render budget telemetry is malformed: ${JSON.stringify(resumed)}`);
  }
  if (!resumed.touch || resumed.canvases < 1) {
    throw new Error(`Android resume did not restore combat/touch surfaces: ${JSON.stringify(resumed)}`);
  }
  console.log(`ANDROID_LIFECYCLE_RESUME_PASS process=${resumeProcessMode} tier=${resumed.tier} budget=${resumed.budget} environment=${resumed.environment} canvases=${resumed.canvases}`);
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

await tapButton('Equipment', 31);
await waitFor(`(() => {
  const text = document.body?.innerText ?? '';
  const buttons = [...document.querySelectorAll('button')].map(button => (button.textContent || '').trim());
  return document.querySelector('.build-header h1')?.textContent?.trim() === 'Build' && buttons.includes('Skills');
})()`, 'Android Build surface for skill hierarchy');
await tapButton('Skills', 32);
await waitFor(`(() => {
  const text = document.body?.innerText ?? '';
  const cards = [...document.querySelectorAll('.skill-path-card')];
  return text.includes('Class Skill → Weapon Family → Lens/Evolution → Specialization/Capstone')
    && text.includes('SHARED LENSES')
    && text.includes('CLASS EVOLUTIONS')
    && document.querySelectorAll('.skill-path-overview > article').length === 4
    && cards.length === 3
    && cards.every(card => card.querySelectorAll('.skill-hierarchy-grid > div').length === 4)
    && Boolean(document.querySelector('button[data-skill-mod="mag-revector"]'))
    && Boolean(document.querySelector('button[data-skill-slot="mag"][data-skill-mod="standard"]'));
})()`, 'Android P8-H skill hierarchy', 20_000);
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
await tap('button[data-skill-mod="mag-revector"]', 33);
await waitFor(`document.querySelector('button[data-skill-mod="mag-revector"]')?.getAttribute('aria-pressed') === 'true' && (document.querySelector('.skill-path-card')?.textContent ?? '').includes('Lens · Revector Lens')`, 'Android touch Lens selection');
await evaluate(`document.querySelector('button[data-skill-slot="mag"][data-skill-mod="standard"]')?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })`);
await sleep(200);
await tap('button[data-skill-slot="mag"][data-skill-mod="standard"]', 34);
await waitFor(`document.querySelector('button[data-skill-slot="mag"][data-skill-mod="standard"]')?.getAttribute('aria-pressed') === 'true'`, 'Android touch Lens restore');
console.log(`ANDROID_SKILL_HIERARCHY_PASS stages=4 skills=3 options=${skillHierarchyLayout.buttonCount} touch=select+restore`);
await tapButton('Return to ship', 35);
await waitFor(`(() => {
  const text = (document.body?.innerText ?? '').toLowerCase();
  const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
  return (text.includes('command ready') || text.includes('command deck')) && labels.includes('operations');
})()`, 'Android Command Deck after skill hierarchy');

await tapButton('Operations', 21);
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
await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('field coach') && document.querySelectorAll('canvas').length > 0`, 'Combat surface', 45_000);
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
if (!(combat.text ?? '').toLowerCase().includes('field coach') || combat.canvases < 1) {
  throw new Error(`Android combat surface failed smoke validation: ${JSON.stringify(combat)}`);
}

await waitFor(`(() => {
  const canvas = document.querySelector('canvas[data-render-tier]');
  return Boolean(canvas?.dataset.renderTier && canvas?.dataset.renderBudget);
})()`, 'Android render tier telemetry', 20_000);

const renderTier = await evaluate(`(() => {
  const canvas = document.querySelector('canvas[data-render-tier]');
  return {
    tier: canvas?.dataset.renderTier ?? '',
    budget: canvas?.dataset.renderBudget ?? '',
  };
})()`);
if (!['balanced', 'performance'].includes(renderTier.tier)) {
  throw new Error(`Android coarse/mobile renderer started outside Balanced/Performance: ${JSON.stringify(renderTier)}`);
}
if (!validRenderBudget(renderTier.budget)) {
  throw new Error(`Android render budget telemetry is malformed: ${JSON.stringify(renderTier)}`);
}
console.log(`ANDROID_RENDER_TIER_PASS tier=${renderTier.tier} budget=${renderTier.budget}`);

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
  const touchButtons = [...document.querySelectorAll('.touch-button')].filter(visible).map(button => ({
    label: button.getAttribute('aria-label') || button.textContent?.trim().slice(0, 40) || button.className,
    rect: rect(button),
  }));
  return {
    viewport,
    canvas,
    move,
    dock,
    fire,
    dodge,
    hud,
    landscape: viewport.width > viewport.height,
    offscreen: [
      ['canvas', canvas], ['move', move], ['dock', dock], ['fire', fire], ['dodge', dodge], ['hud', hud],
      ...touchButtons.map(item => [item.label, item.rect]),
    ].filter(([, value]) => !within(value)).map(([label]) => label),
    undersized: touchButtons.filter(item => item.rect && (item.rect.width < 40 || item.rect.height < 40)).map(item => item.label),
    moveDockOverlap: intersects(move, dock),
    touchButtons: touchButtons.length,
  };
})()`);
if (!mobileLayout.landscape || !mobileLayout.canvas || mobileLayout.canvas.width < mobileLayout.viewport.width * 0.95 || mobileLayout.canvas.height < mobileLayout.viewport.height * 0.9) {
  throw new Error(`Android combat viewport/layout is invalid: ${JSON.stringify(mobileLayout)}`);
}
if (mobileLayout.offscreen.length || mobileLayout.undersized.length || mobileLayout.moveDockOverlap) {
  throw new Error(`Android combat controls failed safe-area/touch-target checks: ${JSON.stringify(mobileLayout)}`);
}
console.log(`ANDROID_MOBILE_LAYOUT_PASS viewport=${Math.round(mobileLayout.viewport.width)}x${Math.round(mobileLayout.viewport.height)} touchButtons=${mobileLayout.touchButtons} safe=onscreen+separated`);

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

const arsenalLock = await evaluate(`({
  mobileCycleAbsent: document.querySelector('.weapon-cycle') === null,
  desktopSelectorAbsent: document.querySelector('.desktop-weapons') === null,
  weapon: document.querySelector('.weapon-hud small')?.textContent ?? '',
})`);
if (!arsenalLock.mobileCycleAbsent || !arsenalLock.desktopSelectorAbsent || !/B-4|BREACH/i.test(arsenalLock.weapon)) {
  throw new Error(`Android class arsenal lock mismatch: ${JSON.stringify(arsenalLock)}`);
}

await tap('.ability-button:not(:disabled)', 15);
await waitFor(`(document.querySelector('.tutorial-coach')?.textContent ?? '').includes('FIELD COACH // 4/5')`, 'ability touch response', 15_000);

await tap('.dodge-button:not(:disabled)', 16);
await waitFor(`document.querySelector('.dodge-button')?.disabled === true`, 'dodge touch response', 15_000);

const scrollAfter = await evaluate(`({ x: window.scrollX, y: window.scrollY })`);
if (scrollAfter.x !== scrollBefore.x || scrollAfter.y !== scrollBefore.y) {
  throw new Error(`Android combat touch gestures moved the page: before=${JSON.stringify(scrollBefore)} after=${JSON.stringify(scrollAfter)}`);
}

console.log(`ANDROID_TOUCH_SMOKE_PASS move=drag aim=drag fire=hold ability=tap dodge=tap weapon=class-locked scroll=${scrollAfter.x},${scrollAfter.y}`);
session.close();
console.log(`ANDROID_RUNTIME_SMOKE_PASS title=${startup.title} route=ship>contracts>combat canvases=${combat.canvases}`);
