import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { logWorkoutSet } from "./logSet";
import { getPreviousPerformance, getProgressionTargetForExercise } from "./previousPerformance";

describe("progress logging and previous performance", () => {
  let db: Database;
  let close: () => void;
  let userId: string;
  let exerciseId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const [user] = await db
      .insert(schema.users)
      .values({ email: "logger@example.com" })
      .returning({ id: schema.users.id });
    userId = user!.id;

    const exercise = await createExercise(db, {
      canonicalId: "incline_dumbbell_press",
      name: "Incline Dumbbell Press",
      movementPattern: "push",
      difficulty: "intermediate",
      primaryMuscles: ["upper_chest"],
      secondaryMuscles: [],
      equipment: ["dumbbells"],
      contraindicationTags: [],
      isActive: true,
    });
    exerciseId = exercise!.id;
  });

  afterEach(() => close());

  it("returns null previous performance before any set is logged", async () => {
    expect(await getPreviousPerformance(db, userId, exerciseId)).toBeNull();
  });

  it("persists a logged set and returns it as previous performance", async () => {
    await logWorkoutSet(db, userId, { exerciseId, setNumber: 1, loadKg: 30, reps: 10 });

    const previous = await getPreviousPerformance(db, userId, exerciseId);
    expect(previous).toMatchObject({ loadKg: 30, reps: 10 });
  });

  it("returns the most recently logged set when multiple exist", async () => {
    await logWorkoutSet(db, userId, { exerciseId, setNumber: 1, loadKg: 30, reps: 10 });
    await new Promise((r) => setTimeout(r, 5));
    await logWorkoutSet(db, userId, { exerciseId, setNumber: 2, loadKg: 32.5, reps: 8 });

    const previous = await getPreviousPerformance(db, userId, exerciseId);
    expect(previous).toMatchObject({ loadKg: 32.5, reps: 8 });
  });

  it("computes a progression target from the previous logged set", async () => {
    await logWorkoutSet(db, userId, { exerciseId, setNumber: 1, loadKg: 30, reps: 10 });

    const target = await getProgressionTargetForExercise(db, userId, exerciseId, 8, 12);
    expect(target).toMatchObject({ targetLoadKg: 30, targetRepMin: 11, targetRepMax: 12 });
  });

  it("returns a no-prior-data target when nothing has been logged yet", async () => {
    const target = await getProgressionTargetForExercise(db, userId, exerciseId, 8, 12);
    expect(target.targetLoadKg).toBeNull();
    expect(target).toMatchObject({ targetRepMin: 8, targetRepMax: 12 });
  });

  it("rejects an out-of-bounds logSet input", async () => {
    await expect(
      logWorkoutSet(db, userId, { exerciseId, setNumber: 1, reps: -5 }),
    ).rejects.toThrow();
  });
});
