import { describe, expect, it } from "vitest";
import { createContentEntry, updateContentEntry } from "../src/lib/content.js";
import { searchLibrary } from "../src/lib/search.js";

describe("search", () => {
  it("finds published entries by body text and excludes drafts", async () => {
    const published = createContentEntry(
      {
        collection: "captains-log",
        title: "Anchored at Blind Bay",
        body_markdown: "We dropped anchor near Blind Bay as the fog rolled in.",
        status: "published",
      },
      null,
    );
    createContentEntry(
      {
        collection: "captains-log",
        title: "Unrelated Draft",
        body_markdown: "This mentions Blind Bay too but stays a draft.",
        status: "draft",
      },
      null,
    );

    const results = searchLibrary("Blind Bay");
    expect(results.map((r) => r.id)).toContain(published.id);
    expect(results).toHaveLength(1);
  });

  it("stays in sync after an update", () => {
    const entry = createContentEntry(
      { collection: "beyond-the-map", title: "Ballast", body_markdown: "original searchable phrase", status: "published" },
      null,
    );
    expect(searchLibrary("original searchable phrase")).toHaveLength(1);

    updateContentEntry(entry.id, { body_markdown: "a completely different phrase" }, null);
    expect(searchLibrary("original searchable phrase")).toHaveLength(0);
    expect(searchLibrary("completely different phrase")).toHaveLength(1);
  });

  it("returns nothing for an empty query", () => {
    expect(searchLibrary("")).toEqual([]);
  });
});
