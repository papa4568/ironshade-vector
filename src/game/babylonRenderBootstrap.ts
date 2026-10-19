import { TARGET_FRAME_MS } from './renderQuality';

// Asset decoding/instantiation produces transient main-thread gaps that do not
// describe steady GPU performance. Do not downshift all pending LOD0 loads
// before the first coherent authored shell, operator, and enemy catalog exist.
// Once the three readiness gates leave "loading", sample real frame pressure.
export function babylonBootstrapFrameSample(
  actualFrameMs: number,
  refinery: boolean,
  readiness: readonly (string | undefined)[],
): number {
  return refinery && readiness.some(state => state === 'loading')
    ? Math.min(actualFrameMs, TARGET_FRAME_MS)
    : actualFrameMs;
}

// Keep the first high-detail refinery loads responsive on a shared software
// renderer. LOD readiness and all gameplay simulation still advance each RAF;
// only redundant GPU submissions are paced while authored assets are loading.
export function babylonBootstrapPacingIntervalMs(
  refinery: boolean,
  readiness: readonly (string | undefined)[],
  observedFrameMs = TARGET_FRAME_MS,
): number {
  if (!refinery || !readiness.some(state => state === 'loading')) return 0;
  // Asset decoding is not steady GPU pressure; preserve flagship LOD selection.
  // When an actual bootstrap frame reaches 90ms, however, avoid saturating
  // older Android WebViews and leave room for touch input and DevTools.
  return observedFrameMs >= 90 && observedFrameMs < 2_000 ? 240 : 120;
}
