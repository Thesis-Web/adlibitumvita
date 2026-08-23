/**
 * Ingests the canonical Captain's Log Day 1-43 IMAGE manifest into media_assets,
 * once the extracted image files (see extract-canonical-images.py) have been
 * transferred onto this host.
 *
 * Reads ONLY from private, untracked paths outside this repository — the manifest
 * and extracted photos are not committed (public repo, see CLAUDE.md §5).
 *
 * Inputs (private, droplet-only, not present in this repo):
 *   <manifest>    canonical-image-manifest.json  (see media/build-image-manifest.py)
 *   <files-dir>   extracted image files, one per manifest `source_uri`
 *                 relative path (see extract-canonical-images.py's `files/` output)
 *
 * Matches images to canonical Days via the manifest's own `slug` field
 * (`day-N`, the same deterministic slug scripts/import-captains-log-canonical.ts
 * assigns), NOT by Facebook calendar date.
 *
 * Idempotency: each row is looked up by (content_id, source_uri) via
 * media_assets.source_uri (see migrations/0005_media_source_provenance.sql).
 * A row that already exists is skipped — safe to re-run after copying more
 * files in, or after fixing a missing/ambiguous file.
 *
 * A missing source file is reported and skipped — it NEVER produces a
 * media_assets row pointing at nonexistent storage.
 *
 * Dry-run by default. Pass --commit to actually upload derivatives and write
 * media_assets rows.
 *
 * Usage:
 *   npm run import:images -- --dry-run
 *   npm run import:images -- --commit
 *   npm run import:images -- --commit --manifest /path/to/canonical-image-manifest.json --files-dir /path/to/alv-canonical-media/files
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { getDb } from "../src/db/client.js";
import { groupImagesByDay, resolveDerivativeMimeType, type ManifestFile } from "../src/lib/canonical-image-manifest.js";
import { getContentEntryBySlug } from "../src/lib/content.js";
import { createMediaAsset, getMediaAssetBySourceUri } from "../src/lib/media-assets.js";
import { getMediaStorage } from "../src/lib/media/index.js";
import { generateMainDerivative, generateThumbnailDerivative, isAcceptedImageMime } from "../src/lib/media/transform.js";
import { env } from "../src/lib/env.js";

const DEFAULT_MANIFEST = "/home/deploy/uploads/adlibitumvita/media/canonical-image-manifest.json";
const DEFAULT_FILES_DIR = "/home/deploy/uploads/adlibitumvita/media/incoming/files";

interface Args {
  manifestPath: string;
  filesDir: string;
  commit: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  return {
    manifestPath: get("--manifest") ?? DEFAULT_MANIFEST,
    filesDir: get("--files-dir") ?? DEFAULT_FILES_DIR,
    commit: argv.includes("--commit"),
  };
}

interface DayReport {
  day: number;
  slug: string;
  contentFound: boolean;
  ingested: number;
  alreadyPresent: number;
  missingFiles: string[];
  unsupportedType: string[];
  errors: string[];
}

async function main(): Promise<void> {
  const args = parseArgs();
  const mode = args.commit ? "commit" : "dry-run";

  if (!existsSync(args.manifestPath)) {
    throw new Error(`Manifest not found: ${args.manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(args.manifestPath, "utf8")) as ManifestFile;
  const byDay = groupImagesByDay(manifest.images);

  const storage = args.commit ? getMediaStorage() : null;
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const dayReports: DayReport[] = [];
  let totalIngested = 0;
  let totalAlreadyPresent = 0;
  let totalMissing = 0;
  let totalUnsupported = 0;
  let totalErrors = 0;

  for (const day of days) {
    const images = byDay.get(day)!;
    const slug = images[0]!.slug;
    const report: DayReport = {
      day,
      slug,
      contentFound: false,
      ingested: 0,
      alreadyPresent: 0,
      missingFiles: [],
      unsupportedType: [],
      errors: [],
    };

    const content = getContentEntryBySlug("captains-log", slug);
    if (!content) {
      report.errors.push(`No content_entries row found for slug "${slug}" — run the canonical text import first.`);
      dayReports.push(report);
      totalErrors += 1;
      continue;
    }
    report.contentFound = true;

    for (const image of images) {
      const filePath = join(args.filesDir, image.source_uri);

      if (getMediaAssetBySourceUri(content.id, image.source_uri)) {
        report.alreadyPresent += 1;
        totalAlreadyPresent += 1;
        continue;
      }

      if (!existsSync(filePath)) {
        report.missingFiles.push(image.source_uri);
        totalMissing += 1;
        continue;
      }

      const ext = extname(filePath).toLowerCase();
      const mimeType = resolveDerivativeMimeType(ext);
      if (!mimeType || !isAcceptedImageMime(mimeType)) {
        report.unsupportedType.push(image.source_uri);
        totalUnsupported += 1;
        continue;
      }

      try {
        const raw = readFileSync(filePath);
        const main = await generateMainDerivative(raw);
        const thumb = await generateThumbnailDerivative(raw);

        if (args.commit && storage) {
          const baseKey = `${content.id}/${randomUUID()}`;
          const key = `${baseKey}.webp`;
          const thumbKey = `${baseKey}-thumb.webp`;

          await storage.put(key, main.buffer, main.mimeType);
          await storage.put(thumbKey, thumb.buffer, thumb.mimeType);

          createMediaAsset(
            {
              contentId: content.id,
              storageProvider: env.MEDIA_DRIVER,
              storageKey: key,
              thumbnailKey: thumbKey,
              mimeType: main.mimeType,
              width: main.width,
              height: main.height,
              byteSize: main.buffer.byteLength,
              caption: image.description ?? null,
              visibility: content.visibility,
              sourceUri: image.source_uri,
            },
            null,
          );
        }

        report.ingested += 1;
        totalIngested += 1;
      } catch (err) {
        report.errors.push(`${image.source_uri}: ${err instanceof Error ? err.message : String(err)}`);
        totalErrors += 1;
      }
    }

    dayReports.push(report);
  }

  if (args.commit) {
    const db = getDb();
    db.prepare(
      `INSERT INTO import_jobs (id, type, source_path, status, summary_json, created_at, completed_at)
       VALUES (?, 'facebook', ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      `canonical-images:${args.manifestPath}`,
      totalErrors > 0 ? "failed" : "completed",
      JSON.stringify({ totalIngested, totalAlreadyPresent, totalMissing, totalUnsupported, totalErrors }),
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }

  const summary = {
    mode,
    manifestPath: args.manifestPath,
    filesDir: args.filesDir,
    daysProcessed: days.length,
    totalIngested,
    totalAlreadyPresent,
    totalMissing,
    totalUnsupported,
    totalErrors,
    days: dayReports,
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log(
    `\n${mode === "dry-run" ? "[dry-run] would ingest" : "ingested"} ${totalIngested} image(s) across ${days.length} day(s); ` +
      `${totalAlreadyPresent} already present, ${totalMissing} file(s) missing from ${args.filesDir}, ${totalUnsupported} unsupported type, ${totalErrors} error(s).`,
  );
  if (mode === "dry-run") {
    console.log("Re-run with --commit to actually upload derivatives and write media_assets rows.");
  }
}

main();
