import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPERATOR_ASSET_FAMILY, SHOWCASE_REFINERY_MODULE_FAMILY } from '../src/game/graphicsAssetManifest';
import { selectGraphicsAssetSpec } from '../src/game/graphicsAssets';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';
import { babylonEffectivePixelRatio } from '../src/game/babylonRenderResolution';
import { babylonRenderPacingIntervalMs, shouldSubmitBabylonFrame } from '../src/game/babylonRenderPacing';
import { babylonBootstrapFrameSample, babylonBootstrapPacingIntervalMs } from '../src/game/babylonRenderBootstrap';
import { runtimeAnimationStride } from '../src/game/runtimeScalability';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
const assetRuntimeSource = readFileSync(resolve(process.cwd(), 'src/game/babylonGraphicsAssets.ts'), 'utf8');
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');

const high = new AdaptiveRenderBudget(false).sample(16.7, 1, 'flagship');
const phoneDefault = new AdaptiveRenderBudget(true).sample(16.7, 1, 'adaptive');
const balancedBudget = new AdaptiveRenderBudget(true);
let balanced = balancedBudget.sample(16.7, 1, 'adaptive');
for (let frame = 0; frame < 90 && balanced.tierName === 'high'; frame += 1) {
  balanced = balancedBudget.sample(30, 1, 'adaptive');
}
const performance = new AdaptiveRenderBudget(false).sample(16.7, 1, 'performance');

assert(phoneDefault.tierName === 'high', 'P28-A0 coarse/mobile input must start at the flagship High baseline before measured frame pressure');
assert(high.tierName === 'high' && balanced.tierName === 'balanced' && performance.tierName === 'performance', 'P27-D3 must retain deterministic High/Balanced/Performance tiers through flagship selection, measured pressure, and explicit Performance mode');
assert(high.pixelRatioScale > balanced.pixelRatioScale && balanced.pixelRatioScale > performance.pixelRatioScale, 'Babylon hardware scaling budget must decrease each tier');
assert(babylonEffectivePixelRatio(1, 1, high.pixelRatioScale) === 1, 'P28-F5 healthy High quality must retain full 1x raster.');
assert(Math.abs(babylonEffectivePixelRatio(1, 1, balanced.pixelRatioScale) - 0.84) < 1e-8, 'P28-F5 measured Balanced pressure must reduce actual 1x raster.');
assert(Math.abs(babylonEffectivePixelRatio(1, 1, performance.pixelRatioScale) - 0.76) < 1e-8, 'P28-F5 measured Performance pressure must reduce actual 1x raster.');
assert(Math.abs(babylonEffectivePixelRatio(1, 3, high.pixelRatioScale) - 1.8) < 1e-8, 'P28-F5 healthy High quality must preserve 3x flagship raster ceiling.');
assert(Math.abs(babylonEffectivePixelRatio(1, 3, performance.pixelRatioScale) - 1.224) < 1e-8, 'P28-F5 Performance must retain adaptive scale on high-density devices.');
assert(Number.isFinite(babylonEffectivePixelRatio(1, Number.NaN, performance.pixelRatioScale)), 'P28-F5 invalid device ratio must fail safe without breaking rendering.');

assert(babylonBootstrapFrameSample(180, true, ['loading', 'ready', 'ready']) === 1000 / 60,
  'P28-F5 first refinery shell must not downgrade quality because of temporary decode stalls.');
assert(babylonBootstrapFrameSample(90, true, ['ready', 'loading', 'ready']) === 1000 / 60
  && babylonBootstrapFrameSample(90, true, ['ready', 'ready', 'loading']) === 1000 / 60,
  'P28-F5 operator and enemy catalog startup must retain initial High-detail asset selection.');
assert(babylonBootstrapFrameSample(90, true, ['ready', 'ready', 'ready']) === 90
  && babylonBootstrapFrameSample(90, true, ['error', 'ready', 'ready']) === 90
  && babylonBootstrapFrameSample(90, false, ['loading', 'loading', 'loading']) === 90,
  'P28-F5 real sustained pressure, failed loads, and other missions must retain unmodified adaptive recovery.');
