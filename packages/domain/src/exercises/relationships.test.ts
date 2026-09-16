import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { type Database } from "@mogd/db";
import { createExercise } from "./exerciseCatalog";
import {
  createExerciseRelationship,
  deleteRelationship,
  getExerciseRelationships,
  getRelatedExerciseIds,
  SelfReferentialRelationshipError,
  DuplicateRelationshipError,
  RelationshipNotFoundError,
} from "./relationships";
import type { CreateExerciseInput } from "./schemas";

function exerciseInput(canonicalId: string, name: string): CreateExerciseInput {
  return {
    canonicalId,
    name,
    movementPattern: "pull",
    difficulty: "intermediate",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps"],
    equipment: ["pull_up_bar"],
    contraindicationTags: [],
    isActive: true,
  };
}

describe("exercise relationships", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
  });

  afterEach(() => close());

  it("creates a progression and reads it back as a progression on the source and a regression on the target", async () => {
    const pullUp = await createExercise(db, exerciseInput("pull_up", "Pull-up"));
    const weightedPullUp = await createExercise(db, exerciseInput("weighted_pull_up", "Weighted Pull-up"));

    await createExerciseRelationship(db, {
      exerciseId: pullUp!.id,
      relatedExerciseId: weightedPullUp!.id,
      action: "progression",
    });

    const pullUpView = await getExerciseRelationships(db, pullUp!.id);
    expect(pullUpView.progressions.map((e) => e.exercise.canonicalId)).toEqual(["weighted_pull_up"]);
    expect(pullUpView.regressions).toHaveLength(0);

    const weightedView = await getExerciseRelationships(db, weightedPullUp!.id);
    expect(weightedView.regressions.map((e) => e.exercise.canonicalId)).toEqual(["pull_up"]);
    expect(weightedView.progressions).toHaveLength(0);
  });

  it("rejects a self-relation", async () => {
    const pullUp = await createExercise(db, exerciseInput("pull_up", "Pull-up"));

    await expect(
      createExerciseRelationship(db, {
        exerciseId: pullUp!.id,
        relatedExerciseId: pullUp!.id,
        action: "variation",
      }),
    ).rejects.toThrow(SelfReferentialRelationshipError);
  });

  it("rejects a literal duplicate relationship", async () => {
    const pullUp = await createExercise(db, exerciseInput("pull_up", "Pull-up"));
    const weightedPullUp = await createExercise(db, exerciseInput("weighted_pull_up", "Weighted Pull-up"));

    await createExerciseRelationship(db, {
      exerciseId: pullUp!.id,
      relatedExerciseId: weightedPullUp!.id,
      action: "progression",
    });

    await expect(
      createExerciseRelationship(db, {
        exerciseId: pullUp!.id,
        relatedExerciseId: weightedPullUp!.id,
        action: "progression",
      }),
    ).rejects.toThrow(DuplicateRelationshipError);
  });

  it("rejects a reversed symmetric (variation/alternative) pair as a duplicate", async () => {
    const pullUp = await createExercise(db, exerciseInput("pull_up", "Pull-up"));
    const wideGrip = await createExercise(db, exerciseInput("wide_grip_pull_up", "Wide-grip Pull-up"));

    await createExerciseRelationship(db, {
      exerciseId: pullUp!.id,
      relatedExerciseId: wideGrip!.id,
      action: "variation",
    });

    await expect(
      createExerciseRelationship(db, {
        exerciseId: wideGrip!.id,
        relatedExerciseId: pullUp!.id,
        action: "variation",
      }),
    ).rejects.toThrow(DuplicateRelationshipError);
  });

  it("makes a variation queryable from either exercise regardless of creation direction", async () => {
    const pullUp = await createExercise(db, exerciseInput("pull_up", "Pull-up"));
    const neutralGrip = await createExercise(db, exerciseInput("neutral_grip_pull_up", "Neutral-grip Pull-up"));

    await createExerciseRelationship(db, {
      exerciseId: neutralGrip!.id,
      relatedExerciseId: pullUp!.id,
      action: "variation",
    });

    const pullUpView = await getExerciseRelationships(db, pullUp!.id);
    const neutralView = await getExerciseRelationships(db, neutralGrip!.id);
    expect(pullUpView.variations.map((e) => e.exercise.canonicalId)).toEqual(["neutral_grip_pull_up"]);
    expect(neutralView.variations.map((e) => e.exercise.canonicalId)).toEqual(["pull_up"]);
  });

  it("stores a 'regression' action as a swapped progression row", async () => {
    const pullUp = await createExercise(db, exerciseInput("pull_up", "Pull-up"));
    const australian = await createExercise(db, exerciseInput("australian_pull_up", "Australian Pull-up"));

    // "Pull-up regresses to Australian Pull-up" == "Australian Pull-up progresses to Pull-up".
    await createExerciseRelationship(db, {
      exerciseId: pullUp!.id,
      relatedExerciseId: australian!.id,
      action: "regression",
    });

    const pullUpView = await getExerciseRelationships(db, pullUp!.id);
    expect(pullUpView.regressions.map((e) => e.exercise.canonicalId)).toEqual(["australian_pull_up"]);

    const australianView = await getExerciseRelationships(db, australian!.id);
    expect(australianView.progressions.map((e) => e.exercise.canonicalId)).toEqual(["pull_up"]);
  });

  it("deletes a relationship and it disappears from both sides", async () => {
    const pullUp = await createExercise(db, exerciseInput("pull_up", "Pull-up"));
    const latPulldown = await createExercise(db, exerciseInput("lat_pulldown", "Lat Pulldown"));

    const created = await createExerciseRelationship(db, {
      exerciseId: pullUp!.id,
      relatedExerciseId: latPulldown!.id,
      action: "alternative",
    });

    await deleteRelationship(db, created!.id);

    expect((await getExerciseRelationships(db, pullUp!.id)).alternatives).toHaveLength(0);
    expect((await getExerciseRelationships(db, latPulldown!.id)).alternatives).toHaveLength(0);
  });

  it("throws deleting an unknown relationship id", async () => {
    await expect(deleteRelationship(db, "does-not-exist")).rejects.toThrow(RelationshipNotFoundError);
  });

  it("getRelatedExerciseIds unions every bucket", async () => {
    const pullUp = await createExercise(db, exerciseInput("pull_up", "Pull-up"));
    const weightedPullUp = await createExercise(db, exerciseInput("weighted_pull_up", "Weighted Pull-up"));
    const wideGrip = await createExercise(db, exerciseInput("wide_grip_pull_up", "Wide-grip Pull-up"));
    const latPulldown = await createExercise(db, exerciseInput("lat_pulldown", "Lat Pulldown"));

    await createExerciseRelationship(db, {
      exerciseId: pullUp!.id,
      relatedExerciseId: weightedPullUp!.id,
      action: "progression",
    });
    await createExerciseRelationship(db, {
      exerciseId: pullUp!.id,
      relatedExerciseId: wideGrip!.id,
      action: "variation",
    });
    await createExerciseRelationship(db, {
      exerciseId: pullUp!.id,
      relatedExerciseId: latPulldown!.id,
      action: "alternative",
    });

    const ids = await getRelatedExerciseIds(db, pullUp!.id);
    expect(ids).toEqual(new Set([weightedPullUp!.id, wideGrip!.id, latPulldown!.id]));
  });
});
