import { describe, expect, it } from "vitest";
import {
  extractDayNumber,
  extractLogDate,
  extractMedia,
  extractPostText,
  facebookPublishedAtIso,
  fixMojibake,
  looksLikeMetaPostsFile,
  type MetaPost,
} from "../src/lib/facebook-import.js";

describe("fixMojibake", () => {
  it("repairs Latin-1-as-UTF-8 mojibake", () => {
    const original = "Captain's Log — Day 9";
    const mojibake = Buffer.from(original, "utf8").toString("latin1");
    expect(fixMojibake(mojibake)).toBe(original);
  });

  it("leaves clean text untouched", () => {
    expect(fixMojibake("Captain's Log — Day 9")).toBe("Captain's Log — Day 9");
  });

  it("does not throw on arbitrary text with high code points", () => {
    expect(() => fixMojibake("日本語 emoji 🚐 Âfoo")).not.toThrow();
  });
});

describe("looksLikeMetaPostsFile", () => {
  it("accepts an array of posts with the real export shape", () => {
    const posts: MetaPost[] = [{ timestamp: 1, title: "X added 3 new photos.", data: [{ post: "hi" }] }];
    expect(looksLikeMetaPostsFile(posts)).toBe(true);
  });

  it("rejects non-post arrays and non-arrays", () => {
    expect(looksLikeMetaPostsFile([{ unrelated: true }])).toBe(false);
    expect(looksLikeMetaPostsFile({ not: "an array" })).toBe(false);
    expect(looksLikeMetaPostsFile([])).toBe(false);
  });
});

describe("extractPostText", () => {
  it("concatenates only the post text items and skips timestamps/empties", () => {
    const post: MetaPost = {
      data: [{ post: "Line one" }, { update_timestamp: 123 }, {}, { post: "Line two" }],
    };
    expect(extractPostText(post)).toBe("Line one\nLine two");
  });
});

describe("extractMedia", () => {
  it("pulls media URIs out of heterogeneous attachment data", () => {
    const post: MetaPost = {
      attachments: [
        { data: [{ external_context: { url: "" } }] },
        { data: [{ media: { uri: "posts/media/a.jpg", creation_timestamp: 5 } }, { place: { name: "Here" } }] },
      ],
    };
    const media = extractMedia(post);
    expect(media).toHaveLength(1);
    expect(media[0]?.uri).toBe("posts/media/a.jpg");
  });
});

describe("extractDayNumber", () => {
  it("prefers a day number stated in the title", () => {
    const post: MetaPost = { title: "Day 16 update", data: [{ post: "no mention here" }] };
    expect(extractDayNumber(post)).toEqual({ day: 16, source: "title" });
  });

  it("falls back to the text head when the title has no day number", () => {
    const post: MetaPost = { title: "X added 3 new photos.", data: [{ post: "Captain's Log — Day 9\n\nBody." }] };
    expect(extractDayNumber(post)).toEqual({ day: 9, source: "text-head" });
  });

  it("returns null when no day number is present anywhere", () => {
    const post: MetaPost = { title: "X shared a link.", data: [{ post: "No day mentioned." }] };
    expect(extractDayNumber(post)).toBeNull();
  });
});

describe("facebookPublishedAtIso", () => {
  it("converts the post timestamp to an ISO string", () => {
    expect(facebookPublishedAtIso({ timestamp: 1719878400 })).toBe(new Date(1719878400 * 1000).toISOString());
  });

  it("returns null when there is no timestamp", () => {
    expect(facebookPublishedAtIso({})).toBeNull();
  });
});

describe("extractLogDate", () => {
  // Days 1-8 of the real export state the log date as "M-D-YY" in the header,
  // e.g. "Captain's Log 6-20-26". This is the exact pattern the original
  // manifest builder got wrong by substituting the Facebook post date instead.
  it.each([
    ["Captain's Log 6-20-26\n\nDay 1. Is this really happening?", "2026-06-20"],
    ["Captain's Log 6-21-26\n\nDay 2: The Kindness of Strangers", "2026-06-21"],
    ["Captain's Log- 6-26-26\n\n\"Bears, Border, Battery, Oh My!\"", "2026-06-26"],
    ["Captain's Log – 6-27-26\n\n\"Echoes Across the Mountains\"", "2026-06-27"],
  ])("parses the M-D-YY header date in %j", (text, expected) => {
    const post: MetaPost = { data: [{ post: text }] };
    expect(extractLogDate(post)?.isoDate).toBe(expected);
    expect(extractLogDate(post)?.source).toBe("header-mdy");
    expect(extractLogDate(post)?.confidence).toBe("high");
  });

  it("does NOT fabricate a log date from the Facebook publish timestamp when none is stated in text", () => {
    // Day 9+ of the real export states only "Day N" with no calendar date anywhere in
    // the text. The Facebook post itself may be dated days later (backlog posting) —
    // that must stay in facebookPublishedAtIso() and never leak into extractLogDate().
    const post: MetaPost = {
      timestamp: 1719878400, // deliberately a date far from any plausible log date
      data: [{ post: "Captain's Log — Day 9\n\nSome mornings begin with a sunrise." }],
    };
    expect(extractLogDate(post)).toBeNull();
    expect(facebookPublishedAtIso(post)).not.toBeNull();
  });

  it("parses a representative later-format 'Month D' header when a fallback year is supplied", () => {
    const post: MetaPost = { data: [{ post: "Captain's Log Day 42 — Borrowed Time\n·\nAug 4\n\nChapter One" }] };
    expect(extractLogDate(post, { fallbackYear: 2026 })).toEqual({
      isoDate: "2026-08-04",
      source: "header-month-day",
      confidence: "medium",
    });
  });

  it("falls back to the Facebook timestamp's year for a 'Month D' header when no fallbackYear is supplied", () => {
    const post: MetaPost = {
      timestamp: Date.UTC(2026, 7, 21) / 1000, // August 21, 2026
      data: [{ post: "Some title\n·\nAug 4\n\nBody" }],
    };
    expect(extractLogDate(post)?.isoDate).toBe("2026-08-04");
    expect(extractLogDate(post)?.confidence).toBe("medium");
  });

  it("returns null when the text has no date at all", () => {
    const post: MetaPost = { data: [{ post: "Captain's Log — Day 17\n\nNo date stated anywhere here." }] };
    expect(extractLogDate(post)).toBeNull();
  });
});
