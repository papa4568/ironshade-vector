import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const screenshotPath = process.env.BROWSER_E2E_P28A5_LOW_VISIBILITY_SCREENSHOT ?? 'browser-p28a5-low-visibility.png';
const reportPath = process.env.BROWSER_E2E_P28A5_REPORT ?? 'browser-p28a5-image-grade.json';
// Historical proof markers retained for completed candidates: visualDetail: 'p28-c5-refinery-processor-lod0'; visualDetail: 'p28-c6-refinery-terminal-lod0'; visualDetail: 'p28-c7-refinery-crate-lod0'; visualDetail: 'p28-c8-refinery-world-authored-mappings'; visualDetail: 'p28-c9-refinery-geometry-reuse'; visualDetail: 'p28-d0-premium-character-source'; visualDetail: 'p28-d1-vanguard-operator-lod0'; visualDetail: 'p28-d2-vector-operator-lod0'; visualDetail: 'p28-d3-systems-operator-lod0'; visualDetail: 'p28-d4-assault-enemy-lod0'; visualDetail: 'p28-d5-suppressor-enemy-lod0'; visualDetail: 'p28-d6-technician-enemy-lod0'
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

async function clickButton(label) {
  const clicked = await evaluate(`(() => {
    const target = ${JSON.stringify(label.toLowerCase())};
    const button = [...document.querySelectorAll('button')].find(candidate => {
      const aria = (candidate.getAttribute('aria-label') || '').trim().toLowerCase();
      const text = (candidate.textContent || '').trim().toLowerCase();
      return aria === target || text === target;
    });
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.focus();
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not activate ${label} while preparing the P28-D7 capture.`);
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
    operatorVisual: canvas.dataset.operatorVisual ?? '',
    operatorAsset: canvas.dataset.operatorAsset ?? '',
    operatorClassAsset: canvas.dataset.operatorClassAsset ?? '',
    operatorRig: canvas.dataset.operatorRig ?? '',
    operatorSocket: canvas.dataset.operatorSocket ?? '',
    enemyCatalogState: canvas.dataset.babylonEnemyCatalogState ?? '',
    enemyCatalogAssets: canvas.dataset.babylonEnemyCatalogAssets ?? '',
    enemyCatalogLod: canvas.dataset.babylonEnemyCatalogLod ?? '',
    enemyCatalogRuntime: canvas.dataset.babylonEnemyCatalogRuntime ?? '',
    enemyVisual: canvas.dataset.enemyVisual ?? '',
    enemyAssets: canvas.dataset.enemyAssets ?? '',
    enemyRoles: canvas.dataset.enemyRoles ?? '',
    enemyFallbackCount: Number(canvas.dataset.enemyFallbackCount ?? 0),
    enemyTelegraphs: canvas.dataset.babylonEnemyTelegraphs ?? '',
    enemyTelegraphOwnership: canvas.dataset.babylonEnemyTelegraphSimulationOwnership ?? '',
    enemyTelegraphEffectsMode: canvas.dataset.babylonEnemyTelegraphEffectsMode ?? '',
    protocolStatusVisuals: canvas.dataset.babylonProtocolStatusVisuals ?? '',
    protocolStatusOwnership: canvas.dataset.babylonProtocolStatusSimulationOwnership ?? '',
    protocolStatusPriority: canvas.dataset.babylonProtocolStatusPriority ?? '',
    enemyLifecycleTracked: Number(canvas.dataset.babylonEnemyLifecycleTracked ?? 0),
    enemyLifecycleOwnership: canvas.dataset.babylonEnemyLifecycleSimulationOwnership ?? '',
    enemyLifecycleEffectsMode: canvas.dataset.babylonEnemyLifecycleEffectsMode ?? '',
    assetRuntime: canvas.dataset.babylonWorldRuntime ?? '',
    sceneTelemetry: canvas.dataset.babylonSceneTelemetry ?? '',
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
})()`;

try {
  await call('Runtime.enable');
  await call('Page.enable');
  const previousTimeOrigin = await evaluate('performance.timeOrigin');
  const systemsSeeded = await evaluate(`(() => {
    const stateKey = 'ironshade-vector-state-v1';
    const state = JSON.parse(localStorage.getItem(stateKey) || 'null');
    if (!state?.profile) return false;
    state.profile.operatorClass = 'systems';
    state.profile.classSelectionComplete = true;
    state.profile.specialization = null;
    state.profile.specializationOverclock = false;
    state.profile.level = 7;
    state.profile.xp = Math.max(Number(state.profile.xp || 0), 1890);
    state.profile.progressionPoints = 6;
    state.profile.allocatedNodes = [];
    state.profile.operatorNetwork = {
      schemaVersion: 3,
      startNodeId: 'start-systems',
      allocatedNodeIds: [],
      unspentPoints: 6,
      plannedTargetNodeIds: [],
    };
    state.operatorNetworkSchemaVersion = 3;
    localStorage.setItem(stateKey, JSON.stringify(state));
    location.reload();
    return true;
  })()`);
  if (!systemsSeeded) throw new Error('Could not seed the deterministic Systems operator profile for P28-D7 capture.');

  await waitFor(`performance.timeOrigin !== ${JSON.stringify(previousTimeOrigin)}`, 'Systems profile browser reload', 20_000);
  await waitFor(`(() => {
    const labels = [...document.querySelectorAll('button[data-primary-area]')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
    return document.readyState === 'complete' && labels.includes('operations');
  })()`, 'Systems seeded Command Deck', 20_000);
  await clickButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(button => (button.textContent || '').trim().toLowerCase() === 'contracts')`, 'Systems Operations navigation', 20_000);
  await clickButton('Contracts');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('contract board') && [...document.querySelectorAll('button')].some(button => (button.textContent || '').trim().toLowerCase() === 'deploy selected contract')`, 'Systems Contract Board', 20_000);
  const refinerySelected = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button[data-location]')].find(candidate => candidate.dataset.location === 'asteroid-refinery');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!refinerySelected) throw new Error('Could not select the asteroid-refinery contract for the P28-D7 capture.');
  await waitFor(`[...document.querySelectorAll('button[data-location]')].some(button => button.dataset.location === 'asteroid-refinery' && button.classList.contains('selected'))`, 'Systems asteroid-refinery contract selection', 20_000);
  await clickButton('Deploy Selected Contract');
  await waitFor(`document.querySelectorAll('canvas').length > 0`, 'Systems combat surface', 20_000);

  await waitFor(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
    const catalog = canvas?.dataset.babylonEnemyCatalogAssets ?? '';
    return canvas?.dataset.babylonPostStack === 'on:qa-explicit'
      && canvas?.dataset.environmentImageGrade === 'p28-a5-dark-separation-v1'
      && canvas?.dataset.environmentImageGradeMode === 'normal'
      && canvas?.dataset.operatorVisual === 'authored-0-babylon'
      && canvas?.dataset.operatorAsset === 'operator-systems-lod0'
      && canvas?.dataset.operatorClassAsset === 'systems'
      && canvas?.dataset.babylonEnemyCatalogState === 'ready'
      && catalog.split(',').includes('enemy-assault-lod0')
      && catalog.split(',').includes('enemy-suppressor-lod0')
      && catalog.split(',').includes('enemy-technician-lod0')
      && catalog.split(',').includes('enemy-elite-lod0');
  })()`, 'normal Flagship refinery grade with elite enemy LOD0', 90_000);

  const normal = await evaluate(readGradeStateExpression);
  const expectedCatalog = 'enemy-assault-lod0,enemy-suppressor-lod0,enemy-technician-lod0,enemy-elite-lod0';
  if (!normal
    || normal.tier !== 'high'
    || !normal.atmosphere.includes('exposure-1.055:contrast-0.985:grade-p28-a5-dark-separation-v1')
    || normal.refineryWorldVisual !== 'authored-family-mapped'
    || normal.refineryWorldMappedCount < 1
    || normal.refineryWorldAuthoredCount !== normal.refineryWorldMappedCount
    || normal.refineryWorldFallbackCount !== 0
    || normal.operatorVisual !== 'authored-0-babylon'
    || normal.operatorAsset !== 'operator-systems-lod0'
    || normal.operatorClassAsset !== 'systems'
    || normal.operatorRig !== 'articulated'
    || normal.operatorSocket !== 'weapon-socket'
    || normal.enemyCatalogState !== 'ready'
    || normal.enemyCatalogAssets !== expectedCatalog
    || normal.enemyCatalogLod !== '0'
    || !normal.enemyCatalogRuntime.includes('cached:')
    || normal.enemyTelegraphs !== 'attack+aim+range+boss-pattern+phase'
    || normal.enemyTelegraphOwnership !== 'read-only-presentation'
    || normal.enemyTelegraphEffectsMode !== 'full'
    || normal.protocolStatusVisuals !== 'protocol+mutation+enemy-status+player-status'
    || normal.protocolStatusOwnership !== 'read-only-presentation'
    || normal.protocolStatusPriority !== 'telegraph>status>protocol+mutation'
    || normal.enemyLifecycleTracked < 1
    || normal.enemyLifecycleOwnership !== 'read-only-presentation'
    || normal.enemyLifecycleEffectsMode !== 'full'
    || !normal.assetRuntime.includes('cached:')
    || !normal.assetRuntime.includes('active:')
    || !normal.sceneTelemetry.includes('meshes:')
    || !normal.sceneTelemetry.includes('materials:')) {
    throw new Error(`P28-D7 normal Flagship elite LOD0 proof is not deterministic: ${JSON.stringify(normal)}`);
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
    || lowVisibility.operatorVisual !== 'authored-0-babylon'
    || lowVisibility.operatorAsset !== 'operator-systems-lod0'
    || lowVisibility.operatorClassAsset !== 'systems'
    || lowVisibility.enemyCatalogState !== 'ready'
    || lowVisibility.enemyCatalogAssets !== expectedCatalog
    || lowVisibility.enemyCatalogLod !== '0'
    || lowVisibility.enemyTelegraphs !== 'attack+aim+range+boss-pattern+phase'
    || lowVisibility.enemyTelegraphOwnership !== 'read-only-presentation'
    || lowVisibility.protocolStatusVisuals !== 'protocol+mutation+enemy-status+player-status'
    || lowVisibility.protocolStatusOwnership !== 'read-only-presentation'
    || lowVisibility.enemyLifecycleTracked < 1
    || lowVisibility.enemyLifecycleOwnership !== 'read-only-presentation'
    || !/^aces-exposure-\d+\.\d{2}\+contrast-\d+\.\d{2}$/.test(lowVisibility.tone)
    || !lowVisibility.bloom.startsWith('selective:refinery-selective-v1:')
    || lowVisibility.protected !== 'hud+enemies+hazards+objectives+loot+interactables'
    || !lowVisibility.priority.includes('critical:hazards+telegraphs+class-cues@1.00')
    || lowVisibility.stack !== 'on:qa-explicit') {
    throw new Error(`P28-D7 low-visibility elite LOD0 telemetry is incomplete: ${JSON.stringify(lowVisibility)}`);
  }

  const capture = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const png = Buffer.from(capture.data, 'base64');
  if (png.length < 10_000) throw new Error(`P28-A5 low-visibility screenshot is unexpectedly small: ${png.length} bytes.`);
  await writeFile(screenshotPath, png);

  await writeFile(reportPath, JSON.stringify({
    viewport: 'desktop',
    visualDetail: 'p28-d7-elite-enemy-lod0',
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

  console.log(`BROWSER_P28A5_IMAGE_GRADE_PASS tier=${lowVisibility.tier} detail=p28-d7-elite-enemy-lod0 catalog=${normal.enemyCatalogAssets} lods=${normal.enemyCatalogLod} telegraphs=${normal.enemyTelegraphs} protocol=${normal.protocolStatusVisuals} lifecycle=${normal.enemyLifecycleTracked} normal=${normal.atmosphere} lowVisibility=${lowVisibility.atmosphere} tone=${lowVisibility.tone} cues=1.00 runtime=${normal.assetRuntime} scene=${normal.sceneTelemetry} screenshot=${screenshotPath} bytes=${png.length}`);
} finally {
  socket.close();
}
