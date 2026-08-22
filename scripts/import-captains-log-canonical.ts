/**
 * One-time (but idempotent/re-runnable) import of the 43 canonical Captain's Log entries
 * built from the human-reviewed Facebook archive audit.
 *
 * Reads ONLY from private, untracked paths outside this repository — the real Captain's
 * Log prose is gated content and must never be committed to the (public) GitHub repo. See
 * CLAUDE.md §5 and the audit's own Phase 6 notes.
 *
 * Inputs (private, on the deploy host only):
 *   /home/deploy/uploads/adlibitumvita/audit/facebook-import-manifest-v2-FULL.json
 *   /home/deploy/uploads/adlibitumvita/audit/posts_expedition_window_full.json
 *   /home/deploy/uploads/adlibitumvita/audit/canonical-day-36-condensed-chapter.md
 * Input (committed, contains only short titles — no gated prose):
 *   audit/title-normalization.json
 *
 * Idempotency: each canonical day is looked up by
 * (collection='captains-log', source_type='facebook-import-canonical', day_number=N).
 * If found, the existing row is UPDATED in place (slug/id preserved). If not, it is
 * created. Safe to re-run.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { getDb } from "../src/db/client.js";
import { createContentEntry, updateContentEntry, type ContentEntryInput } from "../src/lib/content.js";
import { replaceContentSourcePosts, type ContentSourcePostInput } from "../src/lib/content-source-posts.js";
import { generateExcerpt, generateMetaDescription, generatePublicPreviewMarkdown } from "../src/lib/public-preview.js";
import { fixMojibake } from "../src/lib/facebook-import.js";

const AUDIT_DIR = process.env.ALV_AUDIT_DIR ?? "/home/deploy/uploads/adlibitumvita/audit";
const REPO_ROOT = new URL("..", import.meta.url).pathname;

interface ManifestEntry {
  canonical_day_number: number;
  original_day_label: string;
  primary_post_indices: number[];
  same_day_supplemental_post_indices: number[];
  is_split_merge: boolean;
  log_date: string | null;
}

interface ManifestFile {
  canonical_day_entries: ManifestEntry[];
}

interface PostRecord {
  post_index: number;
  timestamp: number;
  iso_datetime: string;
  text: string;
  media: { uri: string; creation_ts: number | null; desc: string }[];
}

interface TitleProposal {
  canonical_day_number: number;
  proposed_canonical_title: string;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function cleanOriginalDayLabel(raw: string): string {
  return raw.split(" (")[0]?.trim() ?? raw.trim();
}

function splitTitle(full: string): { title: string; subtitle: string | null } {
  const idx = full.indexOf(": ");
  if (idx === -1) return { title: full, subtitle: null };
  return { title: full.slice(0, idx), subtitle: full.slice(idx + 2) };
}

// Chapter renumbering for idx19 once the condensed "Second Expedition" chapter is
// prepended as canonical Day 36's Chapter One (see canonical-day-36-condensed-chapter.md
// and the human-approved Days 34-35 business-material revision).
const IDX19_CHAPTER_RENUMBER: [string, string][] = [
  ["Chapter Five — Little Rivers, Big Ideas", "Chapter Six — Little Rivers, Big Ideas"],
  ["Chapter Four — A Fire That Refused to Hurry", "Chapter Five — A Fire That Refused to Hurry"],
  ["Chapter Three — The Country We Forgot to See", "Chapter Four — The Country We Forgot to See"],
  ["Chapter Two — The Sounds of Coming Home", "Chapter Three — The Sounds of Coming Home"],
  ["Chapter One — You Can Sleep When You Die", "Chapter Two — You Can Sleep When You Die"],
];

function renumberIdx19(text: string): string {
  // Drop the "business stuff done, sorry for the interruption" editor's note preamble —
  // there is no interruption to apologize for in the canonical/condensed version.
  const chapterStart = text.indexOf("Chapter One — You Can Sleep When You Die");
  let body = chapterStart >= 0 ? text.slice(chapterStart) : text;
  for (const [from, to] of IDX19_CHAPTER_RENUMBER) {
    body = body.split(from).join(to);
  }
  return body;
}

function main(): void {
  const manifest = loadJson<ManifestFile>(`${AUDIT_DIR}/facebook-import-manifest-v2-FULL.json`);
  const posts = loadJson<PostRecord[]>(`${AUDIT_DIR}/posts_expedition_window_full.json`);
  const titleProposals = loadJson<{ title_proposals: TitleProposal[] }>(
    `${REPO_ROOT}audit/title-normalization.json`,
  ).title_proposals;
  const condensedChapter = readFileSync(`${AUDIT_DIR}/canonical-day-36-condensed-chapter.md`, "utf8").trim();

  const postByIndex = new Map(posts.map((p) => [p.post_index, p]));
  const titleByDay = new Map(titleProposals.map((t) => [t.canonical_day_number, t.proposed_canonical_title]));

  const db = getDb();
  const findExisting = db.prepare<[number], { id: string }>(
    `SELECT id FROM content_entries
     WHERE collection = 'captains-log' AND source_type = 'facebook-import-canonical' AND day_number = ?`,
  );

  const report = { created: 0, updated: 0, days: [] as number[] };

  for (const entry of manifest.canonical_day_entries) {
    const day = entry.canonical_day_number;
    const proposedTitle = titleByDay.get(day);
    if (!proposedTitle) throw new Error(`No title proposal for canonical Day ${day}`);
    const { title, subtitle } = splitTitle(proposedTitle);

    let bodyMarkdown: string;
    const sourceInputs: ContentSourcePostInput[] = [];

    if (day === 35) {
      // "Kansas, Apparently" only (Chapter One of idx22) — Chapter Two onward is the
      // removed/condensed business material, which now lives in Day 36 instead.
      const p = postByIndex.get(entry.primary_post_indices[0] ?? -1);
      if (!p) throw new Error("Missing source post for canonical Day 35");
      const fixed = fixMojibake(p.text).trim();
      const chapterTwoIdx = fixed.indexOf("Chapter Two - What My Soul Came Here to Do");
      if (chapterTwoIdx === -1) throw new Error("Expected chapter boundary not found in idx22 for canonical Day 35");
      bodyMarkdown = fixed.slice(0, chapterTwoIdx).trim();
    } else if (day === 36) {
      const idx19 = postByIndex.get(19);
      if (!idx19) throw new Error("Missing idx19 for canonical Day 36");
      bodyMarkdown = `${condensedChapter}\n\n${renumberIdx19(fixMojibake(idx19.text)).trim()}`;
    } else {
      bodyMarkdown = entry.primary_post_indices
        .map((idx) => {
          const p = postByIndex.get(idx);
          if (!p) throw new Error(`Missing source post idx${idx} for canonical Day ${day}`);
          return fixMojibake(p.text).trim();
        })
        .join("\n\n");
    }

    // Provenance: reflects which Facebook posts, under their ORIGINAL day label,
    // chronologically belong to this canonical day — not which sentences ended up where
    // after editorial condensation (see the Days 34-35 revision notes).
    let sortOrder = 0;
    for (const idx of entry.primary_post_indices) {
      const p = postByIndex.get(idx);
      sourceInputs.push({
        contentId: "", // filled in after the entry id is known
        role: entry.is_split_merge && entry.primary_post_indices.length > 1 ? "continuation" : "primary",
        sourcePostIndex: idx,
        facebookPublishedAt: p?.iso_datetime ?? null,
        originalDayLabel: cleanOriginalDayLabel(entry.original_day_label),
        mediaUris: p?.media.map((m) => m.uri) ?? [],
        sortOrder: sortOrder++,
      });
    }
    for (const idx of entry.same_day_supplemental_post_indices) {
      const p = postByIndex.get(idx);
      sourceInputs.push({
        contentId: "",
        role: "aside",
        sourcePostIndex: idx,
        facebookPublishedAt: p?.iso_datetime ?? null,
        originalDayLabel: cleanOriginalDayLabel(entry.original_day_label),
        mediaUris: p?.media.map((m) => m.uri) ?? [],
        sortOrder: sortOrder++,
      });
    }
    // Days 35/36 additionally carry an "edited" provenance row for the source post whose
    // content was condensed/removed by the approved editorial revision.
    if (day === 35) {
      const idx21 = postByIndex.get(21);
      sourceInputs.push({
        contentId: "",
        role: "edited",
        sourcePostIndex: 21,
        facebookPublishedAt: idx21?.iso_datetime ?? null,
        originalDayLabel: "34",
        mediaUris: idx21?.media.map((m) => m.uri) ?? [],
        sortOrder: sortOrder++,
      });
    }
    if (day === 36) {
      const idx20 = postByIndex.get(20);
      sourceInputs.push({
        contentId: "",
        role: "edited",
        sourcePostIndex: 20,
        facebookPublishedAt: idx20?.iso_datetime ?? null,
        originalDayLabel: "35",
        mediaUris: idx20?.media.map((m) => m.uri) ?? [],
        sortOrder: sortOrder++,
      });
    }

    const previewMarkdown = generatePublicPreviewMarkdown(bodyMarkdown);
    const excerpt = generateExcerpt(previewMarkdown);
    const metaDescription = generateMetaDescription(previewMarkdown);

    const input: ContentEntryInput = {
      collection: "captains-log",
      slug: `day-${day}`,
      title,
      subtitle,
      excerpt,
      body_markdown: bodyMarkdown,
      status: "published",
      visibility: "public",
      day_number: day,
      expedition_date: entry.log_date,
      tags: [],
      sort_order: day,
      source_type: "facebook-import-canonical",
      source_ref: `profile_posts_1.json#${entry.primary_post_indices.join(",")}`,
      source_hash: bodyMarkdown,
      public_preview_markdown: previewMarkdown,
      seo_title: proposedTitle,
      meta_description: metaDescription,
      indexable: 1,
      original_day_label: cleanOriginalDayLabel(entry.original_day_label),
    };

    const existing = findExisting.get(day);
    let contentId: string;
    if (existing) {
      updateContentEntry(existing.id, input, null);
      contentId = existing.id;
      report.updated += 1;
    } else {
      const created = createContentEntry(input, null);
      contentId = created.id;
      report.created += 1;
    }

    replaceContentSourcePosts(
      contentId,
      sourceInputs.map((s) => ({ ...s, contentId })),
    );
    report.days.push(day);
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nImported ${report.days.length} canonical Captain's Log entries (${report.created} created, ${report.updated} updated).`);
}

main();
