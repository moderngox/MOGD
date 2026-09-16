import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { schema, type Database } from "@mogd/db";
import { EXPERIENCE_LEVEL_OPTIONS } from "../assessment/options";
import type { ExperienceLevel } from "../assessment/options";
import { ExerciseNotFoundError } from "./relationships";

/**
 * A generic, illustrative starting point for a newly created exercise or a
 * migration backfill — same "provisional, not a fixed product decision"
 * caution this codebase already applies to its other illustrative constants
 * (see docs/AI_AND_SAFETY.md). Admin is expected to refine per exercise;
 * rows seeded from this are marked isInheritedDefault so the admin UI can
 * say so (mogd_programming_engine_specs 05: "don't silently fabricate three
 * distinct profiles unless explicitly marked as inherited/default").
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

const boundedPair = (minLabel: string, maxLabel: string) => ({
  message: `${minLabel} must be less than or equal to ${maxLabel}`,
});

const programmingProfileFields = z
  .object({
    enabled: z.coerce.boolean().default(true),
    setsMin: z.coerce.number().int().min(1).max(20),
    setsMax: z.coerce.number().int().min(1).max(20),
    repsMin: z.coerce.number().int().min(1).max(100),
    repsMax: z.coerce.number().int().min(1).max(100),
    rirMin: z.coerce.number().int().min(0).max(10),
    rirMax: z.coerce.number().int().min(0).max(10),
    restSecondsMin: z.coerce.number().int().min(0).max(600),
    restSecondsMax: z.coerce.number().int().min(0).max(600),
  })
  .refine((v) => v.setsMin <= v.setsMax, { ...boundedPair("setsMin", "setsMax"), path: ["setsMax"] })
  .refine((v) => v.repsMin <= v.repsMax, { ...boundedPair("repsMin", "repsMax"), path: ["repsMax"] })
  .refine((v) => v.rirMin <= v.rirMax, { ...boundedPair("rirMin", "rirMax"), path: ["rirMax"] })
  .refine((v) => v.restSecondsMin <= v.restSecondsMax, {
    ...boundedPair("restSecondsMin", "restSecondsMax"),
    path: ["restSecondsMax"],
  });

export const upsertProgrammingProfileInput = programmingProfileFields;
export type UpsertProgrammingProfileInput = z.infer<typeof upsertProgrammingProfileInput>;

export type ProgrammingProfile = typeof schema.exerciseProgrammingProfiles.$inferSelect;

/** Canonical order — also the fallback distance basis in resolveApplicableProfile below. */
const LEVEL_ORDER = EXPERIENCE_LEVEL_OPTIONS;

/**
 * Seeds one profile per trainee level for a brand-new exercise, all
 * identical and marked isInheritedDefault — so every exercise is
 * schedulable immediately after creation without admin having to remember
 * to configure programming before it can appear in a generated session.
 */
export async function createDefaultProgrammingProfiles(db: Database, exerciseId: string): Promise<void> {
  await db.insert(schema.exerciseProgrammingProfiles).values(
    LEVEL_ORDER.map((traineeLevel) => ({
      exerciseId,
      traineeLevel,
      isInheritedDefault: true,
      ...GENERIC_DEFAULT_PROFILE,
    })),
  );
}

export async function listProgrammingProfiles(db: Database, exerciseId: string): Promise<ProgrammingProfile[]> {
  const rows = await db
    .select()
    .from(schema.exerciseProgrammingProfiles)
    .where(eq(schema.exerciseProgrammingProfiles.exerciseId, exerciseId));
  return rows.sort((a, b) => LEVEL_ORDER.indexOf(a.traineeLevel as ExperienceLevel) - LEVEL_ORDER.indexOf(b.traineeLevel as ExperienceLevel));
}

/**
 * All profiles for a batch of exercises in one query, grouped by
 * exerciseId — the N+1-avoiding counterpart to listProgrammingProfiles for
 * candidatePool.ts, which resolves a profile per candidate exercise.
 */
