import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const screenshotPath = process.env.BROWSER_E2E_P28A5_LOW_VISIBILITY_SCREENSHOT ?? 'browser-p28a5-low-visibility.png';
const reportPath = process.env.BROWSER_E2E_P28A5_REPORT ?? 'browser-p28a5-image-grade.json';
// Historical proof markers retained for completed candidates: visualDetail: 'p28-c5-refinery-processor-lod0'; visualDetail: 'p28-c6-refinery-terminal-lod0'; visualDetail: 'p28-c7-refinery-crate-lod0'; visualDetail: 'p28-c8-refinery-world-authored-mappings'; visualDetail: 'p28-c9-refinery-geometry-reuse'; visualDetail: 'p28-d0-premium-character-source'; visualDetail: 'p28-d1-vanguard-operator-lod0'; visualDetail: 'p28-d2-vector-operator-lod0'; visualDetail: 'p28-d3-systems-operator-lod0'; visualDetail: 'p28-d4-assault-enemy-lod0'; visualDetail: 'p28-d5-suppressor-enemy-lod0'; visualDetail: 'p28-d6-technician-enemy-lod0'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function assertHeavyCache(raw, label) {
  const metrics = Object.fromEntries(String(raw).split('|').map(field => {
    const index = field.indexOf(':');
    return index > 0 ? [field.slice(0, index), Number(field.slice(index + 1))] : ['', NaN];
  }));
  const keys = ['cached', 'active', 'native', 'loading', 'loads', 'failures', 'hits', 'evictions', 'late-disposed', 'bytes'];
  if (keys.some(key => !Number.isSafeInteger(metrics[key]) || metrics[key] < 0)
    || metrics.cached < 11 || metrics.active < 1 || metrics.loads < 11
    || metrics.hits < 1 || metrics.loading !== 0 || metrics.failures !== 0
    || metrics['late-disposed'] !== 0 || metrics.bytes < 1) {
    throw new Error(`P28-F6 ${label} graphics source ownership invalid: ${JSON.stringify(metrics)}`);
  }
  return metrics;
}

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
    const value = await evaluate(expression);
    if (value) return value;
    await sleep(100);
  }
  const diagnostic = await evaluate(`(() => {
    const d = document.querySelector('canvas')?.dataset;
    return {
      scenario: d?.babylonScenario, environmentVisual: d?.environmentVisual,
      environmentState: d?.babylonEnvironmentState, environmentAssets: d?.babylonEnvironmentAssets,
      dressingState: d?.refineryDressingState, dressingInstances: d?.refineryDressingInstances,
      dressingAssets: d?.refineryDressingAssets, dressingError: d?.refineryDressingError,
      player: d?.babylonPlayerState, enemies: d?.babylonEnemyState,
      catalog: d?.babylonEnemyCatalogState, catalogAssets: d?.babylonEnemyCatalogAssets,
      frame: d?.babylonFrames, assetCache: d?.babylonAssetCacheTelemetry,
    };
  })()`).catch(error => ({ diagnosticError: String(error) }));
  throw new Error(`Timed out waiting for ${label}. state=${JSON.stringify(diagnostic)}`);
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
    assetCache: canvas.dataset.babylonAssetCacheTelemetry ?? '',
    environmentState: canvas.dataset.babylonEnvironmentState ?? '',
    environmentAssets: Number(canvas.dataset.babylonEnvironmentAssets ?? 0),
    dressingState: canvas.dataset.refineryDressingState ?? '',
    dressingInstances: Number(canvas.dataset.refineryDressingInstances ?? 0),
    dressingAssets: canvas.dataset.refineryDressingAssets ?? '',
    weaponAsset: canvas.dataset.weaponAsset ?? '',
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
      && catalog.split(',').includes('enemy-elite-lod0')
      && canvas?.dataset.babylonEnvironmentState === 'ready'
      && Number(canvas?.dataset.babylonEnvironmentAssets ?? 0) >= 11
      && canvas?.dataset.refineryDressingState === 'ready'
      && Number(canvas?.dataset.refineryDressingInstances ?? 0) >= 8
      && canvas?.dataset.babylonEnemyState === 'ready'
      && canvas?.dataset.babylonAssetCacheTelemetry?.includes('loading:0');
  })()`, 'normal Flagship refinery grade with elite enemy LOD0', 300_000);

  const normal = await evaluate(readGradeStateExpression);
  const expectedCatalog = 'enemy-assault-lod0,enemy-suppressor-lod0,enemy-technician-lod0,enemy-elite-lod0';
  const coldCache = assertHeavyCache(normal?.assetCache, 'cold Flagship refinery route');
  const localResources = await evaluate(`(() => {
    const delivered = performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => name.includes('/assets/models/') && name.endsWith('.glb'));
    const foreign = delivered.filter(name => {
      try { return new URL(name, location.href).origin !== location.origin; } catch { return true; }
    });
    return { localCount: delivered.length, foreign };
  })()`);
  if (!localResources || localResources.localCount < 11 || localResources.foreign.length) {
    throw new Error('P28-F6 cold route heavy-model requests are missing or nonlocal: '
      + JSON.stringify(localResources));
  }
  if (!normal
    || normal.tier !== 'high'
    || !normal.atmosphere.includes('exposure-1.055:contrast-0.985:grade-p28-a5-dark-separation-v1')
    || normal.refineryWorldVisual !== 'authored-family-mapped'
    || normal.refineryWorldMappedCount < 1
    || normal.refineryWorldAuthoredCount !== normal.refineryWorldMappedCount
    || normal.refineryWorldFallbackCount !== 0
    || normal.enemyFallbackCount !== 0
    || normal.environmentState !== 'ready'
    || normal.environmentAssets < 11
    || normal.dressingState !== 'ready'
    || normal.dressingInstances < 8
    || normal.dressingAssets.split(',').length < 8
    || !normal.weaponAsset
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

  const lowVisibility = await waitFor(`(() => {
    const state = ${readGradeStateExpression};
    return state?.mode === 'low-visibility'
      && state.atmosphere.includes('near-14.0:far-32.0')
      && state.atmosphere.includes('exposure-1.080:contrast-0.965:grade-p28-a5-dark-separation-v1')
      ? state
      : false;
  })()`, 'low-visibility Flagship refinery grade');
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

  const warmCache = assertHeavyCache(lowVisibility.assetCache, 'warm Flagship refinery route');
  if (warmCache.loads !== coldCache.loads
    || warmCache.cached !== coldCache.cached
    || warmCache.active !== coldCache.active
    || warmCache.bytes !== coldCache.bytes
    || warmCache.hits < coldCache.hits
    || lowVisibility.enemyFallbackCount !== 0
    || lowVisibility.refineryWorldFallbackCount !== 0) {
    throw new Error('P28-F6 warm Flagship reuse regressed or fell back: '
      + JSON.stringify({ coldCache, warmCache, lowVisibility }));
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
    heavyCache: { cold: coldCache, warm: warmCache, localResources },
    screenshot: screenshotPath,
    screenshotBytes: png.length,
  }, null, 2) + '\n');

  const restoreState = await evaluate(`(() => {
    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
    if (!(canvas instanceof HTMLCanvasElement)) return 'not-mounted';
    delete canvas.dataset.refineryImageGradeQa;
    return 'cleared';
  })()`);
  if (restoreState === 'cleared') {
    await waitFor(`(() => {
      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
      return canvas?.dataset.environmentImageGradeMode === 'normal'
        && canvas?.dataset.environmentAtmosphere?.includes('exposure-1.055:contrast-0.985:grade-p28-a5-dark-separation-v1');
    })()`, 'restored normal Flagship refinery grade');
  } else if (restoreState !== 'not-mounted') {
    throw new Error(`Could not clear the P28-A5 low-visibility QA grade: ${String(restoreState)}`);
  }

  console.log('P28_F6_FLAGSHIP_HEAVY_CACHE_PASS coldLoads=' + coldCache.loads
    + ' warmLoads=' + warmCache.loads + ' hits=' + warmCache.hits
    + ' cached=' + warmCache.cached + ' active=' + warmCache.active
    + ' localRequests=' + localResources.localCount + ' fallback=0 lateDisposed=0');
  console.log(`BROWSER_P28A5_IMAGE_GRADE_PASS tier=${lowVisibility.tier} detail=p28-d7-elite-enemy-lod0 catalog=${normal.enemyCatalogAssets} lods=${normal.enemyCatalogLod} telegraphs=${normal.enemyTelegraphs} protocol=${normal.protocolStatusVisuals} lifecycle=${normal.enemyLifecycleTracked} normal=${normal.atmosphere} lowVisibility=${lowVisibility.atmosphere} tone=${lowVisibility.tone} cues=1.00 runtime=${normal.assetRuntime} scene=${normal.sceneTelemetry} screenshot=${screenshotPath} bytes=${png.length}`);
} finally {
  socket.close();
}
