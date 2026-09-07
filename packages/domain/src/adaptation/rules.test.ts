import { describe, expect, it } from "vitest";
import { decideAdaptation, NUTRITION_ADHERENCE_THRESHOLD } from "./rules";

describe("decideAdaptation", () => {
  it("returns insufficient_data when there's no trend yet", () => {
    const result = decideAdaptation({
      expectedWeeklyRateKg: null,
      actualWeeklyRateKg: null,
      nutritionAdherencePercent: 90,
    });
    expect(result.type).toBe("insufficient_data");
    expect(result.calorieAdjustmentKcal).toBe(0);
  });

  it("matches docs/PRODUCT.md §13's worked example: good adherence, stalled progress -> adjust calories", () => {
    const result = decideAdaptation({
      expectedWeeklyRateKg: -0.4,
      actualWeeklyRateKg: -0.05,
      nutritionAdherencePercent: 92,
    });
    expect(result.type).toBe("adjust_calories");
    // Losing less than expected -> needs a bigger deficit -> decrease energy.
    expect(result.calorieAdjustmentKcal).toBeLessThan(0);
  });

  it("matches docs/PRODUCT.md §13's worked example: poor adherence -> address adherence, not calories", () => {
    const result = decideAdaptation({
      expectedWeeklyRateKg: -0.4,
      actualWeeklyRateKg: -0.05,
      nutritionAdherencePercent: 54,
    });
    expect(result.type).toBe("address_adherence");
    expect(result.calorieAdjustmentKcal).toBe(0);
  });

  it("treats adherence right at the threshold as sufficient", () => {
    const result = decideAdaptation({
      expectedWeeklyRateKg: -0.4,
      actualWeeklyRateKg: -0.4,
      nutritionAdherencePercent: NUTRITION_ADHERENCE_THRESHOLD,
    });
    expect(result.type).not.toBe("address_adherence");
  });

  it("holds when the actual trend is close to expected", () => {
    const result = decideAdaptation({
      expectedWeeklyRateKg: -0.4,
      actualWeeklyRateKg: -0.38,
      nutritionAdherencePercent: 90,
    });
    expect(result.type).toBe("hold");
  });

  it("increases energy when progress is far faster than expected (overshoot)", () => {
    const result = decideAdaptation({
      expectedWeeklyRateKg: -0.4,
      actualWeeklyRateKg: -0.9,
      nutritionAdherencePercent: 90,
    });
    expect(result.type).toBe("adjust_calories");
    expect(result.calorieAdjustmentKcal).toBeGreaterThan(0);
  });

  it("applies the same correction direction for a surplus goal that's undershooting", () => {
    const result = decideAdaptation({
      expectedWeeklyRateKg: 0.3,
      actualWeeklyRateKg: 0.05,
      nutritionAdherencePercent: 90,
    });
    expect(result.type).toBe("adjust_calories");
    // Gaining less than expected -> needs more surplus -> increase energy.
    expect(result.calorieAdjustmentKcal).toBeGreaterThan(0);
  });

  it("holds at maintenance when weight is stable", () => {
    const result = decideAdaptation({
      expectedWeeklyRateKg: 0,
      actualWeeklyRateKg: 0.05,
      nutritionAdherencePercent: 90,
    });
    expect(result.type).toBe("hold");
  });
});
