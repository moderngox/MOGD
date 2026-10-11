/**
 * progress — workout sessions, set logging and history domain boundary
 * (docs/ARCHITECTURE.md §14).
 */
export {
  getInProgressSession,
  getOrStartPerformance,
  logSet,
  logSetInput,
  correctSet,
  setCorrectionInput,
  deleteLastSet,
  finishSession,
  getSessionSummary,
  WorkoutNotOwnedError,
  ExerciseNotInWorkoutError,
  InvalidSetNumberError,
  SessionNotFoundError,
  SessionLocationMismatchError,
  SetNotFoundError,
  type LogSetInput,
  type SetCorrectionInput,
  type WorkoutSession,
  type ExercisePerformance,
  type LoggedSet,
  type SessionSummary,
} from "./sessions";
export {
  getPreviousPerformance,
  getRecentSessionPerformance,
  getObservedLoadsKg,
  getProgressionTargetForExercise,
  hasHistoryInOtherContext,
  type HistoryContext,
  type PerformedPrescription,
  type RecentSessionPerformance,
  type PreviousPerformance,
  type RecentSessionSet,
} from "./previousPerformance";
export {
  createLocation,
  listLocations,
  getOwnedLocation,
  getDefaultLocationId,
  DuplicateLocationError,
  LocationNotFoundError,
  type TrainingLocation,
} from "./locations";
