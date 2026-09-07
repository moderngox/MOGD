import { eq, desc } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { interpretCheckin, type CheckInInterpretation } from "@mogd/ai";
import { computeActualWeeklyRateKg, computeExpectedWeeklyRateKg } from "./trends";
import { decideAdaptation, type AdaptationDecision } from "./rules";
import { deriveFatMinimum, deriveCarbohydrateTarget } from "../nutrition/formulas";
import { validateNutritionTarget } from "../nutrition/validate";

/** How many recent check-ins the trend line is computed over — recent
 * enough to reflect current behavior, not so few that one noisy reading
 * dominates. */
const TREND_WINDOW_SIZE = 4;

export interface RunAdaptationResult {
  decision: AdaptationDecision;
  outcome: "not_attempted" | "applied" | "rejected";
  /** Display-only enrichment (docs/ARCHITECTURE.md §18's "Optional AI
   * Interpretation" step). Never persisted, never consulted by any
   * decision above — null whenever AI is unconfigured, unavailable, or
   * returns something that fails validation (CLAUDE.md rule 4). */
  aiInterpretation: CheckInInterpretation | null;
}

/**
 * The M5 application service (docs/ARCHITECTURE.md §18's pipeline: Progress
 * History + Current Check-In + Goal Strategy + Current Plan → Trend
 * Calculations → Deterministic Adaptation Rules → Safety Validation → Plan
 * Adjustment). Called once per check-in submission — never on a dashboard
 * load (CLAUDE.md rule 11). Always persists a plan_adjustment row,
 * including "no change" decisions, so history and reasons are never lost.
 */
export async function runAdaptation(
  db: Database,
  userId: string,
  checkinId: string,
): Promise<RunAdaptationResult> {
  const recentCheckins = await db
    .select({
      averageWeightKg: schema.checkins.averageWeightKg,
      completedAt: schema.checkins.completedAt,
      nutritionAdherencePercent: schema.checkins.nutritionAdherencePercent,
    })
    .from(schema.checkins)
    .where(eq(schema.checkins.userId, userId))
    .orderBy(desc(schema.checkins.completedAt))
    .limit(TREND_WINDOW_SIZE);

  const [nutritionTarget] = await db
    .select()
    .from(schema.nutritionTargets)
    .where(eq(schema.nutritionTargets.userId, userId));

  const latestCheckin = recentCheckins[0];

  const actualWeeklyRateKg = computeActualWeeklyRateKg(recentCheckins);
  const expectedWeeklyRateKg = nutritionTarget ? computeExpectedWeeklyRateKg(nutritionTarget) : null;

  const decision = decideAdaptation({
    expectedWeeklyRateKg,
    actualWeeklyRateKg,
    nutritionAdherencePercent: latestCheckin?.nutritionAdherencePercent ?? 0,
  });

  const [subjective] = await db
    .select({
      hunger: schema.checkins.hunger,
      energy: schema.checkins.energy,
      recovery: schema.checkins.recovery,
      performanceNote: schema.checkins.performanceNote,
      note: schema.checkins.note,
      nutritionAdherencePercent: schema.checkins.nutritionAdherencePercent,
    })
    .from(schema.checkins)
    .where(eq(schema.checkins.id, checkinId));

  const aiInterpretation = subjective
    ? await interpretCheckin(db, userId, {
        decisionType: decision.type,
        deterministicReason: decision.reason,
        nutritionAdherencePercent: subjective.nutritionAdherencePercent,
        hunger: subjective.hunger,
        energy: subjective.energy,
        recovery: subjective.recovery,
        performanceNote: subjective.performanceNote ?? undefined,
        note: subjective.note ?? undefined,
      })
    : null;

  if (decision.type !== "adjust_calories" || !nutritionTarget) {
    await db.insert(schema.planAdjustments).values({
      userId,
      checkinId,
      decisionType: decision.type,
      outcome: "not_attempted",
      reason: decision.reason,
    });
    return { decision, outcome: "not_attempted", aiInterpretation };
  }

  const [body] = await db
    .select({ weightKg: schema.bodyMeasurements.weightKg })
    .from(schema.bodyMeasurements)
    .where(eq(schema.bodyMeasurements.userId, userId));

  const newEnergyKcal = nutritionTarget.energyKcal + decision.calorieAdjustmentKcal;
  const newFatG = deriveFatMinimum(body?.weightKg ?? 0, newEnergyKcal);
  const newCarbG = deriveCarbohydrateTarget(newEnergyKcal, nutritionTarget.proteinG, newFatG);

  const validation = validateNutritionTarget({
    bmr: nutritionTarget.bmr,
    tdee: nutritionTarget.tdee,
    energyDirection: nutritionTarget.energyDirection as never,
    energyKcal: newEnergyKcal,
    proteinG: nutritionTarget.proteinG,
    fatG: newFatG,
    carbG: newCarbG,
  });

  if (!validation.valid) {
    await db.insert(schema.planAdjustments).values({
      userId,
      checkinId,
      decisionType: decision.type,
      outcome: "rejected",
      previousEnergyKcal: nutritionTarget.energyKcal,
      newEnergyKcal,
      reason: `${decision.reason} Rejected: ${validation.reasons.join(" ")}`,
    });
    return { decision, outcome: "rejected", aiInterpretation };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.nutritionTargets)
      .set({ energyKcal: newEnergyKcal, fatG: newFatG, carbG: newCarbG, computedAt: new Date() })
      .where(eq(schema.nutritionTargets.userId, userId));

    await tx.insert(schema.planAdjustments).values({
      userId,
      checkinId,
      decisionType: decision.type,
      outcome: "applied",
      previousEnergyKcal: nutritionTarget.energyKcal,
      newEnergyKcal,
      reason: decision.reason,
    });
  });

  return { decision, outcome: "applied", aiInterpretation };
}
