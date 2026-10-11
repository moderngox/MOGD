import { and, asc, desc, eq, ne } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { computeProgressionTarget, type ProgressionTarget } from "../training/progression";

/**
 * History = the sets of the athlete's most recent *other* workout occurrence
 * for this exercise (mogd_programming_engine_specs 03/04). `excludeSessionId`
 * is the session being performed right now, so a half-finished workout never
 * becomes its own "last session". Finishing a session is a confirmation step,
 * not a gate: any other occurrence with logged sets counts, otherwise a user
 * who forgets the button would silently stop progressing.
 */
export interface HistoryOptions {
  excludeSessionId?: string;
}

export interface PreviousPerformance {
  loadKg: number | null;
  reps: number;
  rir: number | null;
  completedAt: Date;
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

/** Sets of the most recent other occurrence that has any, ordered by set number; [] when none. */
export async function getRecentSessionPerformance(
  db: Database,
  userId: string,
  exerciseId: string,
  options: HistoryOptions = {},
): Promise<RecentSessionSet[]> {
  const conditions = [
    eq(schema.workoutSessions.userId, userId),
    eq(schema.workoutExercisePerformances.exerciseId, exerciseId),
  ];
  if (options.excludeSessionId) conditions.push(ne(schema.workoutSessions.id, options.excludeSessionId));

  const rows = await db
    .select({
      performanceId: schema.workoutExercisePerformances.id,
      set: schema.exerciseLogs,
    })
    .from(schema.exerciseLogs)
    .innerJoin(
      schema.workoutExercisePerformances,
      eq(schema.exerciseLogs.workoutExercisePerformanceId, schema.workoutExercisePerformances.id),
    )
    .innerJoin(schema.workoutSessions, eq(schema.workoutExercisePerformances.workoutSessionId, schema.workoutSessions.id))
    .where(and(...conditions))
    .orderBy(desc(schema.workoutSessions.startedAt), asc(schema.exerciseLogs.setNumber));

  if (rows.length === 0) return [];

  const latestPerformanceId = rows[0]!.performanceId;
  return rows
    .filter((row) => row.performanceId === latestPerformanceId)
    .map(({ set }) => ({
      setNumber: set.setNumber,
      loadKg: set.loadKg,
      reps: set.reps,
      rir: set.rir,
      painFlag: set.painFlag,
      techniqueValid: set.techniqueValid,
      completedAt: set.completedAt,
    }));
}

/** The last set of the most recent other occurrence — the "Previous" display. */
export async function getPreviousPerformance(
  db: Database,
  userId: string,
  exerciseId: string,
  options: HistoryOptions = {},
): Promise<PreviousPerformance | null> {
  const last = (await getRecentSessionPerformance(db, userId, exerciseId, options)).at(-1);
  if (!last) return null;
  return { loadKg: last.loadKg, reps: last.reps, rir: last.rir, completedAt: last.completedAt };
}

/** Every distinct load (kg) the athlete has ever logged for this exercise —
 * the evidence the progression engine uses to know what increments exist. */
export async function getObservedLoadsKg(db: Database, userId: string, exerciseId: string): Promise<number[]> {
  const rows = await db
    .selectDistinct({ loadKg: schema.exerciseLogs.loadKg })
    .from(schema.exerciseLogs)
    .where(and(eq(schema.exerciseLogs.userId, userId), eq(schema.exerciseLogs.exerciseId, exerciseId)));
  return rows.map((r) => r.loadKg).filter((l): l is number => l !== null);
}

/**
 * Combines the history lookup with the deterministic progression rule for one
 * workout exercise slot. `prescription` is the exercise's currently generated
 * target (already role-modified — see training/sessionAllocation.ts), which
 * also serves as the comparison basis for "did the last session hit this range."
 */
export async function getProgressionTargetForExercise(
  db: Database,
  userId: string,
  exerciseId: string,
  prescription: { sets: number; repMin: number; repMax: number; rirMin: number; rirMax: number },
  options: HistoryOptions = {},
): Promise<ProgressionTarget> {
  const recentSets = await getRecentSessionPerformance(db, userId, exerciseId, options);
  const observedLoadsKg = await getObservedLoadsKg(db, userId, exerciseId);

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
    observedLoadsKg,
  });
}
