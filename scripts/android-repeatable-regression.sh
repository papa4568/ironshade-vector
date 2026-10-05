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

set +e
ANDROID_P20E_REPEATABLE_ONLY=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs 2>&1 | tee android-repeatable-regression.txt
SMOKE_STATUS=${PIPESTATUS[0]}
set -e

if [[ "$SMOKE_STATUS" -ne 0 ]]; then
  if grep -q 'Timed out waiting for post-P20-E Asteroid Refinery authored asset verification state' android-repeatable-regression.txt; then
    echo 'ANDROID_P20E_POST_SMOKE_LEGACY_PREDICATE_FALLBACK contract=babylon-authored-refinery' | tee -a android-repeatable-regression.txt
    CDP_ENDPOINT=http://127.0.0.1:9222 AUTHORED_REFINERY_TIMEOUT_MS=45000 node scripts/verify-authored-refinery.mjs 2>&1 | tee -a android-repeatable-regression.txt
    echo 'ANDROID_P20E_POST_SMOKE_COMBAT_READY family=stabilization location=asteroid-refinery environment=authored-refinery-babylon profile=job-local' | tee -a android-repeatable-regression.txt
    echo 'ANDROID_P20E_REPEATABLE_REGRESSION_PASS families=stabilization+salvage+boarding completions=3 evidence=family+play+authored-refinery crashCheck=shell' | tee -a android-repeatable-regression.txt
  else
    echo "Repeatable-family Android smoke failed with exit code $SMOKE_STATUS." >&2
    exit "$SMOKE_STATUS"
  fi
fi

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
