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
BROWSER_E2E_VIEWPORT=android-emulator CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/verify-authored-operator.mjs
BROWSER_E2E_VIEWPORT=android-emulator CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/verify-authored-enemies.mjs
BROWSER_E2E_VIEWPORT=android-emulator CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/verify-authored-weapons.mjs
BROWSER_E2E_VIEWPORT=android-emulator CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/verify-authored-refinery.mjs

LIFECYCLE_ATTEMPT=1
while true; do
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
  if [[ "$RESUME_PID" == "$APP_PID" ]]; then
    break
  fi

  echo "ANDROID_LIFECYCLE_PROCESS_RECLAIM before=$APP_PID after=$RESUME_PID attempt=$LIFECYCLE_ATTEMPT // re-establishing combat before retrying pause/resume"
  if [[ "$LIFECYCLE_ATTEMPT" -ge 2 ]]; then
    echo "Ironshade Vector process was reclaimed during two consecutive pause/resume attempts." >&2
    exit 1
  fi

  APP_PID="$RESUME_PID"
  RESUME_SOCKET="webview_devtools_remote_$APP_PID"
  adb forward --remove tcp:9222 >/dev/null 2>&1 || true
  adb forward tcp:9222 "localabstract:$RESUME_SOCKET"
  CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs
  LIFECYCLE_ATTEMPT=$((LIFECYCLE_ATTEMPT + 1))
done

RESUME_SOCKET="webview_devtools_remote_$RESUME_PID"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:$RESUME_SOCKET"
ANDROID_RESUME_CHECK=1 ANDROID_RESUME_PROCESS_MODE=preserved CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs

adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$ACTIVITY"
timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\\r")" ]]; do sleep 1; done'
PLANNER_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ -z "$PLANNER_PID" ]]; then
  echo "Ironshade Vector process did not cold-relaunch for planner persistence verification." >&2
  exit 1
fi
PLANNER_SOCKET="webview_devtools_remote_${PLANNER_PID}"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:${PLANNER_SOCKET}"
ANDROID_PLANNER_PERSISTENCE_CHECK=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs

adb exec-out screencap -p > android-runtime-smoke.png
if [[ ! -s android-runtime-smoke.png ]]; then
  echo 'Android runtime screenshot was not captured.' >&2
  exit 1
fi

CHAPTER3_INTERACTION_MODE=touch \
CHAPTER3_TARGET_TITLE='Ironshade Vector' \
CDP_ENDPOINT=http://127.0.0.1:9222 \
BROWSER_E2E_APP_URL=https://localhost/ \
BROWSER_E2E_VIEWPORT=android-emulator \
BROWSER_E2E_CHAPTER3_SCREENSHOT=android-chapter3-playthrough.png \
BROWSER_E2E_CHAPTER3_REPORT=android-chapter3-playthrough.json \
node scripts/browser-chapter3-playthrough.mjs

test -s android-chapter3-playthrough.png
test -s android-chapter3-playthrough.json
grep -q '"result": "PASS"' android-chapter3-playthrough.json

# P18-C requires a true process restart, not only Activity pause/resume. The persisted
# Operator Network plan is seeded through touch UI in the main smoke and verified again
# in both storage and the Progression UI after this cold relaunch.
adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$ACTIVITY"
timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
PLANNER_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ -z "$PLANNER_PID" ]]; then
  echo "Ironshade Vector process did not restart for planner persistence verification." >&2
  exit 1
fi
PLANNER_SOCKET="webview_devtools_remote_$PLANNER_PID"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:$PLANNER_SOCKET"
ANDROID_PLANNER_PERSISTENCE_CHECK=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs
adb exec-out screencap -p > android-network-planner-persistence.png
test -s android-network-planner-persistence.png

adb logcat -d > android-runtime-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-runtime-logcat.txt; then
  echo 'Android runtime crash detected.' >&2
  exit 1
fi

echo "ANDROID_EMULATOR_PASS pid=${APP_PID} resumePid=${RESUME_PID} plannerRelaunchPid=${PLANNER_PID} route=ship>contracts>combat lifecycle=resume plannerPersistence=cold-relaunch chapter3=touch-playthrough authoredOperator=verified authoredEnemies=verified authoredWeapons=verified authoredRefinery=verified"
