import type { Sex, ActivityLevel, PrimaryGoal } from "../assessment/options";
import type { EnergyDirection } from "../physique/goalStrategy";
import {
  estimateBMR,
  estimateTDEE,
  deriveEnergyTarget,
  deriveProteinTarget,
  deriveFatMinimum,
  deriveCarbohydrateTarget,
} from "./formulas";

export interface NutritionTarget {
  bmr: number;
  tdee: number;
  energyDirection: EnergyDirection;
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
}

export interface ComputeNutritionTargetInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  primaryGoal: PrimaryGoal;
  energyDirection: EnergyDirection;
}

/** Pure composition of the formulas in formulas.ts — no I/O, no persistence. */
export function computeNutritionTarget(input: ComputeNutritionTargetInput): NutritionTarget {
  const bmr = estimateBMR(input);
  const tdee = estimateTDEE(bmr, input.activityLevel);
  const energyKcal = deriveEnergyTarget(tdee, input.energyDirection);
  const proteinG = deriveProteinTarget(input.weightKg, input.primaryGoal);
  const fatG = deriveFatMinimum(input.weightKg, energyKcal);
  const carbG = deriveCarbohydrateTarget(energyKcal, proteinG, fatG);

  return { bmr, tdee, energyDirection: input.energyDirection, energyKcal, proteinG, fatG, carbG };
}
