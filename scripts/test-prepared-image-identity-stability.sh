#!/usr/bin/env bash
set -euo pipefail

candidate_sha="${CANDIDATE_SHA:-$(git rev-parse HEAD)}"
if [[ ! "$candidate_sha" =~ ^[a-f0-9]{40}$ ]] || [[ "$(git rev-parse HEAD)" != "$candidate_sha" ]]; then
  echo "EV28_PREPARED_IMAGE_STABILITY_FAIL invalid exact candidate: $candidate_sha" >&2
  exit 2
fi

prepared_image='ironshade-proof-closed:node-22.23.2-npm-10.9.8'
work_root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/ev28-prepared-image.XXXXXX")"
evidence_dir="${EV28_EVIDENCE_DIR:-.ev28-prepared-image-stability}"
mkdir -p "$evidence_dir"

cleanup() {
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
  grep -F '"preparedImageSourceDateEpoch": "0"' "$manifest" >/dev/null || {
    echo "EV28_PREPARED_IMAGE_STABILITY_FAIL missing fixed source date epoch in $manifest" >&2
    exit 1
  }
done

cat > "$evidence_dir/evidence.json" <<EOF
{
  "schema": "ironshade-ev28-prepared-image-stability:v1",
  "candidateSha": "$candidate_sha",
  "freshBuilds": 2,
  "identitiesCompared": 5,
  "sourceDateEpoch": "0",
  "baseImageRef": "$base_image_ref",
  "preparedImageId": "$prepared_image_id",
  "npmCliTreeSha256": "$npm_cli_tree",
  "dockerEngineVersion": "$docker_engine",
  "dependencyTreeSha256": "$dependency_tree",
  "result": "stable"
}
EOF

printf '%s\n' \
  "EV28_PREPARED_IMAGE_STABILITY_PASS candidate=$candidate_sha freshBuilds=2 identities=5 preparedImageId=$prepared_image_id sourceDateEpoch=0"
