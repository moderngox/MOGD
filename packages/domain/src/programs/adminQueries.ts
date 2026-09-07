import { eq, desc } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";

export interface AdminProgramListItem {
  programId: string;
  userId: string;
  userEmail: string;
  splitType: string;
  sessionsPerWeek: number;
  createdAt: Date;
}

/** Admin Programs list (docs/ARCHITECTURE.md §20). No pagination yet — same
 * rationale as users.listUsers. */
export async function listPrograms(db: Database): Promise<AdminProgramListItem[]> {
  const rows = await db
    .select({
      programId: schema.programs.id,
      userId: schema.programs.userId,
      userEmail: schema.users.email,
      splitType: schema.programs.splitType,
      sessionsPerWeek: schema.programs.sessionsPerWeek,
      createdAt: schema.programs.createdAt,
    })
    .from(schema.programs)
    .innerJoin(schema.users, eq(schema.programs.userId, schema.users.id))
    .orderBy(desc(schema.programs.createdAt));
  return rows;
}
