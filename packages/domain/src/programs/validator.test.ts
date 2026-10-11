import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { upsertProgrammingProfile } from "../exercises/programmingProfiles";
import { DEFAULT_ROLE_RULES } from "../training/roleRules";
import { saveRoleRules } from "../training/roleRulesStore";
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
      roleRulesRevisionId: null,
      workouts: [
        {
          dayIndex: 0,
          sessionLabel: "push",
          exercises: [
            {
              exerciseId,
              canonicalId,
              orderIndex: 0,
              // Derived from the seeded default profile (reps 6-10, RIR 1-3, rest 75-120) and
              // the main role (rest x1.2): exactly what the generator would produce.
              sets: 3,
              repMin: 6,
              repMax: 10,
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

  describe("final prescription", () => {
    const tamper = (patch: (e: ProgramPlan["workouts"][0]["exercises"][0]) => void) => {
      const plan = basePlan();
      patch(plan.workouts[0]!.exercises[0]!);
      return plan;
    };
    const rejectsWith = async (plan: ProgramPlan, fragment: string) => {
      const result = await validateProgram(db, plan);
      expect(result.valid).toBe(false);
      expect(result.reasons.some((r) => r.includes(fragment))).toBe(true);
    };

    it("rejects a repMin that isn't what the profile and role produce", async () => {
      await rejectsWith(tamper((e) => (e.repMin = 7)), "repMin 7 but 6 is expected");
    });

    it("rejects a repMax that isn't what the profile and role produce", async () => {
      await rejectsWith(tamper((e) => (e.repMax = 12)), "repMax 12 but 10 is expected");
    });

    it("rejects an rirMin that isn't what the profile and role produce", async () => {
      await rejectsWith(tamper((e) => (e.rirMin = 0)), "rirMin 0 but 1 is expected");
    });

    it("rejects an rirMax that isn't what the profile and role produce", async () => {
      await rejectsWith(tamper((e) => (e.rirMax = 4)), "rirMax 4 but 3 is expected");
    });

    it("rejects a rest time that isn't what the profile and role produce", async () => {
      await rejectsWith(tamper((e) => (e.restSeconds = 200)), "restSeconds 200 but 90 is expected");
    });

    it("rejects an inverted or out-of-range rep range, whatever the derivation", async () => {
      await rejectsWith(tamper((e) => ((e.repMin = 12), (e.repMax = 8))), "invalid rep range 12-8");
      await rejectsWith(tamper((e) => (e.repMax = 150)), "invalid rep range");
    });

    it("rejects an inverted or out-of-range RIR range", async () => {
      await rejectsWith(tamper((e) => ((e.rirMin = 3), (e.rirMax = 1))), "invalid RIR range 3-1");
      await rejectsWith(tamper((e) => (e.rirMax = 11)), "invalid RIR range");
    });

    it("rejects rest outside the allowed window", async () => {
      await rejectsWith(tamper((e) => (e.restSeconds = 10)), "outside the 30-600s allowed");
      await rejectsWith(tamper((e) => (e.restSeconds = 900)), "outside the 30-600s allowed");
    });

    it("rejects non-integer values", async () => {
      await rejectsWith(tamper((e) => (e.repMin = 6.5)), "non-integer repMin");
    });

    it("validates against the named rules revision: values built under custom rules need that revision", async () => {
      const slower = await saveRoleRules(db, null, {
        ...DEFAULT_ROLE_RULES,
        roles: { ...DEFAULT_ROLE_RULES.roles, main: { restMultiplier: 2 } },
      });
      // Main rest under the custom rules: 75 x 2 = 150.
      const builtUnderCustom = tamper((e) => (e.restSeconds = 150));

      expect((await validateProgram(db, { ...builtUnderCustom, roleRulesRevisionId: slower.id })).valid).toBe(true);
      await rejectsWith({ ...builtUnderCustom, roleRulesRevisionId: null }, "restSeconds 150 but 90 is expected");
      await rejectsWith({ ...basePlan(), roleRulesRevisionId: slower.id }, "restSeconds 90 but 150 is expected");
    });
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
        repMin: 6,
        repMax: 10,
        rirMin: 1,
        rirMax: 3,
        restSeconds: 55, // isolation baseline 75 x superset 0.7, rounded to 5
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

    it("checks against the named role-rules revision, not fixed constants", async () => {
      const twoMains = () =>
        pairPlan((m) => {
          for (const member of m) {
            member.sessionRole = "main";
            member.supersetGroupIndex = null;
            member.roleReason = "STRONGEST_MAIN_CANDIDATE";
          }
        });
      const loose = await saveRoleRules(db, null, { ...DEFAULT_ROLE_RULES, maxMainSlots: 2 });

      const underDefaults = await validateProgram(db, { ...twoMains(), roleRulesRevisionId: null });
      expect(underDefaults.reasons.some((r) => r.includes("main exercises"))).toBe(true);

      const underLoose = await validateProgram(db, { ...twoMains(), roleRulesRevisionId: loose.id });
      expect(underLoose.reasons.some((r) => r.includes("main exercises"))).toBe(false);
    });

    it("fails explicitly when the plan names a revision that doesn't exist", async () => {
      await expect(validateProgram(db, { ...pairPlan(), roleRulesRevisionId: "missing" })).rejects.toThrow(
        /No role-rules revision/,
      );
    });

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
