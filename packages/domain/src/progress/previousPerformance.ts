import { and, eq, desc } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { computeProgressionTarget, type ProgressionTarget } from "../training/progression";

export interface PreviousPerformance {
  loadKg: number | null;
  reps: number;
  rir: number | null;
  completedAt: Date;
}

/** "Previous exercise performance should be available to future sessions"
 * (docs/ARCHITECTURE.md §14) — looks up by (userId, exerciseId) directly,
 * independent of which workout or program version it was logged under, so
 * it survives a program regeneration. Returns the single most recently
 * logged set. */
export async function getPreviousPerformance(
  db: Database,
  userId: string,
  exerciseId: string,
): Promise<PreviousPerformance | null> {
  const [log] = await db
    .select()
    .from(schema.exerciseLogs)
    .where(and(eq(schema.exerciseLogs.userId, userId), eq(schema.exerciseLogs.exerciseId, exerciseId)))
    .orderBy(desc(schema.exerciseLogs.completedAt))
    .limit(1);

  if (!log) return null;
  return { loadKg: log.loadKg, reps: log.reps, rir: log.rir, completedAt: log.completedAt };
}

/**
 * Combines the previous performance lookup with the deterministic
 * progression rule for one workout exercise slot — the single function
 * apps/web's session view needs per exercise.
 */
export async function getProgressionTargetForExercise(
  db: Database,
  userId: string,
  exerciseId: string,
  repMin: number,
  repMax: number,
): Promise<ProgressionTarget> {
  const [exercise] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, exerciseId));
  const previous = await getPreviousPerformance(db, userId, exerciseId);

  return computeProgressionTarget({
    previousLoadKg: previous?.loadKg ?? null,
    previousReps: previous?.reps ?? null,
    repMin,
    repMax,
    movementPattern: exercise?.movementPattern ?? "",
  });
}
