import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import type { EditorialPlacement } from "./editorial-placements.js";

marked.setOptions({ gfm: true, breaks: false });

const ALLOWED_TAGS = [
  "p", "br", "hr",
  "strong", "em", "del", "code", "pre",
  "ul", "ol", "li",
  "blockquote",
  "a",
  "table", "thead", "tbody", "tr", "th", "td",
];

function renderParagraphHtml(paragraph: string): string {
  const raw = marked.parse(paragraph, { async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "title", "rel", "target"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
  });
}

/** A plain-text figure/photo caption is safe to sanitize as text-only (no markup expected). */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CHAPTER_HEADING = /^Chapter\s+([A-Za-z0-9]+)\s*[—-]\s*(.+)$/;

export interface ChapterHeading {
  label: string;
  title: string;
}

/** Recognizes an existing author-written "Chapter One — Title" line. Never invents one. */
export function parseChapterHeading(line: string): ChapterHeading | null {
  const match = CHAPTER_HEADING.exec(line.trim());
  if (!match) return null;
  return { label: match[1] as string, title: (match[2] as string).trim() };
}

function chapterBreakHtml(heading: ChapterHeading): string {
  return `<div class="chapter-break" role="separator"><span class="chapter-ornament">&bull;&nbsp;&bull;&nbsp;&bull;</span><p class="chapter-label">Chapter ${escapeHtml(heading.label)}</p><h2 class="chapter-title">${escapeHtml(heading.title)}</h2></div>`;
}

/**
 * Renders one blank-line-delimited paragraph block, which may itself contain an
 * embedded chapter-heading line (this expedition's prose sometimes puts the day
 * title and "Chapter One — ..." on consecutive single-newline-separated lines
 * within what markdown treats as one block). Text before/after the heading line
 * renders as its own paragraph so the heading gets its own visual break without
 * rewriting the author's line breaks.
 */
function renderParagraphBlock(paragraph: string): string {
  const lines = paragraph.split("\n");
  const htmlParts: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    htmlParts.push(renderParagraphHtml(buffer.join("\n")));
    buffer = [];
  };

  for (const line of lines) {
    const heading = parseChapterHeading(line);
    if (heading) {
      flush();
      htmlParts.push(chapterBreakHtml(heading));
    } else {
      buffer.push(line);
    }
  }
  flush();

  return htmlParts.join("\n");
}

export function splitParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export interface MediaLike {
  id: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
}

function figureHtml(media: MediaLike, roleClass: string, captionOverride: string | null): string {
  const alt = escapeHtml(media.alt_text ?? "");
  const caption = captionOverride ?? media.caption;
  const ratio = media.width && media.height ? ` style="aspect-ratio:${media.width}/${media.height}"` : "";
  const dims = media.width && media.height ? ` width="${media.width}" height="${media.height}"` : "";
  return `<figure class="editorial-img ${roleClass}"${ratio}>
    <img src="/api/media/${media.id}" srcset="/api/media/${media.id}?size=thumb 500w, /api/media/${media.id} 1800w" sizes="(max-width: 640px) 100vw, 760px" alt="${alt}"${dims} loading="lazy" decoding="async" />
    ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
  </figure>`;
}

/** Renders a group of placements sharing a paragraph anchor as one editorial block. */
function renderPlacementGroup(group: EditorialPlacement[], mediaById: Map<string, MediaLike>): string {
  const sorted = [...group].sort((a, b) => a.group_order - b.group_order);
  const items = sorted
    .map((p) => {
      const media = mediaById.get(p.media_id);
      return media ? { placement: p, media } : null;
    })
    .filter((x): x is { placement: EditorialPlacement; media: MediaLike } => x !== null);
  if (items.length === 0) return "";

  const role = sorted[0]!.layout_role;
  if (role === "portrait-pair" || role === "landscape-pair" || role === "triptych") {
    const figures = items
      .map(({ placement, media }) => figureHtml(media, "editorial-img-group-item", placement.caption_override))
      .join("\n");
    return `<div class="editorial-img-group ${role}">${figures}</div>`;
  }

  // hero is rendered separately by the caller (page header), never inline in the body.
  return items
    .map(({ placement, media }) => figureHtml(media, `role-${placement.layout_role}`, placement.caption_override))
    .join("\n");
}

/**
 * Public-preview safety filter (CLAUDE.md §8): a placement is only eligible to render
 * on the public teaser page if its anchor text actually falls within the (already
 * truncated) public preview markdown. Grouped placements (a pair/triptych) are kept
 * only when EVERY member of the group qualifies — a lone half of a pair would render
 * as a broken-looking single-item "group".
 */
export function filterPlacementsForPreview(
  placements: EditorialPlacement[],
  previewMarkdown: string,
  mediaById: Map<string, MediaLike>,
): EditorialPlacement[] {
  const groups = new Map<string, EditorialPlacement[]>();
  for (const p of placements) {
    if (p.layout_role === "hero" || !p.paragraph_anchor || !mediaById.has(p.media_id)) continue;
    const key = p.group_key ?? p.id;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  return [...groups.values()].filter((group) => group.every((p) => previewMarkdown.includes(p.paragraph_anchor as string))).flat();
}

export interface RenderedIllustratedBody {
  html: string;
  placedMediaIds: Set<string>;
}

/**
 * Renders body_markdown paragraph-by-paragraph, styling existing author-written chapter
 * headings and interleaving editorial image placements after the paragraph they anchor to.
 * `placements` should exclude the `hero` role — the caller renders that separately.
 */
export function renderIllustratedBody(
  bodyMarkdown: string,
  placements: EditorialPlacement[],
  mediaById: Map<string, MediaLike>,
): RenderedIllustratedBody {
  const paragraphs = splitParagraphs(bodyMarkdown);
  const placedMediaIds = new Set<string>();
  const remaining = placements.filter((p) => p.layout_role !== "hero");

  const parts: string[] = [];
  for (const paragraph of paragraphs) {
    parts.push(renderParagraphBlock(paragraph));

    const matches = remaining.filter((p) => p.paragraph_anchor && paragraph.includes(p.paragraph_anchor));
    if (matches.length === 0) continue;

    const groups = new Map<string, EditorialPlacement[]>();
    for (const m of matches) {
      const key = m.group_key ?? m.id;
      const list = groups.get(key) ?? [];
      list.push(m);
      groups.set(key, list);
    }
    for (const group of groups.values()) {
      parts.push(renderPlacementGroup(group, mediaById));
      for (const p of group) placedMediaIds.add(p.media_id);
    }
  }

  return { html: parts.join("\n"), placedMediaIds };
}
