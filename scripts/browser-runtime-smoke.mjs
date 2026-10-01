import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const appUrl = process.env.BROWSER_E2E_APP_URL ?? 'http://127.0.0.1:4173/';
const requestedGraphicsPath = (process.env.BROWSER_E2E_GRAPHICS_PATH ?? '').trim();
const requireWebGpuComparison = process.env.BROWSER_E2E_REQUIRE_WEBGPU === '1';
const webGpuPresentationKnownGap = (process.env.BROWSER_E2E_WEBGPU_PRESENTATION_KNOWN_GAP ?? '').trim();
const webGpuSwiftShaderCi = process.env.BROWSER_E2E_WEBGPU_SWIFTSHADER === '1';
const skipSyntheticControllerAudit = process.env.BROWSER_E2E_SKIP_SYNTHETIC_CONTROLLER === '1';
const navigationUrl = (() => {
  if (!requestedGraphicsPath) return appUrl;
  const url = new URL(appUrl);
  url.searchParams.set('graphicsCompare', '1');
  url.searchParams.set('graphicsPath', requestedGraphicsPath);
  return url.toString();
})();
const timeoutMs = Number(process.env.BROWSER_E2E_TIMEOUT_MS ?? 75_000);
const startedAt = Date.now();
const viewportMode = process.env.BROWSER_E2E_VIEWPORT ?? 'desktop';
const targetLocation = process.env.BROWSER_E2E_LOCATION ?? 'asteroid-refinery';
const screenshotPath = process.env.BROWSER_E2E_SCREENSHOT ?? 'browser-e2e-smoke.png';
const commandScreenshotPath = process.env.BROWSER_E2E_COMMAND_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-command.png');
const classScreenshotPath = process.env.BROWSER_E2E_CLASS_SCREENSHOT ?? commandScreenshotPath.replace(/command/i, 'class');
const accessibilityScreenshotPath = process.env.BROWSER_E2E_ACCESSIBILITY_SCREENSHOT ?? commandScreenshotPath.replace(/command/i, 'accessibility');
const p22cBeforeScreenshotPath = process.env.BROWSER_E2E_P22C_BEFORE_SCREENSHOT ?? commandScreenshotPath.replace(/command/i, 'p22c-before');
const p22cAfterScreenshotPath = process.env.BROWSER_E2E_P22C_AFTER_SCREENSHOT ?? commandScreenshotPath.replace(/command/i, 'p22c-after');
const p22cContractScreenshotPath = process.env.BROWSER_E2E_P22C_CONTRACT_SCREENSHOT ?? commandScreenshotPath.replace(/command/i, 'p22c-contract');
const p22cDialogScreenshotPath = process.env.BROWSER_E2E_P22C_DIALOG_SCREENSHOT ?? commandScreenshotPath.replace(/command/i, 'p22c-dialog');
const p22cReportPath = process.env.BROWSER_E2E_P22C_REPORT ?? screenshotPath.replace(/\.png$/i, '.p22c.json');
const performanceReportPath = process.env.BROWSER_E2E_PERFORMANCE_REPORT ?? screenshotPath.replace(/\.png$/i, '.performance.json');
const p21bBeforeScreenshotPath = process.env.BROWSER_E2E_P21B_BEFORE_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21b-ibl-off.png');
const p21bAfterScreenshotPath = process.env.BROWSER_E2E_P21B_AFTER_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21b-ibl-on.png');
const p21cBeforeScreenshotPath = process.env.BROWSER_E2E_P21C_BEFORE_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21c-bloom-off.png');
const p21cAfterScreenshotPath = process.env.BROWSER_E2E_P21C_AFTER_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21c-bloom-on.png');
const p21d1BeforeScreenshotPath = process.env.BROWSER_E2E_P21D1_BEFORE_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21d1-contact-off.png');
const p21d1AfterScreenshotPath = process.env.BROWSER_E2E_P21D1_AFTER_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21d1-contact-on.png');
const p21d2BeforeScreenshotPath = process.env.BROWSER_E2E_P21D2_BEFORE_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21d2-atmosphere-off.png');
const p21d2AfterScreenshotPath = process.env.BROWSER_E2E_P21D2_AFTER_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21d2-atmosphere-on.png');
const p21f2StackOffScreenshotPath = process.env.BROWSER_E2E_P21F2_STACK_OFF_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21f2-stack-off.png');
const p21f2StackOnScreenshotPath = process.env.BROWSER_E2E_P21F2_STACK_ON_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p21f2-stack-on.png');
const p27b11IblOffScreenshotPath = process.env.BROWSER_E2E_P27B11_IBL_OFF_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p27b11-ibl-off.png');
const p27b11IblOnScreenshotPath = process.env.BROWSER_E2E_P27B11_IBL_ON_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p27b11-ibl-on.png');
const p27b12StackOffScreenshotPath = process.env.BROWSER_E2E_P27B12_STACK_OFF_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p27b12-stack-off.png');
const p27b12StackOnScreenshotPath = process.env.BROWSER_E2E_P27B12_STACK_ON_SCREENSHOT ?? screenshotPath.replace(/\.png$/i, '-p27b12-stack-on.png');
const p22cPrimaryJourney = targetLocation === 'asteroid-refinery' && !['webgpu', 'babylon'].includes(requestedGraphicsPath);
const p22cEvidence = { viewport: viewportMode, location: targetLocation };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const P21_EFFECT_BUDGETS = Object.freeze({
  high: { ibl: 1, bloom: 1, contact: 1, atmosphere: 1 },
  balanced: { ibl: 0.7, bloom: 0.68, contact: 0.68, atmosphere: 0.68 },
  performance: { ibl: 0.38, bloom: 0.42, contact: 0.42, atmosphere: 0.42 },
});

function parseP21EffectBudget(value) {
  if (typeof value !== 'string' || !value) return null;
  const fields = Object.fromEntries(value.split('+').map(part => {
    const separator = part.indexOf(':');
    return separator > 0 ? [part.slice(0, separator), part.slice(separator + 1)] : ['', ''];
  }));
  if (!Object.prototype.hasOwnProperty.call(P21_EFFECT_BUDGETS, fields.tier)) return null;
  const budget = {
    tier: fields.tier,
    ibl: Number(fields.ibl),
    bloom: Number(fields.bloom),
    contact: Number(fields.contact),
    atmosphere: Number(fields.atmosphere),
    critical: Number(fields.critical),
  };
  return Object.values(budget).slice(1).every(Number.isFinite) ? budget : null;
}

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
  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      break;
    } catch (error) {
      const transientNavigation = String(error?.message ?? error).includes('Inspected target navigated or closed');
      if (!transientNavigation || attempt === 3) throw error;
      await sleep(attempt * 125);
    }
  }
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
  const png = Buffer.from(result.data, 'base64');
  await writeFile(path, png);
  return png;
}

function pngByteDifferenceRatio(before, after) {
  const longest = Math.max(before.length, after.length);
  if (longest === 0) return 0;
  const shared = Math.min(before.length, after.length);
  let changed = Math.abs(before.length - after.length);
  for (let index = 0; index < shared; index += 1) {
    if (before[index] !== after[index]) changed += 1;
  }
  return changed / longest;
}

async function rawWebGpuPresentationProbe() {
  const sample = await evaluate(`(async () => {
    if (!navigator.gpu?.requestAdapter) return { supported: false };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { supported: true, adapter: false };
    const device = await adapter.requestDevice();
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 64;
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:96px;height:64px;z-index:2147483647;pointer-events:none';
    document.body.appendChild(canvas);
    try {
      const context = canvas.getContext('webgpu');
      if (!context) return { supported: true, adapter: true, context: false };
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'opaque' });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.18, g: 0.72, b: 0.34, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      pass.end();
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
      const bitmap = await createImageBitmap(canvas);
      try {
        const probe = document.createElement('canvas');
        probe.width = 24;
        probe.height = 16;
        const context2d = probe.getContext('2d', { willReadFrequently: true });
        if (!context2d) return { supported: true, adapter: true, context: true, sample: false };
        context2d.drawImage(bitmap, 0, 0, probe.width, probe.height);
        const pixels = context2d.getImageData(0, 0, probe.width, probe.height).data;
        let rgbSum = 0;
        let litPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          rgbSum += red + green + blue;
          if (Math.max(red, green, blue) > 24) litPixels += 1;
        }
        const pixelCount = pixels.length / 4;
        return {
          supported: true,
          adapter: true,
          context: true,
          meanRgb: rgbSum / (pixelCount * 3),
          litRatio: litPixels / pixelCount,
        };
      } finally {
        bitmap.close?.();
      }
    } finally {
      canvas.remove();
      device.destroy?.();
    }
  })()`);
  const visible = Boolean(sample?.supported && sample?.adapter && sample?.context && sample.meanRgb > 20 && sample.litRatio > 0.8);
  if (!visible) {
    if (webGpuPresentationKnownGap) {
      console.log(`BROWSER_P21F2_WEBGPU_PRESENTATION_KNOWN_GAP viewport=${viewportMode} runner=${webGpuPresentationKnownGap} probe=raw mean=${Number(sample?.meanRgb ?? 0).toFixed(2)} lit=${Number(sample?.litRatio ?? 0).toFixed(3)}`);
      return sample;
    }
    if (requireWebGpuPresentation) {
      throw new Error(`P21-F2 raw WebGPU presentation probe failed: ${JSON.stringify(sample)}`);
    }
    return sample;
  }
  console.log(`BROWSER_P21F2_RAW_WEBGPU_PRESENTATION_PASS viewport=${viewportMode} mean=${sample.meanRgb.toFixed(2)} lit=${sample.litRatio.toFixed(3)}`);
  return sample;
}

async function captureWebGpuRendererFrame(label, path) {
  const token = `p21f2-${viewportMode}-${label}-${Date.now()}`;
  const armed = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-webgpu-p21f2');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    canvas.dataset.webgpuCaptureRequest = ${JSON.stringify(token)};
    canvas.dataset.webgpuCaptureState = 'requested';
    delete canvas.dataset.webgpuCaptureError;
    delete canvas.dataset.webgpuCaptureResult;
    return true;
  })()`);
  if (!armed) throw new Error(`P21-F2 could not arm WebGPU renderer capture for ${label}.`);
  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-webgpu-p21f2');
    return canvas?.dataset.webgpuCaptureToken === ${JSON.stringify(token)}
      && (canvas.dataset.webgpuCaptureState === 'ready' || canvas.dataset.webgpuCaptureState === 'error');
  })()`, `P21-F2 WebGPU renderer capture ${label}`, 20_000);
  const result = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-webgpu-p21f2');
    const state = canvas?.dataset.webgpuCaptureState ?? '';
    const error = canvas?.dataset.webgpuCaptureError ?? '';
    const raw = canvas?.dataset.webgpuCaptureResult ?? '';
    if (canvas instanceof HTMLCanvasElement) {
      delete canvas.dataset.webgpuCaptureRequest;
      delete canvas.dataset.webgpuCaptureState;
      delete canvas.dataset.webgpuCaptureToken;
      delete canvas.dataset.webgpuCaptureError;
      delete canvas.dataset.webgpuCaptureResult;
    }
    return { state, error, result: raw ? JSON.parse(raw) : null };
  })()`);
  if (result?.state === 'error') {
    const error = result.error || 'unknown error';
    if (webGpuSwiftShaderCi && error === "Cannot read properties of undefined (reading 'format')") {
      console.log(`BROWSER_P21F2_WEBGPU_READBACK_KNOWN_GAP viewport=${viewportMode} runner=swiftshader issue=three-r186-render-target-descriptor label=${label}`);
      return null;
    }
    throw new Error(`P21-F2 WebGPU renderer capture failed for ${label}: ${error}`);
  }
  const capture = result?.result;
  if (!capture?.dataUrl || capture.maxChannel <= 12 || capture.nonBlackRatio <= 0.001) {
    throw new Error(`P21-F2 WebGPU renderer capture is blank for ${label}: ${JSON.stringify(capture)}`);
  }
  const separator = capture.dataUrl.indexOf(',');
  if (separator < 0) throw new Error(`P21-F2 WebGPU renderer capture returned an invalid PNG for ${label}.`);
  await writeFile(path, Buffer.from(capture.dataUrl.slice(separator + 1), 'base64'));
  delete capture.dataUrl;
  return capture;
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
      graphicsPathSelection: canvas.dataset.graphicsPathSelection ?? '',
      graphicsPathRequested: canvas.dataset.graphicsPathRequested ?? '',
      graphicsPathLoaded: canvas.dataset.graphicsPathLoaded ?? '',
      renderTier: canvas.dataset.renderTier ?? '',
      renderFrameMs: canvas.dataset.renderFrameMs ?? '',
      renderFrameBudget: canvas.dataset.renderFrameBudget ?? '',
      renderBudget: canvas.dataset.renderBudget ?? '',
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
  if (!['production-default', 'qa-explicit'].includes(result.graphicsPathSelection) || !result.graphicsPathLoaded) {
    throw new Error(`P21-A2 graphics path telemetry unavailable: ${JSON.stringify(result)}`);
  }
  if (requestedGraphicsPath) {
    if (result.graphicsPathSelection !== 'qa-explicit'
      || result.graphicsPathRequested !== requestedGraphicsPath
      || result.graphicsPathLoaded !== requestedGraphicsPath) {
      throw new Error(`P21-A2 explicit graphics path was not loaded: requested=${requestedGraphicsPath} telemetry=${JSON.stringify(result)}`);
    }
  } else if (result.graphicsPathSelection !== 'production-default' || result.graphicsPathRequested !== '') {
    throw new Error(`P21-A2 production path must remain default when comparison mode is absent: ${JSON.stringify(result)}`);
  }
  await writeFile(performanceReportPath, JSON.stringify({
    viewport: viewportMode,
    location: targetLocation,
    capturedAt: new Date().toISOString(),
    ...result,
  }, null, 2));
  console.log(`BROWSER_PERFORMANCE_BASELINE_PASS viewport=${viewportMode} location=${targetLocation} tier=${result.deviceTier} samples=${result.sampleCount} status=${result.status} regressions=${result.regressions} report=${performanceReportPath}`);
  console.log(`BROWSER_P21A2_GRAPHICS_PATH_PASS viewport=${viewportMode} location=${targetLocation} selection=${result.graphicsPathSelection} requested=${result.graphicsPathRequested || 'none'} loaded=${result.graphicsPathLoaded} renderTier=${result.renderTier} renderFrameMs=${result.renderFrameMs} drawCallsP95=${result.report.categories?.gpu?.drawCalls?.actual ?? 'n/a'} trianglesP95=${result.report.categories?.gpu?.triangles?.actual ?? 'n/a'}`);
  return result;
}

async function p27C1BabylonOrbitalAudit() {
  const initial = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return {
      init: canvas?.dataset.babylonInit ?? '',
      fallback: canvas?.dataset.graphicsPathFallback ?? '',
      fallbackReason: canvas?.dataset.babylonFallbackReason ?? '',
      loaded: canvas?.dataset.graphicsPathLoaded ?? '',
    };
  })()`);
  if (initial?.init === 'fallback' || initial?.init === 'failed') {
    throw new Error('P27-C1 Babylon Orbital Station initialization failed before readiness: ' + JSON.stringify(initial));
  }

  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.dataset.graphicsPathSelection === 'qa-explicit'
      && canvas?.dataset.graphicsPathRequested === 'babylon'
      && canvas?.dataset.graphicsPathLoaded === 'babylon'
      && canvas?.dataset.babylonInit === 'ready'
      && canvas?.dataset.babylonBackend === 'webgl2'
      && canvas?.dataset.babylonScene === 'active'
      && canvas?.dataset.babylonScenario === 'orbital-station'
      && canvas?.dataset.babylonEnvironmentState === 'ready'
      && canvas?.dataset.environmentVisual === 'procedural-orbital-station-babylon'
      && canvas?.dataset.babylonOrbitalParity === 'architecture+materials+lighting+props+navigation+shared-world-cues'
      && canvas?.dataset.locationArtIdentity === 'radial-spine|clean-industrial|neutral-cyan|service-cases'
      && canvas?.dataset.babylonLightingProfile === 'neutral-cyan'
      && canvas?.dataset.babylonWorldState === 'ready'
      && canvas?.dataset.worldPresentationMode === 'scene-meshes-not-hud'
      && Number(canvas?.dataset.worldObjectCount ?? 0) > 0
      && Number(canvas?.dataset.interactableActive ?? 0) > 0
      && canvas?.dataset.interactableVisual === 'authored-babylon'
      && canvas?.dataset.interactableReadability === 'shape-coded+state-emissive+floor-cue:quality-safe'
      && canvas?.dataset.objectiveWorldCue === 'beacon+navigation-path'
      && Boolean(canvas?.dataset.objectiveTarget)
      && canvas?.dataset.hazardReadability === 'shape-coded+floor-bound+quality-safe'
      && canvas?.dataset.breachReadability === 'pressure-state+floor-ring+boss-priority'
      && canvas?.dataset.babylonPlayerState === 'ready'
      && canvas?.dataset.babylonEnemyCatalogState === 'ready'
      && canvas?.dataset.babylonEnemyState === 'ready'
      && Number(canvas?.dataset.enemyActive ?? 0) > 0
      && Number(canvas?.dataset.babylonFrames ?? 0) >= 2;
  })()`, 'P27-C1 Babylon Orbital Station parity', 45_000);

  const beforeMove = await evaluate(`document.querySelector('canvas')?.dataset.babylonOrbitalPlayerPosition ?? ''`);
  if (!/^\d+\.\d,\d+\.\d$/.test(beforeMove)) {
    throw new Error('P27-C1 Orbital Station player position telemetry unavailable before movement: ' + beforeMove);
  }
  const movementAttempts = [
    { key: 'd', code: 'KeyD', virtualKeyCode: 68, holdMs: 260 },
    { key: 'd', code: 'KeyD', virtualKeyCode: 68, holdMs: 520 },
    { key: 'w', code: 'KeyW', virtualKeyCode: 87, holdMs: 520 },
    { key: 's', code: 'KeyS', virtualKeyCode: 83, holdMs: 520 },
  ];
  for (const attempt of movementAttempts) {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: attempt.key, code: attempt.code, windowsVirtualKeyCode: attempt.virtualKeyCode, nativeVirtualKeyCode: attempt.virtualKeyCode });
    await sleep(attempt.holdMs);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: attempt.key, code: attempt.code, windowsVirtualKeyCode: attempt.virtualKeyCode, nativeVirtualKeyCode: attempt.virtualKeyCode });
    await sleep(140);
    const moved = await evaluate(`document.querySelector('canvas')?.dataset.babylonOrbitalPlayerPosition !== ${JSON.stringify(beforeMove)}`);
    if (moved) break;
  }
  await waitFor(`document.querySelector('canvas')?.dataset.babylonOrbitalPlayerPosition !== ${JSON.stringify(beforeMove)}`, 'P27-C1 Orbital Station movement', 5_000);
  const afterMove = await evaluate(`document.querySelector('canvas')?.dataset.babylonOrbitalPlayerPosition ?? ''`);

  const state = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return {
      selection: canvas?.dataset.graphicsPathSelection ?? '',
      requested: canvas?.dataset.graphicsPathRequested ?? '',
      loaded: canvas?.dataset.graphicsPathLoaded ?? '',
      fallback: canvas?.dataset.graphicsPathFallback ?? '',
      fallbackReason: canvas?.dataset.babylonFallbackReason ?? '',
      init: canvas?.dataset.babylonInit ?? '',
      backend: canvas?.dataset.babylonBackend ?? '',
      scene: canvas?.dataset.babylonScene ?? '',
      scenario: canvas?.dataset.babylonScenario ?? '',
      frames: Number(canvas?.dataset.babylonFrames ?? 0),
      environmentState: canvas?.dataset.babylonEnvironmentState ?? '',
      environmentVisual: canvas?.dataset.environmentVisual ?? '',
      environmentKit: canvas?.dataset.environmentKit ?? '',
      environmentInstances: Number(canvas?.dataset.environmentInstances ?? 0),
      environmentLandmark: canvas?.dataset.environmentLandmark ?? '',
      serviceDetails: canvas?.dataset.environmentServiceDetails ?? '',
      composition: canvas?.dataset.environmentComposition ?? '',
      parity: canvas?.dataset.babylonOrbitalParity ?? '',
      artIdentity: canvas?.dataset.locationArtIdentity ?? '',
      routes: Number(canvas?.dataset.babylonOrbitalRoutes ?? 0),
      landmarks: canvas?.dataset.babylonOrbitalLandmarks ?? '',
      lighting: canvas?.dataset.babylonLightingProfile ?? '',
      lightingBudget: canvas?.dataset.babylonLightingBudget ?? '',
      environmentLighting: canvas?.dataset.environmentLighting ?? '',
      environmentIbl: canvas?.dataset.environmentIbl ?? '',
      tone: canvas?.dataset.environmentTone ?? '',
      locationLighting: canvas?.dataset.locationLighting ?? '',
      materialIntent: canvas?.dataset.babylonMaterialIntent ?? '',
      pbr: canvas?.dataset.babylonPbrMaterials ?? '',
      postRelease: canvas?.dataset.babylonPostRelease ?? '',
      worldState: canvas?.dataset.babylonWorldState ?? '',
      worldMode: canvas?.dataset.worldPresentationMode ?? '',
      worldObjects: Number(canvas?.dataset.worldObjectCount ?? 0),
      interactables: Number(canvas?.dataset.interactableActive ?? 0),
      interactableAuthored: Number(canvas?.dataset.interactableAuthoredCount ?? 0),
      interactableVisual: canvas?.dataset.interactableVisual ?? '',
      interactableReadability: canvas?.dataset.interactableReadability ?? '',
      objective: canvas?.dataset.objectiveTarget ?? '',
      objectiveCue: canvas?.dataset.objectiveWorldCue ?? '',
      hazards: Number(canvas?.dataset.hazardActive ?? 0),
      hazardReadability: canvas?.dataset.hazardReadability ?? '',
      breaches: Number(canvas?.dataset.breachActive ?? 0),
      breachReadability: canvas?.dataset.breachReadability ?? '',
      biome: canvas?.dataset.biomeState ?? '',
      biomeAnimation: canvas?.dataset.biomeStateAnimation ?? '',
      biomeAudio: canvas?.dataset.biomeStateAudio ?? '',
      playerState: canvas?.dataset.babylonPlayerState ?? '',
      enemyState: canvas?.dataset.babylonEnemyState ?? '',
      enemies: Number(canvas?.dataset.enemyActive ?? 0),
      playerPosition: canvas?.dataset.babylonOrbitalPlayerPosition ?? '',
    };
  })()`);

  const kit = new Set(String(state.environmentKit).split(',').filter(Boolean));
  const expectedKit = ['floor', 'radial-spine', 'ribs', 'airlocks', 'pipes', 'service-cases', 'wayfinding'];
  if (!state
    || state.selection !== 'qa-explicit'
    || state.requested !== 'babylon'
    || state.loaded !== 'babylon'
    || state.fallback
    || state.fallbackReason
    || state.init !== 'ready'
    || state.backend !== 'webgl2'
    || state.scene !== 'active'
    || state.scenario !== 'orbital-station'
    || state.frames < 2
    || state.environmentState !== 'ready'
    || state.environmentVisual !== 'procedural-orbital-station-babylon'
    || !expectedKit.every(item => kit.has(item))
    || state.environmentInstances < 60
    || state.environmentLandmark !== 'radial-spine'
    || state.serviceDetails !== 'service-cases:12+posts:8'
    || state.composition !== 'primary-spine+pressure-ribs+airlocks+perimeter-service'
    || state.parity !== 'architecture+materials+lighting+props+navigation+shared-world-cues'
    || state.artIdentity !== 'radial-spine|clean-industrial|neutral-cyan|service-cases'
    || state.routes < 6
    || state.landmarks !== 'SPIN ACCESS|TRANSFER BAY|CRANE WELL'
    || state.lighting !== 'neutral-cyan'
    || !/^tier:(high|balanced|performance)\|practical:(1|2)\|shadows:off$/.test(state.lightingBudget)
    || !state.environmentLighting.startsWith('orbital-key+rim+emergency+readability+practical:')
    || state.environmentIbl !== 'off:orbital-station'
    || !/^aces-\d+\.\d{2}$/.test(state.tone)
    || !/^orbital-station:neutral-cyan:aces-\d+\.\d{2}$/.test(state.locationLighting)
    || state.materialIntent !== 'procedural-clean-industrial-pbr+shared-world-pbr'
    || !/^pbr:\d+\|station:6$/.test(state.pbr)
    || state.postRelease !== 'scenario-switch'
    || state.worldState !== 'ready'
    || state.worldMode !== 'scene-meshes-not-hud'
    || state.worldObjects < 1
    || state.interactables < 1
    || state.interactableAuthored < 1
    || state.interactableVisual !== 'authored-babylon'
    || state.interactableReadability !== 'shape-coded+state-emissive+floor-cue:quality-safe'
    || !state.objective
    || state.objective === 'complete'
    || state.objectiveCue !== 'beacon+navigation-path'
    || state.hazards < 0
    || state.hazardReadability !== 'shape-coded+floor-bound+quality-safe'
    || state.breaches < 0
    || state.breachReadability !== 'pressure-state+floor-ring+boss-priority'
    || !state.biome
    || !state.biomeAnimation
    || !state.biomeAudio
    || state.playerState !== 'ready'
    || state.enemyState !== 'ready'
    || state.enemies < 1
    || afterMove === beforeMove
    || state.playerPosition === beforeMove
    || !/^\d+\.\d,\d+\.\d$/.test(state.playerPosition)) {
    throw new Error('P27-C1 Babylon Orbital Station parity invalid: ' + JSON.stringify({ state, beforeMove, afterMove }));
  }

  console.log(`BROWSER_P27C1_BABYLON_ORBITAL_PASS viewport=${viewportMode} identity=${state.artIdentity} routes=${state.routes} landmarks=${state.landmarks} world=${state.worldObjects} interactables=${state.interactables} hazards=${state.hazards} movement=${beforeMove}->${afterMove} lighting=${state.locationLighting}`);
  return state;
}

