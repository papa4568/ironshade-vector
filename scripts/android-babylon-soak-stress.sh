#!/usr/bin/env bash
set -euo pipefail

SMOKE_APK="${ANDROID_P27D6_SOAK_APK:-android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE="app.ironshade.vector"
ACTIVITY="${PACKAGE}/.MainActivity"
SOAK_MINUTES="${ANDROID_P27D6_SOAK_MINUTES:-30}"
MEMORY_LOG="android-p27d6-memory.txt"

if [[ ! -s "$SMOKE_APK" ]]; then
  echo "P27-D6 Android soak APK not found: $SMOKE_APK" >&2
  exit 1
fi

adb wait-for-device
adb install -r "$SMOKE_APK"
adb logcat -c
adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$ACTIVITY"

timeout 45 bash -c 'until [[ -n "$(adb shell pidof app.ironshade.vector 2>/dev/null | tr -d "\r")" ]]; do sleep 1; done'
APP_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ -z "$APP_PID" ]]; then
  echo "Ironshade Vector process did not stay running for P27-D6 soak QA." >&2
  exit 1
fi
export ANDROID_P27D6_INITIAL_PID="$APP_PID"

adb shell dumpsys thermalservice > android-p27d6-thermal-before.txt 2>&1 || true
adb shell dumpsys gfxinfo "$PACKAGE" reset > /dev/null 2>&1 || true
: > "$MEMORY_LOG"

sample_memory() {
  while true; do
    stamp="$(date +%s)"
    pss="$(adb shell dumpsys meminfo "$PACKAGE" 2>/dev/null | tr -d '\r' | awk '/TOTAL PSS:/ { print $3; exit }')"
    rss="$(adb shell dumpsys meminfo "$PACKAGE" 2>/dev/null | tr -d '\r' | awk '/TOTAL RSS:/ { print $3; exit }')"
    pid="$(adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r')"
    printf '%s pid=%s pss_kb=%s rss_kb=%s\n' "$stamp" "${pid:-none}" "${pss:-na}" "${rss:-na}" >> "$MEMORY_LOG"
    sleep 60
  done
}

sample_memory &
MEMORY_SAMPLER_PID=$!
cleanup() {
  kill "$MEMORY_SAMPLER_PID" >/dev/null 2>&1 || true
  wait "$MEMORY_SAMPLER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

SOCKET="webview_devtools_remote_${APP_PID}"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:${SOCKET}"

ANDROID_P27D6_SOAK_MINUTES="$SOAK_MINUTES" \
ANDROID_P27D6_REPORT_PATH=android-p27d6-babylon-soak.json \
CDP_ENDPOINT=http://127.0.0.1:9222 \
node scripts/android-babylon-soak-stress.mjs

cleanup
trap - EXIT

adb shell dumpsys meminfo "$PACKAGE" > android-p27d6-meminfo-final.txt 2>&1 || true
adb shell dumpsys gfxinfo "$PACKAGE" > android-p27d6-gfxinfo.txt 2>&1 || true
adb shell dumpsys thermalservice > android-p27d6-thermal-after.txt 2>&1 || true
adb logcat -d > android-p27d6-logcat.txt
adb exec-out screencap -p > android-p27d6-final.png
test -s android-p27d6-final.png

if grep -E 'FATAL EXCEPTION|Fatal signal|ANR in app\.ironshade\.vector|Process: app\.ironshade\.vector' android-p27d6-logcat.txt; then
  echo 'P27-D6 Android soak detected a crash, fatal signal, or ANR.' >&2
  exit 1
fi

node --input-type=module <<'NODE'
import fs from 'node:fs';

const raw = fs.readFileSync('android-p27d6-memory.txt', 'utf8').trim();
const rows = raw ? raw.split(/\n+/).map(line => {
  const match = line.match(/^(\d+) pid=(\S+) pss_kb=(\S+) rss_kb=(\S+)$/);
  if (!match) return null;
  return {
    at: Number(match[1]),
    pid: match[2],
    pssKb: Number(match[3]),
    rssKb: Number(match[4]),
  };
}).filter(Boolean) : [];

const pss = rows.map(row => row.pssKb).filter(value => Number.isFinite(value) && value > 0);
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const edgeMedian = (values, end = false) => {
  if (!values.length) return null;
  const count = Math.max(2, Math.ceil(values.length * 0.25));
  return median(end ? values.slice(-count) : values.slice(0, count));
};

const baselineKb = edgeMedian(pss);
const finalKb = edgeMedian(pss, true);
const deltaKb = baselineKb != null && finalKb != null ? finalKb - baselineKb : null;
const leakGateKb = baselineKb == null ? null : Math.max(128 * 1024, baselineKb * 0.45);
const regressed = deltaKb != null && leakGateKb != null && deltaKb > leakGateKb;
const uniquePids = [...new Set(rows.map(row => row.pid).filter(pid => pid !== 'none'))];
const initialPid = process.env.ANDROID_P27D6_INITIAL_PID ?? '';
const processChanged = uniquePids.some(pid => pid !== initialPid);

const summary = {
  schema: 'p27-d6-android-memory-v1',
  samples: rows.length,
  validPssSamples: pss.length,
  initialPid,
  uniquePids,
  baselinePssMb: baselineKb == null ? null : Math.round(baselineKb / 1024 * 10) / 10,
  finalPssMb: finalKb == null ? null : Math.round(finalKb / 1024 * 10) / 10,
  deltaPssMb: deltaKb == null ? null : Math.round(deltaKb / 1024 * 10) / 10,
  leakGateMb: leakGateKb == null ? null : Math.round(leakGateKb / 1024 * 10) / 10,
  regressed,
  processChanged,
};
fs.writeFileSync('android-p27d6-memory-summary.json', JSON.stringify(summary, null, 2) + '\n');

if (pss.length < 3) throw new Error('Insufficient P27-D6 Android PSS samples: ' + pss.length);
if (processChanged) throw new Error('P27-D6 app process changed during sustained soak: ' + JSON.stringify(summary));
if (regressed) throw new Error('P27-D6 Android PSS growth exceeded leak gate: ' + JSON.stringify(summary));

console.log('ANDROID_P27D6_MEMORY_PASS samples=' + pss.length
  + ' baseline=' + summary.baselinePssMb + 'MB'
  + ' final=' + summary.finalPssMb + 'MB'
  + ' delta=' + summary.deltaPssMb + 'MB'
  + ' leakGate=' + summary.leakGateMb + 'MB'
  + ' pid=' + initialPid);
NODE

CURRENT_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
if [[ -z "$CURRENT_PID" ]]; then
  echo "Ironshade Vector process did not survive the P27-D6 soak." >&2
  exit 1
fi
if [[ "$CURRENT_PID" != "$APP_PID" ]]; then
  echo "Ironshade Vector process changed during P27-D6 soak: $APP_PID -> $CURRENT_PID" >&2
  exit 1
fi

echo "ANDROID_P27D6_SOAK_PASS minutes=${SOAK_MINUTES} pid=${APP_PID} evidence=babylon-lifecycle+webview+pss+gfxinfo+logcat"
