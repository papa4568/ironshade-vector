import fs from 'node:fs';

const shell = fs.readFileSync(new URL('../scripts/android-fast-smoke.sh', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../scripts/android-runtime-smoke.mjs', import.meta.url), 'utf8');
const extendedShell = fs.readFileSync(new URL('../scripts/android-runtime-smoke.sh', import.meta.url), 'utf8');
const repeatableShell = fs.readFileSync(new URL('../scripts/android-repeatable-regression.sh', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const browserWorkflow = fs.readFileSync(new URL('../.github/workflows/browser-e2e.yml', import.meta.url), 'utf8');

const requireText = (text, needle, label) => {
  if (!text.includes(needle)) throw new Error(`${label} missing required marker: ${needle}`);
};

for (const marker of [
  'ANDROID_FAST_SMOKE=1',
  'ANDROID_FAST_RESUME_CHECK=1',
  'adb install -r',
  'android-fast-smoke.png',
  'android-fast-resume.png',
  'android-fast-logcat.txt',
  'ANDROID_FAST_EMULATOR_PASS',
]) requireText(shell, marker, 'fast shell');

for (const forbidden of [
  'browser-chapter3-playthrough',
  'android-settings-playtest.py',
  'ANDROID_P20E_REPEATABLE',
  'verify-authored-operator',
  'verify-authored-enemies',
  'verify-authored-weapons',
  'verify-authored-refinery',
]) {
  if (shell.includes(forbidden)) throw new Error(`fast shell must not run extended suite: ${forbidden}`);
}

for (const marker of [
  "const fastSmoke = process.env.ANDROID_FAST_SMOKE === '1';",
  "const fastResumeOnly = process.env.ANDROID_FAST_RESUME_CHECK === '1';",
  "const repeatableRegressionOnly = process.env.ANDROID_P20E_REPEATABLE_ONLY === '1';",
  'if (!repeatableRegressionOnly) {',
  'if (repeatableRegressionOnly) {',
  'ANDROID_FAST_MANAGEMENT_TOUCH_PASS',
  'ANDROID_FAST_INTERACTION_TOUCH_PASS',
  'ANDROID_FAST_FIRE_TOUCH_PASS',
  'ANDROID_FAST_TOUCH_PASS',
  'ANDROID_FAST_RUNTIME_PASS',
  'ANDROID_FAST_LIFECYCLE_RESUME_PASS',
]) requireText(runtime, marker, 'runtime harness');

for (const marker of [
  'browser-chapter3-playthrough',
  'android-settings-playtest.py',
]) requireText(extendedShell, marker, 'extended Android shell');
requireText(runtime, 'ANDROID_P20E_REPEATABLE', 'extended Android runtime harness');

requireText(workflow, 'npm run test:android-fast-smoke', 'Android workflow');
requireText(workflow, 'npm run build', 'Android workflow production build');
requireText(workflow, "set -euo pipefail;", 'Android workflow');
requireText(workflow, 'actions/upload-artifact@v7', 'Android workflow');
requireText(workflow, "      - main", 'Android workflow main push');
requireText(workflow, "      - 'tests/**'", 'Android workflow test push path');
requireText(browserWorkflow, 'name: Browser E2E', 'Browser workflow');
requireText(browserWorkflow, '  push:', 'Browser workflow');
requireText(browserWorkflow, "      - main", 'Browser workflow main push');
requireText(browserWorkflow, "      - 'tests/**'", 'Browser workflow test push path');

for (const marker of [
  'ANDROID_P20E_REPEATABLE_FAMILY_PASS',
  'ANDROID_P20E_REPEATABLE_PLAY_PASS',
]) requireText(runtime, marker, 'extended Android runtime harness');

for (const marker of [
  'state.remaining > 1 && iteration % 3 === 0',
  'state.remaining > 1 && iteration % 2 === 0',
  'state.remaining > 1 && iteration % 4 === 0',
  'safe-extraction can appear as soon as that target dies',
]) requireText(runtime, marker, 'repeatable final-hostile touch guard');

for (const marker of [
  'ANDROID_P20E_REPEATABLE_ONLY=1',
  'ANDROID_P20E_REPEATABLE_FAMILY_PASS family=${family}',
  'ANDROID_P20E_REPEATABLE_PLAY_PASS families=stabilization+salvage+boarding completions=3',
  'ANDROID_P20E_REPEATABLE_REGRESSION_PASS families=stabilization+salvage+boarding completions=3',
  'android-repeatable-regression.png',
  'android-repeatable-regression-logcat.txt',
  'ANDROID_P20E_REPEATABLE_JOB_PASS',
]) requireText(repeatableShell, marker, 'repeatable-family shell');

for (const marker of [
  'browser-chapter3-playthrough',
  'android-settings-playtest.py',
  'verify-authored-operator',
  'verify-authored-enemies',
  'verify-authored-weapons',
  'verify-authored-refinery',
]) requireText(extendedShell, marker, 'extended Android shell');

for (const artifact of [
  'Ironshade-Vector-Android-Beta.apk',
  'Ironshade-Vector-Android-Beta.sha256',
  'Ironshade-Vector-Android-Smoke.apk',
  'Ironshade-Vector-Android-Smoke.sha256',
  'android-fast-logcat.txt',
  'android-fast-smoke.png',
  'android-fast-resume.png',
]) requireText(workflow, artifact, 'Android workflow artifact upload');

for (const marker of [
  'repeatable-family-regression:',
  "github.event_name == 'workflow_dispatch' || github.ref == 'refs/heads/android/capacitor-apk' || github.ref == 'refs/heads/android/full-regression'",
  "      - android/full-regression",
  'needs: build-apk',
  'actions/download-artifact@v8',
  'bash scripts/android-repeatable-regression.sh',
  'ironshade-vector-repeatable-family-regression',
]) requireText(workflow, marker, 'repeatable-family workflow');

const emulatorScriptLine = workflow
  .split('\n')
  .find((line) => line.includes("script: bash -lc '"));
if (!emulatorScriptLine) throw new Error('Android workflow missing emulator runner script');
requireText(emulatorScriptLine, 'bash scripts/android-fast-smoke.sh', 'Android workflow emulator script');
for (const forbidden of [
  'android-runtime-smoke.sh',
  'android-settings-playtest.py',
  'browser-chapter3-playthrough',
  'ANDROID_P20E_REPEATABLE',
]) {
  if (emulatorScriptLine.includes(forbidden)) {
    throw new Error(`default Android emulator path must not run extended suite: ${forbidden}`);
  }
}

console.log('ANDROID_FAST_SMOKE_CONTRACT_PASS entry=scripts/android-fast-smoke.sh defaultPush=fast-only repeatable=dedicated-dispatch extended=retained-not-run browser=required productionBuild=required touch=required lifecycle=required artifacts=required failFast=required');
