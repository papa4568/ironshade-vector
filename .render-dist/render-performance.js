var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const PIXEL_RATIO_SCALE = { 0: 1, 1: 0.84, 2: 0.68 };
const DETAIL_SCALE = { 0: 1, 1: 0.78, 2: 0.5 };
function qualityFloorTier(requestedQuality) {
  if (requestedQuality < 0.55) return 2;
  if (requestedQuality < 0.8) return 1;
  return 0;
}
class AdaptiveRenderBudget {
  constructor(coarse2) {
    __publicField(this, "baselineTier");
    __publicField(this, "runtimeTier");
    __publicField(this, "smoothedFrameMs", 1e3 / 60);
    __publicField(this, "slowSamples", 0);
    __publicField(this, "fastSamples", 0);
    this.baselineTier = coarse2 ? 1 : 0;
    this.runtimeTier = this.baselineTier;
  }
  sample(frameMs, requestedQuality) {
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
        this.runtimeTier = this.runtimeTier + 1;
        this.slowSamples = 0;
        this.fastSamples = 0;
      } else if (this.fastSamples >= 240 && this.runtimeTier > this.baselineTier) {
        this.runtimeTier = this.runtimeTier - 1;
        this.slowSamples = 0;
        this.fastSamples = 0;
      }
    }
    const requested = Math.max(0.35, Math.min(1, requestedQuality));
    const tier = Math.max(this.runtimeTier, qualityFloorTier(requested));
    return {
      tier,
      smoothedFrameMs: this.smoothedFrameMs,
      pixelRatioScale: PIXEL_RATIO_SCALE[tier],
      detailScale: DETAIL_SCALE[tier],
      shadows: requested > 0.62 && tier < 2
    };
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const gameCanvasSource = readFileSync(resolve(process.cwd(), "src/components/GameCanvas.tsx"), "utf8");
assert(!gameCanvasSource.includes("useRef<SimState>(createMissionState(firstMission))"), "GameCanvas must not construct a new simulation on every React render");
assert(gameCanvasSource.includes("useState(() => createMissionState(firstMission))"), "GameCanvas initial simulation should use a lazy one-time initializer");
assert(gameCanvasSource.includes("profileSettingsRef.current.effectIntensity") && gameCanvasSource.includes("profileSettingsRef.current.screenShake"), "combat render loop must read live profile settings");
const desktop = new AdaptiveRenderBudget(false);
let snapshot = desktop.sample(16.7, 1);
assert(snapshot.tier === 0, "desktop should start at full quality");
assert(snapshot.shadows, "desktop full quality should keep shadows");
for (let index = 0; index < 90; index += 1) snapshot = desktop.sample(30, 1);
assert(snapshot.tier >= 1, "sustained slow frames should lower render quality");
for (let index = 0; index < 90; index += 1) snapshot = desktop.sample(30, 1);
assert(snapshot.tier === 2, "continued slow frames should reach performance tier");
assert(!snapshot.shadows, "performance tier should disable dynamic shadows");
assert(snapshot.pixelRatioScale < 0.75, "performance tier should reduce pixel density");
for (let index = 0; index < 700; index += 1) snapshot = desktop.sample(16.4, 1);
assert(snapshot.tier === 0, "sustained healthy frames should recover desktop quality");
const coarse = new AdaptiveRenderBudget(true);
snapshot = coarse.sample(16.7, 1);
assert(snapshot.tier === 1, "coarse pointers should start at balanced tier");
const reducedEffects = new AdaptiveRenderBudget(false);
snapshot = reducedEffects.sample(16.7, 0.45);
assert(snapshot.tier === 2, "reduced effect intensity should enforce performance visual tier");
assert(!snapshot.shadows, "reduced effect intensity should disable dynamic shadows");
console.log("RENDER_PERFORMANCE_PASS");
