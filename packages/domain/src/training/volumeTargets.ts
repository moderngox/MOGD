import { CANONICAL_MUSCLE_GROUPS, type CanonicalMuscleGroup } from "../physique/muscles";
import type { ExperienceLevel } from "../assessment/options";

/**
 * Weekly per-muscle set targets (docs/ARCHITECTURE.md §12: "muscle weekly
 * volume"). Base values sit within the commonly cited 10-20 sets/week/
 * muscle hypertrophy range from resistance-training literature, scaled by
 * experience (beginners need less to progress; advanced need more to keep
 * progressing) — provisional defaults per CLAUDE.md's caution about
 * illustrative values, not a personalized prescription.
 */
const BASE_WEEKLY_SETS: Record<ExperienceLevel, number> = {
  beginner: 10,
  intermediate: 14,
  advanced: 18,
};

/** Priority muscles get extra volume on top of the base landmark. */
const PRIORITY_MULTIPLIER = 1.3;

export function deriveWeeklyVolumeTargets(
  experienceLevel: ExperienceLevel,
  priorityMuscles: CanonicalMuscleGroup[],
): Record<CanonicalMuscleGroup, number> {
  const base = BASE_WEEKLY_SETS[experienceLevel];
  const priority = new Set(priorityMuscles);

  const targets = {} as Record<CanonicalMuscleGroup, number>;
  for (const muscle of CANONICAL_MUSCLE_GROUPS) {
    targets[muscle] = priority.has(muscle) ? Math.round(base * PRIORITY_MULTIPLIER) : base;
  }
  return targets;
}
