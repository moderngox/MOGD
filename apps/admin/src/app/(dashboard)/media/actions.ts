"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAdmin } from "@mogd/shared/auth";
import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";
import { loadMediaEnv, getExerciseAssetUploadUrl, exerciseAssetObjectKey } from "@mogd/media";

async function requireAdminSession() {
  const session = await auth();
  requireAdmin(session);
  return session;
}

export interface AssetUploadUrlResult {
  available: boolean;
  uploadUrl?: string;
  objectKey?: string;
}

/**
 * Issues a presigned direct-to-R2 upload URL for a new asset version.
 * Nothing here calls a generation provider (CLAUDE.md rule 7) — this only
 * hands the browser a place to PUT bytes it already has.
 */
export async function getAssetUploadUrlAction(
  exerciseId: string,
  type: "video" | "thumbnail",
  extension: "mp4" | "jpg",
): Promise<AssetUploadUrlResult> {
  await requireAdminSession();

  const env = loadMediaEnv();
  if (!env) return { available: false };

  const key = { exerciseId, assetId: crypto.randomUUID(), type, extension };
  const uploadUrl = await getExerciseAssetUploadUrl(env, key);
  return { available: true, uploadUrl, objectKey: exerciseAssetObjectKey(key) };
}

export async function createDraftAssetAction(input: exercises.CreateDraftAssetInput) {
  await requireAdminSession();
  await exercises.createDraftAsset(getDb(), input);
  revalidatePath("/media");
}

export async function approveAssetAction(assetId: string, validationNotes?: string) {
  await requireAdminSession();
  await exercises.approveAsset(getDb(), assetId, validationNotes);
  revalidatePath("/media");
}

export async function archiveAssetAction(assetId: string) {
  await requireAdminSession();
  await exercises.archiveAsset(getDb(), assetId);
  revalidatePath("/media");
}
