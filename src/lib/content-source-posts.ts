import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";

export type SourcePostRole = "primary" | "continuation" | "aside" | "edited";

export interface ContentSourcePostInput {
  contentId: string;
  role: SourcePostRole;
  sourcePostIndex: number | null;
  facebookPublishedAt: string | null;
  originalDayLabel: string | null;
  mediaUris?: string[];
  sortOrder: number;
}

export interface ContentSourcePost {
  id: string;
  content_id: string;
  role: SourcePostRole;
  source_post_index: number | null;
  facebook_published_at: string | null;
  original_day_label: string | null;
  media_uris_json: string;
  sort_order: number;
  created_at: string;
}

export function createContentSourcePost(input: ContentSourcePostInput): ContentSourcePost {
  const db = getDb();
  const row: ContentSourcePost = {
    id: randomUUID(),
    content_id: input.contentId,
    role: input.role,
    source_post_index: input.sourcePostIndex,
    facebook_published_at: input.facebookPublishedAt,
    original_day_label: input.originalDayLabel,
    media_uris_json: JSON.stringify(input.mediaUris ?? []),
    sort_order: input.sortOrder,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO content_source_posts (
      id, content_id, role, source_post_index, facebook_published_at, original_day_label,
      media_uris_json, sort_order, created_at
    ) VALUES (
      @id, @content_id, @role, @source_post_index, @facebook_published_at, @original_day_label,
      @media_uris_json, @sort_order, @created_at
    )`,
  ).run(row);
  return row;
}

export function listContentSourcePosts(contentId: string): ContentSourcePost[] {
  return getDb()
    .prepare<
      [string],
      ContentSourcePost
    >("SELECT * FROM content_source_posts WHERE content_id = ? ORDER BY sort_order")
    .all(contentId);
}

/** Replaces all source-post provenance rows for a content entry — used by the idempotent canonical import. */
export function replaceContentSourcePosts(contentId: string, inputs: ContentSourcePostInput[]): void {
  const db = getDb();
  const run = db.transaction(() => {
    db.prepare("DELETE FROM content_source_posts WHERE content_id = ?").run(contentId);
    for (const input of inputs) createContentSourcePost(input);
  });
  run();
}
