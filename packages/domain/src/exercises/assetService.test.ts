import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "./exerciseCatalog";
import {
  createDraftAsset,
  approveAsset,
  archiveAsset,
  getPublishedAsset,
  listAssetsForExercise,
  AssetNotFoundError,
} from "./assetService";
import type { CreateExerciseInput } from "./schemas";

const exerciseInput: CreateExerciseInput = {
  canonicalId: "romanian_deadlift",
  name: "Romanian Deadlift",
  movementPattern: "hinge",
  difficulty: "intermediate",
  primaryMuscles: ["hamstrings", "glutes"],
  secondaryMuscles: [],
  equipment: ["barbell"],
  contraindicationTags: [],
  isActive: true,
};

describe("asset lifecycle", () => {
  let db: Database;
  let close: () => void;
  let exerciseId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
    const exercise = await createExercise(db, exerciseInput);
    exerciseId = exercise!.id;
  });

  afterEach(() => close());

  it("starts a new asset as draft with version 1", async () => {
    const asset = await createDraftAsset(db, {
      exerciseId,
      type: "video",
      objectKey: "exercises/romanian_deadlift/v1.mp4",
    });
    expect(asset?.status).toBe("draft");
    expect(asset?.version).toBe(1);
    expect(await getPublishedAsset(db, exerciseId, "video")).toBeNull();
  });

  it("publishes a draft on approval", async () => {
    const asset = await createDraftAsset(db, {
      exerciseId,
      type: "video",
      objectKey: "exercises/romanian_deadlift/v1.mp4",
    });
    await approveAsset(db, asset!.id, "Looks good");

    const published = await getPublishedAsset(db, exerciseId, "video");
    expect(published?.id).toBe(asset!.id);
    expect(published?.validationNotes).toBe("Looks good");
  });

  it("archives the previous approved asset when a replacement is approved, never leaving two published at once", async () => {
    const v1 = await createDraftAsset(db, {
      exerciseId,
      type: "video",
      objectKey: "exercises/romanian_deadlift/v1.mp4",
    });
    await approveAsset(db, v1!.id);

    const v2 = await createDraftAsset(db, {
      exerciseId,
      type: "video",
      objectKey: "exercises/romanian_deadlift/v2.mp4",
    });
    await approveAsset(db, v2!.id);

    const allAssets = await db.select().from(schema.exerciseAssets);
    const approvedRows = allAssets.filter((a) => a.status === "approved");
    expect(approvedRows).toHaveLength(1);
    expect(approvedRows[0]?.id).toBe(v2!.id);

    const v1Row = allAssets.find((a) => a.id === v1!.id);
    expect(v1Row?.status).toBe("archived");

    // Historical reference survives — the old row is still there, just archived.
    const history = await listAssetsForExercise(db, exerciseId);
    expect(history.map((a) => a.version)).toEqual([2, 1]);
  });

  it("increments version per exercise+type independently", async () => {
    await createDraftAsset(db, { exerciseId, type: "video", objectKey: "v1.mp4" });
    await createDraftAsset(db, { exerciseId, type: "video", objectKey: "v2.mp4" });
    const thumbnail = await createDraftAsset(db, {
      exerciseId,
      type: "thumbnail",
      objectKey: "t1.jpg",
    });

    expect(thumbnail?.version).toBe(1);
  });

  it("unpublishes via archive without deleting the row", async () => {
    const asset = await createDraftAsset(db, {
      exerciseId,
      type: "video",
      objectKey: "v1.mp4",
    });
    await approveAsset(db, asset!.id);
    await archiveAsset(db, asset!.id);

    expect(await getPublishedAsset(db, exerciseId, "video")).toBeNull();
    const history = await listAssetsForExercise(db, exerciseId);
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe("archived");
  });

  it("throws for an unknown asset id", async () => {
    await expect(approveAsset(db, "does-not-exist")).rejects.toThrow(AssetNotFoundError);
    await expect(archiveAsset(db, "does-not-exist")).rejects.toThrow(AssetNotFoundError);
  });
});
