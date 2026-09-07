import { eq, and, desc, max } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { createDraftAssetInput } from "./schemas";
import type { CreateDraftAssetInput } from "./schemas";

export class AssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`No exercise asset with id "${assetId}"`);
    this.name = "AssetNotFoundError";
  }
}

/**
 * Records an already-uploaded object (the actual PUT to R2 happens
 * separately via @mogd/media — see docs/CLAUDE.md rule 7, no generation
 * call happens here or anywhere in this service). Version numbers increment
 * per (exerciseId, type) so a full history survives every replacement.
 */
export async function createDraftAsset(db: Database, rawInput: CreateDraftAssetInput) {
  const input = createDraftAssetInput.parse(rawInput);

  const [row] = await db
    .select({ latest: max(schema.exerciseAssets.version) })
    .from(schema.exerciseAssets)
    .where(
      and(
        eq(schema.exerciseAssets.exerciseId, input.exerciseId),
        eq(schema.exerciseAssets.type, input.type),
      ),
    );

  const [asset] = await db
    .insert(schema.exerciseAssets)
    .values({ ...input, version: (row?.latest ?? 0) + 1, status: "draft" })
    .returning();
  return asset;
}

/**
 * Human visual review is mandatory before publication
 * (docs/ARCHITECTURE.md §20) — this function is the publish step itself,
 * called only after an admin has previewed the asset. Archiving the
 * previous approved row happens in the same transaction as approving the
 * new one, so the "at most one approved row" partial unique index is never
 * transiently violated and a reader never sees zero published assets
 * mid-replace.
 */
export async function approveAsset(db: Database, assetId: string, validationNotes?: string) {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(schema.exerciseAssets)
      .where(eq(schema.exerciseAssets.id, assetId));
    if (!target) throw new AssetNotFoundError(assetId);

    await tx
      .update(schema.exerciseAssets)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(schema.exerciseAssets.exerciseId, target.exerciseId),
          eq(schema.exerciseAssets.type, target.type),
          eq(schema.exerciseAssets.status, "approved"),
        ),
      );

    const [approved] = await tx
      .update(schema.exerciseAssets)
      .set({ status: "approved", validationNotes, updatedAt: new Date() })
      .where(eq(schema.exerciseAssets.id, assetId))
      .returning();
    return approved;
  });
}

/** Manual unpublish — the asset row and its history stay, just no longer live. */
export async function archiveAsset(db: Database, assetId: string) {
  const [asset] = await db
    .update(schema.exerciseAssets)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(schema.exerciseAssets.id, assetId))
    .returning();
  if (!asset) throw new AssetNotFoundError(assetId);
  return asset;
}

export async function getPublishedAsset(
  db: Database,
  exerciseId: string,
  type: "video" | "thumbnail",
) {
  const [asset] = await db
    .select()
    .from(schema.exerciseAssets)
    .where(
      and(
        eq(schema.exerciseAssets.exerciseId, exerciseId),
        eq(schema.exerciseAssets.type, type),
        eq(schema.exerciseAssets.status, "approved"),
      ),
    );
  return asset ?? null;
}

export async function listAssetsForExercise(db: Database, exerciseId: string) {
  return db
    .select()
    .from(schema.exerciseAssets)
    .where(eq(schema.exerciseAssets.exerciseId, exerciseId))
    .orderBy(desc(schema.exerciseAssets.version));
}
