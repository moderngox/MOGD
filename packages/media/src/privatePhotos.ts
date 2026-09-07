import type { MediaEnv } from "./env";
import { deleteR2Object, getPresignedGetUrl, getPresignedUploadUrl } from "./r2Client";

/**
 * Private user photos (assessment/progress). Objects in this bucket must
 * never be reachable via an unrestricted public URL — every read goes
 * through a short-lived signed GET URL, issued only after the caller has
 * checked the requesting user owns the object (that authorization check
 * belongs in the application layer, not here).
 */
export interface PrivatePhotoKey {
  userId: string;
  photoId: string;
  extension: "jpg" | "jpeg" | "png" | "webp";
}

export function privatePhotoObjectKey({ userId, photoId, extension }: PrivatePhotoKey): string {
  return `users/${userId}/photos/${photoId}.${extension}`;
}

function credsFrom(env: MediaEnv) {
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  };
}

export function getPrivatePhotoUploadUrl(env: MediaEnv, key: PrivatePhotoKey) {
  return getPresignedUploadUrl(
    credsFrom(env),
    env.R2_PRIVATE_PHOTOS_BUCKET,
    privatePhotoObjectKey(key),
  );
}

/** Short expiry by default — a private photo URL should not remain valid
 * long after the page that requested it. */
export function getPrivatePhotoReadUrl(
  env: MediaEnv,
  key: PrivatePhotoKey,
  expiresInSeconds = 300,
) {
  return getPresignedGetUrl(
    credsFrom(env),
    env.R2_PRIVATE_PHOTOS_BUCKET,
    privatePhotoObjectKey(key),
    expiresInSeconds,
  );
}

export function deletePrivatePhoto(env: MediaEnv, key: PrivatePhotoKey) {
  return deleteR2Object(credsFrom(env), env.R2_PRIVATE_PHOTOS_BUCKET, privatePhotoObjectKey(key));
}
