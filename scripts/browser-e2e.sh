#!/usr/bin/env bash
set -euo pipefail

ORIGIN="${BROWSER_E2E_ORIGIN:-http://127.0.0.1:4173}"
CDP_PORT="${BROWSER_E2E_CDP_PORT:-9223}"
export BROWSER_E2E_ORIGIN="$ORIGIN"
export CDP_ENDPOINT="http://127.0.0.1:${CDP_PORT}"

if [[ "${BROWSER_E2E_SKIP_BUILD:-0}" != "1" ]]; then
  npm run build
fi

CHROME=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROME="$(command -v "$candidate")"
    break
  fi
done
if [[ -z "$CHROME" ]]; then
  echo "No supported Chrome/Chromium executable found." >&2
  exit 1
fi

preview_log="${RUNNER_TEMP:-/tmp}/ironshade-browser-preview.log"
chrome_log="${RUNNER_TEMP:-/tmp}/ironshade-browser-chrome.log"
profile_dir="${RUNNER_TEMP:-/tmp}/ironshade-browser-profile-$$"

cleanup() {
  if [[ -n "${chrome_pid:-}" ]]; then
    kill "$chrome_pid" 2>/dev/null || true
    wait "$chrome_pid" 2>/dev/null || true
  fi
  if [[ -n "${preview_pid:-}" ]]; then
    kill "$preview_pid" 2>/dev/null || true
    wait "$preview_pid" 2>/dev/null || true
  fi
  rm -rf "$profile_dir" || true
}
trap cleanup EXIT

npm run preview -- --host 127.0.0.1 --port 4173 >"$preview_log" 2>&1 &
preview_pid=$!

for _ in {1..80}; do
  if curl --fail --silent --show-error "$ORIGIN" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$preview_pid" 2>/dev/null; then
    cat "$preview_log" >&2
    exit 1
  fi
  sleep 0.25
done
curl --fail --silent --show-error "$ORIGIN" >/dev/null

"$CHROME" \
  --headless=new \
  --no-sandbox \
  --disable-dev-shm-usage \
  --remote-debugging-port="$CDP_PORT" \
  --remote-allow-origins='*' \
  --user-data-dir="$profile_dir" \
  --enable-webgl \
  --enable-unsafe-swiftshader \
  --ignore-gpu-blocklist \
  --use-angle=swiftshader \
  "$ORIGIN" >"$chrome_log" 2>&1 &
chrome_pid=$!

for _ in {1..120}; do
  if curl --fail --silent --show-error "$CDP_ENDPOINT/json/version" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$chrome_pid" 2>/dev/null; then
    cat "$chrome_log" >&2
    exit 1
  fi
  sleep 0.25
done
curl --fail --silent --show-error "$CDP_ENDPOINT/json/version" >/dev/null

if ! node scripts/browser-e2e.mjs; then
  echo '--- Vite preview log ---' >&2
  cat "$preview_log" >&2 || true
  echo '--- Browser log ---' >&2
  tail -n 200 "$chrome_log" >&2 || true
  exit 1
fi
