import { describe, expect, it } from "vitest";
import {
  assignSessionRoles as assignSessionRolesWith,
  applyRoleModifier as applyRoleModifierWith,
  UnassignableRoleError,
} from "./sessionRoleAssignment";
import { DEFAULT_ROLE_RULES, type RoleRules } from "./roleRules";
import type { CatalogExercise } from "./candidatePool";

const assignSessionRoles = (selected: Parameters<typeof assignSessionRolesWith>[0], rules: RoleRules = DEFAULT_ROLE_RULES) =>
  assignSessionRolesWith(selected, rules);
const applyRoleModifier = (
  baseline: Parameters<typeof applyRoleModifierWith>[0],
  role: Parameters<typeof applyRoleModifierWith>[1],
  setsBounds: Parameters<typeof applyRoleModifierWith>[2],
  rules: RoleRules = DEFAULT_ROLE_RULES,
) => applyRoleModifierWith(baseline, role, setsBounds, rules);

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
    loadType: "external",
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

  it("has no legal role for an exercise with no allowed roles, instead of defaulting to accessory", () => {
    const empty = mockExercise({ allowedSessionRoles: [] });
    expect(() => assignSessionRoles(scored([empty]))).toThrow(UnassignableRoleError);
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

  it("never honors a preferred finisher above the fatigue ceiling", () => {
    const main = mockExercise();
    const fatiguing = mockExercise({
      allowedSessionRoles: ["accessory", "finisher"],
      preferredSessionRole: "finisher",
      fatigueScore: 9,
    });
    const [, last] = assignSessionRoles(scored([main, fatiguing]));
    expect(last!.role).toBe("accessory");
  });

  it("rejects a finisher-only exercise above the fatigue ceiling instead of assigning it", () => {
    const fatiguing = mockExercise({ allowedSessionRoles: ["finisher"], fatigueScore: 9 });
    expect(() => assignSessionRoles(scored([fatiguing]))).toThrow(UnassignableRoleError);
  });

  it("enforces the one-main limit even for main-only exercises", () => {
    const first = mockExercise({ allowedSessionRoles: ["main"] });
    const second = mockExercise({ allowedSessionRoles: ["main"] });
    expect(() => assignSessionRoles(scored([first, second]))).toThrow(UnassignableRoleError);
  });

  it("never assigns superset on its own, even when preferred — only the pairing pass does", () => {
    const preferred = mockExercise({
      allowedSessionRoles: ["accessory", "superset"],
      preferredSessionRole: "superset",
    });
    const [result] = assignSessionRoles(scored([preferred]));
    expect(result).toEqual({ role: "accessory", roleReason: "DEFAULT_ACCESSORY_FALLBACK" });
  });

  it("rejects an exercise whose only legal role would have been superset", () => {
    const supersetOnly = mockExercise({ allowedSessionRoles: ["superset"] });
    expect(() => assignSessionRoles(scored([supersetOnly]))).toThrow(UnassignableRoleError);
  });

  it("assigns a main-only exercise as main while the slot is open", () => {
    const [result] = assignSessionRoles(scored([mockExercise({ allowedSessionRoles: ["main"] })]));
    expect(result).toEqual({ role: "main", roleReason: "ONLY_ELIGIBLE_ROLE" });
  });
});

