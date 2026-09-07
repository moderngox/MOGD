import { z } from "zod";
import { schema, type Database } from "@mogd/db";

export const logSetInput = z.object({
  exerciseId: z.string().min(1),
  workoutId: z.string().min(1).optional(),
  setNumber: z.coerce.number().int().min(1).max(20),
  loadKg: z.coerce.number().min(0).max(500).optional(),
  reps: z.coerce.number().int().min(0).max(100),
  rir: z.coerce.number().int().min(0).max(10).optional(),
});
export type LogSetInput = z.infer<typeof logSetInput>;

/**
 * docs/ARCHITECTURE.md §14: persist user, workout, exercise, set number,
 * load, reps, RIR when collected, completion, timestamp. workoutId is
 * intentionally optional/nullable at the schema level (see
 * packages/db/src/schema/programs.ts) so this row survives a later
 * program regeneration.
 */
export async function logWorkoutSet(db: Database, userId: string, rawInput: LogSetInput) {
  const input = logSetInput.parse(rawInput);

  const [log] = await db
    .insert(schema.exerciseLogs)
    .values({
      userId,
      exerciseId: input.exerciseId,
      workoutId: input.workoutId,
      setNumber: input.setNumber,
      loadKg: input.loadKg,
      reps: input.reps,
      rir: input.rir,
    })
    .returning();
  return log;
}
