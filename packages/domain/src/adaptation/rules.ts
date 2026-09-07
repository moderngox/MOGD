/**
 * Deterministic adaptation rule (docs/ARCHITECTURE.md §18,
 * docs/PRODUCT.md §13's worked example, docs/AI_AND_SAFETY.md: "Distinguish
 * poor adherence from an ineffective intervention"). Pure function — no
 * I/O, no AI. "Optional AI Interpretation" sits between this and the
 * safety validation step in the architecture's own pipeline diagram; that
 * slot is M6 scope, not implemented here.
 */

export const NUTRITION_ADHERENCE_THRESHOLD = 70;
export const RATE_DEVIATION_THRESHOLD_KG_PER_WEEK = 0.15;
export const CALORIE_ADJUSTMENT_STEP_KCAL = 150;

export type AdaptationDecisionType =
  | "insufficient_data"
  | "hold"
  | "adjust_calories"
  | "address_adherence";

export interface AdaptationDecisionInput {
  expectedWeeklyRateKg: number | null;
  actualWeeklyRateKg: number | null;
  nutritionAdherencePercent: number;
}

export interface AdaptationDecision {
  type: AdaptationDecisionType;
  /** Signed; 0 unless type is "adjust_calories". */
  calorieAdjustmentKcal: number;
  reason: string;
}

export function decideAdaptation(input: AdaptationDecisionInput): AdaptationDecision {
  if (input.expectedWeeklyRateKg === null || input.actualWeeklyRateKg === null) {
    return {
      type: "insufficient_data",
      calorieAdjustmentKcal: 0,
      reason: "Not enough check-in history yet to evaluate a trend — establishing a baseline.",
    };
  }

  // docs/PRODUCT.md §13: when adherence is poor, address that first rather
  // than assuming the intervention itself failed — checked before looking
  // at the trend at all.
  if (input.nutritionAdherencePercent < NUTRITION_ADHERENCE_THRESHOLD) {
    return {
      type: "address_adherence",
      calorieAdjustmentKcal: 0,
      reason: `Nutrition adherence was ${input.nutritionAdherencePercent}%, below the ${NUTRITION_ADHERENCE_THRESHOLD}% threshold — addressing execution before adjusting targets.`,
    };
  }

  // delta > 0 means the actual rate trails what the current energy target
  // predicts (whether that means losing less than expected, or gaining
  // less than expected) — since actual rate increases monotonically with
  // energyKcal, correcting toward the expected rate always means
  // increasing energy when delta > 0 and decreasing it when delta < 0,
  // regardless of whether the underlying goal is a deficit or a surplus.
  const delta = input.expectedWeeklyRateKg - input.actualWeeklyRateKg;

  if (Math.abs(delta) <= RATE_DEVIATION_THRESHOLD_KG_PER_WEEK) {
    return {
      type: "hold",
      calorieAdjustmentKcal: 0,
      reason: `Actual trend (${input.actualWeeklyRateKg.toFixed(2)} kg/week) is close to the expected ${input.expectedWeeklyRateKg.toFixed(2)} kg/week — plan is working as expected.`,
    };
  }

  const calorieAdjustmentKcal = delta > 0 ? CALORIE_ADJUSTMENT_STEP_KCAL : -CALORIE_ADJUSTMENT_STEP_KCAL;
  return {
    type: "adjust_calories",
    calorieAdjustmentKcal,
    reason: `Actual trend (${input.actualWeeklyRateKg.toFixed(2)} kg/week) deviates from the expected ${input.expectedWeeklyRateKg.toFixed(2)} kg/week with good adherence (${input.nutritionAdherencePercent}%) — applying a small ${calorieAdjustmentKcal > 0 ? "increase" : "decrease"} to the energy target.`,
  };
}
