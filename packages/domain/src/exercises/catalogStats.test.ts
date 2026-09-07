import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { type Database } from "@mogd/db";
import { createExercise } from "./exerciseCatalog";
import { createDraftAsset, approveAsset } from "./assetService";
import { getCatalogStats } from "./catalogStats";
import type { CreateExerciseInput } from "./schemas";

const base: CreateExerciseInput = {
  canonicalId: "incline_dumbbell_press",
  name: "Incline Dumbbell Press",
  movementPattern: "push",
  difficulty: "intermediate",
  primaryMuscles: ["upper_chest"],
  secondaryMuscles: [],
  equipment: ["dumbbells"],
  contraindicationTags: [],
  isActive: true,
};

describe("getCatalogStats", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
  });

  afterEach(() => close());

  it("counts exercises missing a published video", async () => {
    const withVideo = await createExercise(db, base);
    await createExercise(db, { ...base, canonicalId: "romanian_deadlift", isActive: true });
    await createExercise(db, { ...base, canonicalId: "old_move", isActive: false });

    const asset = await createDraftAsset(db, {
      exerciseId: withVideo!.id,
      type: "video",
      objectKey: "v1.mp4",
    });
    await approveAsset(db, asset!.id);

    const stats = await getCatalogStats(db);
    expect(stats.totalExercises).toBe(3);
    expect(stats.activeExercises).toBe(2);
    // Only romanian_deadlift is active without a published video —
    // old_move is inactive and excluded from this count entirely.
    expect(stats.missingVideoCount).toBe(1);
  });
});
