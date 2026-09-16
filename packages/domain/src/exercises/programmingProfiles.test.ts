import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { type Database } from "@mogd/db";
import { createExercise } from "./exerciseCatalog";
import {
  listProgrammingProfiles,
  listProgrammingProfilesForExercises,
  resolveApplicableProfile,
  upsertProgrammingProfile,
  upsertProgrammingProfileInput,
} from "./programmingProfiles";
import { ExerciseNotFoundError } from "./relationships";
import type { ProgrammingProfile } from "./programmingProfiles";

const VALID_PROFILE_INPUT = {
  enabled: true,
  setsMin: 3,
  setsMax: 4,
  repsMin: 12,
  repsMax: 15,
  rirMin: 1,
  rirMax: 3,
  restSecondsMin: 60,
  restSecondsMax: 90,
};

describe("programmingProfiles", () => {
  let db: Database;
  let close: () => void;
  let exerciseId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const exercise = await createExercise(db, {
      canonicalId: "cable_lateral_raise",
      name: "Cable Lateral Raise",
      movementPattern: "isolation",
      difficulty: "beginner",
      primaryMuscles: ["lateral_deltoids"],
      secondaryMuscles: [],
      equipment: ["cables"],
      contraindicationTags: [],
      isActive: true,
      allowedSessionRoles: [],
    });
    exerciseId = exercise!.id;
  });

  afterEach(() => close());

  it("seeds three identical, inherited-default profiles when an exercise is created", async () => {
    const profiles = await listProgrammingProfiles(db, exerciseId);
    expect(profiles).toHaveLength(3);
    expect(profiles.map((p) => p.traineeLevel)).toEqual(["beginner", "intermediate", "advanced"]);
    expect(profiles.every((p) => p.isInheritedDefault)).toBe(true);
  });

  it("updates the existing row for a level and clears isInheritedDefault", async () => {
    const updated = await upsertProgrammingProfile(db, exerciseId, "intermediate", VALID_PROFILE_INPUT);
    expect(updated).toMatchObject({ ...VALID_PROFILE_INPUT, isInheritedDefault: false });

    const profiles = await listProgrammingProfiles(db, exerciseId);
    expect(profiles).toHaveLength(3); // upsert, not a duplicate insert
    const intermediate = profiles.find((p) => p.traineeLevel === "intermediate");
    expect(intermediate).toMatchObject({ setsMin: 3, setsMax: 4, isInheritedDefault: false });
  });

  it("rejects setsMin greater than setsMax", () => {
    expect(() => upsertProgrammingProfileInput.parse({ ...VALID_PROFILE_INPUT, setsMin: 5, setsMax: 4 })).toThrow();
  });

  it("rejects repsMin greater than repsMax", () => {
    expect(() => upsertProgrammingProfileInput.parse({ ...VALID_PROFILE_INPUT, repsMin: 20, repsMax: 15 })).toThrow();
  });

  it("rejects rirMin greater than rirMax", () => {
    expect(() => upsertProgrammingProfileInput.parse({ ...VALID_PROFILE_INPUT, rirMin: 4, rirMax: 3 })).toThrow();
  });

  it("rejects restSecondsMin greater than restSecondsMax", () => {
    expect(() =>
      upsertProgrammingProfileInput.parse({ ...VALID_PROFILE_INPUT, restSecondsMin: 120, restSecondsMax: 90 }),
    ).toThrow();
  });

  it("throws ExerciseNotFoundError for an unknown exercise", async () => {
    await expect(upsertProgrammingProfile(db, "does-not-exist", "beginner", VALID_PROFILE_INPUT)).rejects.toThrow(
      ExerciseNotFoundError,
    );
  });

  it("batches profile lookups for multiple exercises with listProgrammingProfilesForExercises", async () => {
    const other = await createExercise(db, {
      canonicalId: "romanian_deadlift",
      name: "Romanian Deadlift",
      movementPattern: "hinge",
      difficulty: "intermediate",
      primaryMuscles: ["hamstrings"],
      secondaryMuscles: [],
      equipment: [],
      contraindicationTags: [],
      isActive: true,
      allowedSessionRoles: [],
    });

    const byExercise = await listProgrammingProfilesForExercises(db, [exerciseId, other!.id]);
    expect(byExercise.get(exerciseId)).toHaveLength(3);
    expect(byExercise.get(other!.id)).toHaveLength(3);
  });
});

describe("resolveApplicableProfile", () => {
  let counter = 0;
  function profile(overrides: Partial<ProgrammingProfile>): ProgrammingProfile {
    counter += 1;
    return {
      id: `profile-${counter}`,
      exerciseId: "exercise-1",
      traineeLevel: "intermediate",
      enabled: true,
      isInheritedDefault: false,
      setsMin: 2,
      setsMax: 4,
      repsMin: 6,
      repsMax: 10,
      rirMin: 1,
      rirMax: 3,
      restSecondsMin: 75,
      restSecondsMax: 120,
      prescriptionType: "rir",
      progressionType: "double_progression",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("returns the exact-level profile when enabled", () => {
    const profiles = [profile({ traineeLevel: "beginner" }), profile({ traineeLevel: "advanced" })];
    const resolved = resolveApplicableProfile(profiles, "beginner");
    expect(resolved?.traineeLevel).toBe("beginner");
  });

  it("falls back to the nearest lower enabled level when the exact level is disabled", () => {
    const profiles = [
      profile({ traineeLevel: "beginner" }),
      profile({ traineeLevel: "advanced", enabled: false }),
    ];
    const resolved = resolveApplicableProfile(profiles, "advanced");
    expect(resolved?.traineeLevel).toBe("beginner");
  });

  it("falls back to the nearest higher enabled level when no lower level is available", () => {
    const profiles = [profile({ traineeLevel: "advanced" }), profile({ traineeLevel: "beginner", enabled: false })];
    const resolved = resolveApplicableProfile(profiles, "beginner");
    expect(resolved?.traineeLevel).toBe("advanced");
  });

  it("prefers the lower level on an equidistant tie for intermediate", () => {
    const profiles = [profile({ traineeLevel: "beginner" }), profile({ traineeLevel: "advanced" })];
    const resolved = resolveApplicableProfile(profiles, "intermediate");
    expect(resolved?.traineeLevel).toBe("beginner");
  });

  it("returns null when nothing is enabled at any level", () => {
    const profiles = [
      profile({ traineeLevel: "beginner", enabled: false }),
      profile({ traineeLevel: "intermediate", enabled: false }),
      profile({ traineeLevel: "advanced", enabled: false }),
    ];
    expect(resolveApplicableProfile(profiles, "intermediate")).toBeNull();
  });

  it("returns null for an exercise with no profiles at all", () => {
    expect(resolveApplicableProfile([], "beginner")).toBeNull();
  });
});