export async function listProgrammingProfilesForExercises(
  db: Database,
  exerciseIds: string[],
): Promise<Map<string, ProgrammingProfile[]>> {
  if (exerciseIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(schema.exerciseProgrammingProfiles)
    .where(inArray(schema.exerciseProgrammingProfiles.exerciseId, exerciseIds));

  const byExercise = new Map<string, ProgrammingProfile[]>();
  for (const row of rows) {
    const list = byExercise.get(row.exerciseId) ?? [];
    list.push(row);
    byExercise.set(row.exerciseId, list);
  }
  return byExercise;
}

/**
 * Picks the profile to prescribe from for a given trainee level, pure and
 * deterministic — used both at generation time (candidatePool.ts) and
 * independently re-derived by validator.ts (never trust upstream).
 *
 * Fallback order when the exact level has no enabled profile: nearest lower
 * enabled level, then nearest higher enabled level (equidistant only occurs
 * for "intermediate" with both neighbors enabled — lower wins, a
 * deliberately conservative tie-break). Returns null when nothing is
 * enabled at any level, meaning this exercise cannot be prescribed right
 * now for this user.
 */
export function resolveApplicableProfile(
  profiles: ProgrammingProfile[],
  level: ExperienceLevel,
): ProgrammingProfile | null {
  const enabledByLevel = new Map(
    profiles.filter((p) => p.enabled).map((p) => [p.traineeLevel as ExperienceLevel, p]),
  );
  if (enabledByLevel.size === 0) return null;

  const exact = enabledByLevel.get(level);
  if (exact) return exact;

  const targetIndex = LEVEL_ORDER.indexOf(level);
  const sortedByDistance = [...enabledByLevel.entries()].sort(([levelA], [levelB]) => {
    const distanceA = LEVEL_ORDER.indexOf(levelA) - targetIndex;
    const distanceB = LEVEL_ORDER.indexOf(levelB) - targetIndex;
    // Prefer lower (negative distance) over higher (positive) at equal
    // magnitude — conservative-by-default tie-break.
    if (Math.abs(distanceA) !== Math.abs(distanceB)) return Math.abs(distanceA) - Math.abs(distanceB);
    return distanceA - distanceB;
  });
  return sortedByDistance[0]![1];
}

/**
 * Explicit admin edit — clears isInheritedDefault regardless of its prior
 * value, since a save always means "admin looked at this level and set it
 * deliberately." Upserts because a level's row might not exist yet (e.g. an
 * exercise created before this feature, backfilled with only some levels).
 */
export async function upsertProgrammingProfile(
  db: Database,
  exerciseId: string,
  traineeLevel: ExperienceLevel,
  rawInput: UpsertProgrammingProfileInput,
): Promise<ProgrammingProfile> {
  const input = upsertProgrammingProfileInput.parse(rawInput);

  const [exercise] = await db.select({ id: schema.exercises.id }).from(schema.exercises).where(eq(schema.exercises.id, exerciseId));
  if (!exercise) throw new ExerciseNotFoundError(exerciseId);

  const [existing] = await db
    .select({ id: schema.exerciseProgrammingProfiles.id })
    .from(schema.exerciseProgrammingProfiles)
    .where(
      and(
        eq(schema.exerciseProgrammingProfiles.exerciseId, exerciseId),
        eq(schema.exerciseProgrammingProfiles.traineeLevel, traineeLevel),
      ),
    );

  if (existing) {
    const [updated] = await db
      .update(schema.exerciseProgrammingProfiles)
      .set({ ...input, isInheritedDefault: false, updatedAt: new Date() })
      .where(eq(schema.exerciseProgrammingProfiles.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(schema.exerciseProgrammingProfiles)
    .values({ exerciseId, traineeLevel, isInheritedDefault: false, ...input })
    .returning();
  return created!;
}
