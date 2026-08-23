# Ad Libitum Vita

*live life unscripted*

A family expedition site: a public shell, a member-gated library (Captain's
Log + Beyond the Map), and an admin dashboard built for fast single-entry
publishing from a laptop or phone. Astro (Node adapter) + Better Auth +
SQLite (FTS5) + a provider-neutral media store (local filesystem today,
Cloudflare R2 when credentials exist).

See `docs/architecture.md` for how the pieces fit together and why.

## Development

```bash
npm install
cp .env.example .env        # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate
npm run dev                  # http://localhost:3211
```

## Build / typecheck / test

```bash
npm run build       # writes src/generated/build-info.json, then astro check + astro build
npm run typecheck
npm test
```

## Database

```bash
npm run db:migrate                 # applies migrations/*.sql in order, idempotent
npm run db:backup                  # safe SQLite backup API, writes to <db-dir>/../backups, keeps last 14
```

Dev/test databases live in `.data/` (gitignored). Production:
`/srv/adlibitumvita/shared/data/adlibitumvita.sqlite3`.

In production, run these through `alv-node-env` (see "First admin" above)
from `/var/www/adlibitumvita/current` with `/srv/adlibitumvita/shared/.env`
sourced:

```bash
/srv/adlibitumvita/shared/bin/alv-node-env npm run db:migrate
/srv/adlibitumvita/shared/bin/alv-node-env npm run db:backup
```

## First admin

No default admin account is ever created automatically.

In development, `.env` is picked up automatically from the repo root. In
production the release directory has no `.env` of its own — the real one
lives at `/srv/adlibitumvita/shared/.env` (referenced by systemd) and must
be sourced explicitly for one-off commands:

```bash
cd /var/www/adlibitumvita/current
set -a; source /srv/adlibitumvita/shared/.env; set +a
/srv/adlibitumvita/shared/bin/alv-node-env npm run admin:create -- --email you@example.com --name "Your Name"
# prompts for a password (min 12 chars), or set ADMIN_BOOTSTRAP_PASSWORD to skip the prompt
```

This creates the user, sets `role = admin`, and grants active library
access. Log in at `/login`. A second admin requires `--force`.

`alv-node-env` (installed by `bootstrap-host.sh` from `deploy/alv-node-env.sh`)
puts the ALV-private Node 22 runtime first on `PATH` before running the
command. This matters because `npm`/`npx`/`tsx` resolve their own
interpreter via a `#!/usr/bin/env node` shebang — i.e. from `PATH` — not
from wherever the `npm` binary you invoked lives. Running
`/srv/adlibitumvita/shared/runtime/current/bin/npm run admin:create`
directly, in a shell where system Node 20 is first on `PATH`, still
resolves `node` to system Node 20 and fails to load `better-sqlite3`
(`ERR_DLOPEN_FAILED`, ABI mismatch) — always go through `alv-node-env`, not
the runtime's `npm` binary directly. Every command below follows the same
rule.

## Adding a family user

Log in as admin, go to `/admin/users`, fill in name/email/temporary
password. This creates the account with an active library grant in one
step — no public sign-up exists, and there is no need to touch SQLite
directly.

## Publishing an entry

`/admin` → **New Entry** → pick Captain's Log or Beyond the Map → fill in
title/day/date/location/tags/excerpt → write the body in Markdown → **Save
Draft**. On the edit page that follows, drag in photos under **Photos**,
set alt text/captions, mark a cover, then **Publish**. It appears at
`/library/<collection>` immediately — no rebuild needed. Every save is a
new revision; **Revision history** on the edit page can restore any prior
version. `Cmd/Ctrl+S` saves without leaving the textarea.

## Bulk import

Markdown directories (`Captains_Log/day-01/captains-log.md` + `assets/`):

```bash
npm run import:markdown -- --source /path/to/Captains_Log --dry-run
npm run import:markdown -- --source /path/to/Captains_Log --commit
# add --collection beyond-the-map for the other collection
```

Dry run by default; only `--commit` writes. Idempotent — re-running after
editing a file's frontmatter/body updates the matching entry (tracked by
source path + content hash); unrelated entries are untouched even if one
entry errors.

Facebook export (schema not finalized until the real export arrives):

```bash
npm run import:facebook -- --source /path/to/export --discover   # inventories only, no DB writes
npm run import:facebook -- --source /path/to/export --commit     # only touches recognized Meta post JSON; creates drafts
```

