import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { submitCheckin } from "./submitCheckin";
import type { CheckinSubmission } from "./schemas";

const validSubmission: CheckinSubmission = {
  averageWeightKg: 79.5,
  waistCm: 84,
  nutritionAdherencePercent: 90,
  hunger: 3,
  energy: 4,
  recovery: 4,
  photos: [],
};

describe("submitCheckin", () => {
  let db: Database;
  let close: () => void;
  let userId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const [user] = await db
      .insert(schema.users)
      .values({ email: "checkin@example.com" })
      .returning({ id: schema.users.id });
    userId = user!.id;

    await db.insert(schema.programs).values({ userId, splitType: "full_body", sessionsPerWeek: 3 });
  });

  afterEach(() => close());

  it("persists a checkin with computed training adherence and runs adaptation", async () => {
    const result = await submitCheckin(db, userId, validSubmission);

    expect(result.checkinId).toBeTruthy();
    expect(result.trainingAdherencePercent).toBe(0); // no logged sessions yet
    expect(result.adaptation.decision.type).toBe("insufficient_data"); // first check-in ever

    const checkins = await db.select().from(schema.checkins);
    expect(checkins).toHaveLength(1);
    expect(checkins[0]?.averageWeightKg).toBe(79.5);
  });

  it("persists progress photos tied to the checkin", async () => {
    await submitCheckin(db, userId, {
      ...validSubmission,
      photos: [{ angle: "front", objectKey: "users/u1/progress/p1.jpg" }],
    });

    const photos = await db.select().from(schema.progressPhotos);
    expect(photos).toHaveLength(1);
    expect(photos[0]?.angle).toBe("front");
  });

  it("rejects an out-of-range submission", async () => {
    await expect(
      submitCheckin(db, userId, { ...validSubmission, nutritionAdherencePercent: 150 }),
    ).rejects.toThrow();
  });

  it("always produces exactly one plan_adjustment row per check-in", async () => {
    await submitCheckin(db, userId, validSubmission);
    await submitCheckin(db, userId, { ...validSubmission, averageWeightKg: 79 });

    const checkins = await db.select().from(schema.checkins);
    const adjustments = await db.select().from(schema.planAdjustments);
    expect(checkins).toHaveLength(2);
    expect(adjustments).toHaveLength(2);
  });
});
