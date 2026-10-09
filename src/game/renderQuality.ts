export type AdaptiveRenderTier = 0 | 1 | 2;
export type AdaptiveRenderTierName = 'high' | 'balanced' | 'performance';
export type GraphicsQualityMode = 'adaptive' | 'flagship' | 'performance';
export type RenderFrameSampleState = 'measured' | 'ignored-invalid' | 'ignored-suspend-gap';
export type RenderTierTransition = 'none' | `${AdaptiveRenderTierName}->${AdaptiveRenderTierName}`;

export type RenderBudgetSnapshot = {
  tier: AdaptiveRenderTier;
  tierName: AdaptiveRenderTierName;
  runtimeTierName: AdaptiveRenderTierName;
  qualityMode: GraphicsQualityMode;
  rawFrameMs: number;
  measuredFrameMs: number;
  frameSampleState: RenderFrameSampleState;
  smoothedFrameMs: number;
  lastTierTransition: RenderTierTransition;
  tierTransitionCount: number;
  targetFrameMs: number;
  frameHeadroomMs: number;
  framePressure: 'healthy' | 'watch' | 'over';
  pixelRatioScale: number;
  detailScale: number;
  shadows: boolean;
  shadowMapSize: 1024 | 512 | 256;
  vfxDensity: number;
  transparencyScale: number;
  reflectionScale: number;
  secondaryEffectScale: number;
  refineryIblScale: number;
  refineryBloomScale: number;
  refineryContactDepthScale: number;
  refineryAtmosphereScale: number;
  gameplayCueScale: 1;
  textureAnisotropy: 1 | 2 | 4;
  assetCacheCompressedByteBudget: number;
  assetCacheEntryBudget: number;
};

export const TARGET_FRAME_MS = 1000 / 60;
export const MAX_MEASURED_FRAME_MS = 250;
export const SUSPEND_GAP_MS = 1000;
const MAX_SMOOTHED_FRAME_SAMPLE_MS = 80;
const ASSET_DETAIL_TIER_STABLE_SAMPLES = 12;
const TIER_NAME: Record<AdaptiveRenderTier, AdaptiveRenderTierName> = { 0: 'high', 1: 'balanced', 2: 'performance' };
const PIXEL_RATIO_SCALE: Record<AdaptiveRenderTier, number> = { 0: 1, 1: 0.84, 2: 0.68 };
const DETAIL_SCALE: Record<AdaptiveRenderTier, number> = { 0: 1, 1: 0.78, 2: 0.5 };
const SHADOW_MAP_SIZE: Record<AdaptiveRenderTier, 1024 | 512 | 256> = { 0: 1024, 1: 512, 2: 256 };
const VFX_DENSITY: Record<AdaptiveRenderTier, number> = { 0: 1, 1: 0.72, 2: 0.45 };
const TRANSPARENCY_SCALE: Record<AdaptiveRenderTier, number> = { 0: 1, 1: 0.68, 2: 0.4 };
const REFLECTION_SCALE: Record<AdaptiveRenderTier, number> = { 0: 1, 1: 0.7, 2: 0.38 };
const SECONDARY_EFFECT_SCALE: Record<AdaptiveRenderTier, number> = { 0: 1, 1: 0.68, 2: 0.42 };
const TEXTURE_ANISOTROPY: Record<AdaptiveRenderTier, 1 | 2 | 4> = { 0: 4, 1: 2, 2: 1 };
const ASSET_CACHE_COMPRESSED_BYTE_BUDGET: Record<AdaptiveRenderTier, number> = {
  0: 64 * 1024 * 1024,
  1: 40 * 1024 * 1024,
  2: 24 * 1024 * 1024,
};
const ASSET_CACHE_ENTRY_BUDGET: Record<AdaptiveRenderTier, number> = {
  0: 32,
  1: 24,
  2: 20,
};

function qualityFloorTier(requestedQuality: number): AdaptiveRenderTier {
  if (requestedQuality < 0.55) return 2;
  if (requestedQuality < 0.8) return 1;
  return 0;
}

function severeFramePressureWeight(frameMs: number) {
  if (frameMs <= MAX_SMOOTHED_FRAME_SAMPLE_MS) return 1;
  return Math.min(8, Math.max(2, Math.ceil(frameMs / 50)));
}

export class AdaptiveRenderBudget {
  // Device class never lowers quality; explicit player settings or sustained measured runtime pressure may do so.
  private runtimeTier: AdaptiveRenderTier = 0;
  private assetDetailRuntimeTier: AdaptiveRenderTier = 0;
  private assetDetailCandidateTier: AdaptiveRenderTier = 0;
  private assetDetailStableSamples = 0;
  private smoothedFrameMs = TARGET_FRAME_MS;
  private slowSamples = 0;
  private fastSamples = 0;
  private lastTierTransition: RenderTierTransition = 'none';
  private tierTransitionCount = 0;

  constructor(_coarse: boolean) {}

