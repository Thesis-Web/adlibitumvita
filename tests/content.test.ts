import { describe, expect, it } from "vitest";
import {
  createContentEntry,
  getContentEntryBySlug,
  listRevisions,
  restoreRevision,
  updateContentEntry,
} from "../src/lib/content.js";

describe("content entries", () => {
  it("creates an entry with a unique slug and a first revision", () => {
    const entry = createContentEntry(
      {
        collection: "captains-log",
        title: "Departure Day",
        body_markdown: "We left the dock at dawn.",
        status: "draft",
      },
      "actor-1",
    );

    expect(entry.slug).toBe("departure-day");
    expect(entry.status).toBe("draft");
    expect(entry.published_at).toBeNull();

    const revisions = listRevisions(entry.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.revision_number).toBe(1);
  });

  it("disambiguates duplicate slugs", () => {
    createContentEntry({ collection: "captains-log", title: "Storm", body_markdown: "a" }, null);
    const second = createContentEntry({ collection: "captains-log", title: "Storm", body_markdown: "b" }, null);
    expect(second.slug).toBe("storm-2");
  });

  it("sets published_at when transitioning to published, and records a new revision on update", () => {
    const entry = createContentEntry(
      { collection: "beyond-the-map", title: "On Packing Light", body_markdown: "less is more" },
      null,
    );
    expect(entry.published_at).toBeNull();

    const published = updateContentEntry(entry.id, { status: "published" }, "actor-2");
    expect(published.published_at).not.toBeNull();
    expect(listRevisions(entry.id)).toHaveLength(2);
  });

  it("restores a previous revision as a new revision", () => {
    const entry = createContentEntry(
      { collection: "captains-log", title: "Day One", body_markdown: "original text" },
      null,
    );
    updateContentEntry(entry.id, { body_markdown: "edited text" }, null);

    const restored = restoreRevision(entry.id, 1, null);
    expect(restored.body_markdown).toBe("original text");
    expect(listRevisions(entry.id)).toHaveLength(3);
  });

  it("looks up by collection + slug", () => {
    createContentEntry({ collection: "captains-log", title: "Landfall", body_markdown: "we made it" }, null);
    expect(getContentEntryBySlug("captains-log", "landfall")).toBeDefined();
    expect(getContentEntryBySlug("beyond-the-map", "landfall")).toBeUndefined();
  });
});
