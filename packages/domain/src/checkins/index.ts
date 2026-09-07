/**
 * checkins — weekly check-in domain boundary (docs/PRODUCT.md §12,
 * docs/ARCHITECTURE.md §17).
 */
export * from "./options";
export * from "./schemas";
export { computeTrainingAdherence } from "./trainingAdherence";
export { submitCheckin, type SubmitCheckinResult } from "./submitCheckin";
export { listCheckins, getLatestCheckin } from "./getCheckins";
