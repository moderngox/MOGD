/**
 * Assessment and check-in submissions accept a client-supplied objectKey
 * for each private photo (the client already knows it — it was returned
 * when the upload URL was issued) rather than the server re-deriving it,
 * because check-in photo keys embed an upload-time timestamp the server
 * has no other record of. That means the client's claim must be verified,
 * not trusted: without this check, an authenticated user could submit any
 * objectKey string — including another real user's actual private photo
 * key — and have it persisted as their own (a broken-access-control /
 * IDOR finding from the M6 security review). This is the single choke
 * point both submitAssessment and submitCheckin call before persisting.
 */
export class PhotoOwnershipError extends Error {
  constructor(objectKey: string) {
    super(`objectKey "${objectKey}" does not belong to the requesting user`);
    this.name = "PhotoOwnershipError";
  }
}

export function assertOwnsPrivatePhotoKey(userId: string, objectKey: string): void {
  if (!objectKey.startsWith(`users/${userId}/photos/`)) {
    throw new PhotoOwnershipError(objectKey);
  }
}
