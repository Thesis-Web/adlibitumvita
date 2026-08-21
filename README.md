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

## First admin

No default admin account is ever created automatically.

```bash
cd /var/www/adlibitumvita/current     # or the repo root in development
npm run admin:create -- --email you@example.com --name "Your Name"
# prompts for a password (min 12 chars), or set ADMIN_BOOTSTRAP_PASSWORD to skip the prompt
```

This creates the user, sets `role = admin`, and grants active library
access. Log in at `/login`. A second admin requires `--force`.

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

## Deploy

Normal path: push to `main`. `.github/workflows/deploy.yml` builds, tests,
validates migrations against a scratch DB, assembles a self-contained
release (pruned `node_modules` included — the droplet never runs
`npm install`), rsyncs it to `/var/www/adlibitumvita/releases/<sha>`, backs
up the live DB, migrates, flips the `current` symlink, restarts
`adlibitumvita.service`, and rolls back the symlink automatically if
`/api/health` fails after restart.

Direct/manual deploy from a machine with SSH access:

```bash
GIT_SHA=$(git rev-parse HEAD) npm run build
npm prune --omit=dev
mkdir release && cp -r dist migrations scripts node_modules package.json package-lock.json release/
DEPLOY_HOST=146.190.139.104 DEPLOY_USER=deploy GIT_SHA=$(git rev-parse HEAD) bash deploy/deploy-to-droplet.sh
```

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
