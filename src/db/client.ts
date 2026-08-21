import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../lib/env.js";

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;

  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });

  db = new Database(env.DATABASE_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined;
  }
}
