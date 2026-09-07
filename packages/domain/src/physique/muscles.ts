/**
 * Canonical muscle groups (docs/ARCHITECTURE.md §6). This is the anatomy
 * taxonomy exercises reference (primaryMuscles/secondaryMuscles) — kept
 * restrained per that section's instruction, not expanded speculatively.
 * Distinct from the 7 broad UI physique-priority options in priorities.ts:
 * those are what a user picks, this is what an exercise actually targets.
 */
export const CANONICAL_MUSCLE_GROUPS = [
  "upper_chest",
  "mid_chest",
  "lats",
  "upper_back",
  "traps",
  "anterior_deltoids",
  "lateral_deltoids",
  "posterior_deltoids",
  "biceps",
  "triceps",
  "forearms",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "rectus_abdominis",
  "obliques",
] as const;

export type CanonicalMuscleGroup = (typeof CANONICAL_MUSCLE_GROUPS)[number];
