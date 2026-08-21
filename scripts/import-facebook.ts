import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { getDb } from "../src/db/client.js";
import { createContentEntry, type Collection } from "../src/lib/content.js";

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

/** Known shape of Meta's "posts/your_posts_1.json" export: an array of post objects. */
interface MetaPostCandidate {
  timestamp?: number;
  data?: { post?: string }[];
  attachments?: { data?: { media?: { uri?: string } }[] }[];
}

function looksLikeMetaPostsFile(parsed: unknown): parsed is MetaPostCandidate[] {
  if (!Array.isArray(parsed) || parsed.length === 0) return false;
  const first = parsed[0] as Record<string, unknown>;
  return "timestamp" in first || "data" in first || "attachments" in first;
}

function runDiscovery(source: string): void {
  const files = walk(source);
  const jsonFiles = files.filter((f) => extname(f) === ".json");
  const images = files.filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
  const videos = files.filter((f) => VIDEO_EXT.has(extname(f).toLowerCase()));

  const candidates: { path: string; keys: string[]; looksLikePosts: boolean; itemCount?: number }[] = [];
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
    representativeJsonSamples: candidates.slice(0, 25),
    mediaDirectorySamples: [...new Set(images.slice(0, 25).map((f) => relative(source, f).split("/").slice(0, -1).join("/")))],
  };

  console.log(JSON.stringify(report, null, 2));
  console.log("\nNo database changes made (--discover). Inspect likelyPostFiles above, then extend the");
  console.log("commit-mode parser in scripts/import-facebook.ts once the real export schema is confirmed.");
}

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
      const text = post.data?.[0]?.post;
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
