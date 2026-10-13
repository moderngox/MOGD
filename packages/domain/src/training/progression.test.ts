import { describe, expect, it } from "vitest";
import type { LoadType } from "../exercises/options";
import {
  computeProgressionTarget,
  resolveKnownNextLoad,
  type LoggedSetForProgression,
  type ProgressionPrescription,
} from "./progression";

const PRESCRIPTION: ProgressionPrescription = { sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 3, restSeconds: 90, sessionRole: "accessory" };

const BASE = {
  loadType: "external" as LoadType,
  currentPrescription: PRESCRIPTION,
  previousPrescription: PRESCRIPTION as ProgressionPrescription | null,
  observedLoadsKg: [30],
  hasHistoryInOtherContext: false,
};

function set(overrides: Partial<LoggedSetForProgression>): LoggedSetForProgression {
  return { reps: 10, loadKg: 30, rir: 2, painFlag: null, techniqueValid: null, ...overrides };
}

const ceilingSets = () => [set({ reps: 12, rir: 2 }), set({ reps: 12, rir: 1 }), set({ reps: 12, rir: 2 })];

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
    const target = computeProgressionTarget({ ...BASE, recentSets: ceilingSets() });
    expect(target).toMatchObject({
      reason: "INCREASE_LOAD",
      targetLoadKg: null,
      loadInstruction: "Increase to the smallest available resistance increment.",
      targetRepMin: 8,
      targetRepMax: 12,
    });
  });

  it("uses the athlete's smallest observed load jump when it is known", () => {
    const target = computeProgressionTarget({ ...BASE, observedLoadsKg: [25, 27.5, 30], recentSets: ceilingSets() });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 32.5, loadInstruction: null });
  });

  it("takes a previously used higher load as the known next step", () => {
    const target = computeProgressionTarget({ ...BASE, observedLoadsKg: [30, 35, 45], recentSets: ceilingSets() });
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
    const target = computeProgressionTarget({ ...BASE, recentSets: [set({ reps: 12 })] });
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

describe("equipment context", () => {
  it("reports CONTEXT_CHANGED (no kg) when the exercise was only ever done elsewhere", () => {
    const target = computeProgressionTarget({ ...BASE, recentSets: [], hasHistoryInOtherContext: true });
    expect(target).toMatchObject({ reason: "CONTEXT_CHANGED", targetLoadKg: null, targetRepMin: 8, targetRepMax: 12 });
    expect(target.message).toMatch(/training location/i);
  });

  it("still reports NO_LOAD_HISTORY when the exercise has never been done anywhere", () => {
    const target = computeProgressionTarget({ ...BASE, recentSets: [], hasHistoryInOtherContext: false });
    expect(target.reason).toBe("NO_LOAD_HISTORY");
  });
});

describe("changed prescription context", () => {
  const finisherThen = { sets: 2, repMin: 9, repMax: 15, rirMin: 1, rirMax: 2, restSeconds: 90, sessionRole: "accessory" };

  it("doesn't carry a load across a different rep range", () => {
    const target = computeProgressionTarget({
      ...BASE,
      previousPrescription: finisherThen,
      recentSets: [set({ reps: 15, rir: 1 }), set({ reps: 15, rir: 1 })],
    });
    expect(target).toMatchObject({ reason: "CONTEXT_CHANGED", targetLoadKg: null, targetRepMin: 8, targetRepMax: 12 });
  });

  it("doesn't carry a load across a different RIR range", () => {
    const target = computeProgressionTarget({
      ...BASE,
      previousPrescription: { ...PRESCRIPTION, rirMin: 0, rirMax: 2 },
      recentSets: ceilingSets(),
    });
    expect(target.reason).toBe("CONTEXT_CHANGED");
  });

  it("judges completeness against what was prescribed then, not today's set count", () => {
    const target = computeProgressionTarget({
      ...BASE,
      previousPrescription: { ...PRESCRIPTION, sets: 2 },
      currentPrescription: { ...PRESCRIPTION, sets: 2 },
      recentSets: [set({ reps: 11 }), set({ reps: 11 })],
    });
    // 2 of 2 prescribed sets done -> progresses, not "incomplete".
    expect(target.reason).toBe("CONTINUE_REP_PROGRESSION");
  });

  it("treats legacy history (unknown prescription) as comparable", () => {
    const target = computeProgressionTarget({ ...BASE, previousPrescription: null, recentSets: ceilingSets() });
    expect(target.reason).toBe("INCREASE_LOAD");
  });

  it("still surfaces pain even when the prescription also changed", () => {
    const target = computeProgressionTarget({
      ...BASE,
      previousPrescription: finisherThen,
      recentSets: [set({ painFlag: true }), set({})],
    });
    expect(target.reason).toBe("REASSESS_DUE_TO_PAIN");
  });
});

describe("changed sets, rest or role (same rep/RIR range)", () => {
  const held = (previous: Partial<ProgressionPrescription> | null, current: Partial<ProgressionPrescription> = {}, sets = ceilingSets()) =>
    computeProgressionTarget({
      ...BASE,
      previousPrescription: previous === null ? null : { ...PRESCRIPTION, ...previous },
      currentPrescription: { ...PRESCRIPTION, ...current },
      recentSets: sets,
    });

  it.each([
    ["set count", { sets: 4 }],
    ["rest", { restSeconds: 60 }],
    ["role", { sessionRole: "main" }],
  ])("holds the last load instead of increasing it when the %s changed", (_name, previous) => {
    // These sets hit the rep ceiling at target RIR, which would be INCREASE_LOAD if nothing had changed.
    expect(held({})).toMatchObject({ reason: "INCREASE_LOAD" });
    expect(held(previous)).toMatchObject({
      reason: "PRESCRIPTION_CHANGED",
      targetLoadKg: 30,
      loadInstruction: null,
      targetRepMin: 8,
      targetRepMax: 12,
    });
  });

  it("also holds instead of reducing a load", () => {
    const failing = [set({ reps: 5, rir: 0 }), set({ reps: 5, rir: 0 }), set({ reps: 5, rir: 0 })];
    expect(held({}, {}, failing).reason).toBe("REDUCE_LOAD");
    expect(held({ restSeconds: 60 }, {}, failing).reason).toBe("PRESCRIPTION_CHANGED");
  });

  it("holds without a load for bodyweight work", () => {
    const bodyweight = [set({ loadKg: null }), set({ loadKg: null }), set({ loadKg: null })];
    expect(held({ restSeconds: 60 }, {}, bodyweight)).toMatchObject({ reason: "PRESCRIPTION_CHANGED", targetLoadKg: null });
  });

  it("never counts an unknown role (null) as a change, on either side", () => {
    expect(held({ sessionRole: null }).reason).toBe("INCREASE_LOAD");
    expect(held({}, { sessionRole: null }).reason).toBe("INCREASE_LOAD");
  });

  it("treats legacy history (unknown prescription) as unchanged", () => {
    expect(held(null).reason).toBe("INCREASE_LOAD");
  });

  it("is outranked by a changed rep or RIR range, which drops the load", () => {
    expect(held({ repMax: 15, restSeconds: 60 })).toMatchObject({ reason: "CONTEXT_CHANGED", targetLoadKg: null });
  });

  it("is outranked by pain and by invalid technique", () => {
    expect(held({ restSeconds: 60 }, {}, [set({ painFlag: true }), set({}), set({})]).reason).toBe("REASSESS_DUE_TO_PAIN");
    expect(held({ restSeconds: 60 }, {}, [set({ techniqueValid: false }), set({}), set({})]).reason).toBe("HOLD_FOR_TECHNIQUE");
  });

  it("resumes normal progression once the new conditions have been performed", () => {
    // Last session was done under the *current* rest/role/sets -> nothing differs now.
    expect(held({ restSeconds: 60 }, { restSeconds: 60 }).reason).toBe("INCREASE_LOAD");
  });
});

describe("assisted loads (more kg = easier)", () => {
  const ASSISTED = { ...BASE, loadType: "assisted" as LoadType };
  const at = (loadKg: number, reps: number, rir: number) => [1, 2, 3].map(() => set({ loadKg, reps, rir }));

  it("progresses by lowering the assistance to the nearest lower setting already used", () => {
    const target = computeProgressionTarget({ ...ASSISTED, observedLoadsKg: [30, 35, 40], recentSets: at(40, 12, 2) });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 35, loadInstruction: null });
    expect(target.message).toMatch(/assistance/);
  });

  it("infers the lower setting from the smallest observed step when none is lower yet", () => {
    const target = computeProgressionTarget({ ...ASSISTED, observedLoadsKg: [40, 45], recentSets: at(40, 12, 2) });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 35 });
  });

  it("asks for the next lower setting, never an invented kg, when the step is unknown", () => {
    const target = computeProgressionTarget({ ...ASSISTED, observedLoadsKg: [40], recentSets: at(40, 12, 2) });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null });
    expect(target.loadInstruction).toMatch(/Reduce the assistance/);
  });

  it("does not step to zero or below; it gives an instruction instead", () => {
    const target = computeProgressionTarget({ ...ASSISTED, observedLoadsKg: [5, 10], recentSets: at(5, 12, 2) });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null });
    expect(target.loadInstruction).toBeTruthy();
  });

  it("adds assistance (a higher kg) after failing at the rep floor", () => {
    const target = computeProgressionTarget({ ...ASSISTED, observedLoadsKg: [35, 40, 45], recentSets: at(40, 5, 0) });
    expect(target).toMatchObject({ reason: "REDUCE_LOAD", targetLoadKg: 45, loadInstruction: null });
    expect(target.message).toMatch(/add assistance/i);
  });

  it("keeps the same load while still working through the rep range", () => {
    const target = computeProgressionTarget({ ...ASSISTED, observedLoadsKg: [40], recentSets: at(40, 10, 2) });
    expect(target).toMatchObject({ reason: "CONTINUE_REP_PROGRESSION", targetLoadKg: 40 });
  });

  it("breaks a working-load tie toward the harder setting for each load type", () => {
    const tied = [set({ loadKg: 30, reps: 12 }), set({ loadKg: 30, reps: 12 }), set({ loadKg: 40, reps: 9 }), set({ loadKg: 40, reps: 9 })];
    // Assisted: 30 kg of help is harder than 40, so those two sets are judged (and they hit the ceiling).
    const assisted = computeProgressionTarget({ ...ASSISTED, observedLoadsKg: [30, 40], recentSets: tied, currentPrescription: { ...PRESCRIPTION, sets: 2 }, previousPrescription: { ...PRESCRIPTION, sets: 2 } });
    expect(assisted.reason).toBe("INCREASE_LOAD");
    // External: 40 kg is the harder one; its sets are below the ceiling.
    const external = computeProgressionTarget({ ...BASE, observedLoadsKg: [30, 40], recentSets: tied, currentPrescription: { ...PRESCRIPTION, sets: 2 }, previousPrescription: { ...PRESCRIPTION, sets: 2 } });
    expect(external.reason).toBe("CONTINUE_REP_PROGRESSION");
    expect(external.targetLoadKg).toBe(40);
  });

  it("treats fully removed assistance as unassisted bodyweight work", () => {
    const unassisted = [1, 2, 3].map(() => set({ loadKg: null, reps: 12, rir: 2 }));
    const target = computeProgressionTarget({ ...ASSISTED, observedLoadsKg: [40, 35], recentSets: unassisted });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null });
    expect(target.loadInstruction).toMatch(/external load|harder variation/);
  });

  it("behaves exactly as before for external loads", () => {
    expect(computeProgressionTarget({ ...BASE, observedLoadsKg: [30, 35, 40], recentSets: at(35, 12, 2) })).toMatchObject({
      reason: "INCREASE_LOAD",
      targetLoadKg: 40,
    });
  });
});

