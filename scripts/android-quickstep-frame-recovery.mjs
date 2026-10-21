// Recover only from a verified Android Quickstep ANR overlay during real
// Pixel emulator screenshot capture. All original gameplay pixel/provenance
// assertions remain mandatory; no synthetic or repainted frames are accepted.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { auditGameplayFrame, decodeScreenshotPng } from './verify-p28g2-gameplay-frames.mjs';
import { quickstepWaitPoint, needsQuickstepRecovery } from './android-quickstep-dialog-policy.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function adb(...args) {
  return execFileSync('adb', args, { encoding: 'utf8', timeout: 15_000, maxBuffer: 4 * 1024 * 1024 });
}


function dismissObservedQuickstepDialog() {
  // Require actual native UI hierarchy proof of Quickstep ANR and an
  // accessible, explicitly clickable Wait button. Never tap guessed pixels.
  try {
    adb('shell', 'uiautomator', 'dump', '/sdcard/ironshade-quickstep-recovery.xml');
    const xml = adb('exec-out', 'cat', '/sdcard/ironshade-quickstep-recovery.xml');
    const point = quickstepWaitPoint(xml);
    if (!point) return false;
    adb('shell', 'input', 'tap', String(point.x), String(point.y));
    return true;
  } catch {
    return false;
  }
}

export async function captureVerifiedAndroidGameplay(path, route) {
  let bytes = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    // Genuine Android framebuffer only, not a canvas export or an edited PNG.
    const png = execFileSync('adb', ['exec-out', 'screencap', '-p'],
      { timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
    if (png.length < 20_000 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error(route + ' screenshot blank or invalid: ' + path + ' bytes=' + png.length);
    }
    writeFileSync(path, png);
    bytes = png.length;
    const frame = auditGameplayFrame(decodeScreenshotPng(png));
    if (frame.valid || !needsQuickstepRecovery(frame) || attempt === 3) return bytes;
    if (!dismissObservedQuickstepDialog()) return bytes;
    console.log('ANDROID_QUICKSTEP_ANR_WAIT_TAPPED route=' + route + ' attempt=' + attempt);
    await sleep(1_500);
  }
  return bytes;
}
