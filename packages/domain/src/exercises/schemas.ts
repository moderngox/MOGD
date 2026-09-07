import { z } from "zod";
import { CANONICAL_MUSCLE_GROUPS } from "../physique/muscles";
import {
  EQUIPMENT_OPTIONS,
  MOVEMENT_PATTERN_OPTIONS,
  EXERCISE_DIFFICULTY_OPTIONS,
  ASSET_TYPE_OPTIONS,
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

export const createExerciseInput = z.object({
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
});
export type CreateExerciseInput = z.infer<typeof createExerciseInput>;

/** Same fields, minus the immutable canonicalId. */
export const updateExerciseInput = createExerciseInput.omit({ canonicalId: true });
export type UpdateExerciseInput = z.infer<typeof updateExerciseInput>;

export const createDraftAssetInput = z.object({
  exerciseId: z.string().min(1),
  type: z.enum(ASSET_TYPE_OPTIONS),
  objectKey: z.string().min(1),
  provider: z.string().trim().max(60).optional(),
  generationModel: z.string().trim().max(120).optional(),
});
export type CreateDraftAssetInput = z.infer<typeof createDraftAssetInput>;
