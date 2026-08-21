import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";
import { slugify, uniqueSlug } from "./slug.js";

export type Collection = "captains-log" | "beyond-the-map";
export type ContentStatus = "draft" | "published";
export type ContentVisibility = "members" | "public";

export interface ContentEntry {
  id: string;
  collection: Collection;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  body_markdown: string;
  status: ContentStatus;
  visibility: ContentVisibility;
  day_number: number | null;
  chapter_number: number | null;
  section_number: string | null;
  expedition_date: string | null;
  location: string | null;
  tags_json: string;
  sort_order: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  source_type: string | null;
  source_ref: string | null;
  source_hash: string | null;
}

export type PublicTeaser = Pick<
  ContentEntry,
  "id" | "collection" | "slug" | "title" | "subtitle" | "excerpt" | "expedition_date" | "location" | "published_at"
>;

export interface ContentEntryInput {
  collection: Collection;
  title: string;
  slug?: string;
  subtitle?: string | null;
  excerpt?: string | null;
  body_markdown: string;
  status?: ContentStatus;
  visibility?: ContentVisibility;
  day_number?: number | null;
  chapter_number?: number | null;
  section_number?: string | null;
  expedition_date?: string | null;
  location?: string | null;
  tags?: string[];
  sort_order?: number | null;
  source_type?: string | null;
  source_ref?: string | null;
  source_hash?: string | null;
}

function slugExists(db: ReturnType<typeof getDb>, candidate: string, excludeId?: string): boolean {
  const row = db
    .prepare<[string, string], { id: string }>("SELECT id FROM content_entries WHERE slug = ? AND id != ?")
    .get(candidate, excludeId ?? "");
  return Boolean(row);
}

function nextRevisionNumber(db: ReturnType<typeof getDb>, contentId: string): number {
  const row = db
    .prepare<[string], { max: number | null }>(
      "SELECT MAX(revision_number) as max FROM content_revisions WHERE content_id = ?",
    )
    .get(contentId);
  return (row?.max ?? 0) + 1;
}

function snapshotAndRevise(db: ReturnType<typeof getDb>, entry: ContentEntry, actorUserId: string | null): void {
  const revisionNumber = nextRevisionNumber(db, entry.id);
  db.prepare(
    `INSERT INTO content_revisions (id, content_id, revision_number, snapshot_json, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), entry.id, revisionNumber, JSON.stringify(entry), new Date().toISOString(), actorUserId);
}

export function createContentEntry(input: ContentEntryInput, actorUserId: string | null): ContentEntry {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  const slug = uniqueSlug(input.slug ?? input.title, (candidate) => slugExists(db, candidate));
  const status = input.status ?? "draft";

  const entry: ContentEntry = {
    id,
    collection: input.collection,
    slug,
    title: input.title,
    subtitle: input.subtitle ?? null,
    excerpt: input.excerpt ?? null,
    body_markdown: input.body_markdown,
    status,
    visibility: input.visibility ?? "members",
    day_number: input.day_number ?? null,
    chapter_number: input.chapter_number ?? null,
    section_number: input.section_number ?? null,
    expedition_date: input.expedition_date ?? null,
    location: input.location ?? null,
    tags_json: JSON.stringify(input.tags ?? []),
    sort_order: input.sort_order ?? null,
    published_at: status === "published" ? now : null,
    created_at: now,
    updated_at: now,
    created_by: actorUserId,
    updated_by: actorUserId,
    source_type: input.source_type ?? null,
    source_ref: input.source_ref ?? null,
    source_hash: input.source_hash ?? null,
  };

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO content_entries (
        id, collection, slug, title, subtitle, excerpt, body_markdown, status, visibility,
        day_number, chapter_number, section_number, expedition_date, location, tags_json,
        sort_order, published_at, created_at, updated_at, created_by, updated_by,
        source_type, source_ref, source_hash
      ) VALUES (
        @id, @collection, @slug, @title, @subtitle, @excerpt, @body_markdown, @status, @visibility,
        @day_number, @chapter_number, @section_number, @expedition_date, @location, @tags_json,
        @sort_order, @published_at, @created_at, @updated_at, @created_by, @updated_by,
        @source_type, @source_ref, @source_hash
      )`,
    ).run(entry);
    snapshotAndRevise(db, entry, actorUserId);
  });
  run();

  return entry;
}

