/**
 * Enumerated option sets for the exercise catalog (docs/ARCHITECTURE.md
 * §6-8). Equipment lives here (not in assessment/options.ts) because it's
 * fundamentally an exercise-requirement vocabulary — a user's "equipment I
 * have" (assessment) and an exercise's "equipment this needs" must share
 * one vocabulary for M4's candidate filtering to ever match anything.
 */

export const EQUIPMENT_OPTIONS = [
  "barbell",
  "dumbbells",
  "machines",
  "cables",
  "resistance_bands",
  "kettlebells",
  "pull_up_bar",
  "dip_bar",
  "bodyweight_only",
] as const;
export type Equipment = (typeof EQUIPMENT_OPTIONS)[number];

/**
 * Provisional, like the rest of this codebase's illustrative enums
 * (docs/ARCHITECTURE.md §7 lists "movementPattern"/"difficulty" as fields
 * without enumerating values).
 */
export const MOVEMENT_PATTERN_OPTIONS = [
  "push",
  "pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "rotation",
  "isolation",
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERN_OPTIONS)[number];

export const EXERCISE_DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced"] as const;
export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTY_OPTIONS)[number];

/** docs/ARCHITECTURE.md §8 ExerciseAsset. */
export const ASSET_TYPE_OPTIONS = ["video", "thumbnail"] as const;
export type AssetType = (typeof ASSET_TYPE_OPTIONS)[number];

export const ASSET_STATUS_OPTIONS = ["draft", "approved", "archived"] as const;
export type AssetStatus = (typeof ASSET_STATUS_OPTIONS)[number];

/**
 * docs/01_EXERCISE_RELATIONSHIPS_ARCHITECTURE.md §2. Only these three are
 * ever persisted (packages/db/src/schema/exerciseRelationships.ts) —
 * "regression" is deliberately excluded here and only exists as a
 * RelationshipAction below (see relationships.ts for the swap it performs).
 */
export const RELATIONSHIP_TYPE_OPTIONS = ["progression", "variation", "alternative"] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPE_OPTIONS)[number];

/** What the admin UI/API accepts — "regression" is sugar, never stored as-is. */
export const RELATIONSHIP_ACTION_OPTIONS = [
  "progression",
  "regression",
  "variation",
  "alternative",
] as const;
export type RelationshipAction = (typeof RELATIONSHIP_ACTION_OPTIONS)[number];

/**
 * docs/MOGD_06-session-role-architecture.md §2. This is the exercise's
 * ELIGIBILITY vocabulary (allowedSessionRoles/preferredSessionRole) — the
 * same four values also describe the role the engine actually assigns on a
 * generated workout item (packages/domain/src/training/sessionRoleAssignment.ts),
 * declared once here since both live inside packages/domain (no cross-package
 * barrier forcing a hand-synced duplicate, unlike packages/db's schema enums).
 */
export const SESSION_ROLE_OPTIONS = ["main", "accessory", "superset", "finisher"] as const;
export type SessionRole = (typeof SESSION_ROLE_OPTIONS)[number];
