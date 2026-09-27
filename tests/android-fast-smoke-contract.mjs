import fs from 'node:fs';

const shell = fs.readFileSync(new URL('../scripts/android-fast-smoke.sh', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../scripts/android-runtime-smoke.mjs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');

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
  'ANDROID_FAST_MANAGEMENT_TOUCH_PASS',
  'ANDROID_FAST_INTERACTION_TOUCH_PASS',
  'ANDROID_FAST_FIRE_TOUCH_PASS',
  'ANDROID_FAST_TOUCH_PASS',
  'ANDROID_FAST_RUNTIME_PASS',
  'ANDROID_FAST_LIFECYCLE_RESUME_PASS',
]) requireText(runtime, marker, 'runtime harness');

requireText(workflow, 'npm run test:android-fast-smoke', 'Android workflow');
requireText(workflow, "set -euo pipefail;", 'Android workflow');
requireText(workflow, 'bash scripts/android-fast-smoke.sh; bash scripts/android-runtime-smoke.sh', 'Android workflow');

console.log('ANDROID_FAST_SMOKE_CONTRACT_PASS entry=scripts/android-fast-smoke.sh extended=excluded touch=required lifecycle=required artifacts=required failFast=required');
