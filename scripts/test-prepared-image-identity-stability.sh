#!/usr/bin/env bash
set -euo pipefail

candidate_sha="${CANDIDATE_SHA:-$(git rev-parse HEAD)}"
if [[ ! "$candidate_sha" =~ ^[a-f0-9]{40}$ ]] || [[ "$(git rev-parse HEAD)" != "$candidate_sha" ]]; then
  echo "EV28_PREPARED_IMAGE_STABILITY_FAIL invalid exact candidate: $candidate_sha" >&2
  exit 2
fi

prepared_image='ironshade-proof-closed:node-22.23.2-npm-10.9.8'
mutation_image='ironshade-proof-closed:ev28-usrlocal-mutation'
prepared_npm_version='10.9.8'
work_root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/ev28-prepared-image.XXXXXX")"
evidence_dir="${EV28_EVIDENCE_DIR:-.ev28-prepared-image-stability}"
mkdir -p "$evidence_dir"

cleanup() {
  docker image rm --force "$mutation_image" >/dev/null 2>&1 || true
  docker image rm --force "$prepared_image" >/dev/null 2>&1 || true
  rm -rf "$work_root"
}
trap cleanup EXIT

fresh_preflight() {
  local label="$1"
  local root="$work_root/$label"
  docker image rm --force "$prepared_image" >/dev/null 2>&1 || true
  docker builder prune --all --force >/dev/null
  CANDIDATE_SHA="$candidate_sha" \
    FULL_REPOSITORY_BUILD_PREPARED_ROOT="$root" \
    GITHUB_ENV='' \
    bash scripts/prepare-full-repository-build-proof-closed.sh
  cp "$root/$candidate_sha/closure.env" "$work_root/$label.env"
  cp "$root/$candidate_sha/manifest.json" "$work_root/$label-manifest.json"
}

value_of() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -E "^${key}=" "$file" || true)"
  if [[ -z "$line" ]]; then
    echo "EV28_PREPARED_IMAGE_STABILITY_FAIL missing $key in $file" >&2
    exit 2
  fi
  printf '%s' "${line#*=}"
}

npm_cli_tree_of() {
  local image="$1"
  docker run --rm "$image" sh -lc '
    set -eu
    root="$(npm root -g)"
    tar --sort=name --mtime="@0" --owner=0 --group=0 --numeric-owner -C "$root" -cf - npm \
      | sha256sum \
      | cut -d" " -f1
  '
}

fresh_preflight first
fresh_preflight second

identities=(
  IRONSHADE_PROOF_BASE_IMAGE_REF
  IRONSHADE_PROOF_PREPARED_IMAGE_ID
  IRONSHADE_PROOF_NPM_CLI_TREE_SHA256
  IRONSHADE_PROOF_DOCKER_ENGINE_VERSION
  IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256
)

for key in "${identities[@]}"; do
  first="$(value_of "$work_root/first.env" "$key")"
  second="$(value_of "$work_root/second.env" "$key")"
  if [[ "$first" != "$second" ]]; then
    echo "EV28_PREPARED_IMAGE_STABILITY_FAIL identity=$key first=$first second=$second" >&2
    exit 1
  fi
done

prepared_image_id="$(value_of "$work_root/first.env" IRONSHADE_PROOF_PREPARED_IMAGE_ID)"
base_image_ref="$(value_of "$work_root/first.env" IRONSHADE_PROOF_BASE_IMAGE_REF)"
npm_cli_tree="$(value_of "$work_root/first.env" IRONSHADE_PROOF_NPM_CLI_TREE_SHA256)"
docker_engine="$(value_of "$work_root/first.env" IRONSHADE_PROOF_DOCKER_ENGINE_VERSION)"
dependency_tree="$(value_of "$work_root/first.env" IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256)"

for manifest in "$work_root/first-manifest.json" "$work_root/second-manifest.json"; do
  test "$(jq -r '.preparedImageIdentityMethod' "$manifest")" = 'canonical-usrlocal-v1' || {
    echo "EV28_PREPARED_IMAGE_STABILITY_FAIL wrong prepared identity method in $manifest" >&2
    exit 1
  }
  tree="$(jq -r '.preparedToolchainTreeSha256' "$manifest")"
  [[ "$tree" =~ ^[a-f0-9]{64}$ ]] || {
    echo "EV28_PREPARED_IMAGE_STABILITY_FAIL invalid prepared toolchain tree in $manifest" >&2
    exit 1
  }
  runtime_id="$(jq -r '.runtimeDockerImageId' "$manifest")"
  [[ "$runtime_id" =~ ^sha256:[a-f0-9]{64}$ ]] || {
    echo "EV28_PREPARED_IMAGE_STABILITY_FAIL invalid runtime Docker image ID in $manifest" >&2
    exit 1
  }
