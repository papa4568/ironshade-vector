#!/usr/bin/env bash
set -euo pipefail

image="${1:-}"
base_image_ref="${2:-}"
npm_version="${3:-10.9.8}"

if [[ -z "$image" ]]; then
  echo 'PREPARED_TOOLCHAIN_IDENTITY_FAIL image argument is required' >&2
  exit 2
fi
if [[ ! "$base_image_ref" =~ ^node@sha256:[a-f0-9]{64}$ ]]; then
  echo "PREPARED_TOOLCHAIN_IDENTITY_FAIL invalid immutable base image identity: $base_image_ref" >&2
  exit 2
fi
if [[ ! "$npm_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "PREPARED_TOOLCHAIN_IDENTITY_FAIL invalid npm version: $npm_version" >&2
  exit 2
fi

runtime_docker_image_id="$(docker image inspect --format '{{.Id}}' "$image")"
if [[ ! "$runtime_docker_image_id" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "PREPARED_TOOLCHAIN_IDENTITY_FAIL invalid runtime Docker image ID: $runtime_docker_image_id" >&2
  exit 2
fi

# Docker's config/layer image ID includes build metadata that can vary across
# causally identical fresh builds. Bind the closure to the actual prepared
# toolchain filesystem instead, with timestamps/ownership normalized away.
prepared_toolchain_tree_sha256="$(
  docker run --rm --entrypoint sh "$image" -lc '
    set -eu
    tar --sort=name --mtime="@0" --owner=0 --group=0 --numeric-owner -C /usr/local -cf - .
  ' \
    | sha256sum \
    | cut -d' ' -f1
)"
if [[ ! "$prepared_toolchain_tree_sha256" =~ ^[a-f0-9]{64}$ ]]; then
  echo 'PREPARED_TOOLCHAIN_IDENTITY_FAIL invalid canonical /usr/local tree digest' >&2
  exit 2
fi

prepared_identity_digest="$(
  printf '%s\n' \
    'ironshade-prepared-toolchain-identity:v1' \
    "baseImageRef=$base_image_ref" \
    "npmVersion=$npm_version" \
    "toolchainTreeSha256=$prepared_toolchain_tree_sha256" \
    | sha256sum \
    | cut -d' ' -f1
)"

cat <<EOF
IRONSHADE_PROOF_PREPARED_IMAGE_ID=sha256:$prepared_identity_digest
IRONSHADE_PROOF_PREPARED_TOOLCHAIN_TREE_SHA256=$prepared_toolchain_tree_sha256
IRONSHADE_PROOF_RUNTIME_DOCKER_IMAGE_ID=$runtime_docker_image_id
EOF
