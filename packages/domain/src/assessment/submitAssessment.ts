import { schema, type Database } from "@mogd/db";
import { checkEligibility } from "../safety/eligibility";
import { assertOwnsPrivatePhotoKey } from "../users/photoOwnership";
import { assessmentSubmissionSchema, type AssessmentSubmission } from "./schemas";

export interface SubmitAssessmentResult {
  eligible: boolean;
  reasons: string[];
}

/**
 * Application service (docs/ARCHITECTURE.md §4): validates, gates on
 * eligibility, then persists. An ineligible submission is rejected before
 * anything is written — no profile data is retained for a user MOGᴰ cannot
 * serve (see safety/eligibility.ts for what this does and does not check).
 *
 * Upserts rather than inserts: M1 treats assessment as a single current
 * profile per user, not a history of submissions.
 */
export async function submitAssessment(
  db: Database,
  userId: string,
  rawInput: AssessmentSubmission,
): Promise<SubmitAssessmentResult> {
  const input = assessmentSubmissionSchema.parse(rawInput);

  for (const photo of input.photos) {
    assertOwnsPrivatePhotoKey(userId, photo.objectKey);
  }

  const eligibility = checkEligibility({ sex: input.sex, age: input.age });
  if (!eligibility.eligible) {
    return eligibility;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.physiqueGoals)
      .values({
        userId,
        primaryGoal: input.primaryGoal,
        physiquePriorities: input.physiquePriorities,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.physiqueGoals.userId,
        set: {
          primaryGoal: input.primaryGoal,
          physiquePriorities: input.physiquePriorities,
          updatedAt: now,
        },
      });

    await tx
      .insert(schema.bodyMeasurements)
      .values({
        userId,
        sex: input.sex,
        age: input.age,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        waistCm: input.waistCm,
        targetWeightKg: input.targetWeightKg,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.bodyMeasurements.userId,
        set: {
          sex: input.sex,
          age: input.age,
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          waistCm: input.waistCm,
          targetWeightKg: input.targetWeightKg,
          updatedAt: now,
        },
      });

    await tx
      .insert(schema.trainingProfiles)
      .values({
        userId,
        experienceLevel: input.experienceLevel,
        trainingConsistency: input.trainingConsistency,
        currentActivityLevel: input.currentActivityLevel,
        trainingHistoryNotes: input.trainingHistoryNotes,
        limitations: input.limitations,
        injuryRestrictions: input.injuryRestrictions,
        sessionsPerWeek: input.sessionsPerWeek,
        sessionDurationMinutes: input.sessionDurationMinutes,
        trainingContext: input.trainingContext,
        equipment: input.equipment,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.trainingProfiles.userId,
        set: {
          experienceLevel: input.experienceLevel,
          trainingConsistency: input.trainingConsistency,
          currentActivityLevel: input.currentActivityLevel,
          trainingHistoryNotes: input.trainingHistoryNotes,
          limitations: input.limitations,
          injuryRestrictions: input.injuryRestrictions,
          sessionsPerWeek: input.sessionsPerWeek,
          sessionDurationMinutes: input.sessionDurationMinutes,
          trainingContext: input.trainingContext,
          equipment: input.equipment,
          updatedAt: now,
        },
      });

    await tx
      .insert(schema.nutritionProfiles)
      .values({
        userId,
        dietaryPreference: input.dietaryPreference,
        allergies: input.allergies,
        mealsPerDay: input.mealsPerDay,
        cookingPreference: input.cookingPreference,
        dislikedFoods: input.dislikedFoods,
        willingToTrackCalories: input.willingToTrackCalories,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.nutritionProfiles.userId,
        set: {
          dietaryPreference: input.dietaryPreference,
          allergies: input.allergies,
          mealsPerDay: input.mealsPerDay,
          cookingPreference: input.cookingPreference,
          dislikedFoods: input.dislikedFoods,
          willingToTrackCalories: input.willingToTrackCalories,
          updatedAt: now,
        },
      });

    await tx
      .insert(schema.assessments)
      .values({
        userId,
        status: "completed",
        optionalNote: input.optionalNote,
        completedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.assessments.userId,
        set: {
          status: "completed",
          optionalNote: input.optionalNote,
          completedAt: now,
          updatedAt: now,
        },
      });

    for (const photo of input.photos) {
      await tx
        .insert(schema.assessmentPhotos)
        .values({
          userId,
          angle: photo.angle,
          objectKey: photo.objectKey,
          consentGrantedAt: now,
        })
        .onConflictDoUpdate({
          target: [schema.assessmentPhotos.userId, schema.assessmentPhotos.angle],
          set: {
            objectKey: photo.objectKey,
            consentGrantedAt: now,
          },
        });
    }
  });

  return eligibility;
}
