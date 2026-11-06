#!/usr/bin/env bash
# Source-verified Pixel 7 Pro emulator visual evidence, never physical QA.
set -euo pipefail
PACKAGE=app.ironshade.vector
ACTIVITY="$PACKAGE/.MainActivity"
APK=Ironshade-Vector-Android-Smoke.apk
# Authoritative exact-candidate Android API35/API36 smoke is mandatory in
# the PR producer. This supplemental Ice visual QA installs the same verified
# APK and independently proves real combat frames and native screenshot.
test -s "$APK"
adb install -r "$APK" >/dev/null
adb shell pm path "$PACKAGE" | grep -q '^package:'
# Preserve independent failure evidence even when a cold emulator/WebView stalls.
capture_diagnostics() {
  # The accepted framebuffer is already validated. Capture fallback diagnostics
  # only if it is absent, and never truncate it on a failed screencap.
  if [[ ! -s android-p28g5-ice-mine-device.png ]]; then
    local diagnostic_frame="android-p28g5-ice-mine-device-diagnostic.png"
    if adb exec-out screencap -p > "$diagnostic_frame" 2>/dev/null && [[ -s "$diagnostic_frame" ]]; then
      mv "$diagnostic_frame" android-p28g5-ice-mine-device.png
    else
      rm -f "$diagnostic_frame"
    fi
  fi
  adb logcat -d > android-p28g5-ice-mine-logcat.txt 2>/dev/null || true
  adb shell dumpsys activity activities > android-p28g5-ice-mine-activity.txt 2>/dev/null || true
}
trap capture_diagnostics EXIT
# A cold Android WebView may replace its initial CDP target during startup.
# Retry only a specifically diagnosed pre-frame transport failure. Each retry
# starts a clean app/WebView and reruns the *entire* real-gameplay capture and
# strict pixel/provenance validation; no successful evidence is synthesized.
run_exact_ice_capture() {
  adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
  adb shell pm clear "$PACKAGE" >/dev/null || return $?
  adb shell am start -W -n "$ACTIVITY" || return $?
  timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done' || return $?
  local pid
  pid="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
  test -n "$pid" || return 1
  adb forward --remove tcp:9222 >/dev/null 2>&1 || true
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid" || return $?
  local capture_status=0
  CDP_ENDPOINT=http://127.0.0.1:9222 node tools/android-p28g5-ice-capture.mjs \
    > android-p28g5-capture-attempt.log 2>&1 || capture_status=$?
  cat android-p28g5-capture-attempt.log
  if (( capture_status != 0 )); then return "$capture_status"; fi
  node tools/verify-p28g5-gameplay-frames.mjs android-p28g5-ice-mine-normal.png android-p28g5-ice-mine-action.png android-p28g5-ice-mine-pixel-report.json android-p28g5-ice-mine.json
}
pair_ok=0
for attempt in 1 2 3; do
  rm -f android-p28g5-ice-mine-normal.png android-p28g5-ice-mine-action.png \
    android-p28g5-ice-mine-pixel-report.json android-p28g5-ice-mine.json \
    android-p28g5-ice-mine-device.png
  if run_exact_ice_capture; then pair_ok=1; break; fi
  if (( attempt >= 3 )) || [[ -s android-p28g5-ice-mine-normal.png || -s android-p28g5-ice-mine-action.png ]]; then
    echo 'P28-G5 failed real gameplay proof; not a retryable pre-frame CDP startup' >&2
    exit 1
  fi
  if ! grep -qE 'P28-G5 (CDP timeout: (Runtime|Page)[.]enable|Android WebView CDP (target did not start|connection never stabilized)|Android initial cold WebView URL timed out)' android-p28g5-capture-attempt.log; then
    echo 'P28-G5 non-CDP failure remains blocking' >&2
    exit 1
  fi
  echo "ANDROID_P28G5_CDP_STARTUP_RELAUNCH attempt=$attempt reason=pre-frame-transport"
  sleep 2
done
test "$pair_ok" = 1
# Capture the actual Android display in addition to the Chrome WebView frames.
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { captureAcceptedG5Frame } from "./tools/p28g5-android-frame.mjs";
  import { decodeScreenshotPng } from "./scripts/verify-p28g2-gameplay-frames.mjs";
  import { auditBrightEdgeMargins } from "./tools/p28g5-bright-edge.mjs";
  await captureAcceptedG5Frame("android-p28g5-ice-mine-device.png", "P28-G5-device");
  const png = readFileSync("android-p28g5-ice-mine-device.png");
  if (png.length < 20000 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("P28-G5 actual Android screencap was blank or invalid");
  }
  const margins = auditBrightEdgeMargins(decodeScreenshotPng(png));
  if (!margins.valid) throw new Error("P28-G5 Android display has a bright outer letterbox: " + JSON.stringify(margins));
  const report = JSON.parse(readFileSync("android-p28g5-ice-mine.json", "utf8"));
  if (report.capturedRoute !== "ice-mine" || report.artState !== "ready" || report.fallbackObjects !== 0 || report.authoredObjects !== report.mappedObjects) {
    throw new Error("P28-G5 Android capture report is incomplete");
  }
'
adb logcat -d > android-p28g5-ice-mine-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-p28g5-ice-mine-logcat.txt; then
  echo 'P28-G5 Android capture suffered a fatal exception.' >&2
  exit 1
fi
echo "ANDROID_P28G5_FLAGSHIP_CAPTURE_PASS device=pixel_7_pro emulator=api35 captures=webview-normal+webview-action+android-display route=ice-mine assets=authored-world+bore-inlays"
