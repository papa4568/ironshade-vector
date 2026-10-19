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
