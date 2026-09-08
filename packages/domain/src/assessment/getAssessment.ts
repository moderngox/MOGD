import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import type { AssessmentDraftFormState } from "./schemas";

export interface UserAssessmentSummary {
  completedAt: Date;
  optionalNote: string | null;
  primaryGoal: string;
  physiquePriorities: string[];
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  waistCm: number;
  targetWeightKg: number | null;
  experienceLevel: string;
  sessionsPerWeek: number;
  sessionDurationMinutes: number;
  trainingContext: string[];
  dietaryPreference: string;
  mealsPerDay: number;
}

/**
 * Reads the current user's assessment for display (e.g. the dashboard).
 * Returns null if they haven't completed one yet — callers decide what to
 * do with that (docs/PRODUCT.md: dashboard must not regenerate anything, it
 * only reads persisted state).
 */
export async function getUserAssessment(
  db: Database,
  userId: string,
): Promise<UserAssessmentSummary | null> {
  const [assessment] = await db
    .select()
    .from(schema.assessments)
    .where(eq(schema.assessments.userId, userId));

  if (!assessment) return null;

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
  const [nutrition] = await db
    .select()
    .from(schema.nutritionProfiles)
    .where(eq(schema.nutritionProfiles.userId, userId));

  if (!goals || !body || !training || !nutrition) {
    // submitAssessment writes all five rows in one transaction, so this
    // means the data is corrupt/partial, not merely "not submitted yet".
    throw new Error(`Assessment for user ${userId} is missing related profile rows`);
  }

  return {
    completedAt: assessment.completedAt,
    optionalNote: assessment.optionalNote,
    primaryGoal: goals.primaryGoal,
    physiquePriorities: goals.physiquePriorities,
    sex: body.sex,
    age: body.age,
    heightCm: body.heightCm,
    weightKg: body.weightKg,
    waistCm: body.waistCm,
    targetWeightKg: body.targetWeightKg,
    experienceLevel: training.experienceLevel,
    sessionsPerWeek: training.sessionsPerWeek,
    sessionDurationMinutes: training.sessionDurationMinutes,
    trainingContext: training.trainingContext,
    dietaryPreference: nutrition.dietaryPreference,
    mealsPerDay: nutrition.mealsPerDay,
  };
}

/**
 * Reads the current user's completed assessment shaped as wizard form
 * state, so the "Edit assessment" flow (apps/web's assessment page with
 * ?edit=1) can re-open AssessmentWizard pre-filled with every answer —
 * not just the subset getUserAssessment returns for read-only display.
 * Returns null if there's nothing to edit yet.
 */
export async function getAssessmentFormState(
  db: Database,
  userId: string,
): Promise<AssessmentDraftFormState | null> {
  const [assessment] = await db
    .select()
    .from(schema.assessments)
    .where(eq(schema.assessments.userId, userId));

  if (!assessment) return null;

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
  const [nutrition] = await db
    .select()
    .from(schema.nutritionProfiles)
    .where(eq(schema.nutritionProfiles.userId, userId));

  if (!goals || !body || !training || !nutrition) {
    // Same invariant as getUserAssessment: submitAssessment writes all five
    // rows in one transaction, so a partial read means corrupt data.
    throw new Error(`Assessment for user ${userId} is missing related profile rows`);
  }

  return {
    primaryGoal: goals.primaryGoal as AssessmentDraftFormState["primaryGoal"],
    physiquePriorities: goals.physiquePriorities as AssessmentDraftFormState["physiquePriorities"],
    sex: body.sex,
    age: body.age,
    heightCm: body.heightCm,
    weightKg: body.weightKg,
    waistCm: body.waistCm,
    targetWeightKg: body.targetWeightKg ?? undefined,
    experienceLevel: training.experienceLevel as AssessmentDraftFormState["experienceLevel"],
    trainingConsistency: training.trainingConsistency as AssessmentDraftFormState["trainingConsistency"],
    currentActivityLevel: training.currentActivityLevel as AssessmentDraftFormState["currentActivityLevel"],
    trainingHistoryNotes: training.trainingHistoryNotes ?? undefined,
    limitations: training.limitations ?? undefined,
    injuryRestrictions: training.injuryRestrictions ?? undefined,
    sessionsPerWeek: training.sessionsPerWeek,
    sessionDurationMinutes: training.sessionDurationMinutes,
    trainingContext: training.trainingContext as AssessmentDraftFormState["trainingContext"],
    equipment: training.equipment as AssessmentDraftFormState["equipment"],
    dietaryPreference: nutrition.dietaryPreference as AssessmentDraftFormState["dietaryPreference"],
    allergies: nutrition.allergies ?? undefined,
    mealsPerDay: nutrition.mealsPerDay,
    cookingPreference: nutrition.cookingPreference as AssessmentDraftFormState["cookingPreference"],
    dislikedFoods: nutrition.dislikedFoods ?? undefined,
    willingToTrackCalories: nutrition.willingToTrackCalories,
    optionalNote: assessment.optionalNote ?? undefined,
  };
}