async function p27C2BabylonDamagedVesselAudit() {
  const initial = await evaluate("(() => { const canvas = document.querySelector('canvas'); return { init: canvas?.dataset.babylonInit ?? '', fallback: canvas?.dataset.graphicsPathFallback ?? '', fallbackReason: canvas?.dataset.babylonFallbackReason ?? '', loaded: canvas?.dataset.graphicsPathLoaded ?? '' }; })()");
  if (initial?.init === 'fallback' || initial?.init === 'failed') {
    throw new Error('P27-C2 Babylon Damaged Vessel initialization failed before readiness: ' + JSON.stringify(initial));
  }

  await waitFor(
    "(() => { const canvas = document.querySelector('canvas'); return canvas?.dataset.graphicsPathSelection === 'qa-explicit'"
      + " && canvas?.dataset.graphicsPathRequested === 'babylon'"
      + " && canvas?.dataset.graphicsPathLoaded === 'babylon'"
      + " && canvas?.dataset.babylonInit === 'ready'"
      + " && canvas?.dataset.babylonBackend === 'webgl2'"
      + " && canvas?.dataset.babylonScene === 'active'"
      + " && canvas?.dataset.babylonScenario === 'damaged-vessel'"
      + " && canvas?.dataset.babylonEnvironmentState === 'ready'"
      + " && canvas?.dataset.environmentVisual === 'procedural-damaged-vessel-babylon'"
      + " && canvas?.dataset.babylonDamagedParity === 'architecture+scarred-hull+breach-effects+props+navigation+shared-world-cues'"
      + " && canvas?.dataset.locationArtIdentity === 'broken-ribs|scarred-hull|emergency-amber|salvage-cases'"
      + " && canvas?.dataset.babylonLightingProfile === 'emergency-amber'"
      + " && canvas?.dataset.babylonWorldState === 'ready'"
      + " && canvas?.dataset.worldPresentationMode === 'scene-meshes-not-hud'"
      + " && Number(canvas?.dataset.worldObjectCount ?? 0) > 0"
      + " && Number(canvas?.dataset.interactableActive ?? 0) > 0"
      + " && canvas?.dataset.interactableVisual === 'authored-babylon'"
      + " && canvas?.dataset.objectiveWorldCue === 'beacon+navigation-path'"
      + " && Boolean(canvas?.dataset.objectiveTarget)"
      + " && canvas?.dataset.hazardReadability === 'shape-coded+floor-bound+quality-safe'"
      + " && canvas?.dataset.breachReadability === 'pressure-state+floor-ring+boss-priority'"
      + " && canvas?.dataset.babylonPlayerState === 'ready'"
      + " && canvas?.dataset.babylonEnemyCatalogState === 'ready'"
      + " && canvas?.dataset.babylonEnemyState === 'ready'"
      + " && Number(canvas?.dataset.enemyActive ?? 0) > 0"
      + " && Number(canvas?.dataset.babylonFrames ?? 0) >= 2; })()",
    'P27-C2 Babylon Damaged Vessel parity',
    45_000,
  );

  const beforeMove = await evaluate("document.querySelector('canvas')?.dataset.babylonDamagedPlayerPosition ?? ''");
  if (!/^\d+\.\d,\d+\.\d$/.test(beforeMove)) {
    throw new Error('P27-C2 Damaged Vessel player position telemetry unavailable before movement: ' + beforeMove);
  }
  for (const holdMs of [260, 520]) {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
    await sleep(holdMs);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
    await sleep(140);
    const moved = await evaluate("document.querySelector('canvas')?.dataset.babylonDamagedPlayerPosition !== " + JSON.stringify(beforeMove));
    if (moved) break;
  }
  await waitFor(
    "document.querySelector('canvas')?.dataset.babylonDamagedPlayerPosition !== " + JSON.stringify(beforeMove),
    'P27-C2 Damaged Vessel movement',
    5_000,
  );
  const afterMove = await evaluate("document.querySelector('canvas')?.dataset.babylonDamagedPlayerPosition ?? ''");

  const state = await evaluate("(() => { const canvas = document.querySelector('canvas'); return {"
    + " selection: canvas?.dataset.graphicsPathSelection ?? '',"
    + " requested: canvas?.dataset.graphicsPathRequested ?? '',"
    + " loaded: canvas?.dataset.graphicsPathLoaded ?? '',"
    + " fallback: canvas?.dataset.graphicsPathFallback ?? '',"
    + " fallbackReason: canvas?.dataset.babylonFallbackReason ?? '',"
    + " init: canvas?.dataset.babylonInit ?? '', backend: canvas?.dataset.babylonBackend ?? '', scene: canvas?.dataset.babylonScene ?? '',"
    + " scenario: canvas?.dataset.babylonScenario ?? '', frames: Number(canvas?.dataset.babylonFrames ?? 0),"
    + " environmentState: canvas?.dataset.babylonEnvironmentState ?? '', environmentVisual: canvas?.dataset.environmentVisual ?? '',"
    + " environmentKit: canvas?.dataset.environmentKit ?? '', environmentInstances: Number(canvas?.dataset.environmentInstances ?? 0),"
    + " environmentLandmark: canvas?.dataset.environmentLandmark ?? '', serviceDetails: canvas?.dataset.environmentServiceDetails ?? '',"
    + " surfaceDetail: canvas?.dataset.environmentSurfaceDetail ?? '', composition: canvas?.dataset.environmentComposition ?? '',"
    + " materials: canvas?.dataset.environmentMaterials ?? '', vfx: canvas?.dataset.environmentVfx ?? '', readability: canvas?.dataset.readabilityLanguage ?? '',"
    + " parity: canvas?.dataset.babylonDamagedParity ?? '', artIdentity: canvas?.dataset.locationArtIdentity ?? '',"
    + " locationArt: canvas?.dataset.locationArt ?? '', locationProps: canvas?.dataset.locationProps ?? '',"
    + " routes: Number(canvas?.dataset.babylonDamagedRoutes ?? 0), landmarks: canvas?.dataset.babylonDamagedLandmarks ?? '',"
    + " lighting: canvas?.dataset.babylonLightingProfile ?? '', lightingBudget: canvas?.dataset.babylonLightingBudget ?? '',"
    + " environmentLighting: canvas?.dataset.environmentLighting ?? '', environmentIbl: canvas?.dataset.environmentIbl ?? '',"
    + " tone: canvas?.dataset.environmentTone ?? '', locationLighting: canvas?.dataset.locationLighting ?? '',"
    + " materialIntent: canvas?.dataset.babylonMaterialIntent ?? '', pbr: canvas?.dataset.babylonPbrMaterials ?? '',"
    + " postRelease: canvas?.dataset.babylonPostRelease ?? '', worldState: canvas?.dataset.babylonWorldState ?? '',"
    + " worldMode: canvas?.dataset.worldPresentationMode ?? '', worldObjects: Number(canvas?.dataset.worldObjectCount ?? 0),"
    + " interactables: Number(canvas?.dataset.interactableActive ?? 0), interactableAuthored: Number(canvas?.dataset.interactableAuthoredCount ?? 0),"
    + " interactableVisual: canvas?.dataset.interactableVisual ?? '', interactableReadability: canvas?.dataset.interactableReadability ?? '',"
    + " objective: canvas?.dataset.objectiveTarget ?? '', objectiveCue: canvas?.dataset.objectiveWorldCue ?? '',"
    + " hazards: Number(canvas?.dataset.hazardActive ?? 0), hazardReadability: canvas?.dataset.hazardReadability ?? '',"
    + " breaches: Number(canvas?.dataset.breachActive ?? 0), breachReadability: canvas?.dataset.breachReadability ?? '',"
    + " biome: canvas?.dataset.biomeState ?? '', biomeAnimation: canvas?.dataset.biomeStateAnimation ?? '', biomeAudio: canvas?.dataset.biomeStateAudio ?? '',"
    + " playerState: canvas?.dataset.babylonPlayerState ?? '', enemyState: canvas?.dataset.babylonEnemyState ?? '',"
    + " enemies: Number(canvas?.dataset.enemyActive ?? 0), playerPosition: canvas?.dataset.babylonDamagedPlayerPosition ?? '' }; })()");

  const kit = new Set(String(state.environmentKit).split(',').filter(Boolean));
  const expectedKit = ['floor', 'broken-rib', 'breach-frame', 'salvage-rack', 'torn-plate', 'service-bundle', 'wayfinding', 'breach-vapor', 'scorch'];
  if (!state
    || state.selection !== 'qa-explicit'
    || state.requested !== 'babylon'
    || state.loaded !== 'babylon'
    || state.fallback
    || state.fallbackReason
    || state.init !== 'ready'
    || state.backend !== 'webgl2'
    || state.scene !== 'active'
    || state.scenario !== 'damaged-vessel'
    || state.frames < 2
    || state.environmentState !== 'ready'
    || state.environmentVisual !== 'procedural-damaged-vessel-babylon'
    || !expectedKit.every(item => kit.has(item))
    || state.environmentInstances < 50
    || state.environmentLandmark !== 'starboard-hull-breach'
    || state.serviceDetails !== 'salvage-rack:6+service-bundle:5'
    || state.surfaceDetail !== 'broken-rib:5+torn-plate:6+scorch:6'
    || state.composition !== 'broken-rib-corridor+starboard-breach+torn-shell+perimeter-salvage'
    || state.materials !== 'scarred-hull+torn-edge+warning-emissive+salvage-status'
    || state.vfx !== 'breach-vapor:18+scorch:6'
    || state.readability !== 'silhouette+damage-edge+breach-vapor+luminance'
    || state.parity !== 'architecture+scarred-hull+breach-effects+props+navigation+shared-world-cues'
    || state.artIdentity !== 'broken-ribs|scarred-hull|emergency-amber|salvage-cases'
    || state.locationArt !== 'damaged-vessel:broken-ribs:scarred-hull'
    || state.locationProps !== 'salvage-cases:procedural-babylon'
    || state.routes < 6
    || state.landmarks !== 'FORE HAB|CARGO SPINE|ENGINE VAULT'
    || state.lighting !== 'emergency-amber'
    || !/^tier:(high|balanced|performance)\|practical:(1|2)\|shadows:off$/.test(state.lightingBudget)
    || !/^damaged-vessel-emergency:breach\+salvage\+contact:player\+enemy\+practical:(1|2)\+shadow:off$/.test(state.environmentLighting)
    || state.environmentIbl !== 'off:damaged-vessel'
    || !/^aces-\d+\.\d{2}$/.test(state.tone)
    || !/^damaged-vessel:emergency-amber:aces-\d+\.\d{2}$/.test(state.locationLighting)
    || state.materialIntent !== 'procedural-scarred-hull-pbr+shared-world-pbr'
    || !/^pbr:\d+\|damaged:7$/.test(state.pbr)
    || state.postRelease !== 'scenario-switch'
    || state.worldState !== 'ready'
    || state.worldMode !== 'scene-meshes-not-hud'
    || state.worldObjects < 1
    || state.interactables < 1
    || state.interactableAuthored < 1
    || state.interactableVisual !== 'authored-babylon'
    || state.interactableReadability !== 'shape-coded+state-emissive+floor-cue:quality-safe'
    || !state.objective
    || state.objective === 'complete'
    || state.objectiveCue !== 'beacon+navigation-path'
    || state.hazards < 0
    || state.hazardReadability !== 'shape-coded+floor-bound+quality-safe'
    || state.breaches < 0
    || state.breachReadability !== 'pressure-state+floor-ring+boss-priority'
    || !state.biome
    || !state.biomeAnimation
    || !state.biomeAudio
    || state.playerState !== 'ready'
    || state.enemyState !== 'ready'
    || state.enemies < 1
    || afterMove === beforeMove
    || state.playerPosition === beforeMove
    || !/^\d+\.\d,\d+\.\d$/.test(state.playerPosition)) {
    throw new Error('P27-C2 Babylon Damaged Vessel parity invalid: ' + JSON.stringify({ state, beforeMove, afterMove }));
  }

  console.log('BROWSER_P27C2_BABYLON_DAMAGED_VESSEL_PASS viewport=' + viewportMode
    + ' identity=' + state.artIdentity
    + ' routes=' + state.routes
    + ' landmarks=' + state.landmarks
    + ' world=' + state.worldObjects
    + ' interactables=' + state.interactables
    + ' hazards=' + state.hazards
    + ' breaches=' + state.breaches
    + ' movement=' + beforeMove + '->' + afterMove
    + ' lighting=' + state.locationLighting);
  return state;
}


async function p27C3BabylonSpinHabitatAudit() {
  await waitFor(
    "(() => { const canvas = document.querySelector('canvas'); return"
      + " canvas?.dataset.graphicsPathSelection === 'qa-explicit'"
      + " && canvas?.dataset.graphicsPathRequested === 'babylon'"
      + " && canvas?.dataset.graphicsPathLoaded === 'babylon'"
      + " && !(canvas?.dataset.graphicsPathFallback ?? '')"
      + " && !(canvas?.dataset.babylonFallbackReason ?? '')"
      + " && canvas?.dataset.babylonInit === 'ready'"
      + " && canvas?.dataset.babylonBackend === 'webgl2'"
      + " && canvas?.dataset.babylonScene === 'active'"
      + " && canvas?.dataset.babylonScenario === 'spin-habitat'"
      + " && canvas?.dataset.babylonEnvironmentState === 'ready'"
      + " && canvas?.dataset.environmentVisual === 'procedural-spin-habitat-babylon'"
      + " && canvas?.dataset.environmentMotion === 'gravity-coupled-rigid-rotation'"
      + " && canvas?.dataset.environmentSpinSource === 'sector-A-gravity'"
      + " && canvas?.dataset.environmentSpindownSource === 'sector-B-transfer-gravity'"
      + " && canvas?.dataset.environmentVfx === 'spindown-brake-arcs+axis-warning-pulse'"
      + " && canvas?.dataset.environmentZoneIdentity === 'rim:plated-green-deck|spoke:skeletal-cyan-truss|axis:bright-stationary-tower'"
      + " && canvas?.dataset.readabilityLanguage === 'rim-plated-green+spoke-skeletal-cyan+axis-bright-stationary'"
      + " && canvas?.dataset.locationArtIdentity === 'ring-and-spokes|habitat-alloy|cool-green|habitat-service'"
      + " && canvas?.dataset.interactableBiome === 'spin-habitat'"
      + " && canvas?.dataset.interactableMode === 'spin-habitat-machinery+mission-controls'"
      + " && canvas?.dataset.interactableKit === 'spin-bus-isolator+gravity-trim+bearing-control+attitude-flywheel+pressure-lock'"
      + " && Number(canvas?.dataset.interactableLocationCueCount ?? 0) > 0"
      + " && canvas?.dataset.bossBiome === 'spin-habitat'"
      + " && canvas?.dataset.bossPresentation === 'sable-voss'"
      + " && canvas?.dataset.bossSilhouette === 'counterspin-mantle+governor-towers+command-visor'"
      + " && canvas?.dataset.bossCue === 'counterspin-ring+governor-towers+phase-halo'"
      + " && Number(canvas?.dataset.babylonSpinRoutes ?? 0) >= 6"
      + " && canvas?.dataset.babylonSpinLandmarks === 'RIM HAB|SPOKE TRANSIT|AXIS HUB'"
      + " && canvas?.dataset.babylonWorldState === 'ready'"
      + " && canvas?.dataset.worldPresentationMode === 'scene-meshes-not-hud'"
      + " && Number(canvas?.dataset.worldObjectCount ?? 0) > 0"
      + " && Number(canvas?.dataset.interactableActive ?? 0) > 0"
      + " && canvas?.dataset.interactableVisual === 'authored-babylon'"
      + " && canvas?.dataset.objectiveWorldCue === 'beacon+navigation-path'"
      + " && Boolean(canvas?.dataset.objectiveTarget)"
      + " && canvas?.dataset.hazardReadability === 'shape-coded+floor-bound+quality-safe'"
      + " && canvas?.dataset.babylonPlayerState === 'ready'"
      + " && canvas?.dataset.babylonEnemyCatalogState === 'ready'"
      + " && canvas?.dataset.babylonEnemyState === 'ready'"
      + " && Number(canvas?.dataset.enemyActive ?? 0) > 0"
      + " && Number(canvas?.dataset.babylonFrames ?? 0) >= 2; })()",
    'P27-C3 Babylon Spin Habitat parity',
    45_000,
  );

  const firstPhase = Number(await evaluate("document.querySelector('canvas')?.dataset.environmentSpinPhase ?? NaN"));
  if (!Number.isFinite(firstPhase)) {
    throw new Error('P27-C3 Spin Habitat rotation phase unavailable: ' + firstPhase);
  }
  await waitFor(
    "(() => { const phase = Number(document.querySelector('canvas')?.dataset.environmentSpinPhase); return Number.isFinite(phase) && Math.abs(phase - "
      + JSON.stringify(firstPhase) + ") >= 0.015; })()",
    'P27-C3 Spin Habitat rotation phase advance',
    5_000,
  );
  const nextPhase = Number(await evaluate("document.querySelector('canvas')?.dataset.environmentSpinPhase ?? NaN"));

  const beforeMove = await evaluate("document.querySelector('canvas')?.dataset.babylonSpinPlayerPosition ?? ''");
  if (!/^\d+\.\d,\d+\.\d$/.test(beforeMove)) {
    throw new Error('P27-C3 Spin Habitat player position telemetry unavailable before movement: ' + beforeMove);
  }
  for (const holdMs of [260, 520]) {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
    await sleep(holdMs);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
    await sleep(140);
    const moved = await evaluate("document.querySelector('canvas')?.dataset.babylonSpinPlayerPosition !== " + JSON.stringify(beforeMove));
    if (moved) break;
  }
  await waitFor(
    "document.querySelector('canvas')?.dataset.babylonSpinPlayerPosition !== " + JSON.stringify(beforeMove),
    'P27-C3 Spin Habitat movement',
    5_000,
  );
  const afterMove = await evaluate("document.querySelector('canvas')?.dataset.babylonSpinPlayerPosition ?? ''");

  const state = await evaluate("(() => { const canvas = document.querySelector('canvas'); return {"
    + " selection: canvas?.dataset.graphicsPathSelection ?? '', requested: canvas?.dataset.graphicsPathRequested ?? '', loaded: canvas?.dataset.graphicsPathLoaded ?? '',"
    + " fallback: canvas?.dataset.graphicsPathFallback ?? '', fallbackReason: canvas?.dataset.babylonFallbackReason ?? '',"
    + " init: canvas?.dataset.babylonInit ?? '', backend: canvas?.dataset.babylonBackend ?? '', scene: canvas?.dataset.babylonScene ?? '',"
    + " scenario: canvas?.dataset.babylonScenario ?? '', frames: Number(canvas?.dataset.babylonFrames ?? 0),"
    + " environmentState: canvas?.dataset.babylonEnvironmentState ?? '', environmentVisual: canvas?.dataset.environmentVisual ?? '',"
    + " environmentKit: canvas?.dataset.environmentKit ?? '', environmentInstances: Number(canvas?.dataset.environmentInstances ?? 0),"
    + " landmark: canvas?.dataset.environmentLandmark ?? '', serviceDetails: canvas?.dataset.environmentServiceDetails ?? '',"
    + " composition: canvas?.dataset.environmentComposition ?? '', motion: canvas?.dataset.environmentMotion ?? '',"
    + " spinMode: canvas?.dataset.environmentSpinMode ?? '', spinRpm: Number(canvas?.dataset.environmentSpinRpm), spinPhase: Number(canvas?.dataset.environmentSpinPhase),"
    + " spinSource: canvas?.dataset.environmentSpinSource ?? '', spindown: canvas?.dataset.environmentSpindown ?? '',"
    + " spindownIntensity: Number(canvas?.dataset.environmentSpindownIntensity), spindownSource: canvas?.dataset.environmentSpindownSource ?? '',"
    + " spindownDetail: canvas?.dataset.environmentSpindownDetail ?? '', vfx: canvas?.dataset.environmentVfx ?? '',"
    + " ambient: canvas?.dataset.environmentAmbient ?? '', ambientMotion: canvas?.dataset.environmentAmbientMotion ?? '', ambientDetail: canvas?.dataset.environmentAmbientDetail ?? '',"
    + " zoneIdentity: canvas?.dataset.environmentZoneIdentity ?? '', readability: canvas?.dataset.readabilityLanguage ?? '',"
    + " parity: canvas?.dataset.babylonSpinHabitatParity ?? '', artIdentity: canvas?.dataset.locationArtIdentity ?? '',"
    + " routes: Number(canvas?.dataset.babylonSpinRoutes ?? 0), landmarks: canvas?.dataset.babylonSpinLandmarks ?? '',"
    + " interactableBiome: canvas?.dataset.interactableBiome ?? '', interactableMode: canvas?.dataset.interactableMode ?? '',"
    + " interactableKit: canvas?.dataset.interactableKit ?? '', localCues: Number(canvas?.dataset.interactableLocationCueCount ?? 0),"
    + " bossBiome: canvas?.dataset.bossBiome ?? '', bossPresentation: canvas?.dataset.bossPresentation ?? '', bossVisual: canvas?.dataset.bossVisual ?? '',"
    + " bossSilhouette: canvas?.dataset.bossSilhouette ?? '', bossPalette: canvas?.dataset.bossPalette ?? '', bossCue: canvas?.dataset.bossCue ?? '', bossCueState: canvas?.dataset.bossCueState ?? '',"
    + " lighting: canvas?.dataset.babylonLightingProfile ?? '', lightingBudget: canvas?.dataset.babylonLightingBudget ?? '',"
    + " environmentLighting: canvas?.dataset.environmentLighting ?? '', environmentIbl: canvas?.dataset.environmentIbl ?? '', tone: canvas?.dataset.environmentTone ?? '',"
    + " locationLighting: canvas?.dataset.locationLighting ?? '', materialIntent: canvas?.dataset.babylonMaterialIntent ?? '', pbr: canvas?.dataset.babylonPbrMaterials ?? '',"
    + " worldState: canvas?.dataset.babylonWorldState ?? '', worldMode: canvas?.dataset.worldPresentationMode ?? '', worldObjects: Number(canvas?.dataset.worldObjectCount ?? 0),"
    + " interactables: Number(canvas?.dataset.interactableActive ?? 0), interactableVisual: canvas?.dataset.interactableVisual ?? '',"
    + " objective: canvas?.dataset.objectiveTarget ?? '', objectiveCue: canvas?.dataset.objectiveWorldCue ?? '',"
    + " hazards: Number(canvas?.dataset.hazardActive ?? 0), hazardReadability: canvas?.dataset.hazardReadability ?? '',"
    + " playerState: canvas?.dataset.babylonPlayerState ?? '', enemyState: canvas?.dataset.babylonEnemyState ?? '', enemies: Number(canvas?.dataset.enemyActive ?? 0),"
    + " playerPosition: canvas?.dataset.babylonSpinPlayerPosition ?? '' }; })()");

  const kit = new Set(String(state.environmentKit).split(',').filter(Boolean));
  const expectedKit = ['floor', 'ring-segment', 'spoke-truss', 'axis-hub', 'service-bay', 'wayfinding', 'spindown', 'ambient', 'boss-cue'];
  if (!state
    || state.selection !== 'qa-explicit'
    || state.requested !== 'babylon'
    || state.loaded !== 'babylon'
    || state.fallback
    || state.fallbackReason
    || state.init !== 'ready'
    || state.backend !== 'webgl2'
    || state.scene !== 'active'
    || state.scenario !== 'spin-habitat'
    || state.frames < 2
    || state.environmentState !== 'ready'
    || state.environmentVisual !== 'procedural-spin-habitat-babylon'
    || !expectedKit.every(item => kit.has(item))
    || state.environmentInstances < 20
    || state.landmark !== 'central-axis-hub'
    || !state.serviceDetails.startsWith('service-bay:4+machinery-cues:')
    || state.composition !== 'rotating-ring-arc+rotating-cross-spokes+stationary-axis+service-bays'
    || state.motion !== 'gravity-coupled-rigid-rotation'
    || !['reduced', 'nominal', 'overspeed'].includes(state.spinMode)
    || !Number.isFinite(state.spinRpm)
    || state.spinRpm <= 0
    || !Number.isFinite(state.spinPhase)
    || Math.abs(state.spinPhase - firstPhase) < 0.015
    || !Number.isFinite(nextPhase)
    || state.spinSource !== 'sector-A-gravity'
    || !['idle', 'active'].includes(state.spindown)
    || !Number.isFinite(state.spindownIntensity)
    || state.spindownSource !== 'sector-B-transfer-gravity'
    || !['3-arcs+axis-pulse', '6-arcs+axis-pulse'].includes(state.spindownDetail)
    || state.vfx !== 'spindown-brake-arcs+axis-warning-pulse'
    || state.ambient !== 'rim-light-sweep+spin-dust+axis-haze'
    || state.ambientMotion !== 'gravity-coupled-sweep+counterspin-drift+stationary-axis-pulse'
    || !state.ambientDetail.includes('motes+axis-haze')
    || state.zoneIdentity !== 'rim:plated-green-deck|spoke:skeletal-cyan-truss|axis:bright-stationary-tower'
    || state.readability !== 'rim-plated-green+spoke-skeletal-cyan+axis-bright-stationary'
    || state.parity !== 'architecture+spindown+props+interactables+navigation+boss-cues+shared-world-cues'
    || state.artIdentity !== 'ring-and-spokes|habitat-alloy|cool-green|habitat-service'
    || state.routes < 6
    || state.landmarks !== 'RIM HAB|SPOKE TRANSIT|AXIS HUB'
    || state.interactableBiome !== 'spin-habitat'
    || state.interactableMode !== 'spin-habitat-machinery+mission-controls'
    || state.interactableKit !== 'spin-bus-isolator+gravity-trim+bearing-control+attitude-flywheel+pressure-lock'
    || state.localCues < 1
    || state.bossBiome !== 'spin-habitat'
    || state.bossPresentation !== 'sable-voss'
    || state.bossVisual !== 'procedural-babylon'
    || state.bossSilhouette !== 'counterspin-mantle+governor-towers+command-visor'
    || state.bossPalette !== 'recovery-green+cyan-command+amber-phase-two'
    || state.bossCue !== 'counterspin-ring+governor-towers+phase-halo'
    || !/^(queued|active-phase-[12])$/.test(state.bossCueState)
    || state.lighting !== 'cool-green'
    || !/^tier:(high|balanced|performance)\|practical:(1|2)\|shadows:off$/.test(state.lightingBudget)
    || !/^spin-habitat-cool-green:axis\+rim\+contact:player\+enemy\+practical:(1|2)\+shadow:off$/.test(state.environmentLighting)
    || state.environmentIbl !== 'off:spin-habitat'
    || !/^aces-\d+\.\d{2}$/.test(state.tone)
    || !/^spin-habitat:cool-green:aces-\d+\.\d{2}$/.test(state.locationLighting)
    || state.materialIntent !== 'procedural-habitat-alloy-pbr+shared-world-pbr'
    || !/^pbr:\d+\|spin:7$/.test(state.pbr)
    || state.worldState !== 'ready'
    || state.worldMode !== 'scene-meshes-not-hud'
    || state.worldObjects < 1
    || state.interactables < 1
    || state.interactableVisual !== 'authored-babylon'
    || !state.objective
    || state.objective === 'complete'
    || state.objectiveCue !== 'beacon+navigation-path'
    || state.hazards < 0
    || state.hazardReadability !== 'shape-coded+floor-bound+quality-safe'
    || state.playerState !== 'ready'
    || state.enemyState !== 'ready'
    || state.enemies < 1
    || afterMove === beforeMove
    || state.playerPosition === beforeMove
    || !/^\d+\.\d,\d+\.\d$/.test(state.playerPosition)) {
    throw new Error('P27-C3 Babylon Spin Habitat parity invalid: ' + JSON.stringify({ state, firstPhase, nextPhase, beforeMove, afterMove }));
  }

  console.log('BROWSER_P27C3_BABYLON_SPIN_HABITAT_PASS viewport=' + viewportMode
    + ' identity=' + state.artIdentity
    + ' routes=' + state.routes
    + ' landmarks=' + state.landmarks
    + ' machinery=' + state.localCues
    + ' boss=' + state.bossPresentation + ':' + state.bossCueState
    + ' spin=' + firstPhase.toFixed(3) + '->' + nextPhase.toFixed(3)
    + ' spindown=' + state.spindown + ':' + state.spindownDetail
    + ' movement=' + beforeMove + '->' + afterMove
    + ' lighting=' + state.locationLighting);
  return state;
}


