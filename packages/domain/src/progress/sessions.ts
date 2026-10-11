import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { schema, type Database } from "@mogd/db";
import { getWorkoutOwnerId } from "../programs/getProgram";
import { getOwnedLocation } from "./locations";
import { getProgressionTargetForExercise } from "./previousPerformance";

export type WorkoutSession = typeof schema.workoutSessions.$inferSelect;
export type ExercisePerformance = typeof schema.workoutExercisePerformances.$inferSelect;
export type LoggedSet = typeof schema.exerciseLogs.$inferSelect;

export class WorkoutNotOwnedError extends Error {
  constructor() {
    super("This workout does not belong to the current user");
    this.name = "WorkoutNotOwnedError";
  }
}

export class ExerciseNotInWorkoutError extends Error {
  constructor(exerciseId: string) {
    super(`Exercise "${exerciseId}" is not part of this workout`);
    this.name = "ExerciseNotInWorkoutError";
  }
}

export class SessionLocationMismatchError extends Error {
  constructor() {
    super("This workout is already in progress at a different training location");
    this.name = "SessionLocationMismatchError";
  }
}

export class InvalidSetNumberError extends Error {
  constructor(setNumber: number, expectedMax: number) {
    super(`Set ${setNumber} can't be logged yet — the next set to log is ${expectedMax}`);
    this.name = "InvalidSetNumberError";
  }
}

export class SessionNotFoundError extends Error {
  constructor() {
    super("No such workout session for this user");
    this.name = "SessionNotFoundError";
  }
}

export class SetNotFoundError extends Error {
  constructor() {
    super("No such logged set for this user");
    this.name = "SetNotFoundError";
  }
}

export const logSetInput = z.object({
  workoutId: z.string().min(1),
  exerciseId: z.string().min(1),
  /** Equipment context of the occurrence; fixed when it starts. Null = no named place. */
  locationId: z.string().min(1).nullable(),
  setNumber: z.number().int().min(1).max(20),
  loadKg: z.number().min(0).max(500).optional(),
  reps: z.number().int().min(0).max(100),
  rir: z.number().int().min(0).max(10).optional(),
  // Optional signals that gate the progression engine (training/progression.ts).
  painFlag: z.boolean().optional(),
  techniqueValid: z.boolean().optional(),
});
export type LogSetInput = z.infer<typeof logSetInput>;

export const setCorrectionInput = z.object({
  loadKg: z.number().min(0).max(500).nullable(),
  reps: z.number().int().min(0).max(100),
  rir: z.number().int().min(0).max(10).nullable(),
  painFlag: z.boolean().nullable(),
  techniqueValid: z.boolean().nullable(),
});
export type SetCorrectionInput = z.infer<typeof setCorrectionInput>;

/** Read-only (the page calls this on GET): the open occurrence of a program slot, if any. */
export async function getInProgressSession(
  db: Database,
  userId: string,
  workoutId: string,
): Promise<WorkoutSession | null> {
  const [session] = await db
    .select()
    .from(schema.workoutSessions)
    .where(
      and(
        eq(schema.workoutSessions.userId, userId),
        eq(schema.workoutSessions.workoutId, workoutId),
        eq(schema.workoutSessions.status, "in_progress"),
      ),
    );
  return session ?? null;
}

/**
 * Starts (or resumes) the occurrence of this program slot and the
 * per-exercise performance inside it. Both inserts are insert-or-ignore
 * against DB-level unique indexes, so concurrent or repeated calls converge
 * on one row instead of racing. The prescription + recommendation snapshot
 * is written only when the performance row is first created — later profile
 * edits, history changes or regeneration never rewrite it.
 */
