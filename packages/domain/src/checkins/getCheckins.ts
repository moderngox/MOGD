import { eq, desc } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";

export async function listCheckins(db: Database, userId: string) {
  return db
    .select()
    .from(schema.checkins)
    .where(eq(schema.checkins.userId, userId))
    .orderBy(desc(schema.checkins.completedAt));
}

export async function getLatestCheckin(db: Database, userId: string) {
  const [row] = await db
    .select()
    .from(schema.checkins)
    .where(eq(schema.checkins.userId, userId))
    .orderBy(desc(schema.checkins.completedAt))
    .limit(1);
  return row ?? null;
}
