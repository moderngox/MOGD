import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { createExercise } from "../exercises/exerciseCatalog";
import { generateStrategyAndNutrition } from "../nutrition/generateStrategy";
import { generateProgram, StrategyIncompleteError } from "./generateProgram";
import type { CreateExerciseInput } from "../exercises/schemas";

const CATALOG: CreateExerciseInput[] = [
  {
    canonicalId: "incline_dumbbell_press",
    name: "Incline Dumbbell Press",
    movementPattern: "push",
    difficulty: "intermediate",
    primaryMuscles: ["upper_chest"],
    secondaryMuscles: ["triceps"],
    equipment: ["dumbbells"],
    contraindicationTags: [],
    isActive: true,
  },
  {
    canonicalId: "neutral_grip_lat_pulldown",
    name: "Neutral Grip Lat Pulldown",
    movementPattern: "pull",
    difficulty: "beginner",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps"],
    equipment: ["pull_up_bar"],
    contraindicationTags: [],
    isActive: true,
  },
  {
    canonicalId: "cable_lateral_raise",
    name: "Cable Lateral Raise",
    movementPattern: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["lateral_deltoids"],
    secondaryMuscles: [],
    equipment: ["dumbbells"],
    contraindicationTags: [],
    isActive: true,
  },
  {
    canonicalId: "bulgarian_split_squat",
    name: "Bulgarian Split Squat",
    movementPattern: "lunge",
    difficulty: "intermediate",
    primaryMuscles: ["quadriceps", "glutes"],
    secondaryMuscles: ["hamstrings"],
    equipment: ["dumbbells"],
    contraindicationTags: [],
    isActive: true,
  },
  {
    canonicalId: "romanian_deadlift",
    name: "Romanian Deadlift",
    movementPattern: "hinge",
    difficulty: "intermediate",
    primaryMuscles: ["hamstrings", "glutes"],
    secondaryMuscles: [],
    equipment: ["dumbbells"],
    contraindicationTags: [],
    isActive: true,
  },
  {
    canonicalId: "hanging_leg_raise",
    name: "Hanging Leg Raise",
    movementPattern: "isolation",
    difficulty: "intermediate",
    primaryMuscles: ["rectus_abdominis"],
    secondaryMuscles: [],
    equipment: ["pull_up_bar"],
    contraindicationTags: [],
    isActive: true,
  },
];

async function seedUser(db: Database) {
  const [user] = await db
    .insert(schema.users)
    .values({ email: "program-test@example.com" })
    .returning({ id: schema.users.id });
  const userId = user!.id;

  await db.insert(schema.physiqueGoals).values({
    userId,
    primaryGoal: "recomposition",
    physiquePriorities: ["shoulders"],
  });
  await db.insert(schema.bodyMeasurements).values({
    userId,
    sex: "male",
    age: 30,
    heightCm: 180,
    weightKg: 80,
    waistCm: 85,
  });
  await db.insert(schema.trainingProfiles).values({
    userId,
    experienceLevel: "intermediate",
    trainingConsistency: "consistent",
    currentActivityLevel: "moderately_active",
    sessionsPerWeek: 2,
    sessionDurationMinutes: 60,
    trainingContext: "gym",
    equipment: ["dumbbells", "pull_up_bar"],
  });

  return userId;
}

describe("generateProgram", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
    for (const exercise of CATALOG) {
      await createExercise(db, exercise);
    }
  });

  afterEach(() => close());

  it("throws when the user has no goal strategy yet", async () => {
    const userId = await seedUser(db);
    await expect(generateProgram(db, userId)).rejects.toThrow(StrategyIncompleteError);
  });

  it("generates a valid, persisted program fitting schedule and equipment", async () => {
    const userId = await seedUser(db);
    await generateStrategyAndNutrition(db, userId);

    const result = await generateProgram(db, userId);
    expect(result.success).toBe(true);
    expect(result.plan?.workouts).toHaveLength(2); // sessionsPerWeek: 2 -> full_body x2

    const programs = await db.select().from(schema.programs);
    expect(programs).toHaveLength(1);
    const workouts = await db.select().from(schema.workouts);
    expect(workouts).toHaveLength(2);

    const workoutExercises = await db.select().from(schema.workoutExercises);
    for (const we of workoutExercises) {
      expect(we.sets).toBeGreaterThanOrEqual(2);
      expect(we.sets).toBeLessThanOrEqual(5);
    }
  });

  it("only uses exercises requiring equipment the user actually has", async () => {
    const userId = await seedUser(db);
    // barbell_back_squat requires equipment the user doesn't have.
    await createExercise(db, {
      canonicalId: "barbell_back_squat",
      name: "Barbell Back Squat",
      movementPattern: "squat",
      difficulty: "intermediate",
      primaryMuscles: ["quadriceps"],
      secondaryMuscles: [],
      equipment: ["barbell"],
      contraindicationTags: [],
      isActive: true,
    });
    await generateStrategyAndNutrition(db, userId);
    await generateProgram(db, userId);

    const workoutExercises = await db
      .select({ exerciseId: schema.workoutExercises.exerciseId })
      .from(schema.workoutExercises);
    const usedExerciseIds = new Set(workoutExercises.map((w) => w.exerciseId));

    const [barbellSquat] = await db
      .select()
      .from(schema.exercises)
      .where(eq(schema.exercises.canonicalId, "barbell_back_squat"));
    expect(usedExerciseIds.has(barbellSquat!.id)).toBe(false);
  });

  it("replaces workouts on regeneration without duplicating the program row", async () => {
    const userId = await seedUser(db);
    await generateStrategyAndNutrition(db, userId);
    await generateProgram(db, userId);
    await generateProgram(db, userId);

    const programs = await db.select().from(schema.programs);
    expect(programs).toHaveLength(1);
    const workouts = await db.select().from(schema.workouts);
    expect(workouts).toHaveLength(2);
  });

  it("preserves exercise_logs after a program regeneration deletes the old workout", async () => {
    const userId = await seedUser(db);
    await generateStrategyAndNutrition(db, userId);
    await generateProgram(db, userId);

    const [firstWorkout] = await db.select().from(schema.workouts);
    const [firstExercise] = await db
      .select()
      .from(schema.workoutExercises)
      .where(eq(schema.workoutExercises.workoutId, firstWorkout!.id));

    await db.insert(schema.exerciseLogs).values({
      userId,
      exerciseId: firstExercise!.exerciseId,
      workoutId: firstWorkout!.id,
      setNumber: 1,
      loadKg: 30,
      reps: 10,
    });

    await generateProgram(db, userId); // regenerate — deletes old workouts

    const logs = await db.select().from(schema.exerciseLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.workoutId).toBeNull(); // FK set null, row preserved
  });
});
