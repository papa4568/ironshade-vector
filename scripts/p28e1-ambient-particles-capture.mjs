import { writeFile } from 'node:fs/promises';

const cdpBase = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9223';
const screenshotPath = process.env.BROWSER_E2E_P28E1_AMBIENT_SCREENSHOT ?? 'browser-p28e1-ambient.png';
const reportPath = process.env.BROWSER_E2E_P28E1_AMBIENT_REPORT ?? 'browser-p28e1-ambient.json';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (typeof WebSocket !== 'function') {
  throw new Error('P28-E2 capture requires Node 22+ global WebSocket support.');
}

const targets = await fetch(`${cdpBase}/json`).then(response => response.json());
const page = targets.find(target => target.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error('No Chrome page target is available for the P28-E2 refinery ambient capture.');

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

const readAmbientStateExpression = `(() => {
  const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  const rect = canvas.getBoundingClientRect();
  return {
    state: canvas.dataset.babylonAmbientParticleState ?? '',
    mode: canvas.dataset.babylonAmbientParticles ?? '',
    location: canvas.dataset.babylonAmbientParticleLocation ?? '',
    counts: canvas.dataset.babylonAmbientParticleCounts ?? '',
    poolSize: canvas.dataset.babylonAmbientParticlePoolSize ?? '',
    drawFamilies: canvas.dataset.babylonAmbientParticleDrawFamilies ?? '',
    runtimeTier: canvas.dataset.babylonAmbientParticleRuntimeTier ?? '',
    hostTier: canvas.dataset.babylonAmbientParticleHostTier ?? '',
    scale: canvas.dataset.babylonAmbientParticleScale ?? '',
    cuePolicy: canvas.dataset.babylonAmbientGameplayCuePolicy ?? '',
    ownership: canvas.dataset.babylonAmbientParticleSimulationOwnership ?? '',
    artDirection: canvas.dataset.babylonAmbientParticleArtDirection ?? '',
    artDirectionZones: canvas.dataset.babylonAmbientParticleZones ?? '',
    cueClearance: canvas.dataset.babylonAmbientParticleCueClearance ?? '',
    telegraphs: canvas.dataset.babylonEnemyTelegraphs ?? '',
    telegraphOwnership: canvas.dataset.babylonEnemyTelegraphSimulationOwnership ?? '',
    protocolOwnership: canvas.dataset.babylonProtocolStatusSimulationOwnership ?? '',
    lifecycleOwnership: canvas.dataset.babylonEnemyLifecycleSimulationOwnership ?? '',
    environmentVisual: canvas.dataset.environmentVisual ?? '',
    qualityInput: canvas.dataset.renderQualityInput ?? '',
    sceneTelemetry: canvas.dataset.babylonSceneTelemetry ?? '',
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
})()`;

function parseCounts(value) {
  return Object.fromEntries(String(value).split('|').map(part => {
    const [kind, counts] = part.split(':');
    const [active, pooled] = String(counts).split('/').map(Number);
    return [kind, { active, pooled }];
  }));
}

try {
  await call('Runtime.enable');
  await call('Page.enable');
  const deadline = Date.now() + 30_000;
  let ambient = null;
  while (Date.now() < deadline) {
    ambient = await evaluate(readAmbientStateExpression);
    const counts = ambient ? parseCounts(ambient.counts) : {};
    if (ambient
      && ambient.state === 'active'
      && ambient.mode === 'pooled:dust+sparks+vapor+debris'
      && ambient.location === 'asteroid-refinery'
      && ambient.poolSize === '240'
      && ambient.drawFamilies === '4'
      && ambient.cuePolicy === 'independent:1.00'
      && ambient.ownership === 'read-only-presentation'
      && ambient.artDirection === 'refinery-industrial-v1'
      && ambient.artDirectionZones === '21:damaged-service+machinery+open-industrial+vents'
      && ambient.cueClearance === 'center:x38-62+z38-62+presentation-only'
      && counts.dust?.pooled === 128
      && counts.sparks?.pooled === 48
      && counts.vapor?.pooled === 24
      && counts.debris?.pooled === 40
      && counts.dust.active > 0
      && counts.sparks.active > 0
      && counts.vapor.active > 0
      && counts.debris.active > 0) break;
    await sleep(100);
  }

  const counts = ambient ? parseCounts(ambient.counts) : {};
  if (!ambient
    || ambient.state !== 'active'
    || ambient.mode !== 'pooled:dust+sparks+vapor+debris'
    || ambient.location !== 'asteroid-refinery'
    || ambient.poolSize !== '240'
    || ambient.drawFamilies !== '4'
    || ambient.cuePolicy !== 'independent:1.00'
    || ambient.ownership !== 'read-only-presentation'
    || ambient.artDirection !== 'refinery-industrial-v1'
    || ambient.artDirectionZones !== '21:damaged-service+machinery+open-industrial+vents'
    || ambient.cueClearance !== 'center:x38-62+z38-62+presentation-only'
    || !['high', 'balanced', 'performance'].includes(ambient.runtimeTier)
    || !['high', 'balanced', 'performance'].includes(ambient.hostTier)
    || counts.dust?.pooled !== 128
    || counts.sparks?.pooled !== 48
    || counts.vapor?.pooled !== 24
    || counts.debris?.pooled !== 40
    || counts.dust.active <= 0
    || counts.sparks.active <= 0
    || counts.vapor.active <= 0
    || counts.debris.active <= 0
    || ambient.telegraphs !== 'attack+aim+range+boss-pattern+phase'
    || ambient.telegraphOwnership !== 'read-only-presentation'
    || ambient.protocolOwnership !== 'read-only-presentation'
    || ambient.lifecycleOwnership !== 'read-only-presentation'
    || ambient.environmentVisual !== 'authored-refinery-babylon'
    || !ambient.qualityInput.includes('effective:1.00')
    || !ambient.sceneTelemetry.includes('meshes:')
    || !ambient.sceneTelemetry.includes('materials:')) {
    throw new Error(`P28-E2 refinery ambient proof is not deterministic: ${JSON.stringify(ambient)}`);
  }

  const capture = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const png = Buffer.from(capture.data, 'base64');
  if (png.length < 20_000) throw new Error(`P28-E2 refinery ambient screenshot is unexpectedly small: ${png.length} bytes`);
  await writeFile(screenshotPath, png);
  await writeFile(reportPath, JSON.stringify({
    viewport: 'desktop',
    visualDetail: 'p28-e2-refinery-ambient-art-direction',
    captureMode: 'flagship-refinery-zones-with-production-runtime-pressure',
    ambient,
    parsedCounts: counts,
    screenshot: screenshotPath,
    screenshotBytes: png.length,
  }, null, 2));

  console.log(`BROWSER_P28E2_REFINERY_AMBIENT_PASS artDirection=${ambient.artDirection} zones=${ambient.artDirectionZones} clearance=${ambient.cueClearance} runtimeTier=${ambient.runtimeTier} hostTier=${ambient.hostTier} scale=${ambient.scale} counts=${ambient.counts} pool=${ambient.poolSize} families=${ambient.drawFamilies} cues=${ambient.cuePolicy} screenshot=${screenshotPath} bytes=${png.length}`);
} finally {
  socket.close();
}