describe("loads that vary within a session", () => {
  it("judges only the sets at the working load, ignoring a lighter warm-up set", () => {
    const target = computeProgressionTarget({
      ...BASE,
      observedLoadsKg: [20, 30],
      recentSets: [
        set({ loadKg: 20, reps: 12, rir: 4 }),
        set({ loadKg: 30, reps: 12, rir: 2 }),
        set({ loadKg: 30, reps: 12, rir: 1 }),
        set({ loadKg: 30, reps: 12, rir: 2 }),
      ],
    });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 40 });
  });

  it("picks the heaviest load when two loads were used equally", () => {
    const target = computeProgressionTarget({
      ...BASE,
      previousPrescription: { ...PRESCRIPTION, sets: 2 },
      currentPrescription: { ...PRESCRIPTION, sets: 2 },
      recentSets: [set({ loadKg: 20, reps: 9 }), set({ loadKg: 30, reps: 9 })],
    });
    expect(target.targetLoadKg).toBe(30);
  });

  it("holds when too few sets were done at the working load (a mid-session drop)", () => {
    const target = computeProgressionTarget({
      ...BASE,
      recentSets: [set({ loadKg: 30, reps: 12 }), set({ loadKg: 30, reps: 12 }), set({ loadKg: 25, reps: 12 })],
    });
    expect(target).toMatchObject({ reason: "CONTINUE_CURRENT_LOAD", targetLoadKg: 30 });
  });

  it("uses the working load, not simply the final set's load", () => {
    const target = computeProgressionTarget({
      ...BASE,
      observedLoadsKg: [20, 30],
      recentSets: [
        set({ loadKg: 30, reps: 10 }),
        set({ loadKg: 30, reps: 10 }),
        set({ loadKg: 30, reps: 10 }),
        set({ loadKg: 20, reps: 12 }),
      ],
    });
    expect(target).toMatchObject({ reason: "CONTINUE_REP_PROGRESSION", targetLoadKg: 30, targetRepMin: 11 });
  });
});

