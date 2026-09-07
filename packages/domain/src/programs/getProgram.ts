import { eq, asc } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { getPublishedAsset } from "../exercises/assetService";
import { explainExerciseSelection } from "../training/explainSelection";
import type { SessionLabel } from "../training/splitTemplates";

export interface ProgramWorkoutExerciseView {
  workoutExerciseId: string;
  exerciseId: string;
  canonicalId: string;
  name: string;
  instructions: string | null;
  orderIndex: number;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number;
  restSeconds: number;
  videoObjectKey: string | null;
  selectionReason: string;
}

export interface ProgramWorkoutView {
  workoutId: string;
  dayIndex: number;
  sessionLabel: string;
  estimatedDurationMinutes: number;
  exercises: ProgramWorkoutExerciseView[];
}

export interface ProgramView {
  programId: string;
  splitType: string;
  sessionsPerWeek: number;
  createdAt: Date;
  workouts: ProgramWorkoutView[];
}

/** Read-only — never regenerates (docs/PRODUCT.md: "The dashboard must not
 * invoke [generation] simply because it was opened"). */
export async function getCurrentProgram(db: Database, userId: string): Promise<ProgramView | null> {
  const [program] = await db.select().from(schema.programs).where(eq(schema.programs.userId, userId));
  if (!program) return null;

  const workoutRows = await db
    .select()
    .from(schema.workouts)
    .where(eq(schema.workouts.programId, program.id))
    .orderBy(asc(schema.workouts.dayIndex));

  const workouts: ProgramWorkoutView[] = [];
  for (const workout of workoutRows) {
    const exerciseRows = await db
      .select({
        workoutExerciseId: schema.workoutExercises.id,
        exerciseId: schema.workoutExercises.exerciseId,
        orderIndex: schema.workoutExercises.orderIndex,
        sets: schema.workoutExercises.sets,
        repMin: schema.workoutExercises.repMin,
        repMax: schema.workoutExercises.repMax,
        rir: schema.workoutExercises.rir,
        restSeconds: schema.workoutExercises.restSeconds,
        canonicalId: schema.exercises.canonicalId,
        name: schema.exercises.name,
        instructions: schema.exercises.instructions,
        primaryMuscles: schema.exercises.primaryMuscles,
        secondaryMuscles: schema.exercises.secondaryMuscles,
      })
      .from(schema.workoutExercises)
      .innerJoin(schema.exercises, eq(schema.workoutExercises.exerciseId, schema.exercises.id))
      .where(eq(schema.workoutExercises.workoutId, workout.id))
      .orderBy(asc(schema.workoutExercises.orderIndex));

    const exercises: ProgramWorkoutExerciseView[] = [];
    for (const { primaryMuscles, secondaryMuscles, ...row } of exerciseRows) {
      const video = await getPublishedAsset(db, row.exerciseId, "video");
      exercises.push({
        ...row,
        videoObjectKey: video?.objectKey ?? null,
        selectionReason: explainExerciseSelection(
          workout.sessionLabel as SessionLabel,
          primaryMuscles,
          secondaryMuscles,
        ),
      });
    }

    workouts.push({
      workoutId: workout.id,
      dayIndex: workout.dayIndex,
      sessionLabel: workout.sessionLabel,
      estimatedDurationMinutes: workout.estimatedDurationMinutes,
      exercises,
    });
  }

  return {
    programId: program.id,
    splitType: program.splitType,
    sessionsPerWeek: program.sessionsPerWeek,
    createdAt: program.createdAt,
    workouts,
  };
}

/** For server-side authorization: a workout belongs to exactly one user
 * via its program. Callers must check this before showing or logging
 * against a workoutId that came from client input. */
export async function getWorkoutOwnerId(db: Database, workoutId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: schema.programs.userId })
    .from(schema.workouts)
    .innerJoin(schema.programs, eq(schema.workouts.programId, schema.programs.id))
    .where(eq(schema.workouts.id, workoutId));
  return row?.userId ?? null;
}

export async function getWorkout(db: Database, workoutId: string): Promise<ProgramWorkoutView | null> {
  const [workout] = await db.select().from(schema.workouts).where(eq(schema.workouts.id, workoutId));
  if (!workout) return null;

  const exerciseRows = await db
    .select({
      workoutExerciseId: schema.workoutExercises.id,
      exerciseId: schema.workoutExercises.exerciseId,
      orderIndex: schema.workoutExercises.orderIndex,
      sets: schema.workoutExercises.sets,
      repMin: schema.workoutExercises.repMin,
      repMax: schema.workoutExercises.repMax,
      rir: schema.workoutExercises.rir,
      restSeconds: schema.workoutExercises.restSeconds,
      canonicalId: schema.exercises.canonicalId,
      name: schema.exercises.name,
      instructions: schema.exercises.instructions,
      primaryMuscles: schema.exercises.primaryMuscles,
      secondaryMuscles: schema.exercises.secondaryMuscles,
    })
    .from(schema.workoutExercises)
    .innerJoin(schema.exercises, eq(schema.workoutExercises.exerciseId, schema.exercises.id))
    .where(eq(schema.workoutExercises.workoutId, workout.id))
    .orderBy(asc(schema.workoutExercises.orderIndex));

  const exercises: ProgramWorkoutExerciseView[] = [];
  for (const { primaryMuscles, secondaryMuscles, ...row } of exerciseRows) {
    const video = await getPublishedAsset(db, row.exerciseId, "video");
    exercises.push({
      ...row,
      videoObjectKey: video?.objectKey ?? null,
      selectionReason: explainExerciseSelection(
        workout.sessionLabel as SessionLabel,
        primaryMuscles,
        secondaryMuscles,
      ),
    });
  }

  return {
    workoutId: workout.id,
    dayIndex: workout.dayIndex,
    sessionLabel: workout.sessionLabel,
    estimatedDurationMinutes: workout.estimatedDurationMinutes,
    exercises,
  };
}
