import type { MediaEnv } from "./env";
import { getPresignedUploadUrl, putR2Object } from "./r2Client";

/**
 * Public, deliverable exercise demonstration assets. Publication is manual
 * and external per docs/SPIDRA_MIGRATION.md and docs/ARCHITECTURE.md §7/§8 —
 * this module only stores/serves an already-approved MP4/thumbnail. It does
 * not call, poll or queue any generation provider.
 */
export interface ExerciseAssetKey {
  exerciseId: string;
  assetId: string;
  type: "video" | "thumbnail";
  extension: "mp4" | "jpg";
}

export function exerciseAssetObjectKey({
  exerciseId,
  assetId,
  extension,
}: ExerciseAssetKey): string {
  return `exercises/${exerciseId}/${assetId}.${extension}`;
}

export function exerciseAssetPublicUrl(env: MediaEnv, key: ExerciseAssetKey): string {
  return `${env.R2_EXERCISE_MEDIA_PUBLIC_BASE_URL}/${exerciseAssetObjectKey(key)}`;
}

function credsFrom(env: MediaEnv) {
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  };
}

/** Manual admin upload after human review (see docs/ARCHITECTURE.md §20). */
export function uploadExerciseAsset(
  env: MediaEnv,
  key: ExerciseAssetKey,
  body: Buffer,
  contentType: string,
) {
  return putR2Object(
    credsFrom(env),
    env.R2_EXERCISE_MEDIA_BUCKET,
    exerciseAssetObjectKey(key),
    body,
    contentType,
  );
}

/** For large video files, lets the admin browser upload directly to R2. */
export function getExerciseAssetUploadUrl(env: MediaEnv, key: ExerciseAssetKey) {
  return getPresignedUploadUrl(
    credsFrom(env),
    env.R2_EXERCISE_MEDIA_BUCKET,
    exerciseAssetObjectKey(key),
  );
}
