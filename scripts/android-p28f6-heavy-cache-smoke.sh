#!/usr/bin/env bash
# Real Android WebView acceptance proof for P28-F6. Deliberately separate from
# android-fast-smoke.sh's short product journey and migration exclusions.
set -euo pipefail
PACKAGE="app.ironshade.vector"
ACTIVITY="$PACKAGE/.MainActivity"
adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$ACTIVITY"
timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
test -n "$PID"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:webview_devtools_remote_${PID}"
ANDROID_P27D5_PHASE=interaction ANDROID_P27D5_CDP_TIMEOUT_MS=45000 \
  ANDROID_P27D5_REPORT_PATH=android-p28f6-interaction.json \
  CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-babylon-lifecycle-smoke.mjs
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell am start -W --activity-reorder-to-front -n "$ACTIVITY"
RESUME_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ "$RESUME_PID" != "$PID" ]]; then
  echo "P28-F6 Android heavy-art lifecycle reclaimed WebView process: $PID -> $RESUME_PID" >&2
  exit 1
fi
ANDROID_P27D5_PHASE=resume ANDROID_P27D5_CDP_TIMEOUT_MS=45000 \
  ANDROID_P27D5_REPORT_PATH=android-p28f6-resume.json \
  CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-babylon-lifecycle-smoke.mjs
echo "ANDROID_P28F6_HEAVY_LIFECYCLE_PASS cold=authored-cache rendererRestart=zero-owners missionReentry=zero-owners processResume=preserved"
