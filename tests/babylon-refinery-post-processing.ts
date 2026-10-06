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
  supportsBabylonRefinerySsao2,
} from '../src/game/babylonRefineryPostProcessing';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';

const highSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 1, 'flagship');
const balancedSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.72, 'adaptive');
const performanceSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.5, 'performance');

const high = resolveBabylonRefineryPostProcessingBudget(highSnapshot);
const highLowVisibility = resolveBabylonRefineryPostProcessingBudget(highSnapshot, true);
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
assert(high.exposureScale > balanced.exposureScale && balanced.exposureScale > performance.exposureScale);
assert(high.exposureScale > 1 && high.exposureScale <= 1.055);
assert(highLowVisibility.exposureScale > high.exposureScale && highLowVisibility.exposureScale <= 1.08);
assert(high.contrast < balanced.contrast && balanced.contrast < performance.contrast);
assert(highLowVisibility.contrast < high.contrast && highLowVisibility.contrast >= 0.965);
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

const unsupportedMrtScene = {
  getEngine: () => ({}),
} as unknown as Pick<Scene, 'getEngine'>;
assert.equal(
  supportsBabylonRefinerySsao2(unsupportedMrtScene),
  false,
  'SSAO2 must fall back before pipeline creation when the active engine does not expose MRT creation.',
);

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
runtimeScene.imageProcessingConfiguration.exposure = 1.02;
runtimeScene.imageProcessingConfiguration.contrast = 1;
runtimeScene.activeCamera = new FreeCamera('p28-a5-test-camera', new Vector3(0, 8, 8), runtimeScene);
const runtimeCanvas = { dataset: { graphicsPathSelection: 'qa-explicit' } } as unknown as HTMLCanvasElement;
const runtimePost = new BabylonRefineryPostProcessing(runtimeScene, runtimeCanvas);
runtimePost.sync(false, highSnapshot);
const normalExposure = runtimeScene.imageProcessingConfiguration.exposure;
const normalContrast = runtimeScene.imageProcessingConfiguration.contrast;
assert(normalExposure > 1.02 && normalExposure <= 1.02 * 1.055 + 1e-6, 'Flagship grade must lift dark values without unbounded exposure.');
assert(normalContrast < 1 && normalContrast >= 0.985, 'Flagship grade must ease contrast instead of crushing shadows.');
assert.match(runtimeCanvas.dataset.environmentPostTone ?? '', /^aces-exposure-\d+\.\d{2}\+contrast-\d+\.\d{2}$/);
assert.equal(runtimeCanvas.dataset.environmentImageGrade, 'p28-a5-dark-separation-v1');
assert.equal(runtimeCanvas.dataset.environmentImageGradeMode, 'normal');

runtimePost.sync(false, highSnapshot);
assert.equal(runtimeScene.imageProcessingConfiguration.exposure, normalExposure, 'Repeated post sync must not compound exposure.');
assert.equal(runtimeScene.imageProcessingConfiguration.contrast, normalContrast, 'Repeated post sync must not compound contrast.');

runtimeCanvas.dataset.refineryImageGradeQa = 'low-visibility';
runtimePost.sync(false, highSnapshot);
const lowVisibilityExposure = runtimeScene.imageProcessingConfiguration.exposure;
const lowVisibilityContrast = runtimeScene.imageProcessingConfiguration.contrast;
assert(lowVisibilityExposure > normalExposure && lowVisibilityExposure <= 1.02 * 1.08 + 1e-6, 'Low-visibility grade must reveal dark form while staying bounded.');
assert(lowVisibilityContrast < normalContrast && lowVisibilityContrast >= 0.965, 'Low-visibility contrast must preserve additional dark-value separation.');
assert.match(runtimeCanvas.dataset.environmentAtmosphere ?? '', /near-14\.0:far-32\.0:.*exposure-1\.080:contrast-0\.965:grade-p28-a5-dark-separation-v1$/);
assert.equal(runtimeCanvas.dataset.environmentImageGrade, 'p28-a5-dark-separation-v1');
assert.equal(runtimeCanvas.dataset.environmentImageGradeMode, 'low-visibility');

delete runtimeCanvas.dataset.refineryImageGradeQa;
runtimePost.sync(true, highSnapshot);
assert.equal(runtimeScene.imageProcessingConfiguration.exposure, lowVisibilityExposure, 'Real low-visibility contracts must match the deterministic QA capture grade.');
assert.equal(runtimeScene.imageProcessingConfiguration.contrast, lowVisibilityContrast, 'Real low-visibility contracts must match the deterministic QA capture contrast.');

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
assert.equal(runtimeScene.imageProcessingConfiguration.exposure, 1.02, 'QA baseline must restore upstream exposure.');
assert.equal(runtimeScene.imageProcessingConfiguration.contrast, 1, 'QA baseline must restore upstream contrast.');

runtimeCanvas.dataset.refineryPostStackQa = 'on';
runtimePost.sync(false, highSnapshot);
assert.match(runtimeCanvas.dataset.environmentSsao2 ?? '', /^(primary:refinery-ssao2-v1:|off:unsupported\+fallback-contact$)/);
assert.equal(runtimeCanvas.dataset.babylonPostStack, 'on:qa-explicit');
assert.equal(runtimeCanvas.dataset.environmentImageGradeMode, 'normal');
assert.equal(runtimeScene.imageProcessingConfiguration.exposure, normalExposure, 'Re-enabling the stack must reproduce the same deterministic grade.');
assert.equal(runtimeScene.imageProcessingConfiguration.contrast, normalContrast, 'Re-enabling the stack must reproduce the same deterministic contrast.');

