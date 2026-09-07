/**
 * physique — goal compilation, priority muscles and canonical muscle model
 * domain boundary (docs/ARCHITECTURE.md §5-6). The raw physique-priority
 * selection is captured starting M1; the canonical muscle model landed in
 * M2 (exercises reference it); compiling priorities + goal into a
 * GoalStrategy is M3.
 */
export { PHYSIQUE_PRIORITY_OPTIONS, MAX_PHYSIQUE_PRIORITIES, type PhysiquePriority } from "./priorities";
export { CANONICAL_MUSCLE_GROUPS, type CanonicalMuscleGroup } from "./muscles";
export {
  ENERGY_DIRECTION_OPTIONS,
  compileGoalStrategy,
  type EnergyDirection,
  type TrainingBias,
  type GoalStrategy,
} from "./goalStrategy";