assert(rendererSource.includes('babylonBootstrapFrameSample(frameMs, mission.location'),
  'P28-F5 runtime must sample asset bootstrap state only before selecting refinery authored LOD.');

assert(babylonBootstrapPacingIntervalMs(true, ['loading', 'ready', 'ready']) === 120
  && babylonBootstrapPacingIntervalMs(true, ['ready', 'loading', 'ready']) === 120
  && babylonBootstrapPacingIntervalMs(true, [undefined, 'ready', 'loading']) === 120,
  'P28-F5 pending authored refinery GLBs must yield GPU submission without changing High LOD selection.');
assert(babylonBootstrapPacingIntervalMs(true, ['loading', 'ready', 'ready'], 125) === 240
  && babylonBootstrapPacingIntervalMs(true, ['ready', 'loading', 'ready'], 90) === 240
  && babylonBootstrapPacingIntervalMs(true, ['loading', 'ready', 'ready'], 3_000) === 120,
  'P28-F5 measured 90ms+ asset-bootstrap frames must yield more GPU time without treating app suspend as sustained load.');
assert(babylonBootstrapPacingIntervalMs(true, ['ready', 'ready', 'ready']) === 0
  && babylonBootstrapPacingIntervalMs(true, ['error', 'ready', 'ready']) === 0
  && babylonBootstrapPacingIntervalMs(false, ['loading', 'loading', 'loading']) === 0,
  'P28-F5 must stop bootstrap pacing when ready/error and preserve other missions.');
assert(babylonRenderPacingIntervalMs(high) === 0 && babylonRenderPacingIntervalMs(balanced) === 0,
  'P28-F5 healthy High and Balanced tiers must never pace GPU submissions.');
assert(babylonRenderPacingIntervalMs(performance) === 0,
  'P28-F5 explicit Performance mode without measured pressure must render every frame.');
const severe = { tierName: 'performance' as const, smoothedFrameMs: 64 };
assert(babylonRenderPacingIntervalMs({ tierName: 'performance', smoothedFrameMs: 110 }) === 240,
  'P28-F5 catastrophic Performance-tier rendering must leave enough time for Android touch dispatch.');
assert(babylonRenderPacingIntervalMs(severe) === 120,
  'P28-F5 sustained severe frame pressure must reduce GPU submission duty cycle.');
assert(shouldSubmitBabylonFrame(1000, 0, 120)
  && !shouldSubmitBabylonFrame(1090, 1000, 120)
  && shouldSubmitBabylonFrame(1120, 1000, 120)
  && shouldSubmitBabylonFrame(1010, 1000, 0),
  'P28-F5 paced GPU submissions must retain a first frame and always render under healthy budgets.');
assert(shouldSubmitBabylonFrame(100, 1000, 120),
  'P28-F5 suspended clock reset must not leave render submission stopped.');
assert(rendererSource.includes('Math.max(babylonRenderPacingIntervalMs(budget), babylonBootstrapPacingIntervalMs(true, [')
  && rendererSource.includes('this.syncCamera(state, width / Math.max(1, height), cameraFeedback);')
  && rendererSource.includes('this.scene.render();'),
  'P28-F5 pacing must be restricted to refinery rendering and preserve scene submission.');

assert(high.detailScale > balanced.detailScale && balanced.detailScale > performance.detailScale, 'Babylon authored detail budget must decrease each tier');
assert(high.assetCacheCompressedByteBudget > balanced.assetCacheCompressedByteBudget && balanced.assetCacheCompressedByteBudget > performance.assetCacheCompressedByteBudget, 'Babylon cache byte budget must decrease each tier');
assert(high.assetCacheEntryBudget === 32 && balanced.assetCacheEntryBudget === 24 && performance.assetCacheEntryBudget === 20, 'Babylon cached resource count budget must be explicit per tier');
assert(high.textureAnisotropy === 4 && balanced.textureAnisotropy === 2 && performance.textureAnisotropy === 1, 'Babylon texture sampling cost must decrease each tier');

