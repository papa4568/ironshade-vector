import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const screenshotPath = process.env.BROWSER_E2E_P28D8_BOSS_SCREENSHOT ?? 'browser-p28d8-boss.png';
const reportPath = process.env.BROWSER_E2E_P28D8_BOSS_REPORT ?? 'browser-p28d8-boss.json';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('P28-D8 capture requires Node 22+ global WebSocket support.');
}

const targets = await fetch(`${cdpBase}/json`).then(response => response.json());
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No Chrome page target is available for the P28-D8 boss capture.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let ordinal = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const payload = JSON.parse(String(event.data));
  if (!payload.id) return;
  const request = pending.get(payload.id);
  if (!request) return;
  pending.delete(payload.id);
  if (payload.error) request.reject(new Error(payload.error.message ?? JSON.stringify(payload.error)));
  else request.resolve(payload.result);
});

function call(method, params = {}) {
  const id = ++ordinal;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return result.result?.value;
}

async function waitFor(expression, label, timeoutMs = 20_000) {
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
  if (!clicked) throw new Error(`Could not activate ${label} while preparing the P28-D8 boss capture.`);
}

const readBossStateExpression = `(() => {
  const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  const rect = canvas.getBoundingClientRect();
  return {
    href: location.href,
    search: location.search,
    babylonInit: canvas.dataset.babylonInit ?? '',
    backendLoaded: canvas.dataset.babylonBackendLoaded ?? '',
    bossRequest: canvas.dataset.babylonBossRequest ?? '',
    bossFallbackReason: canvas.dataset.babylonBossFallbackReason ?? '',
    tier: canvas.dataset.renderTier ?? '',
    qualityInput: canvas.dataset.renderQualityInput ?? '',
    bossPresentation: canvas.dataset.babylonBossPresentation ?? '',
    bossAsset: canvas.dataset.babylonBossAsset ?? '',
    bossRig: canvas.dataset.babylonBossRig ?? '',
    bossQaPreview: canvas.dataset.babylonBossQaPreview ?? '',
    bossQaQuality: canvas.dataset.babylonBossQaQuality ?? '',
    bossPresentationPhaseCue: canvas.dataset.babylonBossPresentationPhaseCue ?? '',
    bossTelegraphPhaseCue: canvas.dataset.babylonBossPhaseCue ?? '',
    bossCueTiming: canvas.dataset.babylonBossCueTiming ?? '',
    bossDetailScale: canvas.dataset.babylonBossDetailScale ?? '',
    enemyTelegraphs: canvas.dataset.babylonEnemyTelegraphs ?? '',
    enemyTelegraphOwnership: canvas.dataset.babylonEnemyTelegraphSimulationOwnership ?? '',
    protocolStatusOwnership: canvas.dataset.babylonProtocolStatusSimulationOwnership ?? '',
    enemyLifecycleOwnership: canvas.dataset.babylonEnemyLifecycleSimulationOwnership ?? '',
    environmentVisual: canvas.dataset.environmentVisual ?? '',
    imageGrade: canvas.dataset.environmentImageGrade ?? '',
    imageGradeMode: canvas.dataset.environmentImageGradeMode ?? '',
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
  const previewEnabled = await evaluate(`(() => {
    const url = new URL(location.href);
    url.searchParams.set('p28d8BossQa', '1');
    location.href = url.href;
    return true;
  })()`);
  if (!previewEnabled) throw new Error('Could not enable the visual-only P28-D8 boss preview.');

  await waitFor(`performance.timeOrigin !== ${JSON.stringify(previousTimeOrigin)}`, 'P28-D8 preview browser reload', 20_000);
  await waitFor(`(() => {
    const labels = [...document.querySelectorAll('button[data-primary-area]')].map(button => (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase());
    return document.readyState === 'complete' && labels.includes('operations');
  })()`, 'P28-D8 Command Deck', 20_000);
  await clickButton('Operations');
  await waitFor(`[...document.querySelectorAll('button')].some(button => (button.textContent || '').trim().toLowerCase() === 'contracts')`, 'P28-D8 Operations navigation', 20_000);
  await clickButton('Contracts');
  await waitFor(`(document.body?.innerText ?? '').toLowerCase().includes('contract board') && [...document.querySelectorAll('button')].some(button => (button.textContent || '').trim().toLowerCase() === 'deploy selected contract')`, 'P28-D8 Contract Board', 20_000);

  const refinerySelected = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button[data-location]')].find(candidate => candidate.dataset.location === 'asteroid-refinery');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!refinerySelected) throw new Error('Could not select the asteroid-refinery contract for the P28-D8 boss capture.');
  await waitFor(`[...document.querySelectorAll('button[data-location]')].some(button => button.dataset.location === 'asteroid-refinery' && button.classList.contains('selected'))`, 'P28-D8 asteroid-refinery contract selection', 20_000);
  await clickButton('Deploy Selected Contract');
  await waitFor(`document.querySelectorAll('canvas').length > 0`, 'P28-D8 combat surface', 20_000);

  const bossDeadline = Date.now() + 90_000;
  let boss = null;
  while (Date.now() < bossDeadline) {
    boss = await evaluate(readBossStateExpression);
    if (boss
      && boss.bossQaPreview === 'enabled'
      && boss.bossQaQuality === 'flagship-asset-lock'
      && boss.bossPresentation === 'authored:enemy-boss-lod0'
      && boss.bossAsset === 'enemy-boss-lod0'
      && boss.bossRig === 'articulated+phase-anchors'
      && boss.bossPresentationPhaseCue === 'qa-preview:phase-2'
      && boss.bossCueTiming === 'enemyBossAnimation:unchanged'
      && boss.bossDetailScale === '1.00') break;
    await sleep(100);
  }
  if (!boss
    || boss.bossQaPreview !== 'enabled'
    || boss.bossQaQuality !== 'flagship-asset-lock'
    || boss.bossPresentation !== 'authored:enemy-boss-lod0'
    || boss.bossAsset !== 'enemy-boss-lod0'
    || boss.bossRig !== 'articulated+phase-anchors'
    || boss.bossPresentationPhaseCue !== 'qa-preview:phase-2'
    || boss.bossCueTiming !== 'enemyBossAnimation:unchanged'
    || boss.bossDetailScale !== '1.00') {
    throw new Error(`Timed out waiting for authored Flagship refinery boss LOD0 preview: ${JSON.stringify(boss)}`);
  }
  if (!boss
    || !['high', 'balanced', 'performance'].includes(boss.tier)
    || !boss.qualityInput.includes('effective:1.00')
    || boss.bossPresentation !== 'authored:enemy-boss-lod0'
    || boss.bossAsset !== 'enemy-boss-lod0'
    || boss.bossRig !== 'articulated+phase-anchors'
    || boss.bossQaPreview !== 'enabled'
    || boss.bossQaQuality !== 'flagship-asset-lock'
    || boss.bossPresentationPhaseCue !== 'qa-preview:phase-2'
    || boss.bossCueTiming !== 'enemyBossAnimation:unchanged'
    || boss.bossDetailScale !== '1.00'
    || boss.enemyTelegraphs !== 'attack+aim+range+boss-pattern+phase'
    || boss.enemyTelegraphOwnership !== 'read-only-presentation'
    || boss.protocolStatusOwnership !== 'read-only-presentation'
    || boss.enemyLifecycleOwnership !== 'read-only-presentation'
    || boss.environmentVisual !== 'authored-refinery-babylon'
    || boss.imageGrade !== 'p28-a5-dark-separation-v1'
    || boss.imageGradeMode !== 'normal'
    || !boss.assetRuntime.includes('cached:')
    || !boss.sceneTelemetry.includes('meshes:')
    || !boss.sceneTelemetry.includes('materials:')) {
    throw new Error(`P28-D8 Flagship boss proof is not deterministic: ${JSON.stringify(boss)}`);
  }

  // Read the same local GLB URL consumed by Babylon. A valid screenshot
  // without the authored heavy hero mesh/maps is not P28-F3 visual evidence.
  const heavyHeroAsset = await evaluate(`(async () => {
    const response = await fetch('/assets/models/bosses/enemy-boss-lod0.glb', { cache: 'force-cache' });
    if (!response.ok) return { error: 'asset HTTP ' + response.status };
    const bytes = await response.arrayBuffer();
    const view = new DataView(bytes);
    if (bytes.byteLength < 28 || view.getUint32(0, true) !== 0x46546c67 ||
        view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) {
      return { error: 'invalid delivered GLB' };
    }
    const length = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length)).trim());
    const payload = json.extras?.ironshadeP28F3HeavyHero;
    const detailNodes = (json.nodes ?? []).filter(node => node.name?.startsWith('boss-p28f3-detail-'));
    const detailMeshes = (json.meshes ?? []).filter(mesh => mesh.name?.startsWith('boss-p28f3-'));
    const maps = (json.images ?? []).filter(image => image.name?.startsWith('boss-f3-'));
    return {
      bytes: bytes.byteLength,
      family: payload?.family ?? null,
      dimensions: payload?.authoredTextureDimensions ?? null,
      visualOnly: payload?.visualOnly ?? null,
      detailNodes: detailNodes.length,
      detailMeshes: detailMeshes.length,
      maps: maps.map(image => image.name),
      weaponSocketPresent: (json.nodes ?? []).some(node => node.name === 'weapon-socket'),
    };
  })()`);
  if (!heavyHeroAsset || heavyHeroAsset.bytes < 150_000 ||
      heavyHeroAsset.family !== 'boss' || heavyHeroAsset.visualOnly !== true ||
      JSON.stringify(heavyHeroAsset.dimensions) !== '[256,256]' ||
      heavyHeroAsset.detailNodes !== 4 || heavyHeroAsset.detailMeshes !== 2 ||
      heavyHeroAsset.maps.length !== 4 || !heavyHeroAsset.weaponSocketPresent) {
    throw new Error('P28-F3 browser-served Flagship boss art is missing: ' + JSON.stringify(heavyHeroAsset));
  }

  const capture = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const png = Buffer.from(capture.data, 'base64');
  if (png.length < 20_000) throw new Error(`P28-D8 boss screenshot is unexpectedly small: ${png.length} bytes`);
  await writeFile(screenshotPath, png);
  await writeFile(reportPath, JSON.stringify({
    viewport: 'desktop',
    visualDetail: 'p28-d8-refinery-boss-lod0',
    captureMode: 'flagship-boss-asset-lock-with-host-adaptive-tier',
    boss,
    heavyHeroAsset,
    screenshot: screenshotPath,
  }, null, 2));

  console.log(`BROWSER_P28D8_BOSS_PASS hostTier=${boss.tier} qaQuality=${boss.bossQaQuality} asset=${boss.bossAsset} rig=${boss.bossRig} phase=${boss.bossPresentationPhaseCue} timing=${boss.bossCueTiming} detail=${boss.bossDetailScale} heavyArt=${heavyHeroAsset.bytes} screenshot=${screenshotPath} bytes=${png.length}`);
} finally {
  socket.close();
}
