#!/usr/bin/env bash
set -euo pipefail

SMOKE_APK="${ANDROID_P27D6_APK:-android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE="app.ironshade.vector"
ACTIVITY="${PACKAGE}/.MainActivity"
SOAK_MINUTES="${ANDROID_P27D6_SOAK_MINUTES:-30}"
MEMORY_LOG="android-p27d6-memory.txt"
CENSUS_LOG="android-p27d6-retention-census.log"
CENSUS_PID=""

if [[ ! -s "$SMOKE_APK" ]]; then
  echo "Babylon resource soak APK not found: $SMOKE_APK" >&2
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
  echo "Ironshade Vector process did not stay running for Babylon resource soak QA." >&2
  exit 1
fi

adb shell dumpsys thermalservice > android-p27d6-thermal-before.txt 2>&1 || true
adb shell dumpsys gfxinfo "$PACKAGE" reset > /dev/null 2>&1 || true
: > "$MEMORY_LOG"
: > "$CENSUS_LOG"

sample_memory() {
  while true; do
    stamp="$(date +%s)"
    pss="$(adb shell dumpsys meminfo "$PACKAGE" 2>/dev/null | tr -d '\r' | awk '/TOTAL PSS:/ { print $3; exit }')"
    rss="$(adb shell dumpsys meminfo "$PACKAGE" 2>/dev/null | tr -d '\r' | awk '/TOTAL RSS:/ { print $3; exit }')"
    pid="$(adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r')"
    printf '%s pid=%s pss_kb=%s rss_kb=%s\n' "$stamp" "${pid:-none}" "${pss:-na}" "${rss:-na}" >> "$MEMORY_LOG"
    sleep 30
  done
}

sample_memory &
MEMORY_SAMPLER_PID=$!
cleanup() {
  kill "$MEMORY_SAMPLER_PID" >/dev/null 2>&1 || true
  wait "$MEMORY_SAMPLER_PID" >/dev/null 2>&1 || true
  if [[ -n "$CENSUS_PID" ]]; then
    kill "$CENSUS_PID" >/dev/null 2>&1 || true
    wait "$CENSUS_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

SOCKET="webview_devtools_remote_${APP_PID}"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:${SOCKET}"

CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-babylon-retention-census.mjs > "$CENSUS_LOG" 2>&1 &
CENSUS_PID=$!

set +e
ANDROID_P27D6_SOAK_MINUTES="$SOAK_MINUTES" CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-babylon-resource-soak.mjs
SOAK_STATUS=$?
set -e

cleanup
trap - EXIT

adb shell dumpsys meminfo "$PACKAGE" > android-p27d6-meminfo-final.txt 2>&1 || true
adb shell dumpsys gfxinfo "$PACKAGE" > android-p27d6-gfxinfo.txt 2>&1 || true
adb shell dumpsys thermalservice > android-p27d6-thermal-after.txt 2>&1 || true
adb logcat -d > android-p27d6-logcat.txt 2>&1 || true
adb exec-out screencap -p > android-p27d6-final.png 2>/dev/null || true

EVIDENCE_STATUS=0
if [[ ! -s android-p27d6-final.png ]]; then
  echo 'Babylon resource soak did not produce a final screenshot.' >&2
  EVIDENCE_STATUS=1
fi
if grep -E 'FATAL EXCEPTION|Fatal signal|ANR in app\.ironshade\.vector|Process: app\.ironshade\.vector' android-p27d6-logcat.txt; then
  echo 'Babylon resource soak detected a crash, fatal signal, or ANR.' >&2
  EVIDENCE_STATUS=1
fi

set +e
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
  const count = Math.max(3, Math.ceil(values.length * 0.2));
  return median(end ? values.slice(-count) : values.slice(0, count));
};
const baselineKb = edgeMedian(pss);
const finalKb = edgeMedian(pss, true);
const deltaKb = baselineKb != null && finalKb != null ? finalKb - baselineKb : null;
const leakGateKb = baselineKb == null ? null : Math.max(128 * 1024, baselineKb * 0.45);
const regressed = deltaKb != null && leakGateKb != null && deltaKb > leakGateKb;
const uniquePids = [...new Set(rows.map(row => row.pid).filter(pid => pid !== 'none'))];
const summary = {
  version: 'p27-d6-babylon-v1',
  samples: rows.length,
  validPssSamples: pss.length,
  uniquePids,
  baselinePssMb: baselineKb == null ? null : Math.round(baselineKb / 1024 * 10) / 10,
  finalPssMb: finalKb == null ? null : Math.round(finalKb / 1024 * 10) / 10,
  deltaPssMb: deltaKb == null ? null : Math.round(deltaKb / 1024 * 10) / 10,
  leakGateMb: leakGateKb == null ? null : Math.round(leakGateKb / 1024 * 10) / 10,
  regressed,
};
fs.writeFileSync('android-p27d6-memory-summary.json', JSON.stringify(summary, null, 2));
if (pss.length < 5) throw new Error(`Insufficient Android PSS samples: ${pss.length}`);
if (uniquePids.length !== 1) throw new Error(`Android process restarted during Babylon soak: ${JSON.stringify(uniquePids)}`);
if (regressed) throw new Error(`Android PSS growth exceeded leak gate: ${JSON.stringify(summary)}`);
console.log(`ANDROID_P27D6_MEMORY_PASS samples=${pss.length} baseline=${summary.baselinePssMb}MB final=${summary.finalPssMb}MB delta=${summary.deltaPssMb}MB pidStable=true`);
NODE
MEMORY_STATUS=$?
set -e

CURRENT_PID="$(adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r')"
if [[ -z "$CURRENT_PID" ]]; then
  echo "Ironshade Vector process did not survive the Babylon resource soak." >&2
  EVIDENCE_STATUS=1
elif [[ "$CURRENT_PID" != "$APP_PID" ]]; then
  echo "Ironshade Vector process restarted during the Babylon resource soak: $APP_PID -> $CURRENT_PID" >&2
  EVIDENCE_STATUS=1
fi

if (( SOAK_STATUS != 0 )); then
  exit "$SOAK_STATUS"
fi
if (( MEMORY_STATUS != 0 )); then
  exit "$MEMORY_STATUS"
fi
if (( EVIDENCE_STATUS != 0 )); then
  exit "$EVIDENCE_STATUS"
fi

echo "ANDROID_P27D6_SOAK_PASS minutes=${SOAK_MINUTES} initialPid=${APP_PID} finalPid=${CURRENT_PID} evidence=babylon-webview+renderer-reentry+scene-cache+post-gc-jsheap+pss+gfxinfo+thermalservice+logcat"
