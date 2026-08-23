-- Media asset source provenance. Additive only.
--
-- Mirrors content_entries.source_ref: records which import source (e.g. a
-- Facebook export media URI) a given media_assets row was ingested from, so
-- bulk image importers (scripts/import-canonical-images.ts) can be re-run
-- safely -- an existing (content_id, source_uri) pair is recognized and
-- skipped instead of creating a duplicate asset.
ALTER TABLE media_assets ADD COLUMN source_uri TEXT;

CREATE INDEX IF NOT EXISTS idx_media_assets_content_source_uri ON media_assets (content_id, source_uri);
