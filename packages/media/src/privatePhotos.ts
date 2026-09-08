import { z } from "zod";
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

export const PHOTO_EXTENSION_OPTIONS = ["jpg", "jpeg", "png", "webp"] as const;

/**
 * `photoId` and `extension` reach this from Server Action parameters whose
 * TypeScript union types are compile-time only — a raw request to the
 * action's endpoint can send any string. Because the key is later embedded
 * in a URL and parsed by aws4fetch's `new URL(...)` (which normalizes `..`
 * path segments before signing), an unvalidated `photoId`/`extension`
 * containing `../` can make the *signed* request target a completely
 * different key than the caller's own `users/{userId}/photos/` prefix —
 * a path-traversal into another user's private object. `photoId` itself
 * may legitimately contain a caller-chosen suffix (e.g. a timestamp), so it
 * is restricted to a safe charset rather than an exact enum.
 */
const photoIdPattern = /^[A-Za-z0-9_-]+$/;

export const privatePhotoKeyInput = z.object({
  userId: z.string().min(1),
  photoId: z.string().min(1).max(100).regex(photoIdPattern, "photoId contains unsafe characters"),
  extension: z.enum(PHOTO_EXTENSION_OPTIONS),
});

export function privatePhotoObjectKey(rawKey: PrivatePhotoKey): string {
  const { userId, photoId, extension } = privatePhotoKeyInput.parse(rawKey);
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
