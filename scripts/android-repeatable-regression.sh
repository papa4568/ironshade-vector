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
ANDROID_P20E_REPEATABLE_ONLY=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs | tee android-repeatable-regression.txt

for family in stabilization salvage boarding; do
  grep -q "ANDROID_P20E_REPEATABLE_FAMILY_PASS family=${family} " android-repeatable-regression.txt
done
grep -q 'ANDROID_P20E_REPEATABLE_PLAY_PASS families=stabilization+salvage+boarding completions=3' android-repeatable-regression.txt
grep -q 'ANDROID_P20E_REPEATABLE_REGRESSION_PASS families=stabilization+salvage+boarding completions=3' android-repeatable-regression.txt

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
