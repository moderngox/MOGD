import type { Sex, ActivityLevel, PrimaryGoal } from "../assessment/options";
import type { EnergyDirection } from "../physique/goalStrategy";

/**
 * Deterministic nutrition functions (docs/ARCHITECTURE.md §16). Every
 * formula here is a standard, citable one — not invented — but the
 * specific coefficients (activity multipliers, deficit/surplus
 * percentages, protein-per-kg targets) are the kind of numeric policy
 * docs/AI_AND_SAFETY.md says needs dedicated review before driving
 * unsupervised recommendations. Treat the *shape* of these functions as
 * settled and the *constants* as provisional defaults — see
 * docs/AI_AND_SAFETY.md and CLAUDE.md's caution against mistaking
 * illustrative values for approved physiological constants.
 *
 * AI may explain these numbers; nothing may override them
 * (docs/AI_AND_SAFETY.md, CLAUDE.md rule 4).
 */

/**
 * Mifflin-St Jeor equation (Mifflin MD, St Jeor ST, et al. "A new
 * predictive equation for resting energy expenditure in healthy
 * individuals." Am J Clin Nutr. 1990) — the most widely validated resting
 * energy expenditure estimate for the general population.
 */
export function estimateBMR(input: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === "male" ? base + 5 : base - 161;
}

/**
 * Standard PAL (physical activity level) multipliers applied to BMR,
 * following the conventional sedentary→very-active scale used alongside
 * Mifflin-St Jeor in sports nutrition practice.
 */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
};

export function estimateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

/**
 * Percentage adjustment off TDEE per energy direction. A deficit/surplus
 * this size is a common starting-point convention, not a personalized
 * clinical prescription.
 */
const ENERGY_DIRECTION_ADJUSTMENT: Record<EnergyDirection, number> = {
  deficit: -0.2,
  slight_deficit: -0.1,
  maintenance: 0,
  slight_surplus: 0.05,
  surplus: 0.15,
};

export function deriveEnergyTarget(tdee: number, energyDirection: EnergyDirection): number {
  return tdee * (1 + ENERGY_DIRECTION_ADJUSTMENT[energyDirection]);
}

/**
 * Grams of protein per kg bodyweight. Within the range the International
 * Society of Sports Nutrition's position stand supports for resistance-
 * trained individuals (1.6-2.2 g/kg); biased higher during a deficit,
 * where higher protein intake helps preserve lean mass.
 */
const PROTEIN_G_PER_KG: Record<PrimaryGoal, number> = {
  fat_loss: 2.2,
  recomposition: 2.0,
  muscle_gain: 1.8,
  strength: 1.8,
};

export function deriveProteinTarget(weightKg: number, goal: PrimaryGoal): number {
  return weightKg * PROTEIN_G_PER_KG[goal];
}

/**
 * Fat floor: the higher of a per-kg minimum (0.6 g/kg — a commonly cited
 * lower bound for hormonal/health function) or 25% of total energy,
 * converted at 9 kcal/g.
 */
export function deriveFatMinimum(weightKg: number, energyTargetKcal: number): number {
  const perKgFloor = weightKg * 0.6;
  const percentFloor = (energyTargetKcal * 0.25) / 9;
  return Math.max(perKgFloor, percentFloor);
}

/** Whatever energy remains after protein (4 kcal/g) and fat (9 kcal/g), floored at 0. */
export function deriveCarbohydrateTarget(
  energyTargetKcal: number,
  proteinG: number,
  fatG: number,
): number {
  const remaining = energyTargetKcal - proteinG * 4 - fatG * 9;
  return Math.max(0, remaining / 4);
}
