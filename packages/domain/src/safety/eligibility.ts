/**
 * Deterministic eligibility gate, run at assessment submission
 * (docs/IMPLEMENTATION_PLAN.md M1 exit: "eligibility rules prevent
 * unsupported plan generation"). Deliberately limited to two policy-level
 * gates that are already explicit product decisions, not invented
 * physiological constants:
 *
 * - male-only: docs/PRODUCT.md/CLAUDE.md state this is a male-only V1
 *   product.
 * - adult-only: docs/AI_AND_SAFETY.md lists "minors" among requests outside
 *   scope.
 *
 * Deliberately NOT implemented here: weight/BMI/body-composition extremes,
 * injury/medical severity, eating-disorder signals. Those require reviewed
 * clinical thresholds (docs/AI_AND_SAFETY.md "Define and review numerical
 * safety policies before enabling automatic target generation") that do not
 * exist yet — fabricating them here would violate that instruction, not
 * satisfy it. An ineligible-for-those-reasons user is a gap this module
 * does not yet close; revisit before M4 (plan generation).
 */
export interface EligibilityInput {
  sex: "male" | "female";
  age: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const reasons: string[] = [];

  if (input.sex !== "male") {
    reasons.push("MOGᴰ is a male-only product in this version.");
  }

  if (input.age < 18) {
    reasons.push("You must be 18 or older to use MOGᴰ.");
  }

  return { eligible: reasons.length === 0, reasons };
}
