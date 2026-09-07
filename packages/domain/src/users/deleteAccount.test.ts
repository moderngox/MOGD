import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { getPrivatePhotoObjectKeys, deleteUser } from "./deleteAccount";

async function seedUserWithData(db: Database) {
  const [user] = await db
    .insert(schema.users)
    .values({ email: "delete-me@example.com" })
    .returning({ id: schema.users.id });
  const userId = user!.id;

  await db.insert(schema.assessmentPhotos).values({
    userId,
    angle: "front",
    objectKey: `users/${userId}/photos/assessment-front.jpg`,
    consentGrantedAt: new Date(),
  });

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
    })
    .returning();

  await db.insert(schema.progressPhotos).values({
    userId,
    checkinId: checkin!.id,
    angle: "front",
    objectKey: `users/${userId}/photos/checkin-front.jpg`,
    consentGrantedAt: new Date(),
  });

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

describe("account deletion", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
  });

  afterEach(() => close());

  it("collects every private photo object key across assessment and check-in photos", async () => {
    const userId = await seedUserWithData(db);
    const keys = await getPrivatePhotoObjectKeys(db, userId);

    expect(keys).toHaveLength(2);
    expect(keys).toContain(`users/${userId}/photos/assessment-front.jpg`);
    expect(keys).toContain(`users/${userId}/photos/checkin-front.jpg`);
  });

  it("returns no keys for a user who never uploaded a private photo", async () => {
    const userId = await seedUserWithData(db);
    // A second, photo-less user shouldn't pick up the first user's keys.
    const [other] = await db
      .insert(schema.users)
      .values({ email: "no-photos@example.com" })
      .returning({ id: schema.users.id });

    const keys = await getPrivatePhotoObjectKeys(db, other!.id);
    expect(keys).toHaveLength(0);
    // Sanity: the seeded user still has their own keys, unaffected.
    expect(await getPrivatePhotoObjectKeys(db, userId)).toHaveLength(2);
  });

  it("deleting the user cascades away every owned row, per the DB's onDelete rules", async () => {
    const userId = await seedUserWithData(db);

    await deleteUser(db, userId);

    expect(await db.select().from(schema.users)).toHaveLength(0);
    expect(await db.select().from(schema.assessmentPhotos)).toHaveLength(0);
    expect(await db.select().from(schema.progressPhotos)).toHaveLength(0);
    expect(await db.select().from(schema.checkins)).toHaveLength(0);
    expect(await db.select().from(schema.bodyMeasurements)).toHaveLength(0);
  });
});
