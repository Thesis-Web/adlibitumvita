-- FTS5 search index over member-library content.
-- Self-contained (not external-content) so it isn't coupled to
-- content_entries' column names — the triggers below keep it synchronized
-- with every insert/update/delete.

CREATE VIRTUAL TABLE IF NOT EXISTS content_entries_fts USING fts5 (
  title,
  excerpt,
  body_markdown,
  location,
  tags_text
);

CREATE TRIGGER IF NOT EXISTS content_entries_ai AFTER INSERT ON content_entries BEGIN
  INSERT INTO content_entries_fts (rowid, title, excerpt, body_markdown, location, tags_text)
  VALUES (new.rowid, new.title, new.excerpt, new.body_markdown, new.location, new.tags_json);
END;

CREATE TRIGGER IF NOT EXISTS content_entries_ad AFTER DELETE ON content_entries BEGIN
  DELETE FROM content_entries_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS content_entries_au AFTER UPDATE ON content_entries BEGIN
  DELETE FROM content_entries_fts WHERE rowid = old.rowid;
  INSERT INTO content_entries_fts (rowid, title, excerpt, body_markdown, location, tags_text)
  VALUES (new.rowid, new.title, new.excerpt, new.body_markdown, new.location, new.tags_json);
END;
