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
ANDROID_P27D5_PHASE=cache-lifecycle ANDROID_P27D5_CDP_TIMEOUT_MS=90000 \
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

# Always preserve unmodified post-resume framebuffer; on failure also retain
# Android's process/window/renderer diagnostic state before emulator teardown.
adb exec-out screencap -p > android-p28f6-resume-screen.png
if ! ANDROID_P27D5_PHASE=cache-resume ANDROID_P27D5_CDP_TIMEOUT_MS=90000 \
  ANDROID_P27D5_REPORT_PATH=android-p28f6-resume.json \
  CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-babylon-lifecycle-smoke.mjs; then
  {
    echo '--- process ---'
    adb shell pidof "$PACKAGE" || true
    echo '--- forwarded DevTools sockets ---'
    adb forward --list || true
    echo '--- resumed activity ---'
    adb shell dumpsys activity activities | grep -E -m 8 'mResumedActivity|topResumedActivity|mCurrentFocus|app.ironshade.vector' || true
    echo '--- memory ---'
    adb shell dumpsys meminfo "$PACKAGE" | head -n 90 || true
    echo '--- WebView targets ---'
    curl --max-time 5 -fsS http://127.0.0.1:9222/json/list || true
  } > android-p28f6-resume-diagnostics.txt 2>&1
  adb logcat -d -v threadtime > android-p28f6-resume-logcat.txt || true
  echo 'P28-F6 process-preserving Android resume failed; forensic evidence retained.' >&2
  exit 1
fi
echo "ANDROID_P28F6_HEAVY_LIFECYCLE_PASS cold=authored-cache rendererRestart=zero-owners missionReentry=zero-owners processResume=preserved touch=existing-fast-smoke"
