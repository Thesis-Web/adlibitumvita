import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";

export type LayoutRole =
  | "hero"
  | "inline"
  | "wide"
  | "portrait-pair"
  | "landscape-pair"
  | "triptych"
  | "chapter-opener"
  | "gallery-only";

export type PlacementConfidence = "high" | "medium" | "low";

export interface EditorialPlacement {
  id: string;
  content_id: string;
  media_id: string;
  layout_role: LayoutRole;
  paragraph_anchor: string | null;
  group_key: string | null;
  group_order: number;
  sort_order: number;
  caption_override: string | null;
  confidence: PlacementConfidence | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface EditorialPlacementInput {
  mediaId: string;
  layoutRole: LayoutRole;
  paragraphAnchor?: string | null;
  groupKey?: string | null;
  groupOrder?: number;
  sortOrder: number;
  captionOverride?: string | null;
  confidence?: PlacementConfidence | null;
  reason?: string | null;
}

export function listEditorialPlacements(contentId: string): EditorialPlacement[] {
  return getDb()
    .prepare<
      [string],
      EditorialPlacement
    >("SELECT * FROM content_editorial_placements WHERE content_id = ? ORDER BY sort_order")
    .all(contentId);
}

/** Replaces all editorial placements for a content entry — idempotent, mirrors replaceContentSourcePosts. */
export function replaceEditorialPlacements(
  contentId: string,
  inputs: EditorialPlacementInput[],
  actorUserId: string | null,
): EditorialPlacement[] {
  const db = getDb();
  const now = new Date().toISOString();
  const rows: EditorialPlacement[] = inputs.map((input) => ({
    id: randomUUID(),
    content_id: contentId,
    media_id: input.mediaId,
    layout_role: input.layoutRole,
    paragraph_anchor: input.paragraphAnchor ?? null,
    group_key: input.groupKey ?? null,
    group_order: input.groupOrder ?? 0,
    sort_order: input.sortOrder,
    caption_override: input.captionOverride ?? null,
    confidence: input.confidence ?? null,
    reason: input.reason ?? null,
    created_at: now,
    updated_at: now,
    created_by: actorUserId,
  }));

  const run = db.transaction(() => {
    db.prepare("DELETE FROM content_editorial_placements WHERE content_id = ?").run(contentId);
    const insert = db.prepare(
      `INSERT INTO content_editorial_placements (
        id, content_id, media_id, layout_role, paragraph_anchor, group_key, group_order,
        sort_order, caption_override, confidence, reason, created_at, updated_at, created_by
      ) VALUES (
        @id, @content_id, @media_id, @layout_role, @paragraph_anchor, @group_key, @group_order,
        @sort_order, @caption_override, @confidence, @reason, @created_at, @updated_at, @created_by
      )`,
    );
    for (const row of rows) insert.run(row);
  });
  run();

  return rows;
}
