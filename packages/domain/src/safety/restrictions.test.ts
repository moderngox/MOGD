import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise, updateExercise } from "../exercises/exerciseCatalog";
import type { CreateExerciseInput } from "../exercises/schemas";
import { submitAssessment } from "../assessment/submitAssessment";
import type { AssessmentSubmission } from "../assessment/schemas";
import { getAssessmentFormState } from "../assessment/getAssessment";
import { getExerciseCandidates } from "../training/candidatePool";
import { generateStrategyAndNutrition } from "../nutrition/generateStrategy";
import { generateProgram } from "../programs/generateProgram";
import { validateProgram, type ProgramPlan } from "../programs/validator";
import {
  assertKnownRestrictionKeys,
  conflictingRestrictions,
  createRestrictionCategory,
  deleteRestrictionCategory,
  DuplicateRestrictionKeyError,
  getRestrictionUsage,
  listRestrictionCategories,
  renameRestrictionCategory,
  RestrictionInUseError,
  RestrictionNotFoundError,
  UnknownRestrictionError,
} from "./restrictions";

const exercise = (
  canonicalId: string,
  movementPattern: CreateExerciseInput["movementPattern"],
  primaryMuscles: CreateExerciseInput["primaryMuscles"],
  extra: Partial<CreateExerciseInput> = {},
): CreateExerciseInput => ({
  canonicalId,
  name: canonicalId,
  movementPattern,
  difficulty: "beginner",
  primaryMuscles,
  secondaryMuscles: [],
  equipment: ["dumbbells"],
  contraindicationTags: [],
  isActive: true,
  allowedSessionRoles: ["main", "accessory", "superset", "finisher"],
  ...extra,
});

const submission: AssessmentSubmission = {
  primaryGoal: "recomposition",
  physiquePriorities: ["shoulders"],
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  waistCm: 85,
  experienceLevel: "intermediate",
  trainingConsistency: "consistent",
  currentActivityLevel: "moderately_active",
  sessionsPerWeek: 2,
  sessionDurationMinutes: 60,
  trainingContext: ["gym"],
  equipment: ["dumbbells", "pull_up_bar"],
  dietaryPreference: "standard",
  mealsPerDay: 3,
  cookingPreference: "meal_prep",
  willingToTrackCalories: true,
  photos: [],
};

