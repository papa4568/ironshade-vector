#!/usr/bin/env bash
set -euo pipefail

SMOKE_APK="${ANDROID_SMOKE_APK:-android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE="app.ironshade.vector"
ACTIVITY="${PACKAGE}/.MainActivity"

if [[ ! -s "$SMOKE_APK" ]]; then
  echo "Android smoke APK not found: $SMOKE_APK" >&2
  exit 1
fi

adb wait-for-device
adb install -r "$SMOKE_APK"
adb logcat -c
adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$ACTIVITY"

timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
APP_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ -z "$APP_PID" ]]; then
  echo "Ironshade Vector process did not stay running." >&2
  exit 1
fi

SOCKET="webview_devtools_remote_${APP_PID}"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:${SOCKET}"
node scripts/android-runtime-smoke.mjs
CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/verify-authored-operator.mjs
CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/verify-authored-enemies.mjs
CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/verify-authored-weapons.mjs
CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/verify-authored-refinery.mjs

adb shell input keyevent KEYCODE_HOME
sleep 2
# Bring the existing MainActivity back to the foreground instead of launching a
# fresh activity instance, so this gate exercises Android pause/resume rather
# than a cold navigation reset.
adb shell am start -W --activity-reorder-to-front -n "$ACTIVITY"
timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
RESUME_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ -z "$RESUME_PID" ]]; then
  echo "Ironshade Vector process did not resume after backgrounding." >&2
  exit 1
fi
if [[ "$RESUME_PID" != "$APP_PID" ]]; then
  echo "Ironshade Vector process restarted instead of resuming: before=$APP_PID after=$RESUME_PID" >&2
  exit 1
fi
RESUME_SOCKET="webview_devtools_remote_${RESUME_PID}"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:${RESUME_SOCKET}"
ANDROID_RESUME_CHECK=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs

adb logcat -d > android-runtime-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-runtime-logcat.txt; then
  echo 'Android runtime crash detected.' >&2
  exit 1
fi

adb exec-out screencap -p > android-runtime-smoke.png
if [[ ! -s android-runtime-smoke.png ]]; then
  echo 'Android runtime screenshot was not captured.' >&2
  exit 1
fi

echo "ANDROID_EMULATOR_PASS pid=${APP_PID} resumePid=${RESUME_PID} route=ship>contracts>combat lifecycle=resume authoredOperator=verified authoredEnemies=verified authoredWeapons=verified authoredRefinery=verified"
