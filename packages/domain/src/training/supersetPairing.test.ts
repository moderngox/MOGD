import { describe, expect, it } from "vitest";
import {
  areSupersetCompatible as areSupersetCompatibleWith,
  isSupersetCandidate as isSupersetCandidateWith,
  pairSupersets as pairSupersetsWith,
  supersetSetBounds,
  type SupersetExercise,
} from "./supersetPairing";
import { DEFAULT_ROLE_RULES, type RoleRules } from "./roleRules";

const SUPERSET_MEMBER_FATIGUE_CEILING = DEFAULT_ROLE_RULES.superset.memberFatigueCeiling;
const SUPERSET_COMBINED_FATIGUE_CEILING = DEFAULT_ROLE_RULES.superset.combinedFatigueCeiling;
const MAX_SUPERSET_PAIRS_PER_SESSION = DEFAULT_ROLE_RULES.superset.maxPairsPerSession;

const isSupersetCandidate = (e: SupersetExercise, role: Parameters<typeof isSupersetCandidateWith>[1], rules: RoleRules = DEFAULT_ROLE_RULES) =>
  isSupersetCandidateWith(e, role, rules);
const areSupersetCompatible = (
  a: Parameters<typeof areSupersetCompatibleWith>[0],
  b: Parameters<typeof areSupersetCompatibleWith>[1],
  rules: RoleRules = DEFAULT_ROLE_RULES,
) => areSupersetCompatibleWith(a, b, rules);
const pairSupersets = <T extends { exercise: SupersetExercise }>(
  selected: T[],
  roles: Parameters<typeof pairSupersetsWith>[1],
  rules: RoleRules = DEFAULT_ROLE_RULES,
) => pairSupersetsWith(selected, roles, rules);
import type { RoleAssignment } from "./sessionRoleAssignment";

function exercise(overrides: Partial<SupersetExercise> = {}): SupersetExercise {
  return {
    primaryMuscles: ["lateral_deltoids"],
    secondaryMuscles: [],
    fatigueScore: 3,
    allowedSessionRoles: ["accessory", "superset"],
    preferredSessionRole: null,
    programmingProfile: { setsMin: 2, setsMax: 4 },
    ...overrides,
  };
}

const TRICEPS: Partial<SupersetExercise> = { primaryMuscles: ["triceps"] };
const BICEPS: Partial<SupersetExercise> = { primaryMuscles: ["biceps"] };
const LATS: Partial<SupersetExercise> = { primaryMuscles: ["lats"] };

function session(...exercises: SupersetExercise[]) {
  return exercises.map((e, i) => ({ exercise: e, label: `e${i}` }));
}

const accessory: RoleAssignment = { role: "accessory", roleReason: "DEFAULT_ACCESSORY_FALLBACK" };
const main: RoleAssignment = { role: "main", roleReason: "STRONGEST_MAIN_CANDIDATE" };
const finisher: RoleAssignment = { role: "finisher", roleReason: "TAIL_POSITION_FINISHER" };

describe("isSupersetCandidate", () => {
  it("accepts an accessory that allows superset", () => {
    expect(isSupersetCandidate(exercise(), "accessory")).toBe(true);
  });

  it("rejects main and finisher base roles", () => {
    expect(isSupersetCandidate(exercise(), "main")).toBe(false);
    expect(isSupersetCandidate(exercise(), "finisher")).toBe(false);
  });

  it("rejects an exercise that doesn't allow superset", () => {
    expect(isSupersetCandidate(exercise({ allowedSessionRoles: ["accessory"] }), "accessory")).toBe(false);
  });

  it("respects a preference for another role", () => {
    expect(isSupersetCandidate(exercise({ preferredSessionRole: "accessory" }), "accessory")).toBe(false);
    expect(isSupersetCandidate(exercise({ preferredSessionRole: "superset" }), "accessory")).toBe(true);
  });

  it("rejects an exercise above the member fatigue ceiling", () => {
    expect(isSupersetCandidate(exercise({ fatigueScore: SUPERSET_MEMBER_FATIGUE_CEILING + 1 }), "accessory")).toBe(false);
    expect(isSupersetCandidate(exercise({ fatigueScore: SUPERSET_MEMBER_FATIGUE_CEILING }), "accessory")).toBe(true);
  });
});

