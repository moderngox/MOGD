"use server";

import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { checkins } from "@mogd/domain";
import { loadMediaEnv, getPrivatePhotoUploadUrl, privatePhotoObjectKey } from "@mogd/media";
import { z } from "zod";

const angleSchema = z.enum(checkins.PHOTO_ANGLE_OPTIONS);
const extensionSchema = z.enum(["jpg", "jpeg", "png", "webp"]);

export interface PhotoUploadUrlResult {
  available: boolean;
  uploadUrl?: string;
  objectKey?: string;
}

/** Same pattern as the assessment wizard's photo step (M1) — presigned
 * direct-to-R2 upload, "unavailable" rather than throwing when R2 isn't
 * configured (docs/PRODUCT.md: photos are always optional). */
export async function getCheckinPhotoUploadUrlAction(
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

  // photoId scoped by timestamp so repeated check-ins don't collide on the
  // same private-photos object key.
  const key = { userId: session.user.id, photoId: `checkin-${Date.now()}-${angle}`, extension };
  const uploadUrl = await getPrivatePhotoUploadUrl(env, key);

  return { available: true, uploadUrl, objectKey: privatePhotoObjectKey(key) };
}

export async function submitCheckinAction(
  input: checkins.CheckinSubmission,
): Promise<checkins.SubmitCheckinResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return checkins.submitCheckin(getDb(), session.user.id, input);
}
