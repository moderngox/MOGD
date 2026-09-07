/**
 * nutrition — deterministic BMR/TDEE/target functions domain boundary
 * (docs/ARCHITECTURE.md §16, docs/AI_AND_SAFETY.md).
 */
export * from "./formulas";
export * from "./computeNutritionTarget";
export * from "./validate";
export {
  generateStrategyAndNutrition,
  AssessmentIncompleteError,
  type GenerateStrategyResult,
} from "./generateStrategy";
export { getGoalStrategy, getNutritionTarget } from "./getTargets";