export async function getOrStartPerformance(
  db: Database,
  userId: string,
  workoutId: string,
  exerciseId: string,
  locationId: string | null,
): Promise<{ session: WorkoutSession; performance: ExercisePerformance }> {
  if ((await getWorkoutOwnerId(db, workoutId)) !== userId) throw new WorkoutNotOwnedError();
  if (locationId !== null) await getOwnedLocation(db, userId, locationId);

  const [slot] = await db
    .select()
    .from(schema.workoutExercises)
    .where(and(eq(schema.workoutExercises.workoutId, workoutId), eq(schema.workoutExercises.exerciseId, exerciseId)));
  if (!slot) throw new ExerciseNotInWorkoutError(exerciseId);
  const [workout] = await db.select().from(schema.workouts).where(eq(schema.workouts.id, workoutId));

  let session = await getInProgressSession(db, userId, workoutId);
  if (!session) {
    await db
      .insert(schema.workoutSessions)
      .values({ userId, workoutId, sessionLabel: workout!.sessionLabel, trainingLocationId: locationId })
      .onConflictDoNothing();
    session = (await getInProgressSession(db, userId, workoutId))!;
  }
  // The context is fixed for the occurrence: a stale tab must not mix equipment mid-workout.
  if (session.trainingLocationId !== locationId) throw new SessionLocationMismatchError();

  const findPerformance = async () =>
    (
      await db
        .select()
        .from(schema.workoutExercisePerformances)
        .where(
          and(
            eq(schema.workoutExercisePerformances.workoutSessionId, session!.id),
            eq(schema.workoutExercisePerformances.exerciseId, exerciseId),
          ),
        )
    )[0] ?? null;

  let performance = await findPerformance();
  if (!performance) {
    const target = await getProgressionTargetForExercise(
      db,
      userId,
      exerciseId,
      { sets: slot.sets, repMin: slot.repMin, repMax: slot.repMax, rirMin: slot.rirMin, rirMax: slot.rirMax },
      { locationId: session.trainingLocationId, excludeSessionId: session.id },
    );
    await db
      .insert(schema.workoutExercisePerformances)
      .values({
        workoutSessionId: session.id,
        exerciseId,
        orderIndex: slot.orderIndex,
        sessionRole: slot.sessionRole,
        roleReason: slot.roleReason,
        supersetGroupId: slot.supersetGroupId,
        sets: slot.sets,
        repMin: slot.repMin,
        repMax: slot.repMax,
        rirMin: slot.rirMin,
        rirMax: slot.rirMax,
        restSeconds: slot.restSeconds,
        recommendedLoadKg: target.targetLoadKg,
        recommendationReason: target.reason,
        loadInstruction: target.loadInstruction,
        recommendationMessage: target.message,
        targetRepMin: target.targetRepMin,
        targetRepMax: target.targetRepMax,
      })
      .onConflictDoNothing();
    performance = (await findPerformance())!;
  }

  return { session, performance };
}

async function syncPerformanceCompleted(db: Database, performance: ExercisePerformance): Promise<void> {
  const sets = await db
    .select({ id: schema.exerciseLogs.id })
    .from(schema.exerciseLogs)
    .where(eq(schema.exerciseLogs.workoutExercisePerformanceId, performance.id));
  await db
    .update(schema.workoutExercisePerformances)
    .set({ completed: sets.length >= performance.sets })
    .where(eq(schema.workoutExercisePerformances.id, performance.id));
}

/**
 * Logs one set of the in-progress occurrence. Upsert on (performance, setNumber):
 * the first call inserts, a retry of the same payload is a no-op, and a
 * changed payload for an existing set number corrects it — so a double-tap, a
 * retried request or a simultaneous duplicate can never duplicate a set or fail.
 * Set numbers stay contiguous.
 */
export async function logSet(db: Database, userId: string, rawInput: LogSetInput): Promise<LoggedSet> {
  const input = logSetInput.parse(rawInput);
  const { performance } = await getOrStartPerformance(db, userId, input.workoutId, input.exerciseId, input.locationId);

  const existingSets = await db
    .select()
    .from(schema.exerciseLogs)
    .where(eq(schema.exerciseLogs.workoutExercisePerformanceId, performance.id));
  if (input.setNumber > existingSets.length + 1) throw new InvalidSetNumberError(input.setNumber, existingSets.length + 1);

  const values = {
    loadKg: input.loadKg ?? null,
    reps: input.reps,
    rir: input.rir ?? null,
    painFlag: input.painFlag ?? null,
    techniqueValid: input.techniqueValid ?? null,
  };
  // One conflict-aware statement, not read-then-insert: two simultaneous first
  // submissions of the same set would otherwise both choose "insert" and one
  // would fail on the unique index. Now one inserts and the other updates to
  // the same values, so both succeed. Disagreeing concurrent payloads for one
  // set are last-write-wins (there is still exactly one row).
  const [logged] = await db
    .insert(schema.exerciseLogs)
    .values({
      userId,
      exerciseId: input.exerciseId,
      workoutExercisePerformanceId: performance.id,
      setNumber: input.setNumber,
      ...values,
    })
    .onConflictDoUpdate({
      target: [schema.exerciseLogs.workoutExercisePerformanceId, schema.exerciseLogs.setNumber],
      set: values,
    })
    .returning();

  await syncPerformanceCompleted(db, performance);
  return logged!;
}