describe("applyRoleModifier", () => {
  const baseline = { sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 3, restSeconds: 90 };
  const setsBounds = { min: 2, max: 5 };

  it("narrows reps, lowers RIR, shortens rest and reduces sets for finisher", () => {
    const result = applyRoleModifier(baseline, "finisher", setsBounds);
    expect(result.repMin).toBeGreaterThan(baseline.repMin);
    expect(result.repMax).toBeGreaterThan(baseline.repMax);
    expect(result.rirMax).toBeLessThanOrEqual(2);
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

describe("custom role rules", () => {
  const rules = (patch: Partial<RoleRules>): RoleRules => ({ ...DEFAULT_ROLE_RULES, ...patch });

  it("maxMainSlots: 2 lets two main-only exercises both be main", () => {
    const input = scored([mockExercise({ allowedSessionRoles: ["main"] }), mockExercise({ allowedSessionRoles: ["main"] })]);
    expect(() => assignSessionRoles(input)).toThrow(UnassignableRoleError);
    expect(assignSessionRoles(input, rules({ maxMainSlots: 2 })).map((r) => r.role)).toEqual(["main", "main"]);
  });

  it("a lower finisher fatigue ceiling stops a finisher; a higher one permits a heavier finisher", () => {
    const fatigued = (fatigueScore: number) =>
      scored([mockExercise(), mockExercise({ allowedSessionRoles: ["accessory", "finisher"], fatigueScore })]);

    expect(assignSessionRoles(fatigued(4))[1]!.role).toBe("finisher");
    expect(assignSessionRoles(fatigued(4), rules({ finisherFatigueCeiling: 3 }))[1]!.role).toBe("accessory");
    expect(assignSessionRoles(fatigued(8))[1]!.role).toBe("accessory");
    expect(assignSessionRoles(fatigued(8), rules({ finisherFatigueCeiling: 9 }))[1]!.role).toBe("finisher");
  });
});

describe("applyRoleModifier with custom rules", () => {
  const baseline = { sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 3, restSeconds: 90 };
  const bounds = { min: 2, max: 5 };
  const withRole = (role: "main" | "accessory" | "superset" | "finisher", modifier: RoleRules["roles"]["main"]): RoleRules => ({
    ...DEFAULT_ROLE_RULES,
    roles: { ...DEFAULT_ROLE_RULES.roles, [role]: modifier },
  });

  it("scales rest by the configured multiplier", () => {
    expect(applyRoleModifier(baseline, "accessory", bounds, withRole("accessory", { restMultiplier: 2 })).restSeconds).toBe(180);
  });

  it("applies the configured rep shift, RIR ceiling and sets delta, and none when absent", () => {
    const shifted = applyRoleModifier(
      baseline,
      "finisher",
      bounds,
      withRole("finisher", { restMultiplier: 1, repShift: { min: 0, max: 2 }, rirCeiling: 1, setsDelta: 1 }),
    );
    expect(shifted).toMatchObject({ repMin: 8, repMax: 14, rirMax: 1, sets: 4 });

    const untouched = applyRoleModifier(baseline, "finisher", bounds, withRole("finisher", { restMultiplier: 1 }));
    expect(untouched).toMatchObject({ repMin: 8, repMax: 12, rirMin: 1, rirMax: 3, sets: 3, restSeconds: 90 });
  });

  it("honours the configured rest floor", () => {
    const rules: RoleRules = { ...withRole("finisher", { restMultiplier: 0.3 }), restSecondsFloor: 60 };
    expect(applyRoleModifier(baseline, "finisher", bounds, rules).restSeconds).toBe(60);
  });

  it("still clamps sets to the exercise's own range, whatever the rule says", () => {
    const rules = withRole("accessory", { restMultiplier: 1, setsDelta: 2 });
    expect(applyRoleModifier({ ...baseline, sets: 5 }, "accessory", bounds, rules).sets).toBe(5);
  });
});

describe("eligibility is literal", () => {
  const ROLES = ["main", "accessory", "superset", "finisher"] as const;

  /** Every non-empty subset of the four roles, as the canonical-order lists the admin form stores. */
  const subsets = Array.from({ length: 15 }, (_, i) => ROLES.filter((_, bit) => ((i + 1) >> bit) & 1));

  it("never assigns a role outside allowedSessionRoles, for every allowed-role combination and position", () => {
    for (const allowed of subsets) {
      for (const preferred of [null, ...allowed]) {
        for (const fatigueScore of [0, 5, 9]) {
          for (const position of [0, 1, 2]) {
            const others = [mockExercise(), mockExercise(), mockExercise()];
            others[position] = mockExercise({
              allowedSessionRoles: [...allowed],
              preferredSessionRole: preferred,
              fatigueScore,
            });
            const subject = others[position]!;

            let roles: ReturnType<typeof assignSessionRoles>;
            try {
              roles = assignSessionRoles(scored(others));
            } catch (error) {
              // A role-less outcome is an explicit rejection, never a coerced role.
              expect(error).toBeInstanceOf(UnassignableRoleError);
              continue;
            }
            expect(allowed).toContain(roles[position]!.role);
            expect(subject.allowedSessionRoles).toContain(roles[position]!.role);
          }
        }
      }
    }
  });
});
});
