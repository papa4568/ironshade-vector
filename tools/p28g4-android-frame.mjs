// Capture only real Android framebuffers. The shared source-verified Quickstep
// recovery tries to dismiss an observed native Wait dialog (not guessed taps).
// Recheck every returned frame; the native overlay can recur between attempts.
import { readFileSync } from 'node:fs';
import { captureVerifiedAndroidGameplay } from '../scripts/android-quickstep-frame-recovery.mjs';
import { decodeScreenshotPng, auditGameplayFrame } from '../scripts/verify-p28g2-gameplay-frames.mjs';
import { needsQuickstepRecovery } from '../scripts/android-quickstep-dialog-policy.mjs';

export function classifyG4Screenshot(frame, attempt, attempts = 5) {
  if (frame.valid === true) return 'accept';
  if (needsQuickstepRecovery(frame) && attempt < attempts) return 'retry';
  return 'reject';
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function captureAcceptedG4Frame(path, label, attempts = 5) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 8)
    throw new Error('P28-G4 retry count must be bounded');
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const bytes = await captureVerifiedAndroidGameplay(path, label);
    const png = readFileSync(path);
    const frame = auditGameplayFrame(decodeScreenshotPng(png));
    const verdict = classifyG4Screenshot(frame, attempt, attempts);
    if (verdict === 'accept') return bytes;
    console.log('ANDROID_P28G4_FRAME_' + (verdict === 'retry' ? 'OBSTRUCTION_RETRY' : 'REJECTED')
      + ' label=' + label + ' attempt=' + attempt + ' paleRows=' + frame.paleBandRowsRatio);
    if (verdict === 'reject') throw new Error('P28-G4 real ' + label
      + ' screenshot failed unchanged pixel gate: ' + JSON.stringify(frame));
    await sleep(1700);
  }
  throw new Error('P28-G4 real screenshot retry exhausted: ' + label);
}
