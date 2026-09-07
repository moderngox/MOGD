import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { validateProgram, type ProgramPlan } from "./validator";

describe("validateProgram", () => {
  let db: Database;
  let close: () => void;
  let exerciseId: string;
  let canonicalId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

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
    canonicalId = exercise!.canonicalId;
  });

  afterEach(() => close());

  function basePlan(overrides: Partial<ProgramPlan> = {}): ProgramPlan {
    return {
      sessionsPerWeek: 1,
      // 3 sets * MINUTES_PER_SET(4) = 12min estimated; keep the target
      // close to that so the well-formed base plan sits inside the
      // duration tolerance band by default.
      sessionDurationMinutes: 15,
      equipment: ["dumbbells"],
      workouts: [
        {
          dayIndex: 0,
          sessionLabel: "push",
          exercises: [
            {
              exerciseId,
              canonicalId,
              orderIndex: 0,
              sets: 3,
              repMin: 8,
              repMax: 12,
              rir: 2,
              restSeconds: 90,
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("accepts a well-formed plan", async () => {
    const result = await validateProgram(db, basePlan());
    expect(result).toEqual({ valid: true, reasons: [] });
  });

  it("rejects when the workout count doesn't match sessionsPerWeek", async () => {
    const result = await validateProgram(db, basePlan({ sessionsPerWeek: 3 }));
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("sessions but"))).toBe(true);
  });

  it("rejects an exercise that doesn't resolve to an active canonical record", async () => {
    const plan = basePlan();
    plan.workouts[0]!.exercises[0]!.canonicalId = "does_not_exist";
    const result = await validateProgram(db, plan);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("does not resolve"))).toBe(true);
  });

  it("rejects when required equipment isn't in the user's equipment list", async () => {
    const plan = basePlan({ equipment: ["barbell"] });
    const result = await validateProgram(db, plan);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("equipment"))).toBe(true);
  });

  it("rejects a session with zero exercises", async () => {
    const plan = basePlan();
    plan.workouts[0]!.exercises = [];
    const result = await validateProgram(db, plan);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("no exercises"))).toBe(true);
  });

  it("rejects a session whose estimated duration wildly exceeds the target", async () => {
    // 5 sets * MINUTES_PER_SET(4) = 20min estimated vs. a 10min target
    // (ceiling 11.5min) — well over tolerance.
    const plan = basePlan({ sessionDurationMinutes: 10 });
    plan.workouts[0]!.exercises[0]!.sets = 5;
    const result = await validateProgram(db, plan);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("min tolerance"))).toBe(true);
  });

  it("rejects sets outside the configured bounds", async () => {
    const plan = basePlan();
    plan.workouts[0]!.exercises[0]!.sets = 10;
    const result = await validateProgram(db, plan);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("bounds"))).toBe(true);
  });
});
