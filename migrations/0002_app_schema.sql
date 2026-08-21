-- Ad Libitum Vita application schema.
-- Better Auth owns 0001_better_auth.sql (user/session/account/verification).

CREATE TABLE IF NOT EXISTS content_entries (
  id              TEXT PRIMARY KEY,
  collection      TEXT NOT NULL CHECK (collection IN ('captains-log', 'beyond-the-map')),
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  excerpt         TEXT,
  body_markdown   TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  visibility      TEXT NOT NULL CHECK (visibility IN ('members', 'public')) DEFAULT 'members',
  day_number      INTEGER,
  chapter_number  INTEGER,
  section_number  TEXT,
  expedition_date TEXT,
  location        TEXT,
  tags_json       TEXT NOT NULL DEFAULT '[]',
  sort_order      REAL,
  published_at    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  created_by      TEXT,
  updated_by      TEXT,
  source_type     TEXT,
  source_ref      TEXT,
  source_hash     TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_entries_collection ON content_entries (collection, status);
CREATE INDEX IF NOT EXISTS idx_content_entries_sort ON content_entries (collection, sort_order);
CREATE INDEX IF NOT EXISTS idx_content_entries_source_hash ON content_entries (source_hash);

CREATE TABLE IF NOT EXISTS content_revisions (
  id              TEXT PRIMARY KEY,
  content_id      TEXT NOT NULL REFERENCES content_entries (id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  snapshot_json   TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  created_by      TEXT,
  UNIQUE (content_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_content_revisions_content ON content_revisions (content_id, revision_number DESC);

CREATE TABLE IF NOT EXISTS media_assets (
  id                TEXT PRIMARY KEY,
  content_id        TEXT REFERENCES content_entries (id) ON DELETE CASCADE,
  storage_provider  TEXT NOT NULL CHECK (storage_provider IN ('local', 'r2')),
  storage_key       TEXT NOT NULL,
  thumbnail_key     TEXT,
  mime_type         TEXT NOT NULL,
  width             INTEGER,
  height            INTEGER,
  byte_size         INTEGER NOT NULL,
  alt_text          TEXT,
  caption           TEXT,
  sort_order        REAL NOT NULL DEFAULT 0,
  is_cover          INTEGER NOT NULL DEFAULT 0 CHECK (is_cover IN (0, 1)),
  visibility        TEXT NOT NULL CHECK (visibility IN ('members', 'public')) DEFAULT 'members',
  created_at        TEXT NOT NULL,
  created_by        TEXT
);

CREATE INDEX IF NOT EXISTS idx_media_assets_content ON media_assets (content_id, sort_order);

CREATE TABLE IF NOT EXISTS access_grants (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'library',
  source      TEXT NOT NULL CHECK (source IN ('manual', 'stripe', 'patreon')) DEFAULT 'manual',
  source_ref  TEXT,
  status      TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'expired')) DEFAULT 'active',
  starts_at   TEXT,
  ends_at     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_access_grants_user ON access_grants (user_id, scope, status);

CREATE TABLE IF NOT EXISTS import_jobs (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('markdown', 'facebook')),
  source_path   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('dry-run', 'running', 'completed', 'failed')) DEFAULT 'running',
  summary_json  TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  completed_at  TEXT
);
