"use server";

import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment, nutrition } from "@mogd/domain";
import { loadMediaEnv, getPrivatePhotoUploadUrl, privatePhotoObjectKey } from "@mogd/media";

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
  angle: "front" | "side",
  extension: "jpg" | "jpeg" | "png" | "webp",
): Promise<PhotoUploadUrlResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const env = loadMediaEnv();
  if (!env) {
    return { available: false };
  }

  const key = { userId: session.user.id, photoId: angle, extension };
  const uploadUrl = await getPrivatePhotoUploadUrl(env, key);

  return { available: true, uploadUrl, objectKey: privatePhotoObjectKey(key) };
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