  sample(frameMs: number, requestedQuality: number, qualityMode: GraphicsQualityMode = 'adaptive'): RenderBudgetSnapshot {
    const rawFrameMs = Number.isFinite(frameMs) ? Math.max(0, frameMs) : 0;
    const frameSampleState: RenderFrameSampleState = !Number.isFinite(frameMs) || frameMs < 4
      ? 'ignored-invalid'
      : frameMs > SUSPEND_GAP_MS
        ? 'ignored-suspend-gap'
        : 'measured';
    const measuredFrameMs = frameSampleState === 'measured'
      ? Math.min(rawFrameMs, MAX_MEASURED_FRAME_MS)
      : 0;
    const previousRuntimeTier = this.runtimeTier;

    if (frameSampleState === 'measured') {
      // Keep the historical EMA bounded so a catastrophic frame cannot poison recovery for seconds,
      // while still counting the full measured sample below as weighted runtime pressure.
      const smoothedSampleMs = Math.min(measuredFrameMs, MAX_SMOOTHED_FRAME_SAMPLE_MS);
      this.smoothedFrameMs = this.smoothedFrameMs * 0.92 + smoothedSampleMs * 0.08;
      if (this.smoothedFrameMs > 21.5) {
        const pressureWeight = severeFramePressureWeight(measuredFrameMs);
        this.slowSamples += pressureWeight;
        this.fastSamples = Math.max(0, this.fastSamples - 3 * pressureWeight);
      } else if (this.smoothedFrameMs < 17.4) {
        this.fastSamples += 1;
        this.slowSamples = Math.max(0, this.slowSamples - 2);
      } else {
        this.slowSamples = Math.max(0, this.slowSamples - 1);
        this.fastSamples = Math.max(0, this.fastSamples - 1);
      }

      if (this.slowSamples >= 45 && this.runtimeTier < 2) {
        this.runtimeTier = (this.runtimeTier + 1) as AdaptiveRenderTier;
        this.slowSamples = 0;
        this.fastSamples = 0;
      } else if (this.fastSamples >= 240 && this.runtimeTier > 0) {
        this.runtimeTier = (this.runtimeTier - 1) as AdaptiveRenderTier;
        this.slowSamples = 0;
        this.fastSamples = 0;
      }
    }

    if (this.runtimeTier !== previousRuntimeTier) {
      this.lastTierTransition = `${TIER_NAME[previousRuntimeTier]}->${TIER_NAME[this.runtimeTier]}`;
      this.tierTransitionCount += 1;
    }

    if (this.runtimeTier !== this.assetDetailCandidateTier) {
      this.assetDetailCandidateTier = this.runtimeTier;
      this.assetDetailStableSamples = 0;
    } else if (frameSampleState === 'measured' && this.assetDetailRuntimeTier !== this.assetDetailCandidateTier) {
      this.assetDetailStableSamples += 1;
      if (this.assetDetailStableSamples >= ASSET_DETAIL_TIER_STABLE_SAMPLES) {
        this.assetDetailRuntimeTier = this.assetDetailCandidateTier;
        this.assetDetailStableSamples = 0;
      }
    }

    const requested = Math.max(0.35, Math.min(1, requestedQuality));
    const modeFloor: AdaptiveRenderTier = qualityMode === 'performance' ? 2 : 0;
    const requestedTier = Math.max(modeFloor, qualityFloorTier(requested)) as AdaptiveRenderTier;
    const tier = Math.max(this.runtimeTier, requestedTier) as AdaptiveRenderTier;
    const detailTier = Math.max(this.assetDetailRuntimeTier, requestedTier) as AdaptiveRenderTier;
    return {
      tier,
      tierName: TIER_NAME[tier],
      runtimeTierName: TIER_NAME[this.runtimeTier],
      qualityMode,
      rawFrameMs,
      measuredFrameMs,
      frameSampleState,
      smoothedFrameMs: this.smoothedFrameMs,
      lastTierTransition: this.lastTierTransition,
      tierTransitionCount: this.tierTransitionCount,
      targetFrameMs: TARGET_FRAME_MS,
      frameHeadroomMs: TARGET_FRAME_MS - this.smoothedFrameMs,
      framePressure: this.smoothedFrameMs > 21.5 ? 'over' : this.smoothedFrameMs > 18 ? 'watch' : 'healthy',
      pixelRatioScale: PIXEL_RATIO_SCALE[tier],
      detailScale: DETAIL_SCALE[detailTier],
      shadows: requested > 0.62 && tier < 2,
      shadowMapSize: SHADOW_MAP_SIZE[tier],
      vfxDensity: VFX_DENSITY[tier],
      transparencyScale: TRANSPARENCY_SCALE[tier],
      reflectionScale: REFLECTION_SCALE[tier],
      secondaryEffectScale: SECONDARY_EFFECT_SCALE[tier],
      refineryIblScale: REFLECTION_SCALE[tier],
      refineryBloomScale: SECONDARY_EFFECT_SCALE[tier],
      refineryContactDepthScale: SECONDARY_EFFECT_SCALE[tier],
      refineryAtmosphereScale: SECONDARY_EFFECT_SCALE[tier],
      gameplayCueScale: 1,
      textureAnisotropy: TEXTURE_ANISOTROPY[tier],
      assetCacheCompressedByteBudget: ASSET_CACHE_COMPRESSED_BYTE_BUDGET[tier],
      assetCacheEntryBudget: ASSET_CACHE_ENTRY_BUDGET[tier],
    };
  }
}