async function p27C4BabylonJovianHarvesterAudit() {
  await waitFor(
    "(() => { const canvas = document.querySelector('canvas'); return"
      + " canvas?.dataset.graphicsPathSelection === 'qa-explicit'"
      + " && canvas?.dataset.graphicsPathRequested === 'babylon'"
      + " && canvas?.dataset.graphicsPathLoaded === 'babylon'"
      + " && !(canvas?.dataset.graphicsPathFallback ?? '')"
      + " && !(canvas?.dataset.babylonFallbackReason ?? '')"
      + " && canvas?.dataset.babylonInit === 'ready'"
      + " && canvas?.dataset.babylonBackend === 'webgl2'"
      + " && canvas?.dataset.babylonScene === 'active'"
      + " && canvas?.dataset.babylonScenario === 'jovian-harvester'"
      + " && canvas?.dataset.babylonEnvironmentState === 'ready'"
      + " && canvas?.dataset.environmentVisual === 'procedural-jovian-harvester-babylon'"
      + " && canvas?.dataset.environmentLandmark === 'five-skimmer-tower-spine'"
      + " && canvas?.dataset.environmentComposition === 'elevated-skimmer-decks+five-tower-spine+transfer-bridges+ballast-pods'"
      + " && canvas?.dataset.environmentZoneIdentity === 'deck:weathered-plate|tower:vertical-skimmer-spine|bridge:dark-transfer-truss|ballast:light-suspended-pod'"
      + " && canvas?.dataset.readabilityLanguage === 'tower-height+bridge-lines+amber-wayfinding+pressure-shear+storm-charge'"
      + " && canvas?.dataset.environmentStormLanguage === 'storm-charge-sweeps+pressure-shear-bands+relief-pulse'"
      + " && canvas?.dataset.environmentStormSource === 'live-sector-pressure+service-breach+contract-conditions'"
      + " && canvas?.dataset.environmentVfx === 'storm-charge-sweeps+pressure-shear-bands+relief-pulse'"
      + " && canvas?.dataset.environmentAmbient === 'upper-haze+pressure-clouds+charged-particulate'"
      + " && canvas?.dataset.environmentAmbientMotion === 'crosswind-drift+pressure-breath+charged-drift'"
      + " && Number.isFinite(Number(canvas?.dataset.environmentStormIntensity))"
      + " && Number.isFinite(Number(canvas?.dataset.environmentPressureShear))"
      + " && Number.isFinite(Number(canvas?.dataset.environmentAmbientIntensity))"
      + " && canvas?.dataset.locationArtIdentity === 'skimmer-towers|weathered-condenser|storm-orange|compressor-service'"
      + " && canvas?.dataset.interactableBiome === 'jovian-harvester'"
      + " && canvas?.dataset.interactableMode === 'jovian-gas-machinery+mission-controls'"
      + " && canvas?.dataset.interactableKit === 'storm-bus-isolator+deck-mass-trim+skimmer-compressor+separator-package'"
      + " && canvas?.dataset.interactablePressureKit === 'storm-pressure-lock+relief-manifold'"
      + " && canvas?.dataset.interactablePressureSource === 'live-pressure-links+breach-state+sector-pressure'"
      + " && Number(canvas?.dataset.interactableLocationCueCount ?? 0) > 0"
      + " && canvas?.dataset.bossBiome === 'jovian-harvester'"
      + " && canvas?.dataset.bossPresentation === 'stormline-foreman-ilex'"
      + " && canvas?.dataset.bossSilhouette === 'storm-cowl+pressure-crown+relief-stacks'"
      + " && canvas?.dataset.bossCue === 'storm-ring+pressure-crown+relief-stacks'"
      + " && Number(canvas?.dataset.babylonJovianRoutes ?? 0) >= 6"
      + " && canvas?.dataset.babylonJovianLandmarks === 'PRESSURE LOCK|SKIMMER DECK|COMPRESSOR CROWN'"
      + " && canvas?.dataset.babylonWorldState === 'ready'"
      + " && canvas?.dataset.worldPresentationMode === 'scene-meshes-not-hud'"
      + " && Number(canvas?.dataset.worldObjectCount ?? 0) > 0"
      + " && Number(canvas?.dataset.interactableActive ?? 0) > 0"
      + " && canvas?.dataset.interactableVisual === 'authored-babylon'"
      + " && canvas?.dataset.objectiveWorldCue === 'beacon+navigation-path'"
      + " && Boolean(canvas?.dataset.objectiveTarget)"
      + " && canvas?.dataset.hazardReadability === 'shape-coded+floor-bound+quality-safe'"
      + " && canvas?.dataset.babylonPlayerState === 'ready'"
      + " && canvas?.dataset.babylonEnemyCatalogState === 'ready'"
      + " && canvas?.dataset.babylonEnemyState === 'ready'"
      + " && Number(canvas?.dataset.enemyActive ?? 0) > 0"
      + " && Number(canvas?.dataset.babylonFrames ?? 0) >= 2; })()",
    'P27-C4 Babylon Jovian Harvester parity',
    45_000,
  );

  const beforeMove = await evaluate("document.querySelector('canvas')?.dataset.babylonJovianPlayerPosition ?? ''");
  if (!/^\d+\.\d,\d+\.\d$/.test(beforeMove)) {
    throw new Error('P27-C4 Jovian player position telemetry unavailable before movement: ' + beforeMove);
  }
  for (const holdMs of [260, 520]) {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
    await sleep(holdMs);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
    await sleep(140);
    const moved = await evaluate("document.querySelector('canvas')?.dataset.babylonJovianPlayerPosition !== " + JSON.stringify(beforeMove));
    if (moved) break;
  }
  await waitFor(
    "document.querySelector('canvas')?.dataset.babylonJovianPlayerPosition !== " + JSON.stringify(beforeMove),
    'P27-C4 Jovian Harvester movement',
    5_000,
  );
  const afterMove = await evaluate("document.querySelector('canvas')?.dataset.babylonJovianPlayerPosition ?? ''");

  const state = await evaluate("(() => { const canvas = document.querySelector('canvas'); return {"
    + " scenario: canvas?.dataset.babylonScenario ?? '', environmentVisual: canvas?.dataset.environmentVisual ?? '',"
    + " kit: canvas?.dataset.environmentKit ?? '', instances: Number(canvas?.dataset.environmentInstances ?? 0),"
    + " activeStructures: Number(canvas?.dataset.environmentActiveStructures ?? 0), profile: canvas?.dataset.environmentPerformanceProfile ?? '',"
    + " budget: canvas?.dataset.environmentInstanceBudget ?? '', shadows: canvas?.dataset.environmentShadowCasters ?? '',"
    + " landmark: canvas?.dataset.environmentLandmark ?? '', composition: canvas?.dataset.environmentComposition ?? '',"
    + " zone: canvas?.dataset.environmentZoneIdentity ?? '', readability: canvas?.dataset.readabilityLanguage ?? '',"
    + " stormMode: canvas?.dataset.environmentStormMode ?? '', stormIntensity: Number(canvas?.dataset.environmentStormIntensity),"
    + " pressureShear: Number(canvas?.dataset.environmentPressureShear), pressureRange: canvas?.dataset.environmentPressureRange ?? '',"
    + " stormDetail: canvas?.dataset.environmentStormDetail ?? '', stormSource: canvas?.dataset.environmentStormSource ?? '',"
    + " ambientDetail: canvas?.dataset.environmentAmbientDetail ?? '', ambientIntensity: Number(canvas?.dataset.environmentAmbientIntensity),"
    + " pressureState: canvas?.dataset.interactablePressureState ?? '', pressureDoor: canvas?.dataset.interactablePressureDoor ?? '',"
    + " localCues: Number(canvas?.dataset.interactableLocationCueCount ?? 0), boss: canvas?.dataset.bossPresentation ?? '',"
    + " bossCue: canvas?.dataset.bossCue ?? '', bossCueState: canvas?.dataset.bossCueState ?? '',"
    + " parity: canvas?.dataset.babylonJovianParity ?? '', identity: canvas?.dataset.locationArtIdentity ?? '',"
    + " routes: Number(canvas?.dataset.babylonJovianRoutes ?? 0), landmarks: canvas?.dataset.babylonJovianLandmarks ?? '',"
    + " lighting: canvas?.dataset.babylonLightingProfile ?? '', lightingBudget: canvas?.dataset.babylonLightingBudget ?? '',"
    + " locationLighting: canvas?.dataset.locationLighting ?? '', tone: canvas?.dataset.environmentTone ?? '',"
    + " worldObjects: Number(canvas?.dataset.worldObjectCount ?? 0), interactables: Number(canvas?.dataset.interactableActive ?? 0),"
    + " hazards: Number(canvas?.dataset.hazardActive ?? 0), enemies: Number(canvas?.dataset.enemyActive ?? 0),"
    + " playerPosition: canvas?.dataset.babylonJovianPlayerPosition ?? '' }; })()");

  const expectedKit = ['floor', 'deck-span', 'skimmer-tower', 'transfer-bridge', 'ballast-pod', 'wayfinding', 'storm-language', 'atmosphere', 'boss-cue'];
  const kit = new Set(String(state.kit).split(',').filter(Boolean));
  if (!state
    || state.scenario !== 'jovian-harvester'
    || state.environmentVisual !== 'procedural-jovian-harvester-babylon'
    || !expectedKit.every(item => kit.has(item))
    || state.instances < 20
    || state.activeStructures < 13
    || state.landmark !== 'five-skimmer-tower-spine'
    || state.composition !== 'elevated-skimmer-decks+five-tower-spine+transfer-bridges+ballast-pods'
    || state.zone !== 'deck:weathered-plate|tower:vertical-skimmer-spine|bridge:dark-transfer-truss|ballast:light-suspended-pod'
    || state.readability !== 'tower-height+bridge-lines+amber-wayfinding+pressure-shear+storm-charge'
    || !['nominal', 'charged', 'shear', 'venting'].includes(state.stormMode)
    || !Number.isFinite(state.stormIntensity)
    || !Number.isFinite(state.pressureShear)
    || !/^\d+\.\d{2}-\d+\.\d{2}$/.test(state.pressureRange)
    || state.stormSource !== 'live-sector-pressure+service-breach+contract-conditions'
    || !['2-sweeps+2-bands+relief-pulse', '4-sweeps+3-bands+relief-pulse'].includes(state.stormDetail)
    || !['2-clouds+20-motes+spine-haze', '3-clouds+36-motes+spine-haze', '5-clouds+56-motes+spine-haze'].includes(state.ambientDetail)
    || !Number.isFinite(state.ambientIntensity)
    || !['normal', 'leaking', 'decompressing', 'vacuum', 'venting'].includes(state.pressureState)
    || !['open', 'sealed'].includes(state.pressureDoor)
    || state.localCues < 1
    || state.boss !== 'stormline-foreman-ilex'
    || state.bossCue !== 'storm-ring+pressure-crown+relief-stacks'
    || !/^(queued|active-phase-[12])$/.test(state.bossCueState)
    || state.parity !== 'architecture+weather+storm-pressure+props+interactables+navigation+boss-cues+shared-world-cues'
    || state.identity !== 'skimmer-towers|weathered-condenser|storm-orange|compressor-service'
    || state.routes < 6
    || state.landmarks !== 'PRESSURE LOCK|SKIMMER DECK|COMPRESSOR CROWN'
    || state.lighting !== 'storm-orange'
    || !/^tier:(high|balanced|performance)\|practical:(1|2)\|shadows:off$/.test(state.lightingBudget)
    || !/^jovian-harvester:storm-orange:aces-\d+\.\d{2}$/.test(state.locationLighting)
    || !/^aces-\d+\.\d{2}$/.test(state.tone)
    || state.worldObjects < 1
    || state.interactables < 1
    || state.hazards < 0
    || state.enemies < 1
    || afterMove === beforeMove
    || state.playerPosition === beforeMove
    || !/^\d+\.\d,\d+\.\d$/.test(state.playerPosition)) {
    throw new Error('P27-C4 Babylon Jovian Harvester parity invalid: ' + JSON.stringify({ state, beforeMove, afterMove }));
  }

  if (viewportMode === 'mobile-landscape') {
    if (!/^(mobile|performance):procedural:structure-shadows-off$/.test(state.profile)) {
      throw new Error('P27-C4 mobile Jovian performance profile invalid: ' + JSON.stringify(state));
    }
    if (state.budget !== 'deck:4+tower:5+bridge:2+ballast:2') {
      throw new Error('P27-C4 mobile Jovian instance budget regressed: ' + JSON.stringify(state));
    }
    if (state.stormDetail !== '2-sweeps+2-bands+relief-pulse' || state.ambientDetail !== '2-clouds+20-motes+spine-haze') {
      throw new Error('P27-C4 mobile Jovian secondary-effect reduction regressed: ' + JSON.stringify(state));
    }
  }

  console.log('BROWSER_P27C4_BABYLON_JOVIAN_HARVESTER_PASS viewport=' + viewportMode
    + ' identity=' + state.identity
    + ' routes=' + state.routes
    + ' landmarks=' + state.landmarks
    + ' machinery=' + state.localCues
    + ' boss=' + state.boss + ':' + state.bossCueState
    + ' storm=' + state.stormMode + ':' + state.stormDetail
    + ' pressure=' + state.pressureState + ':' + state.pressureDoor
    + ' movement=' + beforeMove + '->' + afterMove
    + ' lighting=' + state.locationLighting);
  return state;
}


async function p27C5BabylonIceMineAudit() {
  await waitFor(
    "(() => { const canvas = document.querySelector('canvas'); return"
      + " canvas?.dataset.graphicsPathSelection === 'qa-explicit'"
      + " && canvas?.dataset.graphicsPathRequested === 'babylon'"
      + " && canvas?.dataset.graphicsPathLoaded === 'babylon'"
      + " && !(canvas?.dataset.graphicsPathFallback ?? '')"
      + " && !(canvas?.dataset.babylonFallbackReason ?? '')"
      + " && canvas?.dataset.babylonInit === 'ready'"
      + " && canvas?.dataset.babylonBackend === 'webgl2'"
      + " && canvas?.dataset.babylonScene === 'active'"
      + " && canvas?.dataset.babylonScenario === 'ice-mine'"
      + " && canvas?.dataset.babylonEnvironmentState === 'ready'"
      + " && canvas?.dataset.environmentVisual === 'procedural-ice-mine-babylon'"
      + " && canvas?.dataset.environmentLandmark === 'subglacial-vault-ice-pillars'"
      + " && canvas?.dataset.environmentComposition === 'access-bore+reinforced-extraction-tunnel+subglacial-vault'"
      + " && canvas?.dataset.environmentTunnelSequence === 'access-bore>extraction-tunnel>subglacial-vault'"
      + " && canvas?.dataset.environmentZoneIdentity === 'access-bore:frost-wall-cut|extraction-tunnel:steel-support-frames+service-deck+cryo-pumps|subglacial-vault:ice-pillar-cluster+coolant-manifolds+freeze-compressors'"
      + " && canvas?.dataset.readabilityLanguage === 'frost-wall-corridor+support-frame-rhythm+cyan-service-deck+vault-pillars+cold-cyan-machinery'"
      + " && canvas?.dataset.environmentMachineDetail === 'cryo-pump:2+coolant-manifold:3+freeze-compressor:2'"
      + " && canvas?.dataset.environmentBrittleSupportIds === 'ice-brittle-gate-a,ice-brittle-gate-b'"
      + " && /^(intact|damaged|partial|cleared)$/.test(canvas?.dataset.environmentBrittleSupportState ?? '')"
      + " && canvas?.dataset.environmentFractureVfx === 'support-cracks+shard-burst+frost-pulse'"
      + " && /^(idle|cracking|collapsing|settled)$/.test(canvas?.dataset.environmentFractureState ?? '')"
      + " && ['4-shards+2-cracks+frost-pulse', '8-shards+3-cracks+frost-pulse'].includes(canvas?.dataset.environmentFractureDetail ?? '')"
      + " && canvas?.dataset.environmentHazardLanguage === 'shared-hazards+brittle-support-fracture'"
      + " && canvas?.dataset.locationArtIdentity === 'bore-crystals|frosted-industrial|ice-cyan|drill-service'"
      + " && canvas?.dataset.interactableBiome === 'ice-mine'"
      + " && canvas?.dataset.interactableMode === 'ice-mine-cryo-machinery+mission-controls'"
      + " && Number(canvas?.dataset.interactableLocationCueCount ?? 0) > 0"
      + " && canvas?.dataset.bossBiome === 'ice-mine'"
      + " && canvas?.dataset.bossPresentation === 'rhea-kade'"
      + " && canvas?.dataset.bossSilhouette === 'bore-cowl+cryo-tanks+fracture-ram'"
      + " && canvas?.dataset.bossCue === 'fracture-ring+cryo-halo+fracture-ram'"
      + " && Number(canvas?.dataset.babylonIceMineRoutes ?? 0) >= 6"
      + " && canvas?.dataset.babylonIceMineLandmarks === 'ACCESS BORE|EXTRACTION TUNNEL|SUBGLACIAL VAULT'"
      + " && canvas?.dataset.babylonWorldState === 'ready'"
      + " && canvas?.dataset.worldPresentationMode === 'scene-meshes-not-hud'"
      + " && Number(canvas?.dataset.worldObjectCount ?? 0) > 0"
      + " && Number(canvas?.dataset.interactableActive ?? 0) > 0"
      + " && canvas?.dataset.interactableVisual === 'authored-babylon'"
      + " && canvas?.dataset.objectiveWorldCue === 'beacon+navigation-path'"
      + " && Boolean(canvas?.dataset.objectiveTarget)"
      + " && canvas?.dataset.hazardReadability === 'shape-coded+floor-bound+quality-safe'"
      + " && canvas?.dataset.babylonPlayerState === 'ready'"
      + " && canvas?.dataset.babylonEnemyCatalogState === 'ready'"
      + " && canvas?.dataset.babylonEnemyState === 'ready'"
      + " && Number(canvas?.dataset.enemyActive ?? 0) > 0"
      + " && Number(canvas?.dataset.babylonFrames ?? 0) >= 2; })()",
    'P27-C5 Babylon Ice Mine parity',
    45_000,
  );

  const beforeMove = await evaluate("document.querySelector('canvas')?.dataset.babylonIceMinePlayerPosition ?? ''");
  if (!/^\d+\.\d,\d+\.\d$/.test(beforeMove)) {
    throw new Error('P27-C5 Ice Mine player position telemetry unavailable before movement: ' + beforeMove);
  }
  for (const holdMs of [260, 520]) {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
    await sleep(holdMs);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
    await sleep(140);
    const moved = await evaluate("document.querySelector('canvas')?.dataset.babylonIceMinePlayerPosition !== " + JSON.stringify(beforeMove));
    if (moved) break;
  }
  await waitFor(
    "document.querySelector('canvas')?.dataset.babylonIceMinePlayerPosition !== " + JSON.stringify(beforeMove),
    'P27-C5 Ice Mine movement',
    5_000,
  );
  const afterMove = await evaluate("document.querySelector('canvas')?.dataset.babylonIceMinePlayerPosition ?? ''");

  const state = await evaluate("(() => { const canvas = document.querySelector('canvas'); return {"
    + " scenario: canvas?.dataset.babylonScenario ?? '', environmentVisual: canvas?.dataset.environmentVisual ?? '',"
    + " kit: canvas?.dataset.environmentKit ?? '', instances: Number(canvas?.dataset.environmentInstances ?? 0),"
    + " profile: canvas?.dataset.environmentPerformanceProfile ?? '', budget: canvas?.dataset.environmentInstanceBudget ?? '',"
    + " landmark: canvas?.dataset.environmentLandmark ?? '', composition: canvas?.dataset.environmentComposition ?? '',"
    + " sequence: canvas?.dataset.environmentTunnelSequence ?? '', service: canvas?.dataset.environmentServiceDetails ?? '',"
    + " surface: canvas?.dataset.environmentSurfaceDetail ?? '', machinery: canvas?.dataset.environmentMachineDetail ?? '',"
    + " brittle: canvas?.dataset.environmentBrittleSupports ?? '', brittleState: canvas?.dataset.environmentBrittleSupportState ?? '',"
    + " fractureVfx: canvas?.dataset.environmentFractureVfx ?? '', fractureState: canvas?.dataset.environmentFractureState ?? '',"
    + " fractureDetail: canvas?.dataset.environmentFractureDetail ?? '', fractureSupports: canvas?.dataset.environmentFractureSupports ?? '',"
    + " hazardLanguage: canvas?.dataset.environmentHazardLanguage ?? '', ambientDetail: canvas?.dataset.environmentAmbientDetail ?? '',"
    + " localCues: Number(canvas?.dataset.interactableLocationCueCount ?? 0), boss: canvas?.dataset.bossPresentation ?? '',"
    + " bossCue: canvas?.dataset.bossCue ?? '', bossCueState: canvas?.dataset.bossCueState ?? '',"
    + " parity: canvas?.dataset.babylonIceMineParity ?? '', identity: canvas?.dataset.locationArtIdentity ?? '',"
    + " routes: Number(canvas?.dataset.babylonIceMineRoutes ?? 0), landmarks: canvas?.dataset.babylonIceMineLandmarks ?? '',"
    + " lighting: canvas?.dataset.babylonLightingProfile ?? '', lightingBudget: canvas?.dataset.babylonLightingBudget ?? '',"
    + " locationLighting: canvas?.dataset.locationLighting ?? '', tone: canvas?.dataset.environmentTone ?? '',"
    + " worldObjects: Number(canvas?.dataset.worldObjectCount ?? 0), interactables: Number(canvas?.dataset.interactableActive ?? 0),"
    + " enemies: Number(canvas?.dataset.enemyActive ?? 0), playerPosition: canvas?.dataset.babylonIceMinePlayerPosition ?? '' }; })()");

  if (!state
    || state.scenario !== 'ice-mine'
    || state.environmentVisual !== 'procedural-ice-mine-babylon'
    || state.instances < 40
    || state.landmark !== 'subglacial-vault-ice-pillars'
    || state.composition !== 'access-bore+reinforced-extraction-tunnel+subglacial-vault'
    || state.sequence !== 'access-bore>extraction-tunnel>subglacial-vault'
    || !state.service.includes('support-frame:6+service-deck:4+cryo-machinery:7')
    || state.surface !== 'frost-wall:10+ice-pillar:5'
    || state.machinery !== 'cryo-pump:2+coolant-manifold:3+freeze-compressor:2'
    || !/^intact:\d+\+failed:\d+\+damaged:\d+$/.test(state.brittle)
    || !/^(intact|damaged|partial|cleared)$/.test(state.brittleState)
    || state.fractureVfx !== 'support-cracks+shard-burst+frost-pulse'
    || !/^(idle|cracking|collapsing|settled)$/.test(state.fractureState)
    || !/^(4-shards\+2-cracks|8-shards\+3-cracks)\+frost-pulse$/.test(state.fractureDetail)
    || !/^cracking:\d+\+collapsing:\d+\+settled:\d+$/.test(state.fractureSupports)
    || state.hazardLanguage !== 'shared-hazards+brittle-support-fracture'
    || state.localCues < 1
    || state.boss !== 'rhea-kade'
    || state.bossCue !== 'fracture-ring+cryo-halo+fracture-ram'
    || !/^(queued|active-phase-[12])$/.test(state.bossCueState)
    || state.parity !== 'architecture+frost-materials+props+interactables+hazards+fracture+navigation+boss-cues+shared-world-cues'
    || state.identity !== 'bore-crystals|frosted-industrial|ice-cyan|drill-service'
    || state.routes < 6
    || state.landmarks !== 'ACCESS BORE|EXTRACTION TUNNEL|SUBGLACIAL VAULT'
    || state.lighting !== 'ice-cyan'
    || !/^tier:(high|balanced|performance)\|practical:(1|2)\|shadows:off$/.test(state.lightingBudget)
    || !/^ice-mine:ice-cyan:aces-\d+\.\d{2}$/.test(state.locationLighting)
    || !/^aces-\d+\.\d{2}$/.test(state.tone)
    || state.worldObjects < 1
    || state.interactables < 1
    || state.enemies < 1
    || !/^\d+\.\d,\d+\.\d$/.test(state.playerPosition)
    || state.playerPosition === beforeMove) {
    throw new Error('P27-C5 Babylon Ice Mine runtime parity regressed: ' + JSON.stringify(state));
  }
  if (viewportMode === 'mobile-landscape' && state.fractureDetail !== '4-shards+2-cracks+frost-pulse') {
    throw new Error('P27-C5 mobile Ice Mine fracture detail did not reduce: ' + JSON.stringify(state));
  }

  console.log('BROWSER_P27C5_BABYLON_ICE_MINE_PASS viewport=' + viewportMode
    + ' identity=' + state.identity
    + ' routes=' + state.routes
    + ' landmarks=' + state.landmarks
    + ' machinery=' + state.localCues
    + ' brittle=' + state.brittleState + ':' + state.brittle
    + ' fracture=' + state.fractureState + ':' + state.fractureDetail
    + ' boss=' + state.boss + ':' + state.bossCueState
    + ' movement=' + beforeMove + '->' + afterMove
    + ' lighting=' + state.locationLighting);
  return state;
}


