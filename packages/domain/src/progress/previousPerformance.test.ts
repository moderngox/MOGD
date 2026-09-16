import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { eq } from "drizzle-orm";
import { createExercise } from "../exercises/exerciseCatalog";
import { logWorkoutSet } from "./logSet";
import { getPreviousPerformance, getProgressionTargetForExercise, getRecentSessionPerformance } from "./previousPerformance";

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
      allowedSessionRoles: [],
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
    await logWorkoutSet(db, userId, { exerciseId, setNumber: 1, loadKg: 30, reps: 10, rir: 2 });

    const target = await getProgressionTargetForExercise(db, userId, exerciseId, {
      sets: 1,
      repMin: 8,
      repMax: 12,
      rirMin: 1,
      rirMax: 3,
    });
    expect(target).toMatchObject({ targetLoadKg: 30, targetRepMin: 11, targetRepMax: 12 });
  });

  it("returns a no-prior-data target when nothing has been logged yet", async () => {
    const target = await getProgressionTargetForExercise(db, userId, exerciseId, {
      sets: 1,
      repMin: 8,
      repMax: 12,
      rirMin: 1,
      rirMax: 3,
    });
    expect(target.targetLoadKg).toBeNull();
    expect(target).toMatchObject({ targetRepMin: 8, targetRepMax: 12 });
  });

  it("rejects an out-of-bounds logSet input", async () => {
    await expect(
      logWorkoutSet(db, userId, { exerciseId, setNumber: 1, reps: -5 }),
    ).rejects.toThrow();
  });

  it("persists optional pain/technique flags on a logged set", async () => {
    await logWorkoutSet(db, userId, {
      exerciseId,
      setNumber: 1,
      loadKg: 30,
      reps: 10,
      painFlag: true,
      techniqueValid: false,
    });

    const [recent] = await getRecentSessionPerformance(db, userId, exerciseId);
    expect(recent).toMatchObject({ painFlag: true, techniqueValid: false });
  });

  it("groups getRecentSessionPerformance by the most recent calendar day only", async () => {
    await logWorkoutSet(db, userId, { exerciseId, setNumber: 1, loadKg: 30, reps: 10 });
    // Backdate this set's completedAt to yesterday so it falls outside the
    // most-recent-day grouping below.
    const [yesterdayLog] = await db.select().from(schema.exerciseLogs).where(eq(schema.exerciseLogs.userId, userId));
    const yesterday = new Date(yesterdayLog!.completedAt.getTime() - 24 * 60 * 60 * 1000);
    await db.update(schema.exerciseLogs).set({ completedAt: yesterday }).where(eq(schema.exerciseLogs.id, yesterdayLog!.id));

    await logWorkoutSet(db, userId, { exerciseId, setNumber: 1, loadKg: 32.5, reps: 9 });
    await logWorkoutSet(db, userId, { exerciseId, setNumber: 2, loadKg: 32.5, reps: 8 });

    const recent = await getRecentSessionPerformance(db, userId, exerciseId);
    expect(recent).toHaveLength(2);
    expect(recent.every((s) => s.loadKg === 32.5)).toBe(true);
  });
});
