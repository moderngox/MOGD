import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import type { ExperienceLevel, Equipment } from "../assessment/options";
import type { ExerciseDifficulty } from "../exercises/options";
import type { CanonicalMuscleGroup } from "../physique/muscles";
import type { SessionLabel } from "./splitTemplates";
import { SESSION_MUSCLE_MAP } from "./splitTemplates";

/**
 * Ordinal difficulty ceiling per experience level — same technique reviewed
 * in SPIDRA's filter-eligible-exercises.ts (a hard eligibility gate run
 * once before any scoring), adapted to MOGD's 3-level difficulty scale
 * rather than copying its numeric 1-5 scale.
 */
const ALLOWED_DIFFICULTY: Record<ExperienceLevel, ExerciseDifficulty[]> = {
  beginner: ["beginner"],
  intermediate: ["beginner", "intermediate"],
  advanced: ["beginner", "intermediate", "advanced"],
};

export type CatalogExercise = typeof schema.exercises.$inferSelect;

/**
 * Hard eligibility filter for one session (docs/ARCHITECTURE.md §10's
 * ExerciseCandidatePool step): active, equipment the user actually has,
 * difficulty within their experience ceiling, and at least one primary or
 * secondary muscle in common with what this session trains. Note: this
 * does NOT check the user's free-text injury/limitation notes against
 * exercise contraindication tags — there is no reviewed structured
 * taxonomy connecting the two (see docs/domain/safety's eligibility.ts for
 * the same honesty principle: don't fabricate a matching heuristic that
 * looks safe but isn't backed by real structured data).
 */
export async function getExerciseCandidates(
  db: Database,
  input: {
    sessionLabel: SessionLabel;
    experienceLevel: ExperienceLevel;
    equipment: Equipment[];
  },
): Promise<CatalogExercise[]> {
  const allActive = await db
    .select()
    .from(schema.exercises)
    .where(eq(schema.exercises.isActive, true));

  const allowedDifficulty = new Set(ALLOWED_DIFFICULTY[input.experienceLevel]);
  const userEquipment = new Set<string>(input.equipment);
  const sessionMuscles = new Set<CanonicalMuscleGroup>(SESSION_MUSCLE_MAP[input.sessionLabel]);

  return allActive.filter((exercise) => {
    if (!allowedDifficulty.has(exercise.difficulty as ExerciseDifficulty)) return false;

    const equipmentOk =
      exercise.equipment.length === 0 ||
      exercise.equipment.every((e) => userEquipment.has(e));
    if (!equipmentOk) return false;

    const musclesOk =
      exercise.primaryMuscles.some((m) => sessionMuscles.has(m as CanonicalMuscleGroup)) ||
      exercise.secondaryMuscles.some((m) => sessionMuscles.has(m as CanonicalMuscleGroup));
    return musclesOk;
  });
}
