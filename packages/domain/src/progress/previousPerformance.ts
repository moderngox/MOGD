import { and, asc, desc, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { computeProgressionTarget, type ProgressionTarget } from "../training/progression";

/**
 * History = the sets of the athlete's most recent *other* workout occurrence
 * for this exercise **in the same equipment context** (mogd_programming_engine_specs
 * 03/04: two machines can show the same stack kg, so a load is never carried
 * across a context change). `excludeSessionId` is the session being performed
 * right now, so a half-finished workout never becomes its own "last session".
 * Finishing a session is a confirmation step, not a gate: any other occurrence
 * with logged sets counts, otherwise a user who forgets the button would
 * silently stop progressing.
 */
export interface HistoryContext {
  /** The training location of the session being planned; null is its own bucket, never a wildcard. */
  locationId: string | null;
  excludeSessionId?: string;
}

/** What that earlier occurrence was prescribed - the range its sets must be judged against. */
export interface PerformedPrescription {
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
}

export interface RecentSessionPerformance {
  sets: RecentSessionSet[];
  /** Null for legacy (pre-session-record) history, whose prescription is unknowable. */
  prescription: PerformedPrescription | null;
}

const inContext = (locationId: string | null) =>
  locationId === null
    ? isNull(schema.workoutSessions.trainingLocationId)
    : eq(schema.workoutSessions.trainingLocationId, locationId);

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

/** Sets of the most recent other occurrence in this context that has any, ordered by set number. */
export async function getRecentSessionPerformance(
  db: Database,
  userId: string,
  exerciseId: string,
  context: HistoryContext,
): Promise<RecentSessionPerformance> {
  const conditions = [
    eq(schema.workoutSessions.userId, userId),
    eq(schema.workoutExercisePerformances.exerciseId, exerciseId),
    inContext(context.locationId),
  ];
  if (context.excludeSessionId) conditions.push(ne(schema.workoutSessions.id, context.excludeSessionId));

  const rows = await db
    .select({
      performance: schema.workoutExercisePerformances,
      sessionLabel: schema.workoutSessions.sessionLabel,
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

  if (rows.length === 0) return { sets: [], prescription: null };

  const latest = rows[0]!;
  const latestRows = rows.filter((row) => row.performance.id === latest.performance.id);
  const { performance } = latest;
  return {
    sets: latestRows.map(({ set }) => ({
      setNumber: set.setNumber,
      loadKg: set.loadKg,
      reps: set.reps,
      rir: set.rir,
      painFlag: set.painFlag,
      techniqueValid: set.techniqueValid,
      completedAt: set.completedAt,
    })),
    // Backfilled legacy sessions only hold observed ranges, not what was prescribed.
    prescription:
      latest.sessionLabel === "legacy"
        ? null
        : {
            sets: performance.sets,
            repMin: performance.repMin,
            repMax: performance.repMax,
            rirMin: performance.rirMin,
            rirMax: performance.rirMax,
          },
  };
}

/** True when the athlete has done this exercise, but only in a different equipment context. */
export async function hasHistoryInOtherContext(
  db: Database,
  userId: string,
  exerciseId: string,
  locationId: string | null,
): Promise<boolean> {
  const different =
    locationId === null
      ? isNotNull(schema.workoutSessions.trainingLocationId)
      : or(isNull(schema.workoutSessions.trainingLocationId), ne(schema.workoutSessions.trainingLocationId, locationId));

  const [row] = await db
    .select({ id: schema.exerciseLogs.id })
    .from(schema.exerciseLogs)
    .innerJoin(
      schema.workoutExercisePerformances,
      eq(schema.exerciseLogs.workoutExercisePerformanceId, schema.workoutExercisePerformances.id),
    )
    .innerJoin(schema.workoutSessions, eq(schema.workoutExercisePerformances.workoutSessionId, schema.workoutSessions.id))
    .where(and(eq(schema.workoutSessions.userId, userId), eq(schema.exerciseLogs.exerciseId, exerciseId), different))
    .limit(1);
  return Boolean(row);
}

/** The last set of the most recent other occurrence — the "Previous" display. */
export async function getPreviousPerformance(
  db: Database,
  userId: string,
  exerciseId: string,
  context: HistoryContext,
): Promise<PreviousPerformance | null> {
  const last = (await getRecentSessionPerformance(db, userId, exerciseId, context)).sets.at(-1);
  if (!last) return null;
  return { loadKg: last.loadKg, reps: last.reps, rir: last.rir, completedAt: last.completedAt };
}

/** Every distinct load (kg) the athlete has logged for this exercise **in this equipment
 * context** - the evidence the engine uses to know what increments exist, so a step
 * inferred on one machine never leaks onto another. */
export async function getObservedLoadsKg(
  db: Database,
  userId: string,
  exerciseId: string,
  context: Pick<HistoryContext, "locationId">,
): Promise<number[]> {
  const rows = await db
    .selectDistinct({ loadKg: schema.exerciseLogs.loadKg })
    .from(schema.exerciseLogs)
    .innerJoin(
      schema.workoutExercisePerformances,
      eq(schema.exerciseLogs.workoutExercisePerformanceId, schema.workoutExercisePerformances.id),
    )
    .innerJoin(schema.workoutSessions, eq(schema.workoutExercisePerformances.workoutSessionId, schema.workoutSessions.id))
    .where(
      and(
        eq(schema.workoutSessions.userId, userId),
        eq(schema.exerciseLogs.exerciseId, exerciseId),
        inContext(context.locationId),
      ),
    );
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
  prescription: PerformedPrescription,
  context: HistoryContext,
): Promise<ProgressionTarget> {
  const recent = await getRecentSessionPerformance(db, userId, exerciseId, context);
  const observedLoadsKg = await getObservedLoadsKg(db, userId, exerciseId, context);
  const hasOtherContext =
    recent.sets.length === 0 && (await hasHistoryInOtherContext(db, userId, exerciseId, context.locationId));

  return computeProgressionTarget({
    recentSets: recent.sets.map((s) => ({
      reps: s.reps,
      loadKg: s.loadKg,
      rir: s.rir,
      painFlag: s.painFlag,
      techniqueValid: s.techniqueValid,
    })),
    previousPrescription: recent.prescription,
    currentPrescription: prescription,
    observedLoadsKg,
    hasHistoryInOtherContext: hasOtherContext,
  });
}
