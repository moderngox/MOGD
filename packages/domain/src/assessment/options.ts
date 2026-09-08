/**
 * Enumerated option sets for the assessment steps (docs/PRODUCT.md §6).
 * Where the product doc names a field ("consistency", "cooking preference")
 * without enumerating its values, the option set below is a provisional,
 * reasonable default — illustrative like the rest of this codebase's
 * example values, not a fixed product decision. Adjust freely; every value
 * here is referenced only by the Zod schemas in this module and the
 * onboarding UI, so changing a list is a contained, low-risk edit.
 */

export const PRIMARY_GOAL_OPTIONS = [
  "fat_loss",
  "recomposition",
  "muscle_gain",
  "strength",
] as const;
export type PrimaryGoal = (typeof PRIMARY_GOAL_OPTIONS)[number];

export const EXPERIENCE_LEVEL_OPTIONS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVEL_OPTIONS)[number];

export const TRAINING_CONSISTENCY_OPTIONS = [
  "consistent",
  "somewhat_consistent",
  "inconsistent",
  "returning_after_break",
] as const;
export type TrainingConsistency = (typeof TRAINING_CONSISTENCY_OPTIONS)[number];

export const ACTIVITY_LEVEL_OPTIONS = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVEL_OPTIONS)[number];

export const TRAINING_CONTEXT_OPTIONS = ["gym", "home", "outdoor"] as const;
export type TrainingContext = (typeof TRAINING_CONTEXT_OPTIONS)[number];

// Shared with the exercise catalog's equipment requirements — see
// exercises/options.ts for why this lives there, not here.
export { EQUIPMENT_OPTIONS, type Equipment } from "../exercises/options";

export const DIETARY_PREFERENCE_OPTIONS = [
  "standard",
  "vegetarian",
  "vegan",
  "pescatarian",
  "halal",
  "kosher",
  "other",
] as const;
export type DietaryPreference = (typeof DIETARY_PREFERENCE_OPTIONS)[number];

export const COOKING_PREFERENCE_OPTIONS = [
  "enjoys_cooking",
  "minimal_cooking",
  "meal_prep",
  "eating_out_often",
] as const;
export type CookingPreference = (typeof COOKING_PREFERENCE_OPTIONS)[number];

export const SEX_OPTIONS = ["male", "female"] as const;
export type Sex = (typeof SEX_OPTIONS)[number];
