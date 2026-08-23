-- Persistent editorial image placement — where a photograph sits relative to the
-- prose, and in what layout role. Additive only; body_markdown is never rewritten
-- with image tokens (see docs discussion in CLAUDE.md §17 / the illustrated-book
-- reading experience work).
--
-- A placement anchors to a literal substring of the paragraph in body_markdown it
-- should render after ("paragraph_anchor"). Grouped placements (a pair/triptych)
-- share a group_key and are rendered together, ordered by group_order.
--
-- Once accepted, a placement is canonical presentation data — editorial tooling can
-- change hero/role/caption/order without touching source prose.
CREATE TABLE IF NOT EXISTS content_editorial_placements (
  id                TEXT PRIMARY KEY,
  content_id        TEXT NOT NULL REFERENCES content_entries (id) ON DELETE CASCADE,
  media_id          TEXT NOT NULL REFERENCES media_assets (id) ON DELETE CASCADE,
  layout_role       TEXT NOT NULL CHECK (layout_role IN (
                       'hero', 'inline', 'wide', 'portrait-pair', 'landscape-pair',
                       'triptych', 'chapter-opener', 'gallery-only'
                     )),
  paragraph_anchor  TEXT,
  group_key         TEXT,
  group_order       INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  caption_override  TEXT,
  confidence        TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  reason            TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  created_by        TEXT
);

CREATE INDEX IF NOT EXISTS idx_editorial_placements_content ON content_editorial_placements (content_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_editorial_placements_content_media ON content_editorial_placements (content_id, media_id);
