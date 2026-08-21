import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../src/db/migrate.js";

describe("migrations", () => {
  let dbPath: string;

  afterEach(() => {
    if (dbPath) rmSync(dbPath, { force: true });
  });

  it("applies cleanly to an empty database", () => {
    dbPath = join(process.cwd(), ".data", `migrate-test-${randomUUID()}.sqlite3`);
    const db = new Database(dbPath);
    const applied = applyMigrations(db);
    expect(applied.length).toBeGreaterThan(0);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toContain("content_entries");
    expect(tables).toContain("content_revisions");
    expect(tables).toContain("media_assets");
    expect(tables).toContain("access_grants");
    db.close();
  });

  it("is idempotent — re-running applies nothing new", () => {
    dbPath = join(process.cwd(), ".data", `migrate-test-${randomUUID()}.sqlite3`);
    const db = new Database(dbPath);
    const first = applyMigrations(db);
    const second = applyMigrations(db);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toHaveLength(0);
    db.close();
  });
});
