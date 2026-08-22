#!/usr/bin/env bash
# Ad Libitum Vita — operator environment wrapper.
#
# npm, npx, tsx, and most JS CLIs resolve their own interpreter via a
# `#!/usr/bin/env node` shebang — i.e. from PATH, not from wherever you
# invoked the npm/npx binary itself. On this host, system Node (used by
# other apps) is 20; ALV requires its own private Node 22 runtime. Running
# `/srv/adlibitumvita/shared/runtime/current/bin/npm run admin:create`
# directly from an ordinary shell still resolves `node` from PATH — i.e.
# system Node 20 — which loads native modules (better-sqlite3) built for
# Node 22's ABI and fails with ERR_DLOPEN_FAILED.
#
# This wrapper puts the ALV runtime first on PATH, verifies it actually
# resolved (fails loudly instead of silently using the wrong Node), then
# execs whatever command you asked for. Every operator command in the
# README and in bootstrap-host.sh's own output is meant to be run through
# this wrapper.
#
# Usage:
#   /srv/adlibitumvita/shared/bin/alv-node-env npm run admin:create -- --email you@example.com --name "Your Name"
#   /srv/adlibitumvita/shared/bin/alv-node-env npm run db:migrate
set -euo pipefail

ALV_NODE_BIN="/srv/adlibitumvita/shared/runtime/current/bin"

if [ ! -x "${ALV_NODE_BIN}/node" ]; then
  echo "FATAL: ALV Node runtime not found at ${ALV_NODE_BIN}/node — run deploy/bootstrap-host.sh first." >&2
  exit 1
fi

export PATH="${ALV_NODE_BIN}:${PATH}"
hash -r

RESOLVED_NODE="$(command -v node)"
if [ "${RESOLVED_NODE}" != "${ALV_NODE_BIN}/node" ]; then
  echo "FATAL: node resolved to ${RESOLVED_NODE}, expected ${ALV_NODE_BIN}/node. PATH is misconfigured." >&2
  exit 1
fi

NODE_VERSION="$(node -p 'process.versions.node')"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if [ "${NODE_MAJOR}" -lt 22 ] || { [ "${NODE_MAJOR}" -eq 22 ] && [ "${NODE_MINOR}" -lt 12 ]; }; then
  echo "FATAL: resolved Node ${NODE_VERSION} (${RESOLVED_NODE}), ALV requires >=22.12." >&2
  exit 1
fi

if [ "$#" -eq 0 ]; then
  echo "Usage: alv-node-env <command> [args...]" >&2
  exit 1
fi

exec "$@"
