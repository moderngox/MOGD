import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { logSet } from "../progress/sessions";
import { seedWorkout } from "../progress/testFixtures";
import { getWeeklySessionStatus } from "./getWeeklySessionStatus";

describe("getWeeklySessionStatus", () => {
  let db: Database;
  let close: () => void;
  let userId: string;
  let exerciseId: string;
  let firstWorkoutId: string;
  let secondWorkoutId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const [user] = await db.insert(schema.users).values({ email: "week@example.com" }).returning({ id: schema.users.id });
    userId = user!.id;
    const exercise = await createExercise(db, {
      canonicalId: "cable_lateral_raise",
      name: "Cable Lateral Raise",
      movementPattern: "isolation",
      difficulty: "beginner",
      primaryMuscles: ["lateral_deltoids"],
      secondaryMuscles: [],
      equipment: ["cables"],
      contraindicationTags: [],
      isActive: true,
      allowedSessionRoles: [],
    });
    exerciseId = exercise!.id;
    firstWorkoutId = await seedWorkout(db, userId, [exerciseId]);
    secondWorkoutId = await seedWorkout(db, userId, [exerciseId]);
    await db.update(schema.workouts).set({ dayIndex: 1 }).where(eq(schema.workouts.id, secondWorkoutId));
  });

  afterEach(() => close());

  it("marks the first unlogged slot as today and the rest as scheduled", async () => {
    const week = await getWeeklySessionStatus(db, userId);
    expect(week.map((w) => w.status)).toEqual(["today", "scheduled"]);
  });

  it("marks a slot logged as soon as an occurrence has a set, without needing to finish it", async () => {
    await logSet(db, userId, { workoutId: firstWorkoutId, exerciseId, setNumber: 1, reps: 10 });

    const week = await getWeeklySessionStatus(db, userId);
    expect(week.map((w) => w.status)).toEqual(["logged", "today"]);
    expect(week[0]!.loggedAt).toBeInstanceOf(Date);
  });
});
