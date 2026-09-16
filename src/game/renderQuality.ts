export type AdaptiveRenderTier = 0 | 1 | 2;

export type RenderBudgetSnapshot = {
  tier: AdaptiveRenderTier;
  smoothedFrameMs: number;
  pixelRatioScale: number;
  detailScale: number;
  shadows: boolean;
};

const PIXEL_RATIO_SCALE: Record<AdaptiveRenderTier, number> = { 0: 1, 1: 0.84, 2: 0.68 };
const DETAIL_SCALE: Record<AdaptiveRenderTier, number> = { 0: 1, 1: 0.78, 2: 0.5 };

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
    this.runtimeTier = this.baselineTier;
  }

  sample(frameMs: number, requestedQuality: number): RenderBudgetSnapshot {
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
      } else if (this.fastSamples >= 240 && this.runtimeTier > this.baselineTier) {
        this.runtimeTier = (this.runtimeTier - 1) as AdaptiveRenderTier;
        this.slowSamples = 0;
        this.fastSamples = 0;
      }
    }

    const requested = Math.max(0.35, Math.min(1, requestedQuality));
    const tier = Math.max(this.runtimeTier, qualityFloorTier(requested)) as AdaptiveRenderTier;
    return {
      tier,
      smoothedFrameMs: this.smoothedFrameMs,
      pixelRatioScale: PIXEL_RATIO_SCALE[tier],
      detailScale: DETAIL_SCALE[tier],
      shadows: requested > 0.62 && tier < 2,
    };
  }
}
