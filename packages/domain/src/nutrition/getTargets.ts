import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import type { NutritionTarget } from "./computeNutritionTarget";
import type { GoalStrategy, EnergyDirection } from "../physique/goalStrategy";
import type { PrimaryGoal } from "../assessment/options";
import type { CanonicalMuscleGroup } from "../physique/muscles";

export async function getGoalStrategy(db: Database, userId: string): Promise<GoalStrategy | null> {
  const [row] = await db
    .select()
    .from(schema.goalStrategies)
    .where(eq(schema.goalStrategies.userId, userId));
  if (!row) return null;

  return {
    primaryGoal: row.primaryGoal as PrimaryGoal,
    priorityMuscles: row.priorityMuscles as CanonicalMuscleGroup[],
    energyDirection: row.energyDirection as EnergyDirection,
    trainingBias: row.trainingBias,
  };
}

export async function getNutritionTarget(db: Database, userId: string): Promise<NutritionTarget | null> {
  const [row] = await db
    .select()
    .from(schema.nutritionTargets)
    .where(eq(schema.nutritionTargets.userId, userId));
  if (!row) return null;

  return {
    bmr: row.bmr,
    tdee: row.tdee,
    energyDirection: row.energyDirection as EnergyDirection,
    energyKcal: row.energyKcal,
    proteinG: row.proteinG,
    fatG: row.fatG,
    carbG: row.carbG,
  };
}
