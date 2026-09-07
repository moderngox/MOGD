/**
 * progress — set logging and previous-performance domain boundary
 * (docs/ARCHITECTURE.md §14).
 */
export { logWorkoutSet, logSetInput, type LogSetInput } from "./logSet";
export {
  getPreviousPerformance,
  getProgressionTargetForExercise,
  type PreviousPerformance,
} from "./previousPerformance";
