import { and, eq, gte } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";

/**
 * Computed from real logged sets rather than self-reported: each workout
 * occurrence with at least one logged set counts as one session. Expected session count is the
 * program's sessionsPerWeek scaled by elapsed time since `since`.
 * Returns 0 if the user has no current program.
 */
export async function computeTrainingAdherence(
  db: Database,
  userId: string,
  since: Date,
): Promise<number> {
  const [program] = await db
    .select({ sessionsPerWeek: schema.programs.sessionsPerWeek })
    .from(schema.programs)
    .where(eq(schema.programs.userId, userId));
  if (!program) return 0;

  // One workout occurrence = one session, whatever day(s) it spanned; counts
  // any occurrence with at least one logged set since `since`.
  const sessions = await db
    .selectDistinct({ id: schema.workoutSessions.id })
    .from(schema.workoutSessions)
    .innerJoin(
      schema.workoutExercisePerformances,
      eq(schema.workoutExercisePerformances.workoutSessionId, schema.workoutSessions.id),
    )
    .innerJoin(
      schema.exerciseLogs,
      eq(schema.exerciseLogs.workoutExercisePerformanceId, schema.workoutExercisePerformances.id),
    )
    .where(and(eq(schema.workoutSessions.userId, userId), gte(schema.exerciseLogs.completedAt, since)));

  const msElapsed = Math.max(0, Date.now() - since.getTime());
  const weeksElapsed = Math.max(1, msElapsed / (7 * 24 * 60 * 60 * 1000));
  const expectedSessions = program.sessionsPerWeek * weeksElapsed;

  return Math.min(100, Math.round((sessions.length / expectedSessions) * 100));
}
