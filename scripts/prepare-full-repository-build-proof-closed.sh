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
prepared_npm_version='10.9.8'
work_root="${FULL_REPOSITORY_BUILD_PREPARED_ROOT:-.agent-proof-cache-closure}"
if [[ "$work_root" != /* ]]; then
  work_root="$PWD/$work_root"
fi
prepared_dir="$work_root/$candidate_sha"
snapshot="$prepared_dir/snapshot"
identity_env="$prepared_dir/prepared-toolchain-identity.env"

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

existing_base_ref="$(docker image inspect --format '{{index .Config.Labels "org.ironshade.proof-base"}}' "$prepared_image" 2>/dev/null || true)"
if [[ "$existing_base_ref" != "$base_image_ref" ]]; then
  docker build --pull=false --tag "$prepared_image" - <<DOCKERFILE >/dev/null
FROM ${base_image_ref}
LABEL org.ironshade.proof-base="${base_image_ref}"
RUN npm install --global npm@${prepared_npm_version} \
    && test "\$(npm --version)" = '${prepared_npm_version}'
DOCKERFILE
fi

bash scripts/compute-prepared-toolchain-identity.sh \
  "$prepared_image" \
  "$base_image_ref" \
  "$prepared_npm_version" \
  > "$identity_env"
# Values are machine-generated sha256/version tokens with no shell metacharacters.
# shellcheck disable=SC1090
source "$identity_env"
prepared_image_id="$IRONSHADE_PROOF_PREPARED_IMAGE_ID"
prepared_toolchain_tree_sha256="$IRONSHADE_PROOF_PREPARED_TOOLCHAIN_TREE_SHA256"
runtime_docker_image_id="$IRONSHADE_PROOF_RUNTIME_DOCKER_IMAGE_ID"

npm_cli_tree_sha256="$(
  docker run --rm "$prepared_image" sh -lc '
    set -eu
    root="$(npm root -g)"
    tar --sort=name --mtime="@0" --owner=0 --group=0 --numeric-owner -C "$root" -cf - npm \
      | sha256sum \
      | cut -d" " -f1
  '
)"
if [[ ! "$npm_cli_tree_sha256" =~ ^[a-f0-9]{64}$ ]]; then
  echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_FAIL invalid npm CLI tree digest" >&2
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
IRONSHADE_PROOF_NPM_CLI_TREE_SHA256=$npm_cli_tree_sha256
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
  "preparedImageIdentityMethod": "canonical-usrlocal-v1",
  "preparedToolchainTreeSha256": "$prepared_toolchain_tree_sha256",
  "runtimeDockerImageId": "$runtime_docker_image_id",
  "npmCliTreeSha256": "$npm_cli_tree_sha256",
  "dockerEngineVersion": "$docker_engine_version",
  "dependencyTreeSha256": "$dependency_tree_sha256",
  "networkPhase": "completed-before-cache-decision",
  "registryResultBoundBy": ["preparedImageId", "npmCliTreeSha256", "dependencyTreeSha256"],
  "buildNetwork": "none"
}
EOF

if [[ -n "${GITHUB_ENV:-}" ]]; then
  cat "$prepared_dir/closure.env" >> "$GITHUB_ENV"
fi

echo "FULL_REPOSITORY_BUILD_CLOSURE_PREP_PASS candidate=$candidate_sha baseImageRef=$base_image_ref npmCliTree=$npm_cli_tree_sha256 preparedImageId=$prepared_image_id runtimeDockerImageId=$runtime_docker_image_id preparedToolchainTree=$prepared_toolchain_tree_sha256 dockerEngine=$docker_engine_version dependencyTree=$dependency_tree_sha256 networkPhase=completed-before-cache-decision identityMethod=canonical-usrlocal-v1"
