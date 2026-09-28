#!/usr/bin/env bash
set -euo pipefail

STARTED_AT="$(date +%s)"
SMOKE_APK="${ANDROID_SMOKE_APK:-Ironshade-Vector-Android-Smoke.apk}"
PACKAGE="app.ironshade.vector"
ACTIVITY="${PACKAGE}/.MainActivity"

if [[ ! -s "$SMOKE_APK" ]]; then
  echo "Chapter 3 Android APK not found: $SMOKE_APK" >&2
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
  echo "Ironshade Vector process did not stay running for Chapter 3 regression." >&2
  exit 1
fi

SOCKET="webview_devtools_remote_${APP_PID}"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:${SOCKET}"

set +e
CHAPTER3_INTERACTION_MODE=touch \
CHAPTER3_TARGET_TITLE='Ironshade Vector' \
CDP_ENDPOINT=http://127.0.0.1:9222 \
BROWSER_E2E_APP_URL=https://localhost/ \
BROWSER_E2E_VIEWPORT=android-emulator \
BROWSER_E2E_CHAPTER3_SCREENSHOT=android-chapter3-playthrough.png \
BROWSER_E2E_CHAPTER3_REPORT=android-chapter3-playthrough.json \
node scripts/browser-chapter3-playthrough.mjs 2>&1 | tee android-chapter3-regression.txt
PLAYTHROUGH_STATUS=${PIPESTATUS[0]}
set -e

adb logcat -d > android-chapter3-regression-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-chapter3-regression-logcat.txt; then
  echo 'Chapter 3 Android runtime crash detected.' >&2
  exit 1
fi

if [[ "$PLAYTHROUGH_STATUS" -ne 0 ]]; then
  echo "Chapter 3 Android playthrough failed with exit code $PLAYTHROUGH_STATUS." >&2
  exit "$PLAYTHROUGH_STATUS"
fi

test -s android-chapter3-playthrough.png
test -s android-chapter3-playthrough.json
grep -q 'ANDROID_CHAPTER3_PLAYTHROUGH_PASS' android-chapter3-regression.txt
grep -q '"result": "PASS"' android-chapter3-playthrough.json
grep -q '"runtime": "android-webview"' android-chapter3-playthrough.json
grep -q '"interactionMode": "touch"' android-chapter3-playthrough.json
for checkpoint in '"label": "lv15-start"' '"label": "lv16-gate"' '"label": "lv17-gate"' '"label": "lv18-gate"' '"label": "route-decision"' '"label": "exposed-route-live"' '"label": "exposed-complete"' '"label": "held-complete"'; do
  grep -q "$checkpoint" android-chapter3-playthrough.json
done

ELAPSED_SECONDS=$(( $(date +%s) - STARTED_AT ))
echo "ANDROID_CHAPTER3_REGRESSION_JOB_PASS apk=reused interaction=touch routeDecision=interactive branches=2 screenshot=verified report=verified crashCheck=clean elapsedSeconds=${ELAPSED_SECONDS}"

adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