describe("bodyweight work (no external load)", () => {
  const bodyweightSets = (reps: number, rir = 2) => [1, 2, 3].map(() => set({ loadKg: null, reps, rir }));

  it("progresses reps with no kg at all", () => {
    const target = computeProgressionTarget({ ...BASE, observedLoadsKg: [], recentSets: bodyweightSets(10) });
    expect(target).toMatchObject({ reason: "CONTINUE_REP_PROGRESSION", targetLoadKg: null, targetRepMin: 11 });
  });

  it("at the ceiling asks for added load or a harder variation, never a kg or a 'smallest increment'", () => {
    const target = computeProgressionTarget({ ...BASE, observedLoadsKg: [], recentSets: bodyweightSets(12) });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null });
    expect(target.loadInstruction).toBe("Add external load or move to a harder variation.");
    expect(target.message).not.toMatch(/smallest available/i);
  });

  it("below the floor at RIR 0 suggests an easier variation", () => {
    const target = computeProgressionTarget({
      ...BASE,
      observedLoadsKg: [],
      recentSets: [set({ loadKg: null, reps: 8 }), set({ loadKg: null, reps: 6, rir: 0 }), set({ loadKg: null, reps: 8 })],
    });
    expect(target).toMatchObject({ reason: "REDUCE_LOAD", targetLoadKg: null });
    expect(target.loadInstruction).toMatch(/easier variation/i);
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
  const profile: ProgressionPrescription = { sets: 3, repMin: 12, repMax: 15, rirMin: 1, rirMax: 3, restSeconds: 90, sessionRole: "accessory" };
  const base = { loadType: "external" as const, currentPrescription: profile, previousPrescription: profile, hasHistoryInOtherContext: false };
  const history = [
    set({ loadKg: 7.5, reps: 15, rir: 2 }),
    set({ loadKg: 7.5, reps: 15, rir: 2 }),
    set({ loadKg: 7.5, reps: 15, rir: 2 }),
  ];

  it("with no history gives no kg and tells the user to choose a resistance", () => {
    const target = computeProgressionTarget({ ...base, recentSets: [], observedLoadsKg: [] });
    expect(target).toMatchObject({ reason: "NO_LOAD_HISTORY", targetLoadKg: null });
  });

  it("requests the smallest available increment after 7.5kg x 15 @2 x3 with no known step", () => {
    const target = computeProgressionTarget({ ...base, recentSets: history, observedLoadsKg: [7.5] });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: null, targetRepMin: 12, targetRepMax: 15 });
    expect(target.loadInstruction).toBeTruthy();
  });

  it("uses the known increment when the athlete has used 5kg and 7.5kg before", () => {
    const target = computeProgressionTarget({ ...base, recentSets: history, observedLoadsKg: [5, 7.5] });
    expect(target).toMatchObject({ reason: "INCREASE_LOAD", targetLoadKg: 10, targetRepMin: 12 });
  });
});
