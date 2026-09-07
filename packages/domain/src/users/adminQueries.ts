import { desc } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";

export interface AdminUserListItem {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: Date;
}

/** Admin Users list (docs/ARCHITECTURE.md §20: "primarily read-only
 * inspection"). No pagination yet — acceptable at current expected scale;
 * revisit if the users table grows large enough for this to matter. */
export async function listUsers(db: Database): Promise<AdminUserListItem[]> {
  return db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt));
}
