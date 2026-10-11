import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { createLocation, LocationNotFoundError } from "./locations";
import {
  correctSet,
  deleteLastSet,
  ExerciseNotInWorkoutError,
  finishSession,
  getInProgressSession,
  getOrStartPerformance,
  getSessionSummary,
  InvalidSetNumberError,
  logSet,
  SessionLocationMismatchError,
  SessionNotFoundError,
  SetNotFoundError,
  WorkoutNotOwnedError,
  type LogSetInput,
} from "./sessions";
import { seedWorkout } from "./testFixtures";

describe("workout sessions", () => {
  let db: Database;
  let close: () => void;
  let userId: string;
  let otherUserId: string;
  let exerciseId: string;
  let workoutId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const users = await db
      .insert(schema.users)
      .values([{ email: "a@example.com" }, { email: "b@example.com" }])
      .returning({ id: schema.users.id });
    userId = users[0]!.id;
    otherUserId = users[1]!.id;

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
    workoutId = await seedWorkout(db, userId, [exerciseId]); // 3 x 12-15, RIR 1-3
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

  const allLogs = () => db.select().from(schema.exerciseLogs);

  it("resumes the same occurrence instead of starting another", async () => {
    await logSet(db, userId, set(1));
    await logSet(db, userId, set(2));
    const again = await getOrStartPerformance(db, userId, workoutId, exerciseId, null);

    expect(await db.select().from(schema.workoutSessions)).toHaveLength(1);
    expect(await db.select().from(schema.workoutExercisePerformances)).toHaveLength(1);
    expect(again.session.status).toBe("in_progress");
    expect((await getInProgressSession(db, userId, workoutId))?.id).toBe(again.session.id);
  });

  it("enforces one in-progress occurrence per slot at the database level", async () => {
    await logSet(db, userId, set(1));
    await expect(
      db.insert(schema.workoutSessions).values({ userId, workoutId, sessionLabel: "full_body" }),
    ).rejects.toThrow();
  });

  it("snapshots the prescription and recommendation once and never rewrites them", async () => {
    await logSet(db, userId, set(1));
    const [before] = await db.select().from(schema.workoutExercisePerformances);
    expect(before).toMatchObject({
      sets: 3,
      repMin: 12,
      repMax: 15,
      rirMin: 1,
      rirMax: 3,
      recommendationReason: "NO_LOAD_HISTORY",
      recommendedLoadKg: null,
    });

    await db.update(schema.workoutExercises).set({ repMax: 20, sets: 5 }).where(eq(schema.workoutExercises.workoutId, workoutId));
    await logSet(db, userId, set(2));

    const [after] = await db.select().from(schema.workoutExercisePerformances);
    expect(after).toMatchObject({ sets: 3, repMax: 15 });
  });

  it("stores the individualized recommendation the athlete was shown", async () => {
    for (const n of [1, 2, 3]) await logSet(db, userId, set(n));
    const first = (await getInProgressSession(db, userId, workoutId))!;
    await finishSession(db, userId, first.id);
    await db.update(schema.workoutSessions).set({ startedAt: new Date(Date.now() - 86_400_000) }).where(eq(schema.workoutSessions.id, first.id));

    await logSet(db, userId, set(1)); // next occurrence: history is a clean ceiling session at one load
    const performances = await db.select().from(schema.workoutExercisePerformances);
    const latest = performances.find((p) => p.workoutSessionId !== first.id)!;
    expect(latest).toMatchObject({ recommendationReason: "INCREASE_LOAD", recommendedLoadKg: null });
    expect(latest.loadInstruction).toBeTruthy();
  });

  it("copies the superset group onto the performance snapshot", async () => {
    await db.update(schema.workoutExercises).set({ supersetGroupId: "pair-1" }).where(eq(schema.workoutExercises.workoutId, workoutId));
    await logSet(db, userId, set(1));
    const [performance] = await db.select().from(schema.workoutExercisePerformances);
    expect(performance!.supersetGroupId).toBe("pair-1");
  });

  it("treats a retried set as a no-op and a changed payload as a correction", async () => {
    await logSet(db, userId, set(1, { reps: 12 }));
    await logSet(db, userId, set(1, { reps: 12 }));
    expect(await allLogs()).toHaveLength(1);

    await logSet(db, userId, set(1, { reps: 14, rir: 1 }));
    const logs = await allLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ reps: 14, rir: 1 });
  });

  it("rejects a set number that would leave a gap", async () => {
    await expect(logSet(db, userId, set(2))).rejects.toThrow(InvalidSetNumberError);
    expect(await allLogs()).toHaveLength(0);
  });

  it("tracks completion as sets are added and the last set is removed", async () => {
    for (const n of [1, 2, 3]) await logSet(db, userId, set(n));
    const [done] = await db.select().from(schema.workoutExercisePerformances);
    expect(done!.completed).toBe(true);

    expect(await deleteLastSet(db, userId, done!.id)).toBe(true);
    const [reopened] = await db.select().from(schema.workoutExercisePerformances);
    expect(reopened!.completed).toBe(false);
    expect((await allLogs()).map((l) => l.setNumber).sort()).toEqual([1, 2]);
  });

  it("returns false when there is no set to delete", async () => {
    const { performance } = await getOrStartPerformance(db, userId, workoutId, exerciseId, null);
    expect(await deleteLastSet(db, userId, performance.id)).toBe(false);
  });

  it("finishes idempotently and still allows corrections afterwards", async () => {
    await logSet(db, userId, set(1, { reps: 10 }));
    const open = (await getInProgressSession(db, userId, workoutId))!;
    const first = await finishSession(db, userId, open.id);
    const second = await finishSession(db, userId, open.id);
    expect(first.status).toBe("completed");
    expect(second.completedAt?.getTime()).toBe(first.completedAt?.getTime());
    expect(await getInProgressSession(db, userId, workoutId)).toBeNull();

    const [logged] = await allLogs();
    const corrected = await correctSet(db, userId, logged!.id, {
      loadKg: 8,
      reps: 11,
      rir: 2,
      painFlag: null,
      techniqueValid: null,
    });
    expect(corrected).toMatchObject({ loadKg: 8, reps: 11 });
  });

  it("starts a fresh occurrence once the previous one is finished", async () => {
    await logSet(db, userId, set(1));
    const first = (await getInProgressSession(db, userId, workoutId))!;
    await finishSession(db, userId, first.id);

    await logSet(db, userId, set(1));
    expect(await db.select().from(schema.workoutSessions)).toHaveLength(2);
    expect((await getInProgressSession(db, userId, workoutId))?.id).not.toBe(first.id);
  });

  it("summarizes a session with its performances and sets", async () => {
    await logSet(db, userId, set(1));
    await logSet(db, userId, set(2));
    const open = (await getInProgressSession(db, userId, workoutId))!;
    const summary = await getSessionSummary(db, userId, open.id);
    expect(summary.performances).toHaveLength(1);
    expect(summary.performances[0]!.loggedSets.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it("rejects another user's workout, session, set and performance", async () => {
    await expect(logSet(db, otherUserId, set(1))).rejects.toThrow(WorkoutNotOwnedError);

    await logSet(db, userId, set(1));
    const open = (await getInProgressSession(db, userId, workoutId))!;
    const [logged] = await allLogs();
    const [performance] = await db.select().from(schema.workoutExercisePerformances);

    await expect(finishSession(db, otherUserId, open.id)).rejects.toThrow(SessionNotFoundError);
    await expect(getSessionSummary(db, otherUserId, open.id)).rejects.toThrow(SessionNotFoundError);
    await expect(deleteLastSet(db, otherUserId, performance!.id)).rejects.toThrow(SessionNotFoundError);
    await expect(
      correctSet(db, otherUserId, logged!.id, { loadKg: 1, reps: 1, rir: null, painFlag: null, techniqueValid: null }),
    ).rejects.toThrow(SetNotFoundError);
  });

  it("rejects an exercise that isn't part of the workout", async () => {
    const other = await createExercise(db, {
      canonicalId: "pull_up",
      name: "Pull-up",
      movementPattern: "pull",
      difficulty: "intermediate",
      primaryMuscles: ["lats"],
      secondaryMuscles: [],
      equipment: ["pull_up_bar"],
      contraindicationTags: [],
      isActive: true,
      allowedSessionRoles: [],
    });
    await expect(logSet(db, userId, set(1, { exerciseId: other!.id }))).rejects.toThrow(ExerciseNotInWorkoutError);
  });

  describe("training location", () => {
    it("fixes the occurrence's location when it starts", async () => {
      const home = await createLocation(db, userId, "Home");
      await logSet(db, userId, set(1, { locationId: home.id }));
      const open = (await getInProgressSession(db, userId, workoutId))!;
      expect(open.trainingLocationId).toBe(home.id);
    });

    it("rejects logging into an open occurrence under a different location", async () => {
      const home = await createLocation(db, userId, "Home");
      const gym = await createLocation(db, userId, "Gym");
      await logSet(db, userId, set(1, { locationId: home.id }));

      await expect(logSet(db, userId, set(2, { locationId: gym.id }))).rejects.toThrow(SessionLocationMismatchError);
      await expect(logSet(db, userId, set(2, { locationId: null }))).rejects.toThrow(SessionLocationMismatchError);
      expect(await allLogs()).toHaveLength(1);
    });

    it("rejects another user's location", async () => {
      const theirs = await createLocation(db, otherUserId, "Their gym");
      await expect(logSet(db, userId, set(1, { locationId: theirs.id }))).rejects.toThrow(LocationNotFoundError);
      expect(await db.select().from(schema.workoutSessions)).toHaveLength(0);
    });
  });
});
