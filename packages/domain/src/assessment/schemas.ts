import { z } from "zod";
import { PHYSIQUE_PRIORITY_OPTIONS, MAX_PHYSIQUE_PRIORITIES } from "../physique/priorities";
import {
  PRIMARY_GOAL_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  TRAINING_CONSISTENCY_OPTIONS,
  ACTIVITY_LEVEL_OPTIONS,
  TRAINING_CONTEXT_OPTIONS,
  EQUIPMENT_OPTIONS,
  DIETARY_PREFERENCE_OPTIONS,
  COOKING_PREFERENCE_OPTIONS,
  SEX_OPTIONS,
} from "./options";

// Bounded free-text fields (docs/PRODUCT.md: "Structured inputs remain
// authoritative" — these are stored and shown back to the user, never
// parsed or acted on automatically in M1).
const boundedNote = z.string().trim().max(500);

export const goalStepSchema = z.object({
  primaryGoal: z.enum(PRIMARY_GOAL_OPTIONS),
});

export const physiquePrioritiesStepSchema = z.object({
  physiquePriorities: z
    .array(z.enum(PHYSIQUE_PRIORITY_OPTIONS))
    .min(1, "Select at least one priority")
    .max(MAX_PHYSIQUE_PRIORITIES, `Select at most ${MAX_PHYSIQUE_PRIORITIES} priorities`)
    .refine((items) => new Set(items).size === items.length, "Priorities must be unique"),
});

export const bodyStepSchema = z.object({
  sex: z.enum(SEX_OPTIONS),
  age: z.coerce.number().int().min(13).max(100),
  heightCm: z.coerce.number().min(120).max(230),
  weightKg: z.coerce.number().min(30).max(250),
  waistCm: z.coerce.number().min(40).max(200),
  targetWeightKg: z.coerce.number().min(30).max(250).optional(),
});

export const trainingHistoryStepSchema = z.object({
  experienceLevel: z.enum(EXPERIENCE_LEVEL_OPTIONS),
  trainingConsistency: z.enum(TRAINING_CONSISTENCY_OPTIONS),
  currentActivityLevel: z.enum(ACTIVITY_LEVEL_OPTIONS),
  trainingHistoryNotes: boundedNote.optional(),
  limitations: boundedNote.optional(),
  injuryRestrictions: boundedNote.optional(),
});

export const availabilityStepSchema = z.object({
  sessionsPerWeek: z.coerce.number().int().min(1).max(7),
  sessionDurationMinutes: z.coerce.number().int().min(15).max(180),
  trainingContext: z.enum(TRAINING_CONTEXT_OPTIONS),
  equipment: z.array(z.enum(EQUIPMENT_OPTIONS)).default([]),
});

export const nutritionStepSchema = z.object({
  dietaryPreference: z.enum(DIETARY_PREFERENCE_OPTIONS),
  allergies: boundedNote.optional(),
  mealsPerDay: z.coerce.number().int().min(1).max(8),
  cookingPreference: z.enum(COOKING_PREFERENCE_OPTIONS),
  dislikedFoods: boundedNote.optional(),
  willingToTrackCalories: z.coerce.boolean(),
});

export const optionalNoteStepSchema = z.object({
  optionalNote: boundedNote.optional(),
});

export const PHOTO_ANGLE_OPTIONS = ["front", "side"] as const;
export type PhotoAngle = (typeof PHOTO_ANGLE_OPTIONS)[number];

export const assessmentPhotoSchema = z.object({
  angle: z.enum(PHOTO_ANGLE_OPTIONS),
  objectKey: z.string().min(1),
});

/** Full submission payload the wizard sends in one request at the end. */
export const assessmentSubmissionSchema = goalStepSchema
  .merge(physiquePrioritiesStepSchema)
  .merge(bodyStepSchema)
  .merge(trainingHistoryStepSchema)
  .merge(availabilityStepSchema)
  .merge(nutritionStepSchema)
  .merge(optionalNoteStepSchema)
  .extend({
    // Photos are optional and already uploaded by the time of submission
    // (docs/PRODUCT.md: "Do not require photos").
    photos: z.array(assessmentPhotoSchema).max(2).default([]),
  })
  .refine(
    (data) => new Set(data.photos.map((p) => p.angle)).size === data.photos.length,
    { message: "At most one photo per angle", path: ["photos"] },
  );

export type AssessmentSubmission = z.infer<typeof assessmentSubmissionSchema>;

/**
 * Shape of the wizard's in-progress form state (docs/PRODUCT.md §6): the
 * same fields as a submission minus photos, all optional since a draft can
 * be saved from any step before every field is filled in.
 */
export const assessmentDraftFormStateSchema = goalStepSchema
  .merge(physiquePrioritiesStepSchema)
  .merge(bodyStepSchema)
  .merge(trainingHistoryStepSchema)
  .merge(availabilityStepSchema)
  .merge(nutritionStepSchema)
  .merge(optionalNoteStepSchema)
  .partial();

export type AssessmentDraftFormState = z.infer<typeof assessmentDraftFormStateSchema>;