async function p27C6BabylonSolarYardAudit() {
  await waitFor(
    "(() => { const canvas = document.querySelector('canvas'); return"
      + " canvas?.dataset.graphicsPathSelection === 'qa-explicit'"
      + " && canvas?.dataset.graphicsPathRequested === 'babylon'"
      + " && canvas?.dataset.graphicsPathLoaded === 'babylon'"
      + " && !(canvas?.dataset.graphicsPathFallback ?? '')"
      + " && !(canvas?.dataset.babylonFallbackReason ?? '')"
      + " && canvas?.dataset.babylonInit === 'ready'"
      + " && canvas?.dataset.babylonBackend === 'webgl2'"
      + " && canvas?.dataset.babylonScenario === 'solar-yard'"
      + " && canvas?.dataset.environmentVisual === 'procedural-solar-yard-babylon'"
      + " && canvas?.dataset.environmentLandmark === 'gold-reflector-pylon-row'"
      + " && canvas?.dataset.environmentComposition === 'shade-service-deck+fabrication-spine+sunward-work-yard'"
      + " && canvas?.dataset.environmentZoneIdentity === 'shade:ceramic-deck+radiator-towers+thermal-shutter|spine:truss-frames+sinter-forges+transfer-rails+gantry-cranes|sunward:reflector-pylons+printer-spindles+feedstock-presses'"
      + " && canvas?.dataset.environmentMaterials === 'ceramic-shell+scorched-steel+black-radiator+solar-gold+heat-amber'"
      + " && canvas?.dataset.environmentSunShadow === 'hard-sun+cool-shade+long-shadow'"
      + " && canvas?.dataset.environmentSunDirection === 'fixed-sunward-east-to-west'"
      + " && /^(hard-sun|solar-surge)$/.test(canvas?.dataset.environmentSunMode ?? '')"
      + " && /^sun:[123]\\+shade:[123]$/.test(canvas?.dataset.environmentSunPatches ?? '')"
      + " && canvas?.dataset.environmentThermalShutters === 'procedural-babylon:open'"
      + " && /^(shutters-open|solar-surge-exposed)$/.test(canvas?.dataset.environmentThermalProtection ?? '')"
      + " && canvas?.dataset.environmentThermalShutterControl === 'solar-shutter:state-linked'"
      + " && canvas?.dataset.environmentThermalWindow === '10.0-18.0s:shutter-gated'"
      + " && /^reciprocating-trolleys:[12]$/.test(canvas?.dataset.environmentCraneMotion ?? '')"
      + " && /^-?\\d+\\.\\d{2}(,-?\\d+\\.\\d{2})?$/.test(canvas?.dataset.environmentCraneOffsets ?? '')"
      + " && canvas?.dataset.environmentHazardLanguage === 'shared-hazards+solar-surge+thermal-shutter+radiator-saturation+crane-runaway'"
      + " && canvas?.dataset.locationArtIdentity === 'panel-clamps|heat-shielded-alloy|solar-orange|fabrication-service'"
      + " && canvas?.dataset.interactableBiome === 'solar-yard'"
      + " && Number(canvas?.dataset.interactableLocationCueCount ?? 0) > 0"
      + " && canvas?.dataset.bossPresentation === 'helios-9'"
      + " && canvas?.dataset.bossSilhouette === 'sunshield-crown+reflector-wings+fabricator-core'"
      + " && canvas?.dataset.bossCue === 'sunshield-crown+reflector-wings+fabricator-core'"
      + " && Number(canvas?.dataset.babylonSolarYardRoutes ?? 0) >= 6"
      + " && canvas?.dataset.babylonSolarYardLandmarks === 'SHADE GANTRY|FABRICATION SPINE|SUNWARD YARD'"
      + " && canvas?.dataset.babylonWorldState === 'ready'"
      + " && Number(canvas?.dataset.worldObjectCount ?? 0) > 0"
      + " && Number(canvas?.dataset.interactableActive ?? 0) > 0"
      + " && canvas?.dataset.hazardReadability === 'shape-coded+floor-bound+quality-safe'"
      + " && Number(canvas?.dataset.enemyActive ?? 0) > 0"
      + " && Number(canvas?.dataset.babylonFrames ?? 0) >= 2; })()",
    'P27-C6 Babylon Solar Yard parity',
    45_000,
  );

  const beforeMove = await evaluate("document.querySelector('canvas')?.dataset.babylonSolarYardPlayerPosition ?? ''");
  if (!/^\d+\.\d,\d+\.\d$/.test(beforeMove)) {
    throw new Error('P27-C6 Solar Yard player position telemetry unavailable before movement: ' + beforeMove);
  }
  for (const key of ['d', 'w', 'a']) {
    const code = key === 'd' ? 'KeyD' : key === 'w' ? 'KeyW' : 'KeyA';
    const virtual = key === 'd' ? 68 : key === 'w' ? 87 : 65;
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual });
    await sleep(420);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual });
    await sleep(140);
    const moved = await evaluate("document.querySelector('canvas')?.dataset.babylonSolarYardPlayerPosition !== " + JSON.stringify(beforeMove));
    if (moved) break;
  }
  await waitFor("document.querySelector('canvas')?.dataset.babylonSolarYardPlayerPosition !== " + JSON.stringify(beforeMove), 'P27-C6 Solar Yard movement', 5_000);
  const afterMove = await evaluate("document.querySelector('canvas')?.dataset.babylonSolarYardPlayerPosition ?? ''");

  const state = await evaluate("(() => { const canvas = document.querySelector('canvas'); return {"
    + " scenario: canvas?.dataset.babylonScenario ?? '', environmentVisual: canvas?.dataset.environmentVisual ?? '',"
    + " profile: canvas?.dataset.environmentPerformanceProfile ?? '', budget: canvas?.dataset.environmentInstanceBudget ?? '',"
    + " service: canvas?.dataset.environmentServiceDetails ?? '', surface: canvas?.dataset.environmentSurfaceDetail ?? '',"
    + " machinery: canvas?.dataset.environmentMachineDetail ?? '', transport: canvas?.dataset.environmentTransport ?? '',"
    + " craneMotion: canvas?.dataset.environmentCraneMotion ?? '', craneOffsets: canvas?.dataset.environmentCraneOffsets ?? '',"
    + " thermal: canvas?.dataset.environmentThermalShutters ?? '', protection: canvas?.dataset.environmentThermalProtection ?? '',"
    + " sunMode: canvas?.dataset.environmentSunMode ?? '', sunPatches: canvas?.dataset.environmentSunPatches ?? '',"
    + " hazardLanguage: canvas?.dataset.environmentHazardLanguage ?? '', hazardMode: canvas?.dataset.environmentHazardMode ?? '',"
    + " localCues: Number(canvas?.dataset.interactableLocationCueCount ?? 0), boss: canvas?.dataset.bossPresentation ?? '',"
    + " bossCueState: canvas?.dataset.bossCueState ?? '', parity: canvas?.dataset.babylonSolarYardParity ?? '',"
    + " identity: canvas?.dataset.locationArtIdentity ?? '', routes: Number(canvas?.dataset.babylonSolarYardRoutes ?? 0),"
    + " landmarks: canvas?.dataset.babylonSolarYardLandmarks ?? '', lighting: canvas?.dataset.babylonLightingProfile ?? '',"
    + " lightingBudget: canvas?.dataset.babylonLightingBudget ?? '', locationLighting: canvas?.dataset.locationLighting ?? '',"
    + " worldObjects: Number(canvas?.dataset.worldObjectCount ?? 0), interactables: Number(canvas?.dataset.interactableActive ?? 0),"
    + " enemies: Number(canvas?.dataset.enemyActive ?? 0), playerPosition: canvas?.dataset.babylonSolarYardPlayerPosition ?? '' }; })()");

  if (!state
    || state.scenario !== 'solar-yard'
    || state.environmentVisual !== 'procedural-solar-yard-babylon'
    || !/^(full|balanced|mobile|performance):procedural:structure-shadows-off$/.test(state.profile)
    || !/^deck:(4|6)\+truss:(3|5)\+radiator:(2|4)\+reflector:3\+machines:(4|7)\+rail:(2|3)\+crane:(1|2)\+shutter:1$/.test(state.budget)
    || !state.service.includes('thermal-shutter:1')
    || !state.surface.includes('reflector-pylon:3')
    || !state.machinery.includes('sinter-forge:')
    || !state.transport.includes('transfer-rail:')
    || !/^reciprocating-trolleys:[12]$/.test(state.craneMotion)
    || !/^-?\d+\.\d{2}(,-?\d+\.\d{2})?$/.test(state.craneOffsets)
    || state.thermal !== 'procedural-babylon:open'
    || !/^(shutters-open|solar-surge-exposed)$/.test(state.protection)
    || !/^(hard-sun|solar-surge)$/.test(state.sunMode)
    || !/^sun:[123]\+shade:[123]$/.test(state.sunPatches)
    || state.hazardLanguage !== 'shared-hazards+solar-surge+thermal-shutter+radiator-saturation+crane-runaway'
    || !/^(nominal|solar-surge|radiator-saturation|crane-runaway)$/.test(state.hazardMode)
    || state.localCues < 1
    || state.boss !== 'helios-9'
    || !/^(queued|active-phase-[12])$/.test(state.bossCueState)
    || state.parity !== 'panel-clamp-architecture+heat-materials+props+interactables+hazards+thermal-shutter+transport+navigation+boss-cues+shared-world-cues'
    || state.identity !== 'panel-clamps|heat-shielded-alloy|solar-orange|fabrication-service'
    || state.routes < 6
    || state.landmarks !== 'SHADE GANTRY|FABRICATION SPINE|SUNWARD YARD'
    || state.lighting !== 'solar-orange'
    || !/^tier:(high|balanced|performance)\|practical:(1|2)\|shadows:off$/.test(state.lightingBudget)
    || !/^solar-yard:solar-orange:aces-\d+\.\d{2}$/.test(state.locationLighting)
    || state.worldObjects < 1
    || state.interactables < 1
    || state.enemies < 1
    || state.playerPosition === beforeMove) {
    throw new Error('P27-C6 Babylon Solar Yard runtime parity regressed: ' + JSON.stringify(state));
  }
  if (viewportMode === 'mobile-landscape' && !/^(mobile|performance):/.test(state.profile)) {
    throw new Error('P27-C6 mobile Solar Yard profile did not reduce: ' + JSON.stringify(state));
  }

  const initialOffsets = state.craneOffsets;
  await waitFor("(() => { const value = document.querySelector('canvas')?.dataset.environmentCraneOffsets ?? ''; return Boolean(value) && value !== " + JSON.stringify(initialOffsets) + "; })()", 'P27-C6 Solar Yard gantry motion', 5_000);
  console.log('BROWSER_P27C6_BABYLON_SOLAR_YARD_PASS viewport=' + viewportMode
    + ' identity=' + state.identity + ' routes=' + state.routes + ' landmarks=' + state.landmarks
    + ' machinery=' + state.localCues + ' transport=' + state.transport + ':' + state.craneMotion
    + ' shutters=' + state.thermal + ':' + state.protection + ' sun=' + state.sunMode + ':' + state.sunPatches
    + ' boss=' + state.boss + ':' + state.bossCueState + ' movement=' + beforeMove + '->' + afterMove
    + ' lighting=' + state.locationLighting);
  return state;
}


async function p27C7BabylonLatticeAnnexAudit() {
  await waitFor(
    "(() => { const canvas = document.querySelector('canvas'); return"
      + " canvas?.dataset.graphicsPathSelection === 'qa-explicit'"
      + " && canvas?.dataset.graphicsPathRequested === 'babylon'"
      + " && canvas?.dataset.graphicsPathLoaded === 'babylon'"
      + " && !(canvas?.dataset.graphicsPathFallback ?? '')"
      + " && !(canvas?.dataset.babylonFallbackReason ?? '')"
      + " && canvas?.dataset.babylonInit === 'ready'"
      + " && canvas?.dataset.babylonBackend === 'webgl2'"
      + " && canvas?.dataset.babylonScene === 'active'"
      + " && canvas?.dataset.babylonScenario === 'lattice-annex'"
      + " && canvas?.dataset.babylonEnvironmentState === 'ready'"
      + " && canvas?.dataset.environmentVisual === 'procedural-lattice-annex-babylon'"
      + " && canvas?.dataset.environmentLandmark === 'long-reference-pylon-gallery'"
      + " && canvas?.dataset.environmentComposition === 'cold-metrology-ring+long-reference-gallery+sample-vault'"
      + " && canvas?.dataset.environmentZoneIdentity === 'ring:survey-ceramic+metrology-plinths|gallery:reference-pylon-row+calibration-rails+mass-shift-bands|vault:sample-cradles+calibration-shutters+reference-network'"
      + " && canvas?.dataset.environmentMaterials === 'survey-ceramic+brushed-metrology-steel+black-reference-glass+metrology-teal'"
      + " && canvas?.dataset.environmentCalibrationTimeline === '10.0s:near-zero-g>20.0s:shutter-index'"
      + " && /^(nominal|near-zero-g)$/.test(canvas?.dataset.environmentCalibrationMass ?? '')"
      + " && /^(retracted|indexed|partial|destroyed):[0-2]$/.test(canvas?.dataset.environmentCalibrationShutters ?? '')"
      + " && /^active:[0-3]\\+intact:[0-3]$/.test(canvas?.dataset.environmentReferenceNetwork ?? '')"
      + " && canvas?.dataset.environmentHazardLanguage === 'shared-hazards+calibration-mass-shift+gravity-well+calibration-shutters+reference-network'"
      + " && canvas?.dataset.locationArtIdentity === 'reference-pylons|survey-ceramic|metrology-teal|calibration-service'"
      + " && canvas?.dataset.interactableBiome === 'lattice-annex'"
      + " && Number(canvas?.dataset.interactableLocationCueCount ?? 0) > 0"
      + " && canvas?.dataset.bossBiome === 'lattice-annex'"
      + " && canvas?.dataset.bossPresentation === 'veyra-senn'"
      + " && canvas?.dataset.bossSilhouette === 'survey-crown+reference-spines+archive-core'"
      + " && canvas?.dataset.bossCue === 'survey-sweep+reference-lock+archive-purge'"
      + " && Number(canvas?.dataset.babylonLatticeAnnexRoutes ?? 0) >= 6"
      + " && canvas?.dataset.babylonLatticeAnnexLandmarks === 'METROLOGY RING|REFERENCE GALLERY|SAMPLE VAULT'"
      + " && canvas?.dataset.babylonWorldState === 'ready'"
      + " && canvas?.dataset.worldPresentationMode === 'scene-meshes-not-hud'"
      + " && Number(canvas?.dataset.worldObjectCount ?? 0) > 0"
      + " && Number(canvas?.dataset.interactableActive ?? 0) > 0"
      + " && canvas?.dataset.hazardReadability === 'shape-coded+floor-bound+quality-safe'"
      + " && Number(canvas?.dataset.enemyActive ?? 0) > 0"
      + " && Number(canvas?.dataset.babylonFrames ?? 0) >= 2; })()",
    'P27-C7 Babylon Lattice Annex parity',
    45_000,
  );

  const beforeMove = await evaluate("document.querySelector('canvas')?.dataset.babylonLatticeAnnexPlayerPosition ?? ''");
  if (!/^\\d+\\.\\d,\\d+\\.\\d$/.test(beforeMove)) {
    throw new Error('P27-C7 Lattice Annex player position telemetry unavailable before movement: ' + beforeMove);
  }
  for (const key of ['d', 'w', 'a']) {
    const code = key === 'd' ? 'KeyD' : key === 'w' ? 'KeyW' : 'KeyA';
    const virtual = key === 'd' ? 68 : key === 'w' ? 87 : 65;
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual });
    await sleep(420);
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual });
    await sleep(140);
    const moved = await evaluate("document.querySelector('canvas')?.dataset.babylonLatticeAnnexPlayerPosition !== " + JSON.stringify(beforeMove));
    if (moved) break;
  }
  await waitFor("document.querySelector('canvas')?.dataset.babylonLatticeAnnexPlayerPosition !== " + JSON.stringify(beforeMove), 'P27-C7 Lattice Annex movement', 5_000);
  const afterMove = await evaluate("document.querySelector('canvas')?.dataset.babylonLatticeAnnexPlayerPosition ?? ''");

  await waitFor("document.querySelector('canvas')?.dataset.environmentCalibrationMass === 'near-zero-g'", 'P27-C7 Lattice Annex calibration mass shift', 16_000);

  const state = await evaluate("(() => { const canvas = document.querySelector('canvas'); return {"
    + " scenario: canvas?.dataset.babylonScenario ?? '', environmentVisual: canvas?.dataset.environmentVisual ?? '',"
    + " profile: canvas?.dataset.environmentPerformanceProfile ?? '', budget: canvas?.dataset.environmentInstanceBudget ?? '',"
    + " service: canvas?.dataset.environmentServiceDetails ?? '', surface: canvas?.dataset.environmentSurfaceDetail ?? '',"
    + " machinery: canvas?.dataset.environmentMachineDetail ?? '', calibration: canvas?.dataset.environmentCalibrationMass ?? '',"
    + " gravity: canvas?.dataset.environmentGalleryGravity ?? '', shutters: canvas?.dataset.environmentCalibrationShutters ?? '',"
    + " references: canvas?.dataset.environmentReferenceNetwork ?? '', hazardMode: canvas?.dataset.environmentHazardMode ?? '',"
    + " localCues: Number(canvas?.dataset.interactableLocationCueCount ?? 0), boss: canvas?.dataset.bossPresentation ?? '',"
    + " bossCueState: canvas?.dataset.bossCueState ?? '', parity: canvas?.dataset.babylonLatticeAnnexParity ?? '',"
    + " identity: canvas?.dataset.locationArtIdentity ?? '', routes: Number(canvas?.dataset.babylonLatticeAnnexRoutes ?? 0),"
    + " landmarks: canvas?.dataset.babylonLatticeAnnexLandmarks ?? '', lighting: canvas?.dataset.babylonLightingProfile ?? '',"
    + " lightingBudget: canvas?.dataset.babylonLightingBudget ?? '', locationLighting: canvas?.dataset.locationLighting ?? '',"
    + " worldObjects: Number(canvas?.dataset.worldObjectCount ?? 0), interactables: Number(canvas?.dataset.interactableActive ?? 0),"
    + " enemies: Number(canvas?.dataset.enemyActive ?? 0), playerPosition: canvas?.dataset.babylonLatticeAnnexPlayerPosition ?? '' }; })()");

  if (!state
    || state.scenario !== 'lattice-annex'
    || state.environmentVisual !== 'procedural-lattice-annex-babylon'
    || !/^(full|balanced|mobile|performance):procedural:structure-shadows-off$/.test(state.profile)
    || !/^pylon:(5|7|9)\\+frame:(3|4|5|6)\\+plinth:(2|3)\\+cradle:(1|2|3)\\+rail:(2|3)\\+band:(1|2|3)\\+shutter:2\\+reference:3$/.test(state.budget)
    || !state.service.includes('metrology-plinth:')
    || !state.surface.includes('reference-pylon:')
    || !state.machinery.includes('calibration-shutter:2')
    || state.calibration !== 'near-zero-g'
    || !/^0\\.0[0-4],0\\.0[0-3]$/.test(state.gravity)
    || !/^(retracted|indexed|partial|destroyed):[0-2]$/.test(state.shutters)
    || !/^active:[0-3]\\+intact:[0-3]$/.test(state.references)
    || state.localCues < 1
    || state.boss !== 'veyra-senn'
    || !/^(queued|active-phase-[12]:(none|surveySweep|referenceLock|archivePurge))$/.test(state.bossCueState)
    || state.parity !== 'reference-pylon-architecture+survey-materials+props+interactables+hazards+calibration-mass-shift+shutters+reference-network+navigation+boss-cues+shared-world-cues'
    || state.identity !== 'reference-pylons|survey-ceramic|metrology-teal|calibration-service'
    || state.routes < 6
    || state.landmarks !== 'METROLOGY RING|REFERENCE GALLERY|SAMPLE VAULT'
    || state.lighting !== 'metrology-teal'
    || !/^tier:(high|balanced|performance)\\|practical:(1|2)\\|shadows:off$/.test(state.lightingBudget)
    || !/^lattice-annex:metrology-teal:aces-\\d+\\.\\d{2}$/.test(state.locationLighting)
    || state.worldObjects < 1
    || state.interactables < 1
    || state.enemies < 1
    || state.playerPosition === beforeMove) {
    throw new Error('P27-C7 Babylon Lattice Annex runtime parity regressed: ' + JSON.stringify(state));
  }
  if (viewportMode === 'mobile-landscape' && !/^(mobile|performance):/.test(state.profile)) {
    throw new Error('P27-C7 mobile Lattice Annex profile did not reduce: ' + JSON.stringify(state));
  }

  console.log('BROWSER_P27C7_BABYLON_LATTICE_ANNEX_PASS viewport=' + viewportMode
    + ' identity=' + state.identity + ' routes=' + state.routes + ' landmarks=' + state.landmarks
    + ' calibration=' + state.calibration + ':' + state.gravity + ' shutters=' + state.shutters
    + ' references=' + state.references + ' boss=' + state.boss + ':' + state.bossCueState
    + ' movement=' + beforeMove + '->' + afterMove + ' lighting=' + state.locationLighting);
  return state;
}

