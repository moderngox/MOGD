import { and, eq, gte } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";

/**
 * Computed from real logged sets rather than self-reported — a fair, if
 * approximate, proxy: any distinct calendar date with at least one logged
 * set counts as one completed session. Expected session count is the
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

  const logs = await db
    .select({ completedAt: schema.exerciseLogs.completedAt })
    .from(schema.exerciseLogs)
    .where(and(eq(schema.exerciseLogs.userId, userId), gte(schema.exerciseLogs.completedAt, since)));

  const distinctDates = new Set(logs.map((l) => l.completedAt.toISOString().slice(0, 10)));

  const msElapsed = Math.max(0, Date.now() - since.getTime());
  const weeksElapsed = Math.max(1, msElapsed / (7 * 24 * 60 * 60 * 1000));
  const expectedSessions = program.sessionsPerWeek * weeksElapsed;

  return Math.min(100, Math.round((distinctDates.size / expectedSessions) * 100));
}
