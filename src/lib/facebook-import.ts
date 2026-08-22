/**
 * Pure parsing helpers for the real Meta ("Download Your Information") JSON export.
 *
 * This module intentionally does NOT write to the database. It exists so
 * `scripts/import-facebook.ts --discover` (and the audit tooling in `audit/`)
 * can inspect the actual export schema correctly instead of guessing at an
 * older/assumed Facebook export shape.
 *
 * Schema notes (verified against a real export, not assumed):
 * - Each post is `{ timestamp, title?, data?: PostDataItem[], attachments?: Attachment[] }`.
 * - `title` is Meta's auto-generated activity caption (e.g. "X added 12 new
 *   photos.", "X shared a post to the group: Y."). It is NOT the author's
 *   Captain's Log title — the author's title (if any) is the first line of
 *   `data[].post`.
 * - `data[]` items are heterogeneous: `{ post: string }`, `{ update_timestamp }`,
 *   `{ backdated_timestamp }`, or `{}` (empty). A post can have zero or more
 *   `post` text items; concatenate any found.
 * - `attachments[].data[]` items are heterogeneous: `{ media: { uri, ... } }`,
 *   `{ place: {...} }`, `{ external_context: { url } }`.
 * - Meta exports raw text as UTF-8 bytes that were originally Latin-1-decoded,
 *   producing mojibake (e.g. "Captain's" -> "Captainâs", emoji
 *   turning into "Ã°Å¸..."). Re-decoding as latin1 -> utf8 repairs it. This
 *   repair must ONLY be used for analysis/display, never written back over
 *   the immutable source export.
 */

export interface MetaPostDataItem {
  post?: string;
  update_timestamp?: number;
  backdated_timestamp?: number;
}

export interface MetaAttachmentMedia {
  uri?: string;
  creation_timestamp?: number;
  description?: string;
}

export interface MetaAttachmentDataItem {
  media?: MetaAttachmentMedia;
  place?: Record<string, unknown>;
  external_context?: { url?: string };
}

export interface MetaAttachment {
  data?: MetaAttachmentDataItem[];
}

export interface MetaPost {
  timestamp?: number;
  title?: string;
  data?: MetaPostDataItem[];
  attachments?: MetaAttachment[];
}

/**
 * Repairs Meta's Latin-1-as-UTF-8 mojibake for display/analysis purposes only.
 * Falls back to the original string if re-decoding fails or would be lossy.
 */
export function fixMojibake(input: string): string {
  if (!/[Â-ô]/.test(input)) return input;
  const codes = [...input].map((ch) => ch.codePointAt(0) ?? 0);
  if (codes.some((code) => code > 0xff)) return input;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(codes));
    return decoded;
  } catch {
    return input;
  }
}

/** True if the parsed JSON looks like a Meta `profile_posts_*.json` / `your_posts_*.json` array. */
export function looksLikeMetaPostsFile(parsed: unknown): parsed is MetaPost[] {
  if (!Array.isArray(parsed) || parsed.length === 0) return false;
  const first = parsed[0] as Record<string, unknown>;
  return "timestamp" in first || "data" in first || "attachments" in first || "title" in first;
}

/** Concatenates all `data[].post` text items (Meta rarely has more than one, but the schema allows it). */
export function extractPostText(post: MetaPost): string {
  const parts = (post.data ?? [])
    .map((item) => item.post)
    .filter((text): text is string => typeof text === "string" && text.length > 0);
  return parts.join("\n");
}

export interface ExtractedMedia {
  uri: string;
  creationTimestamp: number | null;
  description: string;
}

export function extractMedia(post: MetaPost): ExtractedMedia[] {
  const out: ExtractedMedia[] = [];
  for (const attachment of post.attachments ?? []) {
    for (const item of attachment.data ?? []) {
      if (item.media?.uri) {
        out.push({
          uri: item.media.uri,
          creationTimestamp: item.media.creation_timestamp ?? null,
          description: item.media.description ?? "",
        });
      }
    }
  }
  return out;
}

