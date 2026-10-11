import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";

export const DEFAULT_TEST_PRESCRIPTION = { sets: 3, repMin: 12, repMax: 15, rirMin: 1, rirMax: 3, restSeconds: 60 };

/**
 * Test-only: one program slot (workout) for `userId` containing the given
 * exercises, each prescribed `prescription`. Reuses the user's program if
 * they already have one (programs.userId is unique).
 */
export async function seedWorkout(
  db: Database,
  userId: string,
  exerciseIds: string[],
  prescription: Partial<typeof DEFAULT_TEST_PRESCRIPTION> = {},
  sessionLabel = "full_body",
): Promise<string> {
  let [program] = await db.select().from(schema.programs).where(eq(schema.programs.userId, userId));
  if (!program) {
    [program] = await db.insert(schema.programs).values({ userId, splitType: "full_body", sessionsPerWeek: 3 }).returning();
  }
  const [workout] = await db
    .insert(schema.workouts)
    .values({ programId: program!.id, dayIndex: 0, sessionLabel, estimatedDurationMinutes: 45 })
    .returning();

  for (const [orderIndex, exerciseId] of exerciseIds.entries()) {
    await db.insert(schema.workoutExercises).values({
      workoutId: workout!.id,
      exerciseId,
      orderIndex,
      sessionRole: "accessory",
      roleReason: "DEFAULT_ACCESSORY_FALLBACK",
      ...DEFAULT_TEST_PRESCRIPTION,
      ...prescription,
    });
  }
  return workout!.id;
}
