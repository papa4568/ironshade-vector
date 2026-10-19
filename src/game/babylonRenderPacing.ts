import type { RenderBudgetSnapshot } from './renderQuality';

// Limit the amount of time a severely overloaded software renderer can keep
// Chromium's render thread busy. Simulation, input and HUD still update every
// requestAnimationFrame; only redundant GPU submissions are paced.
// High and Balanced keep their original per-frame rendering contract.
export function babylonRenderPacingIntervalMs(
  budget: Pick<RenderBudgetSnapshot, 'tierName' | 'smoothedFrameMs'>,
): number {
  return budget.tierName === 'performance' && budget.smoothedFrameMs >= 40 ? 120 : 0;
}

// Pacing is an idle interval after the previous frame *completed*, not an
// interval measured from its start; long scene.render() calls must not erase it.
export function shouldSubmitBabylonFrame(
  now: number,
  lastCompletedAt: number,
  intervalMs: number,
): boolean {
  return intervalMs === 0 || lastCompletedAt <= 0 || now < lastCompletedAt
    || now - lastCompletedAt >= intervalMs;
}
