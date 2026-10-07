import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const screenshotPath = process.env.BROWSER_E2E_P28A5_LOW_VISIBILITY_SCREENSHOT ?? 'browser-p28a5-low-visibility.png';
const reportPath = process.env.BROWSER_E2E_P28A5_REPORT ?? 'browser-p28a5-image-grade.json';
// Historical proof markers retained for completed candidates: visualDetail: 'p28-c5-refinery-processor-lod0'; visualDetail: 'p28-c6-refinery-terminal-lod0'; visualDetail: 'p28-c7-refinery-crate-lod0'; visualDetail: 'p28-c8-refinery-world-authored-mappings'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('Node WebSocket support is required for P28-A5 browser capture.');
}

const targets = await (await fetch(`${cdpBase}/json`)).json();
const target = targets.find(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
if (!target) throw new Error('No Chrome page target available for P28-A5 image-grade capture.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(String(event.data));
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message ?? 'CDP request failed'));
  else request.resolve(message.result);
});

function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return result.result?.value;
}

async function waitFor(expression, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

const readGradeStateExpression = `(() => {
  const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  const rect = canvas.getBoundingClientRect();
  return {
    tier: canvas.dataset.renderTier ?? '',
    grade: canvas.dataset.environmentImageGrade ?? '',
    mode: canvas.dataset.environmentImageGradeMode ?? '',
    atmosphere: canvas.dataset.environmentAtmosphere ?? '',
    tone: canvas.dataset.environmentPostTone ?? '',
    bloom: canvas.dataset.environmentBloom ?? '',
    protected: canvas.dataset.environmentAtmosphereProtected ?? '',
    priority: canvas.dataset.effectPriority ?? '',
    stack: canvas.dataset.babylonPostStack ?? '',
    refineryWorldVisual: canvas.dataset.refineryWorldVisual ?? '',
    refineryWorldMappedCount: Number(canvas.dataset.refineryWorldMappedCount ?? 0),
    refineryWorldAuthoredCount: Number(canvas.dataset.refineryWorldAuthoredCount ?? 0),
    refineryWorldFallbackCount: Number(canvas.dataset.refineryWorldFallbackCount ?? 0),
    assetRuntime: canvas.dataset.babylonWorldRuntime ?? '',
    sceneTelemetry: canvas.dataset.babylonSceneTelemetry ?? '',
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
})()`;

try {
  await call('Runtime.enable');
  await call('Page.enable');
  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
    return canvas?.dataset.babylonPostStack === 'on:qa-explicit'
      && canvas?.dataset.environmentImageGrade === 'p28-a5-dark-separation-v1'
      && canvas?.dataset.environmentImageGradeMode === 'normal';
  })()`, 'normal Flagship refinery grade');

  const normal = await evaluate(readGradeStateExpression);
  if (!normal
    || normal.tier !== 'high'
    || !normal.atmosphere.includes('exposure-1.055:contrast-0.985:grade-p28-a5-dark-separation-v1')
    || normal.refineryWorldVisual !== 'authored-family-mapped'
    || normal.refineryWorldMappedCount < 1
    || normal.refineryWorldAuthoredCount !== normal.refineryWorldMappedCount
    || normal.refineryWorldFallbackCount !== 0
    || !normal.assetRuntime.includes('cache:')
    || !normal.assetRuntime.includes('active:')
    || !normal.sceneTelemetry.includes('meshes:')
    || !normal.sceneTelemetry.includes('materials:')) {
    throw new Error(`P28-A5 normal Flagship grade is not deterministic: ${JSON.stringify(normal)}`);
  }

  const enabled = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    canvas.dataset.refineryImageGradeQa = 'low-visibility';
    return true;
  })()`);
  if (!enabled) throw new Error('Could not enable the P28-A5 low-visibility QA grade.');

  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
    return canvas?.dataset.environmentImageGradeMode === 'low-visibility'
      && canvas?.dataset.environmentAtmosphere?.includes('near-14.0:far-32.0')
      && canvas?.dataset.environmentAtmosphere?.includes('exposure-1.080:contrast-0.965:grade-p28-a5-dark-separation-v1');
  })()`, 'low-visibility Flagship refinery grade');
  await sleep(300);

  const lowVisibility = await evaluate(readGradeStateExpression);
  if (!lowVisibility
    || lowVisibility.tier !== 'high'
    || lowVisibility.grade !== 'p28-a5-dark-separation-v1'
    || lowVisibility.mode !== 'low-visibility'
    || !/^aces-exposure-\d+\.\d{2}\+contrast-\d+\.\d{2}$/.test(lowVisibility.tone)
    || !lowVisibility.bloom.startsWith('selective:refinery-selective-v1:')
    || lowVisibility.protected !== 'hud+enemies+hazards+objectives+loot+interactables'
    || !lowVisibility.priority.includes('critical:hazards+telegraphs+class-cues@1.00')
    || lowVisibility.stack !== 'on:qa-explicit') {
    throw new Error(`P28-A5 low-visibility telemetry is incomplete: ${JSON.stringify(lowVisibility)}`);
  }

  const capture = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const png = Buffer.from(capture.data, 'base64');
  if (png.length < 10_000) throw new Error(`P28-A5 low-visibility screenshot is unexpectedly small: ${png.length} bytes.`);
  await writeFile(screenshotPath, png);

  await writeFile(reportPath, JSON.stringify({
    viewport: 'desktop',
    visualDetail: 'p28-c9-refinery-geometry-reuse',
    normal,
    lowVisibility,
    screenshot: screenshotPath,
    screenshotBytes: png.length,
  }, null, 2) + '\n');

  const restored = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    delete canvas.dataset.refineryImageGradeQa;
    return true;
  })()`);
  if (!restored) throw new Error('Could not clear the P28-A5 low-visibility QA grade.');
  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
    return canvas?.dataset.environmentImageGradeMode === 'normal'
      && canvas?.dataset.environmentAtmosphere?.includes('exposure-1.055:contrast-0.985:grade-p28-a5-dark-separation-v1');
  })()`, 'restored normal Flagship refinery grade');

  console.log(`BROWSER_P28A5_IMAGE_GRADE_PASS tier=${lowVisibility.tier} detail=p28-c9-refinery-geometry-reuse normal=${normal.atmosphere} lowVisibility=${lowVisibility.atmosphere} tone=${lowVisibility.tone} cues=1.00 runtime=${normal.assetRuntime} scene=${normal.sceneTelemetry} screenshot=${screenshotPath} bytes=${png.length}`);
} finally {
  socket.close();
}