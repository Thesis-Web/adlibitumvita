import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { applyMigrations } from "../src/db/migrate.js";

const dbPath = join(process.cwd(), ".data", `test-${randomUUID()}.sqlite3`);
mkdirSync(join(process.cwd(), ".data"), { recursive: true });

process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = dbPath;
process.env.BETTER_AUTH_SECRET = "test-secret-not-for-production-use-000000";
process.env.BETTER_AUTH_URL = "http://localhost:3211";
process.env.MEDIA_DRIVER = "local";
process.env.MEDIA_LOCAL_PATH = join(process.cwd(), ".data", `test-media-${randomUUID()}`);

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
applyMigrations(db);
db.close();

process.on("exit", () => {
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
});
