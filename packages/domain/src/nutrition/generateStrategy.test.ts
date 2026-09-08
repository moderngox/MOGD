import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import {
  generateStrategyAndNutrition,
  AssessmentIncompleteError,
} from "./generateStrategy";
import { getGoalStrategy, getNutritionTarget } from "./getTargets";

async function seedProfile(
  db: Database,
  userId: string,
  overrides: {
    primaryGoal?: string;
    physiquePriorities?: string[];
    weightKg?: number;
    heightCm?: number;
    age?: number;
    activityLevel?: string;
  } = {},
) {
  await db.insert(schema.physiqueGoals).values({
    userId,
    primaryGoal: overrides.primaryGoal ?? "recomposition",
    physiquePriorities: overrides.physiquePriorities ?? ["shoulders"],
  });
  await db.insert(schema.bodyMeasurements).values({
    userId,
    sex: "male",
    age: overrides.age ?? 30,
    heightCm: overrides.heightCm ?? 180,
    weightKg: overrides.weightKg ?? 80,
    waistCm: 85,
  });
  await db.insert(schema.trainingProfiles).values({
    userId,
    experienceLevel: "intermediate",
    trainingConsistency: "consistent",
    currentActivityLevel: overrides.activityLevel ?? "moderately_active",
    sessionsPerWeek: 4,
    sessionDurationMinutes: 60,
    trainingContext: ["gym"],
    equipment: ["dumbbells"],
  });
}

describe("generateStrategyAndNutrition", () => {
  let db: Database;
  let close: () => void;
  let userId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
    const [user] = await db
      .insert(schema.users)
      .values({ email: "strategy@example.com" })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterEach(() => close());

  it("throws when the user has no completed assessment", async () => {
    await expect(generateStrategyAndNutrition(db, userId)).rejects.toThrow(
      AssessmentIncompleteError,
    );
  });

  it("compiles and persists a strategy and nutrition target for a normal profile", async () => {
    await seedProfile(db, userId);
    const result = await generateStrategyAndNutrition(db, userId);

    expect(result.success).toBe(true);
    expect(result.strategy?.energyDirection).toBe("slight_deficit");
    expect(result.nutrition?.energyKcal).toBeGreaterThan(1500);

    const persistedStrategy = await getGoalStrategy(db, userId);
    const persistedNutrition = await getNutritionTarget(db, userId);
    expect(persistedStrategy?.primaryGoal).toBe("recomposition");
    expect(persistedNutrition?.proteinG).toBeCloseTo(80 * 2.0);
  });

  it("rejects and persists nothing for an extreme profile that fails validation", async () => {
    // Minimum allowed weight/height (per M1's own schema bounds) at the
    // oldest allowed age, sedentary, on a fat-loss deficit — a genuinely
    // unsafe combination the system's own input bounds still permit.
    await seedProfile(db, userId, {
      primaryGoal: "fat_loss",
      weightKg: 30,
      heightCm: 120,
      age: 100,
      activityLevel: "sedentary",
    });

    const result = await generateStrategyAndNutrition(db, userId);

    expect(result.success).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(await getGoalStrategy(db, userId)).toBeNull();
    expect(await getNutritionTarget(db, userId)).toBeNull();
  });

  it("upserts on a second call instead of duplicating rows", async () => {
    await seedProfile(db, userId, { weightKg: 80 });
    await generateStrategyAndNutrition(db, userId);

    await db
      .update(schema.bodyMeasurements)
      .set({ weightKg: 85 })
      .where(eq(schema.bodyMeasurements.userId, userId));
    await generateStrategyAndNutrition(db, userId);

    const rows = await db.select().from(schema.nutritionTargets);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.proteinG).toBeCloseTo(85 * 2.0);
  });
});
