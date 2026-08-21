import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { getDb } from "../src/db/client.js";
import { createContentEntry, updateContentEntry, type Collection } from "../src/lib/content.js";
import { createMediaAsset } from "../src/lib/media-assets.js";
import { getMediaStorage } from "../src/lib/media/index.js";
import { env } from "../src/lib/env.js";
import { generateMainDerivative, generateThumbnailDerivative, isAcceptedImageMime } from "../src/lib/media/transform.js";
import { parseFrontmatter } from "../src/lib/frontmatter.js";
import { slugify } from "../src/lib/slug.js";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

interface Args {
  source: string;
  commit: boolean;
  collection: Collection;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const source = get("--source");
  if (!source) {
    throw new Error("Usage: import:markdown --source <dir> [--commit] [--collection captains-log|beyond-the-map]");
  }
  const collection = (get("--collection") ?? "captains-log") as Collection;
  return { source, commit: argv.includes("--commit"), collection };
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function findMarkdownFile(dir: string): string | undefined {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".md"));
  if (files.length === 0) return undefined;
  const preferred = files.find((f) => /captains-log|beyond-the-map|index/i.test(f));
  return join(dir, preferred ?? files.sort()[0]!);
}

function deriveDayNumber(dirName: string): number | null {
  const match = /day[-_]?(\d+)/i.exec(dirName);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function deriveTitle(attributes: Record<string, string>, body: string, fallback: string): string {
  if (attributes.title) return attributes.title;
  const heading = /^#\s+(.+)$/m.exec(body);
  if (heading?.[1]) return heading[1].trim();
  return fallback.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function importAssets(sourceDir: string, contentId: string, commit: boolean): Promise<{ imported: number; skipped: number }> {
  const assetsDir = join(sourceDir, "assets");
  let entries: string[] = [];
  try {
    entries = readdirSync(assetsDir).filter((f) => Object.keys(IMAGE_MIME_BY_EXT).includes(extname(f).toLowerCase()));
  } catch {
    return { imported: 0, skipped: 0 };
  }

  if (!commit) return { imported: entries.length, skipped: 0 };

  const db = getDb();
  const storage = getMediaStorage();
  let imported = 0;
  let skipped = 0;

  for (const filename of entries) {
    const mime = IMAGE_MIME_BY_EXT[extname(filename).toLowerCase()] ?? "application/octet-stream";
    if (!isAcceptedImageMime(mime)) {
      skipped += 1;
      continue;
    }
    const key = `${contentId}/${slugify(filename)}`;
    const existing = db
      .prepare<[string], { id: string }>("SELECT id FROM media_assets WHERE storage_key = ?")
      .get(key);
    if (existing) {
      skipped += 1;
      continue;
    }

    const raw = readFileSync(join(assetsDir, filename));
    const main = await generateMainDerivative(raw);
    const thumb = await generateThumbnailDerivative(raw);
    const thumbKey = `${key}-thumb.webp`;

    await storage.put(key, main.buffer, main.mimeType);
    await storage.put(thumbKey, thumb.buffer, thumb.mimeType);

    createMediaAsset(
      {
        contentId,
        storageProvider: env.MEDIA_DRIVER,
        storageKey: key,
        thumbnailKey: thumbKey,
        mimeType: main.mimeType,
        width: main.width,
        height: main.height,
        byteSize: main.buffer.byteLength,
        visibility: "members",
      },
      null,
    );
    imported += 1;
  }

  return { imported, skipped };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const db = getDb();
  const jobId = randomUUID();
  const startedAt = new Date().toISOString();

  const dirEntries = readdirSync(args.source).filter((name) => statSync(join(args.source, name)).isDirectory());

  const report = {
    mode: args.commit ? "commit" : "dry-run",
    scanned: dirEntries.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    skippedNoMarkdown: 0,
    mediaImported: 0,
    mediaSkipped: 0,
    errors: [] as { entry: string; error: string }[],
  };

  for (const dirName of dirEntries.sort()) {
    const entryDir = join(args.source, dirName);
    try {
      const mdPath = findMarkdownFile(entryDir);
      if (!mdPath) {
        report.skippedNoMarkdown += 1;
        continue;
      }

      const raw = readFileSync(mdPath, "utf8");
      const { attributes, body } = parseFrontmatter(raw);
      const sourceRef = relative(args.source, mdPath);
      const sourceHash = sha256(raw);

      const title = deriveTitle(attributes, body, dirName);
      const existing = db
        .prepare<
          [string],
          { id: string; source_hash: string | null }
        >("SELECT id, source_hash FROM content_entries WHERE source_ref = ?")
        .get(sourceRef);

      if (existing && existing.source_hash === sourceHash) {
        report.unchanged += 1;
        const assets = await importAssets(entryDir, existing.id, args.commit);
        report.mediaImported += assets.imported;
        report.mediaSkipped += assets.skipped;
        continue;
      }

      const input = {
        collection: args.collection,
        title,
        slug: attributes.slug,
        subtitle: attributes.subtitle ?? null,
        excerpt: attributes.excerpt ?? null,
        body_markdown: body,
        status: (attributes.status as "draft" | "published") ?? "draft",
        visibility: (attributes.visibility as "members" | "public") ?? "members",
        day_number: deriveDayNumber(dirName),
        expedition_date: attributes.date ?? null,
        location: attributes.location ?? null,
        tags: attributes.tags ? attributes.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        source_type: "markdown-import",
        source_ref: sourceRef,
        source_hash: sourceHash,
      };

      if (!args.commit) {
        if (existing) report.updated += 1;
        else report.created += 1;
        continue;
      }

      const contentId = existing ? existing.id : createContentEntry(input, null).id;
      if (existing) {
        updateContentEntry(contentId, input, null);
        report.updated += 1;
      } else {
        report.created += 1;
      }

      const assets = await importAssets(entryDir, contentId, args.commit);
      report.mediaImported += assets.imported;
      report.mediaSkipped += assets.skipped;
    } catch (err) {
      report.errors.push({ entry: dirName, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (args.commit) {
    db.prepare(
      `INSERT INTO import_jobs (id, type, source_path, status, summary_json, created_at, completed_at)
       VALUES (?, 'markdown', ?, ?, ?, ?, ?)`,
    ).run(jobId, args.source, report.errors.length > 0 ? "failed" : "completed", JSON.stringify(report), startedAt, new Date().toISOString());
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
