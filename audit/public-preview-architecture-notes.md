# Future Public/Preview Architecture — Audit Notes (Phase 7)

**Status: AUDIT ONLY. No schema or route changes were made. This documents gaps to close
before the Facebook archive is bulk-imported, so entries do not have to be re-migrated later.**

## Current state

- `content_entries.visibility` is a two-value enum (`members` | `public`) and today only
  gates two things: (1) whether an entry's *teaser* (title/subtitle/excerpt/date/location —
  never `body_markdown`) is eligible for the homepage via `listPublicTeasers()`, and
  (2) nothing else, because **there are currently no public content detail routes at all**
  (`src/pages/sitemap.xml.ts` says so explicitly). Every full-body read goes through
  `/library/**`, which is authenticated.
- `media_assets.visibility` independently gates whether a media file is servable
  unauthenticated (`src/pages/api/media/[id].ts`).
- `content_entries.excerpt` is a single short field used for the homepage teaser. There is
  no separate "substantive public preview" field.
- `source_ref`/`source_type`/`source_hash` are single scalar strings — fine for a 1-post-1-entry
  import, not sufficient once an entry is assembled from multiple Facebook posts (see the
  Day 26/34/35 splits and Day 8/10/13 same-day asides in `facebook-import-manifest.md`).

## Gaps to close before public `/captains-log/<slug>` pages exist

1. **A real public preview field.** The intended model (`/captains-log/<slug>` showing a
   "substantive crawlable preview" while `/library/captains-log/<slug>` shows the complete
   entry) needs a field distinct from both the short homepage `excerpt` and the full
   `body_markdown` — e.g. `public_preview_markdown`. Reusing `body_markdown` truncated at
   render time is the wrong shape: it would require the *public* route to have queried the
   full gated body at all, which CLAUDE.md's content-gating rule (§8) forbids even in
   memory before an authorization check. A separate column keeps the public route's query
   from ever selecting `body_markdown` for a `visibility='public'`-but-not-logged-in reader.

2. **SEO fields.** No `seo_title` / `meta_description` columns exist. `title` and `excerpt`
   are already reused for multiple purposes (admin list, homepage teaser); a dedicated
   `meta_description` avoids awkward reuse once real `<meta>` tags are needed on public
   detail pages.

3. **Explicit indexability.** `visibility='public'` alone is not the same question as
   "should this specific page be indexed." A published-but-thin entry (e.g. this
   expedition's business/Patreon-appeal posts, see `captains-log-editorial-audit.md`) may
   reasonably be public but `noindex`. Recommend an explicit `indexable` boolean rather than
   deriving it from `visibility`/`status` alone.

4. **Multi-source provenance.** `source_ref` is a single string. This expedition's own
   export already has 3 explicit split/continuation days and multiple same-day
   supplemental posts (see manifest). A future import needs either a `source_refs_json`
   array column or a small `content_source_posts` child table
   (`content_id, source_ref, role: primary|continuation|aside, facebook_timestamp`) to
   preserve which Facebook post(s) a merged entry came from, and to keep the Facebook
   publish timestamp available as metadata distinct from `expedition_date` (already
   correctly modeled as separate — do not conflate the two, per CLAUDE.md's explicit
   instruction and confirmed necessary by the Day 1–8 date-vs-Day-number pattern found in
   this audit).

5. **Featured/public media selection.** `media_assets.is_cover` and `media_assets.visibility`
   already exist and are sufficient in principle, but nothing currently enforces that a
   `visibility='public'` content entry's cover image is itself `visibility='public'` — an
   admin authoring flow gap, not a schema gap. Worth a validation check when building the
   public route (cover image must independently be public or the public page has no image).

6. **`day_number` already fits.** No change needed — the existing nullable
   `day_number INTEGER` cleanly tolerates the non-integer/uncertain cases this audit found
   (e.g. the Day 13 conflict) and the "tolerate uncertain/nonlinear day labels" requirement
   in CLAUDE.md §6. Do not force a `NOT NULL` constraint on it.

## What NOT to build yet

Per the run's own constraints, none of the above should be implemented in this task. This
section exists so the next import-focused session has a checklist instead of re-deriving it
from scratch. Recommended order when that work starts: (1) add the new nullable columns via
an additive migration, (2) build the admin authoring UI for `public_preview_markdown` /
`seo_title` / `meta_description` on entries marked public, (3) add the `/captains-log/` and
`/captains-log/<slug>` routes reading only the public-safe column set, (4) only then re-run
`import:facebook --commit` against the reviewed manifest.
