/**
 * training — split templates, candidate filtering, session allocation and
 * progression domain boundary (docs/ARCHITECTURE.md §10-12, §15).
 */
export * from "./splitTemplates";
export { getExerciseCandidates, type CatalogExercise, type EligibleExercise } from "./candidatePool";
export { deriveWeeklyVolumeTargets } from "./volumeTargets";
export { allocateSession, MINUTES_PER_SET, type AllocatedExercise } from "./sessionAllocation";
export {
  assignSessionRoles,
  applyRoleModifier,
  ROLE_REASON_OPTIONS,
  type RoleReason,
} from "./sessionRoleAssignment";
export {
  computeProgressionTarget,
  PROGRESSION_REASON_OPTIONS,
  type ProgressionInput,
  type ProgressionTarget,
  type ProgressionReason,
  type LoggedSetForProgression,
} from "./progression";
export { explainExerciseSelection } from "./explainSelection";
