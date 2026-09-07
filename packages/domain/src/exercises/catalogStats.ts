import { eq, and } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";

export interface CatalogStats {
  totalExercises: number;
  activeExercises: number;
  /** Active exercises with no currently-approved video — the admin
   * Dashboard's "missing media" figure (docs/ARCHITECTURE.md §20). */
  missingVideoCount: number;
}

export async function getCatalogStats(db: Database): Promise<CatalogStats> {
  const allExercises = await db.select().from(schema.exercises);
  const active = allExercises.filter((e) => e.isActive);

  let missingVideoCount = 0;
  for (const exercise of active) {
    const [published] = await db
      .select({ id: schema.exerciseAssets.id })
      .from(schema.exerciseAssets)
      .where(
        and(
          eq(schema.exerciseAssets.exerciseId, exercise.id),
          eq(schema.exerciseAssets.type, "video"),
          eq(schema.exerciseAssets.status, "approved"),
        ),
      );
    if (!published) missingVideoCount += 1;
  }

  return {
    totalExercises: allExercises.length,
    activeExercises: active.length,
    missingVideoCount,
  };
}
