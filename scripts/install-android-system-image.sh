#!/usr/bin/env bash
set -euo pipefail

API_LEVEL="${1:?usage: install-android-system-image.sh <api-level> [target] [arch]}"
TARGET="${2:-google_apis}"
ARCH="${3:-x86_64}"
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
SDKMANAGER="$(find "$SDK_ROOT" -type f -name sdkmanager 2>/dev/null | sort | tail -n 1)"
INSTALL_TIMEOUT_SECONDS="${ANDROID_IMAGE_INSTALL_TIMEOUT_SECONDS:-180}"

if [[ -z "$SDKMANAGER" ]]; then
  echo "sdkmanager not found under $SDK_ROOT" >&2
  exit 1
fi

PACKAGE="system-images;android-${API_LEVEL};${TARGET};${ARCH}"
IMAGE_DIR="$SDK_ROOT/system-images/android-${API_LEVEL}/${TARGET}/${ARCH}"

yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true

for attempt in 1 2 3; do
  echo "Installing Android emulator image $PACKAGE (attempt $attempt/3, timeout=${INSTALL_TIMEOUT_SECONDS}s)"
  if timeout "${INSTALL_TIMEOUT_SECONDS}s" "$SDKMANAGER" --install "$PACKAGE"; then
    test -d "$IMAGE_DIR"
    echo "ANDROID_SYSTEM_IMAGE_READY api=$API_LEVEL target=$TARGET arch=$ARCH"
    exit 0
  fi

  echo "Android system-image install failed or timed out; clearing partial image before retry." >&2
  rm -rf "$IMAGE_DIR"
  if [[ "$attempt" -lt 3 ]]; then
    sleep $((attempt * 10))
  fi
done

echo "Failed to install Android emulator image after 3 attempts: $PACKAGE" >&2
exit 1