const highOperator = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, high.detailScale);
const balancedOperator = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, balanced.detailScale);
const performanceOperator = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, performance.detailScale);
const performanceRefinery = selectGraphicsAssetSpec(SHOWCASE_REFINERY_MODULE_FAMILY, performance.detailScale);
assert(highOperator?.lod === 1 && balancedOperator?.lod === 1 && performanceOperator?.lod === 2, 'Babylon authored operator selection must fall to shipped LOD2 at Performance');
assert(performanceRefinery?.lod === 2, 'Babylon authored environment selection must fall to shipped LOD2 at Performance');

const animationHigh = runtimeAnimationStride({ tier: 'high', role: 'assault', distance: 40, targeted: false, criticalCue: false });
const animationBalanced = runtimeAnimationStride({ tier: 'balanced', role: 'assault', distance: 40, targeted: false, criticalCue: false });
const animationPerformance = runtimeAnimationStride({ tier: 'performance', role: 'assault', distance: 40, targeted: false, criticalCue: false });
assert(animationHigh === 1 && animationBalanced === 2 && animationPerformance === 3, 'Babylon far noncritical authored animation must scale 1/2/3 frames by tier');
assert(runtimeAnimationStride({ tier: 'performance', role: 'assault', distance: 40, targeted: true, criticalCue: false }) === 1, 'targeted enemies must remain full-cadence');
assert(runtimeAnimationStride({ tier: 'performance', role: 'assault', distance: 40, targeted: false, criticalCue: true }) === 1, 'gameplay-critical animation cues must remain full-cadence');

assert(rendererSource.includes('this.ensureRefineryEnvironment(state, budget.detailScale)'), 'Babylon refinery authored LOD must use adaptive detailScale');
assert(rendererSource.includes('this.ensurePlayerPresentation(state, budget.detailScale)'), 'Babylon player authored LOD must use adaptive detailScale');
assert(rendererSource.includes('this.ensureEnemyCatalog(budget.detailScale, runtimeProfile.preloadConcurrency)'), 'Babylon enemy preload/LOD must use adaptive resource tier');
assert(rendererSource.includes('this.worldPresentation.sync(state, mission, budget.detailScale)'), 'Babylon authored world assets must use adaptive detailScale');
assert(rendererSource.includes('const animationStride = runtimeAnimationStride({'), 'Babylon enemy rigs must use the shared animation stride contract');
assert(rendererSource.includes('this.engine._drawCalls.current') && rendererSource.includes('this.scene.getActiveIndices() / 3'), 'Babylon performance diagnostics must report measured draw calls and rendered triangles');
assert(rendererSource.includes('budget.pixelRatioScale') && rendererSource.includes('setHardwareScalingLevel'), 'Babylon hardware scaling must remain tied to the adaptive pixel ratio');
assert(rendererSource.includes('maxCachedAssets: budget.assetCacheEntryBudget'), 'Babylon runtime must receive the tiered cached-resource count budget');
assert(assetRuntimeSource.includes('{ doNotInstantiate: options.uniqueMeshes ?? false }'), 'Babylon runtime must allow native instancing for reusable static meshes');
assert(assetRuntimeSource.includes('this.cache.size <= this.budget.maxCachedAssets'), 'Babylon runtime must evict idle assets when the tiered entry budget is exceeded');
assert(browserSmokeSource.includes('BROWSER_P27D3_BABYLON_RESOURCE_QUALITY_PASS'), 'browser QA must record P27-D3 geometry/resource evidence');

console.log(
  `P27_D3_BABYLON_RESOURCE_QUALITY_PASS phoneDefault=${phoneDefault.tierName} tiers=${high.tierName}>${balanced.tierName}>${performance.tierName} detail=${high.detailScale.toFixed(2)}>${balanced.detailScale.toFixed(2)}>${performance.detailScale.toFixed(2)} cache=${high.assetCacheEntryBudget}>${balanced.assetCacheEntryBudget}>${performance.assetCacheEntryBudget} animation=${animationHigh}>${animationBalanced}>${animationPerformance} instancing=static-native measurement=draw+triangles+cache critical=full-cadence`,
);
