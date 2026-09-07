/**
 * Trend calculations (docs/ARCHITECTURE.md §18). Both functions are pure
 * and deterministic — no I/O, so they're trivially unit-testable and
 * reusable outside a DB context.
 */

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Below this window, dividing by elapsed time blows a small measurement
 * gap up into an extreme, meaningless weekly rate (e.g. two check-ins a
 * few minutes apart implying hundreds of kg/week) — found live when a
 * resubmitted check-in landed seconds after the first. Two days is short
 * of a real weekly cadence but long enough that ordinary reading noise
 * can't dominate the extrapolation. */
const MIN_MEANINGFUL_WINDOW_WEEKS = 2 / 7;

export interface WeightReading {
  averageWeightKg: number;
  completedAt: Date;
}

/**
 * Simple first-to-last linear rate over the most recent readings — not a
 * regression fit. Deliberately restrained (CLAUDE.md: "avoid advanced
 * periodization complexity until justified") rather than smoothing/
 * outlier-rejecting, which would need real tuning to get right. Returns
 * null when there's fewer than 2 readings (no trend to compute) or the
 * readings don't span a meaningful window.
 */
export function computeActualWeeklyRateKg(readings: WeightReading[]): number | null {
  if (readings.length < 2) return null;

  const sorted = [...readings].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  const weeksElapsed = (last.completedAt.getTime() - first.completedAt.getTime()) / MS_PER_WEEK;
  if (weeksElapsed < MIN_MEANINGFUL_WINDOW_WEEKS) return null;

  return (last.averageWeightKg - first.averageWeightKg) / weeksElapsed;
}

/**
 * ~7700 kcal per kg of body mass changed — a widely used approximation
 * (commonly cited as ~3500 kcal/lb), not an exact figure: real metabolic
 * adaptation means the true rate drifts over time. Treat this as the same
 * kind of provisional, documented constant as packages/domain/nutrition's
 * formulas, not a precise clinical prediction.
 */
const KCAL_PER_KG_BODY_MASS = 7700;

export function computeExpectedWeeklyRateKg(input: { tdee: number; energyKcal: number }): number {
  const dailyDelta = input.energyKcal - input.tdee; // negative = deficit, positive = surplus
  return (dailyDelta * 7) / KCAL_PER_KG_BODY_MASS;
}
