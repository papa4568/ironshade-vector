import { TARGET_FRAME_MS } from './renderQuality';

// Asset decoding/instantiation produces transient main-thread gaps that do not
// describe steady GPU performance. Do not downshift all pending LOD0 loads
// before the first coherent authored shell, operator, and enemy catalog exist.
// In production, the grace ends after two seconds so sustained pressure can
// recover even when a load stalls. The explicit graphics-comparison route is
// different: while the initial authored scene is still assembling, its visual
// QA must inspect the actual High assets rather than software-runner fallback
// LODs. This opt-in QA exception ends immediately when readiness resolves.
export function babylonBootstrapFrameSample(
  actualFrameMs: number,
  refinery: boolean,
  readiness: readonly (string | undefined)[],
  loadingElapsedMs = 0,
  graphicsComparisonQa = false,
): number {
  // One transient decode stall must not lower the first authored LOD choice.
  // Prolonged production loading must expose measured pressure after two
  // seconds so Android emergency recovery is never gated on asset readiness.
  // The explicit QA comparison retains High art while the loading renderer is
  // already paced; it is a visual proof, not a frame-rate acceptance result.
  const withinGrace = graphicsComparisonQa || (Number.isFinite(loadingElapsedMs) && loadingElapsedMs < 2_000);
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
