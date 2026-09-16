import { z } from "zod";
import { CANONICAL_MUSCLE_GROUPS } from "../physique/muscles";
import {
  EQUIPMENT_OPTIONS,
  MOVEMENT_PATTERN_OPTIONS,
  EXERCISE_DIFFICULTY_OPTIONS,
  ASSET_TYPE_OPTIONS,
  RELATIONSHIP_ACTION_OPTIONS,
  SESSION_ROLE_OPTIONS,
} from "./options";

/**
 * Stable, human-chosen slug (docs/ARCHITECTURE.md §7 examples:
 * "incline_dumbbell_press", "romanian_deadlift"). Immutable once created —
 * callers must not offer to edit this on an existing exercise.
 */
export const canonicalIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers and underscores only");

const boundedText = z.string().trim().max(2000);

const exerciseFields = z.object({
  canonicalId: canonicalIdSchema,
  name: z.string().trim().min(1).max(120),
  movementPattern: z.enum(MOVEMENT_PATTERN_OPTIONS),
  difficulty: z.enum(EXERCISE_DIFFICULTY_OPTIONS),
  primaryMuscles: z.array(z.enum(CANONICAL_MUSCLE_GROUPS)).min(1),
  secondaryMuscles: z.array(z.enum(CANONICAL_MUSCLE_GROUPS)).default([]),
  equipment: z.array(z.enum(EQUIPMENT_OPTIONS)).default([]),
  hypertrophyScore: z.coerce.number().min(0).max(10).optional(),
  strengthScore: z.coerce.number().min(0).max(10).optional(),
  fatigueScore: z.coerce.number().min(0).max(10).optional(),
  stabilityDemand: z.coerce.number().min(0).max(10).optional(),
  defaultRepMin: z.coerce.number().int().min(1).max(100).optional(),
  defaultRepMax: z.coerce.number().int().min(1).max(100).optional(),
  // Free-form for now — no reviewed contraindication taxonomy exists yet
  // (see docs/AI_AND_SAFETY.md caution against inventing unapproved
  // clinical categories). Admin enters plain tags.
  contraindicationTags: z.array(z.string().trim().max(60)).default([]),
  instructions: boundedText.optional(),
  isActive: z.coerce.boolean().default(true),
  // Eligibility, not assignment (docs/MOGD_06-session-role-architecture.md
  // §3) — the engine assigns the actual role per generated session.
  allowedSessionRoles: z.array(z.enum(SESSION_ROLE_OPTIONS)).default([]),
  preferredSessionRole: z.enum(SESSION_ROLE_OPTIONS).optional(),
});

/**
 * "Preferred role must be one of the allowed roles" (docs/MOGD_06 §4). A
 * plain input-shape constraint, so it's a Zod .refine() rather than a
 * thrown service-layer error (contrast relationships.ts's
 * SelfReferentialRelationshipError, which depends on DB state, not just
 * input shape). Applied to both derived schemas below independently — Zod 3
 * has no .omit() on the ZodEffects a .refine() produces, so canonicalId must
 * be omitted from the plain object base *before* either schema is refined.
 */
function preferredRoleMustBeAllowed(data: { allowedSessionRoles: string[]; preferredSessionRole?: string }) {
  return !data.preferredSessionRole || data.allowedSessionRoles.includes(data.preferredSessionRole);
}
const REFINE_OPTIONS: { message: string; path: (string | number)[] } = {
  message: "Preferred role must be one of the allowed roles",
  path: ["preferredSessionRole"],
};

export const createExerciseInput = exerciseFields.refine(preferredRoleMustBeAllowed, REFINE_OPTIONS);
export type CreateExerciseInput = z.infer<typeof createExerciseInput>;

/** Same fields, minus the immutable canonicalId. */
export const updateExerciseInput = exerciseFields
  .omit({ canonicalId: true })
  .refine(preferredRoleMustBeAllowed, REFINE_OPTIONS);
export type UpdateExerciseInput = z.infer<typeof updateExerciseInput>;

export const createDraftAssetInput = z.object({
  exerciseId: z.string().min(1),
  type: z.enum(ASSET_TYPE_OPTIONS),
  objectKey: z.string().min(1),
  provider: z.string().trim().max(60).optional(),
  generationModel: z.string().trim().max(120).optional(),
});
export type CreateDraftAssetInput = z.infer<typeof createDraftAssetInput>;

/**
 * Self-relation is deliberately NOT rejected here (unlike shape validation)
 * — it's business-rule state, not input shape, so relationships.ts throws
 * a dedicated SelfReferentialRelationshipError for it, matching how
 * createExercise checks canonicalId uniqueness outside this schema.
 */
export const createRelationshipInput = z.object({
  exerciseId: z.string().min(1),
  relatedExerciseId: z.string().min(1),
  action: z.enum(RELATIONSHIP_ACTION_OPTIONS),
});
export type CreateRelationshipInput = z.infer<typeof createRelationshipInput>;
