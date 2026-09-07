import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { computeTrainingAdherence } from "./trainingAdherence";

describe("computeTrainingAdherence", () => {
  let db: Database;
  let close: () => void;
  let userId: string;
  let exerciseId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const [user] = await db
      .insert(schema.users)
      .values({ email: "adherence@example.com" })
      .returning({ id: schema.users.id });
    userId = user!.id;

    const exercise = await createExercise(db, {
      canonicalId: "incline_dumbbell_press",
      name: "Incline Dumbbell Press",
      movementPattern: "push",
      difficulty: "intermediate",
      primaryMuscles: ["upper_chest"],
      secondaryMuscles: [],
      equipment: ["dumbbells"],
      contraindicationTags: [],
      isActive: true,
    });
    exerciseId = exercise!.id;

    await db.insert(schema.programs).values({ userId, splitType: "full_body", sessionsPerWeek: 3 });
  });

  afterEach(() => close());

  it("returns 0 with no program", async () => {
    const [otherUser] = await db
      .insert(schema.users)
      .values({ email: "no-program@example.com" })
      .returning({ id: schema.users.id });
    const result = await computeTrainingAdherence(db, otherUser!.id, new Date());
    expect(result).toBe(0);
  });

  it("returns 0 with no logged sessions", async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(await computeTrainingAdherence(db, userId, since)).toBe(0);
  });

  it("counts distinct training days toward the expected weekly session count", async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 1 week, 3 expected sessions
    await db.insert(schema.exerciseLogs).values({ userId, exerciseId, setNumber: 1, reps: 10 });

    const result = await computeTrainingAdherence(db, userId, since);
    // 1 of 3 expected sessions this week.
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  it("caps at 100 even with more logged days than expected sessions", async () => {
    const since = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day, <1 expected session
    await db.insert(schema.exerciseLogs).values({ userId, exerciseId, setNumber: 1, reps: 10 });
    const result = await computeTrainingAdherence(db, userId, since);
    expect(result).toBeLessThanOrEqual(100);
  });
});
