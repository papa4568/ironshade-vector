#!/usr/bin/env bash
set -euo pipefail

STARTED_AT="$(date +%s)"
SMOKE_APK="${ANDROID_SMOKE_APK:-android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE="app.ironshade.vector"
ACTIVITY="${PACKAGE}/.MainActivity"

if [[ ! -s "$SMOKE_APK" ]]; then
  echo "Fast Android smoke APK not found: $SMOKE_APK" >&2
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
  echo "Ironshade Vector process did not stay running for fast smoke." >&2
  exit 1
fi

SOCKET="webview_devtools_remote_${APP_PID}"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:${SOCKET}"
ANDROID_FAST_SMOKE=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs

adb exec-out screencap -p > android-fast-smoke.png
test -s android-fast-smoke.png

LIFECYCLE_ATTEMPT=1
while true; do
  adb shell input keyevent KEYCODE_HOME
  sleep 2
  adb shell am start -W --activity-reorder-to-front -n "$ACTIVITY"
  timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
  RESUME_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
  if [[ -z "$RESUME_PID" ]]; then
    echo "Ironshade Vector process did not resume during fast smoke." >&2
    exit 1
  fi
  if [[ "$RESUME_PID" == "$APP_PID" ]]; then
    break
  fi

  echo "ANDROID_FAST_PROCESS_RECLAIM before=$APP_PID after=$RESUME_PID attempt=$LIFECYCLE_ATTEMPT // re-establishing fast combat before retrying pause/resume"
  if [[ "$LIFECYCLE_ATTEMPT" -ge 2 ]]; then
    echo "Ironshade Vector process was reclaimed during two consecutive fast pause/resume attempts." >&2
    exit 1
  fi

  APP_PID="$RESUME_PID"
  RESUME_SOCKET="webview_devtools_remote_$APP_PID"
  adb forward --remove tcp:9222 >/dev/null 2>&1 || true
  adb forward tcp:9222 "localabstract:$RESUME_SOCKET"
  ANDROID_FAST_SMOKE=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs
  LIFECYCLE_ATTEMPT=$((LIFECYCLE_ATTEMPT + 1))
done

RESUME_SOCKET="webview_devtools_remote_${RESUME_PID}"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:${RESUME_SOCKET}"
ANDROID_FAST_RESUME_CHECK=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs

adb exec-out screencap -p > android-fast-resume.png
test -s android-fast-resume.png

ANDROID_P21F1_CHECK=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs
adb exec-out screencap -p > android-p21f1-webgpu.png
test -s android-p21f1-webgpu.png

ANDROID_P27D5_PHASE=interaction ANDROID_P27D5_REPORT_PATH=android-p27d5-babylon-interaction.json CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-babylon-lifecycle-smoke.mjs
adb exec-out screencap -p > android-p27d5-babylon.png
test -s android-p27d5-babylon.png

P27D5_LIFECYCLE_ATTEMPT=1
while true; do
  adb shell input keyevent KEYCODE_HOME
  sleep 2
  adb shell am start -W --activity-reorder-to-front -n "$ACTIVITY"
  timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
  P27D5_RESUME_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
  if [[ -z "$P27D5_RESUME_PID" ]]; then
    echo "Ironshade Vector process did not resume during P27-D5 Babylon lifecycle smoke." >&2
    exit 1
  fi
  if [[ "$P27D5_RESUME_PID" == "$APP_PID" ]]; then
    break
  fi

  echo "ANDROID_P27D5_PROCESS_RECLAIM before=$APP_PID after=$P27D5_RESUME_PID attempt=$P27D5_LIFECYCLE_ATTEMPT // re-establishing Babylon combat before retrying pause/resume"
  if [[ "$P27D5_LIFECYCLE_ATTEMPT" -ge 2 ]]; then
    echo "Ironshade Vector process was reclaimed during two consecutive P27-D5 Babylon pause/resume attempts." >&2
    exit 1
  fi

  APP_PID="$P27D5_RESUME_PID"
  P27D5_SOCKET="webview_devtools_remote_$APP_PID"
  adb forward --remove tcp:9222 >/dev/null 2>&1 || true
  adb forward tcp:9222 "localabstract:$P27D5_SOCKET"
  ANDROID_P27D5_PHASE=interaction ANDROID_P27D5_REPORT_PATH=android-p27d5-babylon-interaction.json CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-babylon-lifecycle-smoke.mjs
  P27D5_LIFECYCLE_ATTEMPT=$((P27D5_LIFECYCLE_ATTEMPT + 1))
done

P27D5_SOCKET="webview_devtools_remote_$P27D5_RESUME_PID"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:$P27D5_SOCKET"
ANDROID_P27D5_PHASE=resume ANDROID_P27D5_REPORT_PATH=android-p27d5-babylon-resume.json CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-babylon-lifecycle-smoke.mjs
adb exec-out screencap -p > android-p27d5-babylon-resume.png
test -s android-p27d5-babylon-resume.png

adb logcat -d > android-fast-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-fast-logcat.txt; then
  echo 'Fast Android runtime crash detected.' >&2
  exit 1
fi

ELAPSED_SECONDS=$(( $(date +%s) - STARTED_AT ))
echo "ANDROID_FAST_EMULATOR_PASS pid=${APP_PID} resumePid=${P27D5_RESUME_PID} route=ship>contracts>combat touch=management+move+fire+ability+dodge+act lifecycle=pause-resume p21f1=webgpu-or-fallback p27d5=babylon-webgl2+touch+controller+renderer-reentry+mission-reentry+resume crashCheck=clean screenshots=5 elapsedSeconds=${ELAPSED_SECONDS}"

adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
adb shell pm clear "$PACKAGE" >/dev/null 2>&1 || true
