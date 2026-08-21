import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../src/db/client.js";
import { grantLibraryAccess, hasLibraryAccess, isAdmin, revokeLibraryAccess } from "../src/lib/entitlements.js";

function insertUser(role: "admin" | "user"): { id: string } {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO user (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(id, "Test User", `${id}@example.com`, role, now, now);
  return { id };
}

describe("entitlements", () => {
  it("denies access with no session", () => {
    expect(hasLibraryAccess(null)).toBe(false);
  });

  it("always allows admins regardless of grants", () => {
    const admin = insertUser("admin");
    expect(hasLibraryAccess({ id: admin.id, role: "admin" })).toBe(true);
    expect(isAdmin({ id: admin.id, role: "admin" })).toBe(true);
  });

  it("denies an authenticated user with no grant", () => {
    const user = insertUser("user");
    expect(hasLibraryAccess({ id: user.id, role: "user" })).toBe(false);
  });

  it("allows a user after an active manual grant, and denies again after revoke", () => {
    const user = insertUser("user");
    expect(hasLibraryAccess({ id: user.id, role: "user" })).toBe(false);

    grantLibraryAccess(user.id);
    expect(hasLibraryAccess({ id: user.id, role: "user" })).toBe(true);

    revokeLibraryAccess(user.id);
    expect(hasLibraryAccess({ id: user.id, role: "user" })).toBe(false);
  });
});