export function updateContentEntry(
  id: string,
  patch: Partial<ContentEntryInput>,
  actorUserId: string | null,
): ContentEntry {
  const db = getDb();
  const existing = getContentEntryById(id);
  if (!existing) throw new Error(`Content entry not found: ${id}`);

  const now = new Date().toISOString();
  const nextStatus = patch.status ?? existing.status;
  const slug =
    patch.slug && patch.slug !== existing.slug
      ? uniqueSlug(patch.slug, (candidate) => slugExists(db, candidate, id))
      : existing.slug;

  const updated: ContentEntry = {
    ...existing,
    collection: patch.collection ?? existing.collection,
    slug,
    title: patch.title ?? existing.title,
    subtitle: patch.subtitle !== undefined ? patch.subtitle : existing.subtitle,
    excerpt: patch.excerpt !== undefined ? patch.excerpt : existing.excerpt,
    body_markdown: patch.body_markdown ?? existing.body_markdown,
    status: nextStatus,
    visibility: patch.visibility ?? existing.visibility,
    day_number: patch.day_number !== undefined ? patch.day_number : existing.day_number,
    chapter_number: patch.chapter_number !== undefined ? patch.chapter_number : existing.chapter_number,
    section_number: patch.section_number !== undefined ? patch.section_number : existing.section_number,
    expedition_date: patch.expedition_date !== undefined ? patch.expedition_date : existing.expedition_date,
    location: patch.location !== undefined ? patch.location : existing.location,
    tags_json: patch.tags ? JSON.stringify(patch.tags) : existing.tags_json,
    sort_order: patch.sort_order !== undefined ? patch.sort_order : existing.sort_order,
    published_at: nextStatus === "published" ? (existing.published_at ?? now) : existing.published_at,
    updated_at: now,
    updated_by: actorUserId,
    source_type: patch.source_type !== undefined ? patch.source_type : existing.source_type,
    source_ref: patch.source_ref !== undefined ? patch.source_ref : existing.source_ref,
    source_hash: patch.source_hash !== undefined ? patch.source_hash : existing.source_hash,
  };

  const run = db.transaction(() => {
    db.prepare(
      `UPDATE content_entries SET
        collection = @collection, slug = @slug, title = @title, subtitle = @subtitle,
        excerpt = @excerpt, body_markdown = @body_markdown, status = @status, visibility = @visibility,
        day_number = @day_number, chapter_number = @chapter_number, section_number = @section_number,
        expedition_date = @expedition_date, location = @location, tags_json = @tags_json,
        sort_order = @sort_order, published_at = @published_at, updated_at = @updated_at,
        updated_by = @updated_by, source_type = @source_type, source_ref = @source_ref, source_hash = @source_hash
      WHERE id = @id`,
    ).run(updated);
    snapshotAndRevise(db, updated, actorUserId);
  });
  run();

  return updated;
}

export function getContentEntryById(id: string): ContentEntry | undefined {
  return getDb().prepare<[string], ContentEntry>("SELECT * FROM content_entries WHERE id = ?").get(id);
}

export function getContentEntryBySlug(collection: Collection, slug: string): ContentEntry | undefined {
  return getDb()
    .prepare<[Collection, string], ContentEntry>("SELECT * FROM content_entries WHERE collection = ? AND slug = ?")
    .get(collection, slug);
}

export function getPublishedEntryForLibrary(collection: Collection, slug: string): ContentEntry | undefined {
  return getDb()
    .prepare<
      [Collection, string],
      ContentEntry
    >("SELECT * FROM content_entries WHERE collection = ? AND slug = ? AND status = 'published'")
    .get(collection, slug);
}

export interface ListFilter {
  collection?: Collection;
  status?: ContentStatus;
}

export function listContentEntries(filter: ListFilter = {}): ContentEntry[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filter.collection) {
    clauses.push("collection = ?");
    params.push(filter.collection);
  }
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return getDb()
    .prepare<string[], ContentEntry>(
      `SELECT * FROM content_entries ${where} ORDER BY sort_order IS NULL, sort_order, updated_at DESC`,
    )
    .all(...params);
}

/** Public-safe teasers only — never includes body_markdown. Used for the homepage and sitemap. */
export function listPublicTeasers(collection: Collection, limit = 6): PublicTeaser[] {
  return getDb()
    .prepare<
      [Collection, number],
      PublicTeaser
    >(
      `SELECT id, collection, slug, title, subtitle, excerpt, expedition_date, location, published_at
       FROM content_entries
       WHERE collection = ? AND status = 'published' AND visibility = 'public'
       ORDER BY published_at DESC LIMIT ?`,
    )
    .all(collection, limit);
}

export function listPublishedForLibrary(collection: Collection): ContentEntry[] {
  return getDb()
    .prepare<
      [Collection],
      ContentEntry
    >(
      `SELECT * FROM content_entries WHERE collection = ? AND status = 'published'
       ORDER BY sort_order IS NULL, sort_order, day_number IS NULL, day_number, published_at`,
    )
    .all(collection);
}

export interface ContentRevision {
  id: string;
  content_id: string;
  revision_number: number;
  snapshot_json: string;
  created_at: string;
  created_by: string | null;
}

export function listRevisions(contentId: string): ContentRevision[] {
  return getDb()
    .prepare<
      [string],
      ContentRevision
    >("SELECT * FROM content_revisions WHERE content_id = ? ORDER BY revision_number DESC")
    .all(contentId);
}

export function restoreRevision(contentId: string, revisionNumber: number, actorUserId: string | null): ContentEntry {
  const db = getDb();
  const revision = db
    .prepare<
      [string, number],
      ContentRevision
    >("SELECT * FROM content_revisions WHERE content_id = ? AND revision_number = ?")
    .get(contentId, revisionNumber);
  if (!revision) throw new Error(`Revision ${revisionNumber} not found for ${contentId}`);

  const snapshot = JSON.parse(revision.snapshot_json) as ContentEntry;
  return updateContentEntry(
    contentId,
    {
      collection: snapshot.collection,
      slug: snapshot.slug,
      title: snapshot.title,
      subtitle: snapshot.subtitle,
      excerpt: snapshot.excerpt,
      body_markdown: snapshot.body_markdown,
      status: snapshot.status,
      visibility: snapshot.visibility,
      day_number: snapshot.day_number,
      chapter_number: snapshot.chapter_number,
      section_number: snapshot.section_number,
      expedition_date: snapshot.expedition_date,
      location: snapshot.location,
      tags: JSON.parse(snapshot.tags_json) as string[],
      sort_order: snapshot.sort_order,
    },
    actorUserId,
  );
}

export function suggestSlug(title: string): string {
  return slugify(title);
}