In production, prefix any of the above with
`/srv/adlibitumvita/shared/bin/alv-node-env` (see "First admin" above), run
from `/var/www/adlibitumvita/current` with the shared `.env` sourced — e.g.
`/srv/adlibitumvita/shared/bin/alv-node-env npm run import:markdown -- --source ... --dry-run`.

Canonical Captain's Log images (private, off-repo manifest + extracted files —
see `media/build-image-manifest.py` and `media/extract-canonical-images.py` in
the private uploads area, not this repo):

```bash
npm run import:images                # dry run — validates, uploads nothing
npm run import:images -- --commit    # uploads derivatives, writes media_assets rows
```

Idempotent (matched by content + source URI) — safe to re-run after copying more
extracted files in. A missing source file is reported and skipped, never a
broken DB row. Once the canonical images for Day 11 are ingested, hand-authored
editorial photo placement for that one representative Day can be (re-)applied
with `npm run seed:day-11-placements`.

## Deploy

**First deploy, or any manual deploy, run directly on the droplet:**

```bash
cd /home/deploy/repos/adlibitumvita
git pull
bash deploy/bootstrap-host.sh
```

This one script is idempotent — first run bootstraps everything (ALV-private
Node 22 runtime, `/srv/adlibitumvita` + `/var/www/adlibitumvita` layout,
`.env` with a generated secret, systemd unit, nginx vhost, TLS via certbot),
and every re-run just builds and atomically deploys the current commit. It
never touches the system Node (other apps on this host keep using their
own), never touches another site's nginx config, and prints exact health
check URLs when done. See `deploy/bootstrap-host.sh` for the full sequence.

Before requesting a certificate, it checks that both `adlibitumvita.com` and
`www.adlibitumvita.com` resolve to this droplet against both `1.1.1.1` and
`8.8.8.8`. If DNS isn't there yet, it deploys the app and HTTP nginx anyway,
skips the TLS phase (no repeated certbot attempts against unproven DNS),
prints the exact `dig` results, and tells you to just re-run the same
command once DNS is fixed. Optionally set `CERTBOT_EMAIL=you@example.com`
for Let's Encrypt expiry notices; if unset and the shell is interactive
you'll be prompted, otherwise the cert is issued without an email. Once
issued, `www` and plain HTTP both redirect to the canonical
`https://adlibitumvita.com`, and `certbot renew --dry-run` confirms
auto-renewal works.

**Normal path once GitHub Actions secrets exist:** push to `main`.
`.github/workflows/deploy.yml` builds, tests, validates migrations against a
scratch DB, assembles a self-contained release (pruned `node_modules`
included — the droplet never runs `npm install` over SSH), rsyncs it to
`/var/www/adlibitumvita/releases/<sha>`, then runs the same
`deploy/release-current.sh` cutover (backup, migrate, flip `current`,
restart, health check, automatic rollback on failure) that
`bootstrap-host.sh` uses locally.

## Rollback

```bash
ssh deploy@146.190.139.104
ls -1t /var/www/adlibitumvita/releases   # find the previous good SHA
ln -sfnT /var/www/adlibitumvita/releases/<previous-sha> /var/www/adlibitumvita/current
sudo systemctl restart adlibitumvita.service
curl -fsS http://127.0.0.1:3211/api/health
```

Content is separate from code — rolling back a release does not touch the
SQLite database. Restore a DB backup only if a migration was genuinely
incompatible (see `docs/architecture.md`).

## Service / logs / nginx

```bash
sudo systemctl status adlibitumvita.service
journalctl -u adlibitumvita.service -f
sudo nginx -t && sudo systemctl reload nginx
curl -fsS http://127.0.0.1:3211/api/health
```

## Enabling R2 media storage

Local filesystem storage (`MEDIA_DRIVER=local`) works with zero
configuration. To switch to Cloudflare R2:

1. Create an R2 bucket and an API token scoped to it.
2. In `/srv/adlibitumvita/shared/.env`, set:
   ```
   MEDIA_DRIVER=r2
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=...
   R2_PUBLIC_BASE_URL=...   # only if the bucket/domain serves public assets directly
   ```
3. Restart the service. New uploads go to R2; existing local files are not
   auto-migrated (copy them under the same storage keys if migrating
   historical media).
