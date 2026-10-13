import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import type { ExperienceLevel, Equipment } from "../assessment/options";
import { getGoalStrategy } from "../nutrition/getTargets";
import { selectSplit } from "../training/splitTemplates";
import { deriveWeeklyVolumeTargets } from "../training/volumeTargets";
import { getExerciseCandidates } from "../training/candidatePool";
import { allocateSession, MINUTES_PER_SET } from "../training/sessionAllocation";
import { getCurrentRoleRules, RoleRulesInvalidError } from "../training/roleRulesStore";
import { validateProgram, type ProgramPlan, type ProgramWorkoutPlan } from "./validator";

export class StrategyIncompleteError extends Error {
  constructor(userId: string) {
    super(`User ${userId} has no goal strategy yet — run generateStrategyAndNutrition first`);
    this.name = "StrategyIncompleteError";
  }
}

export interface GenerateProgramResult {
  success: boolean;
  reasons: string[];
  plan?: ProgramPlan;
}

/**
 * The M4 application service: docs/ARCHITECTURE.md §10's full pipeline
 * (profile → strategy → weekly targets → split → candidates → session
 * allocation → validation → program), persisted only if validation
 * passes. Same reject-before-persist discipline as M1/M3: an invalid plan
 * never overwrites a previously valid program
 * (docs/ARCHITECTURE.md §21).
 */
export async function generateProgram(db: Database, userId: string): Promise<GenerateProgramResult> {
  const [training] = await db
    .select()
    .from(schema.trainingProfiles)
    .where(eq(schema.trainingProfiles.userId, userId));
  if (!training) {
    throw new StrategyIncompleteError(userId);
  }

  const strategy = await getGoalStrategy(db, userId);
  if (!strategy) {
    throw new StrategyIncompleteError(userId);
  }

  // Invalid persisted rules reject generation explicitly — never a silent fallback to defaults.
  let roleRules: Awaited<ReturnType<typeof getCurrentRoleRules>>;
  try {
    roleRules = await getCurrentRoleRules(db);
  } catch (error) {
    if (error instanceof RoleRulesInvalidError) return { success: false, reasons: [error.message] };
    throw error;
  }

  const experienceLevel = training.experienceLevel as ExperienceLevel;
  const equipment = training.equipment as Equipment[];
  const restrictionKeys = training.restrictionKeys;

  const { splitType, sessions } = selectSplit(training.sessionsPerWeek);
  const weeklyVolumeTargets = deriveWeeklyVolumeTargets(experienceLevel, strategy.priorityMuscles);

  const workouts: ProgramWorkoutPlan[] = [];
  for (let dayIndex = 0; dayIndex < sessions.length; dayIndex++) {
    const sessionLabel = sessions[dayIndex]!;
    const candidates = await getExerciseCandidates(db, {
      sessionLabel,
      experienceLevel,
      equipment,
      restrictionKeys,
    });
    const exercises = allocateSession({
      sessionLabel,
      candidates,
      weeklyVolumeTargets,
      trainingBias: strategy.trainingBias,
      sessionDurationMinutes: training.sessionDurationMinutes,
      roleRules: roleRules.rules,
    });
    workouts.push({ dayIndex, sessionLabel, exercises });
  }

  const plan: ProgramPlan = {
    sessionsPerWeek: training.sessionsPerWeek,
    sessionDurationMinutes: training.sessionDurationMinutes,
    equipment,
    experienceLevel,
    restrictionKeys,
    roleRulesRevisionId: roleRules.revisionId,
    workouts,
  };

  const validation = await validateProgram(db, plan);
  if (!validation.valid) {
    return { success: false, reasons: validation.reasons };
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schema.programs.id })
      .from(schema.programs)
      .where(eq(schema.programs.userId, userId));

    let programId: string;
    if (existing) {
      programId = existing.id;
      await tx
        .update(schema.programs)
        .set({
          splitType,
          sessionsPerWeek: training.sessionsPerWeek,
          roleRulesRevisionId: roleRules.revisionId,
          updatedAt: new Date(),
        })
        .where(eq(schema.programs.id, programId));
      // An open workout whose slot is about to disappear can't be resumed —
      // close it out as abandoned. Its performances and prescription
      // snapshots are kept (workout_session.workoutId is set null, never
      // cascade-deleted) — see packages/db/src/schema/workoutSessions.ts.
      await tx
        .update(schema.workoutSessions)
        .set({ status: "abandoned" })
        .where(and(eq(schema.workoutSessions.userId, userId), eq(schema.workoutSessions.status, "in_progress")));
      await tx.delete(schema.workouts).where(eq(schema.workouts.programId, programId));
    } else {
      const [created] = await tx
        .insert(schema.programs)
        .values({
          userId,
          splitType,
          sessionsPerWeek: training.sessionsPerWeek,
          roleRulesRevisionId: roleRules.revisionId,
        })
        .returning({ id: schema.programs.id });
      programId = created!.id;
    }

    for (const workout of plan.workouts) {
      const estimatedDurationMinutes = workout.exercises.reduce(
        (sum, e) => sum + e.sets * MINUTES_PER_SET,
        0,
      );
      const [createdWorkout] = await tx
        .insert(schema.workouts)
        .values({
          programId,
          dayIndex: workout.dayIndex,
          sessionLabel: workout.sessionLabel,
          estimatedDurationMinutes,
        })
        .returning({ id: schema.workouts.id });

      // One fresh id per superset pair, shared by its two members.
      const groupIds = new Map<number, string>();
      for (const exercise of workout.exercises) {
        if (exercise.supersetGroupIndex !== null && !groupIds.has(exercise.supersetGroupIndex)) {
          groupIds.set(exercise.supersetGroupIndex, crypto.randomUUID());
        }
      }

      for (const exercise of workout.exercises) {
        await tx.insert(schema.workoutExercises).values({
          workoutId: createdWorkout!.id,
          exerciseId: exercise.exerciseId,
          orderIndex: exercise.orderIndex,
          sets: exercise.sets,
          repMin: exercise.repMin,
          repMax: exercise.repMax,
          rirMin: exercise.rirMin,
          rirMax: exercise.rirMax,
          restSeconds: exercise.restSeconds,
          sessionRole: exercise.sessionRole,
          roleReason: exercise.roleReason,
          supersetGroupId:
            exercise.supersetGroupIndex === null ? null : groupIds.get(exercise.supersetGroupIndex)!,
        });
      }
    }
  });

  return { success: true, reasons: [], plan };
}
