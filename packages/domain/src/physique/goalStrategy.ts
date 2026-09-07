import type { PrimaryGoal } from "../assessment/options";
import type { PhysiquePriority } from "./priorities";
import type { CanonicalMuscleGroup } from "./muscles";

/**
 * Goal compilation (docs/ARCHITECTURE.md §5): the user-facing goal alone
 * isn't enough to build a program. This maps it to the internal strategy
 * shape shown there — energy direction and a hypertrophy/strength training
 * bias — plus translates the raw physique-priority selection (M1) into
 * canonical muscle groups (M2's taxonomy).
 *
 * Every mapping below is a provisional default, illustrative like the rest
 * of this codebase's example values (CLAUDE.md), not a reviewed clinical or
 * programming prescription. Changing a mapping is a contained, low-risk
 * edit — nothing downstream hardcodes these values.
 */

export const ENERGY_DIRECTION_OPTIONS = [
  "deficit",
  "slight_deficit",
  "maintenance",
  "slight_surplus",
  "surplus",
] as const;
export type EnergyDirection = (typeof ENERGY_DIRECTION_OPTIONS)[number];

export interface TrainingBias {
  hypertrophy: number;
  strength: number;
}

export interface GoalStrategy {
  primaryGoal: PrimaryGoal;
  priorityMuscles: CanonicalMuscleGroup[];
  energyDirection: EnergyDirection;
  trainingBias: TrainingBias;
}

const ENERGY_DIRECTION_BY_GOAL: Record<PrimaryGoal, EnergyDirection> = {
  fat_loss: "deficit",
  // Matches docs/ARCHITECTURE.md §5's own worked example exactly.
  recomposition: "slight_deficit",
  muscle_gain: "surplus",
  strength: "maintenance",
};

const TRAINING_BIAS_BY_GOAL: Record<PrimaryGoal, TrainingBias> = {
  fat_loss: { hypertrophy: 0.7, strength: 0.3 },
  // Matches docs/ARCHITECTURE.md §5's own worked example exactly.
  recomposition: { hypertrophy: 0.75, strength: 0.25 },
  muscle_gain: { hypertrophy: 0.8, strength: 0.2 },
  strength: { hypertrophy: 0.3, strength: 0.7 },
};

/**
 * docs/PRODUCT.md §5's UI categories are broader than the canonical
 * anatomy taxonomy — "shoulders" alone doesn't say which head. Ordered
 * lists here match the worked example in docs/PRODUCT.md §8 ("Lateral
 * delts" listed first for a shoulders-priority user).
 */
const MUSCLES_BY_PRIORITY: Record<PhysiquePriority, CanonicalMuscleGroup[]> = {
  shoulders: ["lateral_deltoids", "posterior_deltoids", "anterior_deltoids"],
  chest: ["upper_chest", "mid_chest"],
  back: ["lats", "upper_back"],
  arms: ["biceps", "triceps"],
  abs: ["rectus_abdominis", "obliques"],
  legs: ["quadriceps", "hamstrings", "glutes", "calves"],
  // "balanced" means no priority group gets extra emphasis.
  balanced: [],
};

export function compileGoalStrategy(input: {
  primaryGoal: PrimaryGoal;
  physiquePriorities: PhysiquePriority[];
}): GoalStrategy {
  const priorityMuscles: CanonicalMuscleGroup[] = [];
  for (const priority of input.physiquePriorities) {
    for (const muscle of MUSCLES_BY_PRIORITY[priority]) {
      if (!priorityMuscles.includes(muscle)) priorityMuscles.push(muscle);
    }
  }

  return {
    primaryGoal: input.primaryGoal,
    priorityMuscles,
    energyDirection: ENERGY_DIRECTION_BY_GOAL[input.primaryGoal],
    trainingBias: TRAINING_BIAS_BY_GOAL[input.primaryGoal],
  };
}
