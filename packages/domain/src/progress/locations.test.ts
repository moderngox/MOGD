import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import {
  createLocation,
  DuplicateLocationError,
  getDefaultLocationId,
  getOwnedLocation,
  listLocations,
  LocationNotFoundError,
} from "./locations";
import { finishSession, getInProgressSession, logSet } from "./sessions";
import { seedWorkout } from "./testFixtures";

describe("training locations", () => {
  let db: Database;
  let close: () => void;
  let userId: string;
  let otherUserId: string;
  let exerciseId: string;
  let workoutId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;

    const users = await db
      .insert(schema.users)
      .values([{ email: "a@example.com" }, { email: "b@example.com" }])
      .returning({ id: schema.users.id });
    userId = users[0]!.id;
    otherUserId = users[1]!.id;

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
      allowedSessionRoles: ["accessory"],
    });
    exerciseId = exercise!.id;
    workoutId = await seedWorkout(db, userId, [exerciseId]);
  });

  afterEach(() => close());

  async function performSessionAt(locationId: string | null) {
    await logSet(db, userId, { workoutId, exerciseId, locationId, setNumber: 1, reps: 10 });
    const open = (await getInProgressSession(db, userId, workoutId))!;
    await finishSession(db, userId, open.id);
    return open.id;
  }

  it("trims the name and lists a user's locations in creation order", async () => {
    await createLocation(db, userId, "  Home  ");
    await createLocation(db, userId, "Gym");
    expect((await listLocations(db, userId)).map((l) => l.name)).toEqual(["Home", "Gym"]);
  });

  it("rejects an empty name", async () => {
    await expect(createLocation(db, userId, "   ")).rejects.toThrow();
  });

  it("rejects a duplicate name regardless of case, but allows it for another user", async () => {
    await createLocation(db, userId, "Home");
    await expect(createLocation(db, userId, "home")).rejects.toThrow(DuplicateLocationError);
    await expect(createLocation(db, otherUserId, "Home")).resolves.toBeDefined();
  });

  it("makes the first location adopt every previously unassigned session", async () => {
    const sessionId = await performSessionAt(null);
    const home = await createLocation(db, userId, "Home");

    const [session] = await db.select().from(schema.workoutSessions).where(eq(schema.workoutSessions.id, sessionId));
    expect(session!.trainingLocationId).toBe(home.id);
  });

  it("does not let a second location adopt anything", async () => {
    const home = await createLocation(db, userId, "Home");
    const sessionId = await performSessionAt(home.id);
    await createLocation(db, userId, "Gym");

    const [session] = await db.select().from(schema.workoutSessions).where(eq(schema.workoutSessions.id, sessionId));
    expect(session!.trainingLocationId).toBe(home.id);
  });

  it("only returns a location to its owner", async () => {
    const home = await createLocation(db, userId, "Home");
    await expect(getOwnedLocation(db, userId, home.id)).resolves.toMatchObject({ name: "Home" });
    await expect(getOwnedLocation(db, otherUserId, home.id)).rejects.toThrow(LocationNotFoundError);
  });

  it("defaults to where the athlete trained last, or null when never", async () => {
    expect(await getDefaultLocationId(db, userId)).toBeNull();

    const home = await createLocation(db, userId, "Home");
    await performSessionAt(home.id);
    expect(await getDefaultLocationId(db, userId)).toBe(home.id);
  });
});
