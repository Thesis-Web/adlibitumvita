#!/usr/bin/env bash
# Ad Libitum Vita — atomic SHA-addressed release deploy.
# Run from CI after `npm run build` with a release/ artifact directory staged
# (see .github/workflows/deploy.yml for how it's assembled).
set -euo pipefail

: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"
: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${GIT_SHA:?Missing GIT_SHA}"

DEPLOY_PATH="/var/www/adlibitumvita"
SHARED_PATH="/srv/adlibitumvita/shared"
RELEASE_DIR="${DEPLOY_PATH}/releases/${GIT_SHA}"
LOCAL_RELEASE="${LOCAL_RELEASE:-release}"

echo "Deploying ${LOCAL_RELEASE} -> ${DEPLOY_USER}@${DEPLOY_HOST}:${RELEASE_DIR}"

ssh "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "mkdir -p '${DEPLOY_PATH}/releases' '${SHARED_PATH}/data' '${SHARED_PATH}/media' '${SHARED_PATH}/backups' '${SHARED_PATH}/import' '${RELEASE_DIR}'"

rsync -az --delete "${LOCAL_RELEASE}/" "${DEPLOY_USER}@${DEPLOY_HOST}:${RELEASE_DIR}/"

ssh "${DEPLOY_USER}@${DEPLOY_HOST}" \
  DEPLOY_PATH="${DEPLOY_PATH}" \
  SHARED_PATH="${SHARED_PATH}" \
  RELEASE_DIR="${RELEASE_DIR}" \
  'bash -seu' <<'REMOTE'
set -euo pipefail

# Invariants before touching anything live.
test -f "$RELEASE_DIR/dist/server/entry.mjs"
test -f "$RELEASE_DIR/package.json"
test -d "$RELEASE_DIR/migrations"
test -f "$SHARED_PATH/.env"

PREVIOUS_RELEASE=""
if [ -L "${DEPLOY_PATH}/current" ]; then
  PREVIOUS_RELEASE="$(readlink -f "${DEPLOY_PATH}/current")"
fi

if [ -f "${SHARED_PATH}/data/adlibitumvita.sqlite3" ]; then
  cd "$RELEASE_DIR"
  set -a; source "${SHARED_PATH}/.env"; set +a
  GIT_SHA="$(basename "$RELEASE_DIR")" node node_modules/.bin/tsx scripts/db-backup.ts
fi

cd "$RELEASE_DIR"
set -a; source "${SHARED_PATH}/.env"; set +a
node node_modules/.bin/tsx scripts/migrate.ts

ln -sfnT "$RELEASE_DIR" "${DEPLOY_PATH}/current"
sudo systemctl restart adlibitumvita.service

sleep 2
if ! curl -fsS "http://127.0.0.1:${PORT:-3211}/api/health" > /dev/null; then
  echo "Health check failed after deploy."
  if [ -n "$PREVIOUS_RELEASE" ]; then
    echo "Rolling back to $PREVIOUS_RELEASE"
    ln -sfnT "$PREVIOUS_RELEASE" "${DEPLOY_PATH}/current"
    sudo systemctl restart adlibitumvita.service
  fi
  exit 1
fi

echo "Current -> $(readlink -f "${DEPLOY_PATH}/current")"

# Keep a bounded release history.
cd "${DEPLOY_PATH}/releases"
ls -1t | tail -n +6 | xargs -r rm -rf
REMOTE
