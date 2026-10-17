#!/usr/bin/env bash
set -euo pipefail

candidate_sha="${CANDIDATE_SHA:-}"
if [[ ! "$candidate_sha" =~ ^[a-f0-9]{40}$ ]]; then
  echo "FULL_REPOSITORY_BUILD_PROOF_FAIL invalid CANDIDATE_SHA=$candidate_sha" >&2
  exit 2
fi

log_path="${FULL_VERIFICATION_LOG:-.agent-impact-calibration/full-verification.log}"
base_image='node:22.23.2-bookworm'
snapshot="$(mktemp -d)"
image="ironshade-candidate-node:${candidate_sha}"
cleanup() {
  rm -rf "$snapshot"
  docker image rm "$image" >/dev/null 2>&1 || true
}
trap cleanup EXIT

mkdir -p "$(dirname "$log_path")"
test "$(git rev-parse HEAD)" = "$candidate_sha"
git archive --format=tar "$candidate_sha" | tar -xf - -C "$snapshot"
test ! -e "$snapshot/.git"

docker pull "$base_image" >/dev/null
base_image_ref="$(docker image inspect --format '{{index .RepoDigests 0}}' "$base_image")"
docker_engine_version="$(docker version --format '{{.Server.Version}}')"
test -n "$base_image_ref"
test -n "$docker_engine_version"
echo "FULL_REPOSITORY_BUILD_PROOF_RUNTIME baseImage=$base_image baseImageRef=$base_image_ref dockerEngine=$docker_engine_version network=none home=/tmp npmIgnoreScripts=true user=$(id -u):$(id -g)"

docker build --tag "$image" - <<DOCKERFILE
FROM ${base_image_ref}
RUN npm install --global npm@10.9.8 \
    && test "\$(npm --version)" = '10.9.8'
DOCKERFILE

docker run --rm \
  --volume "$snapshot:/workspace" \
  --workdir /workspace \
  --env HOME=/tmp \
  --user "$(id -u):$(id -g)" \
  "$image" \
  npm ci --ignore-scripts --no-audit --no-fund

set -o pipefail
set +e
docker run --rm \
  --network none \
  --volume "$snapshot:/workspace" \
  --workdir /workspace \
  --env HOME=/tmp \
  --env npm_config_ignore_scripts=true \
  --env VITE_API_BASE_URL \
  --user "$(id -u):$(id -g)" \
  "$image" \
  npm run build 2>&1 | tee "$log_path"
status=${PIPESTATUS[0]}
set -e
if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi

test -d "$snapshot/dist"
test ! -L "$snapshot/dist"
rm -rf dist
cp -a "$snapshot/dist" dist
test "$(git rev-parse HEAD)" = "$candidate_sha"
echo "FULL_REPOSITORY_BUILD_PROOF_PASS candidate=$candidate_sha baseImageRef=$base_image_ref dockerEngine=$docker_engine_version"
