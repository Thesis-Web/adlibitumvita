import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "../src/lib/slug.js";

describe("slugify", () => {
  it("lowercases and dashes", () => {
    expect(slugify("Day One: Departure!")).toBe("day-one-departure");
  });

  it("collapses repeated separators", () => {
    expect(slugify("  multiple   spaces  ")).toBe("multiple-spaces");
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when free", () => {
    expect(uniqueSlug("Hello World", () => false)).toBe("hello-world");
  });

  it("appends an incrementing suffix on collision", () => {
    const taken = new Set(["hello-world", "hello-world-2"]);
    expect(uniqueSlug("Hello World", (c) => taken.has(c))).toBe("hello-world-3");
  });
});
