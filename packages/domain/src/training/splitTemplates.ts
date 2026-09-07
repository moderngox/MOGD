import type { CanonicalMuscleGroup } from "../physique/muscles";

/**
 * Restrained template library (docs/ARCHITECTURE.md §11): "Do not allow
 * arbitrary novelty to replace programming coherence." These five names
 * are exactly the ones listed there.
 */
export const SPLIT_TYPE_OPTIONS = [
  "full_body",
  "upper_lower",
  "push_pull_legs",
  "upper_lower_upper",
  "push_pull_legs_upper_lower",
] as const;
export type SplitType = (typeof SPLIT_TYPE_OPTIONS)[number];

export const SESSION_LABEL_OPTIONS = ["full_body", "upper", "lower", "push", "pull", "legs"] as const;
export type SessionLabel = (typeof SESSION_LABEL_OPTIONS)[number];

/**
 * Maps sessions/week to a split and its ordered session labels. Standard
 * bodybuilding/strength-training convention, not an invented scheme.
 * 6 and 7 sessions/week both map to two Push/Pull/Legs cycles — the
 * architecture doc's restrained list has no named 7-day template, and a
 * 7th high-intensity resistance day is not a default this codebase should
 * assume is a good idea; the 7th day is left as a rest/optional day.
 */
export function selectSplit(sessionsPerWeek: number): { splitType: SplitType; sessions: SessionLabel[] } {
  const n = Math.max(1, Math.min(7, sessionsPerWeek));

  if (n <= 3) {
    return { splitType: "full_body", sessions: Array(n).fill("full_body") };
  }
  if (n === 4) {
    return { splitType: "upper_lower", sessions: ["upper", "lower", "upper", "lower"] };
  }
  if (n === 5) {
    return {
      splitType: "push_pull_legs_upper_lower",
      sessions: ["push", "pull", "legs", "upper", "lower"],
    };
  }
  // n === 6 or 7
  return {
    splitType: "push_pull_legs",
    sessions: ["push", "pull", "legs", "push", "pull", "legs"],
  };
}

/**
 * Which canonical muscle groups a session label trains — standard
 * push/pull/legs and upper/lower body-part groupings. A full-body session
 * targets one representative group per body part rather than all 17
 * groups, so its per-session volume stays sane; minor groups can still
 * appear as secondary muscles of whatever compound lifts get selected.
 */
export const SESSION_MUSCLE_MAP: Record<SessionLabel, CanonicalMuscleGroup[]> = {
  full_body: [
    "upper_chest",
    "mid_chest",
    "lats",
    "upper_back",
    "lateral_deltoids",
    "biceps",
    "triceps",
    "quadriceps",
    "hamstrings",
    "glutes",
    "rectus_abdominis",
  ],
  upper: [
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
  ],
  lower: ["quadriceps", "hamstrings", "glutes", "calves", "rectus_abdominis", "obliques"],
  push: ["upper_chest", "mid_chest", "anterior_deltoids", "lateral_deltoids", "triceps"],
  pull: ["lats", "upper_back", "traps", "posterior_deltoids", "biceps", "forearms"],
  legs: ["quadriceps", "hamstrings", "glutes", "calves"],
};
