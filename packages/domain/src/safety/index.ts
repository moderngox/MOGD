/**
 * safety — eligibility rules, scope limits and output validation domain
 * boundary. checkEligibility covers only reviewed, policy-level gates
 * (male-only, adult-only) — see eligibility.ts for why clinical/weight
 * thresholds are deliberately not stubbed with invented numbers here.
 * restrictions.ts holds the admin-managed (initially empty) taxonomy that lets a
 * reported limitation filter exercises without inventing clinical categories.
 */
export { checkEligibility, type EligibilityInput, type EligibilityResult } from "./eligibility";
export {
  assertKnownRestrictionKeys,
  conflictingRestrictions,
  createRestrictionCategory,
  createRestrictionCategoryInput,
  deleteRestrictionCategory,
  getRestrictionUsage,
  listRestrictionCategories,
  renameRestrictionCategory,
  restrictionKeySchema,
  restrictionLabelSchema,
  DuplicateRestrictionKeyError,
  RestrictionInUseError,
  RestrictionNotFoundError,
  UnknownRestrictionError,
  type CreateRestrictionCategoryInput,
  type RestrictionCategory,
} from "./restrictions";
