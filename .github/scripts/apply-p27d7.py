from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one {label}, found {count}")
    path.write_text(text.replace(old, new, 1))


shell = Path("scripts/android-fast-smoke.sh")
replace_once(
    shell,
    """adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell am start --activity-reorder-to-front -n \"$ACTIVITY\"
confirm_immersive_mode_for_smoke
RESUME_PID=\"$(wait_for_process)\"
if [[ -z \"$RESUME_PID\" ]]; then
  echo \"Ironshade Vector process did not return during D7 lifecycle smoke.\" >&2
  exit 1
fi

connect_cdp \"$RESUME_PID\"
if [[ \"$RESUME_PID\" == \"$APP_PID\" ]]; then
  LIFECYCLE_MODE='preserved-resume'
  ANDROID_FAST_RESUME_CHECK=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs
else
  echo \"ANDROID_FAST_PROCESS_RECLAIM before=$APP_PID after=$RESUME_PID // verifying clean production-default recovery\"
  LIFECYCLE_MODE='reclaimed-recovered'
  APP_PID=\"$RESUME_PID\"
  ANDROID_FAST_SMOKE=1 CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-runtime-smoke.mjs
fi

adb exec-out screencap -p > android-fast-resume.png
test -s android-fast-resume.png

""",
    "",
    "redundant D7 lifecycle block",
)
replace_once(
    shell,
    "echo \"ANDROID_FAST_EMULATOR_PASS pid=${APP_PID} resumePid=${RESUME_PID} route=ship>contracts>combat touch=management+move+fire+ability+dodge+act controller=pointer+touch lifecycle=${LIFECYCLE_MODE} p27d7=babylon-production-default+renderer-reentry performance=js-heap crashCheck=clean screenshots=2 elapsedSeconds=${ELAPSED_SECONDS}\"",
    "echo \"ANDROID_FAST_EMULATOR_PASS pid=${APP_PID} route=ship>contracts>combat touch=management+move+fire+ability+dodge+act controller=pointer+touch p27d7=babylon-production-default performance=js-heap crashCheck=clean screenshots=1 elapsedSeconds=${ELAPSED_SECONDS}\"",
    "D7 pass marker",
)

contract = Path("tests/android-fast-smoke-contract.mjs")
for old in [
    "  'ANDROID_FAST_RESUME_CHECK=1',\n",
    "  'ANDROID_FAST_PROCESS_RECLAIM',\n",
    "  'verifying clean production-default recovery',\n",
    "  \"LIFECYCLE_MODE='preserved-resume'\",\n",
    "  \"LIFECYCLE_MODE='reclaimed-recovered'\",\n",
    "  'android-fast-resume.png',\n",
]:
    replace_once(contract, old, "", f"obsolete fast-smoke contract marker {old.strip()}")
replace_once(
    contract,
    "  'p27d7=babylon-production-default+renderer-reentry',\n",
    "  'p27d7=babylon-production-default',\n  'screenshots=1',\n",
    "D7 production-default shell marker",
)
replace_once(
    contract,
    "  'reclaimed during two consecutive fast pause/resume attempts',\n",
    "  'reclaimed during two consecutive fast pause/resume attempts',\n  'ANDROID_FAST_RESUME_CHECK=1',\n  'ANDROID_FAST_PROCESS_RECLAIM',\n  'android-fast-resume.png',\n",
    "migration-only fast-smoke guard tail",
)
replace_once(
    contract,
    "  'ANDROID_FAST_RUNTIME_PASS',\n",
    "  'ANDROID_FAST_RUNTIME_PASS',\n  'ANDROID_P27D7_PRODUCTION_BABYLON_PASS',\n",
    "D7 runtime marker",
)

print("P27_D7_RELEASE_SMOKE_APPLIED productionDefault=babylon touch=verified lifecycleCoverage=P27-D5")
