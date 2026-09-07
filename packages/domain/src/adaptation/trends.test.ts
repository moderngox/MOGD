import { describe, expect, it } from "vitest";
import { computeActualWeeklyRateKg, computeExpectedWeeklyRateKg } from "./trends";

describe("computeActualWeeklyRateKg", () => {
  it("returns null with fewer than 2 readings", () => {
    expect(computeActualWeeklyRateKg([])).toBeNull();
    expect(
      computeActualWeeklyRateKg([{ averageWeightKg: 80, completedAt: new Date() }]),
    ).toBeNull();
  });

  it("computes the linear rate between the earliest and latest reading", () => {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const rate = computeActualWeeklyRateKg([
      { averageWeightKg: 80, completedAt: new Date(now - 14 * day) },
      { averageWeightKg: 79, completedAt: new Date(now) },
    ]);
    // -1kg over 2 weeks = -0.5 kg/week
    expect(rate).toBeCloseTo(-0.5);
  });

  it("is unaffected by the array's input order", () => {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const readings = [
      { averageWeightKg: 79, completedAt: new Date(now) },
      { averageWeightKg: 80, completedAt: new Date(now - 7 * day) },
    ];
    expect(computeActualWeeklyRateKg(readings)).toBeCloseTo(-1);
  });
});

describe("computeExpectedWeeklyRateKg", () => {
  it("is negative for a deficit", () => {
    const rate = computeExpectedWeeklyRateKg({ tdee: 2760, energyKcal: 2483 });
    expect(rate).toBeLessThan(0);
  });

  it("is positive for a surplus", () => {
    const rate = computeExpectedWeeklyRateKg({ tdee: 2760, energyKcal: 3174 });
    expect(rate).toBeGreaterThan(0);
  });

  it("is zero at maintenance", () => {
    expect(computeExpectedWeeklyRateKg({ tdee: 2760, energyKcal: 2760 })).toBe(0);
  });
});
