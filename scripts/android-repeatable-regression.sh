#!/usr/bin/env bash
set -euo pipefail

STARTED_AT="$(date +%s)"
SMOKE_APK="${ANDROID_SMOKE_APK:-Ironshade-Vector-Android-Smoke.apk}"
PACKAGE="app.ironshade.vector"
ACTIVITY="${PACKAGE}/.MainActivity"

if [[ ! -s "$SMOKE_APK" ]]; then
  echo "Repeatable-family Android APK not found: $SMOKE_APK" >&2
  exit 1
fi

adb wait-for-device
adb install -r "$SMOKE_APK"
adb shell pm clear "$PACKAGE" >/dev/null
adb logcat -c
adb shell am start -W -n "$ACTIVITY"

timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
APP_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ -z "$APP_PID" ]]; then
  echo "Ironshade Vector process did not stay running for repeatable-family regression." >&2
  exit 1
fi

SOCKET="webview_devtools_remote_${APP_PID}"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:${SOCKET}"

# Android WebView can expose its CDP target a few frames before the Activity's
# visual viewport is established. Require three consecutive usable viewport
# samples so the first class-intake geometry assertion measures the real screen
# rather than a transient 0x0 viewport during immersive startup.
node --input-type=module <<'NODE'
const endpoint = 'http://127.0.0.1:9222';
const deadline = Date.now() + 30_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let stableSamples = 0;
let lastSample = null;

async function sampleViewport() {
  const targets = await (await fetch(`${endpoint}/json/list`)).json();
  const target = targets.find(candidate => candidate.webSocketDebuggerUrl && (
    candidate.title === 'Ironshade Vector'
    || (/ironshade/i.test(candidate.title ?? '') && /localhost/i.test(candidate.url ?? ''))
  ));
  if (!target) return null;

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('viewport preflight websocket timeout'));
    }, 3_000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('viewport preflight websocket error'));
    }, { once: true });
  });

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('viewport preflight evaluate timeout')), 3_000);
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) return;
      clearTimeout(timer);
      resolve(message.result?.result?.value ?? null);
    }, { once: true });
    socket.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `({
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          visualWidth: window.visualViewport?.width ?? 0,
          visualHeight: window.visualViewport?.height ?? 0,
          readyState: document.readyState,
        })`,
        returnByValue: true,
      },
    }));
  }).finally(() => socket.close());
  return result;
}

while (Date.now() < deadline) {
  try {
    const sample = await sampleViewport();
    if (sample) lastSample = sample;
    const width = sample?.visualWidth > 0 ? sample.visualWidth : sample?.innerWidth ?? 0;
    const height = sample?.visualHeight > 0 ? sample.visualHeight : sample?.innerHeight ?? 0;
    if (sample?.readyState === 'complete' && width > 0 && height > 0) stableSamples += 1;
    else stableSamples = 0;
    if (stableSamples >= 3) {
      console.log(`ANDROID_WEBVIEW_VIEWPORT_READY width=${Math.round(width)} height=${Math.round(height)} samples=${stableSamples}`);
      process.exit(0);
    }
  } catch {
    stableSamples = 0;
  }
  await sleep(500);
}

throw new Error(`Android WebView viewport did not stabilize before repeatable regression: ${JSON.stringify(lastSample)}`);
NODE

ANDROID_P20E_REPEATABLE_ONLY=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs | tee android-repeatable-regression.txt

for family in stabilization salvage boarding; do
  grep -q "ANDROID_P20E_REPEATABLE_FAMILY_PASS family=${family} " android-repeatable-regression.txt
  grep -q "ANDROID_P20F2_REPEATABLE_PRESENTATION_PASS family=${family} " android-repeatable-regression.txt
done
grep -q 'ANDROID_P20E_REPEATABLE_PLAY_PASS families=stabilization+salvage+boarding completions=3' android-repeatable-regression.txt
grep -q 'ANDROID_P20E_REPEATABLE_REGRESSION_PASS families=stabilization+salvage+boarding completions=3' android-repeatable-regression.txt
grep -q 'ANDROID_P20F1_REPEATABLE_SETTLEMENT_PASS contracts=3 ' android-repeatable-regression.txt

adb exec-out screencap -p > android-repeatable-regression.png
test -s android-repeatable-regression.png

adb logcat -d > android-repeatable-regression-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-repeatable-regression-logcat.txt; then
  echo 'Repeatable-family Android runtime crash detected.' >&2
  exit 1
fi

ELAPSED_SECONDS=$(( $(date +%s) - STARTED_AT ))
echo "ANDROID_P20E_REPEATABLE_JOB_PASS families=stabilization+salvage+boarding completions=3 apk=reused crashCheck=clean elapsedSeconds=${ELAPSED_SECONDS}"

adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
