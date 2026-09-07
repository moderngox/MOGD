/**
 * training — split templates, candidate filtering, session allocation and
 * progression domain boundary (docs/ARCHITECTURE.md §10-12, §15).
 */
export * from "./splitTemplates";
export { getExerciseCandidates, type CatalogExercise } from "./candidatePool";
export { deriveWeeklyVolumeTargets } from "./volumeTargets";
export {
  allocateSession,
  MINUTES_PER_SET,
  MIN_SETS_PER_EXERCISE,
  MAX_SETS_PER_EXERCISE,
  type AllocatedExercise,
} from "./sessionAllocation";
export { computeProgressionTarget, type ProgressionInput, type ProgressionTarget } from "./progression";
