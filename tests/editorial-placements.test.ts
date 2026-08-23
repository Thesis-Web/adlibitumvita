import { describe, expect, it } from "vitest";
import { createContentEntry } from "../src/lib/content.js";
import { createMediaAsset } from "../src/lib/media-assets.js";
import { listEditorialPlacements, replaceEditorialPlacements } from "../src/lib/editorial-placements.js";

function makeContentWithMedia(n: number) {
  const content = createContentEntry(
    { collection: "captains-log", title: `Day ${Math.random()}`, body_markdown: "x", status: "published", visibility: "public" },
    null,
  );
  const media = Array.from({ length: n }, (_, i) =>
    createMediaAsset(
      {
        contentId: content.id,
        storageProvider: "local",
        storageKey: `${content.id}/${i}.webp`,
        thumbnailKey: null,
        mimeType: "image/webp",
        width: 1600,
        height: 1200,
        byteSize: 1,
        visibility: "public",
        sourceUri: `posts/media/${i}.jpg`,
      },
      null,
    ),
  );
  return { content, media };
}

describe("editorial placements", () => {
  it("creates and lists placements ordered by sort_order", () => {
    const { content, media } = makeContentWithMedia(2);
    replaceEditorialPlacements(
      content.id,
      [
        { mediaId: media[1]!.id, layoutRole: "inline", paragraphAnchor: "second", sortOrder: 1 },
        { mediaId: media[0]!.id, layoutRole: "hero", sortOrder: 0 },
      ],
      "actor-1",
    );

    const rows = listEditorialPlacements(content.id);
    expect(rows.map((r) => r.media_id)).toEqual([media[0]!.id, media[1]!.id]);
    expect(rows[0]?.layout_role).toBe("hero");
    expect(rows[1]?.paragraph_anchor).toBe("second");
    expect(rows[1]?.created_by).toBe("actor-1");
  });

  it("is idempotent — re-running replaces rather than duplicates", () => {
    const { content, media } = makeContentWithMedia(1);
    replaceEditorialPlacements(content.id, [{ mediaId: media[0]!.id, layoutRole: "hero", sortOrder: 0 }], null);
    replaceEditorialPlacements(content.id, [{ mediaId: media[0]!.id, layoutRole: "hero", sortOrder: 0 }], null);
    expect(listEditorialPlacements(content.id)).toHaveLength(1);
  });

  it("does not leak placements across content entries", () => {
    const a = makeContentWithMedia(1);
    const b = makeContentWithMedia(1);
    replaceEditorialPlacements(a.content.id, [{ mediaId: a.media[0]!.id, layoutRole: "hero", sortOrder: 0 }], null);
    expect(listEditorialPlacements(b.content.id)).toHaveLength(0);
  });
});
