#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_SHA:?RELEASE_SHA is required}"
: "${FRONTEND_TAG:?FRONTEND_TAG is required}"
if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ || "$FRONTEND_TAG" != "sha-${RELEASE_SHA:0:8}" ]]; then
  echo 'Release tag does not match the full commit SHA' >&2; exit 1
fi

script_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# Complete the local verification before configuring storage or writing either bucket.
"${NODE_BIN:-node}" "$script_directory/release-manifest.mjs" verify dist "$RELEASE_SHA"

mc alias set deploy http://localhost:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc mb -p deploy/blog-frontend-releases 2>/dev/null || true
# mc cp deliberately preserves the existing sha-<8>/dist/ archive layout.
mc cp --recursive dist/ "deploy/blog-frontend-releases/$FRONTEND_TAG/"
mc mirror --overwrite --remove dist/ deploy/blog-frontend/
echo "Published verified release $FRONTEND_TAG"
