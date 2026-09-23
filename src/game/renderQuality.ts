export type AdaptiveRenderTier = 0 | 1 | 2;
export type GraphicsQualityMode = 'adaptive' | 'flagship' | 'performance';

export type RenderBudgetSnapshot = {
  tier: AdaptiveRenderTier;
  tierName: 'high' | 'balanced' | 'performance';
  qualityMode: GraphicsQualityMode;
  smoothedFrameMs: number;
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
  gameplayCueScale: 1;
  textureAnisotropy: 1 | 2 | 4;
  assetCacheCompressedByteBudget: number;
};

export const TARGET_FRAME_MS = 1000 / 60;
const TIER_NAME: Record<AdaptiveRenderTier, RenderBudgetSnapshot['tierName']> = { 0: 'high', 1: 'balanced', 2: 'performance' };
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

function qualityFloorTier(requestedQuality: number): AdaptiveRenderTier {
  if (requestedQuality < 0.55) return 2;
  if (requestedQuality < 0.8) return 1;
  return 0;
}

export class AdaptiveRenderBudget {
  private readonly baselineTier: AdaptiveRenderTier;
  private runtimeTier: AdaptiveRenderTier;
  private smoothedFrameMs = 1000 / 60;
  private slowSamples = 0;
  private fastSamples = 0;

  constructor(coarse: boolean) {
    this.baselineTier = coarse ? 1 : 0;
    this.runtimeTier = 0;
  }

  sample(frameMs: number, requestedQuality: number, qualityMode: GraphicsQualityMode = 'adaptive'): RenderBudgetSnapshot {
    if (Number.isFinite(frameMs) && frameMs >= 4 && frameMs <= 80) {
      this.smoothedFrameMs = this.smoothedFrameMs * 0.92 + frameMs * 0.08;
      if (this.smoothedFrameMs > 21.5) {
        this.slowSamples += 1;
        this.fastSamples = Math.max(0, this.fastSamples - 3);
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

    const requested = Math.max(0.35, Math.min(1, requestedQuality));
    const modeFloor: AdaptiveRenderTier = qualityMode === 'performance' ? 2 : qualityMode === 'flagship' ? 0 : this.baselineTier;
    const tier = Math.max(this.runtimeTier, modeFloor, qualityFloorTier(requested)) as AdaptiveRenderTier;
    return {
      tier,
      tierName: TIER_NAME[tier],
      qualityMode,
      smoothedFrameMs: this.smoothedFrameMs,
      targetFrameMs: TARGET_FRAME_MS,
      frameHeadroomMs: TARGET_FRAME_MS - this.smoothedFrameMs,
      framePressure: this.smoothedFrameMs > 21.5 ? 'over' : this.smoothedFrameMs > 18 ? 'watch' : 'healthy',
      pixelRatioScale: PIXEL_RATIO_SCALE[tier],
      detailScale: DETAIL_SCALE[tier],
      shadows: requested > 0.62 && tier < 2,
      shadowMapSize: SHADOW_MAP_SIZE[tier],
      vfxDensity: VFX_DENSITY[tier],
      transparencyScale: TRANSPARENCY_SCALE[tier],
      reflectionScale: REFLECTION_SCALE[tier],
      secondaryEffectScale: SECONDARY_EFFECT_SCALE[tier],
      gameplayCueScale: 1,
      textureAnisotropy: TEXTURE_ANISOTROPY[tier],
      assetCacheCompressedByteBudget: ASSET_CACHE_COMPRESSED_BYTE_BUDGET[tier],
    };
  }
}
