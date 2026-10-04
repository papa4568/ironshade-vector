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

confirm_immersive_mode_for_smoke() {
  adb shell settings put secure immersive_mode_confirmations confirmed >/dev/null 2>&1 || true

  local remote_dump='/sdcard/ironshade-fast-smoke-window.xml'
  local dump=''
  local coords=''
  local x=''
  local y=''
  for attempt in 1 2 3 4 5; do
    adb shell uiautomator dump --compressed "$remote_dump" >/dev/null 2>&1 || true
    dump="$(adb shell cat "$remote_dump" 2>/dev/null | tr -d '\r' || true)"
    if [[ "$dump" != *'text="Viewing full screen"'* && "$dump" != *'text="Got it"'* ]]; then
      echo "ANDROID_IMMERSIVE_CONFIRMATION_PASS state=clear attempt=$attempt"
      return 0
    fi

    coords="$(printf '%s' "$dump" | python3 -c 'import re, sys, xml.etree.ElementTree as ET
text = sys.stdin.read()
try:
    root = ET.fromstring(text)
except ET.ParseError:
    raise SystemExit(0)
for node in root.iter("node"):
    if node.attrib.get("text") != "Got it":
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if match:
        left, top, right, bottom = map(int, match.groups())
        print((left + right) // 2, (top + bottom) // 2)
        break')"
    if [[ -n "$coords" ]]; then
      read -r x y <<< "$coords"
      adb shell input tap "$x" "$y"
    fi
    sleep 1
  done

  echo "Immersive-mode SystemUI confirmation still covers the app after deterministic dismissal attempts." >&2
  printf '%s\n' "$dump" >&2
  return 1
}

wait_for_process() {
  timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
  adb shell pidof "$PACKAGE" | tr -d '\r'
}

connect_cdp() {
  local pid="$1"
  local socket="webview_devtools_remote_${pid}"
  adb forward --remove tcp:9222 >/dev/null 2>&1 || true
  adb forward tcp:9222 "localabstract:${socket}"
}

adb wait-for-device
adb shell settings put secure immersive_mode_confirmations confirmed >/dev/null 2>&1 || true
adb install -r "$SMOKE_APK"
adb logcat -c
adb shell am force-stop "$PACKAGE"
adb shell am start -n "$ACTIVITY"
confirm_immersive_mode_for_smoke

APP_PID="$(wait_for_process)"
if [[ -z "$APP_PID" ]]; then
  echo "Ironshade Vector process did not stay running for fast smoke." >&2
  exit 1
fi

connect_cdp "$APP_PID"
ANDROID_FAST_SMOKE=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs
adb exec-out screencap -p > android-fast-smoke.png
test -s android-fast-smoke.png

adb logcat -d > android-fast-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-fast-logcat.txt; then
  echo 'Fast Android runtime crash detected.' >&2
  exit 1
fi

ELAPSED_SECONDS=$(( $(date +%s) - STARTED_AT ))
echo "ANDROID_FAST_EMULATOR_PASS pid=${APP_PID} route=ship>contracts>combat touch=management+move+fire+ability+dodge+act controller=pointer+touch p27d7=babylon-production-default performance=js-heap crashCheck=clean screenshots=1 elapsedSeconds=${ELAPSED_SECONDS}"

adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
adb shell pm clear "$PACKAGE" >/dev/null 2>&1 || true
