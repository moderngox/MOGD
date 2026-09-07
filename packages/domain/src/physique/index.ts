/**
 * physique — goal compilation, priority muscles and canonical muscle model
 * domain boundary. The raw physique-priority selection is captured starting
 * M1; the canonical muscle model is needed starting M2 (exercises reference
 * it). Compiling priorities into canonical muscle priorities and a training
 * bias is M3 scope (docs/ARCHITECTURE.md §5-6).
 */
export { PHYSIQUE_PRIORITY_OPTIONS, MAX_PHYSIQUE_PRIORITIES, type PhysiquePriority } from "./priorities";
export { CANONICAL_MUSCLE_GROUPS, type CanonicalMuscleGroup } from "./muscles";
