import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { exercises } from "./schema/exercises";
import { exerciseProgrammingProfiles } from "./schema/exerciseProgrammingProfiles";

/**
 * Ops one-off (same style as promoteAdmin.ts): seeds three identical,
 * isInheritedDefault programming profiles for every exercise that doesn't
 * have any yet — run once after the 0011/0013 migrations that introduced
 * exercise_programming_profile and dropped the old flat defaultRepMin/Max
 * (mogd_programming_engine_specs 05's migration Phase 2). Safe to re-run:
 * exercises that already have at least one profile row are skipped.
 *
 * `pnpm --filter @mogd/db db:backfill-programming-profiles`
 */
const GENERIC_DEFAULT_PROFILE = {
  setsMin: 2,
  setsMax: 4,
  repsMin: 6,
  repsMax: 10,
  rirMin: 1,
  rirMax: 3,
  restSecondsMin: 75,
  restSecondsMax: 120,
} as const;

const TRAINEE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

async function main() {
  const db = getDb();
  const allExercises = await db.select({ id: exercises.id, canonicalId: exercises.canonicalId }).from(exercises);

  let seeded = 0;
  for (const exercise of allExercises) {
    const [existing] = await db
      .select({ id: exerciseProgrammingProfiles.id })
      .from(exerciseProgrammingProfiles)
      .where(eq(exerciseProgrammingProfiles.exerciseId, exercise.id));
    if (existing) continue;

    await db.insert(exerciseProgrammingProfiles).values(
      TRAINEE_LEVELS.map((traineeLevel) => ({
        exerciseId: exercise.id,
        traineeLevel,
        isInheritedDefault: true,
        ...GENERIC_DEFAULT_PROFILE,
      })),
    );
    seeded += 1;
    console.log(`Seeded default profiles for ${exercise.canonicalId}`);
  }

  console.log(`Done — seeded ${seeded}/${allExercises.length} exercises.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
