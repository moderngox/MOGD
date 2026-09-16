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
 * logged set — used for the "Previous" display, not for progression (see
 * getRecentSessionPerformance below for that). */
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

export interface RecentSessionSet {
  setNumber: number;
  loadKg: number | null;
  reps: number;
  rir: number | null;
  painFlag: boolean | null;
  techniqueValid: boolean | null;
  completedAt: Date;
}

/** UTC calendar day — the "session" boundary used below. Nothing in the
 * current schema marks which logged sets belong to the same physical
 * workout occurrence (workoutId identifies a recurring program slot, not a
 * dated instance — the same Push Day slot is reused every week), so
 * same-calendar-day is used as a deterministic, documented stand-in rather
 * than adding a new session-occurrence entity (see the approved
 * implementation plan's deviation #2). */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Every set from the most recent day this exercise was logged, ordered by
 * setNumber — the progression engine's real input (mogd_programming_engine_specs
 * 04), unlike getPreviousPerformance's single-set snapshot above.
 */
export async function getRecentSessionPerformance(
  db: Database,
  userId: string,
  exerciseId: string,
): Promise<RecentSessionSet[]> {
  const logs = await db
    .select()
    .from(schema.exerciseLogs)
    .where(and(eq(schema.exerciseLogs.userId, userId), eq(schema.exerciseLogs.exerciseId, exerciseId)))
    .orderBy(desc(schema.exerciseLogs.completedAt));

  if (logs.length === 0) return [];

  const latestDay = dateKey(logs[0]!.completedAt);
  return logs
    .filter((log) => dateKey(log.completedAt) === latestDay)
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((log) => ({
      setNumber: log.setNumber,
      loadKg: log.loadKg,
      reps: log.reps,
      rir: log.rir,
      painFlag: log.painFlag,
      techniqueValid: log.techniqueValid,
      completedAt: log.completedAt,
    }));
}

/**
 * Combines the recent-session lookup with the deterministic progression
 * rule for one workout exercise slot — the single function apps/web's
 * session view needs per exercise. `prescription` is the exercise's
 * currently generated target (already role-modified — see
 * training/sessionAllocation.ts), which also serves as the comparison basis
 * for "did the last session hit this range."
 */
export async function getProgressionTargetForExercise(
  db: Database,
  userId: string,
  exerciseId: string,
  prescription: { sets: number; repMin: number; repMax: number; rirMin: number; rirMax: number },
): Promise<ProgressionTarget> {
  const [exercise] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, exerciseId));
  const recentSets = await getRecentSessionPerformance(db, userId, exerciseId);

  return computeProgressionTarget({
    prescribedSets: prescription.sets,
    recentSets: recentSets.map((s) => ({
      reps: s.reps,
      loadKg: s.loadKg,
      rir: s.rir,
      painFlag: s.painFlag,
      techniqueValid: s.techniqueValid,
    })),
    repMin: prescription.repMin,
    repMax: prescription.repMax,
    rirMin: prescription.rirMin,
    rirMax: prescription.rirMax,
    movementPattern: exercise?.movementPattern ?? "",
  });
}
