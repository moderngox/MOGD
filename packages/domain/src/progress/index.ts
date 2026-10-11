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
  type HistoryOptions,
  type PreviousPerformance,
  type RecentSessionSet,
} from "./previousPerformance";
