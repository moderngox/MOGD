import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { runAdaptation } from "./runAdaptation";

async function seedUser(db: Database) {
  const [user] = await db
    .insert(schema.users)
    .values({ email: "adaptation@example.com" })
    .returning({ id: schema.users.id });
  const userId = user!.id;

  await db.insert(schema.bodyMeasurements).values({
    userId,
    sex: "male",
    age: 30,
    heightCm: 180,
    weightKg: 80,
    waistCm: 85,
  });

  return userId;
}

async function seedNutritionTarget(
  db: Database,
  userId: string,
  overrides: Partial<typeof schema.nutritionTargets.$inferInsert> = {},
) {
  await db.insert(schema.nutritionTargets).values({
    userId,
    bmr: 1780,
    tdee: 2759,
    energyDirection: "slight_deficit",
    energyKcal: 2483,
    proteinG: 160,
    fatG: 69,
    carbG: 306,
    ...overrides,
  });
}

async function seedCheckin(
  db: Database,
  userId: string,
  overrides: Partial<typeof schema.checkins.$inferInsert> = {},
) {
  const [checkin] = await db
    .insert(schema.checkins)
    .values({
      userId,
      averageWeightKg: 80,
      waistCm: 85,
      trainingAdherencePercent: 90,
      nutritionAdherencePercent: 90,
      hunger: 3,
      energy: 3,
      recovery: 3,
      ...overrides,
    })
    .returning();
  return checkin!;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe("runAdaptation", () => {
  let db: Database;
  let close: () => void;
  let userId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
    userId = await seedUser(db);
  });

  afterEach(() => close());

  it("returns insufficient_data with fewer than 2 check-ins, and still records the attempt", async () => {
    const checkin = await seedCheckin(db, userId);
    const result = await runAdaptation(db, userId, checkin.id);

    expect(result.decision.type).toBe("insufficient_data");
    expect(result.outcome).toBe("not_attempted");

    const adjustments = await db.select().from(schema.planAdjustments);
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]?.decisionType).toBe("insufficient_data");
  });

  it("applies a calorie decrease and persists it when progress has stalled with good adherence", async () => {
    await seedNutritionTarget(db, userId);
    await seedCheckin(db, userId, {
      averageWeightKg: 80,
      nutritionAdherencePercent: 92,
      completedAt: new Date(Date.now() - 2 * WEEK_MS),
    });
    const latest = await seedCheckin(db, userId, {
      averageWeightKg: 79.9, // barely moved -> stalled relative to a slight deficit
      nutritionAdherencePercent: 92,
      completedAt: new Date(),
    });

    const result = await runAdaptation(db, userId, latest.id);

    expect(result.decision.type).toBe("adjust_calories");
    expect(result.outcome).toBe("applied");

    const [target] = await db.select().from(schema.nutritionTargets).where(eq(schema.nutritionTargets.userId, userId));
    expect(target?.energyKcal).toBeLessThan(2483); // stalled loss -> bigger deficit
  });

  it("addresses adherence instead of adjusting calories when nutrition adherence is poor", async () => {
    await seedNutritionTarget(db, userId);
    await seedCheckin(db, userId, {
      averageWeightKg: 80,
      completedAt: new Date(Date.now() - 2 * WEEK_MS),
    });
    const latest = await seedCheckin(db, userId, {
      averageWeightKg: 79.9,
      nutritionAdherencePercent: 54,
      completedAt: new Date(),
    });

    const result = await runAdaptation(db, userId, latest.id);

    expect(result.decision.type).toBe("address_adherence");
    expect(result.outcome).toBe("not_attempted");

    const [target] = await db.select().from(schema.nutritionTargets).where(eq(schema.nutritionTargets.userId, userId));
    expect(target?.energyKcal).toBe(2483); // untouched
  });

  it("rejects an adjustment that would breach the safety floor and preserves the previous valid target", async () => {
    // Starting just above the 1500kcal floor (150kcal deficit vs tdee, so
    // expected ~-0.136 kg/week); a 150kcal decrease would breach the floor.
    await seedNutritionTarget(db, userId, { energyKcal: 1550, tdee: 1700 });
    await seedCheckin(db, userId, {
      averageWeightKg: 80,
      nutritionAdherencePercent: 92,
      completedAt: new Date(Date.now() - 2 * WEEK_MS),
    });
    const latest = await seedCheckin(db, userId, {
      // Slight *gain* despite the deficit — well outside the hold band
      // around the expected -0.136 kg/week, so this should trigger a
      // decrease rather than a hold.
      averageWeightKg: 80.05,
      nutritionAdherencePercent: 92,
      completedAt: new Date(),
    });

    const result = await runAdaptation(db, userId, latest.id);

    expect(result.decision.type).toBe("adjust_calories");
    expect(result.outcome).toBe("rejected");

    const [target] = await db.select().from(schema.nutritionTargets).where(eq(schema.nutritionTargets.userId, userId));
    // Previous valid state is untouched despite the rejected adjustment attempt.
    expect(target?.energyKcal).toBe(1550);

    const adjustments = await db.select().from(schema.planAdjustments);
    expect(adjustments[0]?.outcome).toBe("rejected");
    expect(adjustments[0]?.reason).toMatch(/Rejected/);
  });

  it("holds when the actual trend matches the expected trend", async () => {
    await seedNutritionTarget(db, userId); // slight_deficit, expected ~-0.16kg/week
    await seedCheckin(db, userId, {
      averageWeightKg: 80,
      completedAt: new Date(Date.now() - 2 * WEEK_MS),
    });
    const latest = await seedCheckin(db, userId, {
      averageWeightKg: 79.68, // close to the expected 2-week loss
      nutritionAdherencePercent: 90,
      completedAt: new Date(),
    });

    const result = await runAdaptation(db, userId, latest.id);
    expect(result.decision.type).toBe("hold");
    expect(result.outcome).toBe("not_attempted");
  });
});
