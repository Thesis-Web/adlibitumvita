import { describe, expect, it } from "vitest";
import {
  filterPlacementsForPreview,
  parseChapterHeading,
  renderIllustratedBody,
  splitParagraphs,
  type MediaLike,
} from "../src/lib/editorial-layout.js";
import type { EditorialPlacement } from "../src/lib/editorial-placements.js";

function placement(overrides: Partial<EditorialPlacement>): EditorialPlacement {
  return {
    id: "p1",
    content_id: "c1",
    media_id: "m1",
    layout_role: "inline",
    paragraph_anchor: null,
    group_key: null,
    group_order: 0,
    sort_order: 0,
    caption_override: null,
    confidence: null,
    reason: null,
    created_at: "now",
    updated_at: "now",
    created_by: null,
    ...overrides,
  };
}

function media(id: string, overrides: Partial<MediaLike> = {}): MediaLike {
  return { id, width: 1600, height: 1200, alt_text: "a photo", caption: null, ...overrides };
}

describe("splitParagraphs", () => {
  it("splits on blank lines and trims", () => {
    expect(splitParagraphs("a\n\nb\n\n\nc")).toEqual(["a", "b", "c"]);
  });
});

describe("parseChapterHeading", () => {
  it("recognizes an em-dash chapter heading line", () => {
    expect(parseChapterHeading("Chapter One — The Alarm")).toEqual({ label: "One", title: "The Alarm" });
  });

  it("recognizes a plain-hyphen variant", () => {
    expect(parseChapterHeading("Chapter Two - A Town")).toEqual({ label: "Two", title: "A Town" });
  });

  it("rejects ordinary prose that merely mentions a chapter", () => {
    expect(parseChapterHeading("This chapter of our lives is over.")).toBeNull();
  });
});

describe("renderIllustratedBody", () => {
  it("styles an embedded chapter heading without dropping the sibling line's text", () => {
    const md = 'Day 11 — The Last Harbor\nChapter One — The Alarm\n\nThe alarm woke us before dawn.';
    const { html } = renderIllustratedBody(md, [], new Map());
    expect(html).toContain('Day 11 — The Last Harbor');
    expect(html).toContain('class="chapter-break"');
    expect(html).toContain('Chapter One');
    expect(html).toContain('The Alarm');
    expect(html).toContain('The alarm woke us before dawn.');
  });

  it("inserts an inline placement immediately after the paragraph it anchors to", () => {
    const md = "First paragraph text.\n\nSecond paragraph mentions the empty foundation here.\n\nThird paragraph.";
    const withAnchor = [placement({ id: "p1", media_id: "m1", layout_role: "inline", paragraph_anchor: "empty foundation" })];
    const { html, placedMediaIds } = renderIllustratedBody(md, withAnchor, new Map([["m1", media("m1")]]));
    const secondIdx = html.indexOf("empty foundation");
    const figureIdx = html.indexOf('class="editorial-img');
    const thirdIdx = html.indexOf("Third paragraph");
    expect(secondIdx).toBeGreaterThan(-1);
    expect(figureIdx).toBeGreaterThan(secondIdx);
    expect(thirdIdx).toBeGreaterThan(figureIdx);
    expect(placedMediaIds.has("m1")).toBe(true);
  });

  it("excludes hero-role placements from the body (caller renders hero separately)", () => {
    const md = "Some paragraph with a marker.";
    const withHero = [placement({ id: "h1", media_id: "hero1", layout_role: "hero", paragraph_anchor: "marker" })];
    const { html, placedMediaIds } = renderIllustratedBody(md, withHero, new Map([["hero1", media("hero1")]]));
    expect(html).not.toContain("editorial-img");
    expect(placedMediaIds.has("hero1")).toBe(false);
  });

  it("groups paired placements sharing a group_key into one editorial-img-group block", () => {
    const md = "A paragraph that mentions two photos side by side.";
    const pair = [
      placement({ id: "g1", media_id: "ma", layout_role: "landscape-pair", paragraph_anchor: "side by side", group_key: "g", group_order: 0 }),
      placement({ id: "g2", media_id: "mb", layout_role: "landscape-pair", paragraph_anchor: "side by side", group_key: "g", group_order: 1 }),
    ];
    const { html, placedMediaIds } = renderIllustratedBody(
      md,
      pair,
      new Map([
        ["ma", media("ma")],
        ["mb", media("mb")],
      ]),
    );
    const groupMatches = html.match(/editorial-img-group landscape-pair/g);
    expect(groupMatches).toHaveLength(1);
    expect(placedMediaIds.has("ma")).toBe(true);
    expect(placedMediaIds.has("mb")).toBe(true);
  });

  it("skips a placement whose media is missing from mediaById without throwing", () => {
    const md = "Paragraph with anchor text.";
    const withMissing = [placement({ id: "p1", media_id: "missing", layout_role: "inline", paragraph_anchor: "anchor text" })];
    const { html } = renderIllustratedBody(md, withMissing, new Map());
    expect(html).not.toContain("editorial-img");
  });

  it("sanitizes paragraph markdown the same way as the plain renderer (strips script tags)", () => {
    const md = "Safe text <script>alert(1)</script> more text.";
    const { html } = renderIllustratedBody(md, [], new Map());
    expect(html).not.toContain("<script>");
  });
});

describe("filterPlacementsForPreview", () => {
  const mediaById = new Map([
    ["m1", media("m1")],
    ["m2", media("m2")],
    ["ma", media("ma")],
    ["mb", media("mb")],
  ]);

  it("keeps a solo placement whose anchor is inside the preview text", () => {
    const preview = "This is the preview paragraph with a marker phrase in it.";
    const kept = filterPlacementsForPreview(
      [placement({ id: "p1", media_id: "m1", layout_role: "inline", paragraph_anchor: "marker phrase" })],
      preview,
      mediaById,
    );
    expect(kept.map((p) => p.id)).toEqual(["p1"]);
  });

  it("drops a placement whose anchor was truncated out of the preview", () => {
    const preview = "Only the first sentence survives here.";
    const kept = filterPlacementsForPreview(
      [placement({ id: "p1", media_id: "m1", layout_role: "inline", paragraph_anchor: "a later paragraph never shown" })],
      preview,
      mediaById,
    );
    expect(kept).toHaveLength(0);
  });

  it("drops an entire pair/group unless every member's anchor is present", () => {
    const preview = "Only the first image's anchor phrase appears here.";
    const pair = [
      placement({ id: "g1", media_id: "ma", layout_role: "landscape-pair", paragraph_anchor: "anchor phrase", group_key: "g" }),
      placement({ id: "g2", media_id: "mb", layout_role: "landscape-pair", paragraph_anchor: "never shown anywhere", group_key: "g" }),
    ];
    expect(filterPlacementsForPreview(pair, preview, mediaById)).toHaveLength(0);
  });

  it("excludes hero-role placements even if their anchor matches", () => {
    const preview = "Body text with hero anchor phrase inside.";
    const kept = filterPlacementsForPreview(
      [placement({ id: "h1", media_id: "m1", layout_role: "hero", paragraph_anchor: "hero anchor phrase" })],
      preview,
      mediaById,
    );
    expect(kept).toHaveLength(0);
  });

  it("excludes a placement whose media is not in the public-visible mediaById map", () => {
    const preview = "Text with a marker phrase in it.";
    const kept = filterPlacementsForPreview(
      [placement({ id: "p1", media_id: "members-only-media", layout_role: "inline", paragraph_anchor: "marker phrase" })],
      preview,
      mediaById,
    );
    expect(kept).toHaveLength(0);
  });
});
