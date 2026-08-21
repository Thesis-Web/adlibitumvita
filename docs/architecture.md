# Architecture

Ad Libitum Vita is one Astro (Node adapter, `output: "server"`) application
process, one SQLite database, and one nginx vhost. It shares the host machine
with other, unrelated applications but owns everything below the OS/nginx/
systemd layer itself.

## Why server-rendered, not static

Admin publishing has to show up immediately in the library and on the
homepage without a rebuild/redeploy. So almost every route — including the
public homepage — renders on demand from SQLite rather than being baked at
build time. `robots.txt` and `/meta/version.json` are the exceptions
(`export const prerender = true`) because they're genuinely static per
release.

## Request flow

```
browser --> nginx (TLS, :80/:443) --> 127.0.0.1:3211 (Node/Astro, loopback only)
                                          |
                                          +--> better-sqlite3 (WAL) --> adlibitumvita.sqlite3
                                          +--> MediaStorage (local fs | R2)
```

`src/middleware.ts` runs before every route: it resolves the Better Auth
session once, attaches `Astro.locals.user`, blocks the public sign-up
endpoint outright, and gates `/library/**` + `/account` (any authenticated
user with an active library grant, or admin) and `/admin/**` +
`/api/admin/**` (admin role only). Route handlers don't re-implement auth —
they trust `Astro.locals.user` because the middleware already enforced it.

## Content model

`content_entries` holds both Captain's Log and Beyond the Map — a single
table with a `collection` discriminator, not two tables, because the fields
(title, body, media, tags, status/visibility) are identical and the only
difference is which optional numbering fields get used (day vs.
chapter/section). Every create/update snapshots the full row into
`content_revisions` inside the same transaction, so revision history can
never drift from the entries table.

`media_assets` rows point at a `(storage_provider, storage_key)` pair, never
a URL — see `src/lib/media/storage.ts`. Nothing persists a signed/expiring
URL as an identifier.

## Gating: the rule that actually matters

Section 8 of the project brief is absolute: a member-only entry's full body
must never reach an unauthenticated client, in any form (HTML, JSON, sitemap,
search index, repo). Concretely:

- `getPublishedEntryForLibrary` — and everything under `/library/**` — is
  only ever called from routes the middleware has already authorized.
- `listPublicTeasers` is a *different* query that only ever selects safe
  columns (title/excerpt/metadata, never `body_markdown`) and only for rows
  explicitly marked `visibility = 'public'`.
- The sitemap lists only genuinely public, ungated routes (`/`, `/login`).
  `/library/**` always requires auth regardless of an entry's own visibility
  flag — there is no public detail-page route in this IA — so gated URLs
  never appear in the sitemap.
- `/api/media/[id]` re-checks `hasLibraryAccess` on every request for
  `members`-visibility assets before streaming bytes; it does not trust that
  the referring page was itself authorized.

## Media storage seam

`MediaStorage` (`src/lib/media/storage.ts`) is the only thing that knows
how to read/write bytes. `LocalMediaStorage` and `R2MediaStorage` are
interchangeable implementations selected by `MEDIA_DRIVER`. The local
provider is not a static file mount — `/api/media/[id]` is the only path to
an object, so member-only media stays behind the same auth check as
everything else in the library.

## Deploy model

GitHub Actions builds the release (see `.github/workflows/deploy.yml`),
prunes dev dependencies, and rsyncs a self-contained artifact
(`dist/`, `migrations/`, `scripts/`, pruned `node_modules/`) to
`/var/www/adlibitumvita/releases/<sha>`. `deploy/deploy-to-droplet.sh` then
backs up the live database, runs migrations, flips the `current` symlink,
restarts the systemd unit, and rolls back the symlink on a failed health
check. The droplet never runs `npm install` on deploy.

## Migration to its own droplet

Everything ALV owns lives under `/var/www/adlibitumvita`,
`/srv/adlibitumvita`, one nginx vhost file, and one systemd unit. Moving
those four things plus DNS to a new host is the entire migration — no shared
backend to untangle.
