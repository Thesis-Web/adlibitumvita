import type Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(__dirname, "..", "..", "migrations");

export function applyMigrations(db: Database.Database, migrationsDir = MIGRATIONS_DIR): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`,
  );

  const appliedNames = new Set(
    (db.prepare("SELECT filename FROM schema_migrations").all() as { filename: string }[]).map((r) => r.filename),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    if (appliedNames.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const run = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)").run(
        file,
        new Date().toISOString(),
      );
    });
    run();
    applied.push(file);
  }

  return applied;
}
