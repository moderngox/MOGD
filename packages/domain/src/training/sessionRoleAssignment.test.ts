import { describe, expect, it } from "vitest";
import { assignSessionRoles, applyRoleModifier } from "./sessionRoleAssignment";
import type { CatalogExercise } from "./candidatePool";

let counter = 0;
function mockExercise(overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  counter += 1;
  return {
    id: `id-${counter}`,
    canonicalId: `exercise_${counter}`,
    name: `Exercise ${counter}`,
    movementPattern: "push",
    difficulty: "intermediate",
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    hypertrophyScore: null,
    strengthScore: null,
    fatigueScore: null,
    stabilityDemand: null,
    defaultRepMin: null,
    defaultRepMax: null,
    contraindicationTags: [],
    instructions: null,
    isActive: true,
    allowedSessionRoles: ["main", "accessory", "superset", "finisher"],
    preferredSessionRole: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function scored(exercises: CatalogExercise[]) {
  return exercises.map((exercise, i) => ({ exercise, score: exercises.length - i }));
}

describe("assignSessionRoles", () => {
  it("never assigns a role outside allowedSessionRoles, even for the strongest, first-position candidate", () => {
    const restricted = mockExercise({ allowedSessionRoles: ["accessory", "superset", "finisher"] });
    const [result] = assignSessionRoles(scored([restricted]));
    expect(["accessory", "superset", "finisher"]).toContain(result!.role);
    expect(result!.role).not.toBe("main");
  });

  it("treats preferredSessionRole as a bias, not a mandate — falls through once the main slot is full", () => {
    const takesMain = mockExercise({ allowedSessionRoles: ["main", "accessory"] });
    const alsoPrefersMain = mockExercise({
      allowedSessionRoles: ["main", "accessory"],
      preferredSessionRole: "main",
    });

    const [first, second] = assignSessionRoles(scored([takesMain, alsoPrefersMain]));
    expect(first!.role).toBe("main");
    expect(second!.role).not.toBe("main");
    expect(second!.role).toBe("accessory");
  });

  it("honors preferredSessionRole when the role is still available", () => {
    const preferred = mockExercise({
      allowedSessionRoles: ["main", "accessory", "finisher"],
      preferredSessionRole: "finisher",
    });
    const [result] = assignSessionRoles(scored([preferred]));
    expect(result).toEqual({ role: "finisher", roleReason: "PREFERRED_ROLE" });
  });

  it("falls back to accessory-only eligibility and never crashes when unconfigured", () => {
    const unconfigured = mockExercise({ allowedSessionRoles: [] });
    const [result] = assignSessionRoles(scored([unconfigured]));
    expect(result).toEqual({ role: "accessory", roleReason: "NO_CONFIG_DEFAULT_ACCESSORY" });
  });

  it("does not assign finisher to a high-fatigue exercise even in the tail position", () => {
    const main = mockExercise();
    const fatiguing = mockExercise({
      allowedSessionRoles: ["accessory", "finisher"],
      fatigueScore: 9,
    });
    const [, last] = assignSessionRoles(scored([main, fatiguing]));
    expect(last!.role).not.toBe("finisher");
    expect(last!.role).toBe("accessory");
  });

  it("is deterministic: identical inputs produce identical output", () => {
    const exercises = [mockExercise(), mockExercise(), mockExercise()];
    const input = scored(exercises);
    expect(assignSessionRoles(input)).toEqual(assignSessionRoles(input));
  });
});

describe("applyRoleModifier", () => {
  const baseline = { sets: 3, repMin: 8, repMax: 12, rir: 2, restSeconds: 90 };
  const setsBounds = { min: 2, max: 5 };

  it("narrows reps, lowers RIR, shortens rest and reduces sets for finisher", () => {
    const result = applyRoleModifier(baseline, "finisher", setsBounds);
    expect(result.repMin).toBeGreaterThan(baseline.repMin);
    expect(result.repMax).toBeGreaterThan(baseline.repMax);
    expect(result.rir).toBeLessThanOrEqual(2);
    expect(result.restSeconds).toBeLessThan(baseline.restSeconds);
    expect(result.sets).toBeLessThan(baseline.sets);
  });

  it("lengthens rest for main", () => {
    const result = applyRoleModifier(baseline, "main", setsBounds);
    expect(result.restSeconds).toBeGreaterThan(baseline.restSeconds);
  });

  it("never drops sets below the configured floor", () => {
    const result = applyRoleModifier({ ...baseline, sets: 2 }, "finisher", setsBounds);
    expect(result.sets).toBeGreaterThanOrEqual(setsBounds.min);
  });

  it("never lets restSeconds fall below the floor even with a large multiplier reduction", () => {
    const result = applyRoleModifier({ ...baseline, restSeconds: 30 }, "finisher", setsBounds);
    expect(result.restSeconds).toBeGreaterThanOrEqual(30);
  });

  it("keeps repMin <= repMax", () => {
    const result = applyRoleModifier(baseline, "finisher", setsBounds);
    expect(result.repMin).toBeLessThanOrEqual(result.repMax);
  });
});
