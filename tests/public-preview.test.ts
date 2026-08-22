import { describe, expect, it } from "vitest";
import { generateExcerpt, generateMetaDescription, generatePublicPreviewMarkdown } from "../src/lib/public-preview.js";

function sentence(n: number, words = 10): string {
  const tokens = Array.from({ length: words }, (_, w) => `word${n}-${w}`);
  tokens[0] = `Word${n}-0`; // real prose capitalizes sentence starts — the sentence-boundary regex relies on it
  return `${tokens.join(" ")}.`;
}

function paragraphs(count: number, sentencesPerParagraph = 6, wordsPerSentence = 10): string {
  return Array.from({ length: count }, (_, i) =>
    Array.from({ length: sentencesPerParagraph }, (_, s) => sentence(i * 100 + s, wordsPerSentence)).join(" "),
  ).join("\n\n");
}

describe("generatePublicPreviewMarkdown", () => {
  it("stops once it reaches the target word count", () => {
    const body = paragraphs(15, 6, 10); // 900 words across 15 paragraphs
    const preview = generatePublicPreviewMarkdown(body);
    const words = preview.trim().split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(400);
    expect(words).toBeLessThanOrEqual(800);
    expect(preview.length).toBeLessThan(body.length);
  });

  it("never returns the entire body — content stays withheld even for a small number of large paragraphs", () => {
    const body = paragraphs(3, 40, 10); // 1200 words in only 3 paragraphs
    const preview = generatePublicPreviewMarkdown(body);
    expect(preview.length).toBeLessThan(body.length);
    expect(body.endsWith(preview.trim())).toBe(false);
  });

  it("proportionally shortens for entries under the target minimum, but still withholds content", () => {
    const body = paragraphs(5, 3, 10); // 150 words total, well under 500
    const preview = generatePublicPreviewMarkdown(body);
    expect(preview.length).toBeGreaterThan(0);
    expect(preview.length).toBeLessThan(body.length);
  });

  it("never splits a sentence — every sentence in the preview appears verbatim in the source", () => {
    const body = paragraphs(10, 4, 10);
    const preview = generatePublicPreviewMarkdown(body);
    const sourceSentences = body.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map((s) => s.trim());
    for (const previewSentence of preview.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)) {
      expect(sourceSentences).toContain(previewSentence.trim());
    }
  });

  // Regression test: several of this archive's earliest Captain's Log entries are written
  // as essentially one unbroken paragraph. Pure paragraph-boundary accumulation produced a
  // near-empty (or, depending on rounding, complete) preview for these; the fix falls back
  // to sentence-level accumulation.
  it("produces a substantive, non-empty preview for a body that is a single giant paragraph", () => {
    const singleParagraph = Array.from({ length: 60 }, (_, i) => sentence(i, 7)).join(" ");
    const body = `Title Line\n\nSubtitle Line\n\n${singleParagraph}`;
    const preview = generatePublicPreviewMarkdown(body);
    const words = preview.trim().split(/\s+/).length;
    expect(words).toBeGreaterThan(50);
    expect(preview.length).toBeLessThan(body.length);
  });

  it("returns empty for empty input", () => {
    expect(generatePublicPreviewMarkdown("")).toBe("");
  });
});

describe("generateExcerpt / generateMetaDescription", () => {
  it("produces a short plain-text excerpt without markdown syntax", () => {
    const excerpt = generateExcerpt("## Heading\n\nThis is **bold** and this is a [link](https://example.com).");
    expect(excerpt).not.toMatch(/[#*[\]()]/);
  });

  it("caps the meta description length", () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const meta = generateMetaDescription(long);
    expect(meta.length).toBeLessThanOrEqual(160);
  });
});
