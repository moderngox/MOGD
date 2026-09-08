import { describe, expect, it } from "vitest";
import { physiquePrioritiesStepSchema, assessmentSubmissionSchema } from "./schemas";

const validSubmissionBase = {
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
};

describe("physiquePrioritiesStepSchema", () => {
  it("accepts 1 to 3 unique priorities", () => {
    expect(
      physiquePrioritiesStepSchema.safeParse({ physiquePriorities: ["chest"] }).success,
    ).toBe(true);
    expect(
      physiquePrioritiesStepSchema.safeParse({
        physiquePriorities: ["chest", "back", "legs"],
      }).success,
    ).toBe(true);
  });

  it("rejects more than 3 priorities", () => {
    const result = physiquePrioritiesStepSchema.safeParse({
      physiquePriorities: ["chest", "back", "legs", "arms"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero priorities", () => {
    expect(physiquePrioritiesStepSchema.safeParse({ physiquePriorities: [] }).success).toBe(
      false,
    );
  });

  it("rejects duplicate priorities", () => {
    const result = physiquePrioritiesStepSchema.safeParse({
      physiquePriorities: ["chest", "chest"],
    });
    expect(result.success).toBe(false);
  });
});

describe("assessmentSubmissionSchema", () => {
  it("accepts a full valid submission with no photos", () => {
    const result = assessmentSubmissionSchema.safeParse(validSubmissionBase);
    expect(result.success).toBe(true);
  });

  it("accepts one photo per angle", () => {
    const result = assessmentSubmissionSchema.safeParse({
      ...validSubmissionBase,
      photos: [
        { angle: "front", objectKey: "users/u1/photos/p1.jpg" },
        { angle: "side", objectKey: "users/u1/photos/p2.jpg" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects two photos for the same angle", () => {
    const result = assessmentSubmissionSchema.safeParse({
      ...validSubmissionBase,
      photos: [
        { angle: "front", objectKey: "users/u1/photos/p1.jpg" },
        { angle: "front", objectKey: "users/u1/photos/p2.jpg" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range age", () => {
    const result = assessmentSubmissionSchema.safeParse({ ...validSubmissionBase, age: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects a bounded note over the length limit", () => {
    const result = assessmentSubmissionSchema.safeParse({
      ...validSubmissionBase,
      optionalNote: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
