import type { NutritionTarget } from "./computeNutritionTarget";

/**
 * Provisional safety bounds, not reviewed clinical thresholds
 * (docs/AI_AND_SAFETY.md: "Define and review numerical safety policies
 * before enabling automatic target generation"). These exist so an
 * extreme combination of inputs (very low bodyweight + an aggressive
 * deficit, for instance) is rejected rather than silently persisted —
 * the bound values themselves need review before any unsupervised flow
 * relies on them.
 */
export const MIN_SAFE_ENERGY_KCAL = 1500;
export const MAX_SANE_ENERGY_KCAL = 6000;

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

/**
 * Deterministic validation (CLAUDE.md rule 4). Rejects explicitly rather
 * than clamping or silently adjusting a target that fails a check — a
 * caller must decide what to do with an invalid result, this function
 * never coerces one into something that looks safe.
 */
export function validateNutritionTarget(target: NutritionTarget): ValidationResult {
  const reasons: string[] = [];

  if (target.energyKcal < MIN_SAFE_ENERGY_KCAL) {
    reasons.push(
      `Energy target (${Math.round(target.energyKcal)} kcal) is below the ${MIN_SAFE_ENERGY_KCAL} kcal floor for unsupervised use.`,
    );
  }
  if (target.energyKcal > MAX_SANE_ENERGY_KCAL) {
    reasons.push(`Energy target (${Math.round(target.energyKcal)} kcal) exceeds the ${MAX_SANE_ENERGY_KCAL} kcal sanity ceiling.`);
  }
  if (target.proteinG < 0 || target.fatG < 0 || target.carbG < 0) {
    reasons.push("A macro target computed as negative — check inputs.");
  }

  const proteinAndFatKcal = target.proteinG * 4 + target.fatG * 9;
  if (proteinAndFatKcal > target.energyKcal) {
    reasons.push(
      "Protein and fat minimums alone exceed the energy target — this energy target is too aggressive for this bodyweight.",
    );
  }

  return { valid: reasons.length === 0, reasons };
}
