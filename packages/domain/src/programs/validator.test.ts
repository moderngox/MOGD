import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { upsertProgrammingProfile } from "../exercises/programmingProfiles";
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
      allowedSessionRoles: ["main", "accessory"],
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
      experienceLevel: "intermediate",
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
              rirMin: 1,
              rirMax: 3,
              restSeconds: 90,
              sessionRole: "main",
              roleReason: "STRONGEST_MAIN_CANDIDATE",
              supersetGroupIndex: null,
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

  it("rejects an assigned role the exercise isn't eligible for", async () => {
    const plan = basePlan();
    plan.workouts[0]!.exercises[0]!.sessionRole = "finisher";
    const result = await validateProgram(db, plan);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("not eligible"))).toBe(true);
  });

  it("rejects more than one main exercise in a session", async () => {
    const plan = basePlan({ sessionDurationMinutes: 30 });
    const first = plan.workouts[0]!.exercises[0]!;
    plan.workouts[0]!.exercises.push({ ...first, orderIndex: 1 });
    const result = await validateProgram(db, plan);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("main exercises"))).toBe(true);
  });

  it("rejects an exercise with no enabled programming profile for the plan's experience level", async () => {
    const disabled = {
      enabled: false,
      setsMin: 2,
      setsMax: 4,
      repsMin: 6,
      repsMax: 10,
      rirMin: 1,
      rirMax: 3,
      restSecondsMin: 75,
      restSecondsMax: 120,
    } as const;
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      await upsertProgrammingProfile(db, exerciseId, level, disabled);
    }

    const result = await validateProgram(db, basePlan());
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("no enabled programming profile"))).toBe(true);
  });

  describe("superset groups", () => {
    let aId: string;
    let bId: string;

    beforeEach(async () => {
      const make = async (canonicalId: string, muscle: "lateral_deltoids" | "triceps") =>
        (await createExercise(db, {
          canonicalId,
          name: canonicalId,
          movementPattern: "isolation",
          difficulty: "beginner",
          primaryMuscles: [muscle],
          secondaryMuscles: [],
          equipment: ["dumbbells"],
          contraindicationTags: [],
          isActive: true,
          allowedSessionRoles: ["accessory", "superset"],
        }))!;
      aId = (await make("cable_lateral_raise", "lateral_deltoids")).id;
      bId = (await make("triceps_pushdown", "triceps")).id;
    });

    function pairPlan(patch: (members: ProgramPlan["workouts"][0]["exercises"]) => void = () => {}): ProgramPlan {
      const member = (id: string, canonicalId: string, orderIndex: number) => ({
        exerciseId: id,
        canonicalId,
        orderIndex,
        sets: 3,
        repMin: 12,
        repMax: 15,
        rirMin: 1,
        rirMax: 3,
        restSeconds: 45,
        sessionRole: "superset" as const,
        roleReason: "SUPERSET_PAIR" as const,
        supersetGroupIndex: 0,
      });
      const members = [member(aId, "cable_lateral_raise", 0), member(bId, "triceps_pushdown", 1)];
      patch(members);
      return { ...basePlan({ sessionDurationMinutes: 25 }), workouts: [{ dayIndex: 0, sessionLabel: "push", exercises: members }] };
    }

    const rejects = async (plan: ProgramPlan, fragment: string) => {
      const result = await validateProgram(db, plan);
      expect(result.valid).toBe(false);
      expect(result.reasons.some((r) => r.includes(fragment))).toBe(true);
    };

    it("accepts a well-formed pair", async () => {
      expect(await validateProgram(db, pairPlan())).toEqual({ valid: true, reasons: [] });
    });

    it("rejects a superset with no partner", async () => {
      await rejects(
        pairPlan((m) => {
          m[0]!.supersetGroupIndex = null;
        }),
        "no partner",
      );
    });

    it("rejects a group with a single member", async () => {
      await rejects(
        pairPlan((m) => {
          m.pop();
        }),
        "exactly two",
      );
    });

    it("rejects a pair that isn't adjacent", async () => {
      await rejects(
        pairPlan((m) => {
          m[1]!.orderIndex = 3;
        }),
        "isn't adjacent",
      );
    });

    it("rejects unequal set counts", async () => {
      await rejects(
        pairPlan((m) => {
          m[1]!.sets = 2;
        }),
        "unequal set counts",
      );
    });

    it("rejects a pair that isn't compatible (overlapping muscles)", async () => {
      await db.update(schema.exercises).set({ primaryMuscles: ["lateral_deltoids"] }).where(eq(schema.exercises.id, bId));
      await rejects(pairPlan(), "isn't compatible");
    });

    it("rejects a group member that isn't eligible for superset", async () => {
      await db.update(schema.exercises).set({ allowedSessionRoles: ["accessory"] }).where(eq(schema.exercises.id, bId));
      await rejects(pairPlan(), "not eligible");
    });

    it("rejects a superset group on a non-superset role", async () => {
      await rejects(
        pairPlan((m) => {
          m[1]!.sessionRole = "accessory";
        }),
        "in a superset group but has role",
      );
    });
  });
});
