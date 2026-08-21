import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: false });

const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "em", "del", "code", "pre",
  "ul", "ol", "li",
  "blockquote",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
];

/** Renders trusted admin-authored Markdown to sanitized HTML safe for member/public rendering. */
export function renderMarkdown(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": ["id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}
