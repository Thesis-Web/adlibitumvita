import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";

export interface AuthedUser {
  id: string;
  role: string;
}

export function isAdmin(user: AuthedUser | null | undefined): boolean {
  return user?.role === "admin";
}

function hasActiveGrant(userId: string, scope: string): boolean {
  const now = new Date().toISOString();
  const row = getDb()
    .prepare<[string, string, string, string], { id: string }>(
      `SELECT id FROM access_grants
       WHERE user_id = ? AND scope = ? AND status = 'active'
         AND (starts_at IS NULL OR starts_at <= ?)
         AND (ends_at IS NULL OR ends_at >= ?)`,
    )
    .get(userId, scope, now, now);
  return Boolean(row);
}

/** Library authorization: admin, or an authenticated user with an active manual/library grant. */
export function hasLibraryAccess(user: AuthedUser | null | undefined): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return hasActiveGrant(user.id, "library");
}

export function grantLibraryAccess(userId: string, source: "manual" = "manual"): void {
  const db = getDb();
  const existing = db
    .prepare<[string], { id: string }>(
      "SELECT id FROM access_grants WHERE user_id = ? AND scope = 'library' AND status = 'active'",
    )
    .get(userId);
  if (existing) return;

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO access_grants (id, user_id, scope, source, status, starts_at, created_at, updated_at)
     VALUES (?, ?, 'library', ?, 'active', ?, ?, ?)`,
  ).run(randomUUID(), userId, source, now, now, now);
}

export function revokeLibraryAccess(userId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE access_grants SET status = 'inactive', updated_at = ? WHERE user_id = ? AND scope = 'library' AND status = 'active'",
  ).run(new Date().toISOString(), userId);
}
