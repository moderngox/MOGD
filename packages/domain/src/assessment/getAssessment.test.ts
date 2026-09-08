import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { schema, type Database } from "@mogd/db";
import { createTestDatabase } from "@mogd/db/testUtils";
import { submitAssessment } from "./submitAssessment";
import { getUserAssessment, getAssessmentFormState } from "./getAssessment";
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

describe("getAssessmentFormState", () => {
  let close: () => void;
  let db: Database;
  let userId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const [user] = await db
      .insert(schema.users)
      .values({ email: "editor@example.com" })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterEach(() => {
    close();
  });

  it("returns null when the user has not completed an assessment", async () => {
    expect(await getAssessmentFormState(db, userId)).toBeNull();
  });

  it("returns every submitted field for re-editing, including ones getUserAssessment omits", async () => {
    await submitAssessment(db, userId, validSubmission);
    const formState = await getAssessmentFormState(db, userId);

    expect(formState).toEqual({
      primaryGoal: "muscle_gain",
      physiquePriorities: ["chest"],
      sex: "male",
      age: 30,
      heightCm: 175,
      weightKg: 78,
      waistCm: 82,
      targetWeightKg: undefined,
      experienceLevel: "beginner",
      trainingConsistency: "consistent",
      currentActivityLevel: "lightly_active",
      trainingHistoryNotes: undefined,
      limitations: undefined,
      injuryRestrictions: undefined,
      sessionsPerWeek: 3,
      sessionDurationMinutes: 45,
      trainingContext: ["home"],
      equipment: ["dumbbells"],
      dietaryPreference: "vegetarian",
      allergies: undefined,
      mealsPerDay: 4,
      cookingPreference: "enjoys_cooking",
      dislikedFoods: undefined,
      willingToTrackCalories: false,
      optionalNote: undefined,
    });
  });
});
