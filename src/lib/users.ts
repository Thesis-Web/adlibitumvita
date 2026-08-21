import { getDb } from "../db/client.js";

export interface UserWithAccess {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  hasLibraryAccess: 0 | 1;
}

export function listUsers(): UserWithAccess[] {
  return getDb()
    .prepare<
      [],
      UserWithAccess
    >(
      `SELECT
         u.id as id, u.name as name, u.email as email, u.role as role, u.createdAt as createdAt,
         EXISTS(
           SELECT 1 FROM access_grants g
           WHERE g.user_id = u.id AND g.scope = 'library' AND g.status = 'active'
         ) as hasLibraryAccess
       FROM user u
       ORDER BY u.createdAt DESC`,
    )
    .all();
}
