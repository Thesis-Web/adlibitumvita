#!/usr/bin/env bash
# Ad Libitum Vita — atomic release cutover.
#
# Given a fully-built release directory, this backs up the live DB (if one
# exists), runs migrations, flips the `current` symlink, restarts the
# service, health-checks it, and rolls back the symlink automatically if the
# health check fails. Used by both deploy/bootstrap-host.sh (manual/first
# deploy, run locally on the droplet) and deploy/deploy-to-droplet.sh (CI,
# run remotely over SSH) — this is the one place the cutover logic lives.
#
# Required env: RELEASE_DIR, ALV_NODE, DEPLOY_PATH, SHARED_PATH.
set -euo pipefail

: "${RELEASE_DIR:?Missing RELEASE_DIR}"
: "${ALV_NODE:?Missing ALV_NODE}"
: "${DEPLOY_PATH:?Missing DEPLOY_PATH}"
: "${SHARED_PATH:?Missing SHARED_PATH}"

# Invariants before touching anything live.
test -f "$RELEASE_DIR/dist/server/entry.mjs"
test -f "$RELEASE_DIR/package.json"
test -d "$RELEASE_DIR/migrations"
test -f "$SHARED_PATH/.env"

PREVIOUS_RELEASE=""
if [ -L "${DEPLOY_PATH}/current" ]; then
  PREVIOUS_RELEASE="$(readlink -f "${DEPLOY_PATH}/current")"
fi

set -a; source "${SHARED_PATH}/.env"; set +a

if [ -f "${SHARED_PATH}/data/adlibitumvita.sqlite3" ]; then
  echo "Backing up live database..."
  cd "$RELEASE_DIR"
  GIT_SHA="$(basename "$RELEASE_DIR")" "$ALV_NODE" node_modules/.bin/tsx scripts/db-backup.ts
fi

echo "Running migrations..."
cd "$RELEASE_DIR"
"$ALV_NODE" node_modules/.bin/tsx scripts/migrate.ts

echo "Flipping current -> $RELEASE_DIR"
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

echo "Health check passed. Current -> $(readlink -f "${DEPLOY_PATH}/current")"

# Keep a bounded release history (5 most recent).
cd "${DEPLOY_PATH}/releases"
ls -1t | tail -n +6 | xargs -r rm -rf
