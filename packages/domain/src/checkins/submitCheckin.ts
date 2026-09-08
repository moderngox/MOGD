import { eq, desc } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { checkinSubmissionSchema, type CheckinSubmission } from "./schemas";
import { computeTrainingAdherence } from "./trainingAdherence";
import { runAdaptation, type RunAdaptationResult } from "../adaptation/runAdaptation";
import { assertOwnsPrivatePhotoKey } from "../users/photoOwnership";

export interface SubmitCheckinResult {
  checkinId: string;
  trainingAdherencePercent: number;
  adaptation: RunAdaptationResult;
}

/**
 * The check-in application service: persists the check-in (and any
 * progress photos), computes real training adherence, then hands off to
 * the adaptation service (docs/ARCHITECTURE.md §18). One check-in always
 * produces exactly one plan_adjustment row via runAdaptation, whatever the
 * decision.
 */
export async function submitCheckin(
  db: Database,
  userId: string,
  rawInput: CheckinSubmission,
): Promise<SubmitCheckinResult> {
  const input = checkinSubmissionSchema.parse(rawInput);

  for (const photo of input.photos) {
    assertOwnsPrivatePhotoKey(userId, photo.objectKey);
  }

  const [previous] = await db
    .select({ completedAt: schema.checkins.completedAt })
    .from(schema.checkins)
    .where(eq(schema.checkins.userId, userId))
    .orderBy(desc(schema.checkins.completedAt))
    .limit(1);

  const [program] = await db
    .select({ createdAt: schema.programs.createdAt })
    .from(schema.programs)
    .where(eq(schema.programs.userId, userId));

  const adherenceSince = previous?.completedAt ?? program?.createdAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const trainingAdherencePercent = await computeTrainingAdherence(db, userId, adherenceSince);

  const now = new Date();

  const [checkin] = await db
    .insert(schema.checkins)
    .values({
      userId,
      averageWeightKg: input.averageWeightKg,
      waistCm: input.waistCm,
      trainingAdherencePercent,
      nutritionAdherencePercent: input.nutritionAdherencePercent,
      hunger: input.hunger,
      energy: input.energy,
      recovery: input.recovery,
      performanceNote: input.performanceNote,
      note: input.note,
      completedAt: now,
    })
    .returning();

  for (const photo of input.photos) {
    await db
      .insert(schema.progressPhotos)
      .values({
        userId,
        checkinId: checkin!.id,
        angle: photo.angle,
        objectKey: photo.objectKey,
        consentGrantedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.progressPhotos.checkinId, schema.progressPhotos.angle],
        set: { objectKey: photo.objectKey, consentGrantedAt: now },
      });
  }

  const adaptation = await runAdaptation(db, userId, checkin!.id);

  return { checkinId: checkin!.id, trainingAdherencePercent, adaptation };
}
