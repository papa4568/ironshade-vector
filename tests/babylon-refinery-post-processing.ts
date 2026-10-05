import assert from 'node:assert/strict';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { readFileSync } from 'node:fs';
import {
  BabylonRefineryPostProcessing,
  isBabylonRefineryBloomSourceName,
  resolveBabylonRefineryPostProcessingBudget,
} from '../src/game/babylonRefineryPostProcessing';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';

const highSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 1, 'flagship');
const balancedSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.72, 'adaptive');
const performanceSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.5, 'performance');

const high = resolveBabylonRefineryPostProcessingBudget(highSnapshot);
const balanced = resolveBabylonRefineryPostProcessingBudget(balancedSnapshot);
const performance = resolveBabylonRefineryPostProcessingBudget(performanceSnapshot);

assert.equal(high.ssaoEnabled, true);
assert.equal(balanced.ssaoEnabled, true);
assert.equal(performance.ssaoEnabled, false);
assert.deepEqual(
  [high.ssaoSamples, balanced.ssaoSamples, performance.ssaoSamples],
  [16, 8, 0],
  'SSAO2 sampling must preserve the richest treatment on Flagship and disable under Performance pressure.',
);
assert(high.ssaoStrength > balanced.ssaoStrength && balanced.ssaoStrength > performance.ssaoStrength);
assert(high.ssaoRadius > balanced.ssaoRadius && balanced.ssaoRadius > performance.ssaoRadius);
assert.equal(high.bloomEnabled, true);
assert.equal(balanced.bloomEnabled, true);
assert.equal(performance.bloomEnabled, false);
assert(high.bloomStrength > balanced.bloomStrength && balanced.bloomStrength > performance.bloomStrength);
assert.deepEqual(
  [high.contactDepthCount, balanced.contactDepthCount, performance.contactDepthCount],
  [10, 7, 4],
  'Contact-card budget remains available only as SSAO2 fallback capacity.',
);
assert.equal(high.atmosphereEnabled, true);
assert.equal(balanced.atmosphereEnabled, true);
assert.equal(performance.atmosphereEnabled, false);
assert(high.atmosphereNear < balanced.atmosphereNear && balanced.atmosphereNear < performance.atmosphereNear);
assert(high.atmosphereFar < balanced.atmosphereFar && balanced.atmosphereFar < performance.atmosphereFar);
assert(high.exposureScale < balanced.exposureScale && balanced.exposureScale < performance.exposureScale);
assert.equal(performance.gameplayCueScale, 1, 'Performance must preserve gameplay-critical cue strength.');

for (const source of [
  'refinery-processor-lod1:processor-shell',
  'refinery-terminal-lod2:terminal-screen',
  'p27-b6-muzzle-flash',
  'p27-b6-muzzle-core',
]) {
  assert.equal(isBabylonRefineryBloomSourceName(source), true, 'Expected selective Babylon bloom source: ' + source);
}
for (const protectedName of [
  'enemy-assault-lod1:head',
  'p27-b8-enemy-telegraph-ring',
  'p27-b5-hazard-ring',
  'p27-b5-objective-guide',
  'p27-b5-loot-beam',
  'interactable-control-terminal-lod1:screen',
  'p27-b9-protocol-status-ring',
  'p27-b10-lifecycle-target-ring',
]) {
  assert.equal(isBabylonRefineryBloomSourceName(protectedName), false, 'Gameplay cue leaked into selective bloom: ' + protectedName);
}

const adaptive = new AdaptiveRenderBudget(false);
let adaptiveSnapshot = adaptive.sample(1000 / 60, 1, 'adaptive');
for (let index = 0; index < 180; index += 1) adaptiveSnapshot = adaptive.sample(38, 1, 'adaptive');
assert.equal(adaptiveSnapshot.tierName, 'performance', 'Sustained pressure must degrade Babylon post-processing to Performance.');
const degraded = resolveBabylonRefineryPostProcessingBudget(adaptiveSnapshot);
assert.equal(degraded.ssaoEnabled, false);
assert.equal(degraded.bloomEnabled, false);
assert.equal(degraded.atmosphereEnabled, false);
assert.equal(degraded.gameplayCueScale, 1);
for (let index = 0; index < 1400; index += 1) adaptiveSnapshot = adaptive.sample(16, 1, 'adaptive');
assert.equal(adaptiveSnapshot.tierName, 'high', 'Sustained frame headroom must recover Babylon post-processing to High.');
assert.equal(
  resolveBabylonRefineryPostProcessingBudget(adaptiveSnapshot).ssaoEnabled,
  true,
  'SSAO2 must recover when adaptive frame pressure clears.',
);

