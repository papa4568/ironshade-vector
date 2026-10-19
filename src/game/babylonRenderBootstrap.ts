import { TARGET_FRAME_MS } from './renderQuality';

// Asset decoding/instantiation produces transient main-thread gaps that do not
// describe steady GPU performance. Do not downshift all pending LOD0 loads
// before the first coherent authored shell, operator, and enemy catalog exist.
// After a bounded 2-second initialization grace, sample real frame pressure even
// if the three authored readiness gates remain loading.
export function babylonBootstrapFrameSample(
  actualFrameMs: number,
  refinery: boolean,
  readiness: readonly (string | undefined)[],
  loadingElapsedMs = 0,
): number {
  // One transient decode stall must not lower the first authored LOD choice.
  // Prolonged loading is different: report the actual measured frames after
  // 2 seconds so the existing catastrophic-frame recovery can keep touch
  // input responsive on software-rendered Android WebViews.
  const withinGrace = Number.isFinite(loadingElapsedMs) && loadingElapsedMs < 2_000;
  return refinery && withinGrace && readiness.some(state => state === 'loading')
    ? Math.min(actualFrameMs, TARGET_FRAME_MS)
    : actualFrameMs;
}

// Keep the first high-detail refinery loads responsive on a shared software
// renderer. LOD readiness and all gameplay simulation still advance each RAF;
// only redundant GPU submissions are paced while authored assets are loading.
export function babylonBootstrapPacingIntervalMs(
  refinery: boolean,
  readiness: readonly (string | undefined)[],
): number {
  return refinery && readiness.some(state => state === 'loading') ? 120 : 0;
}