describe("restriction taxonomy", () => {
  let db: Database;
  let close: () => void;
  let userId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
    const [user] = await db.insert(schema.users).values({ email: "athlete@example.com" }).returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterEach(() => close());

  describe("categories", () => {
    it("ships empty and lists categories by label", async () => {
      expect(await listRestrictionCategories(db)).toEqual([]);
      await createRestrictionCategory(db, { key: "zebra_group", label: "Zebra" });
      await createRestrictionCategory(db, { key: "alpha_group", label: "Alpha" });
      expect((await listRestrictionCategories(db)).map((c) => c.label)).toEqual(["Alpha", "Zebra"]);
    });

    it("rejects a malformed key, an empty label and a duplicate key", async () => {
      await expect(createRestrictionCategory(db, { key: "Not A Slug", label: "x" })).rejects.toThrow();
      await expect(createRestrictionCategory(db, { key: "ok_key", label: "  " })).rejects.toThrow();
      await createRestrictionCategory(db, { key: "ok_key", label: "Fine" });
      await expect(createRestrictionCategory(db, { key: "ok_key", label: "Again" })).rejects.toThrow(DuplicateRestrictionKeyError);
    });

    it("renames the label but never the key", async () => {
      const created = await createRestrictionCategory(db, { key: "group_a", label: "Before" });
      const renamed = await renameRestrictionCategory(db, created.id, "After");
      expect(renamed).toMatchObject({ key: "group_a", label: "After" });
      await expect(renameRestrictionCategory(db, "missing", "x")).rejects.toThrow(RestrictionNotFoundError);
    });

    it("refuses to delete a category an exercise or an athlete still uses, then allows it once free", async () => {
      const category = await createRestrictionCategory(db, { key: "group_a", label: "Group A" });
      const ex = await createExercise(db, exercise("some_press", "push", ["upper_chest"], { contraindicationTags: ["group_a"] }));
      await db.insert(schema.trainingProfiles).values({
        userId,
        experienceLevel: "intermediate",
        trainingConsistency: "consistent",
        currentActivityLevel: "moderately_active",
        restrictionKeys: ["group_a"],
        sessionsPerWeek: 2,
        sessionDurationMinutes: 60,
        trainingContext: ["gym"],
        equipment: [],
      });

      expect(await getRestrictionUsage(db, "group_a")).toEqual({ exerciseCount: 1, athleteCount: 1 });
      await expect(deleteRestrictionCategory(db, category.id)).rejects.toThrow(RestrictionInUseError);

      await updateExercise(db, ex!.id, { ...exerciseUpdate(ex!), contraindicationTags: [] });
      await expect(deleteRestrictionCategory(db, category.id)).rejects.toThrow(/1 athlete/);
      await db.update(schema.trainingProfiles).set({ restrictionKeys: [] }).where(eq(schema.trainingProfiles.userId, userId));

      await deleteRestrictionCategory(db, category.id);
      expect(await listRestrictionCategories(db)).toEqual([]);
      await expect(deleteRestrictionCategory(db, category.id)).rejects.toThrow(RestrictionNotFoundError);
    });
  });

  describe("write boundaries reject keys that are not categories", () => {
    it("assertKnownRestrictionKeys names every unknown key and passes an empty list", async () => {
      await createRestrictionCategory(db, { key: "group_a", label: "Group A" });
      await expect(assertKnownRestrictionKeys(db, [])).resolves.toBeUndefined();
      await expect(assertKnownRestrictionKeys(db, ["group_a"])).resolves.toBeUndefined();
      const error = await assertKnownRestrictionKeys(db, ["group_a", "nope", "nada", "nope"]).catch((e) => e);
      expect(error).toBeInstanceOf(UnknownRestrictionError);
      expect(error.keys).toEqual(["nope", "nada"]);
    });

    it("an exercise cannot be created or updated with a tag that is not a category", async () => {
      await expect(
        createExercise(db, exercise("bad_press", "push", ["upper_chest"], { contraindicationTags: ["knee_pain"] })),
      ).rejects.toThrow(UnknownRestrictionError);

      await createRestrictionCategory(db, { key: "group_a", label: "Group A" });
      const ok = await createExercise(db, exercise("good_press", "push", ["upper_chest"], { contraindicationTags: ["group_a"] }));
      expect(ok!.contraindicationTags).toEqual(["group_a"]);
      await expect(updateExercise(db, ok!.id, { ...exerciseUpdate(ok!), contraindicationTags: ["group_a", "made_up"] })).rejects.toThrow(
        /made_up/,
      );
      // The rejected update left the stored tags alone.
      const [stored] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, ok!.id));
      expect(stored!.contraindicationTags).toEqual(["group_a"]);
    });

    it("an assessment cannot be submitted with an unknown restriction, and nothing is persisted", async () => {
      await expect(submitAssessment(db, userId, { ...submission, restrictionKeys: ["knee_pain"] })).rejects.toThrow(UnknownRestrictionError);
      expect(await db.select().from(schema.trainingProfiles)).toEqual([]);
    });

    it("stores reported restrictions, returns them for re-editing, and treats an omitted list as none", async () => {
      await createRestrictionCategory(db, { key: "group_a", label: "Group A" });
      await submitAssessment(db, userId, { ...submission, restrictionKeys: ["group_a"] });
      expect((await getAssessmentFormState(db, userId))!.restrictionKeys).toEqual(["group_a"]);

      await submitAssessment(db, userId, submission);
      expect((await getAssessmentFormState(db, userId))!.restrictionKeys).toEqual([]);
    });

    it("rejects duplicate restriction keys in a submission", async () => {
      await createRestrictionCategory(db, { key: "group_a", label: "Group A" });
      await expect(submitAssessment(db, userId, { ...submission, restrictionKeys: ["group_a", "group_a"] })).rejects.toThrow(/unique/i);
    });
  });

  describe("matching", () => {
    it("reports the categories an exercise shares with the athlete", () => {
      expect(conflictingRestrictions(["a", "b"], ["b", "c"])).toEqual(["b"]);
      expect(conflictingRestrictions(["a"], [])).toEqual([]);
      expect(conflictingRestrictions([], ["a"])).toEqual([]);
    });

    it("excludes an exercise tagged with a reported category from the candidate pool, and only that one", async () => {
      await createRestrictionCategory(db, { key: "group_a", label: "Group A" });
      await createExercise(db, exercise("tagged_press", "push", ["upper_chest"], { contraindicationTags: ["group_a"] }));
      await createExercise(db, exercise("plain_press", "push", ["upper_chest"]));
      const query = { sessionLabel: "push" as const, experienceLevel: "intermediate" as const, equipment: ["dumbbells" as const] };

      const none = await getExerciseCandidates(db, { ...query, restrictionKeys: [] });
      expect(none.map((c) => c.canonicalId).sort()).toEqual(["plain_press", "tagged_press"]);

      const restricted = await getExerciseCandidates(db, { ...query, restrictionKeys: ["group_a"] });
      expect(restricted.map((c) => c.canonicalId)).toEqual(["plain_press"]);
    });

    it("with an empty taxonomy and no restrictions nothing is excluded", async () => {
      await createExercise(db, exercise("plain_press", "push", ["upper_chest"]));
      const candidates = await getExerciseCandidates(db, {
        sessionLabel: "push",
        experienceLevel: "intermediate",
        equipment: ["dumbbells"],
        restrictionKeys: [],
      });
      expect(candidates).toHaveLength(1);
    });
  });

  describe("program generation and validation", () => {
    async function seedCatalogAndAthlete(restrictionKeys: string[]) {
      await createRestrictionCategory(db, { key: "group_a", label: "Group A" });
      await createExercise(db, exercise("cable_lateral_raise", "isolation", ["lateral_deltoids"], { contraindicationTags: ["group_a"] }));
      await createExercise(db, exercise("incline_dumbbell_press", "push", ["upper_chest"], { difficulty: "intermediate" }));
      await createExercise(db, exercise("neutral_grip_lat_pulldown", "pull", ["lats"], { equipment: ["pull_up_bar"] }));
      await createExercise(db, exercise("bulgarian_split_squat", "lunge", ["quadriceps"], { difficulty: "intermediate" }));
      await createExercise(db, exercise("romanian_deadlift", "hinge", ["hamstrings"], { difficulty: "intermediate" }));
      await createExercise(db, exercise("cable_curl", "isolation", ["biceps"]));

      await submitAssessment(db, userId, { ...submission, restrictionKeys });
      await generateStrategyAndNutrition(db, userId);
    }

    const programmedCanonicalIds = async () => {
      const rows = await db
        .select({ canonicalId: schema.exercises.canonicalId })
        .from(schema.workoutExercises)
        .innerJoin(schema.exercises, eq(schema.workoutExercises.exerciseId, schema.exercises.id));
      return rows.map((r) => r.canonicalId);
    };

    it("programs the tagged exercise for an athlete who reported nothing, and never for one who did", async () => {
      await seedCatalogAndAthlete([]);
      expect((await generateProgram(db, userId)).success).toBe(true);
      expect(await programmedCanonicalIds()).toContain("cable_lateral_raise");

      await submitAssessment(db, userId, { ...submission, restrictionKeys: ["group_a"] });
      const regenerated = await generateProgram(db, userId);
      expect(regenerated.reasons).toEqual([]);
      expect(regenerated.success).toBe(true);
      expect(await programmedCanonicalIds()).not.toContain("cable_lateral_raise");
    });

    it("the validator independently rejects a plan that contains an exercise the athlete is restricted from", async () => {
      await seedCatalogAndAthlete([]);
      const generated = await generateProgram(db, userId);
      const plan: ProgramPlan = generated.plan!;
      expect((await validateProgram(db, plan)).valid).toBe(true);

      const violating = await validateProgram(db, { ...plan, restrictionKeys: ["group_a"] });
      expect(violating.valid).toBe(false);
      expect(violating.reasons.join(" ")).toMatch(/"cable_lateral_raise" is marked unsuitable for a restriction the user reported \(group_a\)/);
    });
  });
});

/** The editable fields of a stored exercise, shaped for updateExercise. */
function exerciseUpdate(row: typeof schema.exercises.$inferSelect) {
  return {
    name: row.name,
    movementPattern: row.movementPattern as CreateExerciseInput["movementPattern"],
    difficulty: row.difficulty as CreateExerciseInput["difficulty"],
    primaryMuscles: row.primaryMuscles as CreateExerciseInput["primaryMuscles"],
    secondaryMuscles: row.secondaryMuscles as CreateExerciseInput["secondaryMuscles"],
    equipment: row.equipment as CreateExerciseInput["equipment"],
    contraindicationTags: row.contraindicationTags,
    isActive: row.isActive,
    allowedSessionRoles: row.allowedSessionRoles as CreateExerciseInput["allowedSessionRoles"],
  };
}
