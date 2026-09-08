import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { schema, type Database } from "@mogd/db";
import { createTestDatabase } from "@mogd/db/testUtils";
import { submitAssessment } from "./submitAssessment";
import type { AssessmentSubmission } from "./schemas";

const validSubmission: AssessmentSubmission = {
  primaryGoal: "recomposition",
  physiquePriorities: ["shoulders", "abs"],
  sex: "male",
  age: 25,
  heightCm: 180,
  weightKg: 80,
  waistCm: 85,
  experienceLevel: "intermediate",
  trainingConsistency: "consistent",
  currentActivityLevel: "moderately_active",
  sessionsPerWeek: 4,
  sessionDurationMinutes: 60,
  trainingContext: ["gym"],
  equipment: ["barbell", "dumbbells"],
  dietaryPreference: "standard",
  mealsPerDay: 3,
  cookingPreference: "meal_prep",
  willingToTrackCalories: true,
  photos: [],
};

describe("submitAssessment", () => {
  let close: () => void;
  let db: Database;
  let userId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const [user] = await db
      .insert(schema.users)
      .values({ email: "athlete@example.com" })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterEach(() => {
    close();
  });

  it("persists all five related rows for an eligible submission", async () => {
    const result = await submitAssessment(db, userId, validSubmission);
    expect(result).toEqual({ eligible: true, reasons: [] });

    const [assessment] = await db.select().from(schema.assessments);
    const [goals] = await db.select().from(schema.physiqueGoals);
    const [body] = await db.select().from(schema.bodyMeasurements);
    const [training] = await db.select().from(schema.trainingProfiles);
    const [nutrition] = await db.select().from(schema.nutritionProfiles);

    expect(assessment?.status).toBe("completed");
    expect(goals?.physiquePriorities).toEqual(["shoulders", "abs"]);
    expect(body?.weightKg).toBe(80);
    expect(training?.sessionsPerWeek).toBe(4);
    expect(nutrition?.mealsPerDay).toBe(3);
  });

  it("rejects an ineligible submission and persists nothing", async () => {
    const result = await submitAssessment(db, userId, { ...validSubmission, sex: "female" });
    expect(result.eligible).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);

    const assessments = await db.select().from(schema.assessments);
    const goals = await db.select().from(schema.physiqueGoals);
    expect(assessments).toHaveLength(0);
    expect(goals).toHaveLength(0);
  });

  it("upserts on a second submission instead of duplicating rows", async () => {
    await submitAssessment(db, userId, validSubmission);
    await submitAssessment(db, userId, { ...validSubmission, weightKg: 82 });

    const bodyRows = await db.select().from(schema.bodyMeasurements);
    expect(bodyRows).toHaveLength(1);
    expect(bodyRows[0]?.weightKg).toBe(82);
  });

  it("persists photo rows and upserts by angle on re-upload", async () => {
    await submitAssessment(db, userId, {
      ...validSubmission,
      photos: [{ angle: "front", objectKey: `users/${userId}/photos/v1.jpg` }],
    });
    await submitAssessment(db, userId, {
      ...validSubmission,
      photos: [{ angle: "front", objectKey: `users/${userId}/photos/v2.jpg` }],
    });

    const photos = await db.select().from(schema.assessmentPhotos);
    expect(photos).toHaveLength(1);
    expect(photos[0]?.objectKey).toBe(`users/${userId}/photos/v2.jpg`);
  });

  it("rejects a photo objectKey that doesn't belong to the requesting user, and persists nothing (IDOR guard)", async () => {
    await expect(
      submitAssessment(db, userId, {
        ...validSubmission,
        photos: [{ angle: "front", objectKey: "users/some-other-user-id/photos/front.jpg" }],
      }),
    ).rejects.toThrow();

    const assessments = await db.select().from(schema.assessments);
    const photos = await db.select().from(schema.assessmentPhotos);
    expect(assessments).toHaveLength(0);
    expect(photos).toHaveLength(0);
  });
});
