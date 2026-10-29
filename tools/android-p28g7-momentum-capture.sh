#!/usr/bin/env bash
# Source-verified Pixel 7 Pro emulator visual evidence, never physical QA.
set -euo pipefail
PACKAGE=app.ironshade.vector
ACTIVITY="$PACKAGE/.MainActivity"
APK=Ironshade-Vector-Android-Smoke.apk
# Preserve independent failure evidence even when a cold emulator/WebView stalls.
capture_diagnostics() {
  # The accepted framebuffer is already validated. Capture fallback diagnostics
  # only if it is absent, and never truncate it on a failed screencap.
  if [[ ! -s android-p28g7-momentum-exchange-device.png ]]; then
    local diagnostic_frame="android-p28g7-momentum-exchange-device-diagnostic.png"
    if adb exec-out screencap -p > "$diagnostic_frame" 2>/dev/null && [[ -s "$diagnostic_frame" ]]; then
      mv "$diagnostic_frame" android-p28g7-momentum-exchange-device.png
    else
      rm -f "$diagnostic_frame"
    fi
  fi
  adb logcat -d > android-p28g7-momentum-exchange-logcat.txt 2>/dev/null || true
  adb shell dumpsys activity activities > android-p28g7-momentum-exchange-activity.txt 2>/dev/null || true
}
trap capture_diagnostics EXIT
# This isolated visual job no longer relies on the generic fast-smoke's
# incidental installation. The workflow already verified the exact SHA and
# checksum; install that identical artifact and assert the package exists.
test -s "$APK"
adb install -r "$APK" >/dev/null
adb shell pm path "$PACKAGE" | grep -q '^package:'
# Only the known device-owned 144px cutout compositor failure may cause
# another pair capture. Each attempt clears app data, creates a new WebView,
# re-enters the actual finale, and regenerates both *raw* Android PNGs.
# Never edit an image or turn an unrelated provenance/pixel failure into PASS.
run_gameplay_pair() {
  adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
  adb shell pm clear "$PACKAGE" >/dev/null || return $?
  adb shell am start -W -n "$ACTIVITY" || return $?
  timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done' || return $?
  local pid
  pid="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
  test -n "$pid" || return $?
  adb forward --remove tcp:9222 >/dev/null 2>&1 || true
  adb forward tcp:9222 "localabstract:webview_devtools_remote_${pid}" || return $?
  CDP_ENDPOINT=http://127.0.0.1:9222 node tools/android-p28g7-momentum-capture.mjs || return $?
  node tools/verify-p28g7-gameplay-frames.mjs android-p28g7-momentum-exchange-normal.png android-p28g7-momentum-exchange-action.png android-p28g7-momentum-exchange-pixel-report.json android-p28g7-momentum-exchange.json || return $?
}
pair_ok=0
for attempt in 1 2 3; do
  rm -f android-p28g7-momentum-exchange-normal.png android-p28g7-momentum-exchange-action.png \
    android-p28g7-momentum-exchange-pixel-report.json android-p28g7-momentum-exchange.json \
    android-p28g7-momentum-exchange-device.png
  if run_gameplay_pair; then pair_ok=1; break; fi
  if (( attempt >= 3 )); then
    echo 'P28-G7 no accepted raw cutout-free gameplay pair after bounded retries' >&2
    exit 1
  fi
  # Startup failure has no valid pixel report and must remain fail-closed,
  # rather than accidentally retrying a missing/blank capture as a cutout.
  if [[ ! -s android-p28g7-momentum-exchange-pixel-report.json ]]; then
    echo 'P28-G7 capture exited before valid pixel/provenance evidence' >&2
    exit 1
  fi
  # The sole allowable retry is a known valid scene whose only failure is
  # the real emulator displaying a 144px bright left cutout.
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const r = JSON.parse(readFileSync("android-p28g7-momentum-exchange-pixel-report.json", "utf8"));
    if (r.normal?.valid !== true || r.action?.valid !== true ||
        r.provenance?.valid !== true ||
        r.margins?.normal?.leftBrightPixels !== 144 ||
        r.margins?.action?.leftBrightPixels !== 144 ||
        r.margins?.normal?.rightBrightPixels !== 0 ||
        r.margins?.action?.rightBrightPixels !== 0) {
      throw new Error("P28-G7 non-cutout failure is not retryable");
    }
  '
  echo "ANDROID_P28G7_REAL_CUTOUT_RECAPTURE attempt=$attempt action=restart-native-activity"
  sleep 2
done
test "$pair_ok" = 1
# Capture the actual Android display in addition to the Chrome WebView frames.
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { captureAcceptedG7Frame } from "./tools/p28g7-android-frame.mjs";
  import { decodeScreenshotPng } from "./scripts/verify-p28g2-gameplay-frames.mjs";
  import { auditBrightEdgeMargins } from "./tools/p28g5-bright-edge.mjs";
  await captureAcceptedG7Frame("android-p28g7-momentum-exchange-device.png", "P28-G7-device");
  const png = readFileSync("android-p28g7-momentum-exchange-device.png");
  if (png.length < 20000 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("P28-G7 actual Android screencap was blank or invalid");
  }
  const margins = auditBrightEdgeMargins(decodeScreenshotPng(png));
  if (!margins.valid) throw new Error("P28-G7 Android display has a bright outer letterbox: " + JSON.stringify(margins));
  const report = JSON.parse(readFileSync("android-p28g7-momentum-exchange.json", "utf8"));
  if (report.capturedRoute !== "momentum-exchange" || report.artState !== "ready" || report.premium !== "ready" || report.fallbackObjects !== 0 || report.authoredObjects !== report.mappedObjects) {
    throw new Error("P28-G7 Android capture report is incomplete");
  }
'
adb logcat -d > android-p28g7-momentum-exchange-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-p28g7-momentum-exchange-logcat.txt; then
  echo 'P28-G7 Android capture suffered a fatal exception.' >&2
  exit 1
fi
echo "ANDROID_P28G7_FLAGSHIP_CAPTURE_PASS device=pixel_7_pro emulator=api35 captures=webview-normal+webview-action+android-display route=momentum-exchange assets=authored-world+survey-inlays"
