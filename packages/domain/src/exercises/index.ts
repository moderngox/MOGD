/**
 * exercises — canonical exercise identity and catalog domain boundary
 * (docs/IMPLEMENTATION_PLAN.md M2, docs/ARCHITECTURE.md §7-8).
 */
export * from "./options";
export * from "./schemas";
export {
  createExercise,
  updateExercise,
  setExerciseActive,
  getExerciseById,
  resolveActiveExercise,
  listExercises,
  DuplicateCanonicalIdError,
} from "./exerciseCatalog";
export {
  createDraftAsset,
  approveAsset,
  archiveAsset,
  getPublishedAsset,
  listAssetsForExercise,
  AssetNotFoundError,
} from "./assetService";
export { getCatalogStats, type CatalogStats } from "./catalogStats";
