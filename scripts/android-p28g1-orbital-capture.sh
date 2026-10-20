#!/usr/bin/env bash
# Source-verified Pixel 7 Pro emulator visual evidence, never physical QA.
set -euo pipefail
PACKAGE=app.ironshade.vector
ACTIVITY="$PACKAGE/.MainActivity"
adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
adb shell pm clear "$PACKAGE" >/dev/null
adb shell am start -W -n "$ACTIVITY"
timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
test -n "$PID"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:webview_devtools_remote_${PID}"
CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-p28g1-orbital-capture.mjs
# Capture the actual Android display in addition to the Chrome WebView frames.
adb exec-out screencap -p > android-p28g1-orbital-station-device.png
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const png = readFileSync("android-p28g1-orbital-station-device.png");
  if (png.length < 20000 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("P28-G1 actual Android screencap was blank or invalid");
  }
  const report = JSON.parse(readFileSync("android-p28g1-orbital-station.json", "utf8"));
  if (report.capturedRoute !== "orbital-station" || report.premium !== "ready" || report.groundedProps !== 25) {
    throw new Error("P28-G1 Android capture report is incomplete");
  }
'
adb logcat -d > android-p28g1-orbital-station-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-p28g1-orbital-station-logcat.txt; then
  echo 'P28-G1 Android capture suffered a fatal exception.' >&2
  exit 1
fi
echo "ANDROID_P28G1_FLAGSHIP_CAPTURE_PASS device=pixel_7_pro emulator=api35 captures=webview-normal+webview-action+android-display route=orbital-station assets=premium-ktx2+ibl+actor-prop-grounding"
