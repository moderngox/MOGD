import { describe, expect, it } from "vitest";
import { computeProgressionTarget, type LoggedSetForProgression } from "./progression";

const BASE = {
  prescribedSets: 3,
  repMin: 8,
  repMax: 12,
  rirMin: 1,
  rirMax: 3,
  movementPattern: "push",
};

function set(overrides: Partial<LoggedSetForProgression>): LoggedSetForProgression {
  return { reps: 10, loadKg: 30, rir: 2, painFlag: null, techniqueValid: null, ...overrides };
}

describe("computeProgressionTarget", () => {
  it("suggests starting within the configured range when there's no prior data", () => {
    const target = computeProgressionTarget({ ...BASE, recentSets: [] });
    expect(target.targetLoadKg).toBeNull();
    expect(target).toMatchObject({ reason: "NO_LOAD_HISTORY", targetRepMin: 8, targetRepMax: 12 });
  });

  it("adds a rep (from the weakest set) at the same load when below the rep ceiling and RIR/technique/pain are clean", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 11 }), set({ reps: 10 }), set({ reps: 10 })],
    });
    expect(target).toMatchObject({ reason: "CONTINUE_REP_PROGRESSION", targetLoadKg: 30, targetRepMin: 11, targetRepMax: 12 });
  });

  it("increases load and restarts the rep range once every set hits the ceiling within the RIR target", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12, rir: 2 }), set({ reps: 12, rir: 1 }), set({ reps: 12, rir: 2 })],
    });
    expect(target.reason).toBe("INCREASE_LOAD");
    expect(target.targetLoadKg).toBeGreaterThan(30);
    expect(target).toMatchObject({ targetRepMin: 8, targetRepMax: 12 });
  });

  it("does not increase load just because every set hit the ceiling if RIR was outside the target (e.g. ground out at RIR 0)", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12, rir: 0 }), set({ reps: 12, rir: 0 }), set({ reps: 12, rir: 0 })],
    });
    expect(target.reason).not.toBe("INCREASE_LOAD");
  });

  it("uses a larger load increment for squat/hinge/carry patterns than other patterns", () => {
    const ceilingSets = [set({ reps: 5, rir: 2 }), set({ reps: 5, rir: 1 }), set({ reps: 5, rir: 2 })];
    const squat = computeProgressionTarget({
      ...BASE,
      repMin: 3,
      repMax: 5,
      movementPattern: "squat",
      recentSets: ceilingSets,
    });
    const isolation = computeProgressionTarget({
      ...BASE,
      repMin: 3,
      repMax: 5,
      movementPattern: "isolation",
      recentSets: ceilingSets,
    });
    const squatIncrement = squat.targetLoadKg! - 30;
    const isolationIncrement = isolation.targetLoadKg! - 30;
    expect(squatIncrement).toBeGreaterThan(isolationIncrement);
  });

  it("never targets more reps than the configured ceiling", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12 }), set({ reps: 11 }), set({ reps: 12 })],
    });
    expect(target.targetRepMin).toBeLessThanOrEqual(target.targetRepMax);
    expect(target.targetRepMax).toBe(12);
  });

  it("holds load and resets to the rep floor when pain was reported, regardless of performance", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12, rir: 2 }), set({ reps: 12, rir: 2, painFlag: true }), set({ reps: 12, rir: 2 })],
    });
    expect(target).toMatchObject({ reason: "REASSESS_DUE_TO_PAIN", targetLoadKg: 30, targetRepMin: 8, targetRepMax: 8 });
  });

  it("holds the exact same target when technique was marked invalid, even with pain absent", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12, rir: 2, techniqueValid: false }), set({ reps: 12 }), set({ reps: 12 })],
    });
    expect(target).toMatchObject({ reason: "HOLD_FOR_TECHNIQUE", targetRepMin: 8, targetRepMax: 12 });
  });

  it("pain takes priority over a technique flag on a different set", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ painFlag: true }), set({ techniqueValid: false })],
    });
    expect(target.reason).toBe("REASSESS_DUE_TO_PAIN");
  });

  it("does not reward an incomplete session with rep progression", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12 })], // only 1 of 3 prescribed sets logged
    });
    expect(target).toMatchObject({ reason: "CONTINUE_CURRENT_LOAD", targetLoadKg: 30, targetRepMin: 8, targetRepMax: 12 });
  });

  it("reduces load when the weakest set missed the rep floor at RIR 0", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 10 }), set({ reps: 6, rir: 0 }), set({ reps: 9 })],
    });
    expect(target.reason).toBe("REDUCE_LOAD");
    expect(target.targetLoadKg).toBeLessThan(30);
    expect(target.targetRepMin).toBe(8);
  });

  it("treats a missing RIR as satisfying the target (benefit of doubt)", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12, rir: null }), set({ reps: 12, rir: null }), set({ reps: 12, rir: null })],
    });
    expect(target.reason).toBe("INCREASE_LOAD");
  });
});
