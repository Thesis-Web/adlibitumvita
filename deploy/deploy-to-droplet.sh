#!/usr/bin/env bash
# Ad Libitum Vita — atomic SHA-addressed release deploy, driven from CI.
# Run after `npm run build` with a release/ artifact directory staged
# (see .github/workflows/deploy.yml for how it's assembled).
set -euo pipefail

: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"
: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${GIT_SHA:?Missing GIT_SHA}"

DEPLOY_PATH="/var/www/adlibitumvita"
SHARED_PATH="/srv/adlibitumvita/shared"
ALV_NODE="${SHARED_PATH}/runtime/current/bin/node"
RELEASE_DIR="${DEPLOY_PATH}/releases/${GIT_SHA}"
LOCAL_RELEASE="${LOCAL_RELEASE:-release}"

echo "Deploying ${LOCAL_RELEASE} -> ${DEPLOY_USER}@${DEPLOY_HOST}:${RELEASE_DIR}"

ssh "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "mkdir -p '${DEPLOY_PATH}/releases' '${SHARED_PATH}/data' '${SHARED_PATH}/media' '${SHARED_PATH}/backups' '${SHARED_PATH}/import' '${SHARED_PATH}/bin' '${RELEASE_DIR}'"

rsync -az --delete "${LOCAL_RELEASE}/" "${DEPLOY_USER}@${DEPLOY_HOST}:${RELEASE_DIR}/"

# Keep the host's copy of the cutover script in sync with this release.
scp deploy/release-current.sh "${DEPLOY_USER}@${DEPLOY_HOST}:${SHARED_PATH}/bin/release-current.sh"

ssh "${DEPLOY_USER}@${DEPLOY_HOST}" \
  RELEASE_DIR="${RELEASE_DIR}" \
  ALV_NODE="${ALV_NODE}" \
  DEPLOY_PATH="${DEPLOY_PATH}" \
  SHARED_PATH="${SHARED_PATH}" \
  "bash '${SHARED_PATH}/bin/release-current.sh'"
