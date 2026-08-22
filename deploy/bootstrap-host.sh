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
#
# TLS is only attempted once DNS for both adlibitumvita.com and
# www.adlibitumvita.com is confirmed to resolve to this host against both
# 1.1.1.1 and 8.8.8.8 — otherwise that phase is skipped (app + HTTP nginx
# still deploy) and the script prints exactly what to fix. Optionally set
# CERTBOT_EMAIL for Let's Encrypt expiry notices; if unset and run
# interactively you'll be prompted, otherwise the cert is issued without an
# email.
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
DROPLET_IP="146.190.139.104"
# Accepts either name; CERTBOT_EMAIL matches the operator-facing docs/spec.
LE_EMAIL="${CERTBOT_EMAIL:-${ALV_LE_EMAIL:-}}"

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
# Once a certificate already exists, install the canonical-host (www/HTTP ->
# apex redirect) vhost directly. Before that, install the plain-HTTP vhost
# that certbot's nginx plugin will use for the ACME challenge and then edit
# in place. Re-running this script never regresses a working HTTPS vhost
# back to HTTP-only, even if DNS has a transient blip on this particular run.

CERT_FULLCHAIN="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ -f "${CERT_FULLCHAIN}" ]; then
  log "TLS certificate already present — installing canonical-host vhost"
  sudo cp deploy/nginx/adlibitumvita.com.tls.conf /etc/nginx/sites-available/adlibitumvita.com
else
  log "Installing nginx vhost for ${DOMAIN} (HTTP, pre-certificate)"
  sudo cp deploy/nginx/adlibitumvita.com.conf /etc/nginx/sites-available/adlibitumvita.com
fi
sudo ln -sfn ../sites-available/adlibitumvita.com /etc/nginx/sites-enabled/adlibitumvita.com

sudo nginx -t || fail "nginx config test failed — NOT reloading. Other sites on this host are untouched. Fix /etc/nginx/sites-available/adlibitumvita.com and re-run."
sudo systemctl reload nginx

# --- DNS preflight ------------------------------------------------------

log "DNS preflight (checking public resolvers before attempting TLS)"
command -v dig >/dev/null 2>&1 || {
  log "Installing dnsutils (for dig)"
  sudo apt-get update -y -qq && sudo apt-get install -y -qq dnsutils
}

echo "  NS ${DOMAIN} -> $(dig +short NS "${DOMAIN}" | tr '\n' ' ')"
DNS_OK=true
for resolver in 1.1.1.1 8.8.8.8; do
  for host in "${DOMAIN}" "${WWW_DOMAIN}"; do
    got="$(dig "@${resolver}" +short A "${host}" | tail -n1)"
    echo "  dig @${resolver} +short A ${host} -> ${got:-<empty>}"
    [ "${got}" = "${DROPLET_IP}" ] || DNS_OK=false
  done
done

# --- TLS ---------------------------------------------------------------------

if [ "${DNS_OK}" != true ]; then
  warn "DNS does not yet resolve both ${DOMAIN} and ${WWW_DOMAIN} to ${DROPLET_IP} on both 1.1.1.1 and 8.8.8.8 (see results above)."
  warn "Skipping the TLS phase — not retrying certbot against unproven DNS. App + HTTP nginx are still deployed and live."
  warn "Fix DNS, then re-run this exact command (bash deploy/bootstrap-host.sh) — it is idempotent and will pick up TLS from where it left off."
elif ! command -v certbot >/dev/null 2>&1; then
  log "Installing certbot"
  sudo apt-get update -y -qq
  sudo apt-get install -y -qq certbot python3-certbot-nginx
fi

if [ "${DNS_OK}" = true ]; then
  if [ -z "${LE_EMAIL}" ] && [ -t 0 ]; then
    read -r -p "Certificate email for Let's Encrypt expiry notices (blank to skip): " LE_EMAIL
  fi

  log "Requesting/renewing TLS via certbot for ${DOMAIN} and ${WWW_DOMAIN}"
  CERTBOT_ARGS=(--nginx -d "${DOMAIN}" -d "${WWW_DOMAIN}" --non-interactive --agree-tos --redirect)
  if [ -n "${LE_EMAIL}" ]; then
    CERTBOT_ARGS+=(-m "${LE_EMAIL}")
  else
    CERTBOT_ARGS+=(--register-unsafely-without-email)
  fi

  if sudo certbot "${CERTBOT_ARGS[@]}"; then
    if [ -f "${CERT_FULLCHAIN}" ]; then
      log "Cert present — installing canonical-host vhost (www + HTTP redirect to https://${DOMAIN})"
      NGINX_BACKUP="$(mktemp)"
      sudo cp /etc/nginx/sites-available/adlibitumvita.com "${NGINX_BACKUP}"
      sudo cp deploy/nginx/adlibitumvita.com.tls.conf /etc/nginx/sites-available/adlibitumvita.com
      if sudo nginx -t; then
        sudo systemctl reload nginx
        log "Canonical-host vhost active"
      else
        warn "Canonical-host vhost failed nginx -t — reverting to the certbot-generated config (already working, just without the www->apex redirect)."
        sudo cp "${NGINX_BACKUP}" /etc/nginx/sites-available/adlibitumvita.com
        sudo nginx -t && sudo systemctl reload nginx
      fi
      rm -f "${NGINX_BACKUP}"
    fi

    log "Verifying renewal"
    systemctl status certbot.timer --no-pager 2>&1 | head -5 || warn "certbot.timer not found — check the renewal mechanism this Ubuntu release installed."
    sudo certbot renew --dry-run || warn "certbot renew --dry-run failed — investigate before relying on auto-renewal."
  else
    warn "certbot failed — site is live on HTTP only. Re-run this script once resolved, or manually: sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN} --redirect"
  fi
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
  echo "Public HTTPS health check (${DOMAIN}): OK"
else
  warn "Public HTTPS health check (${DOMAIN}) did not succeed yet (DNS/TLS may still be propagating). HTTP-via-loopback already confirmed the app and nginx are wired correctly."
fi

if [ -f "${CERT_FULLCHAIN}" ]; then
  WWW_STATUS="$(curl -s -o /dev/null -w '%{http_code}' -m 5 "https://${WWW_DOMAIN}/" 2>/dev/null || echo "000")"
  case "${WWW_STATUS}" in
    301|302) echo "Public HTTPS check (${WWW_DOMAIN}): HTTP ${WWW_STATUS} (redirects to apex, as intended)" ;;
    000) warn "Public HTTPS check (${WWW_DOMAIN}) did not succeed yet (DNS/TLS may still be propagating)." ;;
    *) warn "Public HTTPS check (${WWW_DOMAIN}) returned HTTP ${WWW_STATUS} (expected a redirect to the apex)." ;;
  esac
fi

log "Done"
echo "Release:  ${RELEASE_DIR}"
echo "Current:  $(readlink -f "${DEPLOY_PATH}/current")"
echo "Service:  $(systemctl is-active adlibitumvita.service)"
echo "TLS:      $([ -f "${CERT_FULLCHAIN}" ] && echo "issued (${CERT_FULLCHAIN})" || echo "not yet issued")"
echo
echo "Next: create the first admin —"
echo "  cd ${DEPLOY_PATH}/current"
echo "  set -a; source ${SHARED_PATH}/.env; set +a"
echo "  ${ALV_NODE_BIN}/npm run admin:create -- --email you@example.com --name \"Your Name\""
