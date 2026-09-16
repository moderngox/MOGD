import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { upsertProgrammingProfile } from "../exercises/programmingProfiles";
import { getExerciseCandidates } from "./candidatePool";

const DISABLED_PROFILE_INPUT = {
  enabled: false,
  setsMin: 2,
  setsMax: 4,
  repsMin: 6,
  repsMax: 10,
  rirMin: 1,
  rirMax: 3,
  restSecondsMin: 75,
  restSecondsMax: 120,
} as const;

describe("getExerciseCandidates", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    await createExercise(db, {
      canonicalId: "incline_dumbbell_press",
      name: "Incline Dumbbell Press",
      movementPattern: "push",
      difficulty: "intermediate",
      primaryMuscles: ["upper_chest"],
      secondaryMuscles: ["triceps"],
      equipment: ["dumbbells"],
      contraindicationTags: [],
      isActive: true,
      allowedSessionRoles: [],
    });
    await createExercise(db, {
      canonicalId: "barbell_back_squat",
      name: "Barbell Back Squat",
      movementPattern: "squat",
      difficulty: "advanced",
      primaryMuscles: ["quadriceps", "glutes"],
      secondaryMuscles: [],
      equipment: ["barbell"],
      contraindicationTags: [],
      isActive: true,
      allowedSessionRoles: [],
    });
    await createExercise(db, {
      canonicalId: "retired_move",
      name: "Retired Move",
      movementPattern: "push",
      difficulty: "beginner",
      primaryMuscles: ["upper_chest"],
      secondaryMuscles: [],
      equipment: [],
      contraindicationTags: [],
      isActive: false,
      allowedSessionRoles: [],
    });
  });

  afterEach(() => close());

  it("excludes inactive exercises", async () => {
    const candidates = await getExerciseCandidates(db, {
      sessionLabel: "push",
      experienceLevel: "advanced",
      equipment: ["barbell", "dumbbells"],
    });
    expect(candidates.some((c) => c.canonicalId === "retired_move")).toBe(false);
  });

  it("excludes exercises requiring equipment the user doesn't have", async () => {
    const candidates = await getExerciseCandidates(db, {
      sessionLabel: "legs",
      experienceLevel: "advanced",
      equipment: ["dumbbells"],
    });
    expect(candidates.some((c) => c.canonicalId === "barbell_back_squat")).toBe(false);
  });

  it("excludes exercises above the user's experience ceiling", async () => {
    const candidates = await getExerciseCandidates(db, {
      sessionLabel: "legs",
      experienceLevel: "beginner",
      equipment: ["barbell"],
    });
    expect(candidates.some((c) => c.canonicalId === "barbell_back_squat")).toBe(false);
  });

  it("excludes exercises with no muscle overlap with the session", async () => {
    const candidates = await getExerciseCandidates(db, {
      sessionLabel: "pull",
      experienceLevel: "advanced",
      equipment: ["dumbbells", "barbell"],
    });
    // incline_dumbbell_press targets chest/triceps, not a pull-session muscle
    expect(candidates.some((c) => c.canonicalId === "incline_dumbbell_press")).toBe(false);
  });

  it("includes an eligible exercise matching all criteria", async () => {
    const candidates = await getExerciseCandidates(db, {
      sessionLabel: "push",
      experienceLevel: "intermediate",
      equipment: ["dumbbells"],
    });
    expect(candidates.map((c) => c.canonicalId)).toContain("incline_dumbbell_press");
  });

  it("attaches the resolved programming profile for the requested level", async () => {
    const [candidate] = await getExerciseCandidates(db, {
      sessionLabel: "push",
      experienceLevel: "intermediate",
      equipment: ["dumbbells"],
    });
    expect(candidate?.programmingProfile.traineeLevel).toBe("intermediate");
  });

  it("falls back to the nearest enabled level when the exact level's profile is disabled", async () => {
    const rows = await db
      .select({ id: schema.exercises.id })
      .from(schema.exercises)
      .where(eq(schema.exercises.canonicalId, "incline_dumbbell_press"));
    const id = rows[0]!.id;

    await upsertProgrammingProfile(db, id, "intermediate", DISABLED_PROFILE_INPUT);

    const [candidate] = await getExerciseCandidates(db, {
      sessionLabel: "push",
      experienceLevel: "intermediate",
      equipment: ["dumbbells"],
    });
    expect(candidate?.programmingProfile.traineeLevel).toBe("beginner");
  });

  it("excludes an exercise entirely when every level's profile is disabled", async () => {
    const rows = await db
      .select({ id: schema.exercises.id })
      .from(schema.exercises)
      .where(eq(schema.exercises.canonicalId, "incline_dumbbell_press"));
    const id = rows[0]!.id;

    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      await upsertProgrammingProfile(db, id, level, DISABLED_PROFILE_INPUT);
    }

    const candidates = await getExerciseCandidates(db, {
      sessionLabel: "push",
      experienceLevel: "intermediate",
      equipment: ["dumbbells"],
    });
    expect(candidates.some((c) => c.canonicalId === "incline_dumbbell_press")).toBe(false);
  });
});
