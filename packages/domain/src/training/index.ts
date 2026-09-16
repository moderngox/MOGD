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
  SESSION_ROLE_OPTIONS,
  type AllocatedExercise,
  type SessionRole,
} from "./sessionAllocation";
export { computeProgressionTarget, type ProgressionInput, type ProgressionTarget } from "./progression";
export { explainExerciseSelection } from "./explainSelection";
