import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { upsertProgrammingProfile } from "../exercises/programmingProfiles";
import { generateStrategyAndNutrition } from "../nutrition/generateStrategy";
import { generateProgram } from "../programs/generateProgram";
import { DEFAULT_ROLE_RULES } from "../training/roleRules";
import { saveRoleRules } from "../training/roleRulesStore";
import type { CreateExerciseInput } from "../exercises/schemas";
import { createLocation } from "./locations";
import { getProgressionTargetForExercise } from "./previousPerformance";
import { finishSession, getInProgressSession, logSet } from "./sessions";

/**
 * The spec's core loop (mogd_programming_engine_specs 05: PROGRAM -> PERFORM -> LOG ->
 * EVALUATE -> ADAPT -> PROGRAM) walked end to end against a real migrated database:
 * admin configuration -> generated, validated program -> execution and logging ->
 * next-session recommendation, including the Cable Lateral Raise canonical case.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

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

describe("the programming loop, end to end", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
  });

  afterEach(() => close());

  async function seedAthlete() {
    const [user] = await db.insert(schema.users).values({ email: "athlete@example.com" }).returning({ id: schema.users.id });
    const userId = user!.id;
    await db.insert(schema.physiqueGoals).values({ userId, primaryGoal: "recomposition", physiquePriorities: ["shoulders"] });
    await db.insert(schema.bodyMeasurements).values({ userId, sex: "male", age: 30, heightCm: 180, weightKg: 80, waistCm: 85 });
    await db.insert(schema.trainingProfiles).values({
      userId,
      experienceLevel: "intermediate",
      trainingConsistency: "consistent",
      currentActivityLevel: "moderately_active",
      sessionsPerWeek: 2,
      sessionDurationMinutes: 60,
      trainingContext: ["gym"],
      equipment: ["dumbbells", "pull_up_bar"],
    });
    return userId;
  }

  /** The workout slot of the current program that contains this exercise, with its generated prescription. */
  async function slotFor(userId: string, exerciseId: string) {
    const [program] = await db.select().from(schema.programs).where(eq(schema.programs.userId, userId));
    const workouts = await db.select().from(schema.workouts).where(eq(schema.workouts.programId, program!.id));
    for (const workout of workouts) {
      const [row] = await db
        .select()
        .from(schema.workoutExercises)
        .where(and(eq(schema.workoutExercises.workoutId, workout.id), eq(schema.workoutExercises.exerciseId, exerciseId)));
      if (row) return { workoutId: workout.id, prescription: row };
    }
    throw new Error("exercise not in any workout");
  }

  const nextTarget = (userId: string, exerciseId: string, p: { sets: number; repMin: number; repMax: number; rirMin: number; rirMax: number }, locationId: string | null) =>
    getProgressionTargetForExercise(db, userId, exerciseId, p, { locationId });

  it("admin config -> generate -> log -> next-session recommendation, across regeneration and equipment", async () => {
    // --- Catalog: everything gets selected (5 exercises, a 5-exercise session), lateral raise is accessory-only.
    const lateralRaise = (await createExercise(db, exercise("cable_lateral_raise", "isolation", ["lateral_deltoids"], {
      allowedSessionRoles: ["accessory", "superset"],
    })))!;
    await createExercise(db, exercise("incline_dumbbell_press", "push", ["upper_chest"], { difficulty: "intermediate" }));
    await createExercise(db, exercise("neutral_grip_lat_pulldown", "pull", ["lats"], { equipment: ["pull_up_bar"] }));
    await createExercise(db, exercise("bulgarian_split_squat", "lunge", ["quadriceps"], { difficulty: "intermediate" }));
    await createExercise(db, exercise("romanian_deadlift", "hinge", ["hamstrings"], { difficulty: "intermediate" }));

    // --- ADMIN: the canonical Cable Lateral Raise profile (3 sets, 12-15 reps, RIR 1-3) and a role-rules revision.
    await upsertProgrammingProfile(db, lateralRaise.id, "intermediate", {
      enabled: true,
      setsMin: 3,
      setsMax: 3,
      repsMin: 12,
      repsMax: 15,
      rirMin: 1,
      rirMax: 3,
      restSecondsMin: 45,
      restSecondsMax: 90,
    });
    const revision = await saveRoleRules(db, null, {
      ...DEFAULT_ROLE_RULES,
      roles: { ...DEFAULT_ROLE_RULES.roles, main: { restMultiplier: 1.5 } },
    }, "slower main lifts");

    // --- PROGRAM: generated and independently validated, recording the rules it was built under.
    const userId = await seedAthlete();
    await generateStrategyAndNutrition(db, userId);
    const generated = await generateProgram(db, userId);
    expect(generated.reasons).toEqual([]);
    expect(generated.success).toBe(true);
    const [program] = await db.select().from(schema.programs).where(eq(schema.programs.userId, userId));
    expect(program!.roleRulesRevisionId).toBe(revision.id);

    let slot = await slotFor(userId, lateralRaise.id);
    expect(slot.prescription).toMatchObject({ sets: 3, repMin: 12, repMax: 15, rirMin: 1, rirMax: 3, sessionRole: "accessory" });
    const prescription = slot.prescription;

    // First exposure: no history -> no invented kg, choose a resistance.
    expect(await nextTarget(userId, lateralRaise.id, prescription, null)).toMatchObject({
      reason: "NO_LOAD_HISTORY",
      targetLoadKg: null,
    });

    /** One full occurrence of the lateral raise at `loadKg`, finished and placed `daysAgo` in the past. */
    async function perform(workoutId: string, loadKg: number, reps: number, daysAgo: number, locationId: string | null = null) {
      for (const setNumber of [1, 2, 3]) {
        await logSet(db, userId, { workoutId, exerciseId: lateralRaise.id, locationId, setNumber, loadKg, reps, rir: 2 });
      }
      // A retried request for a set that already exists must not duplicate it.
      await logSet(db, userId, { workoutId, exerciseId: lateralRaise.id, locationId, setNumber: 2, loadKg, reps, rir: 2 });

      const open = (await getInProgressSession(db, userId, workoutId))!;
      await finishSession(db, userId, open.id);
      const when = new Date(Date.now() - daysAgo * DAY_MS);
      await db.update(schema.workoutSessions).set({ startedAt: when, completedAt: when }).where(eq(schema.workoutSessions.id, open.id));
      return open.id;
    }

    // --- EXECUTE + LOG: 7.5 kg x 15 @ RIR 2, three sets (the spec's canonical history).
    const first = await perform(slot.workoutId, 7.5, 15, 14);
    expect(await db.select().from(schema.exerciseLogs).where(eq(schema.exerciseLogs.exerciseId, lateralRaise.id))).toHaveLength(3);

    // --- EVALUATE: a load increase is requested, but with only one load ever used the step is unknown,
    // so the engine asks for the smallest available increment rather than inventing a number.
    const afterFirst = await nextTarget(userId, lateralRaise.id, prescription, null);
    expect(afterFirst).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null, targetRepMin: 12, targetRepMax: 15 });
    expect(afterFirst.loadInstruction).toBeTruthy();

    // --- The next occurrence snapshots exactly what the athlete was told.
    await logSet(db, userId, { workoutId: slot.workoutId, exerciseId: lateralRaise.id, locationId: null, setNumber: 1, loadKg: 10, reps: 12, rir: 2 });
    const [snapshot] = await db
      .select()
      .from(schema.workoutExercisePerformances)
      .where(and(eq(schema.workoutExercisePerformances.exerciseId, lateralRaise.id), eq(schema.workoutExercisePerformances.recommendationReason, "INCREASE_LOAD")));
    expect(snapshot).toMatchObject({ recommendedLoadKg: null, sets: 3, repMin: 12, repMax: 15 });
    expect(snapshot!.loadInstruction).toBeTruthy();

    // --- The athlete chose 10 kg; finish that occurrence (two more sets) and the 2.5 kg step is now observed.
    await logSet(db, userId, { workoutId: slot.workoutId, exerciseId: lateralRaise.id, locationId: null, setNumber: 2, loadKg: 10, reps: 12, rir: 2 });
    await logSet(db, userId, { workoutId: slot.workoutId, exerciseId: lateralRaise.id, locationId: null, setNumber: 3, loadKg: 10, reps: 12, rir: 2 });
    const second = (await getInProgressSession(db, userId, slot.workoutId))!;
    await finishSession(db, userId, second.id);
    await db.update(schema.workoutSessions).set({ startedAt: new Date(Date.now() - 7 * DAY_MS) }).where(eq(schema.workoutSessions.id, second.id));

    // Below the rep ceiling at the new load: reps first, load unchanged (double progression).
    expect(await nextTarget(userId, lateralRaise.id, prescription, null)).toMatchObject({
      reason: "CONTINUE_REP_PROGRESSION",
      targetLoadKg: 10,
      targetRepMin: 13,
    });

    // --- ADAPT: reach the ceiling at 10 kg and the real next load, from the observed 2.5 kg step, is named.
    await perform(slot.workoutId, 10, 15, 2);
    expect(await nextTarget(userId, lateralRaise.id, prescription, null)).toMatchObject({
      reason: "INCREASE_LOAD",
      targetLoadKg: 12.5,
      loadInstruction: null,
    });

    // --- PROGRAM again: regenerating keeps every performed occurrence and its snapshot, and the loop continues.
    const performancesBefore = await db.select().from(schema.workoutExercisePerformances);
    expect((await generateProgram(db, userId)).success).toBe(true);
    const performancesAfter = await db.select().from(schema.workoutExercisePerformances);
    expect(performancesAfter).toHaveLength(performancesBefore.length);
    expect(performancesAfter.find((p) => p.workoutSessionId === first)).toMatchObject({ sets: 3, repMin: 12, repMax: 15 });

    slot = await slotFor(userId, lateralRaise.id); // a brand-new workout slot
    expect(await nextTarget(userId, lateralRaise.id, slot.prescription, null)).toMatchObject({
      reason: "INCREASE_LOAD",
      targetLoadKg: 12.5,
    });

    // --- EQUIPMENT: naming a first place adopts the history; a second place shares none of it.
    const home = await createLocation(db, userId, "Home");
    const gym = await createLocation(db, userId, "Gym");
    expect(await nextTarget(userId, lateralRaise.id, slot.prescription, home.id)).toMatchObject({
      reason: "INCREASE_LOAD",
      targetLoadKg: 12.5,
    });
    expect(await nextTarget(userId, lateralRaise.id, slot.prescription, gym.id)).toMatchObject({
      reason: "CONTEXT_CHANGED",
      targetLoadKg: null,
    });
  });
});
