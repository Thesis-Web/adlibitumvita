/**
 * Deterministic public-preview generation from an entry's full body_markdown.
 *
 * Rules (see CLAUDE.md §8 — the public preview must never be, or become, the full
 * gated body):
 * - target 500-800 words, stopping at a paragraph boundary where practical, and never
 *   mid-sentence;
 * - shorter entries get a proportionally shorter preview, but NEVER the entire body —
 *   at least one trailing sentence always stays exclusive to the full/private version.
 *
 * Accumulation happens at the SENTENCE level (grouped back into their paragraphs when
 * reassembled) rather than the paragraph level. Some of this archive's early entries are
 * written as one long unbroken paragraph — accumulating whole paragraphs there would mean
 * either the entire entry or almost nothing. Sentence-level accumulation degrades
 * gracefully for both heavily-paragraphed and lightly-paragraphed prose while still never
 * splitting a sentence.
 */

const TARGET_MIN_WORDS = 500;
const TARGET_MAX_WORDS = 800;
const SHORT_ENTRY_FRACTION = 0.7;

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function splitParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface Sentence {
  paragraphIndex: number;
  text: string;
  words: number;
}

export function generatePublicPreviewMarkdown(bodyMarkdown: string): string {
  const paragraphs = splitParagraphs(bodyMarkdown);
  if (paragraphs.length === 0) return "";

  const sentences: Sentence[] = paragraphs.flatMap((paragraph, paragraphIndex) =>
    splitSentences(paragraph).map((text) => ({ paragraphIndex, text, words: wordCount(text) })),
  );
  if (sentences.length <= 1) return paragraphs.length > 1 ? paragraphs.slice(0, -1).join("\n\n") : "";

  const totalWords = wordCount(bodyMarkdown);
  const targetWords =
    totalWords <= TARGET_MIN_WORDS ? Math.max(1, Math.round(totalWords * SHORT_ENTRY_FRACTION)) : TARGET_MIN_WORDS;

  const selected: Sentence[] = [];
  let cumulative = 0;
  for (const sentence of sentences) {
    if (cumulative >= targetWords) break;
    if (cumulative > 0 && cumulative + sentence.words > TARGET_MAX_WORDS) break;
    selected.push(sentence);
    cumulative += sentence.words;
  }

  // Always withhold at least the final sentence, even for very short/single-sentence bodies.
  if (selected.length >= sentences.length) selected.pop();
  if (selected.length === 0) selected.push(sentences[0] as Sentence);

  // Reassemble, grouping consecutive sentences back into their original paragraphs.
  const outParagraphs: string[] = [];
  let currentParagraphIndex = -1;
  let currentParagraphSentences: string[] = [];
  for (const sentence of selected) {
    if (sentence.paragraphIndex !== currentParagraphIndex) {
      if (currentParagraphSentences.length > 0) outParagraphs.push(currentParagraphSentences.join(" "));
      currentParagraphIndex = sentence.paragraphIndex;
      currentParagraphSentences = [];
    }
    currentParagraphSentences.push(sentence.text);
  }
  if (currentParagraphSentences.length > 0) outParagraphs.push(currentParagraphSentences.join(" "));

  return outParagraphs.join("\n\n");
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A short (~1-2 sentence) plain-text excerpt for homepage cards and list views. */
export function generateExcerpt(previewMarkdown: string, maxLength = 220): string {
  const plain = stripMarkdown(previewMarkdown);
  if (plain.length <= maxLength) return plain;

  const sentenceMatch = plain.slice(0, maxLength + 40).match(/^.*?[.!?](?=\s|$)/);
  if (sentenceMatch && sentenceMatch[0].length <= maxLength + 20) return sentenceMatch[0].trim();

  const truncated = plain.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim()}…`;
}

/** A meta-description-length (~155 char) plain-text summary. */
export function generateMetaDescription(previewMarkdown: string, maxLength = 155): string {
  return generateExcerpt(previewMarkdown, maxLength);
}
