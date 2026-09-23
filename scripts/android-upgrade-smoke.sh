#!/usr/bin/env bash
set -euo pipefail

BASE_APK="${ANDROID_UPGRADE_BASE_APK:-Ironshade-Vector-Android-Upgrade-Base.apk}"
CANDIDATE_APK="${ANDROID_UPGRADE_CANDIDATE_APK:-Ironshade-Vector-Android-Beta.apk}"
PACKAGE="app.ironshade.vector"
ACTIVITY="${PACKAGE}/.MainActivity"
BASE_VERSION_CODE="${ANDROID_UPGRADE_BASE_VERSION_CODE:?ANDROID_UPGRADE_BASE_VERSION_CODE is required}"
CANDIDATE_VERSION_CODE="${ANDROID_VERSION_CODE:?ANDROID_VERSION_CODE is required}"
MARKER="ironshade-upgrade-${BASE_VERSION_CODE}-to-${CANDIDATE_VERSION_CODE}"

for apk in "$BASE_APK" "$CANDIDATE_APK"; do
  if [[ ! -s "$apk" ]]; then
    echo "Android upgrade APK not found: $apk" >&2
    exit 1
  fi
done

package_dump() {
  adb shell dumpsys package "$PACKAGE" | tr -d '\r'
}

package_version_code() {
  package_dump | sed -n 's/.*versionCode=\([0-9][0-9]*\).*/\1/p' | head -n 1
}

package_user_id() {
  package_dump | sed -n 's/.*userId=\([0-9][0-9]*\).*/\1/p' | head -n 1
}

package_data_dir() {
  package_dump | sed -n 's/^[[:space:]]*dataDir=//p' | head -n 1
}

package_first_install_time() {
  package_dump | sed -n 's/^[[:space:]]*firstInstallTime=//p' | head -n 1
}

adb wait-for-device
adb root >/dev/null
adb wait-for-device
if ! adb shell id | tr -d '\r' | grep -q 'uid=0(root)'; then
  echo 'Android upgrade verification requires a root-capable emulator so private app data can be checked after a non-debuggable release upgrade.' >&2
  exit 1
fi

adb uninstall "$PACKAGE" >/dev/null 2>&1 || true
adb install "$BASE_APK" >/dev/null

actual_base_version="$(package_version_code)"
if [[ "$actual_base_version" != "$BASE_VERSION_CODE" ]]; then
  echo "Baseline versionCode mismatch: expected $BASE_VERSION_CODE, got ${actual_base_version:-missing}" >&2
  exit 1
fi

adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$ACTIVITY" >/dev/null
timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'

base_uid="$(package_user_id)"
base_data_dir="$(package_data_dir)"
first_install_before="$(package_first_install_time)"
if [[ -z "$base_uid" || -z "$base_data_dir" || -z "$first_install_before" ]]; then
  echo 'Unable to resolve baseline package identity for upgrade verification.' >&2
  exit 1
fi

sentinel="$base_data_dir/files/p17-upgrade-sentinel.txt"
adb shell "mkdir -p '$base_data_dir/files'"
adb shell "printf '%s' '$MARKER' > '$sentinel'"
adb shell "chown '$base_uid:$base_uid' '$sentinel'"
adb shell "chmod 600 '$sentinel'"
adb shell sync
if [[ "$(adb shell "cat '$sentinel'" | tr -d '\r')" != "$MARKER" ]]; then
  echo 'Failed to seed the private-data upgrade sentinel.' >&2
  exit 1
fi

adb install -r "$CANDIDATE_APK" >/dev/null

actual_candidate_version="$(package_version_code)"
candidate_uid="$(package_user_id)"
candidate_data_dir="$(package_data_dir)"
first_install_after="$(package_first_install_time)"
persisted_marker="$(adb shell "cat '$candidate_data_dir/files/p17-upgrade-sentinel.txt'" | tr -d '\r')"

if [[ "$actual_candidate_version" != "$CANDIDATE_VERSION_CODE" ]]; then
  echo "Candidate versionCode mismatch: expected $CANDIDATE_VERSION_CODE, got ${actual_candidate_version:-missing}" >&2
  exit 1
fi
if [[ "$candidate_uid" != "$base_uid" ]]; then
  echo "App UID changed across upgrade: before=$base_uid after=$candidate_uid" >&2
  exit 1
fi
if [[ "$candidate_data_dir" != "$base_data_dir" ]]; then
  echo "App data directory changed across upgrade: before=$base_data_dir after=$candidate_data_dir" >&2
  exit 1
fi
if [[ "$first_install_after" != "$first_install_before" ]]; then
  echo "firstInstallTime changed across upgrade: before=$first_install_before after=$first_install_after" >&2
  exit 1
fi
if [[ "$persisted_marker" != "$MARKER" ]]; then
  echo 'Private app data did not survive the in-place upgrade.' >&2
  exit 1
fi

adb logcat -c
adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$ACTIVITY" >/dev/null
timeout 30 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
candidate_pid="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ -z "$candidate_pid" ]]; then
  echo 'Release candidate did not stay running after upgrade.' >&2
  exit 1
fi

adb exec-out screencap -p > android-upgrade-smoke.png
test -s android-upgrade-smoke.png
adb logcat -d > android-upgrade-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-upgrade-logcat.txt; then
  echo 'Android runtime crash detected after release upgrade.' >&2
  exit 1
fi

cat > android-upgrade-smoke.txt <<REPORT
ANDROID_UPGRADE_PASS
package=$PACKAGE
baseline_version_code=$BASE_VERSION_CODE
candidate_version_code=$CANDIDATE_VERSION_CODE
uid=$candidate_uid
data_dir=$candidate_data_dir
first_install_time=$first_install_after
sentinel=$persisted_marker
candidate_pid=$candidate_pid
REPORT
cat android-upgrade-smoke.txt

# The normal runtime gate uses a debug APK for WebView/CDP assertions. Remove
# the release-signed install only after the upgrade evidence has been captured.
adb uninstall "$PACKAGE" >/dev/null
