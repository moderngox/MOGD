/**
 * programs — program/workout hierarchy, generation orchestration and
 * validation domain boundary (docs/ARCHITECTURE.md §13, IMPLEMENTATION_PLAN M4).
 */
export {
  generateProgram,
  StrategyIncompleteError,
  type GenerateProgramResult,
} from "./generateProgram";
export { validateProgram, type ProgramPlan, type ProgramWorkoutPlan, type ValidationResult } from "./validator";
export {
  getCurrentProgram,
  getWorkout,
  getWorkoutOwnerId,
  type ProgramView,
  type ProgramWorkoutView,
  type ProgramWorkoutExerciseView,
} from "./getProgram";
