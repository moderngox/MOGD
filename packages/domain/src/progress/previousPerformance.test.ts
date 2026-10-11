import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { finishSession, getInProgressSession, logSet, type LogSetInput } from "./sessions";
import { seedWorkout } from "./testFixtures";
import {
  getObservedLoadsKg,
  getPreviousPerformance,
  getProgressionTargetForExercise,
  getRecentSessionPerformance,
} from "./previousPerformance";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESCRIPTION = { sets: 3, repMin: 12, repMax: 15, rirMin: 1, rirMax: 3 };

describe("session-based history", () => {
  let db: Database;
  let close: () => void;
  let userId: string;
  let exerciseId: string;
  let workoutId: string;

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
    workoutId = await seedWorkout(db, userId, [exerciseId], PRESCRIPTION);
  });

  afterEach(() => close());

  const set = (setNumber: number, extra: Partial<LogSetInput> = {}): LogSetInput => ({
    workoutId,
    exerciseId,
    setNumber,
    loadKg: 7.5,
    reps: 15,
    rir: 2,
    ...extra,
  });

  /** Logs sets into one occurrence, finishes it, and backdates it so occurrences order deterministically. */
  async function performSession(sets: LogSetInput[], daysAgo: number) {
    for (const s of sets) await logSet(db, userId, s);
    const open = (await getInProgressSession(db, userId, workoutId))!;
    await finishSession(db, userId, open.id);
    const when = new Date(Date.now() - daysAgo * DAY_MS);
    await db
      .update(schema.workoutSessions)
      .set({ startedAt: when, completedAt: when })
      .where(eq(schema.workoutSessions.id, open.id));
    return open.id;
  }

  it("has no previous performance before any set is logged", async () => {
    expect(await getPreviousPerformance(db, userId, exerciseId)).toBeNull();
    expect(await getRecentSessionPerformance(db, userId, exerciseId)).toEqual([]);
  });

  it("never treats the session in progress as its own previous session", async () => {
    await logSet(db, userId, set(1, { painFlag: true }));
    const open = (await getInProgressSession(db, userId, workoutId))!;

    expect(await getRecentSessionPerformance(db, userId, exerciseId, { excludeSessionId: open.id })).toEqual([]);

    const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION, {
      excludeSessionId: open.id,
    });
    expect(target.reason).toBe("NO_LOAD_HISTORY");
  });

  it("returns every set of the most recent other occurrence, ordered by set number", async () => {
    await performSession([set(1, { reps: 15 }), set(2, { reps: 14 }), set(3, { reps: 12 })], 3);
    const recent = await getRecentSessionPerformance(db, userId, exerciseId);
    expect(recent.map((s) => s.reps)).toEqual([15, 14, 12]);
    expect(await getPreviousPerformance(db, userId, exerciseId)).toMatchObject({ loadKg: 7.5, reps: 12 });
  });

  it("keeps two same-day occurrences separate instead of merging them", async () => {
    await performSession([set(1, { loadKg: 5, reps: 12 })], 0.2);
    await performSession([set(1, { loadKg: 7.5, reps: 15 }), set(2, { loadKg: 7.5, reps: 15 })], 0.1);

    const recent = await getRecentSessionPerformance(db, userId, exerciseId);
    expect(recent).toHaveLength(2);
    expect(recent.every((s) => s.loadKg === 7.5)).toBe(true);
  });

  it("keeps one occurrence whole when it spans midnight UTC", async () => {
    await logSet(db, userId, set(1));
    await logSet(db, userId, set(2));
    const [first, second] = await db.select().from(schema.exerciseLogs).orderBy(schema.exerciseLogs.setNumber);
    await db.update(schema.exerciseLogs).set({ completedAt: new Date("2026-03-01T23:55:00Z") }).where(eq(schema.exerciseLogs.id, first!.id));
    await db.update(schema.exerciseLogs).set({ completedAt: new Date("2026-03-02T00:05:00Z") }).where(eq(schema.exerciseLogs.id, second!.id));
    const open = (await getInProgressSession(db, userId, workoutId))!;
    await finishSession(db, userId, open.id);

    expect(await getRecentSessionPerformance(db, userId, exerciseId)).toHaveLength(2);
  });

  it("persists optional pain/technique flags and the actual RIR", async () => {
    await performSession([set(1, { rir: 1, painFlag: true, techniqueValid: false })], 1);
    const [recent] = await getRecentSessionPerformance(db, userId, exerciseId);
    expect(recent).toMatchObject({ rir: 1, painFlag: true, techniqueValid: false });
  });

  it("computes a progression target from the previous occurrence", async () => {
    await performSession([set(1, { reps: 13 }), set(2, { reps: 13 }), set(3, { reps: 13 })], 2);
    const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION);
    expect(target).toMatchObject({ reason: "CONTINUE_REP_PROGRESSION", targetLoadKg: 7.5, targetRepMin: 14 });
  });

  it("returns a no-history target (no invented kg) when nothing has been logged", async () => {
    const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION);
    expect(target).toMatchObject({ reason: "NO_LOAD_HISTORY", targetLoadKg: null, targetRepMin: 12, targetRepMax: 15 });
  });

  describe("increment inferred from logged history", () => {
    const ceiling = (loadKg: number) => [1, 2, 3].map((n) => set(n, { loadKg, reps: 15, rir: 2 }));

    it("requests the smallest available increment (null kg) when only one load has ever been used", async () => {
      await performSession(ceiling(7.5), 1);
      const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION);
      expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null });
      expect(target.loadInstruction).toBeTruthy();
    });

    it("uses the step observed between earlier occurrences", async () => {
      await performSession([set(1, { loadKg: 5, reps: 12 })], 3);
      await performSession(ceiling(7.5), 1);

      expect((await getObservedLoadsKg(db, userId, exerciseId)).sort()).toEqual([5, 7.5]);
      const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION);
      expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 10, loadInstruction: null });
    });
  });
});
