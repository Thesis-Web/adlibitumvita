#!/usr/bin/env bash
# Ad Libitum Vita — one-shot, idempotent host bootstrap + deploy.
#
# Run this directly on the droplet, as the `deploy` user, from the repo
# checkout:
#
#   cd /home/deploy/repos/adlibitumvita
#   bash deploy/bootstrap-host.sh
#
# It is safe to re-run: every step is idempotent, and re-running is also how
# you do a manual deploy of a new commit before GitHub Actions secrets are
# configured. It never touches anything belonging to another application on
# this host — only /srv/adlibitumvita, /var/www/adlibitumvita, its own nginx
# vhost file, and its own systemd unit.
#
# It never installs/replaces the system Node — it fetches a private Node 22
# runtime into /srv/adlibitumvita/shared/runtime, used only by this service.
set -euo pipefail

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
warn() { printf '\n\033[1;33m!!\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mFAILED:\033[0m %s\n' "$1" >&2; exit 1; }

# --- configuration -----------------------------------------------------

DOMAIN="adlibitumvita.com"
WWW_DOMAIN="www.adlibitumvita.com"
NODE_VERSION="22.23.2"
DEPLOY_PATH="/var/www/adlibitumvita"
SHARED_PATH="/srv/adlibitumvita/shared"
RUNTIME_DIR="${SHARED_PATH}/runtime/node-v${NODE_VERSION}-linux-x64"
RUNTIME_CURRENT="${SHARED_PATH}/runtime/current"
ALV_NODE_BIN="${RUNTIME_CURRENT}/bin"
PORT="3211"
LE_EMAIL="${ALV_LE_EMAIL:-}"

REPO_DIR="$(pwd)"

# --- preconditions -------------------------------------------------------

log "Checking preconditions"

[ -f "${REPO_DIR}/package.json" ] && grep -q '"name": "adlibitumvita"' "${REPO_DIR}/package.json" \
  || fail "Run this from the adlibitumvita repo root (cd /home/deploy/repos/adlibitumvita)."

command -v git >/dev/null || fail "git is required."
command -v curl >/dev/null || fail "curl is required (apt-get install -y curl)."
command -v sudo >/dev/null || fail "sudo is required."
command -v nginx >/dev/null || fail "nginx is required and expected to already be installed as machine ingress."
command -v systemctl >/dev/null || fail "systemctl is required."

GIT_SHA="$(git -C "${REPO_DIR}" rev-parse HEAD)"
[ -n "$(git -C "${REPO_DIR}" status --porcelain)" ] && warn "Working tree has uncommitted changes — deploying committed HEAD (${GIT_SHA}) only."

log "Requesting sudo (needed for /srv, /var/www, nginx, systemd)"
sudo -v

# --- ALV-owned persistent directories ------------------------------------

log "Creating ALV-owned persistent directories"
sudo mkdir -p \
  "${DEPLOY_PATH}/releases" \
  "${SHARED_PATH}/data" \
  "${SHARED_PATH}/media" \
  "${SHARED_PATH}/backups" \
  "${SHARED_PATH}/import" \
  "${SHARED_PATH}/runtime" \
  "${SHARED_PATH}/bin"
sudo chown -R "$(id -u):$(id -g)" "${DEPLOY_PATH}" "/srv/adlibitumvita"

# --- ALV-private Node 22 runtime (never touches system Node) -------------

if [ -x "${RUNTIME_DIR}/bin/node" ]; then
  log "ALV Node ${NODE_VERSION} runtime already installed at ${RUNTIME_DIR}"
else
  log "Installing ALV-private Node ${NODE_VERSION} runtime (does not affect system Node)"
  TMP_TARBALL="$(mktemp)"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o "${TMP_TARBALL}" \
    || fail "Could not download Node ${NODE_VERSION}. Check network access from this host."
  tar -xJf "${TMP_TARBALL}" -C "${SHARED_PATH}/runtime"
  rm -f "${TMP_TARBALL}"
fi
ln -sfnT "${RUNTIME_DIR}" "${RUNTIME_CURRENT}"
"${ALV_NODE_BIN}/node" -v

# --- production .env (created once, never overwritten) -------------------

if [ -f "${SHARED_PATH}/.env" ]; then
  log ".env already exists at ${SHARED_PATH}/.env — leaving it untouched"
else
  log "Generating ${SHARED_PATH}/.env"
  SECRET="$("${ALV_NODE_BIN}/node" -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))')"
  cat > "${SHARED_PATH}/.env" <<EOF
NODE_ENV=production
DATABASE_PATH=${SHARED_PATH}/data/adlibitumvita.sqlite3
BETTER_AUTH_SECRET=${SECRET}
BETTER_AUTH_URL=https://${DOMAIN}
MEDIA_DRIVER=local
MEDIA_LOCAL_PATH=${SHARED_PATH}/media
PORT=${PORT}
EOF
  chmod 600 "${SHARED_PATH}/.env"
