import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { env } from "../src/lib/env.js";

const BACKUP_DIR = process.env.BACKUP_DIR ?? join(dirname(env.DATABASE_PATH), "..", "backups");
const KEEP = 14;

async function main(): Promise<void> {
  if (!existsSync(env.DATABASE_PATH)) {
    throw new Error(`No database at ${env.DATABASE_PATH} — nothing to back up.`);
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sha = process.env.GIT_SHA ?? "local";
  const destPath = join(BACKUP_DIR, `adlibitumvita-${stamp}-${sha}.sqlite3`);

  const db = new Database(env.DATABASE_PATH, { readonly: true });
  await db.backup(destPath);
  db.close();

  console.log(`backup written: ${destPath}`);

  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("adlibitumvita-") && f.endsWith(".sqlite3"))
    .map((f) => ({ f, mtime: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const stale of backups.slice(KEEP)) {
    unlinkSync(join(BACKUP_DIR, stale.f));
    console.log(`pruned old backup: ${stale.f}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
