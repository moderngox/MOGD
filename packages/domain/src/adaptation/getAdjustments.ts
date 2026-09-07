import { eq, desc } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";

export async function listPlanAdjustments(db: Database, userId: string) {
  return db
    .select()
    .from(schema.planAdjustments)
    .where(eq(schema.planAdjustments.userId, userId))
    .orderBy(desc(schema.planAdjustments.createdAt));
}

export async function getLatestPlanAdjustment(db: Database, userId: string) {
  const [row] = await db
    .select()
    .from(schema.planAdjustments)
    .where(eq(schema.planAdjustments.userId, userId))
    .orderBy(desc(schema.planAdjustments.createdAt))
    .limit(1);
  return row ?? null;
}
