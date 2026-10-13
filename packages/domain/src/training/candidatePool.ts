import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import type { ExperienceLevel, Equipment } from "../assessment/options";
import type { ExerciseDifficulty } from "../exercises/options";
import type { ProgrammingProfile } from "../exercises/programmingProfiles";
import { listProgrammingProfilesForExercises, resolveApplicableProfile } from "../exercises/programmingProfiles";
import type { CanonicalMuscleGroup } from "../physique/muscles";
import { conflictingRestrictions } from "../safety/restrictions";
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

export interface EligibleExercise extends CatalogExercise {
  /** The profile allocateSession must prescribe from — resolved here (with
   * cross-level fallback, see resolveApplicableProfile) so this is the one
   * place "can this exercise be prescribed to this user at all" is decided. */
  programmingProfile: ProgrammingProfile;
}

/**
 * Hard eligibility filter for one session (docs/ARCHITECTURE.md §10's
 * ExerciseCandidatePool step): active, equipment the user actually has,
 * difficulty within their experience ceiling, at least one primary or
 * secondary muscle in common with what this session trains, and a
 * resolvable trainee-level programming profile (mogd_programming_engine_specs
 * 04: "no history" prescribes reps/RIR only, but *something* must define
 * that rep/RIR range — an exercise with every profile disabled has nothing
 * to prescribe and is excluded, same as failing any other hard gate).
 * Restrictions are matched on structured keys only: an exercise whose
 * contraindicationTags include any category the athlete reported is excluded
 * (safety/restrictions.ts). The athlete's free-text limitation notes are
 * stored for display but never interpreted - no heuristic that looks safe
 * without reviewed structured data behind it. With an empty taxonomy no
 * exercise carries a tag, so nothing is excluded here.
 */
export async function getExerciseCandidates(
  db: Database,
  input: {
    sessionLabel: SessionLabel;
    experienceLevel: ExperienceLevel;
    equipment: Equipment[];
    /** Required, so a caller can't forget it: pass [] only for an athlete who reported none. */
    restrictionKeys: string[];
  },
): Promise<EligibleExercise[]> {
  const allActive = await db
    .select()
    .from(schema.exercises)
    .where(eq(schema.exercises.isActive, true));

  const allowedDifficulty = new Set(ALLOWED_DIFFICULTY[input.experienceLevel]);
  const userEquipment = new Set<string>(input.equipment);
  const sessionMuscles = new Set<CanonicalMuscleGroup>(SESSION_MUSCLE_MAP[input.sessionLabel]);

  const gated = allActive.filter((exercise) => {
    // No allowed session role = no legal role in any session (eligibility must be explicit).
    if (exercise.allowedSessionRoles.length === 0) return false;

    if (conflictingRestrictions(exercise.contraindicationTags, input.restrictionKeys).length > 0) return false;

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

  const profilesByExercise = await listProgrammingProfilesForExercises(db, gated.map((e) => e.id));

  const eligible: EligibleExercise[] = [];
  for (const exercise of gated) {
    const profile = resolveApplicableProfile(profilesByExercise.get(exercise.id) ?? [], input.experienceLevel);
    if (profile) eligible.push({ ...exercise, programmingProfile: profile });
  }
  return eligible;
}
