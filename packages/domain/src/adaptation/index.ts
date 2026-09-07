/**
 * adaptation — trend analysis, deterministic adjustment rules and plan
 * adjustment history domain boundary (docs/ARCHITECTURE.md §18,
 * docs/AI_AND_SAFETY.md).
 */
export * from "./trends";
export * from "./rules";
export { runAdaptation, type RunAdaptationResult } from "./runAdaptation";
export { listPlanAdjustments, getLatestPlanAdjustment } from "./getAdjustments";
