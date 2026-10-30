// Filter only crashes that implicate the Ironshade app, not the emulator's
// independently spawned UiAutomation/uiautomator instrumentation process.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function auditParallaxAndroidAppCrash(log) {
  const lines = String(log).split(/\r?\n/);
  const app = 'app.ironshade.vector';
  const escaped = app.replace(/\./g, '\\.');
  const crashProcess = new RegExp('AndroidRuntime:\\s*Process:\\s*' + escaped + '(?:,|\\s|$)');
  const appAnr = new RegExp('(?:ANR in|am_anr:.*)\\s*' + escaped + '(?:[,\\s]|$)');
  const appEvent = new RegExp('am_crash:.*(?:\\[|,\\s*)' + escaped + '(?:,|\\s|\\])');
  const reasons = [];
  for (const line of lines) {
    if (crashProcess.test(line)) reasons.push('android-runtime-app-crash');
    if (appAnr.test(line)) reasons.push('android-app-not-responding');
    if (appEvent.test(line)) reasons.push('android-event-app-crash');
  }
  return { valid: reasons.length === 0, reasons };
}

// Vite SSR inlines imported modules into its test entry. Matching only
// import.meta.url would accidentally execute this CLI path inside that bundle.
if (process.argv[1]?.replace(/\\\\/g, '/').endsWith('/tools/p28g9-android-crash-audit.mjs')
    && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error('Provide raw captured Android logcat');
  const verdict = auditParallaxAndroidAppCrash(readFileSync(path, 'utf8'));
  if (!verdict.valid) {
    console.error('P28G9_ANDROID_APP_CRASH_FAIL ' + verdict.reasons.join(','));
    process.exitCode = 1;
  } else {
    console.log('P28G9_ANDROID_APP_CRASH_AUDIT_PASS source=actual-logcat scope=app.ironshade.vector');
  }
}
