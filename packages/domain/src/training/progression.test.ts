import { describe, expect, it } from "vitest";
import { computeProgressionTarget, resolveKnownNextLoad, type LoggedSetForProgression } from "./progression";

const BASE = {
  prescribedSets: 3,
  repMin: 8,
  repMax: 12,
  rirMin: 1,
  rirMax: 3,
  observedLoadsKg: [30],
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

  it("requests the smallest available increment (no invented kg) when the next load is unknown", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12, rir: 2 }), set({ reps: 12, rir: 1 }), set({ reps: 12, rir: 2 })],
    });
    expect(target).toMatchObject({
      reason: "INCREASE_LOAD",
      targetLoadKg: null,
      loadInstruction: "Increase to the smallest available resistance increment.",
      targetRepMin: 8,
      targetRepMax: 12,
    });
  });

  it("uses the athlete's smallest observed load jump when it is known", () => {
    const target = computeProgressionTarget({
      ...BASE,
      observedLoadsKg: [25, 27.5, 30],
      recentSets: [set({ reps: 12, rir: 2 }), set({ reps: 12, rir: 1 }), set({ reps: 12, rir: 2 })],
    });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 32.5, loadInstruction: null });
  });

  it("takes a previously used higher load as the known next step", () => {
    const target = computeProgressionTarget({
      ...BASE,
      observedLoadsKg: [30, 35, 45],
      recentSets: [set({ reps: 12, rir: 2 }), set({ reps: 12, rir: 1 }), set({ reps: 12, rir: 2 })],
    });
    expect(target.targetLoadKg).toBe(35);
  });

  it("does not increase load just because every set hit the ceiling if RIR was outside the target (e.g. ground out at RIR 0)", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12, rir: 0 }), set({ reps: 12, rir: 0 }), set({ reps: 12, rir: 0 })],
    });
    expect(target.reason).not.toBe("INCREASE_LOAD");
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

  it("reduces to the next known lighter load when the weakest set missed the rep floor at RIR 0", () => {
    const target = computeProgressionTarget({
      ...BASE,
      observedLoadsKg: [27.5, 30],
      recentSets: [set({ reps: 10 }), set({ reps: 6, rir: 0 }), set({ reps: 9 })],
    });
    expect(target).toMatchObject({ reason: "REDUCE_LOAD", targetLoadKg: 27.5, targetRepMin: 8 });
  });

  it("asks for the next lighter resistance (no invented kg) when the step down is unknown", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 10 }), set({ reps: 6, rir: 0 }), set({ reps: 9 })],
    });
    expect(target).toMatchObject({ reason: "REDUCE_LOAD", targetLoadKg: null });
    expect(target.loadInstruction).toMatch(/lighter/i);
  });

  it("does not increase load when RIR wasn't logged, and asks for it", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12, rir: null }), set({ reps: 12, rir: null }), set({ reps: 12, rir: null })],
    });
    expect(target).toMatchObject({ reason: "CONTINUE_CURRENT_LOAD", targetLoadKg: 30 });
    expect(target.message).toMatch(/log RIR/i);
  });

  it("does not increase load when only some sets have RIR logged", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ reps: 12, rir: 2 }), set({ reps: 12, rir: null }), set({ reps: 12, rir: 2 })],
    });
    expect(target.reason).toBe("CONTINUE_CURRENT_LOAD");
  });
});

describe("resolveKnownNextLoad", () => {
  it("is unknown with a single observed load", () => {
    expect(resolveKnownNextLoad([7.5], 7.5, "up")).toBeNull();
  });

  it("ignores floating point noise and duplicate loads", () => {
    expect(resolveKnownNextLoad([7.5, 7.5, 10.000001, 10], 10, "up")).toBe(12.5);
  });

  it("never steps down to zero or below", () => {
    expect(resolveKnownNextLoad([2.5, 5], 2.5, "down")).toBeNull();
  });
});

describe("canonical Cable Lateral Raise case (spec 05)", () => {
  const profile = { prescribedSets: 3, repMin: 12, repMax: 15, rirMin: 1, rirMax: 3 };
  const history = [
    set({ loadKg: 7.5, reps: 15, rir: 2 }),
    set({ loadKg: 7.5, reps: 15, rir: 2 }),
    set({ loadKg: 7.5, reps: 15, rir: 2 }),
  ];

  it("with no history gives no kg and tells the user to choose a resistance", () => {
    const target = computeProgressionTarget({ ...profile, recentSets: [], observedLoadsKg: [] });
    expect(target).toMatchObject({ reason: "NO_LOAD_HISTORY", targetLoadKg: null });
  });

  it("requests the smallest available increment after 7.5kg x 15 @2 x3 with no known step", () => {
    const target = computeProgressionTarget({ ...profile, recentSets: history, observedLoadsKg: [7.5] });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null, targetRepMin: 12, targetRepMax: 15 });
    expect(target.loadInstruction).toBeTruthy();
  });

  it("uses the known increment when the athlete has used 5kg and 7.5kg before", () => {
    const target = computeProgressionTarget({ ...profile, recentSets: history, observedLoadsKg: [5, 7.5] });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 10, targetRepMin: 12 });
  });
});
