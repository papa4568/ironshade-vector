#!/usr/bin/env bash
set -euo pipefail

candidate_sha="${CANDIDATE_SHA:-}"
if [[ ! "$candidate_sha" =~ ^[a-f0-9]{40}$ ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSED_FAIL invalid CANDIDATE_SHA=$candidate_sha" >&2
  exit 2
fi

prepared_dir="${IRONSHADE_PROOF_PREPARED_DIR:-}"
if [[ -z "$prepared_dir" || ! -f "$prepared_dir/closure.env" || ! -d "$prepared_dir/snapshot" ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSED_FAIL missing mandatory prepared proof state" >&2
  exit 2
fi

# shellcheck disable=SC1090
source "$prepared_dir/closure.env"

required_values=(
  IRONSHADE_PROOF_BASE_IMAGE_REF
  IRONSHADE_PROOF_PREPARED_IMAGE_ID
  IRONSHADE_PROOF_NPM_CLI_TREE_SHA256
  IRONSHADE_PROOF_DOCKER_ENGINE_VERSION
  IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256
  IRONSHADE_PROOF_PREPARED_IMAGE
)
for name in "${required_values[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "FULL_REPOSITORY_BUILD_CLOSED_FAIL missing $name" >&2
    exit 2
  fi
done

snapshot="$prepared_dir/snapshot"
log_path="${FULL_VERIFICATION_LOG:-.agent-impact-calibration/full-verification.log}"
cleanup() {
  rm -rf "$prepared_dir"
}
trap cleanup EXIT

mkdir -p "$(dirname "$log_path")"
test "$(git rev-parse HEAD)" = "$candidate_sha"
test ! -e "$snapshot/.git"
test -d "$snapshot/node_modules"

current_engine="$(docker version --format '{{.Server.Version}}')"
docker image inspect "$IRONSHADE_PROOF_BASE_IMAGE_REF" >/dev/null
if [[ "$current_engine" != "$IRONSHADE_PROOF_DOCKER_ENGINE_VERSION" ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSED_FAIL Docker engine changed after preflight" >&2
  exit 2
fi

current_prepared_image_id="$(
  bash scripts/compute-prepared-toolchain-identity.sh \
    "$IRONSHADE_PROOF_PREPARED_IMAGE" \
    "$IRONSHADE_PROOF_BASE_IMAGE_REF" \
    '10.9.8' \
    | sed -n 's/^IRONSHADE_PROOF_PREPARED_IMAGE_ID=//p'
)"
if [[ ! "$current_prepared_image_id" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSED_FAIL invalid current prepared image identity" >&2
  exit 2
fi
if [[ "$current_prepared_image_id" != "$IRONSHADE_PROOF_PREPARED_IMAGE_ID" ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSED_FAIL prepared image identity changed after preflight" >&2
  exit 2
fi

current_npm_cli_tree_sha256="$(
  docker run --rm --network none "$IRONSHADE_PROOF_PREPARED_IMAGE" sh -lc '
    set -eu
    root="$(npm root -g)"
    tar --sort=name --mtime="@0" --owner=0 --group=0 --numeric-owner -C "$root" -cf - npm \
      | sha256sum \
      | cut -d" " -f1
  '
)"
if [[ "$current_npm_cli_tree_sha256" != "$IRONSHADE_PROOF_NPM_CLI_TREE_SHA256" ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSED_FAIL npm CLI identity changed after preflight" >&2
  exit 2
fi

current_dependency_tree_sha256="$(
  cd "$snapshot"
  tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner -cf - node_modules \
    | sha256sum \
    | cut -d' ' -f1
)"
if [[ "$current_dependency_tree_sha256" != "$IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256" ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSED_FAIL dependency tree identity changed after preflight" >&2
  exit 2
fi

echo "FULL_REPOSITORY_BUILD_CLOSED_RUNTIME candidate=$candidate_sha baseImageRef=$IRONSHADE_PROOF_BASE_IMAGE_REF npmCliTree=$IRONSHADE_PROOF_NPM_CLI_TREE_SHA256 preparedImageId=$IRONSHADE_PROOF_PREPARED_IMAGE_ID dockerEngine=$IRONSHADE_PROOF_DOCKER_ENGINE_VERSION dependencyTree=$IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256 network=none home=/tmp npmIgnoreScripts=true user=$(id -u):$(id -g)"

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
  "$IRONSHADE_PROOF_PREPARED_IMAGE" \
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
echo "FULL_REPOSITORY_BUILD_CLOSED_PASS candidate=$candidate_sha baseImageRef=$IRONSHADE_PROOF_BASE_IMAGE_REF npmCliTree=$IRONSHADE_PROOF_NPM_CLI_TREE_SHA256 preparedImageId=$IRONSHADE_PROOF_PREPARED_IMAGE_ID dockerEngine=$IRONSHADE_PROOF_DOCKER_ENGINE_VERSION dependencyTree=$IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256"
