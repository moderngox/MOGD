import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";

/**
 * Every user-owned table cascades from users.id via onDelete: "cascade"
 * except exercise_logs.workoutId (deliberately onDelete: "set null" so
 * historical performance data survives program regeneration — see
 * packages/db schema comments). Deleting the users row is therefore
 * sufficient to erase all of a user's assessment, strategy, program,
 * measurement, check-in and ai_runs data at the database level.
 *
 * R2 objects are NOT database rows and do not cascade, so private photos
 * must be collected and deleted before this runs (CLAUDE.md rule 9). This
 * function deliberately does not touch R2 itself — object storage access
 * stays at the application boundary throughout this codebase (see
 * packages/domain/exercises/assetService.ts), not inside domain code.
 */
export async function getPrivatePhotoObjectKeys(db: Database, userId: string): Promise<string[]> {
  const [assessmentPhotos, progressPhotos] = await Promise.all([
    db
      .select({ objectKey: schema.assessmentPhotos.objectKey })
      .from(schema.assessmentPhotos)
      .where(eq(schema.assessmentPhotos.userId, userId)),
    db
      .select({ objectKey: schema.progressPhotos.objectKey })
      .from(schema.progressPhotos)
      .where(eq(schema.progressPhotos.userId, userId)),
  ]);

  return [...assessmentPhotos, ...progressPhotos].map((row) => row.objectKey);
}

/** Call only after any private photo objects this user owns have already
 * been removed from R2 — this is the irreversible, final step. */
export async function deleteUser(db: Database, userId: string): Promise<void> {
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}
