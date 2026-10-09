#!/usr/bin/env bash
set -euo pipefail

SMOKE_APK="${ANDROID_SMOKE_APK:-Ironshade-Vector-Android-Smoke.apk}"
PACKAGE="app.ironshade.vector"
ACTIVITY="${PACKAGE}/.MainActivity"
REPORT="android-large-screen.txt"

cleanup() {
  adb shell wm size reset >/dev/null 2>&1 || true
  adb shell wm density reset >/dev/null 2>&1 || true
  adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
  adb shell pm clear "$PACKAGE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [[ ! -s "$SMOKE_APK" ]]; then
  echo "Android large-screen smoke APK not found: $SMOKE_APK" >&2
  exit 1
fi

adb wait-for-device
adb shell wm size reset
adb shell wm density reset
adb shell wm size 1600x2560
adb shell wm density 320
adb shell settings put system accelerometer_rotation 0 >/dev/null 2>&1 || true
adb shell settings put system user_rotation 0 >/dev/null 2>&1 || true
sleep 3

{
  echo "ANDROID_P25B_LARGE_SCREEN_START api=$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  adb shell wm size
  adb shell wm density
} | tee "$REPORT"

test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = "36"
adb install -r "$SMOKE_APK"
adb logcat -c
adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$ACTIVITY" | tee -a "$REPORT"

timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
PORTRAIT_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
test -n "$PORTRAIT_PID"

adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:webview_devtools_remote_${PORTRAIT_PID}"
ANDROID_P27D5_PHASE=large-screen CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-babylon-lifecycle-smoke.mjs | tee -a "$REPORT"
ANDROID_LARGE_SCREEN_PHASE=portrait ANDROID_LARGE_SCREEN_REPORT_PATH=android-large-screen-portrait.json CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-large-screen-smoke.mjs | tee -a "$REPORT"
adb exec-out screencap -p > android-large-screen-portrait.png
test -s android-large-screen-portrait.png

adb shell wm size 1800x1400
sleep 5
RESIZED_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ -z "$RESIZED_PID" || "$RESIZED_PID" != "$PORTRAIT_PID" ]]; then
  echo "Ironshade Vector process changed during large-screen resize: before=$PORTRAIT_PID after=$RESIZED_PID" >&2
  exit 1
fi

adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:webview_devtools_remote_${RESIZED_PID}"
ANDROID_LARGE_SCREEN_PHASE=resized ANDROID_LARGE_SCREEN_REPORT_PATH=android-large-screen-resized.json CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-large-screen-smoke.mjs | tee -a "$REPORT"
adb exec-out screencap -p > android-large-screen-resized.png
test -s android-large-screen-resized.png

adb shell dumpsys activity activities | grep -E 'mResumedActivity|mCurrentFocus|app\.ironshade\.vector' | head -n 30 | tee -a "$REPORT" || true
adb logcat -d > android-large-screen-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-large-screen-logcat.txt; then
  echo 'Android large-screen runtime crash detected.' >&2
  exit 1
fi

echo "ANDROID_P25B_LARGE_SCREEN_PASS api=36 initial=portrait-sw>=600 resize=landscape-style-sw>=600 processPreserved=true webViewPreserved=true babylon=webgl2 rendererPreserved=true overflow=none crashCheck=clean" | tee -a "$REPORT"
