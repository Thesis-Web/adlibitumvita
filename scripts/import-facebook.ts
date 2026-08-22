import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { getDb } from "../src/db/client.js";
import { createContentEntry, type Collection } from "../src/lib/content.js";
import {
  extractDayNumber,
  extractMedia,
  extractPostText,
  fixMojibake,
  looksLikeMetaPostsFile,
} from "../src/lib/facebook-import.js";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".mov"]);

interface Args {
  source: string;
  discover: boolean;
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
    throw new Error("Usage: import:facebook --source <export-dir> [--discover | --commit] [--collection captains-log|beyond-the-map]");
  }
  return {
    source,
    discover: argv.includes("--discover"),
    commit: argv.includes("--commit"),
    collection: (get("--collection") ?? "captains-log") as Collection,
  };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function runDiscovery(source: string): void {
  const files = walk(source);
  const jsonFiles = files.filter((f) => extname(f) === ".json");
  const images = files.filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
  const videos = files.filter((f) => VIDEO_EXT.has(extname(f).toLowerCase()));

  const candidates: { path: string; keys: string[]; looksLikePosts: boolean; itemCount?: number }[] = [];
  let postFileCount = 0;
  let postsWithDayNumber = 0;
  let postsWithMedia = 0;
  const sampleTitles: string[] = [];

  for (const jf of jsonFiles.slice(0, 200)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(jf, "utf8"));
      const looksLikePosts = looksLikeMetaPostsFile(parsed);
      const keys = Array.isArray(parsed)
        ? Object.keys((parsed[0] as Record<string, unknown>) ?? {})
        : Object.keys(parsed as Record<string, unknown>);
      candidates.push({
        path: relative(source, jf),
        keys,
        looksLikePosts,
        itemCount: Array.isArray(parsed) ? parsed.length : undefined,
      });

      if (looksLikePosts) {
        postFileCount += 1;
        for (const post of parsed) {
          if (extractDayNumber(post)) postsWithDayNumber += 1;
          if (extractMedia(post).length > 0) postsWithMedia += 1;
          const text = extractPostText(post);
          if (sampleTitles.length < 10 && text) {
            sampleTitles.push(fixMojibake(text.split("\n")[0] ?? text).slice(0, 80));
          }
        }
      }
    } catch {
      candidates.push({ path: relative(source, jf), keys: [], looksLikePosts: false });
    }
  }

  const report = {
    mode: "discover",
    totalFiles: files.length,
    jsonFileCount: jsonFiles.length,
    imageCount: images.length,
    videoCount: videos.length,
    likelyPostFiles: candidates.filter((c) => c.looksLikePosts).map((c) => ({ path: c.path, itemCount: c.itemCount })),
    postFileCount,
    postsWithDayNumberMentioned: postsWithDayNumber,
    postsWithMedia,
    sampleDecodedFirstLines: sampleTitles,
    representativeJsonSamples: candidates.slice(0, 25),
    mediaDirectorySamples: [...new Set(images.slice(0, 25).map((f) => relative(source, f).split("/").slice(0, -1).join("/")))],
  };

  console.log(JSON.stringify(report, null, 2));
  console.log(
    "\nNo database changes made (--discover). This reflects Meta's REAL export schema: 'title' is Meta's",
  );
  console.log(
    "auto-generated activity caption (not the author's title), post text lives in data[].post (0..n items,",
  );
  console.log(
    "mixed with update_timestamp/backdated_timestamp/empty items), and text may contain Latin-1-as-UTF-8",
  );
  console.log(
    "mojibake (see src/lib/facebook-import.ts fixMojibake). Day numbers are usually stated in the post body,",
  );
  console.log(
    "not the Facebook title. Do NOT run --commit against a real Captain's Log export until a canonical",
  );
  console.log("manifest (see audit/) has been reviewed — day grouping, splits, and conflicts are not naive 1:1.");
}

/**
 * NAIVE 1-post-to-1-entry importer. Deliberately unchanged in behavior beyond
 * using the shared, schema-accurate helpers (fixMojibake / extractPostText).
 *
 * Do NOT run this against a real Captain's Log export: it does not merge
 * Facebook-length-limit splits (e.g. one log entry posted across two Facebook
 * posts), does not resolve same-day aside/supplemental posts, and does not
 * resolve conflicting/duplicate Day numbers. See audit/facebook-import-manifest.md
 * for the reviewed, human-verified grouping this expedition's export actually
 * needs before any commit import is safe to run.
 */
function runCommit(args: Args): void {
  const files = walk(args.source).filter((f) => extname(f) === ".json");
  const db = getDb();
  const jobId = randomUUID();
  const startedAt = new Date().toISOString();

  const report = { mode: "commit", filesScanned: files.length, postsFound: 0, created: 0, errors: [] as string[] };

  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    if (!looksLikeMetaPostsFile(parsed)) continue;

    for (const post of parsed) {
      const text = fixMojibake(extractPostText(post));
      if (!text) continue;
      report.postsFound += 1;
      try {
        createContentEntry(
          {
            collection: args.collection,
            title: text.slice(0, 80).split("\n")[0] || "Untitled post",
            body_markdown: text,
            status: "draft",
            visibility: "members",
            expedition_date: post.timestamp ? new Date(post.timestamp * 1000).toISOString().slice(0, 10) : null,
            source_type: "facebook-import",
            source_ref: `${relative(args.source, file)}#${report.postsFound}`,
            source_hash: text,
          },
          null,
        );
        report.created += 1;
      } catch (err) {
        report.errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  db.prepare(
    `INSERT INTO import_jobs (id, type, source_path, status, summary_json, created_at, completed_at)
     VALUES (?, 'facebook', ?, ?, ?, ?, ?)`,
  ).run(jobId, args.source, report.errors.length > 0 ? "failed" : "completed", JSON.stringify(report), startedAt, new Date().toISOString());

  console.log(JSON.stringify(report, null, 2));
  console.log("\nAll entries created as drafts — review and publish from /admin before they go live.");
}

function main(): void {
  const args = parseArgs();
  if (args.commit) {
    runCommit(args);
    return;
  }
  runDiscovery(args.source);
}

main();
