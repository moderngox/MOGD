import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { schema, type Database } from "@mogd/db";
import { createTestDatabase } from "@mogd/db/testUtils";
import { saveDraft, getDraft } from "./draft";
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
  trainingContext: "gym",
  equipment: ["barbell", "dumbbells"],
  dietaryPreference: "standard",
  mealsPerDay: 3,
  cookingPreference: "meal_prep",
  willingToTrackCalories: true,
  photos: [],
};

describe("assessment draft", () => {
  let close: () => void;
  let db: Database;
  let userId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const [user] = await db
      .insert(schema.users)
      .values({ email: "drafting@example.com" })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterEach(() => {
    close();
  });

  it("returns null when the user has no saved draft", async () => {
    expect(await getDraft(db, userId)).toBeNull();
  });

  it("round-trips a partial form state", async () => {
    await saveDraft(db, userId, { step: 2, formState: { primaryGoal: "muscle_gain", age: 28 } });

    const draft = await getDraft(db, userId);
    expect(draft).toEqual({ step: 2, formState: { primaryGoal: "muscle_gain", age: 28 } });
  });

  it("upserts on a second save instead of duplicating rows", async () => {
    await saveDraft(db, userId, { step: 1, formState: { primaryGoal: "fat_loss" } });
    await saveDraft(db, userId, { step: 3, formState: { primaryGoal: "fat_loss", age: 40 } });

    const rows = await db.select().from(schema.assessmentDrafts);
    expect(rows).toHaveLength(1);

    const draft = await getDraft(db, userId);
    expect(draft).toEqual({ step: 3, formState: { primaryGoal: "fat_loss", age: 40 } });
  });

  it("treats a draft that no longer matches the schema as no draft", async () => {
    await db.insert(schema.assessmentDrafts).values({
      userId,
      step: 2,
      formState: { primaryGoal: "not_a_real_goal" },
      updatedAt: new Date(),
    });

    expect(await getDraft(db, userId)).toBeNull();
  });

  it("is cleared once an eligible submission is persisted", async () => {
    await saveDraft(db, userId, { step: 5, formState: { primaryGoal: "recomposition" } });
    await submitAssessment(db, userId, validSubmission);

    expect(await getDraft(db, userId)).toBeNull();
  });

  it("is kept when a submission is rejected as ineligible", async () => {
    await saveDraft(db, userId, { step: 5, formState: { primaryGoal: "recomposition" } });
    const result = await submitAssessment(db, userId, { ...validSubmission, sex: "female" });
    expect(result.eligible).toBe(false);

    expect(await getDraft(db, userId)).toEqual({ step: 5, formState: { primaryGoal: "recomposition" } });
  });
});