describe("areSupersetCompatible", () => {
  it("accepts exercises that train different muscles", () => {
    expect(areSupersetCompatible(exercise(), exercise(TRICEPS))).toBe(true);
  });

  it("rejects overlapping primary muscles", () => {
    expect(areSupersetCompatible(exercise(), exercise())).toBe(false);
  });

  it("rejects when one's primary is the other's secondary", () => {
    expect(areSupersetCompatible(exercise({ secondaryMuscles: ["triceps"] }), exercise(TRICEPS))).toBe(false);
    expect(areSupersetCompatible(exercise(TRICEPS), exercise({ secondaryMuscles: ["triceps"] }))).toBe(false);
  });

  it("rejects a pair whose combined fatigue is over the ceiling", () => {
    const heavy = Math.floor(SUPERSET_COMBINED_FATIGUE_CEILING / 2) + 1;
    expect(areSupersetCompatible(exercise({ fatigueScore: heavy }), exercise({ ...TRICEPS, fatigueScore: heavy }))).toBe(false);
  });

  it("rejects when the two profiles can't share a set count", () => {
    const a = exercise({ programmingProfile: { setsMin: 2, setsMax: 3 } });
    const b = exercise({ ...TRICEPS, programmingProfile: { setsMin: 4, setsMax: 5 } });
    expect(areSupersetCompatible(a, b)).toBe(false);
    expect(supersetSetBounds(a, b)).toBeNull();
  });

  it("computes the overlapping set range", () => {
    const a = exercise({ programmingProfile: { setsMin: 2, setsMax: 4 } });
    const b = exercise({ ...TRICEPS, programmingProfile: { setsMin: 3, setsMax: 5 } });
    expect(supersetSetBounds(a, b)).toEqual({ min: 3, max: 4 });
  });
});

