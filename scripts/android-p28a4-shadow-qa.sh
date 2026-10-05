#!/usr/bin/env bash
set -euo pipefail

APK="${ANDROID_P28A4_APK:-android/app/build/outputs/apk/debug/app-debug.apk}"
OUT_DIR="${ANDROID_P28A4_OUT_DIR:-p28a4-physical-qa}"
PACKAGE="app.ironshade.vector"
ACTIVITY="${PACKAGE}/.MainActivity"
ADB=(adb)
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  ADB+=(-s "$ANDROID_SERIAL")
fi

if [[ ! -s "$APK" ]]; then
  echo "P28-A4 APK not found: $APK" >&2
  exit 1
fi
command -v adb >/dev/null 2>&1 || { echo 'adb is required for P28-A4 physical QA.' >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo 'node is required for P28-A4 physical QA.' >&2; exit 1; }

mkdir -p "$OUT_DIR"
"${ADB[@]}" wait-for-device
MODEL="$("${ADB[@]}" shell getprop ro.product.model | tr -d '\r')"
MANUFACTURER="$("${ADB[@]}" shell getprop ro.product.manufacturer | tr -d '\r')"
SDK="$("${ADB[@]}" shell getprop ro.build.version.sdk | tr -d '\r')"
QEMU_KERNEL="$("${ADB[@]}" shell getprop ro.kernel.qemu | tr -d '\r')"
QEMU_BOOT="$("${ADB[@]}" shell getprop ro.boot.qemu | tr -d '\r')"
MODEL_LOWER="$(printf '%s' "$MODEL" | tr '[:upper:]' '[:lower:]')"
if [[ "$QEMU_KERNEL" == "1" || "$QEMU_BOOT" == "1" || "$MODEL_LOWER" =~ emulator|sdk_gphone|android_sdk_built_for ]]; then
  echo "P28-A4 requires physical flagship-class Android hardware; refusing emulator model=$MODEL qemu=${QEMU_KERNEL:-0}/${QEMU_BOOT:-0}." >&2
  exit 2
fi

{
  echo "manufacturer=$MANUFACTURER"
  echo "model=$MODEL"
  echo "sdk=$SDK"
  echo "serial=$("${ADB[@]}" get-serialno | tr -d '\r')"
  echo "hardware=$("${ADB[@]}" shell getprop ro.hardware | tr -d '\r')"
  echo "soc=$("${ADB[@]}" shell getprop ro.soc.model | tr -d '\r')"
  echo "build=$("${ADB[@]}" shell getprop ro.build.fingerprint | tr -d '\r')"
  "${ADB[@]}" shell dumpsys SurfaceFlinger 2>/dev/null | grep -m1 -E 'GLES|OpenGL ES' || true
} > "$OUT_DIR/android-device.txt"

"${ADB[@]}" install -r "$APK" >/dev/null
"${ADB[@]}" logcat -c
"${ADB[@]}" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
"${ADB[@]}" shell wm dismiss-keyguard >/dev/null 2>&1 || true
"${ADB[@]}" shell am force-stop "$PACKAGE"
"${ADB[@]}" shell am start -W -n "$ACTIVITY" >/dev/null

APP_PID=""
for _ in $(seq 1 30); do
  APP_PID="$("${ADB[@]}" shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r')"
  [[ -n "$APP_PID" ]] && break
  sleep 1
done
if [[ -z "$APP_PID" ]]; then
  echo 'Ironshade Vector process did not stay running on the physical device.' >&2
  exit 1
fi

SOCKET="webview_devtools_remote_${APP_PID}"
"${ADB[@]}" forward --remove tcp:9222 >/dev/null 2>&1 || true
"${ADB[@]}" forward tcp:9222 "localabstract:${SOCKET}" >/dev/null
CDP_ENDPOINT=http://127.0.0.1:9222 ANDROID_P28A4_OUT_DIR="$OUT_DIR" node scripts/android-p28a4-shadow-qa.mjs

"${ADB[@]}" shell dumpsys gfxinfo "$PACKAGE" > "$OUT_DIR/android-gfxinfo.txt" || true
"${ADB[@]}" logcat -d > "$OUT_DIR/android-logcat.txt"
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' "$OUT_DIR/android-logcat.txt"; then
  echo 'Android runtime crash detected during P28-A4 physical QA.' >&2
  exit 1
fi

echo "ANDROID_P28A4_PHYSICAL_DEVICE_PASS manufacturer=$MANUFACTURER model=$MODEL sdk=$SDK pid=$APP_PID evidence=$OUT_DIR"
