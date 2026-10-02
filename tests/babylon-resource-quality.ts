import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPERATOR_ASSET_FAMILY, SHOWCASE_REFINERY_MODULE_FAMILY } from '../src/game/graphicsAssetManifest';
import { selectGraphicsAssetSpec } from '../src/game/graphicsAssets';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';
import { runtimeAnimationStride } from '../src/game/runtimeScalability';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
const assetRuntimeSource = readFileSync(resolve(process.cwd(), 'src/game/babylonGraphicsAssets.ts'), 'utf8');
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');

const high = new AdaptiveRenderBudget(false).sample(16.7, 1, 'flagship');
const balanced = new AdaptiveRenderBudget(true).sample(16.7, 1, 'adaptive');
const performance = new AdaptiveRenderBudget(false).sample(16.7, 1, 'performance');

assert(high.tierName === 'high' && balanced.tierName === 'balanced' && performance.tierName === 'performance', 'P27-D3 must expose deterministic High/Balanced/Performance tiers');
assert(high.pixelRatioScale > balanced.pixelRatioScale && balanced.pixelRatioScale > performance.pixelRatioScale, 'Babylon hardware scaling budget must decrease each tier');
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
assert(assetRuntimeSource.includes('{ doNotInstantiate: false }'), 'Babylon runtime must allow native instancing for reusable static meshes');
assert(assetRuntimeSource.includes('this.cache.size <= this.budget.maxCachedAssets'), 'Babylon runtime must evict idle assets when the tiered entry budget is exceeded');
assert(browserSmokeSource.includes('BROWSER_P27D3_BABYLON_RESOURCE_QUALITY_PASS'), 'browser QA must record P27-D3 geometry/resource evidence');

console.log(
  `P27_D3_BABYLON_RESOURCE_QUALITY_PASS tiers=${high.tierName}>${balanced.tierName}>${performance.tierName} detail=${high.detailScale.toFixed(2)}>${balanced.detailScale.toFixed(2)}>${performance.detailScale.toFixed(2)} cache=${high.assetCacheEntryBudget}>${balanced.assetCacheEntryBudget}>${performance.assetCacheEntryBudget} animation=${animationHigh}>${animationBalanced}>${animationPerformance} instancing=static-native measurement=draw+triangles+cache critical=full-cadence`,
);
