#!/usr/bin/env bash
set -euo pipefail

candidate_sha="${CANDIDATE_SHA:-}"
if [[ ! "$candidate_sha" =~ ^[a-f0-9]{40}$ ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_FAIL invalid CANDIDATE_SHA=$candidate_sha" >&2
  exit 2
fi

if [[ "$(git rev-parse HEAD)" != "$candidate_sha" ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_FAIL checked-out HEAD does not match candidate" >&2
  exit 2
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_FAIL tracked worktree must be clean" >&2
  exit 2
fi

base_image='node:22.23.2-bookworm'
prepared_image='ironshade-proof-closed:node-22.23.2-npm-10.9.8'
work_root="${FULL_REPOSITORY_BUILD_PREPARED_ROOT:-.agent-proof-cache-closure}"
prepared_dir="$work_root/$candidate_sha"
snapshot="$prepared_dir/snapshot"

rm -rf "$prepared_dir"
mkdir -p "$snapshot"

echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP networkPhase=begin candidate=$candidate_sha"
docker pull "$base_image" >/dev/null
base_image_ref="$(docker image inspect --format '{{index .RepoDigests 0}}' "$base_image")"
docker_engine_version="$(docker version --format '{{.Server.Version}}')"
if [[ ! "$base_image_ref" =~ ^node@sha256:[a-f0-9]{64}$ ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_FAIL invalid immutable base image identity: $base_image_ref" >&2
  exit 2
fi
if [[ -z "$docker_engine_version" ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_FAIL missing Docker engine version" >&2
  exit 2
fi

docker build --pull=false --tag "$prepared_image" - <<DOCKERFILE >/dev/null
FROM ${base_image_ref}
RUN npm install --global npm@10.9.8 \
    && test "\$(npm --version)" = '10.9.8'
DOCKERFILE
prepared_image_id="$(docker image inspect --format '{{.Id}}' "$prepared_image")"
if [[ ! "$prepared_image_id" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_FAIL invalid prepared image identity: $prepared_image_id" >&2
  exit 2
fi

git archive --format=tar "$candidate_sha" | tar -xf - -C "$snapshot"
test ! -e "$snapshot/.git"

docker run --rm \
  --volume "$snapshot:/workspace" \
  --workdir /workspace \
  --env HOME=/tmp \
  --user "$(id -u):$(id -g)" \
  "$prepared_image" \
  npm ci --ignore-scripts --no-audit --no-fund

test -d "$snapshot/node_modules"
dependency_tree_sha256="$(
  cd "$snapshot"
  tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner -cf - node_modules \
    | sha256sum \
    | cut -d' ' -f1
)"
if [[ ! "$dependency_tree_sha256" =~ ^[a-f0-9]{64}$ ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_FAIL invalid dependency tree digest" >&2
  exit 2
fi

cat > "$prepared_dir/closure.env" <<EOF
IRONSHADE_PROOF_BASE_IMAGE_REF=$base_image_ref
IRONSHADE_PROOF_PREPARED_IMAGE_ID=$prepared_image_id
IRONSHADE_PROOF_DOCKER_ENGINE_VERSION=$docker_engine_version
IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256=$dependency_tree_sha256
IRONSHADE_PROOF_PREPARED_DIR=$prepared_dir
IRONSHADE_PROOF_PREPARED_IMAGE=$prepared_image
EOF

cat > "$prepared_dir/manifest.json" <<EOF
{
  "schema": "ironshade-full-repository-build-preflight:v1",
  "candidateSha": "$candidate_sha",
  "baseImage": "$base_image",
  "baseImageRef": "$base_image_ref",
  "preparedImage": "$prepared_image",
  "preparedImageId": "$prepared_image_id",
  "dockerEngineVersion": "$docker_engine_version",
  "dependencyTreeSha256": "$dependency_tree_sha256",
  "networkPhase": "completed-before-cache-decision",
  "registryResultBoundBy": ["preparedImageId", "dependencyTreeSha256"],
  "buildNetwork": "none"
}
EOF

if [[ -n "${GITHUB_ENV:-}" ]]; then
  cat "$prepared_dir/closure.env" >> "$GITHUB_ENV"
fi

echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_PASS candidate=$candidate_sha baseImageRef=$base_image_ref preparedImageId=$prepared_image_id dockerEngine=$docker_engine_version dependencyTree=$dependency_tree_sha256 networkPhase=completed-before-cache-decision"
