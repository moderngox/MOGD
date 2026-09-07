import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { type Database } from "@mogd/db";
import {
  createExercise,
  updateExercise,
  setExerciseActive,
  resolveActiveExercise,
  listExercises,
  DuplicateCanonicalIdError,
} from "./exerciseCatalog";
import type { CreateExerciseInput } from "./schemas";

const validInput: CreateExerciseInput = {
  canonicalId: "incline_dumbbell_press",
  name: "Incline Dumbbell Press",
  movementPattern: "push",
  difficulty: "intermediate",
  primaryMuscles: ["upper_chest"],
  secondaryMuscles: ["anterior_deltoids", "triceps"],
  equipment: ["dumbbells"],
  contraindicationTags: [],
  isActive: true,
};

describe("exerciseCatalog", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
  });

  afterEach(() => close());

  it("creates an exercise and resolves it as active", async () => {
    await createExercise(db, validInput);
    const resolved = await resolveActiveExercise(db, "incline_dumbbell_press");
    expect(resolved?.name).toBe("Incline Dumbbell Press");
    expect(resolved?.primaryMuscles).toEqual(["upper_chest"]);
  });

  it("rejects a duplicate canonicalId", async () => {
    await createExercise(db, validInput);
    await expect(createExercise(db, validInput)).rejects.toThrow(DuplicateCanonicalIdError);
  });

  it("does not resolve an inactive exercise", async () => {
    const exercise = await createExercise(db, { ...validInput, isActive: false });
    expect(await resolveActiveExercise(db, exercise!.canonicalId)).toBeNull();
  });

  it("does not resolve a canonicalId that was never created", async () => {
    expect(await resolveActiveExercise(db, "does_not_exist")).toBeNull();
  });

  it("updates metadata without touching canonicalId", async () => {
    const exercise = await createExercise(db, validInput);
    const updated = await updateExercise(db, exercise!.id, {
      ...validInput,
      name: "Incline DB Press",
      difficulty: "beginner",
    });
    expect(updated?.name).toBe("Incline DB Press");
    expect(updated?.difficulty).toBe("beginner");
    expect(updated?.canonicalId).toBe("incline_dumbbell_press");
  });

  it("toggles active status", async () => {
    const exercise = await createExercise(db, validInput);
    const deactivated = await setExerciseActive(db, exercise!.id, false);
    expect(deactivated?.isActive).toBe(false);
    expect(await resolveActiveExercise(db, exercise!.canonicalId)).toBeNull();
  });

  it("lists exercises, optionally filtered to active only", async () => {
    await createExercise(db, validInput);
    await createExercise(db, {
      ...validInput,
      canonicalId: "romanian_deadlift",
      isActive: false,
    });

    expect(await listExercises(db)).toHaveLength(2);
    expect(await listExercises(db, { activeOnly: true })).toHaveLength(1);
  });
});
