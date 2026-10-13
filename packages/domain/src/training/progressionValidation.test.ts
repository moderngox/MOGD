import { describe, expect, it } from "vitest";
import type { LoadType } from "../exercises/options";
import {
  computeProgressionTarget,
  type LoggedSetForProgression,
  type ProgressionPrescription,
  type ProgressionTarget,
} from "./progression";
import { validateProgressionTarget } from "./progressionValidation";

const PRESCRIPTION: ProgressionPrescription = { sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 3, restSeconds: 90, sessionRole: "accessory" };

const valid = (overrides: Partial<ProgressionTarget> = {}): ProgressionTarget => ({
  targetLoadKg: 30,
  targetRepMin: 9,
  targetRepMax: 12,
  reason: "CONTINUE_REP_PROGRESSION",
  loadInstruction: null,
  message: "Same load, one more rep than your weakest set last time.",
  ...overrides,
});

const context = (
  observedLoadsKg: number[] = [30],
  extra: { loadType?: LoadType; recentLoadsKg?: (number | null)[] } = {},
) => ({
  currentPrescription: PRESCRIPTION,
  observedLoadsKg,
  loadType: "external" as LoadType,
  recentLoadsKg: [30, 30, 30] as (number | null)[],
  ...extra,
});

describe("validateProgressionTarget", () => {
  it("accepts a well-formed recommendation", () => {
    expect(validateProgressionTarget(valid(), context())).toEqual([]);
  });

  it("rejects an unknown reason", () => {
    const failures = validateProgressionTarget(valid({ reason: "MAKE_IT_UP" as never }), context());
    expect(failures.join(" ")).toMatch(/unknown reason/);
  });

  it("rejects a load on NO_LOAD_HISTORY and on CONTEXT_CHANGED", () => {
    for (const reason of ["NO_LOAD_HISTORY", "CONTEXT_CHANGED"] as const) {
      const failures = validateProgressionTarget(valid({ reason, targetLoadKg: 30 }), context());
      expect(failures.join(" ")).toMatch(new RegExp(`${reason} must not carry a load`));
    }
  });

  it("accepts a held PRESCRIPTION_CHANGED load that was actually logged", () => {
    expect(validateProgressionTarget(valid({ reason: "PRESCRIPTION_CHANGED", targetLoadKg: 30 }), context([30]))).toEqual([]);
    expect(validateProgressionTarget(valid({ reason: "PRESCRIPTION_CHANGED", targetLoadKg: null }), context([]))).toEqual([]);
  });

  it("rejects a PRESCRIPTION_CHANGED load that is only an inferred step, and one with an instruction", () => {
    // 32.5 is one observed step above 30 - legal for INCREASE_LOAD, never for a hold.
    const stepped = validateProgressionTarget(
      valid({ reason: "PRESCRIPTION_CHANGED", targetLoadKg: 32.5 }),
      context([27.5, 30]),
    );
    expect(stepped.join(" ")).toMatch(/must hold a logged load/);
    const withInstruction = validateProgressionTarget(
      valid({ reason: "PRESCRIPTION_CHANGED", loadInstruction: "Add some." }),
      context(),
    );
    expect(withInstruction.join(" ")).toMatch(/must not carry a load instruction/);
  });

  it("requires a numbered INCREASE_LOAD to move the kg the way the load type says", () => {
    const observed = [25, 27.5, 30, 32.5];
    // External: harder = more kg.
    expect(validateProgressionTarget(valid({ reason: "INCREASE_LOAD", targetLoadKg: 32.5 }), context(observed))).toEqual([]);
    expect(validateProgressionTarget(valid({ reason: "INCREASE_LOAD", targetLoadKg: 27.5 }), context(observed)).join(" ")).toMatch(
      /must raise the kg/,
    );
    expect(validateProgressionTarget(valid({ reason: "REDUCE_LOAD", targetLoadKg: 32.5 }), context(observed)).join(" ")).toMatch(
      /must lower the kg/,
    );
    // Assisted: harder = less assistance, so the same numbers are wrong the other way round.
    const assisted = { loadType: "assisted" as const };
    expect(validateProgressionTarget(valid({ reason: "INCREASE_LOAD", targetLoadKg: 27.5 }), context(observed, assisted))).toEqual([]);
    expect(validateProgressionTarget(valid({ reason: "INCREASE_LOAD", targetLoadKg: 32.5 }), context(observed, assisted)).join(" ")).toMatch(
      /must lower the kg/,
    );
    expect(validateProgressionTarget(valid({ reason: "REDUCE_LOAD", targetLoadKg: 32.5 }), context(observed, assisted))).toEqual([]);
    expect(validateProgressionTarget(valid({ reason: "REDUCE_LOAD", targetLoadKg: 27.5 }), context(observed, assisted)).join(" ")).toMatch(
      /must raise the kg/,
    );
  });

  it("rejects a load instruction on a reason that never takes one", () => {
    const failures = validateProgressionTarget(valid({ loadInstruction: "Increase it." }), context());
    expect(failures.join(" ")).toMatch(/must not carry a load instruction/);
  });

  it("requires an instruction when INCREASE_LOAD or REDUCE_LOAD has no number", () => {
    for (const reason of ["INCREASE_LOAD", "REDUCE_LOAD"] as const) {
      const failures = validateProgressionTarget(valid({ reason, targetLoadKg: null, loadInstruction: null }), context());
      expect(failures.join(" ")).toMatch(/without a load must carry an instruction/);
    }
  });

  it("rejects a load and an instruction together on INCREASE_LOAD", () => {
    const failures = validateProgressionTarget(
      valid({ reason: "INCREASE_LOAD", targetLoadKg: 30, loadInstruction: "Add some." }),
      context(),
    );
    expect(failures.join(" ")).toMatch(/with a load must not also carry an instruction/);
  });

  it("rejects non-finite, non-positive and over-limit loads", () => {
    for (const load of [Number.NaN, Number.POSITIVE_INFINITY, 0, -5, 501]) {
      const failures = validateProgressionTarget(valid({ targetLoadKg: load }), context([30, load]));
      expect(failures.join(" ")).toMatch(/outside 0-500 kg/);
    }
  });

  it("rejects a load that isn't backed by logged history", () => {
    const failures = validateProgressionTarget(valid({ targetLoadKg: 42.5 }), context([30]));
    expect(failures.join(" ")).toMatch(/not backed by logged history/);
  });

  it("accepts a used load or one smallest-observed-step away, and nothing else", () => {
    const observed = [25, 27.5, 30];
    expect(validateProgressionTarget(valid({ targetLoadKg: 27.5 }), context(observed))).toEqual([]);
    expect(validateProgressionTarget(valid({ targetLoadKg: 32.5 }), context(observed))).toEqual([]);
    expect(validateProgressionTarget(valid({ targetLoadKg: 22.5 }), context(observed))).toEqual([]);
    expect(validateProgressionTarget(valid({ targetLoadKg: 35 }), context(observed)).join(" ")).toMatch(/invented/);
  });

  it("rejects inverted and out-of-range target reps", () => {
    expect(validateProgressionTarget(valid({ targetRepMin: 12, targetRepMax: 9 }), context()).join(" ")).toMatch(/inverted/);
    expect(validateProgressionTarget(valid({ targetRepMin: 4 }), context()).join(" ")).toMatch(/fall outside the prescribed/);
    expect(validateProgressionTarget(valid({ targetRepMax: 20 }), context()).join(" ")).toMatch(/fall outside the prescribed/);
  });

  it("rejects an empty explanation", () => {
    expect(validateProgressionTarget(valid({ message: "  " }), context()).join(" ")).toMatch(/missing explanation/);
  });
});

