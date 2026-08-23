import { describe, expect, it } from "vitest";
import { groupImagesByDay, resolveDerivativeMimeType, type ManifestImage } from "../src/lib/canonical-image-manifest.js";

function image(overrides: Partial<ManifestImage>): ManifestImage {
  return {
    canonical_day_number: 1,
    slug: "day-1",
    title: "Test Day",
    source_post_index: 1,
    source_post_role: "primary",
    is_primary: true,
    source_uri: "posts/media/example.jpg",
    expected_source_filename: "example.jpg",
    description: null,
    gallery_order: 0,
    ...overrides,
  };
}

describe("groupImagesByDay", () => {
  it("groups by canonical day and preserves gallery_order within a day", () => {
    const images = [
      image({ canonical_day_number: 2, gallery_order: 0, source_uri: "a" }),
      image({ canonical_day_number: 1, gallery_order: 2, source_uri: "c" }),
      image({ canonical_day_number: 1, gallery_order: 0, source_uri: "b" }),
      image({ canonical_day_number: 1, gallery_order: 1, source_uri: "d" }),
    ];

    const byDay = groupImagesByDay(images);

    expect([...byDay.keys()].sort()).toEqual([1, 2]);
    expect(byDay.get(1)!.map((i) => i.source_uri)).toEqual(["b", "d", "c"]);
    expect(byDay.get(2)!.map((i) => i.source_uri)).toEqual(["a"]);
  });

  it("returns an empty map for no images", () => {
    expect(groupImagesByDay([]).size).toBe(0);
  });
});

describe("resolveDerivativeMimeType", () => {
  it("maps known image extensions", () => {
    expect(resolveDerivativeMimeType(".jpg")).toBe("image/jpeg");
    expect(resolveDerivativeMimeType(".JPG")).toBe("image/jpeg");
    expect(resolveDerivativeMimeType(".webp")).toBe("image/webp");
    expect(resolveDerivativeMimeType(".png")).toBe("image/png");
  });

  it("returns undefined for videos and unknown extensions", () => {
    expect(resolveDerivativeMimeType(".mp4")).toBeUndefined();
    expect(resolveDerivativeMimeType(".mov")).toBeUndefined();
    expect(resolveDerivativeMimeType(".txt")).toBeUndefined();
  });
});
