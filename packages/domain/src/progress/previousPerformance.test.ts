import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { createLocation } from "./locations";
import { finishSession, getInProgressSession, logSet, type LogSetInput } from "./sessions";
import { seedWorkout } from "./testFixtures";
import {
  getObservedLoadsKg,
  getPreviousPerformance,
  getProgressionTargetForExercise,
  getRecentSessionPerformance,
  hasHistoryInOtherContext,
} from "./previousPerformance";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESCRIPTION = { sets: 3, repMin: 12, repMax: 15, rirMin: 1, rirMax: 3 };
const NO_PLACE = { locationId: null };

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
      allowedSessionRoles: ["accessory"],
    });
    exerciseId = exercise!.id;
    workoutId = await seedWorkout(db, userId, [exerciseId], PRESCRIPTION);
  });

  afterEach(() => close());

  const set = (setNumber: number, extra: Partial<LogSetInput> = {}): LogSetInput => ({
    workoutId,
    exerciseId,
    locationId: null,
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
    expect(await getPreviousPerformance(db, userId, exerciseId, NO_PLACE)).toBeNull();
    expect((await getRecentSessionPerformance(db, userId, exerciseId, NO_PLACE)).sets).toEqual([]);
  });

  it("never treats the session in progress as its own previous session", async () => {
    await logSet(db, userId, set(1, { painFlag: true }));
    const open = (await getInProgressSession(db, userId, workoutId))!;
    const context = { locationId: null, excludeSessionId: open.id };

    expect((await getRecentSessionPerformance(db, userId, exerciseId, context)).sets).toEqual([]);
    const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION, context);
    expect(target.reason).toBe("NO_LOAD_HISTORY");
  });

  it("returns every set of the most recent other occurrence, ordered by set number", async () => {
    await performSession([set(1, { reps: 15 }), set(2, { reps: 14 }), set(3, { reps: 12 })], 3);
    const recent = await getRecentSessionPerformance(db, userId, exerciseId, NO_PLACE);
    expect(recent.sets.map((s) => s.reps)).toEqual([15, 14, 12]);
    expect(await getPreviousPerformance(db, userId, exerciseId, NO_PLACE)).toMatchObject({ loadKg: 7.5, reps: 12 });
  });

  it("returns the prescription that occurrence was performed under", async () => {
    await performSession([set(1)], 2);
    const { prescription } = await getRecentSessionPerformance(db, userId, exerciseId, NO_PLACE);
    expect(prescription).toEqual({ sets: 3, repMin: 12, repMax: 15, rirMin: 1, rirMax: 3 });
  });

  it("reports an unknown prescription for legacy history", async () => {
    const id = await performSession([set(1)], 2);
    await db.update(schema.workoutSessions).set({ sessionLabel: "legacy" }).where(eq(schema.workoutSessions.id, id));
    expect((await getRecentSessionPerformance(db, userId, exerciseId, NO_PLACE)).prescription).toBeNull();
  });

  it("keeps two same-day occurrences separate instead of merging them", async () => {
    await performSession([set(1, { loadKg: 5, reps: 12 })], 0.2);
    await performSession([set(1, { loadKg: 7.5, reps: 15 }), set(2, { loadKg: 7.5, reps: 15 })], 0.1);

    const recent = await getRecentSessionPerformance(db, userId, exerciseId, NO_PLACE);
    expect(recent.sets).toHaveLength(2);
    expect(recent.sets.every((s) => s.loadKg === 7.5)).toBe(true);
  });

  it("keeps one occurrence whole when it spans midnight UTC", async () => {
    await logSet(db, userId, set(1));
    await logSet(db, userId, set(2));
    const [first, second] = await db.select().from(schema.exerciseLogs).orderBy(schema.exerciseLogs.setNumber);
    await db.update(schema.exerciseLogs).set({ completedAt: new Date("2026-03-01T23:55:00Z") }).where(eq(schema.exerciseLogs.id, first!.id));
    await db.update(schema.exerciseLogs).set({ completedAt: new Date("2026-03-02T00:05:00Z") }).where(eq(schema.exerciseLogs.id, second!.id));
    const open = (await getInProgressSession(db, userId, workoutId))!;
    await finishSession(db, userId, open.id);

    expect((await getRecentSessionPerformance(db, userId, exerciseId, NO_PLACE)).sets).toHaveLength(2);
  });

  it("persists optional pain/technique flags and the actual RIR", async () => {
    await performSession([set(1, { rir: 1, painFlag: true, techniqueValid: false })], 1);
    const [recent] = (await getRecentSessionPerformance(db, userId, exerciseId, NO_PLACE)).sets;
    expect(recent).toMatchObject({ rir: 1, painFlag: true, techniqueValid: false });
  });

  it("computes a progression target from the previous occurrence", async () => {
    await performSession([set(1, { reps: 13 }), set(2, { reps: 13 }), set(3, { reps: 13 })], 2);
    const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION, NO_PLACE);
    expect(target).toMatchObject({ reason: "CONTINUE_REP_PROGRESSION", targetLoadKg: 7.5, targetRepMin: 14 });
  });

  it("returns a no-history target (no invented kg) when nothing has been logged", async () => {
    const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION, NO_PLACE);
    expect(target).toMatchObject({ reason: "NO_LOAD_HISTORY", targetLoadKg: null, targetRepMin: 12, targetRepMax: 15 });
  });

  it("doesn't carry a load across a changed prescription", async () => {
    await performSession([set(1), set(2), set(3)], 2);
    const target = await getProgressionTargetForExercise(
      db,
      userId,
      exerciseId,
      { sets: 3, repMin: 6, repMax: 10, rirMin: 1, rirMax: 3 },
      NO_PLACE,
    );
    expect(target).toMatchObject({ reason: "CONTEXT_CHANGED", targetLoadKg: null, targetRepMin: 6, targetRepMax: 10 });
  });

  describe("increment inferred from logged history", () => {
    const ceiling = (loadKg: number) => [1, 2, 3].map((n) => set(n, { loadKg, reps: 15, rir: 2 }));

    it("requests the smallest available increment (null kg) when only one load has ever been used", async () => {
      await performSession(ceiling(7.5), 1);
      const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION, NO_PLACE);
      expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null });
      expect(target.loadInstruction).toBeTruthy();
    });

    it("uses the step observed between earlier occurrences", async () => {
      await performSession([set(1, { loadKg: 5, reps: 12 })], 3);
      await performSession(ceiling(7.5), 1);

      expect((await getObservedLoadsKg(db, userId, exerciseId, NO_PLACE)).sort()).toEqual([5, 7.5]);
      const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION, NO_PLACE);
      expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 10, loadInstruction: null });
    });
  });

  describe("equipment context (training location)", () => {
    let home: string;
    let gym: string;

    beforeEach(async () => {
      // The first location adopts existing unassigned sessions; none exist yet here.
      home = (await createLocation(db, userId, "Home")).id;
      gym = (await createLocation(db, userId, "Gym")).id;
    });

    const at = (locationId: string | null, setNumber: number, extra: Partial<LogSetInput> = {}) =>
      set(setNumber, { locationId, ...extra });
    const ceilingAt = (locationId: string | null, loadKg: number) =>
      [1, 2, 3].map((n) => at(locationId, n, { loadKg, reps: 15, rir: 2 }));

    it("keeps the same exercise's history separate per location", async () => {
      await performSession([at(home, 1, { loadKg: 10 })], 2);

      expect((await getRecentSessionPerformance(db, userId, exerciseId, { locationId: home })).sets).toHaveLength(1);
      expect((await getRecentSessionPerformance(db, userId, exerciseId, { locationId: gym })).sets).toEqual([]);
      expect(await getPreviousPerformance(db, userId, exerciseId, { locationId: gym })).toBeNull();
    });

    it("never leaks observed loads (and so inferred increments) across locations", async () => {
      await performSession([at(home, 1, { loadKg: 5 })], 4);
      await performSession(ceilingAt(home, 7.5), 3);
      await performSession(ceilingAt(gym, 20), 1);

      expect((await getObservedLoadsKg(db, userId, exerciseId, { locationId: gym })).sort()).toEqual([20]);
      // Gym has one load only, so the step is unknown there even though Home has a 2.5 kg step.
      const gymTarget = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION, { locationId: gym });
      expect(gymTarget).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null });

      const homeTarget = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION, { locationId: home });
      expect(homeTarget).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 10 });
    });

    it("tells apart 'never done' from 'done in another location'", async () => {
      await performSession([at(home, 1)], 2);

      expect(await hasHistoryInOtherContext(db, userId, exerciseId, gym)).toBe(true);
      expect(await hasHistoryInOtherContext(db, userId, exerciseId, home)).toBe(false);

      const target = await getProgressionTargetForExercise(db, userId, exerciseId, PRESCRIPTION, { locationId: gym });
      expect(target).toMatchObject({ reason: "CONTEXT_CHANGED", targetLoadKg: null });
    });

    it("treats the unspecified context as its own bucket, not a wildcard", async () => {
      await performSession([at(null, 1, { loadKg: 12 })], 2);

      expect((await getRecentSessionPerformance(db, userId, exerciseId, { locationId: null })).sets).toHaveLength(1);
      expect((await getRecentSessionPerformance(db, userId, exerciseId, { locationId: home })).sets).toEqual([]);
      expect(await hasHistoryInOtherContext(db, userId, exerciseId, home)).toBe(true);
      expect(await hasHistoryInOtherContext(db, userId, exerciseId, null)).toBe(false);
    });
  });
});
