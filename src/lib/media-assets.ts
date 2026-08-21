import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";
import type { ContentVisibility } from "./content.js";

export interface MediaAsset {
  id: string;
  content_id: string | null;
  storage_provider: "local" | "r2";
  storage_key: string;
  thumbnail_key: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  byte_size: number;
  alt_text: string | null;
  caption: string | null;
  sort_order: number;
  is_cover: 0 | 1;
  visibility: ContentVisibility;
  created_at: string;
  created_by: string | null;
}

export interface CreateMediaAssetInput {
  contentId: string;
  storageProvider: "local" | "r2";
  storageKey: string;
  thumbnailKey: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  altText?: string | null;
  caption?: string | null;
  visibility?: ContentVisibility;
}

export function createMediaAsset(input: CreateMediaAssetInput, actorUserId: string | null): MediaAsset {
  const db = getDb();
  const maxOrder = db
    .prepare<[string], { max: number | null }>("SELECT MAX(sort_order) as max FROM media_assets WHERE content_id = ?")
    .get(input.contentId);
  const sortOrder = (maxOrder?.max ?? -1) + 1;
  const existingCover = db
    .prepare<[string], { id: string }>("SELECT id FROM media_assets WHERE content_id = ? AND is_cover = 1")
    .get(input.contentId);

  const asset: MediaAsset = {
    id: randomUUID(),
    content_id: input.contentId,
    storage_provider: input.storageProvider,
    storage_key: input.storageKey,
    thumbnail_key: input.thumbnailKey,
    mime_type: input.mimeType,
    width: input.width,
    height: input.height,
    byte_size: input.byteSize,
    alt_text: input.altText ?? null,
    caption: input.caption ?? null,
    sort_order: sortOrder,
    is_cover: existingCover ? 0 : 1,
    visibility: input.visibility ?? "members",
    created_at: new Date().toISOString(),
    created_by: actorUserId,
  };

  db.prepare(
    `INSERT INTO media_assets (
      id, content_id, storage_provider, storage_key, thumbnail_key, mime_type, width, height,
      byte_size, alt_text, caption, sort_order, is_cover, visibility, created_at, created_by
    ) VALUES (
      @id, @content_id, @storage_provider, @storage_key, @thumbnail_key, @mime_type, @width, @height,
      @byte_size, @alt_text, @caption, @sort_order, @is_cover, @visibility, @created_at, @created_by
    )`,
  ).run(asset);

  return asset;
}

export function listMediaAssetsForContent(contentId: string): MediaAsset[] {
  return getDb()
    .prepare<[string], MediaAsset>("SELECT * FROM media_assets WHERE content_id = ? ORDER BY sort_order")
    .all(contentId);
}

export function getMediaAssetById(id: string): MediaAsset | undefined {
  return getDb().prepare<[string], MediaAsset>("SELECT * FROM media_assets WHERE id = ?").get(id);
}

export interface MediaAssetPatch {
  altText?: string | null;
  caption?: string | null;
  sortOrder?: number;
  isCover?: boolean;
  visibility?: ContentVisibility;
}

export function updateMediaAsset(id: string, patch: MediaAssetPatch): void {
  const db = getDb();
  const asset = getMediaAssetById(id);
  if (!asset) throw new Error(`Media asset not found: ${id}`);

  const run = db.transaction(() => {
    if (patch.isCover && asset.content_id) {
      db.prepare("UPDATE media_assets SET is_cover = 0 WHERE content_id = ?").run(asset.content_id);
    }
    db.prepare(
      `UPDATE media_assets SET
        alt_text = COALESCE(@alt_text, alt_text),
        caption = COALESCE(@caption, caption),
        sort_order = COALESCE(@sort_order, sort_order),
        is_cover = COALESCE(@is_cover, is_cover),
        visibility = COALESCE(@visibility, visibility)
      WHERE id = @id`,
    ).run({
      id,
      alt_text: patch.altText ?? null,
      caption: patch.caption ?? null,
      sort_order: patch.sortOrder ?? null,
      is_cover: patch.isCover === undefined ? null : patch.isCover ? 1 : 0,
      visibility: patch.visibility ?? null,
    });
  });
  run();
}

export function deleteMediaAsset(id: string): MediaAsset | undefined {
  const db = getDb();
  const asset = getMediaAssetById(id);
  if (!asset) return undefined;
  db.prepare("DELETE FROM media_assets WHERE id = ?").run(id);
  return asset;
}
