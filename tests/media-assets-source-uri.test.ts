import { describe, expect, it } from "vitest";
import { createContentEntry } from "../src/lib/content.js";
import { createMediaAsset, getMediaAssetBySourceUri, listMediaAssetsForContent } from "../src/lib/media-assets.js";

function makeContent() {
  return createContentEntry(
    { collection: "captains-log", title: `Day ${Math.random()}`, body_markdown: "x", status: "published", visibility: "public" },
    null,
  );
}

describe("media asset source provenance (idempotent bulk ingest)", () => {
  it("finds an asset by (content_id, source_uri) after creation", () => {
    const content = makeContent();
    const sourceUri = "posts/media/Mobileuploads_x/123.jpg";

    expect(getMediaAssetBySourceUri(content.id, sourceUri)).toBeUndefined();

    createMediaAsset(
      {
        contentId: content.id,
        storageProvider: "local",
        storageKey: `${content.id}/a.webp`,
        thumbnailKey: `${content.id}/a-thumb.webp`,
        mimeType: "image/webp",
        width: 1600,
        height: 900,
        byteSize: 12345,
        visibility: "public",
        sourceUri,
      },
      null,
    );

    const found = getMediaAssetBySourceUri(content.id, sourceUri);
    expect(found).toBeDefined();
    expect(found?.source_uri).toBe(sourceUri);
  });

  it("does not confuse two different source_uris on the same content, or the same source_uri on different content", () => {
    const content = makeContent();
    const other = makeContent();

    createMediaAsset(
      {
        contentId: content.id,
        storageProvider: "local",
        storageKey: `${content.id}/a.webp`,
        thumbnailKey: null,
        mimeType: "image/webp",
        width: null,
        height: null,
        byteSize: 1,
        visibility: "public",
        sourceUri: "posts/media/one.jpg",
      },
      null,
    );

    expect(getMediaAssetBySourceUri(content.id, "posts/media/two.jpg")).toBeUndefined();
    expect(getMediaAssetBySourceUri(other.id, "posts/media/one.jpg")).toBeUndefined();
  });

  it("sets the first-inserted asset as cover, matching manifest gallery order (primary photo first)", () => {
    const content = makeContent();

    const first = createMediaAsset(
      {
        contentId: content.id,
        storageProvider: "local",
        storageKey: `${content.id}/first.webp`,
        thumbnailKey: null,
        mimeType: "image/webp",
        width: null,
        height: null,
        byteSize: 1,
        visibility: "public",
        sourceUri: "posts/media/first.jpg",
      },
      null,
    );
    const second = createMediaAsset(
      {
        contentId: content.id,
        storageProvider: "local",
        storageKey: `${content.id}/second.webp`,
        thumbnailKey: null,
        mimeType: "image/webp",
        width: null,
        height: null,
        byteSize: 1,
        visibility: "public",
        sourceUri: "posts/media/second.jpg",
      },
      null,
    );

    expect(first.is_cover).toBe(1);
    expect(second.is_cover).toBe(0);
    expect(listMediaAssetsForContent(content.id).map((a) => a.source_uri)).toEqual([
      "posts/media/first.jpg",
      "posts/media/second.jpg",
    ]);
  });
});