/**
 * Best-effort Day-number extraction. Searches the Meta activity `title`
 * first (rarely present), then the post text head, then the full text.
 * Facebook's `title` field is NOT the source of truth for the Captain's Log
 * day — the number is usually embedded in the author-written text instead.
 */
const DAY_NUMBER_RE = /\bday\s*[:\-]?\s*(\d{1,3})\b/i;

export function extractDayNumber(post: MetaPost): { day: number; source: "title" | "text-head" | "text-body" } | null {
  const title = post.title ?? "";
  const text = extractPostText(post);

  const titleMatch = DAY_NUMBER_RE.exec(title);
  if (titleMatch) return { day: Number(titleMatch[1]), source: "title" };

  const headMatch = DAY_NUMBER_RE.exec(text.slice(0, 300));
  if (headMatch) return { day: Number(headMatch[1]), source: "text-head" };

  const bodyMatch = DAY_NUMBER_RE.exec(text);
  if (bodyMatch) return { day: Number(bodyMatch[1]), source: "text-body" };

  return null;
}

/**
 * Converts a Meta post's `timestamp` (Facebook publication time) to an ISO
 * calendar date. This is METADATA ONLY — it is the day the post was
 * published to Facebook, which this expedition's export repeatedly shows is
 * NOT the same as the Captain's Log's own stated date (the author frequently
 * posted several days' backlog at once). Never treat this as `log_date`.
 */
export function facebookPublishedAtIso(post: MetaPost): string | null {
  if (!post.timestamp) return null;
  return new Date(post.timestamp * 1000).toISOString();
}

export interface ExtractedLogDate {
  isoDate: string;
  source: "header-mdy" | "header-month-day";
  confidence: "high" | "medium";
}

/** Matches a numeric M-D-YY or M-D-YYYY date, e.g. "6-20-26" -> 2026-06-20. */
const HEADER_MDY_RE = /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/;

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/** Matches a "Month D[st|nd|rd|th]" date with no year, e.g. "Aug 4". */
const HEADER_MONTH_DAY_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;

/**
 * Extracts the Captain's-Log-STATED calendar date from the post's own text
 * (e.g. "Captain's Log 6-20-26" -> 2026-06-20), scoped to the opening of the
 * text so we don't false-positive on numbers deeper in the prose (mile
 * markers, phone numbers, etc).
 *
 * Returns `null` when no date is explicitly stated in the text — this is the
 * common case for this expedition's Day 9+ entries, which state only "Day
 * N" with no calendar date anywhere in the post. Callers MUST NOT substitute
 * `facebookPublishedAtIso()` as a fallback when this returns `null`; the two
 * are different facts (see module-level notes) and conflating them was the
 * defect this function was written to fix.
 */
export function extractLogDate(post: MetaPost, opts: { headWindow?: number; fallbackYear?: number } = {}): ExtractedLogDate | null {
  const text = extractPostText(post);
  const head = text.slice(0, opts.headWindow ?? 300);

  const mdy = HEADER_MDY_RE.exec(head);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const rawYear = Number(mdy[3]);
    const year = rawYear < 100 ? rawYear + 2000 : rawYear;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, source: "header-mdy", confidence: "high" };
    }
  }

  const monthDay = HEADER_MONTH_DAY_RE.exec(head);
  if (monthDay) {
    const month = MONTH_NUMBERS[(monthDay[1] ?? "").toLowerCase()];
    const day = Number(monthDay[2]);
    const fallbackTimestampYear = post.timestamp ? new Date(post.timestamp * 1000).getUTCFullYear() : undefined;
    const year = opts.fallbackYear ?? fallbackTimestampYear;
    if (month && day >= 1 && day <= 31 && year) {
      return { isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, source: "header-month-day", confidence: "medium" };
    }
  }

  return null;
}
