-- Public/preview content model + canonical-day source provenance.
-- Additive only — no existing column is renamed or dropped.

ALTER TABLE content_entries ADD COLUMN public_preview_markdown TEXT;
ALTER TABLE content_entries ADD COLUMN seo_title TEXT;
ALTER TABLE content_entries ADD COLUMN meta_description TEXT;
ALTER TABLE content_entries ADD COLUMN indexable INTEGER NOT NULL DEFAULT 1 CHECK (indexable IN (0, 1));

-- The as-originally-labeled Day/date text (e.g. Facebook said "Day 13" for what the
-- canonical sequence resolved as two separate days). day_number itself now holds the
-- CANONICAL day number; this column preserves the raw label for provenance/audit.
ALTER TABLE content_entries ADD COLUMN original_day_label TEXT;

-- One content_entries row can be assembled from multiple Facebook posts (a length-limit
-- continuation, a same-day aside that was folded in, or source material that was
-- condensed/removed by editorial decision). This table replaces forcing multiple source
-- posts into the single scalar source_ref column.
CREATE TABLE IF NOT EXISTS content_source_posts (
  id                    TEXT PRIMARY KEY,
  content_id            TEXT NOT NULL REFERENCES content_entries (id) ON DELETE CASCADE,
  role                  TEXT NOT NULL CHECK (role IN ('primary', 'continuation', 'aside', 'edited')),
  source_post_index     INTEGER,
  facebook_published_at TEXT,
  original_day_label    TEXT,
  media_uris_json       TEXT NOT NULL DEFAULT '[]',
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_source_posts_content ON content_source_posts (content_id, sort_order);
