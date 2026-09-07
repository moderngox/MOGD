import { and, eq, gte } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { getCurrentProgram } from "./getProgram";

export type WeeklySessionStatus = "logged" | "today" | "scheduled";

export interface WeeklySessionView {
  workoutId: string;
  dayIndex: number;
  sessionLabel: string;
  status: WeeklySessionStatus;
  loggedAt: Date | null;
}

/**
 * Derives a LOGGED/TODAY/SCHEDULED status per workout in the current
 * program, for the dashboard's weekly session list. There is no calendar
 * scheduling (packages/db/src/schema/programs.ts: "no separate phase/week
 * tables yet") — this is a rotation heuristic, not true scheduling: a
 * workout is "logged" if it has a completed exercise log within the last
 * 7 days; the first not-yet-logged workout, in dayIndex order, is
 * "today"; the rest are "scheduled". See design.md's Today-screen section.
 */
export async function getWeeklySessionStatus(db: Database, userId: string): Promise<WeeklySessionView[]> {
  const program = await getCurrentProgram(db, userId);
  if (!program) return [];

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const logs = await db
    .select({ workoutId: schema.exerciseLogs.workoutId, completedAt: schema.exerciseLogs.completedAt })
    .from(schema.exerciseLogs)
    .where(and(eq(schema.exerciseLogs.userId, userId), gte(schema.exerciseLogs.completedAt, since)));

  const lastLoggedAt = new Map<string, Date>();
  for (const log of logs) {
    if (!log.workoutId) continue;
    const existing = lastLoggedAt.get(log.workoutId);
    if (!existing || log.completedAt > existing) {
      lastLoggedAt.set(log.workoutId, log.completedAt);
    }
  }

  let todayAssigned = false;
  return program.workouts.map((workout) => {
    const loggedAt = lastLoggedAt.get(workout.workoutId) ?? null;
    let status: WeeklySessionStatus;
    if (loggedAt) {
      status = "logged";
    } else if (!todayAssigned) {
      todayAssigned = true;
      status = "today";
    } else {
      status = "scheduled";
    }

    return {
      workoutId: workout.workoutId,
      dayIndex: workout.dayIndex,
      sessionLabel: workout.sessionLabel,
      status,
      loggedAt,
    };
  });
}
