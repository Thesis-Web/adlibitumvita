import sanitizeHtml from "sanitize-html";
import { getDb } from "../db/client.js";
import type { Collection } from "./content.js";

export interface SearchResult {
  id: string;
  collection: Collection;
  slug: string;
  title: string;
  snippet: string;
}

function toFtsQuery(raw: string): string {
  const terms = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term.replace(/"/g, '""')}*`);
  return terms.length > 0 ? terms.join(" ") : '""';
}

/** Full-text search over published entries only. Callers must already have verified library authorization. */
export function searchLibrary(query: string, limit = 25): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const rows = getDb()
    .prepare<
      [string, number],
      SearchResult
    >(
      `SELECT
         e.id as id, e.collection as collection, e.slug as slug, e.title as title,
         snippet(content_entries_fts, 2, '<mark>', '</mark>', '…', 20) as snippet
       FROM content_entries_fts
       JOIN content_entries e ON e.rowid = content_entries_fts.rowid
       WHERE content_entries_fts MATCH ? AND e.status = 'published'
       ORDER BY rank
       LIMIT ?`,
    )
    .all(toFtsQuery(trimmed), limit);

  return rows.map((row) => ({ ...row, snippet: sanitizeHtml(row.snippet, { allowedTags: ["mark"] }) }));
}