done

first_toolchain_tree="$(jq -r '.preparedToolchainTreeSha256' "$work_root/first-manifest.json")"
second_toolchain_tree="$(jq -r '.preparedToolchainTreeSha256' "$work_root/second-manifest.json")"
if [[ "$first_toolchain_tree" != "$second_toolchain_tree" ]]; then
  echo "EV28_PREPARED_IMAGE_STABILITY_FAIL prepared toolchain tree drift first=$first_toolchain_tree second=$second_toolchain_tree" >&2
  exit 1
fi
first_runtime_docker_id="$(jq -r '.runtimeDockerImageId' "$work_root/first-manifest.json")"
second_runtime_docker_id="$(jq -r '.runtimeDockerImageId' "$work_root/second-manifest.json")"
runtime_docker_ids_equal=false
if [[ "$first_runtime_docker_id" == "$second_runtime_docker_id" ]]; then
  runtime_docker_ids_equal=true
fi

# Prove the canonical prepared identity remains sensitive to real toolchain drift
# that the narrower npm CLI subtree digest would not detect.
docker build --pull=false --tag "$mutation_image" - <<DOCKERFILE >/dev/null
FROM ${prepared_image}
RUN mkdir -p /usr/local/share \
    && printf 'ev28-prepared-identity-mutation\n' > /usr/local/share/ev28-prepared-identity-mutation
DOCKERFILE
bash scripts/compute-prepared-toolchain-identity.sh \
  "$mutation_image" \
  "$base_image_ref" \
  "$prepared_npm_version" \
  > "$work_root/mutated.env"
mutated_prepared_image_id="$(value_of "$work_root/mutated.env" IRONSHADE_PROOF_PREPARED_IMAGE_ID)"
if [[ "$mutated_prepared_image_id" == "$prepared_image_id" ]]; then
  echo "EV28_PREPARED_IMAGE_STABILITY_FAIL canonical prepared identity ignored /usr/local mutation" >&2
  exit 1
fi
mutated_npm_cli_tree="$(npm_cli_tree_of "$mutation_image")"
if [[ "$mutated_npm_cli_tree" != "$npm_cli_tree" ]]; then
  echo "EV28_PREPARED_IMAGE_STABILITY_FAIL negative control unexpectedly changed npm CLI subtree" >&2
  exit 1
fi

cat > "$evidence_dir/evidence.json" <<EOF
{
  "schema": "ironshade-ev28-prepared-image-stability:v1",
  "candidateSha": "$candidate_sha",
  "freshBuilds": 2,
  "identitiesCompared": 5,
  "preparedImageIdentityMethod": "canonical-usrlocal-v1",
  "baseImageRef": "$base_image_ref",
  "preparedImageId": "$prepared_image_id",
  "preparedToolchainTreeSha256": "$first_toolchain_tree",
  "firstRuntimeDockerImageId": "$first_runtime_docker_id",
  "secondRuntimeDockerImageId": "$second_runtime_docker_id",
  "runtimeDockerImageIdsEqual": $runtime_docker_ids_equal,
  "npmCliTreeSha256": "$npm_cli_tree",
  "dockerEngineVersion": "$docker_engine",
  "dependencyTreeSha256": "$dependency_tree",
  "negativeUsrLocalMutation": "rejected",
  "mutatedPreparedImageId": "$mutated_prepared_image_id",
  "mutatedNpmCliTreeSha256": "$mutated_npm_cli_tree",
  "result": "stable"
}
EOF

printf '%s\n' \
  "EV28_PREPARED_IMAGE_STABILITY_PASS candidate=$candidate_sha freshBuilds=2 identities=5 identityMethod=canonical-usrlocal-v1 runtimeDockerIdsEqual=$runtime_docker_ids_equal negativeUsrLocalMutation=rejected preparedImageId=$prepared_image_id"
