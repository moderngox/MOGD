import { describe, expect, it } from "vitest";
import { validateNutritionTarget, MIN_SAFE_ENERGY_KCAL, MAX_SANE_ENERGY_KCAL } from "./validate";
import type { NutritionTarget } from "./computeNutritionTarget";

const valid: NutritionTarget = {
  bmr: 1780,
  tdee: 2759,
  energyDirection: "slight_deficit",
  energyKcal: 2483,
  proteinG: 160,
  fatG: 69,
  carbG: 305,
};

describe("validateNutritionTarget", () => {
  it("accepts a well-formed target", () => {
    expect(validateNutritionTarget(valid)).toEqual({ valid: true, reasons: [] });
  });

  it("rejects an energy target below the safety floor", () => {
    const result = validateNutritionTarget({ ...valid, energyKcal: MIN_SAFE_ENERGY_KCAL - 1 });
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toMatch(/below the/);
  });

  it("rejects an energy target above the sanity ceiling", () => {
    const result = validateNutritionTarget({ ...valid, energyKcal: MAX_SANE_ENERGY_KCAL + 1 });
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toMatch(/exceeds/);
  });

  it("rejects a negative macro", () => {
    const result = validateNutritionTarget({ ...valid, carbG: -10 });
    expect(result.valid).toBe(false);
  });

  it("rejects when protein and fat minimums alone exceed the energy target", () => {
    const result = validateNutritionTarget({
      ...valid,
      energyKcal: 1600,
      proteinG: 200,
      fatG: 100,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("too aggressive"))).toBe(true);
  });

  it("accumulates multiple reasons when several checks fail", () => {
    const result = validateNutritionTarget({
      ...valid,
      energyKcal: MIN_SAFE_ENERGY_KCAL - 1,
      carbG: -5,
    });
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
