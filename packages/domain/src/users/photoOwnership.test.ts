import { describe, expect, it } from "vitest";
import { assertOwnsPrivatePhotoKey, PhotoOwnershipError } from "./photoOwnership";

describe("assertOwnsPrivatePhotoKey", () => {
  it("passes for a key under the caller's own prefix", () => {
    expect(() => assertOwnsPrivatePhotoKey("user-1", "users/user-1/photos/front.jpg")).not.toThrow();
  });

  it("rejects a key under a different user's prefix (IDOR)", () => {
    expect(() => assertOwnsPrivatePhotoKey("user-1", "users/victim-id/photos/front.jpg")).toThrow(
      PhotoOwnershipError,
    );
  });

  it("rejects a key with no users/ prefix at all", () => {
    expect(() => assertOwnsPrivatePhotoKey("user-1", "exercises/some-id/video.mp4")).toThrow(
      PhotoOwnershipError,
    );
  });

  it("rejects an attempted prefix-match bypass (e.g. users/user-10/... matching a users/user-1 startsWith check)", () => {
    // Guards against a naive `startsWith("users/" + userId)` (no trailing
    // slash) that user-1 could satisfy against user-10's prefix.
    expect(() => assertOwnsPrivatePhotoKey("user-1", "users/user-10/photos/front.jpg")).toThrow(
      PhotoOwnershipError,
    );
  });
});
