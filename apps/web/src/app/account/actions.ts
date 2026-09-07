"use server";

import { auth, signOut } from "@/auth";
import { getDb } from "@mogd/db";
import { users } from "@mogd/domain";
import { loadMediaEnv, deleteR2Object } from "@mogd/media";

/**
 * Called from a native `<form action={...}>` submit, not a client-side
 * function call wrapped in try/catch — signOut()'s internal redirect must
 * be allowed to propagate normally (see apps/web sign-in/sign-up actions
 * for the same pattern; a wrapped client call swallows it, as happened
 * with an earlier exercise-save redirect bug).
 *
 * R2 deletion is best-effort per @mogd/media's deleteR2Object contract — a
 * stray orphaned object is recoverable manual cleanup, whereas blocking
 * account deletion on a transient R2 error would leave a user unable to
 * exercise their deletion request at all.
 */
export async function deleteAccountAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  const userId = session.user.id;
  const db = getDb();

  const objectKeys = await users.getPrivatePhotoObjectKeys(db, userId);

  const env = loadMediaEnv();
  if (env) {
    const creds = {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    };
    for (const objectKey of objectKeys) {
      try {
        await deleteR2Object(creds, env.R2_PRIVATE_PHOTOS_BUCKET, objectKey);
      } catch {
        // Best-effort cleanup — proceed regardless (see doc comment above).
      }
    }
  }

  await users.deleteUser(db, userId);

  await signOut({ redirectTo: "/" });
}
