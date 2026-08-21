import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { applyMigrations } from "../src/db/migrate.js";
import { env } from "../src/lib/env.js";

function main(): void {
  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
  const db = new Database(env.DATABASE_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const applied = applyMigrations(db);
  db.close();

  for (const file of applied) console.log(`applied ${file}`);
  console.log(applied.length === 0 ? "database already up to date" : `applied ${applied.length} migration(s)`);
}

main();
