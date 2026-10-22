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
CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-p28g4-jovian-capture.mjs
node scripts/verify-p28g4-gameplay-frames.mjs android-p28g4-jovian-harvester-normal.png android-p28g4-jovian-harvester-action.png android-p28g4-jovian-harvester-pixel-report.json android-p28g4-jovian-harvester.json
# Capture the actual Android display in addition to the Chrome WebView frames.
adb exec-out screencap -p > android-p28g4-jovian-harvester-device.png
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const png = readFileSync("android-p28g4-jovian-harvester-device.png");
  if (png.length < 20000 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("P28-G4 actual Android screencap was blank or invalid");
  }
  const report = JSON.parse(readFileSync("android-p28g4-jovian-harvester.json", "utf8"));
  if (report.capturedRoute !== "jovian-harvester" || report.artState !== "ready" || report.fallbackObjects !== 0 || report.authoredObjects !== report.mappedObjects) {
    throw new Error("P28-G4 Android capture report is incomplete");
  }
'
adb logcat -d > android-p28g4-jovian-harvester-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-p28g4-jovian-harvester-logcat.txt; then
  echo 'P28-G4 Android capture suffered a fatal exception.' >&2
  exit 1
fi
echo "ANDROID_P28G4_FLAGSHIP_CAPTURE_PASS device=pixel_7_pro emulator=api35 captures=webview-normal+webview-action+android-display route=jovian-harvester assets=authored-world+deck-inlays"