async function p27A2BabylonBackendAudit() {
  const babylonInitState = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return {
      init: canvas?.dataset.babylonInit ?? '',
      fallback: canvas?.dataset.graphicsPathFallback ?? '',
      fallbackReason: canvas?.dataset.babylonFallbackReason ?? '',
      loaded: canvas?.dataset.graphicsPathLoaded ?? '',
    };
  })()`);
  if (babylonInitState?.init === 'fallback' || babylonInitState?.init === 'failed') {
    throw new Error('P27-A2 Babylon backend initialization failed before readiness: ' + JSON.stringify(babylonInitState));
  }
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.dataset.graphicsPathSelection === 'qa-explicit'
      && canvas?.dataset.graphicsPathRequested === 'babylon'
      && canvas?.dataset.graphicsPathLoaded === 'babylon'
      && canvas?.dataset.babylonInit === 'ready'
      && canvas?.dataset.babylonBackend === 'webgl2'
      && canvas?.dataset.babylonScene === 'active'
      && canvas?.dataset.babylonDisposed === 'false'
      && canvas?.dataset.babylonCameraParity === 'three-combat-v1'
      && canvas?.dataset.babylonInputParity === 'ground-plane-raycast-v1'
      && canvas?.dataset.babylonEnvironmentState === 'ready'
      && canvas?.dataset.environmentVisual === 'authored-refinery-babylon'
      && canvas?.dataset.babylonPlayerState === 'ready'
      && /^authored-[12]-babylon$/.test(canvas?.dataset.operatorVisual ?? '')
      && canvas?.dataset.operatorRig === 'articulated'
      && canvas?.dataset.operatorSocket === 'weapon-socket'
      && canvas?.dataset.weaponVisual === 'authored-babylon'
      && canvas?.dataset.weaponRoles === 'breacher,carbine,rail'
      && canvas?.dataset.babylonEnemyCatalogState === 'ready'
      && canvas?.dataset.babylonEnemyState === 'ready'
      && canvas?.dataset.babylonEnemyCatalogRoles === 'assault,suppressor,technician,elite'
      && Number(canvas?.dataset.enemyActive ?? 0) > 0
      && Number(canvas?.dataset.enemyLoadingCount ?? 0) === 0
      && Boolean(canvas?.dataset.enemyAnimationTarget)
      && Boolean(canvas?.dataset.babylonEnemyRuntime)
      && canvas?.dataset.babylonWorldState === 'ready'
      && canvas?.dataset.worldPresentationMode === 'scene-meshes-not-hud'
      && Number(canvas?.dataset.worldObjectCount ?? 0) > 0
      && Number(canvas?.dataset.interactableActive ?? 0) > 0
      && canvas?.dataset.interactableVisual === 'authored-babylon'
      && canvas?.dataset.interactableReadability === 'shape-coded+state-emissive+floor-cue:quality-safe'
      && canvas?.dataset.objectiveWorldCue === 'beacon+navigation-path'
      && Boolean(canvas?.dataset.objectiveTarget)
      && canvas?.dataset.hazardReadability === 'shape-coded+floor-bound+quality-safe'
      && canvas?.dataset.lootReadability === 'authored-capsule+rarity-shape+ring+beam'
      && canvas?.dataset.breachReadability === 'pressure-state+floor-ring+boss-priority'
      && Boolean(canvas?.dataset.babylonWorldRuntime)
      && Boolean(canvas?.dataset.babylonPlayerRuntime)
      && Boolean(canvas?.dataset.babylonWeaponMuzzle)
      && Boolean(canvas?.dataset.babylonCameraFraming)
      && Boolean(canvas?.dataset.babylonViewport)
      && Boolean(canvas?.dataset.babylonEnvironmentRuntime)
      && Boolean(canvas?.dataset.babylonSceneTelemetry)
      && Number(canvas?.dataset.babylonFrames ?? 0) >= 2;
  })()`, 'P27-A2 Babylon WebGL2 QA backend', 45_000);

  const pointerProbe = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      coarse: window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900,
      x: rect.left + rect.width * 0.68,
      y: rect.top + rect.height * 0.48,
    };
  })()`);
  if (!pointerProbe) throw new Error('P27-B1 could not locate the canvas for the Babylon pointer probe.');

  const dispatchBabylonPointerProbe = async pointerId => {
    await evaluate(`(() => {
      const canvas = document.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      delete canvas.dataset.babylonPointerDirection;
      return true;
    })()`);
    if (pointerProbe.coarse) {
      await call('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: pointerProbe.x, y: pointerProbe.y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }],
      });
      try {
        await waitFor(`/^[-0-9.]+,[-0-9.]+$/.test(document.querySelector('canvas')?.dataset.babylonPointerDirection ?? '')`, 'P27-B1 Babylon touch ground projection', 5_000);
      } finally {
        await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => undefined);
      }
    } else {
      const dispatched = await evaluate(`(() => {
        const canvas = document.querySelector('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: ${pointerId},
          pointerType: 'mouse',
          clientX: rect.left + rect.width * 0.68,
          clientY: rect.top + rect.height * 0.48,
          button: 0,
        }));
        return true;
      })()`);
      if (!dispatched) throw new Error('P27-B1 could not dispatch the Babylon pointer parity probe.');
      await waitFor(`/^[-0-9.]+,[-0-9.]+$/.test(document.querySelector('canvas')?.dataset.babylonPointerDirection ?? '')`, 'P27-B1 Babylon pointer ground projection', 5_000);
    }
    return evaluate(`document.querySelector('canvas')?.dataset.babylonPointerDirection ?? ''`);
  };

  const pointerSamples = [];
  for (let index = 0; index < 6; index += 1) {
    pointerSamples.push(await dispatchBabylonPointerProbe(927 + index));
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const parseDirection = value => value.split(',').map(Number);
  const parsedDirections = pointerSamples.map(parseDirection);
  const pointerFirst = pointerSamples[0];
  const pointerSecond = pointerSamples[1];
  const pointerThird = pointerSamples[pointerSamples.length - 1];
  const firstDirection = parsedDirections[0];
  const secondDirection = parsedDirections[1];
  const settledPreviousDirection = parsedDirections[parsedDirections.length - 2];
  const settledDirection = parsedDirections[parsedDirections.length - 1];
  const initialRetargetDelta = Math.hypot(firstDirection[0] - secondDirection[0], firstDirection[1] - secondDirection[1]);
  const settledDirectionDelta = Math.hypot(
    settledPreviousDirection[0] - settledDirection[0],
    settledPreviousDirection[1] - settledDirection[1],
  );
  const normalized = parsedDirections.every(direction => {
    const length = Math.hypot(direction[0], direction[1]);
    return direction.every(Number.isFinite) && Math.abs(length - 1) <= 0.01;
  });
  if (!normalized || settledDirectionDelta > 0.04) {
    throw new Error(`P27-B1 Babylon ground projection is not normalized/stable after camera retarget: samples=${pointerSamples.join(' -> ')} initialDelta=${initialRetargetDelta} settledDelta=${settledDirectionDelta}`);
  }
  const preFireShotCount = Number(await evaluate(`document.querySelector('canvas')?.dataset.babylonWeaponShotCount ?? 0`));
  if (pointerProbe.coarse) {
    const fireStarted = await evaluate(`(() => {
      const button = document.querySelector('.fire-button');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 936,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 1,
      }));
      return true;
    })()`);
    if (!fireStarted) throw new Error('P27-B6 mobile Babylon fire probe could not press FIRE.');
    try {
      await waitFor(`Number(document.querySelector('canvas')?.dataset.babylonWeaponShotCount ?? 0) > ${preFireShotCount}`, 'P27-B6 mobile Babylon weapon fire', 8_000);
    } finally {
      await evaluate(`(() => {
        const button = document.querySelector('.fire-button');
        if (!(button instanceof HTMLButtonElement)) return false;
        button.dispatchEvent(new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 936,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons: 0,
        }));
        return true;
      })()`).catch(() => undefined);
    }
  } else {
    const fireStarted = await evaluate(`(() => {
      const canvas = document.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 936,
        pointerType: 'mouse',
        isPrimary: true,
        clientX: rect.left + rect.width * 0.68,
        clientY: rect.top + rect.height * 0.48,
        button: 0,
        buttons: 1,
      }));
      return true;
    })()`);
    if (!fireStarted) throw new Error('P27-B6 desktop Babylon fire probe could not press the combat canvas.');
    try {
      await waitFor(`Number(document.querySelector('canvas')?.dataset.babylonWeaponShotCount ?? 0) > ${preFireShotCount}`, 'P27-B6 desktop Babylon weapon fire', 8_000);
    } finally {
      await evaluate(`(() => {
        const canvas = document.querySelector('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 936,
          pointerType: 'mouse',
          isPrimary: true,
          clientX: rect.left + rect.width * 0.68,
          clientY: rect.top + rect.height * 0.48,
          button: 0,
          buttons: 0,
        }));
        return true;
      })()`).catch(() => undefined);
    }
  }
  const fireProbeShotCount = Number(await evaluate(`document.querySelector('canvas')?.dataset.babylonWeaponShotCount ?? 0`));

  const pointerAfterFire = await evaluate(`document.querySelector('canvas')?.dataset.babylonPointerDirection ?? ''`);

  const state = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return {
      selection: canvas?.dataset.graphicsPathSelection ?? '',
      requested: canvas?.dataset.graphicsPathRequested ?? '',
      loaded: canvas?.dataset.graphicsPathLoaded ?? '',
      fallback: canvas?.dataset.graphicsPathFallback ?? '',
      fallbackReason: canvas?.dataset.babylonFallbackReason ?? '',
      init: canvas?.dataset.babylonInit ?? '',
      backend: canvas?.dataset.babylonBackend ?? '',
      scene: canvas?.dataset.babylonScene ?? '',
      disposed: canvas?.dataset.babylonDisposed ?? '',
      camera: canvas?.dataset.babylonCameraParity ?? '',
      input: canvas?.dataset.babylonInputParity ?? '',
      pointer: canvas?.dataset.babylonPointerDirection ?? '',
      layout: canvas?.dataset.babylonCameraLayout ?? '',
      framing: canvas?.dataset.babylonCameraFraming ?? '',
      viewport: canvas?.dataset.babylonViewport ?? '',
      feedback: canvas?.dataset.cameraFeedback ?? '',
      environmentState: canvas?.dataset.babylonEnvironmentState ?? '',
      environmentVisual: canvas?.dataset.environmentVisual ?? '',
      environmentKit: canvas?.dataset.environmentKit ?? '',
      environmentLod: canvas?.dataset.environmentLod ?? '',
      environmentAssets: Number(canvas?.dataset.babylonEnvironmentAssets ?? 0),
      environmentPlacements: Number(canvas?.dataset.babylonEnvironmentPlacements ?? 0),
      environmentInstances: Number(canvas?.dataset.environmentInstances ?? 0),
      environmentTerminals: Number(canvas?.dataset.environmentTerminals ?? 0),
      environmentLandmark: canvas?.dataset.environmentLandmark ?? '',
      environmentServiceDetails: canvas?.dataset.environmentServiceDetails ?? '',
      environmentSurfaceDetail: canvas?.dataset.environmentSurfaceDetail ?? '',
      environmentMachineDetail: canvas?.dataset.environmentMachineDetail ?? '',
      environmentComposition: canvas?.dataset.environmentComposition ?? '',
      environmentReuse: canvas?.dataset.babylonEnvironmentReuse ?? '',
      environmentRuntime: canvas?.dataset.babylonEnvironmentRuntime ?? '',
      environmentError: canvas?.dataset.babylonEnvironmentError ?? '',
      playerState: canvas?.dataset.babylonPlayerState ?? '',
      playerError: canvas?.dataset.babylonPlayerError ?? '',
      operatorVisual: canvas?.dataset.operatorVisual ?? '',
      operatorAsset: canvas?.dataset.operatorAsset ?? '',
      operatorClass: canvas?.dataset.operatorClassAsset ?? '',
      operatorRig: canvas?.dataset.operatorRig ?? '',
      operatorSocket: canvas?.dataset.operatorSocket ?? '',
      operatorStance: canvas?.dataset.operatorStance ?? '',
      operatorAnimation: canvas?.dataset.operatorAnimation ?? '',
      operatorBlend: canvas?.dataset.operatorBlend ?? '',
      weaponVisual: canvas?.dataset.weaponVisual ?? '',
      weaponRoles: canvas?.dataset.weaponRoles ?? '',
      weaponFallback: canvas?.dataset.weaponFallback ?? '',
      weaponActive: canvas?.dataset.weaponActive ?? '',
      weaponAsset: canvas?.dataset.weaponAsset ?? '',
      weaponVariant: canvas?.dataset.weaponVariant ?? '',
      weaponHandling: canvas?.dataset.weaponHandling ?? '',
      weaponHeat: canvas?.dataset.weaponHeat ?? '',
      weaponThermalCue: canvas?.dataset.weaponThermalCue ?? '',
      weaponMuzzleOrigin: canvas?.dataset.babylonWeaponMuzzleOrigin ?? '',
      weaponMuzzle: canvas?.dataset.babylonWeaponMuzzle ?? '',
      weaponVfx: canvas?.dataset.babylonWeaponVfx ?? '',
      weaponVfxFamilies: canvas?.dataset.babylonWeaponVfxFamilies ?? '',
      weaponFireFx: canvas?.dataset.babylonWeaponFireFx ?? '',
      weaponMuzzleFx: canvas?.dataset.babylonWeaponMuzzleFx ?? '',
      weaponProjectileCount: Number(canvas?.dataset.babylonWeaponProjectileCount ?? 0),
      weaponProjectileFamilies: canvas?.dataset.babylonWeaponProjectileFamilies ?? '',
      weaponProjectileLanguage: canvas?.dataset.babylonWeaponProjectileLanguage ?? '',
      weaponImpactCount: Number(canvas?.dataset.babylonWeaponImpactCount ?? 0),
      weaponImpactFx: canvas?.dataset.babylonWeaponImpactFx ?? '',
      weaponImpactSerial: Number(canvas?.dataset.babylonWeaponImpactSerial ?? 0),
      weaponImpactHeavy: canvas?.dataset.babylonWeaponImpactHeavy ?? '',
      weaponEffectsMode: canvas?.dataset.babylonWeaponEffectsMode ?? '',
      weaponDamageFeedback: canvas?.dataset.babylonWeaponDamageFeedback ?? '',
      weaponShotCount: Number(canvas?.dataset.babylonWeaponShotCount ?? 0),
      weaponShotCounts: canvas?.dataset.babylonWeaponShotCounts ?? '',
      playerTracking: canvas?.dataset.babylonPlayerTracking ?? '',
      playerReuse: canvas?.dataset.babylonPlayerReuse ?? '',
      playerRuntime: canvas?.dataset.babylonPlayerRuntime ?? '',
      enemyCatalogState: canvas?.dataset.babylonEnemyCatalogState ?? '',
      enemyCatalogError: canvas?.dataset.babylonEnemyCatalogError ?? '',
      enemyCatalogRoles: canvas?.dataset.babylonEnemyCatalogRoles ?? '',
      enemyCatalogAssets: canvas?.dataset.babylonEnemyCatalogAssets ?? '',
      enemyCatalogLod: canvas?.dataset.babylonEnemyCatalogLod ?? '',
      enemyCatalogRuntime: canvas?.dataset.babylonEnemyCatalogRuntime ?? '',
      enemyState: canvas?.dataset.babylonEnemyState ?? '',
      enemyVisual: canvas?.dataset.enemyVisual ?? '',
      enemyRoles: canvas?.dataset.enemyRoles ?? '',
      enemyVariants: canvas?.dataset.enemyVariants ?? '',
      enemyAssets: canvas?.dataset.enemyAssets ?? '',
      enemyActive: Number(canvas?.dataset.enemyActive ?? 0),
      enemyAuthoredCount: Number(canvas?.dataset.enemyAuthoredCount ?? 0),
      enemyFallbackCount: Number(canvas?.dataset.enemyFallbackCount ?? 0),
      enemyLoadingCount: Number(canvas?.dataset.enemyLoadingCount ?? 0),
      enemyAnimation: canvas?.dataset.enemyAnimation ?? '',
      enemyAnimationBlend: canvas?.dataset.enemyAnimationBlend ?? '',
      enemyAnimationTarget: canvas?.dataset.enemyAnimationTarget ?? '',
      enemyVariantSilhouette: canvas?.dataset.enemyVariantSilhouette ?? '',
      enemyFacing: canvas?.dataset.enemyFacing ?? '',
      enemySpawnDeath: canvas?.dataset.enemySpawnDeath ?? '',
      enemyTracking: canvas?.dataset.babylonEnemyTracking ?? '',
      enemyReuse: canvas?.dataset.babylonEnemyReuse ?? '',
      enemyCleanup: canvas?.dataset.babylonEnemyCleanup ?? '',
      enemyRuntime: canvas?.dataset.babylonEnemyRuntime ?? '',
      enemyFallbackReason: canvas?.dataset.babylonEnemyFallbackReason ?? '',
      worldState: canvas?.dataset.babylonWorldState ?? '',
      worldPresentationMode: canvas?.dataset.worldPresentationMode ?? '',
      worldObjectCount: Number(canvas?.dataset.worldObjectCount ?? 0),
      interactableVisual: canvas?.dataset.interactableVisual ?? '',
      interactableAssets: canvas?.dataset.interactableAssets ?? '',
      interactableFallback: canvas?.dataset.interactableFallback ?? '',
      interactableActive: Number(canvas?.dataset.interactableActive ?? 0),
      interactableAuthoredCount: Number(canvas?.dataset.interactableAuthoredCount ?? 0),
      interactableReadability: canvas?.dataset.interactableReadability ?? '',
      objectiveTarget: canvas?.dataset.objectiveTarget ?? '',
      objectiveWorldCue: canvas?.dataset.objectiveWorldCue ?? '',
      objectiveGuideCount: Number(canvas?.dataset.objectiveGuideCount ?? 0),
      hazardActive: Number(canvas?.dataset.hazardActive ?? 0),
      hazardReadability: canvas?.dataset.hazardReadability ?? '',
      lootActive: Number(canvas?.dataset.lootActive ?? 0),
      lootVisual: canvas?.dataset.lootVisual ?? '',
      lootAsset: canvas?.dataset.lootAsset ?? '',
      lootReadability: canvas?.dataset.lootReadability ?? '',
      breachActive: Number(canvas?.dataset.breachActive ?? 0),
      breachReadability: canvas?.dataset.breachReadability ?? '',
      worldReadability: canvas?.dataset.worldReadability ?? '',
      worldMaterialDepth: canvas?.dataset.worldMaterialDepth ?? '',
      biomeState: canvas?.dataset.biomeState ?? '',
      biomeStateSeverity: canvas?.dataset.biomeStateSeverity ?? '',
      biomeStateAnimation: canvas?.dataset.biomeStateAnimation ?? '',
      biomeStateAudio: canvas?.dataset.biomeStateAudio ?? '',
      worldStateVisual: canvas?.dataset.worldStateVisual ?? '',
      worldRuntime: canvas?.dataset.babylonWorldRuntime ?? '',
      sceneTelemetry: canvas?.dataset.babylonSceneTelemetry ?? '',
      renderTier: canvas?.dataset.renderTier ?? '',
      graphicsQuality: canvas?.dataset.graphicsQuality ?? '',
      lightingProfile: canvas?.dataset.babylonLightingProfile ?? '',
      lightingBudget: canvas?.dataset.babylonLightingBudget ?? '',
      environmentIbl: canvas?.dataset.environmentIbl ?? '',
      environmentLighting: canvas?.dataset.environmentLighting ?? '',
      environmentShadowBudget: canvas?.dataset.environmentShadowBudget ?? '',
      environmentTone: canvas?.dataset.environmentTone ?? '',
      environmentBloom: canvas?.dataset.environmentBloom ?? '',
      environmentBloomSources: canvas?.dataset.environmentBloomSources ?? '',
      environmentBloomExcluded: canvas?.dataset.environmentBloomExcluded ?? '',
      environmentContactDepth: canvas?.dataset.environmentContactDepth ?? '',
      environmentContactDepthProtected: canvas?.dataset.environmentContactDepthProtected ?? '',
      environmentAtmosphere: canvas?.dataset.environmentAtmosphere ?? '',
      environmentAtmosphereProtected: canvas?.dataset.environmentAtmosphereProtected ?? '',
      environmentPostTone: canvas?.dataset.environmentPostTone ?? '',
      environmentP21Budget: canvas?.dataset.environmentP21Budget ?? '',
      effectPriority: canvas?.dataset.effectPriority ?? '',
      babylonPostBudget: canvas?.dataset.babylonPostBudget ?? '',
      babylonPostStack: canvas?.dataset.babylonPostStack ?? '',
      locationLighting: canvas?.dataset.locationLighting ?? '',
      pbrMaterials: canvas?.dataset.babylonPbrMaterials ?? '',
      materialIntent: canvas?.dataset.babylonMaterialIntent ?? '',
      rectWidth: canvas?.getBoundingClientRect().width ?? 0,
      rectHeight: canvas?.getBoundingClientRect().height ?? 0,
      bufferWidth: canvas instanceof HTMLCanvasElement ? canvas.width : 0,
      bufferHeight: canvas instanceof HTMLCanvasElement ? canvas.height : 0,
      frames: Number(canvas?.dataset.babylonFrames ?? 0),
    };
  })()`);

  if (!state
    || state.selection !== 'qa-explicit'
    || state.requested !== 'babylon'
    || state.loaded !== 'babylon'
    || state.fallback
    || state.fallbackReason
    || state.init !== 'ready'
    || state.backend !== 'webgl2'
    || state.scene !== 'active'
    || state.disposed !== 'false'
    || state.camera !== 'three-combat-v1'
    || state.input !== 'ground-plane-raycast-v1'
    || state.pointer !== pointerAfterFire
    || !/^(narrow|coarse|standard):height-(18\.0|14\.8|12\.8)\+offset-(13\.2|11\.2|9\.8)\+fov-42$/.test(state.framing)
    || !/^(full|reduced|off):[0-9]+\.[0-9]{2}$/.test(state.feedback)
    || state.frames < 2) {
    throw new Error(`P27-A2 Babylon backend telemetry invalid: ${JSON.stringify(state)}`);
  }

  const expectedRefineryKit = new Set(['floor', 'floor-grate', 'bulkhead', 'processor', 'pipe-rack', 'wall-panel', 'cable-tray', 'service-conduit', 'gantry', 'crate', 'terminal']);
  const refineryKit = new Set(String(state.environmentKit).split(',').filter(Boolean));
  const refineryLods = String(state.environmentLod).split(',').filter(Boolean);
  const environmentRuntimeMatch = /^cached:(\d+)\|active:(\d+)\|bytes:(\d+)$/.exec(state.environmentRuntime);
  const sceneTelemetryMatch = /^meshes:(\d+)\|materials:(\d+)\|textures:(\d+)\|roots:(\d+)$/.exec(state.sceneTelemetry);
  const activeInstances = Number(environmentRuntimeMatch?.[2] ?? NaN);
  const cachedAssets = Number(environmentRuntimeMatch?.[1] ?? NaN);
  const sceneMeshes = Number(sceneTelemetryMatch?.[1] ?? NaN);
  const sceneMaterials = Number(sceneTelemetryMatch?.[2] ?? NaN);
  if (state.environmentState !== 'ready'
    || state.environmentVisual !== 'authored-refinery-babylon'
    || state.environmentError
    || ![...expectedRefineryKit].every(item => refineryKit.has(item))
    || refineryLods.length < 1
    || !refineryLods.every(value => value === '1' || value === '2')
    || state.environmentAssets !== 11
    || state.environmentPlacements !== state.environmentInstances
    || state.environmentInstances < 69
    || state.environmentTerminals < 1
    || state.environmentLandmark !== 'ore-smelter-gantry'
    || state.environmentServiceDetails !== 'service-conduit:6'
    || state.environmentSurfaceDetail !== 'wall-panel:6+cable-tray:6'
    || state.environmentMachineDetail !== 'processor-functional:3+floor-grate:8'
    || state.environmentComposition !== 'clear-center-lane+processor-triangle+gantry-focal+perimeter-clutter'
    || state.environmentReuse !== 'cache-shared+geometry-shared+material-shared'
    || cachedAssets < 11
    || activeInstances < state.environmentInstances
    || !(sceneMeshes > 0)
    || !(sceneMaterials > 0)) {
    throw new Error(`P27-B2 Babylon authored refinery environment parity invalid: ${JSON.stringify(state)}`);
  }


  const expectedPlayerLod = pointerProbe.coarse ? 2 : 1;
  const expectedOperatorAsset = state.operatorClass && state.operatorClass !== 'generic'
    ? `operator-${state.operatorClass}-lod${expectedPlayerLod}`
    : `operator-field-suit-lod${expectedPlayerLod}`;
  const weaponRoles = new Set(String(state.weaponRoles).split(',').filter(Boolean));
  const playerRuntimeMatch = /^cached:(\d+)\|active:(\d+)\|bytes:(\d+)$/.exec(state.playerRuntime);
  const muzzle = String(state.weaponMuzzle).split(',').map(Number);
  const handlingBlendPattern = /^move:\d+\.\d+,aim:\d+\.\d+,recoil:\d+\.\d+,reload:\d+\.\d+,charge:\d+\.\d+,vent:\d+\.\d+,overheat:\d+\.\d+,dodge:\d+\.\d+,hit:\d+\.\d+$/;
  if (state.playerState !== 'ready'
    || state.playerError
    || state.operatorVisual !== `authored-${expectedPlayerLod}-babylon`
    || state.operatorAsset !== expectedOperatorAsset
    || !['generic', 'vanguard', 'vector', 'systems'].includes(state.operatorClass)
    || state.operatorRig !== 'articulated'
    || state.operatorSocket !== 'weapon-socket'
    || !state.operatorStance
    || !['idle', 'locomotion', 'recoil', 'reload', 'charge', 'vent', 'overheat', 'dodge', 'hit', 'down'].includes(state.operatorAnimation)
    || !handlingBlendPattern.test(state.operatorBlend)
    || state.weaponVisual !== 'authored-babylon'
    || state.weaponFallback
    || !['carbine', 'breacher', 'rail'].every(id => weaponRoles.has(id))
    || !['carbine', 'breacher', 'rail'].includes(state.weaponActive)
    || state.weaponAsset !== `weapon-${state.weaponActive}-lod${expectedPlayerLod}`
    || !state.weaponHandling
    || !['nominal', 'warning', 'critical'].includes(state.weaponThermalCue)
    || !Number.isFinite(Number(state.weaponHeat))
    || state.weaponMuzzleOrigin !== 'muzzle-socket'
    || muzzle.length !== 3
    || !muzzle.every(Number.isFinite)
    || !state.playerTracking.startsWith(`sim:${state.weaponActive}|class:${state.operatorClass}|aim:`)
    || state.playerReuse !== 'shared-runtime+authored-rig+authored-sockets+shared-presentation-signals'
    || !playerRuntimeMatch
    || Number(playerRuntimeMatch[1]) < 15
    || Number(playerRuntimeMatch[2]) < state.environmentInstances + 4) {
    throw new Error(`P27-B3 Babylon operator/weapon presentation parity invalid: ${JSON.stringify(state)}`);
  }

  const expectedWeaponFireFx = state.weaponActive === 'rail'
    ? state.weaponVariant === 'rail-charge' ? 'charge-lance' : state.weaponVariant === 'rail-repeater' ? 'repeater-lance' : 'lance'
    : state.weaponActive === 'breacher'
      ? state.weaponVariant === 'breacher-slug' ? 'slug-impact' : state.weaponVariant === 'breacher-rapid' ? 'rapid-scatter' : 'scatter'
      : state.weaponVariant === 'carbine-burst' ? 'burst-tracer' : state.weaponVariant === 'carbine-precision' ? 'precision-tracer' : 'tracer';
  if (state.weaponVfx !== 'muzzle+projectiles+impact'
    || state.weaponVfxFamilies !== 'breacher,carbine,rail'
    || state.weaponFireFx !== expectedWeaponFireFx
    || !['idle', 'authored-socket-live'].includes(state.weaponMuzzleFx)
    || state.weaponProjectileCount < 0
    || !['idle', 'carbine', 'breacher', 'rail', 'carbine,breacher', 'carbine,rail', 'breacher,rail', 'breacher,carbine,rail'].includes(state.weaponProjectileFamilies)
    || state.weaponProjectileLanguage !== 'carbine:tracer|breacher:scatter-slug|rail:beam-lance|enemy:bolt'
    || state.weaponImpactCount < 0
    || !['armor-spark', 'hull-spall', 'field-flash', 'metal-spark', 'electrical-flash', 'industrial-spall', 'generic-spark'].includes(state.weaponImpactFx)
    || state.weaponImpactSerial < 0
    || !['true', 'false'].includes(state.weaponImpactHeavy)
    || !['full', 'reduced'].includes(state.weaponEffectsMode)
    || !state.weaponDamageFeedback.startsWith('impact-ring+surface-language+shared-camera-kick:')
    || state.weaponShotCount !== fireProbeShotCount
    || state.weaponShotCount <= preFireShotCount
    || !/^carbine:\d+\|breacher:\d+\|rail:\d+$/.test(state.weaponShotCounts)) {
    throw new Error(`P27-B6 Babylon weapon fire/impact VFX parity invalid: ${JSON.stringify({ state, preFireShotCount, fireProbeShotCount, expectedWeaponFireFx })}`);
  }

  const enemyCatalogRoles = new Set(String(state.enemyCatalogRoles).split(',').filter(Boolean));
  const enemyCatalogAssets = new Set(String(state.enemyCatalogAssets).split(',').filter(Boolean));
  const enemyRoles = new Set(String(state.enemyRoles).split(',').filter(Boolean));
  const enemyAssets = String(state.enemyAssets).split(',').filter(Boolean);
  const enemyVariants = String(state.enemyVariants).split(',').filter(Boolean);
  const expectedEnemyRoles = ['assault', 'suppressor', 'technician', 'elite'];
  const expectedEnemyAssets = expectedEnemyRoles.map(role => `enemy-${role}-lod${expectedPlayerLod}`);
  const enemyRuntimeMatch = /^cached:(\d+)\|active:(\d+)\|bytes:(\d+)$/.exec(state.enemyRuntime);
  const enemyCatalogRuntimeMatch = /^cached:(\d+)\|active:(\d+)\|bytes:(\d+)$/.exec(state.enemyCatalogRuntime);
  const enemyTrackingMatch = /^active:(\d+)\|authored:(\d+)\|fallback:(\d+)\|loading:(\d+)$/.exec(state.enemyTracking);
  const enemyBlendPattern = /^move:\d+\.\d+,tell:\d+\.\d+,commit:\d+\.\d+,recovery:\d+\.\d+,hit:\d+\.\d+,stagger:\d+\.\d+,armorBreak:\d+\.\d+$/;
  const enemyAnimationPattern = /^(assault-breach|suppressor-braced|technician-control|elite-hunter):(idle|locomotion|tell|commit|recovery|death)$/;
  if (state.enemyCatalogState !== 'ready'
    || state.enemyCatalogError
    || !expectedEnemyRoles.every(role => enemyCatalogRoles.has(role))
    || enemyCatalogRoles.size !== expectedEnemyRoles.length
    || !expectedEnemyAssets.every(asset => enemyCatalogAssets.has(asset))
    || enemyCatalogAssets.size !== expectedEnemyAssets.length
    || state.enemyCatalogLod !== String(expectedPlayerLod)
    || !enemyCatalogRuntimeMatch
    || Number(enemyCatalogRuntimeMatch[1]) < expectedEnemyAssets.length
    || state.enemyState !== 'ready'
    || state.enemyVisual !== 'authored-babylon'
    || state.enemyFallbackReason
    || state.enemyActive < 1
    || state.enemyAuthoredCount !== state.enemyActive
    || state.enemyFallbackCount !== 0
    || state.enemyLoadingCount !== 0
    || ![...enemyRoles].every(role => expectedEnemyRoles.includes(role))
    || enemyRoles.size < 1
    || !enemyAssets.every(asset => /^enemy-(assault|suppressor|technician|elite)-lod[12]$/.test(asset))
    || enemyAssets.length < 1
    || !enemyVariants.every(value => /:(standard|mobile|braced|technical|drone)$/.test(value))
    || enemyVariants.length < 1
    || !enemyAnimationPattern.test(state.enemyAnimation)
    || !enemyBlendPattern.test(state.enemyAnimationBlend)
    || !/^(assault|suppressor|technician|elite):/.test(state.enemyAnimationTarget)
    || !['standard', 'mobile', 'braced', 'technical', 'drone'].includes(state.enemyVariantSilhouette)
    || state.enemyFacing !== 'telegraph-or-velocity'
    || state.enemySpawnDeath !== 'active-root+spawn-pose+death-rig+deterministic-release'
    || state.enemyReuse !== 'shared-runtime+role-assets+variant-silhouettes+shared-animation-signals'
    || !/^released:\d+$/.test(state.enemyCleanup)
    || !enemyTrackingMatch
    || Number(enemyTrackingMatch[1]) !== state.enemyActive
    || Number(enemyTrackingMatch[2]) !== state.enemyAuthoredCount
    || Number(enemyTrackingMatch[3]) !== state.enemyFallbackCount
    || Number(enemyTrackingMatch[4]) !== state.enemyLoadingCount
    || !enemyRuntimeMatch
    || Number(enemyRuntimeMatch[1]) < 19
    || Number(enemyRuntimeMatch[2]) < state.environmentInstances + 4 + state.enemyAuthoredCount) {
    throw new Error(`P27-B4 Babylon enemy presentation parity invalid: ${JSON.stringify(state)}`);
  }

  const interactableAssets = String(state.interactableAssets).split(',').filter(Boolean);
  const worldRuntimeMatch = /^cached:(\d+)\|active:(\d+)\|bytes:(\d+)$/.exec(state.worldRuntime);
  if (state.worldState !== 'ready'
    || state.worldPresentationMode !== 'scene-meshes-not-hud'
    || state.worldObjectCount < 1
    || state.interactableVisual !== 'authored-babylon'
    || state.interactableFallback
    || state.interactableActive < 1
    || state.interactableAuthoredCount < 1
    || interactableAssets.length < 1
    || !interactableAssets.every(asset => /^interactable-(control-terminal|salvage-tag-node)-lod[12]$/.test(asset))
    || state.interactableReadability !== 'shape-coded+state-emissive+floor-cue:quality-safe'
    || state.objectiveWorldCue !== 'beacon+navigation-path'
    || !state.objectiveTarget
    || state.objectiveTarget === 'complete'
    || state.objectiveGuideCount < 0
    || state.hazardActive < 0
    || state.hazardReadability !== 'shape-coded+floor-bound+quality-safe'
    || state.lootActive < 0
    || !['procedural-ready-babylon', 'authored-babylon', 'procedural-fallback-babylon'].includes(state.lootVisual)
    || state.lootReadability !== 'authored-capsule+rarity-shape+ring+beam'
    || state.breachActive < 0
    || state.breachReadability !== 'pressure-state+floor-ring+boss-priority'
    || state.worldReadability !== 'interactables:shape+state|hazards:shape+motion|loot:shape+rarity'
    || !/^(high|balanced|performance):material-response\+state-emissive\+quality-safe$/.test(state.worldMaterialDepth)
    || !state.biomeState
    || !/^\d+\.\d{2}$/.test(state.biomeStateSeverity)
    || !state.biomeStateAnimation
    || !state.biomeStateAudio
    || state.worldStateVisual !== 'floor-signal+breach-rings'
    || !worldRuntimeMatch
    || Number(worldRuntimeMatch[1]) < 20
    || Number(worldRuntimeMatch[2]) < state.environmentInstances + 4 + state.enemyAuthoredCount + state.interactableAuthoredCount) {
    throw new Error('P27-B5 Babylon refinery world presentation parity invalid: ' + JSON.stringify(state));
  }

  const viewportMatch = /^(\d+)x(\d+)@ratio:([0-9.]+)@buffer:(\d+)x(\d+)$/.exec(state.viewport);
  if (!viewportMatch) throw new Error(`P27-B1 Babylon viewport telemetry invalid: ${state.viewport}`);
  const [, cssWidthRaw, cssHeightRaw, ratioRaw, bufferWidthRaw, bufferHeightRaw] = viewportMatch;
  const cssWidth = Number(cssWidthRaw);
  const cssHeight = Number(cssHeightRaw);
  const ratio = Number(ratioRaw);
  const bufferWidth = Number(bufferWidthRaw);
  const bufferHeight = Number(bufferHeightRaw);
  const expectedLayout = state.rectWidth / Math.max(1, state.rectHeight) < 1.15
    ? 'narrow'
    : pointerProbe.coarse ? 'coarse' : 'standard';
  if (state.layout !== expectedLayout
    || Math.abs(cssWidth - state.rectWidth) > 2
    || Math.abs(cssHeight - state.rectHeight) > 2
    || bufferWidth !== state.bufferWidth
    || bufferHeight !== state.bufferHeight
    || Math.abs(bufferWidth - state.rectWidth * ratio) > 2
    || Math.abs(bufferHeight - state.rectHeight * ratio) > 2) {
    throw new Error(`P27-B1 Babylon camera/resize parity invalid: ${JSON.stringify({ state, expectedLayout, ratio })}`);
  }

  const pbrMatch = /^pbr:(\d+)\|standard:(\d+)\|max-lights:(3|5|6)$/.exec(state.pbrMaterials);
  const lightingBudgetMatch = /^tier:(high|balanced|performance)\|ibl:(1\.00|0\.70|0\.38)\|shadow:(0|512|1024)\|practical:(1|2)\|max-lights:(3|5|6)$/.exec(state.lightingBudget);
  if (state.lightingProfile !== 'furnace-amber'
    || state.materialIntent !== 'authored-gltf-pbr+procedural-world-pbr'
    || !pbrMatch
    || Number(pbrMatch[1]) < 1
    || !lightingBudgetMatch
    || !['high', 'balanced', 'performance'].includes(state.renderTier)
    || !['adaptive', 'flagship', 'performance'].includes(state.graphicsQuality)
    || !/^raw-cube:furnace-amber\+service-cyan:intensity-\d+\.\d{2}$/.test(state.environmentIbl)
    || !state.environmentLighting.startsWith('refinery-key+rim+ibl:raw-cube+practical:')
    || !/^key:(512|1024):pcf-low:casters-\d+$|^key:off$/.test(state.environmentShadowBudget)
    || !/^aces-\d+\.\d{2}\+ibl-\d+\.\d{2}$/.test(state.environmentTone)
    || !/^asteroid-refinery:furnace-amber:aces-\d+\.\d{2}$/.test(state.locationLighting)) {
    throw new Error('P27-B11 Babylon PBR lighting parity invalid: ' + JSON.stringify(state));
  }

  await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    canvas.dataset.refineryIblQa = 'off';
    return true;
  })()`);
  await waitFor(`document.querySelector('canvas')?.dataset.environmentIbl === 'off:qa-baseline'`, 'P27-B11 Babylon IBL stack-off', 5_000);
  await captureScreenshot(p27b11IblOffScreenshotPath);

  await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    canvas.dataset.refineryIblQa = 'on';
    return true;
  })()`);
  await waitFor(`/^raw-cube:furnace-amber\\+service-cyan:intensity-\\d+\\.\\d{2}$/.test(document.querySelector('canvas')?.dataset.environmentIbl ?? '')`, 'P27-B11 Babylon IBL stack-on', 5_000);
  await captureScreenshot(p27b11IblOnScreenshotPath);
  const b11StackOn = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return {
      ibl: canvas?.dataset.environmentIbl ?? '',
      lighting: canvas?.dataset.environmentLighting ?? '',
      shadows: canvas?.dataset.environmentShadowBudget ?? '',
      tone: canvas?.dataset.environmentTone ?? '',
      pbr: canvas?.dataset.babylonPbrMaterials ?? '',
      budget: canvas?.dataset.babylonLightingBudget ?? '',
    };
  })()`);
  if (!b11StackOn?.ibl?.startsWith('raw-cube:furnace-amber+service-cyan:')
    || !b11StackOn?.lighting?.includes('ibl:raw-cube')
    || !b11StackOn?.pbr?.startsWith('pbr:')) {
    throw new Error('P27-B11 Babylon stack-on capture telemetry invalid: ' + JSON.stringify(b11StackOn));
  }

  console.log(`BROWSER_P27B11_BABYLON_PBR_LIGHTING_PASS viewport=${viewportMode} budget=${b11StackOn.budget} ibl=${b11StackOn.ibl} shadows=${b11StackOn.shadows} tone=${b11StackOn.tone} pbr=${b11StackOn.pbr} screenshots=${p27b11IblOffScreenshotPath}+${p27b11IblOnScreenshotPath}`);

  const protectedGroups = 'hud+enemies+hazards+objectives+loot+interactables';
  if (!state.environmentBloom.startsWith('selective:refinery-selective-v1:')
    || !/^babylon-included:\d+\+authored:processor\+terminal\+muzzle$/.test(state.environmentBloomSources)
    || state.environmentBloomExcluded !== protectedGroups
    || !state.environmentContactDepth.startsWith('grounding:refinery-contact-grounding-v1:')
    || state.environmentContactDepthProtected !== protectedGroups
    || !state.environmentAtmosphere.startsWith('fog:refinery-depth-atmosphere-v1:')
    || state.environmentAtmosphereProtected !== protectedGroups
    || !/^aces-exposure-\d+\.\d{2}\+contrast-\d+\.\d{2}$/.test(state.environmentPostTone)
    || !/^tier:(high|balanced|performance)\|bloom:(1\.00|0\.68|0\.42)\|contact:(1\.00|0\.68|0\.42)\|atmosphere:(1\.00|0\.68|0\.42)\|critical:1\.00$/.test(state.babylonPostBudget)
    || state.babylonPostStack !== 'on:qa-explicit'
    || state.effectPriority !== 'critical:hazards+telegraphs+class-cues@1.00|secondary:bloom+contact-depth+atmosphere@'
      + (state.renderTier === 'high' ? '1.00' : state.renderTier === 'balanced' ? '0.68' : '0.42')) {
    throw new Error('P27-B12 Babylon post-processing parity invalid: ' + JSON.stringify(state));
  }

  await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    canvas.dataset.refineryPostStackQa = 'off';
    return true;
  })()`);
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.dataset.environmentBloom === 'off:qa-baseline'
      && canvas?.dataset.environmentContactDepth === 'off:qa-baseline'
      && canvas?.dataset.environmentAtmosphere === 'off:qa-baseline'
      && canvas?.dataset.babylonPostStack === 'off:qa-baseline';
  })()`, 'P27-B12 Babylon stack-off', 5_000);
  await sleep(120);
  const b12StackOffPng = await captureScreenshot(p27b12StackOffScreenshotPath);

  await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    canvas.dataset.refineryPostStackQa = 'on';
    return true;
  })()`);
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.dataset.environmentBloom?.startsWith('selective:refinery-selective-v1:')
      && canvas?.dataset.environmentContactDepth?.startsWith('grounding:refinery-contact-grounding-v1:')
      && canvas?.dataset.environmentAtmosphere?.startsWith('fog:refinery-depth-atmosphere-v1:')
      && canvas?.dataset.babylonPostStack === 'on:qa-explicit';
  })()`, 'P27-B12 Babylon stack-on', 5_000);
  await sleep(120);
  const b12StackOnPng = await captureScreenshot(p27b12StackOnScreenshotPath);
  const b12PngDelta = pngByteDifferenceRatio(b12StackOffPng, b12StackOnPng);
  if (!(b12PngDelta > 0.01)) {
    throw new Error('P27-B12 stack-off/on captures were not measurably different: delta=' + b12PngDelta.toFixed(4));
  }
  const b12StackOn = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return {
      bloom: canvas?.dataset.environmentBloom ?? '',
      contact: canvas?.dataset.environmentContactDepth ?? '',
      atmosphere: canvas?.dataset.environmentAtmosphere ?? '',
      tone: canvas?.dataset.environmentPostTone ?? '',
      budget: canvas?.dataset.babylonPostBudget ?? '',
      priority: canvas?.dataset.effectPriority ?? '',
    };
  })()`);
  console.log(`BROWSER_P27B12_BABYLON_POST_PROCESSING_PASS viewport=${viewportMode} tier=${state.renderTier} bloom=${b12StackOn.bloom} contact=${b12StackOn.contact} atmosphere=${b12StackOn.atmosphere} tone=${b12StackOn.tone} budget=${b12StackOn.budget} priority=${b12StackOn.priority} pngDelta=${b12PngDelta.toFixed(4)} screenshots=${p27b12StackOffScreenshotPath}+${p27b12StackOnScreenshotPath}`);
  console.log(`BROWSER_P27A2_BABYLON_PASS viewport=${viewportMode} backend=${state.backend} scene=${state.scene} frames=${state.frames} fallback=none`);
  console.log(`BROWSER_P27B1_BABYLON_CAMERA_INPUT_PASS viewport=${viewportMode} camera=${state.camera} input=${state.input} layout=${state.layout} framing=${state.framing} viewport=${state.viewport} pointer=${state.pointer} initialRetargetDelta=${initialRetargetDelta.toFixed(4)} settledDelta=${settledDirectionDelta.toFixed(4)} feedback=${state.feedback}`);
  console.log(`BROWSER_P27B2_BABYLON_REFINERY_PASS viewport=${viewportMode} lod=${state.environmentLod} kit=${[...refineryKit].sort().join(',')} placements=${state.environmentInstances} terminals=${state.environmentTerminals} runtime=${state.environmentRuntime} scene=${state.sceneTelemetry} reuse=${state.environmentReuse}`);
  console.log(`BROWSER_P27B3_BABYLON_OPERATOR_WEAPON_PASS viewport=${viewportMode} class=${state.operatorClass} operator=${state.operatorAsset} stance=${state.operatorStance} animation=${state.operatorAnimation} weapon=${state.weaponActive} asset=${state.weaponAsset} variant=${state.weaponVariant} thermal=${state.weaponThermalCue} muzzle=${state.weaponMuzzle} runtime=${state.playerRuntime}`);
  console.log(`BROWSER_P27B6_BABYLON_WEAPON_VFX_PASS viewport=${viewportMode} weapon=${state.weaponActive} variant=${state.weaponVariant} fire=${state.weaponFireFx} shots=${state.weaponShotCount} projectiles=${state.weaponProjectileCount}/${state.weaponProjectileFamilies} impact=${state.weaponImpactFx}:${state.weaponImpactSerial} effects=${state.weaponEffectsMode} feedback=${state.weaponDamageFeedback}`);
  console.log(`BROWSER_P27B4_BABYLON_ENEMY_PASS viewport=${viewportMode} catalog=${state.enemyCatalogAssets} active=${state.enemyActive} roles=${state.enemyRoles} variants=${state.enemyVariants} visual=${state.enemyVisual} animation=${state.enemyAnimation} target=${state.enemyAnimationTarget} tracking=${state.enemyTracking} runtime=${state.enemyRuntime}`);
  console.log(`BROWSER_P27B5_BABYLON_WORLD_PASS viewport=${viewportMode} objects=${state.worldObjectCount} interactables=${state.interactableActive}/${state.interactableAuthoredCount} assets=${state.interactableAssets} objective=${state.objectiveTarget} guide=${state.objectiveGuideCount} hazards=${state.hazardActive} loot=${state.lootActive} breaches=${state.breachActive} biome=${state.biomeState} runtime=${state.worldRuntime}`);
  return state;
}