describe("pairSupersets", () => {
  it("pairs a preferred-superset exercise with a compatible partner, adjacent, with one group", () => {
    const items = session(
      exercise({ preferredSessionRole: "superset" }),
      exercise(LATS),
      exercise(TRICEPS),
    );
    const result = pairSupersets(items, [accessory, accessory, accessory]);

    expect(result.selected.map((s) => s.label)).toEqual(["e0", "e1", "e2"]);
    const members = result.roles.map((r, i) => ({ i, role: r.role })).filter((m) => m.role === "superset");
    expect(members).toHaveLength(2);
    expect(Math.abs(members[0]!.i - members[1]!.i)).toBe(1);
    expect(result.groupIndexes.filter((g) => g === 0)).toHaveLength(2);
    expect(result.roles.filter((r) => r.roleReason === "SUPERSET_PAIR")).toHaveLength(2);
  });

  it("moves the partner to sit directly after the first member", () => {
    const items = session(
      exercise({ ...TRICEPS, preferredSessionRole: "superset" }),
      exercise(LATS),
      exercise(BICEPS),
    );
    // Only lats and biceps are compatible with triceps; the earlier compatible one (lats, index 1) wins.
    const result = pairSupersets(items, [accessory, accessory, accessory]);
    expect(result.selected.map((s) => s.label)).toEqual(["e0", "e1", "e2"]);

    // Make the partner non-adjacent originally: first member, filler, partner.
    const spread = session(
      exercise({ ...TRICEPS, preferredSessionRole: "superset" }),
      exercise({ primaryMuscles: ["quadriceps"], allowedSessionRoles: ["accessory"] }),
      exercise({ ...LATS, preferredSessionRole: "superset" }),
    );
    const moved = pairSupersets(spread, [accessory, accessory, accessory]);
    expect(moved.selected.map((s) => s.label)).toEqual(["e0", "e2", "e1"]);
    expect(moved.roles.map((r) => r.role)).toEqual(["superset", "superset", "accessory"]);
    expect(moved.groupIndexes).toEqual([0, 0, null]);
  });

  it("forms no pair when nobody prefers superset", () => {
    const items = session(exercise(), exercise(TRICEPS));
    const result = pairSupersets(items, [accessory, accessory]);
    expect(result.roles.every((r) => r.role === "accessory")).toBe(true);
    expect(result.groupIndexes).toEqual([null, null]);
  });

  it("forms no pair when the muscles overlap, fatigue is too high, or set ranges don't overlap", () => {
    const overlap = session(exercise({ preferredSessionRole: "superset" }), exercise());
    expect(pairSupersets(overlap, [accessory, accessory]).groupIndexes).toEqual([null, null]);

    const heavy = Math.floor(SUPERSET_COMBINED_FATIGUE_CEILING / 2) + 1;
    const tooTiring = session(
      exercise({ preferredSessionRole: "superset", fatigueScore: heavy }),
      exercise({ ...TRICEPS, fatigueScore: heavy }),
    );
    expect(pairSupersets(tooTiring, [accessory, accessory]).groupIndexes).toEqual([null, null]);

    const sets = session(
      exercise({ preferredSessionRole: "superset", programmingProfile: { setsMin: 2, setsMax: 3 } }),
      exercise({ ...TRICEPS, programmingProfile: { setsMin: 4, setsMax: 5 } }),
    );
    expect(pairSupersets(sets, [accessory, accessory]).groupIndexes).toEqual([null, null]);
  });

  it("leaves a preferred-superset exercise as an accessory when no partner is compatible", () => {
    const items = session(exercise({ preferredSessionRole: "superset" }), exercise());
    const result = pairSupersets(items, [accessory, accessory]);
    expect(result.roles.map((r) => r.role)).toEqual(["accessory", "accessory"]);
  });

  it("does not pull in an exercise whose preference is another role", () => {
    const items = session(
      exercise({ preferredSessionRole: "superset" }),
      exercise({ ...TRICEPS, preferredSessionRole: "accessory" }),
    );
    expect(pairSupersets(items, [accessory, accessory]).groupIndexes).toEqual([null, null]);
  });

  it("never pairs the main lift or the finisher, and keeps main first and finisher last", () => {
    const items = session(
      exercise({ ...BICEPS, allowedSessionRoles: ["main", "accessory", "superset"], preferredSessionRole: "superset" }),
      exercise({ preferredSessionRole: "superset" }),
      exercise(TRICEPS),
      exercise({ ...LATS, allowedSessionRoles: ["accessory", "superset", "finisher"] }),
    );
    const result = pairSupersets(items, [main, accessory, accessory, finisher]);

    expect(result.roles[0]!.role).toBe("main");
    expect(result.roles.at(-1)!.role).toBe("finisher");
    expect(result.groupIndexes[0]).toBeNull();
    expect(result.groupIndexes.at(-1)).toBeNull();
    expect(result.roles.filter((r) => r.role === "superset")).toHaveLength(2);
  });

  it("forms at most the per-session maximum number of pairs", () => {
    const items = session(
      exercise({ primaryMuscles: ["biceps"], preferredSessionRole: "superset" }),
      exercise({ primaryMuscles: ["triceps"], preferredSessionRole: "superset" }),
      exercise({ primaryMuscles: ["lats"], preferredSessionRole: "superset" }),
      exercise({ primaryMuscles: ["quadriceps"], preferredSessionRole: "superset" }),
    );
    const result = pairSupersets(items, [accessory, accessory, accessory, accessory]);
    const groups = new Set(result.groupIndexes.filter((g) => g !== null));
    expect(groups.size).toBe(MAX_SUPERSET_PAIRS_PER_SESSION);
  });

  it("prefers the pair where both members prefer superset", () => {
    const items = session(
      exercise({ ...BICEPS, preferredSessionRole: "superset" }),
      exercise(TRICEPS),
      exercise({ ...LATS, preferredSessionRole: "superset" }),
    );
    const result = pairSupersets(items, [accessory, accessory, accessory]);
    // e0+e1 has one preferring member; e0+e2 has two, so e2 is pulled up next to e0.
    expect(result.selected.map((s) => s.label)).toEqual(["e0", "e2", "e1"]);
    expect(result.groupIndexes).toEqual([0, 0, null]);
  });

  it("is deterministic", () => {
    const items = session(
      exercise({ ...BICEPS, preferredSessionRole: "superset" }),
      exercise(TRICEPS),
      exercise({ ...LATS, preferredSessionRole: "superset" }),
    );
    const roles = [accessory, accessory, accessory];
    expect(pairSupersets(items, roles)).toEqual(pairSupersets(items, roles));
  });

describe("custom role rules", () => {
  const rules = (superset: Partial<RoleRules["superset"]>): RoleRules => ({
    ...DEFAULT_ROLE_RULES,
    superset: { ...DEFAULT_ROLE_RULES.superset, ...superset },
  });

  it("a lower member fatigue ceiling removes candidates", () => {
    const e = exercise({ fatigueScore: 3 });
    expect(isSupersetCandidate(e, "accessory")).toBe(true);
    expect(isSupersetCandidate(e, "accessory", rules({ memberFatigueCeiling: 2 }))).toBe(false);
  });

  it("the combined ceiling changes which pairs are compatible", () => {
    const a = exercise({ fatigueScore: 5 });
    const b = exercise({ ...TRICEPS, fatigueScore: 5 });
    expect(areSupersetCompatible(a, b)).toBe(true);
    expect(areSupersetCompatible(a, b, rules({ combinedFatigueCeiling: 9 }))).toBe(false);
  });

  it("maxPairsPerSession: 0 disables supersets entirely", () => {
    const items = session(exercise({ preferredSessionRole: "superset" }), exercise(TRICEPS));
    const result = pairSupersets(items, [accessory, accessory], rules({ maxPairsPerSession: 0 }));
    expect(result.groupIndexes).toEqual([null, null]);
  });

  it("maxPairsPerSession: 2 forms two separate pairs", () => {
    const items = session(
      exercise({ primaryMuscles: ["biceps"], preferredSessionRole: "superset" }),
      exercise({ primaryMuscles: ["triceps"], preferredSessionRole: "superset" }),
      exercise({ primaryMuscles: ["lats"], preferredSessionRole: "superset" }),
      exercise({ primaryMuscles: ["quadriceps"], preferredSessionRole: "superset" }),
    );
    const result = pairSupersets(items, [accessory, accessory, accessory, accessory], rules({ maxPairsPerSession: 2 }));
    expect(new Set(result.groupIndexes.filter((g) => g !== null))).toEqual(new Set([0, 1]));
    expect(result.roles.filter((r) => r.role === "superset")).toHaveLength(4);
  });
});
});