describe("independent oracle for computeProgressionTarget", () => {
  const set = (loadKg: number | null, reps: number, rir: number | null, flag?: "pain" | "technique"): LoggedSetForProgression => ({
    loadKg,
    reps,
    rir,
    painFlag: flag === "pain" ? true : null,
    techniqueValid: flag === "technique" ? false : null,
  });

  const loadPatterns: (number | null)[][] = [
    [30, 30, 30],
    [30, 30, 25],
    [20, 30, 30, 30],
    [null, null, null],
    [30, null, 30],
    [30],
  ];
  const repPatterns = [
    [12, 12, 12, 12],
    [10, 10, 10, 10],
    [6, 6, 6, 6],
    [12, 11, 12, 9],
    [15, 15, 15, 15],
  ];
  const rirChoices: (number | null)[] = [2, 0, null];
  const flags: (undefined | "pain" | "technique")[] = [undefined, "pain", "technique"];
  const extraObserved: number[][] = [[], [25], [20, 22.5, 25, 35]];
  const previous: (ProgressionPrescription | null)[] = [
    PRESCRIPTION,
    null,
    { sets: 2, repMin: 9, repMax: 15, rirMin: 1, rirMax: 2, restSeconds: 90, sessionRole: "accessory" },
    { ...PRESCRIPTION, restSeconds: 60 },
    { ...PRESCRIPTION, sets: 4, sessionRole: "main" },
  ];

  it("never produces a recommendation the validator rejects, across a grid of histories", () => {
    let checked = 0;
    for (const loads of loadPatterns)
      for (const reps of repPatterns)
        for (const rir of rirChoices)
          for (const flag of flags)
            for (const extra of extraObserved)
              for (const prev of previous)
                for (const loadType of ["external", "assisted"] as const)
                for (const elsewhere of [false, true]) {
                  const recentSets = loads.map((load, i) => set(load, reps[i % reps.length]!, rir, i === 1 ? flag : undefined));
                  const observedLoadsKg = [...loads.filter((l): l is number => l !== null), ...extra];

                  const target = computeProgressionTarget({
                    loadType,
                    recentSets,
                    previousPrescription: prev,
                    currentPrescription: PRESCRIPTION,
                    observedLoadsKg,
                    hasHistoryInOtherContext: elsewhere,
                  });
                  const failures = validateProgressionTarget(target, {
                    currentPrescription: PRESCRIPTION,
                    observedLoadsKg,
                    loadType,
                    recentLoadsKg: recentSets.map((s) => s.loadKg),
                  });
                  expect(failures, JSON.stringify({ recentSets, prev, observedLoadsKg, target })).toEqual([]);
                  checked++;
                }

    // Also the no-history case, in and out of another context.
    for (const elsewhere of [false, true]) {
      const target = computeProgressionTarget({
        loadType: "external",
        recentSets: [],
        previousPrescription: null,
        currentPrescription: PRESCRIPTION,
        observedLoadsKg: [],
        hasHistoryInOtherContext: elsewhere,
      });
      expect(validateProgressionTarget(target, context([]))).toEqual([]);
    }
    expect(checked).toBeGreaterThan(3000);
  });
});