async function getOwnedSet(db: Database, userId: string, setId: string): Promise<LoggedSet> {
  const [set] = await db
    .select()
    .from(schema.exerciseLogs)
    .where(and(eq(schema.exerciseLogs.id, setId), eq(schema.exerciseLogs.userId, userId)));
  if (!set || !set.workoutExercisePerformanceId) throw new SetNotFoundError();
  return set;
}

/** The performance, only if its session belongs to this user. */
async function getOwnedPerformance(db: Database, userId: string, performanceId: string): Promise<ExercisePerformance> {
  const [row] = await db
    .select({ performance: schema.workoutExercisePerformances })
    .from(schema.workoutExercisePerformances)
    .innerJoin(schema.workoutSessions, eq(schema.workoutExercisePerformances.workoutSessionId, schema.workoutSessions.id))
    .where(and(eq(schema.workoutExercisePerformances.id, performanceId), eq(schema.workoutSessions.userId, userId)));
  if (!row) throw new SessionNotFoundError();
  return row.performance;
}

/** Correct any logged set by id — works before and after the session is finished. */
export async function correctSet(
  db: Database,
  userId: string,
  setId: string,
  rawCorrection: SetCorrectionInput,
): Promise<LoggedSet> {
  const correction = setCorrectionInput.parse(rawCorrection);
  const set = await getOwnedSet(db, userId, setId);
  const [updated] = await db.update(schema.exerciseLogs).set(correction).where(eq(schema.exerciseLogs.id, set.id)).returning();
  return updated!;
}

/** Removes only the last set so numbering stays contiguous; returns false when there is nothing to remove. */
export async function deleteLastSet(db: Database, userId: string, performanceId: string): Promise<boolean> {
  const performance = await getOwnedPerformance(db, userId, performanceId);

  const sets = await db
    .select()
    .from(schema.exerciseLogs)
    .where(eq(schema.exerciseLogs.workoutExercisePerformanceId, performanceId))
    .orderBy(asc(schema.exerciseLogs.setNumber));
  const last = sets.at(-1);
  if (!last) return false;

  await db.delete(schema.exerciseLogs).where(eq(schema.exerciseLogs.id, last.id));
  await syncPerformanceCompleted(db, performance);
  return true;
}

/** Confirms the workout. Idempotent; a finished session can still be corrected afterwards. */
export async function finishSession(db: Database, userId: string, sessionId: string): Promise<WorkoutSession> {
  const [session] = await db
    .select()
    .from(schema.workoutSessions)
    .where(and(eq(schema.workoutSessions.id, sessionId), eq(schema.workoutSessions.userId, userId)));
  if (!session) throw new SessionNotFoundError();
  if (session.status !== "in_progress") return session;

  const [finished] = await db
    .update(schema.workoutSessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(schema.workoutSessions.id, sessionId))
    .returning();
  return finished!;
}

export interface SessionSummary {
  session: WorkoutSession;
  /** `loggedSets` (not `sets`): the performance row already has a `sets` column — the prescribed count. */
  performances: (ExercisePerformance & { loggedSets: LoggedSet[] })[];
}

export async function getSessionSummary(db: Database, userId: string, sessionId: string): Promise<SessionSummary> {
  const [session] = await db
    .select()
    .from(schema.workoutSessions)
    .where(and(eq(schema.workoutSessions.id, sessionId), eq(schema.workoutSessions.userId, userId)));
  if (!session) throw new SessionNotFoundError();

  const performances = await db
    .select()
    .from(schema.workoutExercisePerformances)
    .where(eq(schema.workoutExercisePerformances.workoutSessionId, sessionId))
    .orderBy(asc(schema.workoutExercisePerformances.orderIndex));

  const withSets = [];
  for (const performance of performances) {
    const sets = await db
      .select()
      .from(schema.exerciseLogs)
      .where(eq(schema.exerciseLogs.workoutExercisePerformanceId, performance.id))
      .orderBy(asc(schema.exerciseLogs.setNumber));
    withSets.push({ ...performance, loggedSets: sets });
  }
  return { session, performances: withSets };
}
