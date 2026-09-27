#!/usr/bin/env bash
set -euo pipefail

STARTED_AT="$(date +%s)"
SMOKE_APK="${ANDROID_SMOKE_APK:-Ironshade-Vector-Android-Smoke.apk}"
PACKAGE="app.ironshade.vector"

if [[ ! -s "$SMOKE_APK" ]]; then
  echo "Settings Android APK not found: $SMOKE_APK" >&2
  exit 1
fi

adb wait-for-device
adb install -r "$SMOKE_APK"
adb logcat -c

set +e
python3 scripts/android-settings-playtest.py 2>&1 | tee android-settings-regression.txt
PLAYTEST_STATUS=${PIPESTATUS[0]}
set -e

adb logcat -d > android-settings-regression-logcat.txt
if grep -E 'FATAL EXCEPTION|Process: app\.ironshade\.vector' android-settings-regression-logcat.txt; then
  echo 'Settings Android runtime crash detected.' >&2
  exit 1
fi

if [[ "$PLAYTEST_STATUS" -ne 0 ]]; then
  echo "Black-box Settings playtest failed with exit code $PLAYTEST_STATUS." >&2
  exit "$PLAYTEST_STATUS"
fi

grep -q 'ANDROID_SETTINGS_PLAYTEST_START mode=black-box game-input=adb accessibility=uiautomator screenshots=true dom=false cdp=false storage=false' android-settings-regression.txt
grep -q 'ANDROID_SETTINGS_VISUAL_DENSITY_PASS' android-settings-regression.txt
grep -q 'ANDROID_SETTINGS_RELAUNCH_PASS' android-settings-regression.txt
grep -q 'ANDROID_SETTINGS_PLAYTEST_PASS route=intake>command>operator>build>settings>command' android-settings-regression.txt

for screenshot in   android-settings-00-class.png   android-settings-01-command.png   android-settings-04-settings.png   android-settings-05-settings-exercised.png   android-settings-06-command-default.png   android-settings-07-command-compact.png   android-settings-08-command-compact-relaunch.png   android-settings-09-settings-restored.png   android-settings-10-command-final-compact.png; do
  test -s "$screenshot"
done

ELAPSED_SECONDS=$(( $(date +%s) - STARTED_AT ))
echo "ANDROID_SETTINGS_REGRESSION_JOB_PASS apk=reused input=touch-only accessibility=uiautomator persistence=cold-relaunch screenshots=verified crashCheck=clean elapsedSeconds=${ELAPSED_SECONDS}"

adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
