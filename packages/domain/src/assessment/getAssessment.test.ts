import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { schema, type Database } from "@mogd/db";
import { createTestDatabase } from "@mogd/db/testUtils";
import { submitAssessment } from "./submitAssessment";
import { getUserAssessment } from "./getAssessment";
import type { AssessmentSubmission } from "./schemas";

const validSubmission: AssessmentSubmission = {
  primaryGoal: "muscle_gain",
  physiquePriorities: ["chest"],
  sex: "male",
  age: 30,
  heightCm: 175,
  weightKg: 78,
  waistCm: 82,
  experienceLevel: "beginner",
  trainingConsistency: "consistent",
  currentActivityLevel: "lightly_active",
  sessionsPerWeek: 3,
  sessionDurationMinutes: 45,
  trainingContext: ["home"],
  equipment: ["dumbbells"],
  dietaryPreference: "vegetarian",
  mealsPerDay: 4,
  cookingPreference: "enjoys_cooking",
  willingToTrackCalories: false,
  photos: [],
};

describe("getUserAssessment", () => {
  let close: () => void;
  let db: Database;
  let userId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const [user] = await db
      .insert(schema.users)
      .values({ email: "reader@example.com" })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterEach(() => {
    close();
  });

  it("returns null when the user has not completed an assessment", async () => {
    expect(await getUserAssessment(db, userId)).toBeNull();
  });

  it("returns a merged summary after a completed assessment", async () => {
    await submitAssessment(db, userId, validSubmission);
    const summary = await getUserAssessment(db, userId);

    expect(summary).not.toBeNull();
    expect(summary?.primaryGoal).toBe("muscle_gain");
    expect(summary?.physiquePriorities).toEqual(["chest"]);
    expect(summary?.weightKg).toBe(78);
    expect(summary?.sessionsPerWeek).toBe(3);
    expect(summary?.dietaryPreference).toBe("vegetarian");
  });
});