async function p21F1WebGpuPrototypeAudit() {
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.dataset.graphicsPathSelection === 'qa-explicit'
      && canvas?.dataset.graphicsPathRequested === 'webgpu'
      && ['webgpu', 'webgl2'].includes(canvas?.dataset.graphicsPathLoaded ?? '');
  })()`, 'P21-F1 WebGPU/refinery backend selection', 45_000);

  let state = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return {
      loaded: canvas?.dataset.graphicsPathLoaded ?? '',
      fallback: canvas?.dataset.graphicsPathFallback ?? '',
      fallbackReason: canvas?.dataset.webgpuFallbackReason ?? '',
      init: canvas?.dataset.webgpuInit ?? '',
      backend: canvas?.dataset.webgpuBackend ?? '',
      visual: canvas?.dataset.environmentVisual ?? '',
      assets: canvas?.dataset.webgpuAssets ?? '',
      assetPipeline: canvas?.dataset.webgpuAssetPipeline ?? '',
      tsl: canvas?.dataset.webgpuTsl ?? '',
      camera: canvas?.dataset.webgpuCameraParity ?? '',
      input: canvas?.dataset.webgpuInputParity ?? '',
      pointer: canvas?.dataset.webgpuPointerDirection ?? '',
    };
  })()`);

  if (state?.loaded === 'webgpu') {
    await waitFor(`(() => {
      const canvas = document.querySelector('canvas');
      return canvas?.dataset.webgpuInit === 'ready'
        && canvas?.dataset.environmentVisual === 'authored-refinery-webgpu-p21f2'
        && canvas?.dataset.webgpuAssets === 'floor,processor,terminal'
        && canvas?.dataset.webgpuAssetPipeline === 'glb+ktx2+meshopt'
        && canvas?.dataset.webgpuTsl === 'mesh-standard-node-color+render-pipeline+mrt-emissive'
        && canvas?.dataset.webgpuCameraParity === 'three-combat-v1'
        && canvas?.dataset.webgpuInputParity === 'ground-plane-raycast-v1';
    })()`, 'P21-F1 WebGPU TSL + authored refinery prototype', 45_000);

    const pointerProbe = await evaluate(`(() => {
      const canvas = document.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return null;
      const rect = canvas.getBoundingClientRect();
      const coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
      return {
        coarse,
        x: rect.left + rect.width * 0.68,
        y: rect.top + rect.height * 0.48,
      };
    })()`);
    if (!pointerProbe) throw new Error('P21-F1 could not locate the canvas for the parity pointer probe.');
    if (pointerProbe.coarse) {
      await call('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: pointerProbe.x, y: pointerProbe.y, id: 921, radiusX: 1, radiusY: 1, force: 1 }],
      });
      try {
        await waitFor(`/^[-0-9.]+,[-0-9.]+$/.test(document.querySelector('canvas')?.dataset.webgpuPointerDirection ?? '')`, 'P21-F1 pointer-direction parity probe', 5_000);
      } finally {
        await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => undefined);
      }
    } else {
      const dispatched = await evaluate(`(() => {
        const canvas = document.querySelector('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 921,
          pointerType: 'mouse',
          clientX: rect.left + rect.width * 0.68,
          clientY: rect.top + rect.height * 0.48,
          button: 0,
        }));
        return true;
      })()`);
      if (!dispatched) throw new Error('P21-F1 could not dispatch the parity pointer probe.');
      await waitFor(`/^[-0-9.]+,[-0-9.]+$/.test(document.querySelector('canvas')?.dataset.webgpuPointerDirection ?? '')`, 'P21-F1 pointer-direction parity probe', 5_000);
    }
  } else {
    await waitFor(`document.querySelector('canvas')?.dataset.environmentVisual === 'authored-refinery'`, 'P21-F1 WebGL2 fallback refinery', 45_000);
  }

  state = await evaluate(`(() => {
    const canvas = document.querySelector('canvas');
    return {
      loaded: canvas?.dataset.graphicsPathLoaded ?? '',
      fallback: canvas?.dataset.graphicsPathFallback ?? '',
      fallbackReason: canvas?.dataset.webgpuFallbackReason ?? '',
      init: canvas?.dataset.webgpuInit ?? '',
      backend: canvas?.dataset.webgpuBackend ?? '',
      visual: canvas?.dataset.environmentVisual ?? '',
      assets: canvas?.dataset.webgpuAssets ?? '',
      assetPipeline: canvas?.dataset.webgpuAssetPipeline ?? '',
      tsl: canvas?.dataset.webgpuTsl ?? '',
      camera: canvas?.dataset.webgpuCameraParity ?? '',
      input: canvas?.dataset.webgpuInputParity ?? '',
      pointer: canvas?.dataset.webgpuPointerDirection ?? '',
    };
  })()`);

  if (requireWebGpuComparison && state?.loaded !== 'webgpu') {
    throw new Error(`P21-F2 requires a real WebGPU desktop comparison; loaded=${state?.loaded || 'unknown'} fallback=${state?.fallback || 'none'} reason=${state?.fallbackReason || 'none'}`);
  }

  if (state?.loaded === 'webgpu') {
    if (state.init !== 'ready'
      || state.backend !== 'webgpu'
      || state.visual !== 'authored-refinery-webgpu-p21f2'
      || state.assets !== 'floor,processor,terminal'
      || state.assetPipeline !== 'glb+ktx2+meshopt'
      || state.tsl !== 'mesh-standard-node-color+render-pipeline+mrt-emissive'
      || state.camera !== 'three-combat-v1'
      || state.input !== 'ground-plane-raycast-v1'
      || !/^[-0-9.]+,[-0-9.]+$/.test(state.pointer)) {
      throw new Error(`P21-F1 WebGPU prototype telemetry incomplete: ${JSON.stringify(state)}`);
    }
  } else if (state?.loaded === 'webgl2') {
    if (!state.fallback.startsWith('webgpu->webgl2:') || state.visual !== 'authored-refinery') {
      throw new Error(`P21-F1 WebGL2 fallback telemetry incomplete: ${JSON.stringify(state)}`);
    }
  } else {
    throw new Error(`P21-F1 loaded an unexpected graphics path: ${JSON.stringify(state)}`);
  }

  console.log(`BROWSER_P21F1_WEBGPU_PASS viewport=${viewportMode} requested=webgpu loaded=${state.loaded} fallback=${state.fallback || 'none'} reason=${state.fallbackReason || 'none'} init=${state.init || 'not-started'} visual=${state.visual} assets=${state.assets || 'production-webgl2'} tsl=${state.tsl || 'fallback'} camera=${state.camera || 'production-webgl2'} input=${state.input || 'production-webgl2'} pointer=${state.pointer || 'production-webgl2'}`);
  return state;
}

