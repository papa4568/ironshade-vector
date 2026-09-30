import fs from 'node:fs';

const shell = fs.readFileSync(new URL('../scripts/android-fast-smoke.sh', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../scripts/android-runtime-smoke.mjs', import.meta.url), 'utf8');
const largeScreenShell = fs.readFileSync(new URL('../scripts/android-large-screen-smoke.sh', import.meta.url), 'utf8');
const largeScreenRuntime = fs.readFileSync(new URL('../scripts/android-large-screen-smoke.mjs', import.meta.url), 'utf8');
const androidConfigurator = fs.readFileSync(new URL('../scripts/configure-android.mjs', import.meta.url), 'utf8');
const extendedShell = fs.readFileSync(new URL('../scripts/android-runtime-smoke.sh', import.meta.url), 'utf8');
const repeatableShell = fs.readFileSync(new URL('../scripts/android-repeatable-regression.sh', import.meta.url), 'utf8');
const settingsShell = fs.readFileSync(new URL('../scripts/android-settings-regression.sh', import.meta.url), 'utf8');
const settingsScript = fs.readFileSync(new URL('../scripts/android-settings-playtest.py', import.meta.url), 'utf8');
const chapter3Shell = fs.readFileSync(new URL('../scripts/android-chapter3-regression.sh', import.meta.url), 'utf8');
const chapter3Script = fs.readFileSync(new URL('../scripts/browser-chapter3-playthrough.mjs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const browserWorkflow = fs.readFileSync(new URL('../.github/workflows/browser-e2e.yml', import.meta.url), 'utf8');
const p21f3Delivery = fs.readFileSync(new URL('../scripts/measure-webgpu-delivery-cost.mjs', import.meta.url), 'utf8');

const requireText = (text, needle, label) => {
  if (!text.includes(needle)) throw new Error(`${label} missing required marker: ${needle}`);
};

for (const marker of [
  'ANDROID_FAST_SMOKE=1',
  'ANDROID_FAST_RESUME_CHECK=1',
  'ANDROID_P21F1_CHECK=1',
  'adb install -r',
  'android-fast-smoke.png',
  'android-fast-resume.png',
  'android-p21f1-webgpu.png',
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
  "upsertAttribute(applicationTag, 'android:appCategory', 'game'",
  "upsertAttribute(activityTag, 'android:resizeableActivity', 'true'",
  "upsertAttribute(activityTag, 'android:keepScreenOn', 'true'",
  "'density'",
  'LARGE_SCREEN_SMALLEST_WIDTH_DP = 600',
  'ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE',
  'ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED',
  'smallestScreenWidthDp >= LARGE_SCREEN_SMALLEST_WIDTH_DP',
  'phoneLandscape=sensor largeScreen=adaptive-resizable thresholdDp=600 appCategory=game',
]) requireText(androidConfigurator, marker, 'P25-B Android configurator');

for (const marker of [
  'adb shell wm size 1600x2560',
  'adb shell wm density 320',
  'adb shell wm size 1800x1400',
  'ANDROID_LARGE_SCREEN_PHASE=portrait',
  'ANDROID_LARGE_SCREEN_PHASE=resized',
  'android-large-screen-portrait.png',
  'android-large-screen-resized.png',
  'android-large-screen-logcat.txt',
  'ANDROID_P25B_LARGE_SCREEN_PASS',
  'test "$(adb shell getprop ro.build.version.sdk',
]) requireText(largeScreenShell, marker, 'P25-B large-screen shell');

for (const marker of [
  "const sentinelToken = 'ironshade-p25b-live-resize';",
  "if (!['portrait', 'resized'].includes(phase))",
  'if (smallestWidth < 600)',
  "if (phase === 'portrait')",
  "webViewPreserved: phase === 'resized'",
  'Horizontal overflow detected',
  '__ironshadeP25BLargeScreenSentinel',
  'ANDROID_P25B_LARGE_SCREEN_PHASE_PASS',
]) requireText(largeScreenRuntime, marker, 'P25-B large-screen runtime');

for (const marker of [
  "const fastSmoke = process.env.ANDROID_FAST_SMOKE === '1';",
  "const fastResumeOnly = process.env.ANDROID_FAST_RESUME_CHECK === '1';",
  "const p21f1Only = process.env.ANDROID_P21F1_CHECK === '1';",
  "const repeatableRegressionOnly = process.env.ANDROID_P20E_REPEATABLE_ONLY === '1';",
  'if (!repeatableRegressionOnly) {',
  'if (repeatableRegressionOnly) {',
  'ANDROID_FAST_MANAGEMENT_TOUCH_PASS',
  'ANDROID_FAST_INTERACTION_TOUCH_PASS',
  'ANDROID_FAST_FIRE_TOUCH_PASS',
  'ANDROID_FAST_TOUCH_PASS',
  'ANDROID_FAST_RUNTIME_PASS',
  'ANDROID_P22B2_HUD_FOOTPRINT_PASS',
  'ANDROID_P22B2_OBJECTIVE_FLOW_PASS',
  'ANDROID_FAST_LIFECYCLE_RESUME_PASS',
  'ANDROID_P21F1_WEBGPU_PASS',
  'ANDROID_P21F3_WEBGPU_COMPAT_PASS',
  'ANDROID_P20F1_REPEATABLE_SETTLEMENT_PASS',
  'ANDROID_P20F2_REPEATABLE_PRESENTATION_PASS',
  'android-p21f3-webgpu.json',
  "canvas?.dataset.graphicsPathRequested === 'webgpu'",
  "['webgpu', 'webgl2'].includes(canvas?.dataset.graphicsPathLoaded ?? '')",
]) requireText(runtime, marker, 'runtime harness');

if (extendedShell.includes('browser-chapter3-playthrough')) {
  throw new Error('legacy extended Android shell must not run extracted Chapter 3 playthrough');
}
if (extendedShell.includes('android-settings-playtest.py')) {
  throw new Error('legacy extended Android shell must not run extracted Settings playtest');
}
requireText(runtime, 'ANDROID_P20E_REPEATABLE', 'extended Android runtime harness');

requireText(workflow, 'npm run test:android-fast-smoke', 'Android workflow');
requireText(workflow, 'npm run build', 'Android workflow production build');
requireText(workflow, "set -euo pipefail;", 'Android workflow');
requireText(workflow, 'actions/upload-artifact@v7', 'Android workflow');
requireText(workflow, 'node scripts/measure-webgpu-delivery-cost.mjs', 'Android workflow');
for (const marker of [
  "grep -q 'android:appCategory=\"game\"'",
  "grep -q 'android:resizeableActivity=\"true\"'",
  "! grep -q 'android:screenOrientation='",
  'system-images;android-${api_level};google_apis;x86_64',
  'Smoke test Android 16 large-screen resize path',
  'api-level: 36',
  'bash scripts/android-large-screen-smoke.sh',
  'android-large-screen.txt',
  'android-large-screen-portrait.json',
  'android-large-screen-resized.json',
  'android-large-screen-portrait.png',
  'android-large-screen-resized.png',
  'android-large-screen-logcat.txt',
]) requireText(workflow, marker, 'P25-B Android 16 large-screen workflow');
requireText(workflow, 'p21f3-webgpu-delivery.json', 'Android workflow');
for (const marker of [
  'ironshade-vector-android-debug-qa',
  'Ironshade-Vector-Android-Debug.apk',
  'android-debug-artifact-metadata.txt',
  'distributable=false',
  'ironshade-vector-android-release',
  'Ironshade-Vector-Android-Release.apk',
  'android-release-artifact-metadata.txt',
  'distributable=true',
  'persistent_keystore=true',
  'android-release-apk-signing.txt',
  'test \"$candidate_signer\" = \"$baseline_signer\"',
]) requireText(workflow, marker, 'P25-A signing separation');
if (workflow.includes('Ironshade-Vector-Android-Beta.apk')) {
  throw new Error('P25-A distributable/debug artifacts must not use the ambiguous Beta APK name');
}
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
  'ANDROID_P20F1_REPEATABLE_SETTLEMENT_PASS contracts=3 ',
  'ANDROID_P20F2_REPEATABLE_PRESENTATION_PASS family=${family}',
  'android-repeatable-regression.png',
  'android-repeatable-regression-logcat.txt',
  'ANDROID_P20E_REPEATABLE_JOB_PASS',
]) requireText(repeatableShell, marker, 'repeatable-family shell');

for (const marker of [
  'verify-authored-operator',
  'verify-authored-enemies',
  'verify-authored-weapons',
  'verify-authored-refinery',
]) requireText(extendedShell, marker, 'extended Android shell');

for (const marker of [
  'ANDROID_SMOKE_APK',
  'adb install -r',
  'node scripts/browser-chapter3-playthrough.mjs',
  'CHAPTER3_INTERACTION_MODE=touch',
  'android-chapter3-regression.txt',
  'android-chapter3-regression-logcat.txt',
  'android-chapter3-playthrough.png',
  'android-chapter3-playthrough.json',
  'ANDROID_CHAPTER3_PLAYTHROUGH_PASS',
  'ANDROID_CHAPTER3_REGRESSION_JOB_PASS',
  'routeDecision=interactive',
  'branches=2',
  'crashCheck=clean',
]) requireText(chapter3Shell, marker, 'Chapter 3 regression shell');

for (const checkpoint of [
  '"label": "lv15-start"',
  '"label": "lv16-gate"',
  '"label": "lv17-gate"',
  '"label": "lv18-gate"',
  '"label": "route-decision"',
  '"label": "exposed-route-live"',
  '"label": "exposed-complete"',
  '"label": "held-complete"',
]) requireText(chapter3Shell, checkpoint, 'Chapter 3 regression shell');

for (const marker of [
  'async function ensureQaState()',
  'operator intake',
  'select vanguard class',
  'confirm vanguard',
  'CHAPTER3_QA_STATE_READY source=fresh-intake',
  'await ensureQaState();',
]) requireText(chapter3Script, marker, 'Chapter 3 playthrough bootstrap');

for (const marker of [
  'ANDROID_SMOKE_APK',
  'adb install -r',
  'python3 scripts/android-settings-playtest.py',
  'android-settings-regression.txt',
  'android-settings-regression-logcat.txt',
  'ANDROID_SETTINGS_PLAYTEST_START',
  'ANDROID_SETTINGS_VISUAL_DENSITY_PASS',
  'ANDROID_SETTINGS_RELAUNCH_PASS',
  'ANDROID_SETTINGS_PLAYTEST_PASS',
  'ANDROID_SETTINGS_REGRESSION_JOB_PASS',
  'apk=reused',
  'crashCheck=clean',
]) requireText(settingsShell, marker, 'Settings regression shell');

for (const marker of [
  'adb("shell", "input", "tap"',
  'adb("shell", "uiautomator", "dump"',
  'adb("shell", "pm", "clear", PACKAGE',
  'adb("shell", "am", "force-stop", PACKAGE',
  'ANDROID_SETTINGS_PLAYTEST_START mode=black-box game-input=adb accessibility=uiautomator screenshots=true dom=false cdp=false storage=false',
  'ANDROID_SETTINGS_VISUAL_DENSITY_PASS',
  'ANDROID_SETTINGS_RELAUNCH_PASS',
  'ANDROID_SETTINGS_PLAYTEST_PASS',
  'shot("06-command-default")',
  'shot("07-command-compact")',
  'shot("08-command-compact-relaunch")',
]) requireText(settingsScript, marker, 'black-box Settings script');

for (const forbidden of ['CDP_ENDPOINT', 'localStorage.setItem', 'document.querySelector']) {
  if (settingsShell.includes(forbidden)) throw new Error(`Settings regression shell must remain black-box: ${forbidden}`);
}

if (fs.existsSync(new URL('../.github/workflows/settings-playtest.yml', import.meta.url))) {
  throw new Error('stale beta-pinned Settings workflow must be removed after extraction');
}

for (const artifact of [
  'Ironshade-Vector-Android-Debug.apk',
  'Ironshade-Vector-Android-Debug.sha256',
  'Ironshade-Vector-Android-Smoke.apk',
  'Ironshade-Vector-Android-Smoke.sha256',
  'android-fast-logcat.txt',
  'android-fast-smoke.png',
  'android-fast-resume.png',
  'android-p21f1-webgpu.png',
  'android-p21f3-webgpu.json',
  'p21f3-webgpu-delivery.json',
]) requireText(workflow, artifact, 'Android workflow artifact upload');

for (const marker of [
  'settings-regression:',
  "github.event_name == 'schedule'",
  'needs: build-apk',
  'actions/download-artifact@v8',
  'bash scripts/android-settings-regression.sh',
  'ironshade-vector-settings-regression',
  'android-settings-regression.txt',
  'android-settings-regression-logcat.txt',
  'android-settings-*.png',
]) requireText(workflow, marker, 'Settings regression workflow');

const settingsJobStart = workflow.indexOf('  settings-regression:');
const repeatableJobStart = workflow.indexOf('  repeatable-family-regression:');
if (settingsJobStart < 0 || repeatableJobStart < 0) throw new Error('Android workflow missing dedicated extended jobs');
const settingsJobText = workflow.slice(settingsJobStart);
if (!settingsJobText.includes('needs: build-apk')) throw new Error('Settings regression must depend only on shared APK build');
if (settingsJobText.includes('needs: repeatable-family-regression')) throw new Error('Settings regression must run in parallel with repeatable-family regression');

for (const marker of [
  'chapter3-regression:',
  "github.event_name == 'schedule'",
  'needs: build-apk',
  'actions/download-artifact@v8',
  'bash scripts/android-chapter3-regression.sh',
  'ironshade-vector-chapter3-regression',
  'android-chapter3-regression.txt',
  'android-chapter3-regression-logcat.txt',
  'android-chapter3-playthrough.png',
  'android-chapter3-playthrough.json',
]) requireText(workflow, marker, 'Chapter 3 regression workflow');

const chapter3JobStart = workflow.indexOf('  chapter3-regression:');
if (chapter3JobStart < 0) throw new Error('Android workflow missing dedicated Chapter 3 job');
const chapter3JobText = workflow.slice(chapter3JobStart);
if (!chapter3JobText.includes('needs: build-apk')) throw new Error('Chapter 3 regression must depend only on shared APK build');
if (chapter3JobText.includes('needs: repeatable-family-regression') || chapter3JobText.includes('needs: settings-regression')) {
  throw new Error('Chapter 3 regression must run in parallel with other extended Android jobs');
}


for (const marker of [
  'repeatable-family-regression:',
  "github.event_name == 'schedule'",
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


for (const marker of [
  'verification_mode:',
  "default: full",
  "type: choice",
  "- cron: '0 9 * * 1'",
  "inputs.verification_mode == 'full'",
  "inputs.require_release_signing",
]) requireText(workflow, marker, 'P23-F full verification trigger');

const fullJobCondition = "github.event_name == 'schedule' || github.ref == 'refs/heads/android/capacitor-apk' || github.ref == 'refs/heads/android/full-regression' || (github.event_name == 'workflow_dispatch' && (inputs.verification_mode == 'full' || inputs.require_release_signing))";
for (const jobName of [
  'repeatable-family-regression:',
  'settings-regression:',
  'chapter3-regression:',
  'extended-runtime-regression:',
]) {
  const start = workflow.indexOf(`  ${jobName}`);
  if (start < 0) throw new Error(`P23-F missing full-verification job: ${jobName}`);
  const remainder = workflow.slice(start + 3);
  const nextJobMatch = remainder.match(/\n  [a-z0-9-]+:\n/i);
  const end = nextJobMatch ? start + 3 + nextJobMatch.index : workflow.length;
  const text = workflow.slice(start, end);
  requireText(text, fullJobCondition, `P23-F ${jobName} condition`);
  requireText(text, 'needs: build-apk', `P23-F ${jobName} shared APK dependency`);
}

const runtimeJobStart = workflow.indexOf('  extended-runtime-regression:');
const fullGateStart = workflow.indexOf('  full-android-verification:');
if (runtimeJobStart < 0 || fullGateStart < 0) throw new Error('P23-F missing runtime or aggregate job');
const runtimeJobText = workflow.slice(runtimeJobStart, fullGateStart);
for (const marker of [
  'actions/download-artifact@v8',
  'Ironshade-Vector-Android-Smoke.apk',
  'sha256sum -c Ironshade-Vector-Android-Smoke.sha256',
  'bash scripts/android-runtime-smoke.sh',
  'android-runtime-regression.txt',
  'android-runtime-smoke.png',
  'android-network-planner-persistence.png',
  'android-runtime-logcat.txt',
  'ironshade-vector-extended-runtime-regression',
]) requireText(runtimeJobText, marker, 'P23-F extended runtime job');

for (const marker of [
  'full-android-verification:',
  'if: always() &&',
  '- repeatable-family-regression',
  '- settings-regression',
  '- chapter3-regression',
  '- extended-runtime-regression',
  'needs.build-apk.result',
  'needs.repeatable-family-regression.result',
  'needs.settings-regression.result',
  'needs.chapter3-regression.result',
  'needs.extended-runtime-regression.result',
  'Ironshade-Vector-Android-Debug.apk',
  'android-repeatable-regression.txt',
  'android-settings-10-command-final-compact.png',
  'android-chapter3-playthrough.json',
  'android-network-planner-persistence.png',
  'ANDROID_FULL_VERIFICATION_PASS',
  'ironshade-vector-full-android-verification',
]) requireText(workflow.slice(fullGateStart), marker, 'P23-F aggregate full verification');

if (workflow.slice(fullGateStart).includes('needs: build-apk\n')) {
  throw new Error('P23-F aggregate gate must require all full-verification jobs, not only build-apk');
}

console.log('ANDROID_FAST_SMOKE_CONTRACT_PASS entry=scripts/android-fast-smoke.sh defaultPush=phone+android16-large-screen repeatable=dedicated-dispatch settings=dedicated-dispatch chapter3=dedicated-full-regression extended=parallel-runtime fullGate=aggregated scheduled=weekly manualMode=full-or-fast browser=required productionBuild=required touch=required lifecycle=required largeScreen=portrait+live-resize artifacts=required failFast=required');


for (const marker of [
  'P21F3_WEBGPU_DELIVERY_PASS',
  'three.webgpu-',
  'three.tsl-',
  'webGpuRefineryRenderer-',
  'incrementalCompressedBytes',
  'compressedPercentOfApk',
]) requireText(p21f3Delivery, marker, 'P21-F3 delivery measurement');
