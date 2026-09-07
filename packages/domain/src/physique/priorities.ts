/**
 * Broad, UI-facing physique priority categories (docs/PRODUCT.md §5). A user
 * picks up to three of these during assessment. Translating a selection like
 * "shoulders" into canonical muscle groups (e.g. lateral_deltoids) and a
 * training bias is goal *compilation* — that's M3 scope
 * (docs/ARCHITECTURE.md §5-6, docs/IMPLEMENTATION_PLAN.md M3). M1 only
 * captures and validates the raw selection.
 */
export const PHYSIQUE_PRIORITY_OPTIONS = [
  "shoulders",
  "chest",
  "back",
  "arms",
  "abs",
  "legs",
  "balanced",
] as const;

export type PhysiquePriority = (typeof PHYSIQUE_PRIORITY_OPTIONS)[number];

export const MAX_PHYSIQUE_PRIORITIES = 3;
