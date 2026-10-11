import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_RULES, roleRulesSchema, type RoleRules } from "./roleRules";

const clone = (): RoleRules => structuredClone(DEFAULT_ROLE_RULES);

describe("DEFAULT_ROLE_RULES", () => {
  it("is valid under its own schema", () => {
    expect(roleRulesSchema.safeParse(DEFAULT_ROLE_RULES).success).toBe(true);
  });

  it("pins the values the engine shipped with before it was configurable", () => {
    expect(DEFAULT_ROLE_RULES).toEqual({
      roles: {
        main: { restMultiplier: 1.2 },
        accessory: { restMultiplier: 1.0 },
        superset: { restMultiplier: 0.7 },
        finisher: { restMultiplier: 0.6, repShift: { min: 3, max: 5 }, rirCeiling: 2, setsDelta: -1 },
      },
      restSecondsFloor: 30,
      maxMainSlots: 1,
      finisherFatigueCeiling: 6,
      superset: { memberFatigueCeiling: 6, combinedFatigueCeiling: 10, maxPairsPerSession: 1 },
    });
  });

  it("survives a JSON round trip (how it is stored)", () => {
    expect(roleRulesSchema.parse(JSON.parse(JSON.stringify(DEFAULT_ROLE_RULES)))).toEqual(DEFAULT_ROLE_RULES);
  });
});

describe("roleRulesSchema bounds", () => {
  const accepts = (mutate: (r: RoleRules) => void) => {
    const rules = clone();
    mutate(rules);
    expect(roleRulesSchema.safeParse(rules).success).toBe(true);
  };
  const rejects = (mutate: (r: RoleRules) => void) => {
    const rules = clone();
    mutate(rules);
    expect(roleRulesSchema.safeParse(rules).success).toBe(false);
  };

  it("bounds the rest multiplier to 0.3-2", () => {
    accepts((r) => (r.roles.main.restMultiplier = 0.3));
    accepts((r) => (r.roles.main.restMultiplier = 2));
    rejects((r) => (r.roles.main.restMultiplier = 0.29));
    rejects((r) => (r.roles.main.restMultiplier = 2.01));
  });

  it("bounds each rep shift to -5..10 and requires whole numbers", () => {
    accepts((r) => (r.roles.finisher.repShift = { min: -5, max: 10 }));
    rejects((r) => (r.roles.finisher.repShift = { min: -6, max: 5 }));
    rejects((r) => (r.roles.finisher.repShift = { min: 3, max: 11 }));
    rejects((r) => (r.roles.finisher.repShift = { min: 1.5, max: 5 }));
  });

  it("bounds the RIR ceiling to 0-5, or absent", () => {
    accepts((r) => (r.roles.finisher.rirCeiling = 0));
    accepts((r) => (r.roles.finisher.rirCeiling = 5));
    accepts((r) => delete r.roles.finisher.rirCeiling);
    rejects((r) => (r.roles.finisher.rirCeiling = 6));
    rejects((r) => (r.roles.finisher.rirCeiling = -1));
  });

  it("bounds the sets delta to -2..2", () => {
    accepts((r) => (r.roles.finisher.setsDelta = -2));
    accepts((r) => (r.roles.accessory.setsDelta = 2));
    rejects((r) => (r.roles.finisher.setsDelta = -3));
    rejects((r) => (r.roles.accessory.setsDelta = 3));
  });

  it("bounds the rest floor to 15-120", () => {
    accepts((r) => (r.restSecondsFloor = 15));
    accepts((r) => (r.restSecondsFloor = 120));
    rejects((r) => (r.restSecondsFloor = 14));
    rejects((r) => (r.restSecondsFloor = 121));
  });

  it("allows 1 or 2 main slots, never 0 (main-only exercises would be unassignable)", () => {
    accepts((r) => (r.maxMainSlots = 1));
    accepts((r) => (r.maxMainSlots = 2));
    rejects((r) => (r.maxMainSlots = 0));
    rejects((r) => (r.maxMainSlots = 3));
  });

  it("bounds the fatigue ceilings", () => {
    accepts((r) => (r.finisherFatigueCeiling = 0));
    accepts((r) => (r.finisherFatigueCeiling = 10));
    rejects((r) => (r.finisherFatigueCeiling = 10.5));
    rejects((r) => (r.superset.memberFatigueCeiling = 11));
    rejects((r) => (r.superset.combinedFatigueCeiling = 21));
  });

  it("allows 0 (disabled) to 2 superset pairs", () => {
    accepts((r) => (r.superset.maxPairsPerSession = 0));
    accepts((r) => (r.superset.maxPairsPerSession = 2));
    rejects((r) => (r.superset.maxPairsPerSession = 3));
    rejects((r) => (r.superset.maxPairsPerSession = -1));
  });

  it("requires the combined ceiling to be at least the member ceiling", () => {
    accepts((r) => (r.superset = { ...r.superset, memberFatigueCeiling: 6, combinedFatigueCeiling: 6 }));
    rejects((r) => (r.superset = { ...r.superset, memberFatigueCeiling: 7, combinedFatigueCeiling: 6 }));
  });

  it("rejects unknown keys instead of ignoring them", () => {
    const rules = { ...clone(), surprise: true };
    expect(roleRulesSchema.safeParse(rules).success).toBe(false);
  });

  it("rejects a missing role", () => {
    const rules = clone() as unknown as { roles: Record<string, unknown> };
    delete rules.roles.superset;
    expect(roleRulesSchema.safeParse(rules).success).toBe(false);
  });
});
