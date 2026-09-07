import { z } from "zod";
import { LIKERT_OPTIONS, PHOTO_ANGLE_OPTIONS } from "./options";

const boundedNote = z.string().trim().max(500);

export const progressPhotoInput = z.object({
  angle: z.enum(PHOTO_ANGLE_OPTIONS),
  objectKey: z.string().min(1),
});

/**
 * trainingAdherencePercent is deliberately absent — it's computed server-
 * side from exercise_logs, never accepted from the client
 * (docs/db/schema/checkins.ts comment: prefer real persisted data over
 * self-report where we have it).
 */
export const checkinSubmissionSchema = z.object({
  averageWeightKg: z.coerce.number().min(30).max(250),
  waistCm: z.coerce.number().min(40).max(200),
  nutritionAdherencePercent: z.coerce.number().int().min(0).max(100),
  hunger: z.coerce.number().int().refine((v) => (LIKERT_OPTIONS as readonly number[]).includes(v)),
  energy: z.coerce.number().int().refine((v) => (LIKERT_OPTIONS as readonly number[]).includes(v)),
  recovery: z.coerce.number().int().refine((v) => (LIKERT_OPTIONS as readonly number[]).includes(v)),
  performanceNote: boundedNote.optional(),
  note: boundedNote.optional(),
  photos: z.array(progressPhotoInput).max(2).default([]),
});
export type CheckinSubmission = z.infer<typeof checkinSubmissionSchema>;
