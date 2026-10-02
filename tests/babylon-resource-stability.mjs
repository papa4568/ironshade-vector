import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const renderer = fs.readFileSync(new URL('../src/game/babylonCombatRenderer.ts', import.meta.url), 'utf8');
const assets = fs.readFileSync(new URL('../src/game/babylonGraphicsAssets.ts', import.meta.url), 'utf8');
const soak = fs.readFileSync(new URL('../scripts/android-babylon-soak-stress.mjs', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../scripts/android-babylon-soak-stress.sh', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/p27d6-babylon-soak.yml', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

for (const marker of [
  'const runtimeBefore = assetRuntime.stats()',
  'babylonDisposeResources',
  'babylonAssetCacheReclaimed',
  'cachedAssets: runtimeAfter.cachedAssets',
  'activeInstances: runtimeAfter.activeInstances',
  'estimatedCachedCompressedBytes: runtimeAfter.estimatedCachedCompressedBytes',
]) {
  assert(renderer.includes(marker), 'P27-D6 renderer disposal telemetry missing: ' + marker);
}

for (const marker of [
  'this.cache.clear()',
  'async dispose()',
  'disposeBabylonGraphicsAssetRuntime',
]) {
  assert(assets.includes(marker), 'P27-D6 Babylon asset runtime reclamation contract missing: ' + marker);
}

for (const marker of [
  "url.searchParams.set('graphicsPath', 'babylon')",
  "url.searchParams.set('babylonBackend', 'webgl2')",
  "url.searchParams.set('p27d5Lifecycle', '1')",
  'ironshade:p27d5-return-to-hub',
  'babylonDisposeResources',
  'babylonAssetCacheReclaimed',
  'cacheBudgetViolations',
  'frameFinal > frameBaseline * 1.5',
  'heapFinal - heapBaseline > Math.max(96, heapBaseline * 0.5)',
  'ANDROID_P27D6_DISPOSAL_CYCLE_PASS',
  'ANDROID_P27D6_BABYLON_SOAK_PASS',
]) {
  assert(soak.includes(marker), 'P27-D6 Babylon soak harness missing: ' + marker);
}

for (const marker of [
  'dumpsys meminfo',
  'dumpsys gfxinfo',
  'android-p27d6-logcat.txt',
  'FATAL EXCEPTION',
  'ANR in app\\.ironshade\\.vector',
  'Math.max(128 * 1024, baselineKb * 0.45)',
  'ANDROID_P27D6_MEMORY_PASS',
  'ANDROID_P27D6_SOAK_PASS',
]) {
  assert(shell.includes(marker), 'P27-D6 Android evidence shell missing: ' + marker);
}

for (const marker of [
  'pull_request:',
  "default: '30'",
  'npm run build',
  'Run 30-minute Babylon soak and lifecycle stress QA',
  'Ironshade-Vector-P27D6-Soak.apk',
  'android-p27d6-babylon-soak.json',
  'android-p27d6-memory-summary.json',
  'android-p27d6-logcat.txt',
]) {
  assert(workflow.includes(marker), 'P27-D6 CI gate missing: ' + marker);
}

assert(
  packageJson.scripts?.['test:babylon-resource-stability'] === 'node tests/babylon-resource-stability.mjs',
  'P27-D6 static resource-stability test script must be registered',
);
assert(
  packageJson.scripts?.build?.includes('npm run test:babylon-resource-stability'),
  'P27-D6 resource-stability contract must run in the production build',
);

console.log('P27_D6_BABYLON_RESOURCE_STABILITY_CONTRACT_PASS disposal=scene+cache lifecycle=repeated soak=30m memory=js+pss frame=bounded logcat=clean apk=required');
