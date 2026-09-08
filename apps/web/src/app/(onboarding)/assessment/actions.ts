"use server";

import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment, nutrition, programs } from "@mogd/domain";
import { loadMediaEnv, getPrivatePhotoUploadUrl, privatePhotoObjectKey } from "@mogd/media";
import { z } from "zod";

const angleSchema = z.enum(assessment.PHOTO_ANGLE_OPTIONS);
const extensionSchema = z.enum(["jpg", "jpeg", "png", "webp"]);

export interface PhotoUploadUrlResult {
  available: boolean;
  uploadUrl?: string;
  objectKey?: string;
}

/**
 * Issues a presigned direct-to-R2 upload URL for one assessment photo angle.
 * Returns { available: false } rather than throwing when R2 isn't
 * configured (e.g. local dev without credentials) — the wizard treats that
 * as "skip photos", consistent with docs/PRODUCT.md's "Do not require
 * photos".
 */
export async function getPhotoUploadUrlAction(
  rawAngle: "front" | "side",
  rawExtension: "jpg" | "jpeg" | "png" | "webp",
): Promise<PhotoUploadUrlResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // Server Action parameter types are compile-time only — a raw request can
  // send any string, so re-validate before it flows into an R2 object key.
  const angle = angleSchema.parse(rawAngle);
  const extension = extensionSchema.parse(rawExtension);

  const env = loadMediaEnv();
  if (!env) {
    return { available: false };
  }

  const key = { userId: session.user.id, photoId: angle, extension };
  const uploadUrl = await getPrivatePhotoUploadUrl(env, key);

  return { available: true, uploadUrl, objectKey: privatePhotoObjectKey(key) };
}

/**
 * Best-effort autosave, fired on each wizard step transition (see
 * AssessmentWizard's `persistDraft`). Never throws: a slow or failed save
 * must not block the user from moving to the next step, it only means
 * they'd resume from an earlier point if they left right now.
 */
export async function saveDraftAction(
  step: number,
  formState: assessment.AssessmentDraftFormState,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  try {
    await assessment.saveDraft(getDb(), session.user.id, { step, formState });
  } catch {
    // best-effort — see doc comment above
  }
}

export interface SubmitAssessmentActionResult {
  eligible: boolean;
  reasons: string[];
}

export async function submitAssessmentAction(
  input: assessment.AssessmentSubmission,
): Promise<SubmitAssessmentActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return assessment.submitAssessment(getDb(), session.user.id, input);
}

/**
 * Called right after a successful, eligible submitAssessmentAction — the
 * "receive strategy" / "receive calorie and macronutrient targets" steps
 * in docs/PRODUCT.md §15 follow directly from completing the assessment.
 * Kept as its own action (not folded into submitAssessment itself) so M1's
 * module stays self-contained; M3 only adds to the flow.
 */
export async function generateStrategyAction(): Promise<nutrition.GenerateStrategyResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return nutrition.generateStrategyAndNutrition(getDb(), session.user.id);
}

/**
 * Called after a successful generateStrategyAction — "receive weekly
 * workouts" in docs/PRODUCT.md §15 follows directly from having a
 * strategy. Kept as its own action for the same reason: each milestone's
 * module stays self-contained rather than reaching back into earlier ones.
 */
export async function generateProgramAction(): Promise<programs.GenerateProgramResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return programs.generateProgram(getDb(), session.user.id);
}