async function p21F2RefineryParityAudit(backend) {
  const visual = backend === 'webgpu' ? 'authored-refinery-webgpu-p21f2' : 'authored-refinery';
  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === ${JSON.stringify(visual)});
    return Boolean(canvas?.dataset.environmentP21Budget
      && canvas?.dataset.environmentIbl
      && canvas?.dataset.environmentBloom
      && canvas?.dataset.environmentContactDepth
      && canvas?.dataset.environmentAtmosphere);
  })()`, `P21-F2 ${backend} refinery effect stack`, 45_000);

  const baseline = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === ${JSON.stringify(visual)});
    return {
      loaded: canvas?.dataset.graphicsPathLoaded ?? '',
      budget: canvas?.dataset.environmentP21Budget ?? '',
      ibl: canvas?.dataset.environmentIbl ?? '',
      bloom: canvas?.dataset.environmentBloom ?? '',
      bloomSources: canvas?.dataset.environmentBloomSources ?? '',
      bloomExcluded: canvas?.dataset.environmentBloomExcluded ?? '',
      contact: canvas?.dataset.environmentContactDepth ?? '',
      contactProtected: canvas?.dataset.environmentContactDepthProtected ?? '',
      atmosphere: canvas?.dataset.environmentAtmosphere ?? '',
      atmosphereProtected: canvas?.dataset.environmentAtmosphereProtected ?? '',
      effectParity: canvas?.dataset.webgpuEffectParity ?? '',
      parityGaps: canvas?.dataset.webgpuParityGaps ?? '',
    };
  })()`);
  const parsedBudget = parseP21EffectBudget(baseline?.budget);
  const expected = parsedBudget ? P21_EFFECT_BUDGETS[parsedBudget.tier] : null;
  if (!parsedBudget || !expected
    || Math.abs(parsedBudget.ibl - expected.ibl) > 0.001
    || Math.abs(parsedBudget.bloom - expected.bloom) > 0.001
    || Math.abs(parsedBudget.contact - expected.contact) > 0.001
    || Math.abs(parsedBudget.atmosphere - expected.atmosphere) > 0.001
    || parsedBudget.critical !== 1
    || !baseline?.bloom.startsWith('selective:refinery-selective-v1:')
    || !baseline?.contact.startsWith('grounding:refinery-contact-grounding-v1:')
    || !baseline?.atmosphere.startsWith('fog:refinery-depth-atmosphere-v1:')
    || baseline?.bloomExcluded !== 'hud+enemies+hazards+objectives+loot+interactables'
    || baseline?.contactProtected !== 'hud+enemies+hazards+objectives+loot+interactables'
    || baseline?.atmosphereProtected !== 'hud+enemies+hazards+objectives+loot+interactables') {
    throw new Error(`P21-F2 ${backend} parity telemetry incomplete: ${JSON.stringify({ baseline, parsedBudget })}`);
  }
  if (backend === 'webgpu') {
    if (baseline.loaded !== 'webgpu'
      || !baseline.ibl.startsWith('proxy:furnace-amber+service-cyan:intensity-')
      || baseline.effectParity !== 'ibl-proxy+selective-bloom+contact-depth+atmosphere+adaptive-budget'
      || !baseline.parityGaps.includes('ibl-pmrem-generator-webgl-only:bounded-light-proxy')
      || !baseline.parityGaps.includes('combat-vfx-full-scene:not-in-f1-prototype')) {
      throw new Error(`P21-F2 WebGPU parity gaps/effect contract incomplete: ${JSON.stringify(baseline)}`);
    }
  } else if (!baseline.ibl.startsWith('pmrem:furnace-amber+service-cyan:intensity-')) {
    throw new Error(`P21-F2 WebGL2 comparison did not expose the proven PMREM path: ${JSON.stringify(baseline)}`);
  }

  const disabled = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === ${JSON.stringify(visual)});
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    canvas.dataset.refineryIblQa = 'off';
    canvas.dataset.refineryBloomQa = 'off';
    canvas.dataset.refineryContactDepthQa = 'off';
    canvas.dataset.refineryAtmosphereQa = 'off';
    canvas.dataset.refineryBloomCost = '1';
    return true;
  })()`);
  if (!disabled) throw new Error(`P21-F2 could not disable the ${backend} refinery stack.`);
  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === ${JSON.stringify(visual)});
    return canvas?.dataset.environmentIbl === 'off:qa-baseline'
      && canvas?.dataset.environmentBloom === 'off:qa-baseline'
      && canvas?.dataset.environmentContactDepth === 'off:qa-baseline'
      && canvas?.dataset.environmentAtmosphere === 'off:qa-baseline';
  })()`, `P21-F2 ${backend} stack-off baseline`, 10_000);
  let webGpuCaptureOff = null;
  if (backend === 'webgpu') {
    webGpuCaptureOff = await captureWebGpuRendererFrame('stack-off', p21f2StackOffScreenshotPath);
  } else {
    await sleep(120);
    await captureScreenshot(p21f2StackOffScreenshotPath);
  }

  const restored = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === ${JSON.stringify(visual)});
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    canvas.dataset.refineryIblQa = 'on';
    canvas.dataset.refineryBloomQa = 'on';
    canvas.dataset.refineryContactDepthQa = 'on';
    canvas.dataset.refineryAtmosphereQa = 'on';
    canvas.dataset.refineryBloomCost = '1';
    return true;
  })()`);
  if (!restored) throw new Error(`P21-F2 could not restore the ${backend} refinery stack.`);
  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === ${JSON.stringify(visual)});
    return canvas?.dataset.environmentIbl !== 'off:qa-baseline'
      && canvas?.dataset.environmentBloom?.startsWith('selective:refinery-selective-v1:')
      && canvas?.dataset.environmentContactDepth?.startsWith('grounding:refinery-contact-grounding-v1:')
      && canvas?.dataset.environmentAtmosphere?.startsWith('fog:refinery-depth-atmosphere-v1:');
  })()`, `P21-F2 ${backend} stack-on comparison`, 10_000);
  let webGpuCaptureOn = null;
  if (backend === 'webgpu') {
    webGpuCaptureOn = await captureWebGpuRendererFrame('stack-on', p21f2StackOnScreenshotPath);
  } else {
    await sleep(120);
    await captureScreenshot(p21f2StackOnScreenshotPath);
  }
  if (webGpuCaptureOff && webGpuCaptureOn) {
    if (webGpuCaptureOff.hash === webGpuCaptureOn.hash) {
      throw new Error(`P21-F2 WebGPU stack-off/stack-on captures are pixel-identical: ${JSON.stringify({ off: webGpuCaptureOff, on: webGpuCaptureOn })}`);
    }
    console.log(`BROWSER_P21F2_WEBGPU_CAPTURE_PASS viewport=${viewportMode} offMean=${webGpuCaptureOff.meanRgb.toFixed(2)} onMean=${webGpuCaptureOn.meanRgb.toFixed(2)} offLit=${webGpuCaptureOff.litRatio.toFixed(3)} onLit=${webGpuCaptureOn.litRatio.toFixed(3)} offNonBlack=${webGpuCaptureOff.nonBlackRatio.toFixed(3)} onNonBlack=${webGpuCaptureOn.nonBlackRatio.toFixed(3)} offPeak=${webGpuCaptureOff.maxChannel} onPeak=${webGpuCaptureOn.maxChannel} offHash=${webGpuCaptureOff.hash} onHash=${webGpuCaptureOn.hash} size=${webGpuCaptureOn.width}x${webGpuCaptureOn.height}`);
  }

  const costReduced = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === ${JSON.stringify(visual)});
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    canvas.dataset.refineryBloomCost = '0.45';
    return true;
  })()`);
  if (!costReduced) throw new Error(`P21-F2 could not reduce ${backend} bloom cost.`);
  await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === ${JSON.stringify(visual)} && canvas.dataset.environmentBloom?.includes(':cost-0.45:'))`, `P21-F2 ${backend} bloom cost control`);
  await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === ${JSON.stringify(visual)});
    if (canvas instanceof HTMLCanvasElement) canvas.dataset.refineryBloomCost = '1';
    return true;
  })()`);
  await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === ${JSON.stringify(visual)} && canvas.dataset.environmentBloom?.includes(':cost-1.00:'))`, `P21-F2 ${backend} bloom cost restore`);

  console.log(`BROWSER_P21F2_REFINERY_PARITY_PASS viewport=${viewportMode} backend=${backend} budget=${baseline.budget} ibl=${baseline.ibl} bloom=${baseline.bloom} contact=${baseline.contact} atmosphere=${baseline.atmosphere} gaps=${baseline.parityGaps || 'none'} screenshots=${p21f2StackOffScreenshotPath}+${p21f2StackOnScreenshotPath}`);
  return baseline;
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

  if (skipSyntheticControllerAudit) {
    console.log('BROWSER_P19_COMMAND_INPUT_PASS keyboard=arrows+space+escape controller=skipped-headed-webgpu-ci routing=shared');
    return;
  }

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
  const p22b2 = await evaluate(`(() => {
    const root = document.querySelector('.game-root');
    const viewport = { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
    const rootFont = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const compactLandscape = viewport.width > viewport.height && viewport.height <= 560;
    const width = selector => {
      const element = document.querySelector(selector);
      return element instanceof HTMLElement ? Number.parseFloat(getComputedStyle(element).width) : null;
    };
    const baseline = {
      vitals: Math.min((compactLandscape ? 15.625 : 16.875) * rootFont, viewport.width * (compactLandscape ? 0.29 : 0.30)),
      mission: Math.min((compactLandscape ? 20.625 : 22.5) * rootFont, viewport.width * (compactLandscape ? 0.34 : 0.36)),
      classMechanic: Math.min(14.375 * rootFont, viewport.width * 0.28),
    };
    const actual = { vitals: width('.vitals'), mission: width('.mission-card'), classMechanic: width('.class-mechanic-hud') };
    return {
      scale: Number.parseFloat(getComputedStyle(root).getPropertyValue('--iv-combat-hud-visual-scale')),
      ratios: Object.fromEntries(Object.entries(actual).map(([key, value]) => [key, value == null ? null : value / baseline[key]])),
    };
  })()`);
  const p22b2CoreRatios = [p22b2.ratios.vitals, p22b2.ratios.mission];
  const p22b2OptionalClassInvalid = p22b2.ratios.classMechanic != null && Math.abs(p22b2.ratios.classMechanic - 0.7) > 0.025;
  if (Math.abs(p22b2.scale - 0.7) > 0.001
    || p22b2CoreRatios.some(value => value == null || Math.abs(value - 0.7) > 0.025)
    || p22b2OptionalClassInvalid) {
    throw new Error(`P22-B2 mobile HUD did not resolve to the 70% informational baseline: ${JSON.stringify(p22b2)}`);
  }
  console.log(`BROWSER_P22B2_HUD_FOOTPRINT_PASS viewport=${viewportMode} scale=${p22b2.scale.toFixed(2)} vitals=${p22b2.ratios.vitals.toFixed(3)} objective=${p22b2.ratios.mission.toFixed(3)} class=${p22b2.ratios.classMechanic == null ? 'not-mounted' : p22b2.ratios.classMechanic.toFixed(3)}`);
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
    const p22b2Target = await evaluate(`(() => {
      const readout = document.querySelector('.target-readout[data-target-id]');
      const root = document.querySelector('.game-root');
      if (!(readout instanceof HTMLElement) || !(root instanceof HTMLElement)) return null;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const rootFont = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const baseline = Math.min(17.8125 * rootFont, viewportWidth * 0.30);
      const actual = Number.parseFloat(getComputedStyle(readout).width);
      const type = [...readout.querySelectorAll('small,b,span')].map(element => Number.parseFloat(getComputedStyle(element).fontSize)).filter(Number.isFinite);
      return {
        scale: Number.parseFloat(getComputedStyle(root).getPropertyValue('--iv-combat-hud-visual-scale')),
        ratio: actual / baseline,
        minFont: type.length ? Math.min(...type) : null,
      };
    })()`);
    if (!p22b2Target || Math.abs(p22b2Target.scale - 0.7) > 0.001 || Math.abs(p22b2Target.ratio - 0.7) > 0.025 || (p22b2Target.minFont != null && p22b2Target.minFont < 11.5)) {
      throw new Error(`P22-B2 target HUD lost footprint/readability contract: ${JSON.stringify(p22b2Target)}`);
    }
    console.log(`BROWSER_P22B2_TARGET_FLOW_PASS viewport=${viewportMode} scale=${p22b2Target.scale.toFixed(2)} ratio=${p22b2Target.ratio.toFixed(3)} typeFloor=${p22b2Target.minFont?.toFixed(1) ?? 'n/a'}px`);
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
      const announcement = document.querySelector('#target-lock-status')?.textContent?.toLowerCase() ?? '';
      return canvas?.dataset.assistedTargetId === ''
        && !document.querySelector('.target-readout[data-target-id]')
        && announcement.includes('manual controller aim');
    })()`, 'controller manual-aim target release + announcement', 5_000);

    const manualOverride = await evaluate(`document.querySelector('#target-lock-status')?.textContent ?? ''`);
    if (!manualOverride.toLowerCase().includes('manual controller aim')) {
      throw new Error(`Controller manual override was not announced after target release: ${JSON.stringify(manualOverride)}`);
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
      inspectorWidth: inspectorRect.width,
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

  if (p22cPrimaryJourney) {
    const compactLandscape = opened.width > opened.height && opened.height <= 500;
    const overlayTypography = await evaluate(`(() => {
      const root = document.querySelector('.armory-item-modal .item-inspector.open');
      if (!(root instanceof HTMLElement)) return null;
      const visible = element => {
        if (element.closest('[aria-hidden="true"]')) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
      };
      const ownText = element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent || '').join(' ').replace(/\\s+/g, ' ').trim();
      const copy = [...root.querySelectorAll('small,p,span,b,strong,h2,h3,button,summary')].filter(visible).map(element => ({
        text: ownText(element).slice(0, 64),
        size: Number.parseFloat(getComputedStyle(element).fontSize),
      })).filter(item => item.text && Number.isFinite(item.size));
      return { minFont: copy.length ? Math.min(...copy.map(item => item.size)) : 0, tinyText: copy.filter(item => item.size < 11.5).slice(0, 16) };
    })()`);
    if (!overlayTypography || (compactLandscape && overlayTypography.tinyText.length)) {
      throw new Error(`P22-C Armory overlay readability audit failed: ${JSON.stringify({ opened, overlayTypography })}`);
    }
    const legacyDialogWidth = opened.height <= 650
      ? Math.min(960, Math.max(0, opened.width - 16))
      : Math.min(880, Math.max(0, opened.width - 28));
    const dialogRatio = legacyDialogWidth > 0 ? opened.inspectorWidth / legacyDialogWidth : 0;
    if (dialogRatio < 0.65 || dialogRatio > 0.82) {
      throw new Error(`P22-C Armory dialog did not resolve to the reduced footprint: ${JSON.stringify({ opened, legacyDialogWidth, dialogRatio })}`);
    }
    p22cEvidence.overlay = {
      viewport: { width: opened.width, height: opened.height },
      minFont: overlayTypography.minFont,
      dialogRatio,
      inspector: { width: opened.inspectorWidth, withinViewport: opened.windowWithinViewport, centered: opened.windowCentered, actionsOnscreen: opened.actionsOnscreen },
      screenshot: p22cDialogScreenshotPath,
    };
    await captureScreenshot(p22cDialogScreenshotPath);
    console.log(`BROWSER_P22C_OVERLAY_BOUNDS_PASS viewport=${viewportMode} minFont=${overlayTypography.minFont.toFixed(1)}px ratio=${dialogRatio.toFixed(3)} dialog=onscreen+centered actions=onscreen`);
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

await call('Page.navigate', { url: navigationUrl });
await sleep(250);

try {
  await waitFor(`document.readyState === 'complete' && document.title === 'Ironshade Vector'`, 'Ironshade document');
  await waitFor(`(() => {
    const text = (document.body?.innerText ?? '').toLowerCase();
    const labels = [...document.querySelectorAll('button')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
    return text.includes('save recovery lock')
      || document.querySelector('.class-intake') !== null
      || ((text.includes('command ready') || text.includes('command deck')) && labels.includes('operations'));
  })()`, 'interactive startup surface');

  if (webGpuSwiftShaderCi && requestedGraphicsPath !== 'webgpu') {
    const staleScopeDrops = pageExceptions.filter(message => message === 'OperationError: Instance dropped in popErrorScope');
    if (staleScopeDrops.length > 0) {
      const retained = pageExceptions.filter(message => message !== 'OperationError: Instance dropped in popErrorScope');
      pageExceptions.splice(0, pageExceptions.length, ...retained);
      console.log(`BROWSER_P21F2_WEBGPU_KNOWN_CI_GAP viewport=${viewportMode} runner=swiftshader issue=pop-error-scope-instance-drop phase=prior-page-disposal count=${staleScopeDrops.length}`);
    }
  }

  const firstSurface = await snapshot();
  const firstSurfaceIsClassIntake = await evaluate(`document.querySelector('.class-intake') !== null`);
  if (firstSurfaceIsClassIntake) {
    await accessibilityAudit('class-selection');
    const classLayout = await classSelectionViewportAudit();
    if (p22cPrimaryJourney) {
      const p22cClass = await evaluate(`(() => {
        const root = document.querySelector('.class-intake');
        if (!(root instanceof HTMLElement)) return null;
        const viewport = { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
        const visible = element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
        };
        const ownText = element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent || '').join(' ').replace(/\\s+/g, ' ').trim();
        const copy = [...root.querySelectorAll('small,p,span,b,strong,h1,h2,h3,summary')].filter(visible).map(element => ({
          text: ownText(element).slice(0, 64),
          size: Number.parseFloat(getComputedStyle(element).fontSize),
        })).filter(item => item.text && Number.isFinite(item.size));
        const rootRect = root.getBoundingClientRect();
        return {
          viewport,
          compactLandscape: viewport.width > viewport.height && viewport.height <= 500,
          minFont: copy.length ? Math.min(...copy.map(item => item.size)) : 0,
          tinyText: copy.filter(item => item.size < 11.5).slice(0, 16),
          horizontalOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
          bounds: { left: rootRect.left, top: rootRect.top, right: rootRect.right, bottom: rootRect.bottom },
        };
      })()`);
      if (!p22cClass
        || p22cClass.horizontalOverflow > 2
        || (p22cClass.compactLandscape && p22cClass.tinyText.length)) {
        throw new Error(`P22-C class intake readability/bounds audit failed: ${JSON.stringify(p22cClass)}`);
      }
      p22cEvidence.classSelection = { ...p22cClass, confirmOnscreen: classLayout.confirmOnscreen };
      console.log(`BROWSER_P22C_CLASS_AUDIT_PASS viewport=${viewportMode} minFont=${p22cClass.minFont.toFixed(1)}px compactFloor=${p22cClass.compactLandscape ? '11.5px' : 'wide'} overflow=none confirm=onscreen`);
    }
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
      const bridge = document.querySelector('.command-visual.command-bridge.command-bridge-compact');
      const workspace = document.querySelector('.tactical-workspace');
      const navButton = document.querySelector('.command-rail-nav button[data-primary-area]');
      const style = card ? getComputedStyle(card) : null;
      const workspaceStyle = workspace ? getComputedStyle(workspace) : null;
      const rect = card?.getBoundingClientRect();
      return {
        size,
        paddingLeft: Number.parseFloat(style?.paddingLeft ?? '0'),
        height: Number((rect?.height ?? 0).toFixed(3)),
        bridgeHeight: Number((bridge?.getBoundingClientRect().height ?? 0).toFixed(3)),
        workspacePaddingTop: Number.parseFloat(workspaceStyle?.paddingTop ?? '0'),
        navHeight: Number((navButton?.getBoundingClientRect().height ?? 0).toFixed(3)),
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
  if (!(p20CommandScale.compact.paddingLeft <= p20CommandScale.baseline.paddingLeft * 0.8
    && p20CommandScale.baseline.paddingLeft < p20CommandScale.large.paddingLeft)
    || !(p20CommandScale.compact.bridgeHeight <= p20CommandScale.baseline.bridgeHeight * 0.82)
    || !(p20CommandScale.compact.workspacePaddingTop <= p20CommandScale.baseline.workspacePaddingTop * 0.8)
    || p20CommandScale.compact.navHeight < 44
    || p20CommandScale.compact.horizontalOverflow > 2
    || p20CommandScale.baseline.horizontalOverflow > 2
    || p20CommandScale.large.horizontalOverflow > 2) {
    throw new Error(`P20-A Command surface did not produce a materially smaller Compact layout: ${JSON.stringify(p20CommandScale)}`);
  }
  console.log(`BROWSER_P20_COMMAND_SCALE_PASS viewport=${viewportMode} padding=${p20CommandScale.compact.paddingLeft}/${p20CommandScale.baseline.paddingLeft}/${p20CommandScale.large.paddingLeft} bridge=${p20CommandScale.compact.bridgeHeight}/${p20CommandScale.baseline.bridgeHeight} nav=${p20CommandScale.compact.navHeight}px overflow=none`);
  if (p22cPrimaryJourney) {
    const p22cMeasureManagement = async () => evaluate(`(() => {
      const card = document.querySelector('.command-card.primary-card');
      const workspace = document.querySelector('.tactical-workspace');
      const bridge = document.querySelector('.command-visual.command-bridge.command-bridge-compact');
      if (!(card instanceof HTMLElement) || !(workspace instanceof HTMLElement) || !(bridge instanceof HTMLElement)) return null;
      const cardStyle = getComputedStyle(card);
      const cardRect = card.getBoundingClientRect();
      const bridgeRect = bridge.getBoundingClientRect();
      return {
        rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        cardPadding: Number.parseFloat(cardStyle.paddingLeft),
        card: { width: cardRect.width, height: cardRect.height },
        bridge: { width: bridgeRect.width, height: bridgeRect.height },
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      };
    })()`);
    const after = await p22cMeasureManagement();
    await captureScreenshot(p22cAfterScreenshotPath);
    await evaluate(`(() => {
      const root = document.documentElement;
      globalThis.__p22cInlineFontSize = root.style.fontSize;
      globalThis.__p22cInlineInterfaceScale = root.style.getPropertyValue('--iv-interface-scale');
      root.style.fontSize = '100%';
      root.style.setProperty('--iv-interface-scale', '1');
      return true;
    })()`);
    await sleep(100);
    const before = await p22cMeasureManagement();
    await captureScreenshot(p22cBeforeScreenshotPath);
    await evaluate(`(() => {
      const root = document.documentElement;
      root.style.fontSize = globalThis.__p22cInlineFontSize || '';
      const previousScale = globalThis.__p22cInlineInterfaceScale || '';
      if (previousScale) root.style.setProperty('--iv-interface-scale', previousScale);
      else root.style.removeProperty('--iv-interface-scale');
      delete globalThis.__p22cInlineFontSize;
      delete globalThis.__p22cInlineInterfaceScale;
      return true;
    })()`);
    await sleep(100);
    const restored = await p22cMeasureManagement();
    const ratio = after && before && before.cardPadding > 0 ? after.cardPadding / before.cardPadding : 0;
    if (!after || !before || !restored || Math.abs(ratio - 0.7) > 0.035 || after.horizontalOverflow > 2 || restored.horizontalOverflow > 2 || Math.abs(restored.cardPadding - after.cardPadding) > 0.1) {
      throw new Error(`P22-C management before/after footprint audit failed: ${JSON.stringify({ before, after, restored, ratio })}`);
    }
    p22cEvidence.management = { before, after, restored, ratio };
    console.log(`BROWSER_P22C_MANAGEMENT_FOOTPRINT_PASS viewport=${viewportMode} rootFont=${after.rootFont}/${before.rootFont}px cardPaddingRatio=${ratio.toFixed(3)} overflow=none screenshots=before+after`);
  }
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
    if (!(p20BuildScale.compact[metric] <= p20BuildScale.default[metric] * 0.8
      && p20BuildScale.large[metric] >= p20BuildScale.default[metric] * 1.15)) {
      throw new Error(`P20-A rendered ${metric} geometry is not materially separated around Default: ${JSON.stringify(p20BuildScale)}`);
    }
  }
  if (p20BuildScale.compact.horizontalOverflow > 2 || p20BuildScale.default.horizontalOverflow > 2 || p20BuildScale.large.horizontalOverflow > 2) {
    throw new Error(`P20-A Build surface overflow across Interface Size: ${JSON.stringify(p20BuildScale)}`);
  }
  console.log(`BROWSER_P20_BUILD_SCALE_PASS viewport=${viewportMode} loadout+crafting+progression+skills+settings+tabs=ordered overflow=none`);

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
  if (!p20dSeeded) throw new Error('P20-D could not seed a six-point Vanguard recommendation profile.');
  await waitFor(`performance.timeOrigin !== ${JSON.stringify(p20dPreviousTimeOrigin)}`, 'P20-D browser document reload');
  await waitFor(`(() => {
    const operatorButton = [...document.querySelectorAll('button[data-primary-area]')].find(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase() === 'operator');
    return document.readyState === 'complete' && operatorButton instanceof HTMLButtonElement && !operatorButton.disabled;
  })()`, 'P20-D seeded Command Deck after reload');
  await keyboardActivateButton('Operator');
  await waitFor(`[...document.querySelectorAll('.operator-section-tabs button')].some(button => (button.textContent || '').trim() === 'Build')`, 'P20-D Operator build route');
  await keyboardActivateButton('Build');
  await waitFor(`document.querySelector('.build-header h1')?.textContent?.trim() === 'Build'`, 'P20-D Build after seed');
  const p20dProgressionOpened = await evaluate(`(() => {
    const button = [...document.querySelectorAll('.build-tabs button')].find(candidate => (candidate.textContent || '').trim().toLowerCase().startsWith('progression'));
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.focus();
    button.click();
    return true;
  })()`);
  if (!p20dProgressionOpened) throw new Error('P20-D could not open the Progression tab.');
  await waitFor(`Boolean(document.querySelector('[data-network-recommendation="vanguard-breach-guard-early"]'))`, 'P20-D Vanguard recommendations');

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
  if (!p20dLayout || !p20dLayout.hasRationale || p20dLayout.horizontalOverflow > 2 || p20dLayout.cardWidth > p20dLayout.viewportWidth + 2
    || (viewportMode === 'mobile-landscape' && (p20dLayout.minFont < 11.5 || p20dLayout.buttonHeight < 44))) {
    throw new Error(`P20-D recommendation layout failed: ${JSON.stringify(p20dLayout)}`);
  }

  const p20dLoaded = await evaluate(`(() => {
    const button = document.querySelector('button[data-network-recommendation-load="vanguard-breach-guard-early"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.focus();
    button.click();
    return document.activeElement === button;
  })()`);
  if (!p20dLoaded) throw new Error('P20-D could not load the Vanguard early recommendation.');
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
  })()`, 'P20-D recommendation to non-destructive Planned Build');

  await keyboardActivateButton('Auto Allocate');
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
  })()`, 'P20-D recommendation Auto Allocate commit', 20_000);
  console.log(`BROWSER_P20D_RECOMMENDATION_PASS viewport=${viewportMode} class=vanguard route=early preview=non-destructive autoAllocate=6 readability=${p20dLayout.minFont}px touch=${p20dLayout.buttonHeight}px`);

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
    || !(p20InterfaceCompact.rootFontSize <= p20InterfaceDefault.rootFontSize * 0.75 && p20InterfaceLarge.rootFontSize >= p20InterfaceDefault.rootFontSize * 1.2)
    || !(p20InterfaceCompact.rowPadding <= p20InterfaceDefault.rowPadding * 0.8 && p20InterfaceLarge.rowPadding >= p20InterfaceDefault.rowPadding * 1.15)
    || !(p20InterfaceCompact.selectPadding <= p20InterfaceDefault.selectPadding * 0.8 && p20InterfaceLarge.selectPadding >= p20InterfaceDefault.selectPadding * 1.15)
    || !(p20InterfaceCompact.tabGap <= p20InterfaceDefault.tabGap * 0.8 && p20InterfaceLarge.tabGap >= p20InterfaceDefault.tabGap * 1.15)) {
    throw new Error(`P20-A Interface Size reflow failed: ${JSON.stringify({ compact: p20InterfaceCompact, default: p20InterfaceDefault, large: p20InterfaceLarge })}`);
  }
  await setP20InterfaceSize('default');
  console.log(`BROWSER_P20_INTERFACE_SIZE_PASS viewport=${viewportMode} compact=${p20InterfaceCompact.rootFontSize}px default=${p20InterfaceDefault.rootFontSize}px large=${p20InterfaceLarge.rootFontSize}px overflow=none persisted=true`);

  async function p20OpenSettingsFromCommand() {
    await keyboardActivateButton('Operator');
    await keyboardActivateButton('Build');
    await waitFor(`Boolean(document.querySelector('.build-bay.iv-view'))`, 'P20-A Build after Command');
    await keyboardActivateButton('Settings');
    await waitFor(`Boolean(document.querySelector('.settings-panel select[aria-label="Interface size"]'))`, 'P20-A Settings after Command');
  }

  async function p20CommandFromSettings(size) {
    await setP20InterfaceSize(size);
    await keyboardActivateButton('Return to ship');
    await waitFor(`Boolean(document.querySelector('.ship-hub.area-command[data-interface-size="${size}"]')) && document.documentElement.dataset.interfaceSize === '${size}'`, `P20-A ${size} Settings to Command binding`);
    await sleep(120);
    return await evaluate(`(() => {
      const shell = document.querySelector('.ship-hub.area-command');
      const bridge = document.querySelector('.command-visual.command-bridge.command-bridge-compact');
      const kicker = document.querySelector('.command-bridge-copy .card-kicker');
      const nav = document.querySelector('.command-rail-nav button[data-primary-area]');
      return {
        shellSize: shell?.getAttribute('data-interface-size') ?? '',
        rootSize: document.documentElement.dataset.interfaceSize ?? '',
        bridgeHeight: Number((bridge?.getBoundingClientRect().height ?? 0).toFixed(3)),
        kickerDisplay: kicker ? getComputedStyle(kicker).display : '',
        navHeight: Number((nav?.getBoundingClientRect().height ?? 0).toFixed(3)),
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      };
    })()`);
  }

  const p20FlowCompact = await p20CommandFromSettings('compact');
  await p20OpenSettingsFromCommand();
  const p20FlowDefault = await p20CommandFromSettings('default');
  if (p20FlowCompact.shellSize !== 'compact' || p20FlowCompact.rootSize !== 'compact'
    || p20FlowDefault.shellSize !== 'default' || p20FlowDefault.rootSize !== 'default'
    || !(p20FlowCompact.bridgeHeight <= p20FlowDefault.bridgeHeight * 0.8)
    || p20FlowCompact.kickerDisplay !== 'none'
    || p20FlowCompact.navHeight < 44
    || p20FlowCompact.horizontalOverflow > 2 || p20FlowDefault.horizontalOverflow > 2) {
    throw new Error(`P20-A real Settings -> Command flow did not produce distinct density: ${JSON.stringify({ compact: p20FlowCompact, default: p20FlowDefault })}`);
  }
  console.log(`BROWSER_P20_SETTINGS_COMMAND_PASS viewport=${viewportMode} compactBridge=${p20FlowCompact.bridgeHeight}px defaultBridge=${p20FlowDefault.bridgeHeight}px shell=bound root=bound nav=${p20FlowCompact.navHeight}px overflow=none`);
  await p20OpenSettingsFromCommand();

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
  const p20eRepeatableProfiles = {};
  for (const family of ['salvage', 'boarding', 'stabilization']) {
    const selectedRepeatable = await evaluate(`(() => {
      const family = ${JSON.stringify(family)};
      const button = [...document.querySelectorAll('button[data-contract-id]')].find(candidate => candidate.dataset.contractId?.endsWith('-' + family));
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (!selectedRepeatable) throw new Error(`P20-E ${family} repeatable contract was not available on the Contract Board.`);
    await waitFor(`document.querySelector('button[data-contract-id$="-${family}"]')?.classList.contains('selected') === true`, `P20-E ${family} selection`);
    const profile = await evaluate(`(() => {
      const note = document.querySelector('.repeatable-identity-note[data-repeatable-family="${family}"]');
      const incentive = document.querySelector('.repeatable-incentive-note[data-repeatable-incentive="${family}"]');
      const card = document.querySelector('button[data-contract-id$="-${family}"] .contract-card-incentive');
      const safe = incentive?.querySelector('[data-incentive-depth="safe"]');
      const deep = incentive?.querySelector('[data-incentive-depth="deep"]');
      const objective = document.querySelector('.contract-inspector .objective-box b')?.textContent?.trim() ?? '';
      return { text: note?.textContent ?? '', objective, cardText: card?.textContent?.trim() ?? '', incentiveText: incentive?.textContent?.trim() ?? '', safeText: safe?.textContent?.trim() ?? '', deepText: deep?.textContent?.trim() ?? '' };
    })()`);
    const marker = family === 'salvage' ? 'RECOVER //' : family === 'boarding' ? 'BREACH //' : 'STABILIZE //';
    if (!profile.text.includes(marker) || !profile.text.includes('SAFE //') || !profile.text.includes('DEEP //') || !profile.objective || !profile.cardText || !profile.incentiveText || !profile.safeText.startsWith('SAFE //') || !profile.deepText.startsWith('DEEP //')) {
      throw new Error(`P20-E ${family} briefing/objective identity was not distinguishable before deployment: ${JSON.stringify(profile)}`);
    }
    p20eRepeatableProfiles[family] = profile;
  }
  if (new Set(Object.values(p20eRepeatableProfiles).map(profile => profile.objective)).size !== 3) {
    throw new Error(`P20-E repeatable objectives were not materially distinct: ${JSON.stringify(p20eRepeatableProfiles)}`);
  }
  console.log(`BROWSER_P20E_REPEATABLE_IDENTITY_PASS viewport=${viewportMode} families=salvage+boarding+stabilization markers=RECOVER+BREACH+STABILIZE predeploy=true`);
  if (new Set(Object.values(p20eRepeatableProfiles).map(profile => profile.cardText)).size !== 3 || new Set(Object.values(p20eRepeatableProfiles).map(profile => profile.incentiveText)).size !== 3) {
    throw new Error(`P20-F2 repeatable payoff presentation was not materially distinct: ${JSON.stringify(p20eRepeatableProfiles)}`);
  }
  console.log(`BROWSER_P20F2_REPEATABLE_INCENTIVES_PASS viewport=${viewportMode} families=salvage+boarding+stabilization cards=distinct safeDeep=visible predeploy=true`);

  if (p22cPrimaryJourney) {
    const p22cContractPreviousTextScale = await evaluate(`document.documentElement.dataset.textScale ?? ''`);
    let p22cContract;
    try {
      await evaluate(`document.documentElement.dataset.textScale = 'default'; true`);
      await sleep(100);
      p22cContract = await evaluate(`(() => {
        const layout = document.querySelector('.contracts-layout');
        const inspector = document.querySelector('.contract-inspector');
        const deploy = document.querySelector('.deploy-contract');
        const card = document.querySelector('.contract-card.selected') || document.querySelector('.contract-card');
        const toolbar = document.querySelector('.contract-toolbar');
        if (!(layout instanceof HTMLElement) || !(inspector instanceof HTMLElement) || !(deploy instanceof HTMLElement) || !(card instanceof HTMLElement) || !(toolbar instanceof HTMLElement)) return null;
        const viewport = { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
        const visible = element => {
          if (element.closest('[aria-hidden="true"]')) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
        };
        const ownText = element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent || '').join(' ').replace(/\\s+/g, ' ').trim();
        const copy = [...layout.querySelectorAll('small,p,span,b,strong,h2,h3,button')].filter(visible).map(element => ({
          text: ownText(element).slice(0, 64),
          size: Number.parseFloat(getComputedStyle(element).fontSize),
        })).filter(item => item.text && Number.isFinite(item.size));
        const inspectorRect = inspector.getBoundingClientRect();
        const deployRect = deploy.getBoundingClientRect();
        return {
          compactLandscape: viewport.width > viewport.height && viewport.height <= 500,
          rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
          minFont: copy.length ? Math.min(...copy.map(item => item.size)) : 0,
          tinyText: copy.filter(item => item.size < 11.5).slice(0, 16),
          cardRatio: Number.parseFloat(getComputedStyle(card).paddingLeft) / 14,
          toolbarRatio: Number.parseFloat(getComputedStyle(toolbar).paddingLeft) / 11,
          horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - viewport.width),
          inspector: { left: inspectorRect.left, top: inspectorRect.top, right: inspectorRect.right, bottom: inspectorRect.bottom, width: inspectorRect.width, height: inspectorRect.height },
          deploy: { left: deployRect.left, top: deployRect.top, right: deployRect.right, bottom: deployRect.bottom, width: deployRect.width, height: deployRect.height },
        };
      })()`);
      await captureScreenshot(p22cContractScreenshotPath);
    } finally {
      const previous = JSON.stringify(p22cContractPreviousTextScale);
      await evaluate(`(() => {
        const value = ${previous};
        if (value) document.documentElement.dataset.textScale = value;
        else delete document.documentElement.dataset.textScale;
        return true;
      })()`).catch(() => undefined);
      await sleep(100);
    }
    if (!p22cContract
      || p22cContract.horizontalOverflow > 2
      || Math.abs(p22cContract.rootFont / 16 - 0.7) > 0.025
      || Math.abs(p22cContract.cardRatio - 0.7) > 0.06
      || Math.abs(p22cContract.toolbarRatio - 0.7) > 0.06
      || (p22cContract.compactLandscape && p22cContract.tinyText.length)
      || p22cContract.deploy.width < 40
      || p22cContract.deploy.height < 40) {
      throw new Error(`P22-C contract preparation audit failed: ${JSON.stringify(p22cContract)}`);
    }
    p22cEvidence.contractPreparation = { ...p22cContract, screenshot: p22cContractScreenshotPath };
    console.log(`BROWSER_P22C_CONTRACT_PREP_PASS viewport=${viewportMode} root=${(p22cContract.rootFont / 16).toFixed(3)} card=${p22cContract.cardRatio.toFixed(3)} toolbar=${p22cContract.toolbarRatio.toFixed(3)} minFont=${p22cContract.minFont.toFixed(1)}px overflow=none deploy=${Math.round(p22cContract.deploy.width)}x${Math.round(p22cContract.deploy.height)} accessibility=restored`);
  }


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
  if (requestedGraphicsPath === 'babylon') {
    if (targetLocation === 'orbital-station') await p27C1BabylonOrbitalAudit();
    else if (targetLocation === 'damaged-vessel') await p27C2BabylonDamagedVesselAudit();
    else if (targetLocation === 'spin-habitat') await p27C3BabylonSpinHabitatAudit();
    else if (targetLocation === 'jovian-harvester') await p27C4BabylonJovianHarvesterAudit();
    else if (targetLocation === 'ice-mine') await p27C5BabylonIceMineAudit();
    else if (targetLocation === 'solar-yard') await p27C6BabylonSolarYardAudit();
    else if (targetLocation === 'lattice-annex') await p27C7BabylonLatticeAnnexAudit();
    else await p27A2BabylonBackendAudit();
    await performanceDiagnosticsAudit();
    if (pageExceptions.length > 0) {
      throw new Error(`P27-A2 Babylon comparison observed uncaught page exceptions: ${JSON.stringify(pageExceptions)}`);
    }
    await captureScreenshot();
    console.log(`BROWSER_E2E_PASS title=${startup.title} route=command>operations>contracts>combat location=${targetLocation} input=keyboard viewport=${viewportMode} graphics=babylon-comparison`);
    socket.close();
    process.exit(0);
  }
  if (requestedGraphicsPath === 'webgpu') {
    if (webGpuPresentationKnownGap) await rawWebGpuPresentationProbe();
    const p21f1State = await p21F1WebGpuPrototypeAudit();
    if (p21f1State.loaded === 'webgpu') await p21F2RefineryParityAudit('webgpu');
    const knownSwiftShaderScopeDrops = webGpuSwiftShaderCi
      ? pageExceptions.filter(message => message === 'OperationError: Instance dropped in popErrorScope')
      : [];
    const unexpectedWebGpuExceptions = pageExceptions.filter(message => (
      !webGpuSwiftShaderCi || message !== 'OperationError: Instance dropped in popErrorScope'
    ));
    if (unexpectedWebGpuExceptions.length > 0) {
      throw new Error(`P21-F2 WebGPU comparison observed uncaught page exceptions: ${JSON.stringify(unexpectedWebGpuExceptions)}`);
    }
    if (knownSwiftShaderScopeDrops.length > 0) {
      console.log(`BROWSER_P21F2_WEBGPU_KNOWN_CI_GAP viewport=${viewportMode} runner=swiftshader issue=pop-error-scope-instance-drop count=${knownSwiftShaderScopeDrops.length}`);
    }
    await captureScreenshot();
    console.log(`BROWSER_E2E_PASS title=${startup.title} route=command>operations>contracts>combat location=${targetLocation} input=keyboard viewport=${viewportMode} graphics=webgpu-comparison`);
    socket.close();
    process.exit(0);
  }
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
  if (targetLocation === 'asteroid-refinery') {
    await performanceDiagnosticsAudit();
    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
      return Boolean(canvas?.dataset.environmentP21Budget && canvas?.dataset.environmentIbl && canvas?.dataset.environmentTone);
    })()`, 'P21-E refinery adaptive effect budget', 45_000);

    const p21eState = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
      return {
        tier: canvas?.dataset.renderTier ?? '',
        quality: canvas?.dataset.graphicsQuality ?? '',
        budget: canvas?.dataset.environmentP21Budget ?? '',
        selection: canvas?.dataset.graphicsPathSelection ?? '',
      };
    })()`);
    const p21eBudget = parseP21EffectBudget(p21eState?.budget);
    const p21eExpected = p21eBudget ? P21_EFFECT_BUDGETS[p21eBudget.tier] : null;
    if (!p21eBudget || !p21eExpected || p21eState.tier !== p21eBudget.tier
      || Math.abs(p21eBudget.ibl - p21eExpected.ibl) > 0.001
      || Math.abs(p21eBudget.bloom - p21eExpected.bloom) > 0.001
      || Math.abs(p21eBudget.contact - p21eExpected.contact) > 0.001
      || Math.abs(p21eBudget.atmosphere - p21eExpected.atmosphere) > 0.001
      || p21eBudget.critical !== 1) {
      throw new Error(`P21-E refinery adaptive budget telemetry is invalid: ${JSON.stringify({ state: p21eState, parsed: p21eBudget })}`);
    }

    const p21bEnabled = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
      return {
        ibl: canvas?.dataset.environmentIbl ?? '',
        lighting: canvas?.dataset.environmentLighting ?? '',
        tone: canvas?.dataset.environmentTone ?? '',
        selection: canvas?.dataset.graphicsPathSelection ?? '',
      };
    })()`);
    const p21bShouldBeOn = p21bEnabled?.selection === 'qa-explicit' || p21eExpected.ibl >= 0.5;
    if (p21bShouldBeOn
      ? (!p21bEnabled?.ibl.startsWith('pmrem:furnace-amber+service-cyan:intensity-')
        || !p21bEnabled?.lighting.includes('+ibl:pmrem+')
        || !p21bEnabled?.tone.includes('+ibl-'))
      : (p21bEnabled?.ibl !== 'off:adaptive-budget'
        || !p21bEnabled?.lighting.includes('+ibl:off+')
        || !p21bEnabled?.tone.includes('+ibl-off'))) {
      throw new Error(`P21-B/P21-E refinery IBL telemetry is incomplete: ${JSON.stringify(p21bEnabled)}`);
    }

    if (requestedGraphicsPath) {
      if (p21bEnabled.selection !== 'qa-explicit') {
        throw new Error(`P21-B before/after capture requires explicit graphics QA mode: ${JSON.stringify(p21bEnabled)}`);
      }
      const disabled = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryIblQa = 'off';
        return true;
      })()`);
      if (!disabled) throw new Error('P21-B could not disable refinery IBL for the deterministic baseline capture.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === 'authored-refinery' && canvas.dataset.environmentIbl === 'off:qa-baseline' && canvas.dataset.environmentLighting?.includes('+ibl:off+'))`, 'P21-B IBL-off baseline');
      await sleep(120);
      await captureScreenshot(p21bBeforeScreenshotPath);

      const restored = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryIblQa = 'on';
        return true;
      })()`);
      if (!restored) throw new Error('P21-B could not restore refinery IBL after the baseline capture.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === 'authored-refinery' && canvas.dataset.environmentIbl?.startsWith('pmrem:furnace-amber+service-cyan:intensity-') && canvas.dataset.environmentLighting?.includes('+ibl:pmrem+'))`, 'P21-B IBL-on comparison');
      await sleep(120);
      await captureScreenshot(p21bAfterScreenshotPath);
      console.log(`BROWSER_P21B_IBL_PASS viewport=${viewportMode} ibl=${p21bEnabled.ibl} lighting=${p21bEnabled.lighting} tone=${p21bEnabled.tone} screenshots=${p21bBeforeScreenshotPath}+${p21bAfterScreenshotPath}`);
    }

    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
      const authored = Number((canvas?.dataset.environmentBloomSources ?? '').match(/authored:(\\d+)/)?.[1] ?? 0);
      return canvas?.dataset.environmentBloom?.startsWith('selective:refinery-selective-v1:')
        && authored > 0
        && canvas?.dataset.environmentBloomExcluded === 'hud+enemies+hazards+objectives+loot+interactables';
    })()`, 'P21-C selective refinery bloom production path', 20_000);

    const p21cEnabled = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
      return {
        bloom: canvas?.dataset.environmentBloom ?? '',
        sources: canvas?.dataset.environmentBloomSources ?? '',
        excluded: canvas?.dataset.environmentBloomExcluded ?? '',
        cost: canvas?.dataset.environmentBloomCost ?? '',
        selection: canvas?.dataset.graphicsPathSelection ?? '',
      };
    })()`);
    if (!p21cEnabled?.bloom.startsWith('selective:refinery-selective-v1:')
      || !/authored:[1-9]/.test(p21cEnabled.sources)
      || !p21cEnabled.sources.includes('+practical:')
      || !p21cEnabled.sources.includes('+vfx:muzzle-')
      || p21cEnabled.excluded !== 'hud+enemies+hazards+objectives+loot+interactables'
      || Math.abs(Number(p21cEnabled.cost) - p21eExpected.bloom) > 0.001) {
      throw new Error(`P21-C/P21-E refinery bloom production telemetry is incomplete: ${JSON.stringify(p21cEnabled)}`);
    }

    if (requestedGraphicsPath) {
      const readProtectedCueState = () => evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        return {
          excluded: canvas?.dataset.environmentBloomExcluded ?? '',
          interactables: Boolean(canvas?.dataset.interactableReadability),
          hazards: Boolean(canvas?.dataset.hazardReadability),
          loot: Boolean(canvas?.dataset.lootVisual),
          controls: Boolean(document.querySelector('[aria-label="Touch combat controls"]') || document.querySelector('.fire-button')),
          mission: Boolean(document.querySelector('.mission-chip')),
        };
      })()`);
      const cuesBefore = await readProtectedCueState();
      const disabled = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryBloomQa = 'off';
        return true;
      })()`);
      if (!disabled) throw new Error('P21-C could not disable refinery bloom for the deterministic baseline capture.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === 'authored-refinery' && canvas.dataset.environmentBloom === 'off:qa-baseline')`, 'P21-C bloom-off baseline');
      await sleep(120);
      await captureScreenshot(p21cBeforeScreenshotPath);

      const restored = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryBloomQa = 'on';
        return true;
      })()`);
      if (!restored) throw new Error('P21-C could not restore refinery bloom after the baseline capture.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === 'authored-refinery' && canvas.dataset.environmentBloom?.startsWith('selective:refinery-selective-v1:'))`, 'P21-C bloom-on comparison');
      await sleep(120);
      await captureScreenshot(p21cAfterScreenshotPath);
      const cuesAfter = await readProtectedCueState();
      if (JSON.stringify(cuesAfter) !== JSON.stringify(cuesBefore)) {
        throw new Error(`P21-C bloom toggle changed protected gameplay/UI cue availability: before=${JSON.stringify(cuesBefore)} after=${JSON.stringify(cuesAfter)}`);
      }

      const reducedCost = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryBloomCost = '0.45';
        return true;
      })()`);
      if (!reducedCost) throw new Error('P21-C could not apply the runtime bloom cost control.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentBloom?.includes(':cost-0.45:'))`, 'P21-C reduced bloom runtime cost');
      const restoredCost = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryBloomCost = '1';
        return true;
      })()`);
      if (!restoredCost) throw new Error('P21-C could not restore full bloom cost after runtime-control verification.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentBloom?.includes(':cost-1.00:'))`, 'P21-C restored bloom runtime cost');
      console.log(`BROWSER_P21C_BLOOM_PASS viewport=${viewportMode} bloom=${p21cEnabled.bloom} sources=${p21cEnabled.sources} excluded=${p21cEnabled.excluded} costControl=1.00>0.45>1.00 screenshots=${p21cBeforeScreenshotPath}+${p21cAfterScreenshotPath}`);
    }

    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
      return canvas?.dataset.environmentContactDepth?.startsWith('grounding:refinery-contact-grounding-v1:')
        && canvas?.dataset.environmentContactDepthProtected === 'hud+enemies+hazards+objectives+loot+interactables';
    })()`, 'P21-D1 refinery contact-depth production path', 20_000);

    const p21d1Enabled = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
      return {
        contactDepth: canvas?.dataset.environmentContactDepth ?? '',
        protected: canvas?.dataset.environmentContactDepthProtected ?? '',
        selection: canvas?.dataset.graphicsPathSelection ?? '',
      };
    })()`);
    const p21d1ContactMatch = p21d1Enabled?.contactDepth.match(/:instances-(\d+):triangles-(\d+):draws-1:alpha-32:opacity-0\.26/);
    const p21d1ExpectedInstances = Math.max(1, Math.round(10 * p21eExpected.contact));
    if (!p21d1Enabled?.contactDepth.startsWith('grounding:refinery-contact-grounding-v1:')
      || !p21d1ContactMatch
      || Number(p21d1ContactMatch[1]) !== p21d1ExpectedInstances
      || Number(p21d1ContactMatch[2]) !== p21d1ExpectedInstances * 2
      || p21d1Enabled.protected !== 'hud+enemies+hazards+objectives+loot+interactables') {
      throw new Error(`P21-D1/P21-E refinery contact-depth production telemetry is incomplete: ${JSON.stringify(p21d1Enabled)}`);
    }

    if (requestedGraphicsPath) {
      const readProtectedCueState = () => evaluate(`(() => ({
        interactables: Boolean(document.querySelector('canvas')?.dataset.interactableReadability),
        hazards: Boolean(document.querySelector('canvas')?.dataset.hazardReadability),
        loot: Boolean(document.querySelector('canvas')?.dataset.lootVisual),
        controls: Boolean(document.querySelector('[aria-label="Touch combat controls"]') || document.querySelector('.fire-button')),
        mission: Boolean(document.querySelector('.mission-chip')),
      }))()`);
      const cuesBefore = await readProtectedCueState();
      const disabled = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryContactDepthQa = 'off';
        return true;
      })()`);
      if (!disabled) throw new Error('P21-D1 could not disable refinery contact depth for the deterministic baseline capture.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === 'authored-refinery' && canvas.dataset.environmentContactDepth === 'off:qa-baseline')`, 'P21-D1 contact-depth-off baseline');
      await sleep(120);
      await captureScreenshot(p21d1BeforeScreenshotPath);

      const restored = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryContactDepthQa = 'on';
        return true;
      })()`);
      if (!restored) throw new Error('P21-D1 could not restore refinery contact depth after the baseline capture.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === 'authored-refinery' && canvas.dataset.environmentContactDepth?.startsWith('grounding:refinery-contact-grounding-v1:'))`, 'P21-D1 contact-depth-on comparison');
      await sleep(120);
      await captureScreenshot(p21d1AfterScreenshotPath);
      const cuesAfter = await readProtectedCueState();
      if (JSON.stringify(cuesAfter) !== JSON.stringify(cuesBefore)) {
        throw new Error(`P21-D1 contact-depth toggle changed protected gameplay/UI cue availability: before=${JSON.stringify(cuesBefore)} after=${JSON.stringify(cuesAfter)}`);
      }
      console.log(`BROWSER_P21D1_CONTACT_DEPTH_PASS viewport=${viewportMode} contact=${p21d1Enabled.contactDepth} protected=${p21d1Enabled.protected} screenshots=${p21d1BeforeScreenshotPath}+${p21d1AfterScreenshotPath}`);
    }

    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
      return Boolean(canvas?.dataset.environmentAtmosphere)
        && canvas?.dataset.environmentAtmosphereProtected === 'hud+enemies+hazards+objectives+loot+interactables'
        && Boolean(canvas?.dataset.environmentTone);
    })()`, 'P21-D2 refinery atmosphere production path', 20_000);

    const p21d2Enabled = await evaluate(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
      return {
        atmosphere: canvas?.dataset.environmentAtmosphere ?? '',
        protected: canvas?.dataset.environmentAtmosphereProtected ?? '',
        tone: canvas?.dataset.environmentTone ?? '',
        contactDepth: canvas?.dataset.environmentContactDepth ?? '',
      };
    })()`);
    const p21d2ShouldBeOn = p21bEnabled?.selection === 'qa-explicit' || p21eExpected.atmosphere >= 0.5;
    if ((p21d2ShouldBeOn
        ? (!p21d2Enabled?.atmosphere.startsWith('fog:refinery-depth-atmosphere-v1:')
          || !p21d2Enabled.tone.includes('+atmosphere-refinery-depth-atmosphere-v1'))
        : (p21d2Enabled?.atmosphere !== 'off:adaptive-budget'
          || !p21d2Enabled.tone.includes('+atmosphere-off')))
      || p21d2Enabled.protected !== 'hud+enemies+hazards+objectives+loot+interactables'
      || !p21d2Enabled.contactDepth.startsWith('grounding:refinery-contact-grounding-v1:')) {
      throw new Error(`P21-D2/P21-E refinery atmosphere production telemetry is incomplete: ${JSON.stringify(p21d2Enabled)}`);
    }

    if (requestedGraphicsPath) {
      const readProtectedCueState = () => evaluate(`(() => ({
        interactables: Boolean(document.querySelector('canvas')?.dataset.interactableReadability),
        hazards: Boolean(document.querySelector('canvas')?.dataset.hazardReadability),
        loot: Boolean(document.querySelector('canvas')?.dataset.lootVisual),
        controls: Boolean(document.querySelector('[aria-label="Touch combat controls"]') || document.querySelector('.fire-button')),
        mission: Boolean(document.querySelector('.mission-chip')),
      }))()`);
      const cuesBefore = await readProtectedCueState();
      const contactBefore = p21d2Enabled.contactDepth;
      const disabled = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryAtmosphereQa = 'off';
        return true;
      })()`);
      if (!disabled) throw new Error('P21-D2 could not disable refinery atmosphere for the deterministic baseline capture.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === 'authored-refinery' && canvas.dataset.environmentAtmosphere === 'off:qa-baseline' && canvas.dataset.environmentContactDepth?.startsWith('grounding:refinery-contact-grounding-v1:'))`, 'P21-D2 atmosphere-off baseline');
      await sleep(120);
      await captureScreenshot(p21d2BeforeScreenshotPath);

      const restored = await evaluate(`(() => {
        const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery');
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        canvas.dataset.refineryAtmosphereQa = 'on';
        return true;
      })()`);
      if (!restored) throw new Error('P21-D2 could not restore refinery atmosphere after the baseline capture.');
      await waitFor(`[...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.environmentVisual === 'authored-refinery' && canvas.dataset.environmentAtmosphere?.startsWith('fog:refinery-depth-atmosphere-v1:') && canvas.dataset.environmentContactDepth?.startsWith('grounding:refinery-contact-grounding-v1:'))`, 'P21-D2 atmosphere-on comparison');
      await sleep(120);
      await captureScreenshot(p21d2AfterScreenshotPath);
      const cuesAfter = await readProtectedCueState();
      const contactAfter = await evaluate(`[...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery')?.dataset.environmentContactDepth ?? ''`);
      if (JSON.stringify(cuesAfter) !== JSON.stringify(cuesBefore)) {
        throw new Error(`P21-D2 atmosphere toggle changed protected gameplay/UI cue availability: before=${JSON.stringify(cuesBefore)} after=${JSON.stringify(cuesAfter)}`);
      }
      if (contactBefore !== contactAfter) {
        throw new Error(`P21-D2 atmosphere toggle changed P21-D1 contact grounding: before=${contactBefore} after=${contactAfter}`);
      }
      console.log(`BROWSER_P21D2_ATMOSPHERE_PASS viewport=${viewportMode} atmosphere=${p21d2Enabled.atmosphere} protected=${p21d2Enabled.protected} contact=independent screenshots=${p21d2BeforeScreenshotPath}+${p21d2AfterScreenshotPath}`);
    }
    console.log(`BROWSER_P21E_ADAPTIVE_EFFECTS_PASS viewport=${viewportMode} tier=${p21eBudget.tier} quality=${p21eState.quality} budget=${p21eState.budget}`);
    if (requestedGraphicsPath === 'webgl2') await p21F2RefineryParityAudit('webgl2');
  }
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
  if (targetLocation === 'spin-habitat' && requestedGraphicsPath !== 'babylon') {
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
  if (viewportMode === 'mobile-landscape') {
    const p22cCombatLayout = await mobileCombatLayoutAudit();
    if (p22cPrimaryJourney) p22cEvidence.combat = { viewport: p22cCombatLayout.viewport, offscreen: p22cCombatLayout.offscreen, touchButtons: p22cCombatLayout.touchButtons };
  }
  await targetFeedbackAudit(viewportMode === 'mobile-landscape');
  if (p22cPrimaryJourney) {
    p22cEvidence.completed = true;
    await writeFile(p22cReportPath, JSON.stringify(p22cEvidence, null, 2));
    console.log(`BROWSER_P22C_FULL_UI_AUDIT_PASS viewport=${viewportMode} surfaces=class+management+contract+overlay+combat report=${p22cReportPath}`);
  }

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
