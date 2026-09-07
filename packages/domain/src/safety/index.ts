/**
 * safety — eligibility rules, scope limits and output validation domain
 * boundary. checkEligibility covers only reviewed, policy-level gates
 * (male-only, adult-only) — see eligibility.ts for why clinical/weight
 * thresholds are deliberately not stubbed with invented numbers here.
 */
export { checkEligibility, type EligibilityInput, type EligibilityResult } from "./eligibility";
