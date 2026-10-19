import type { RenderBudgetSnapshot } from './renderQuality';

// Limit the amount of time a severely overloaded software renderer can keep
// Chromium's render thread busy. Simulation, input and HUD still update every
// requestAnimationFrame; only redundant GPU submissions are paced.
// High and Balanced keep their original per-frame rendering contract.
export function babylonRenderPacingIntervalMs(
  budget: Pick<RenderBudgetSnapshot, 'tierName' | 'smoothedFrameMs'>,
): number {
  if (budget.tierName !== 'performance') return 0;
  // A long-running 90ms+ render on software WebView/Chromium can starve
  // touch dispatch even when simulation remains on the RAF cadence.
  // Allow the renderer more idle time only under measured catastrophic load.
  return budget.smoothedFrameMs >= 90 ? 240 : budget.smoothedFrameMs >= 40 ? 120 : 0;
}

export function shouldSubmitBabylonFrame(
  now: number,
  lastSubmittedAt: number,
  intervalMs: number,
): boolean {
  return intervalMs === 0 || lastSubmittedAt <= 0 || now < lastSubmittedAt
    || now - lastSubmittedAt >= intervalMs;
}
