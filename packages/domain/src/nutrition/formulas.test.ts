import { describe, expect, it } from "vitest";
import {
  estimateBMR,
  estimateTDEE,
  deriveEnergyTarget,
  deriveProteinTarget,
  deriveFatMinimum,
  deriveCarbohydrateTarget,
} from "./formulas";

describe("estimateBMR (Mifflin-St Jeor)", () => {
  it("matches the hand-computed value for a male", () => {
    // 10*80 + 6.25*180 - 5*30 + 5
    expect(estimateBMR({ sex: "male", weightKg: 80, heightCm: 180, age: 30 })).toBeCloseTo(1780);
  });

  it("matches the hand-computed value for a female (formula supports both sexes)", () => {
    // 10*80 + 6.25*180 - 5*30 - 161
    expect(estimateBMR({ sex: "female", weightKg: 80, heightCm: 180, age: 30 })).toBeCloseTo(1614);
  });

  it("is monotonically decreasing in age, all else equal", () => {
    const younger = estimateBMR({ sex: "male", weightKg: 80, heightCm: 180, age: 25 });
    const older = estimateBMR({ sex: "male", weightKg: 80, heightCm: 180, age: 45 });
    expect(older).toBeLessThan(younger);
  });
});

describe("estimateTDEE", () => {
  it("scales BMR by the activity multiplier", () => {
    expect(estimateTDEE(1780, "moderately_active")).toBeCloseTo(1780 * 1.55);
    expect(estimateTDEE(1780, "sedentary")).toBeCloseTo(1780 * 1.2);
  });

  it("is monotonically increasing across the activity scale", () => {
    const levels = ["sedentary", "lightly_active", "moderately_active", "very_active"] as const;
    const values = levels.map((l) => estimateTDEE(1780, l));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]!);
    }
  });
});

describe("deriveEnergyTarget", () => {
  it("applies a deficit below TDEE and a surplus above it", () => {
    expect(deriveEnergyTarget(2760, "deficit")).toBeCloseTo(2760 * 0.8);
    expect(deriveEnergyTarget(2760, "surplus")).toBeCloseTo(2760 * 1.15);
  });

  it("leaves maintenance unchanged", () => {
    expect(deriveEnergyTarget(2760, "maintenance")).toBeCloseTo(2760);
  });
});

describe("deriveProteinTarget", () => {
  it("scales with bodyweight and is higher for fat_loss than muscle_gain", () => {
    expect(deriveProteinTarget(80, "fat_loss")).toBeCloseTo(80 * 2.2);
    const fatLoss = deriveProteinTarget(80, "fat_loss");
    const muscleGain = deriveProteinTarget(80, "muscle_gain");
    expect(fatLoss).toBeGreaterThan(muscleGain);
  });
});

describe("deriveFatMinimum", () => {
  it("uses the per-kg floor when it exceeds the percent-of-energy floor", () => {
    // 80kg * 0.6 = 48g (=432kcal) vs 25% of a very low energy target
    expect(deriveFatMinimum(80, 1600)).toBeCloseTo(Math.max(48, (1600 * 0.25) / 9));
  });

  it("uses the percent-of-energy floor when energy is high relative to bodyweight", () => {
    const energyTarget = 4000;
    const expected = (energyTarget * 0.25) / 9;
    expect(deriveFatMinimum(60, energyTarget)).toBeCloseTo(expected);
    expect(expected).toBeGreaterThan(60 * 0.6);
  });
});

describe("deriveCarbohydrateTarget", () => {
  it("fills the remainder after protein and fat", () => {
    // 2483.1 - 160*4 - 68.975*9, /4
    const result = deriveCarbohydrateTarget(2483.1, 160, 68.975);
    expect(result).toBeCloseTo((2483.1 - 640 - 620.775) / 4);
  });

  it("floors at 0 rather than going negative when protein+fat exceed the energy target", () => {
    expect(deriveCarbohydrateTarget(1000, 150, 80)).toBe(0);
  });
});