fi

# --- build the release from this checkout ---------------------------------

log "Installing dependencies (npm ci) with the ALV Node runtime"
"${ALV_NODE_BIN}/npm" ci --no-audit --no-fund

log "Building"
set -a; source "${SHARED_PATH}/.env"; set +a
export GIT_SHA
"${ALV_NODE_BIN}/npm" run build

RELEASE_DIR="${DEPLOY_PATH}/releases/${GIT_SHA}"
log "Assembling release ${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"
rm -rf "${RELEASE_DIR}"/{dist,migrations,scripts,node_modules}
cp -r dist migrations scripts node_modules package.json package-lock.json "${RELEASE_DIR}/"

# Prune dev dependencies inside the release copy only — never touch the
# checkout's own node_modules, which stays usable for `npm run dev`/`test`.
log "Pruning release to production dependencies"
(cd "${RELEASE_DIR}" && "${ALV_NODE_BIN}/npm" prune --omit=dev)

# --- systemd + cutover script ----------------------------------------------

log "Installing systemd unit"
sudo cp deploy/systemd/adlibitumvita.service /etc/systemd/system/adlibitumvita.service
sudo systemctl daemon-reload
sudo systemctl enable adlibitumvita.service >/dev/null

cp deploy/release-current.sh "${SHARED_PATH}/bin/release-current.sh"
chmod +x "${SHARED_PATH}/bin/release-current.sh"

log "Running atomic cutover (migrate, flip current, restart, health check)"
RELEASE_DIR="${RELEASE_DIR}" \
ALV_NODE="${ALV_NODE_BIN}/node" \
DEPLOY_PATH="${DEPLOY_PATH}" \
SHARED_PATH="${SHARED_PATH}" \
bash "${SHARED_PATH}/bin/release-current.sh" \
  || fail "Cutover failed — service was rolled back to the previous release (if any). Check: journalctl -u adlibitumvita.service -n 100"

# --- nginx ------------------------------------------------------------------

log "Installing nginx vhost for ${DOMAIN}"
sudo cp deploy/nginx/adlibitumvita.com.conf /etc/nginx/sites-available/adlibitumvita.com
sudo ln -sfn ../sites-available/adlibitumvita.com /etc/nginx/sites-enabled/adlibitumvita.com

sudo nginx -t || fail "nginx config test failed — NOT reloading. Other sites on this host are untouched. Fix /etc/nginx/sites-available/adlibitumvita.com and re-run."
sudo systemctl reload nginx

# --- TLS ---------------------------------------------------------------------

if command -v certbot >/dev/null 2>&1; then
  log "Requesting/renewing TLS via certbot (DNS is already pointed at this host, DNS-only/gray-cloud)"
  CERTBOT_ARGS=(--nginx -d "${DOMAIN}" -d "${WWW_DOMAIN}" --non-interactive --agree-tos --redirect)
  if [ -n "${LE_EMAIL}" ]; then
    CERTBOT_ARGS+=(-m "${LE_EMAIL}")
  else
    CERTBOT_ARGS+=(--register-unsafely-without-email)
  fi
  sudo certbot "${CERTBOT_ARGS[@]}" \
    || warn "certbot failed — site is live on HTTP only. Re-run manually: sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN}"
else
  warn "certbot not found — site is live on HTTP only. To enable HTTPS: sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN}"
fi

# --- final validation ----------------------------------------------------

log "Validating"
curl -fsS "http://127.0.0.1:${PORT}/api/health" && echo || fail "Direct app health check failed."

# certbot's --redirect (if it ran) makes plain HTTP 301 to HTTPS instead of
# serving the app — that's correct behavior, not a failure, so accept either.
NGINX_STATUS="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" http://127.0.0.1/api/health)"
case "${NGINX_STATUS}" in
  200|301|302) echo "Health check through nginx (loopback): HTTP ${NGINX_STATUS}" ;;
  *) fail "Health check through nginx (loopback) failed — got HTTP ${NGINX_STATUS}." ;;
esac

if curl -fsS -m 5 "https://${DOMAIN}/api/health" > /dev/null 2>&1; then
  echo "Public HTTPS health check: OK"
else
  warn "Public HTTPS health check did not succeed yet (DNS/TLS may still be propagating). HTTP-via-loopback already confirmed the app and nginx are wired correctly."
fi

log "Done"
echo "Release:  ${RELEASE_DIR}"
echo "Current:  $(readlink -f "${DEPLOY_PATH}/current")"
echo "Service:  $(systemctl is-active adlibitumvita.service)"
echo
echo "Next: create the first admin —"
echo "  cd ${DEPLOY_PATH}/current"
echo "  set -a; source ${SHARED_PATH}/.env; set +a"
echo "  ${ALV_NODE_BIN}/npm run admin:create -- --email you@example.com --name \"Your Name\""