const runtimeEngine = new NullEngine({ renderWidth: 640, renderHeight: 360 });
const runtimeScene = new Scene(runtimeEngine);
runtimeScene.activeCamera = new FreeCamera('p28-a3-test-camera', new Vector3(0, 8, 8), runtimeScene);
const runtimeCanvas = { dataset: { graphicsPathSelection: 'qa-explicit' } } as unknown as HTMLCanvasElement;
const runtimePost = new BabylonRefineryPostProcessing(runtimeScene, runtimeCanvas);
runtimePost.sync(false, highSnapshot);
assert.match(runtimeCanvas.dataset.environmentSsao2 ?? '', /^(primary:refinery-ssao2-v1:|off:unsupported\+fallback-contact$)/);
if (runtimeCanvas.dataset.environmentSsao2?.startsWith('primary:')) {
  assert.match(runtimeCanvas.dataset.environmentContactDepth ?? '', /^grounding:refinery-contact-grounding-v1:instances-0:.*:fallback-idle:ssao2-primary$/);
} else {
  assert.match(runtimeCanvas.dataset.environmentContactDepth ?? '', /^grounding:refinery-contact-grounding-v1:/);
}
assert.match(runtimeCanvas.dataset.environmentBloom ?? '', /^selective:refinery-selective-v1:|^off:awaiting-authored-emissives$/);
assert.match(runtimeCanvas.dataset.environmentAtmosphere ?? '', /^fog:refinery-depth-atmosphere-v1:/);
assert.equal(runtimeCanvas.dataset.babylonPostStack, 'on:qa-explicit');
assert.match(runtimeCanvas.dataset.babylonPostBudget ?? '', /^tier:(high|balanced|performance)\|bloom:/);
assert.match(runtimeCanvas.dataset.effectPriority ?? '', /secondary:bloom\+contact-depth\+atmosphere@/);

runtimeCanvas.dataset.refineryPostStackQa = 'off';
runtimePost.sync(false, highSnapshot);
assert.equal(runtimeCanvas.dataset.environmentSsao2, 'off:qa-baseline');
assert.equal(runtimeCanvas.dataset.environmentContactDepth, 'off:qa-baseline');
assert.equal(runtimeCanvas.dataset.babylonPostStack, 'off:qa-baseline');

runtimeCanvas.dataset.refineryPostStackQa = 'on';
runtimePost.sync(false, highSnapshot);
assert.match(runtimeCanvas.dataset.environmentSsao2 ?? '', /^(primary:refinery-ssao2-v1:|off:unsupported\+fallback-contact$)/);
assert.equal(runtimeCanvas.dataset.babylonPostStack, 'on:qa-explicit');

runtimePost.release('test-scenario-exit');
assert.equal(runtimeCanvas.dataset.environmentSsao2, undefined);
assert.equal(runtimeCanvas.dataset.babylonPostStack, undefined);
runtimePost.sync(false, highSnapshot);
assert.match(runtimeCanvas.dataset.environmentSsao2 ?? '', /^(primary:refinery-ssao2-v1:|off:unsupported\+fallback-contact$)/);
assert.equal(runtimeCanvas.dataset.babylonPostStack, 'on:qa-explicit');
runtimePost.dispose();
runtimeScene.dispose();
runtimeEngine.dispose();

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const postSource = readFileSync('src/game/babylonRefineryPostProcessing.ts', 'utf8');
const bloomSource = readFileSync('src/game/refineryBloomProfile.ts', 'utf8');
const browserSource = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');

assert.match(rendererSource, /new BabylonRefineryPostProcessing\(scene, canvas\)/);
assert.match(rendererSource, /this\.refineryPostProcessing\.sync\(mission\.conditions\.includes\('low-visibility'\), budget\)/);
assert.match(rendererSource, /this\.refineryPostProcessing\.release\('scenario-exit'\)/);
assert.match(rendererSource, /this\.refineryPostProcessing\.dispose\(\)/);
assert.match(postSource, /SSAO2RenderingPipeline/);
assert.match(postSource, /new SSAO2RenderingPipeline\(/);
assert.match(postSource, /attachCamerasToRenderPipeline\(/);
assert.match(postSource, /detachCamerasFromRenderPipeline\(/);
assert.match(postSource, /samples = budget\.ssaoSamples/);
assert.match(postSource, /environmentSsao2/);
assert.match(postSource, /fallback-idle:ssao2-primary/);
assert.match(postSource, /stackEnabled && !ssaoEnabled \? budget\.contactDepthCount : 0/);
assert.match(postSource, /refineryContactDepthTelemetry\(0\) \+ ':fallback-idle:ssao2-primary'/);
assert.match(postSource, /new GlowLayer\('p27-b12-refinery-selective-bloom'/);
assert.match(postSource, /excludeByDefault: true/);
assert.match(postSource, /this\.glow\.addIncludedOnlyMesh\(mesh\)/);
assert.match(postSource, /RawTexture\.CreateRGBATexture\(/);
assert.match(postSource, /source\.createInstance\('p27-b12-refinery-contact-'/);
assert.match(postSource, /Scene\.FOGMODE_LINEAR/);
assert.match(postSource, /imageProcessingConfiguration\.contrast/);
assert.match(postSource, /dataset\.refineryPostStackQa === 'off'/);
assert.match(postSource, /critical:hazards\+telegraphs\+class-cues@/);
assert.match(postSource, /environmentP21Budget/);
assert.match(bloomSource, /REFINERY_BLOOM_PROFILE/, 'Babylon bloom must use the engine-neutral bloom profile.');
assert.match(browserSource, /BROWSER_P27B12_BABYLON_POST_PROCESSING_PASS/);
assert.match(browserSource, /p27b12-stack-off/);
assert.match(browserSource, /p27b12-stack-on/);
assert.match(browserSource, /pngByteDifferenceRatio/);
assert.match(packageSource, /test:babylon-refinery-post-processing/);

console.log('P28_A3_BABYLON_SSAO2_PASS primary=high+balanced fallback=performance-or-unsupported samples=16>8>off cues=1.00 lifecycle=qa-off+on+release+reentry telemetry=p27-compatible captures=p27b12-stack-off+stack-on');
