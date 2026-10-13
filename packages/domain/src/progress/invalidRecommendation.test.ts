import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { InvalidRecommendationError } from "../training/progressionValidation";
import { getProgressionTargetForExercise } from "./previousPerformance";
import { getOrStartPerformance, logSet } from "./sessions";
import { seedWorkout } from "./testFixtures";

// The engine is stubbed to emit an invented kg, to prove the independent validator stands between it and persistence.
vi.mock("../training/progression", async (importOriginal) => {
  const original = await importOriginal<typeof import("../training/progression")>();
  return {
    ...original,
    computeProgressionTarget: vi.fn(() => ({
      targetLoadKg: 123.4,
      targetRepMin: 6,
      targetRepMax: 10,
      reason: "INCREASE_LOAD" as const,
      loadInstruction: null,
      message: "made up",
    })),
  };
});

describe("an invalid recommendation never reaches the athlete or the snapshot", () => {
  let db: Database;
  let close: () => void;
  let userId: string;
  let exerciseId: string;
  let workoutId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
    const [user] = await db.insert(schema.users).values({ email: "x@example.com" }).returning({ id: schema.users.id });
    userId = user!.id;
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
      allowedSessionRoles: ["accessory"],
    });
    exerciseId = exercise!.id;
    workoutId = await seedWorkout(db, userId, [exerciseId]);
  });

  afterEach(() => close());

  it("getProgressionTargetForExercise throws instead of returning an invented load", async () => {
    await expect(
      getProgressionTargetForExercise(db, userId, exerciseId, { sets: 3, repMin: 6, repMax: 10, rirMin: 1, rirMax: 3, restSeconds: 60, sessionRole: "accessory" }, { locationId: null }),
    ).rejects.toThrow(InvalidRecommendationError);
  });

  it("starting a performance snapshots nothing when the recommendation is invalid", async () => {
    await expect(getOrStartPerformance(db, userId, workoutId, exerciseId, null)).rejects.toThrow(InvalidRecommendationError);
    expect(await db.select().from(schema.workoutExercisePerformances)).toHaveLength(0);
    await expect(
      logSet(db, userId, { workoutId, exerciseId, locationId: null, setNumber: 1, reps: 10 }),
    ).rejects.toThrow(InvalidRecommendationError);
    expect(await db.select().from(schema.exerciseLogs)).toHaveLength(0);
  });
});
