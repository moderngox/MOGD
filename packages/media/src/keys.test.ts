import { describe, expect, it } from "vitest";
import { privatePhotoObjectKey } from "./privatePhotos";
import { exerciseAssetObjectKey, exerciseAssetPublicUrl } from "./exerciseMedia";
import { loadMediaEnv } from "./env";

describe("object key separation", () => {
  it("keeps private photo keys under a per-user prefix", () => {
    const key = privatePhotoObjectKey({
      userId: "user_1",
      photoId: "photo_1",
      extension: "jpg",
    });
    expect(key).toBe("users/user_1/photos/photo_1.jpg");
  });

  it("keeps exercise asset keys under a per-exercise prefix distinct from user photos", () => {
    const key = exerciseAssetObjectKey({
      exerciseId: "incline_dumbbell_press",
      assetId: "v1",
      type: "video",
      extension: "mp4",
    });
    expect(key).toBe("exercises/incline_dumbbell_press/v1.mp4");
    expect(key.startsWith("users/")).toBe(false);
  });

  it("builds a public URL only for exercise media, never for private photos", () => {
    const env = loadMediaEnv({
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_EXERCISE_MEDIA_BUCKET: "mogd-exercise-media",
      R2_EXERCISE_MEDIA_PUBLIC_BASE_URL: "https://media.example.com",
      R2_PRIVATE_PHOTOS_BUCKET: "mogd-private-photos",
    });
    expect(env).not.toBeNull();

    const url = exerciseAssetPublicUrl(env!, {
      exerciseId: "incline_dumbbell_press",
      assetId: "v1",
      type: "video",
      extension: "mp4",
    });
    expect(url).toBe(
      "https://media.example.com/exercises/incline_dumbbell_press/v1.mp4",
    );
  });

  it("returns null when required media env vars are missing", () => {
    expect(loadMediaEnv({})).toBeNull();
  });

  it("rejects a photoId containing a path-traversal sequence rather than building an escaping key", () => {
    // Server Action parameter types are compile-time only, so a raw request
    // could send anything here — without this guard, aws4fetch's `new
    // URL(...)` normalizes the `..` segments before signing, producing a
    // validly-signed presigned URL for an entirely different object outside
    // this user's own prefix (the M6 security review's path-traversal
    // finding).
    expect(() =>
      privatePhotoObjectKey({
        userId: "user_1",
        photoId: "x/../../../../users/victim-id/photos/front",
        extension: "jpg",
      }),
    ).toThrow();
  });

  it("rejects a photoId containing a slash even without full traversal", () => {
    expect(() =>
      privatePhotoObjectKey({ userId: "user_1", photoId: "a/b", extension: "jpg" }),
    ).toThrow();
  });
});