runtimePost.release('test-scenario-exit');
assert.equal(runtimeCanvas.dataset.environmentSsao2, undefined);
assert.equal(runtimeCanvas.dataset.babylonPostStack, undefined);
assert.equal(runtimeCanvas.dataset.environmentImageGrade, undefined);
assert.equal(runtimeCanvas.dataset.environmentImageGradeMode, undefined);
assert.equal(runtimeScene.imageProcessingConfiguration.exposure, 1.02, 'Scenario exit must restore upstream exposure.');
assert.equal(runtimeScene.imageProcessingConfiguration.contrast, 1, 'Scenario exit must restore upstream contrast.');
runtimePost.sync(false, highSnapshot);
assert.match(runtimeCanvas.dataset.environmentSsao2 ?? '', /^(primary:refinery-ssao2-v1:|off:unsupported\+fallback-contact$)/);
assert.equal(runtimeCanvas.dataset.babylonPostStack, 'on:qa-explicit');
assert.equal(runtimeCanvas.dataset.environmentImageGrade, 'p28-a5-dark-separation-v1');
assert.equal(runtimeCanvas.dataset.environmentImageGradeMode, 'normal');
assert.equal(runtimeScene.imageProcessingConfiguration.exposure, normalExposure, 'Scenario re-entry must reproduce the same deterministic exposure.');
assert.equal(runtimeScene.imageProcessingConfiguration.contrast, normalContrast, 'Scenario re-entry must reproduce the same deterministic contrast.');
runtimePost.dispose();
runtimeScene.dispose();
runtimeEngine.dispose();

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const postSource = readFileSync('src/game/babylonRefineryPostProcessing.ts', 'utf8');
const bloomSource = readFileSync('src/game/refineryBloomProfile.ts', 'utf8');
const browserSource = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const gradeCaptureSource = readFileSync('scripts/p28a5-image-grade-capture.mjs', 'utf8');
const gradeWorkflowSource = readFileSync('.github/workflows/p28-image-grade-visual.yml', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');

assert.match(rendererSource, /new BabylonRefineryPostProcessing\(scene, canvas\)/);
assert.match(rendererSource, /this\.refineryPostProcessing\.sync\(mission\.conditions\.includes\('low-visibility'\), budget\)/);
assert.match(rendererSource, /this\.refineryPostProcessing\.release\('scenario-exit'\)/);
assert.match(rendererSource, /this\.refineryPostProcessing\.dispose\(\)/);
assert.match(postSource, /SSAO2RenderingPipeline/);
assert.match(postSource, /new SSAO2RenderingPipeline\(/);
assert.match(postSource, /supportsBabylonRefinerySsao2\(this\.scene\)/);
assert.match(postSource, /typeof engine\.createMultipleRenderTarget === 'function'/);
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
assert.match(postSource, /refineryAtmosphereContrast\(lowVisibility, budget\.refineryAtmosphereScale\)/);
assert.match(postSource, /resolveBabylonRefineryPostProcessingBudget\(renderBudget, effectiveLowVisibility\)/);
assert.match(postSource, /this\.captureUpstreamImageProcessing\(\)/);
assert.match(postSource, /this\.restoreUpstreamImageProcessing\(\)/);
assert.match(postSource, /dataset\.refineryImageGradeQa === 'low-visibility'/);
assert.match(postSource, /environmentImageGrade = REFINERY_ATMOSPHERE_PROFILE\.gradeId/);
assert.match(postSource, /environmentImageGradeMode = effectiveLowVisibility \? 'low-visibility' : 'normal'/);
assert.match(postSource, /dataset\.refineryPostStackQa === 'off'/);
assert.match(postSource, /critical:hazards\+telegraphs\+class-cues@/);
assert.match(postSource, /environmentP21Budget/);
assert.match(bloomSource, /REFINERY_BLOOM_PROFILE/, 'Babylon bloom must use the engine-neutral bloom profile.');
assert.match(browserSource, /BROWSER_P27B12_BABYLON_POST_PROCESSING_PASS/);
assert.match(browserSource, /p27b12-stack-off/);
assert.match(browserSource, /p27b12-stack-on/);
assert.match(browserSource, /pngByteDifferenceRatio/);
assert.match(gradeCaptureSource, /BROWSER_P28A5_IMAGE_GRADE_PASS/);
assert.match(gradeCaptureSource, /refineryImageGradeQa = 'low-visibility'/);
assert.match(gradeCaptureSource, /Page\.captureScreenshot/);
assert.match(gradeWorkflowSource, /name: P28 Image Grade Visual/);
assert.match(gradeWorkflowSource, /browser-p28a5-low-visibility\.png/);
assert.match(packageSource, /test:babylon-refinery-post-processing/);

console.log(`P28_A5_REFINERY_IMAGE_GRADE_PASS normal=exposure-${normalExposure.toFixed(3)}+contrast-${normalContrast.toFixed(3)} low-visibility=exposure-${lowVisibilityExposure.toFixed(3)}+contrast-${lowVisibilityContrast.toFixed(3)} repeat=stable release=restored capture=qa-flagship cues=1.00 aces=bounded`);
console.log('P28_A3_BABYLON_SSAO2_PASS primary=high+balanced fallback=performance-or-unsupported+mrt-missing samples=16>8>off cues=1.00 lifecycle=qa-off+on+release+reentry telemetry=p27-compatible captures=p27b12-stack-off+stack-on');