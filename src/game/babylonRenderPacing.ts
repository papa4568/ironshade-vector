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

export function shouldSubmitBabylonFrame(
  now: number,
  lastSubmittedAt: number,
  intervalMs: number,
): boolean {
  return intervalMs === 0 || lastSubmittedAt <= 0 || now < lastSubmittedAt
    || now - lastSubmittedAt >= intervalMs;
}
