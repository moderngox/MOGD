import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { compileGoalStrategy, type GoalStrategy } from "../physique/goalStrategy";
import type { PhysiquePriority } from "../physique/priorities";
import type { PrimaryGoal, ActivityLevel } from "../assessment/options";
import { computeNutritionTarget, type NutritionTarget } from "./computeNutritionTarget";
import { validateNutritionTarget } from "./validate";

export class AssessmentIncompleteError extends Error {
  constructor(userId: string) {
    super(`User ${userId} has no completed assessment to generate a strategy from`);
    this.name = "AssessmentIncompleteError";
  }
}

export interface GenerateStrategyResult {
  success: boolean;
  reasons: string[];
  strategy?: GoalStrategy;
  nutrition?: NutritionTarget;
}

/**
 * The M3 application service (docs/ARCHITECTURE.md §4): reads the
 * persisted M1 assessment, compiles a goal strategy, computes and
 * validates nutrition targets, and — only if valid — persists both.
 * Rejects before persisting, same discipline as submitAssessment(): an
 * invalid computation never overwrites a previously valid target
 * (docs/ARCHITECTURE.md §21, "A failed generation must not replace a
 * valid current plan").
 */
export async function generateStrategyAndNutrition(
  db: Database,
  userId: string,
): Promise<GenerateStrategyResult> {
  const [goals] = await db
    .select()
    .from(schema.physiqueGoals)
    .where(eq(schema.physiqueGoals.userId, userId));
  const [body] = await db
    .select()
    .from(schema.bodyMeasurements)
    .where(eq(schema.bodyMeasurements.userId, userId));
  const [training] = await db
    .select()
    .from(schema.trainingProfiles)
    .where(eq(schema.trainingProfiles.userId, userId));

  if (!goals || !body || !training) {
    throw new AssessmentIncompleteError(userId);
  }

  const strategy = compileGoalStrategy({
    primaryGoal: goals.primaryGoal as PrimaryGoal,
    physiquePriorities: goals.physiquePriorities as PhysiquePriority[],
  });

  const nutrition = computeNutritionTarget({
    sex: body.sex,
    weightKg: body.weightKg,
    heightCm: body.heightCm,
    age: body.age,
    activityLevel: training.currentActivityLevel as ActivityLevel,
    primaryGoal: strategy.primaryGoal,
    energyDirection: strategy.energyDirection,
  });

  const validation = validateNutritionTarget(nutrition);
  if (!validation.valid) {
    return { success: false, reasons: validation.reasons };
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.goalStrategies)
      .values({
        userId,
        primaryGoal: strategy.primaryGoal,
        priorityMuscles: strategy.priorityMuscles,
        energyDirection: strategy.energyDirection,
        trainingBias: strategy.trainingBias,
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.goalStrategies.userId,
        set: {
          primaryGoal: strategy.primaryGoal,
          priorityMuscles: strategy.priorityMuscles,
          energyDirection: strategy.energyDirection,
          trainingBias: strategy.trainingBias,
          computedAt: now,
        },
      });

    await tx
      .insert(schema.nutritionTargets)
      .values({
        userId,
        bmr: nutrition.bmr,
        tdee: nutrition.tdee,
        energyDirection: nutrition.energyDirection,
        energyKcal: nutrition.energyKcal,
        proteinG: nutrition.proteinG,
        fatG: nutrition.fatG,
        carbG: nutrition.carbG,
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.nutritionTargets.userId,
        set: {
          bmr: nutrition.bmr,
          tdee: nutrition.tdee,
          energyDirection: nutrition.energyDirection,
          energyKcal: nutrition.energyKcal,
          proteinG: nutrition.proteinG,
          fatG: nutrition.fatG,
          carbG: nutrition.carbG,
          computedAt: now,
        },
      });
  });

  return { success: true, reasons: [], strategy, nutrition };
}
