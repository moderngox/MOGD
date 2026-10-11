/**
 * Deterministic double-progression driven by actually logged performance
 * (mogd_programming_engine_specs 04-progression-engine.md), not just the
 * single most recently logged set: it evaluates every set from the most
 * recent *session* (see progress/previousPerformance.ts's
 * getRecentSessionPerformance for how "session" is grouped) against the
 * prescribed rep range AND the prescribed RIR range, and against
 * pain/technique flags, before ever recommending a load increase — CLAUDE.md
 * rule 4: AI may explain this, never override it.
 */

const LOAD_EPSILON = 0.001;

/**
 * Next load in `direction` that is *known* from the athlete's own logged
 * history (mogd_programming_engine_specs 03/04: "observed user history" is a
 * valid source of increment knowledge; never invent a number otherwise).
 * 1. A load already used in that direction is known to exist - take the nearest.
 * 2. Otherwise step by the smallest gap ever observed between two distinct
 *    logged loads (an upper bound on the true smallest increment, but real data).
 * 3. With fewer than two distinct loads the increment is unknown -> null.
 */
export function resolveKnownNextLoad(
  observedLoadsKg: number[],
  currentLoadKg: number,
  direction: "up" | "down",
): number | null {
  const distinct = [...new Set(observedLoadsKg.map((l) => Math.round(l * 100) / 100))].sort((a, b) => a - b);

  const candidates =
    direction === "up"
      ? distinct.filter((l) => l > currentLoadKg + LOAD_EPSILON)
      : distinct.filter((l) => l < currentLoadKg - LOAD_EPSILON && l > 0);
  if (candidates.length > 0) return direction === "up" ? candidates[0]! : candidates[candidates.length - 1]!;

  let smallestGap: number | null = null;
  for (let i = 1; i < distinct.length; i++) {
    const gap = Math.round((distinct[i]! - distinct[i - 1]!) * 100) / 100;
    if (gap > LOAD_EPSILON && (smallestGap === null || gap < smallestGap)) smallestGap = gap;
  }
  if (smallestGap === null) return null;

  const next = Math.round((direction === "up" ? currentLoadKg + smallestGap : currentLoadKg - smallestGap) * 100) / 100;
  return next > 0 ? next : null;
}

export const PROGRESSION_REASON_OPTIONS = [
  "NO_LOAD_HISTORY",
  "REASSESS_DUE_TO_PAIN",
  "HOLD_FOR_TECHNIQUE",
  "CONTINUE_CURRENT_LOAD",
  "INCREASE_LOAD",
  "REDUCE_LOAD",
  "CONTINUE_REP_PROGRESSION",
] as const;
export type ProgressionReason = (typeof PROGRESSION_REASON_OPTIONS)[number];

export interface LoggedSetForProgression {
  reps: number;
  loadKg: number | null;
  /** Optional to log, but a missing RIR blocks a load increase (never assumed to satisfy the target). */
  rir: number | null;
  painFlag: boolean | null;
  techniqueValid: boolean | null;
}

export interface ProgressionInput {
  /** How many sets this exercise is currently prescribed — used to detect an incomplete session. */
  prescribedSets: number;
  /** Every set from the most recent session, empty when nothing has been logged yet. */
  recentSets: LoggedSetForProgression[];
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  /** Every load (kg) the athlete has ever logged for this exercise, across all sessions. */
  observedLoadsKg: number[];
}

export interface ProgressionTarget {
  targetLoadKg: number | null;
  targetRepMin: number;
  targetRepMax: number;
  reason: ProgressionReason;
  /** Set when the engine wants a load change it can't express as a known kg
   * (never an invented number) - e.g. "increase to the smallest available increment". */
  loadInstruction: string | null;
  /** Human-readable explanation for the UI — CLAUDE.md rule 8's "reject
   * invalid output explicitly" spirit applied to progression: never silent. */
  message: string;
}

/**
 * Decision order (first match wins) — see the approved implementation plan
 * for why REDUCE_LOAD/CONTINUE_CURRENT_LOAD's trigger conditions were a
 * judgment call the spec itself left open:
 *  1. no logged sets                                -> NO_LOAD_HISTORY
 *  2. any set flagged pain                           -> REASSESS_DUE_TO_PAIN
 *  3. any set flagged invalid technique               -> HOLD_FOR_TECHNIQUE
 *  4. fewer sets logged than prescribed               -> CONTINUE_CURRENT_LOAD
 *  5. every set hit repMax within the RIR target      -> INCREASE_LOAD
 *     (next load from observed history, else null + instruction - never invented)
 *  6. weakest set missed repMin at RIR <= 0           -> REDUCE_LOAD (same sourcing)
 *  7. otherwise                                       -> CONTINUE_REP_PROGRESSION
 */
export function computeProgressionTarget(input: ProgressionInput): ProgressionTarget {
  const { recentSets, repMin, repMax, rirMin, rirMax, observedLoadsKg, prescribedSets } = input;

  if (recentSets.length === 0) {
    return {
      targetLoadKg: null,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "NO_LOAD_HISTORY",
      loadInstruction: null,
      message:
        "No previous performance logged yet — choose a resistance that lets you complete the prescribed reps with the target RIR in reserve.",
    };
  }

  const lastLoad = recentSets.at(-1)!.loadKg ?? null;

  if (recentSets.some((s) => s.painFlag === true)) {
    return {
      targetLoadKg: lastLoad,
      targetRepMin: repMin,
      targetRepMax: repMin,
      reason: "REASSESS_DUE_TO_PAIN",
      loadInstruction: null,
      message:
        "Pain was reported last session — hold or reduce load and prioritize pain-free technique. Consult a qualified professional if pain persists.",
    };
  }

  if (recentSets.some((s) => s.techniqueValid === false)) {
    return {
      targetLoadKg: lastLoad,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "HOLD_FOR_TECHNIQUE",
      loadInstruction: null,
      message: "Technique was marked invalid last session — repeat the same target and prioritize form before progressing.",
    };
  }

  if (recentSets.length < prescribedSets) {
    return {
      targetLoadKg: lastLoad,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "CONTINUE_CURRENT_LOAD",
      loadInstruction: null,
      message: "Last session was incomplete — repeat the same target before progressing.",
    };
  }

  const worstReps = Math.min(...recentSets.map((s) => s.reps));
  const upperRepTargetAchieved = recentSets.every((s) => s.reps >= repMax);
  const rirMissing = recentSets.some((s) => s.rir === null);
  const rirTargetSatisfied = recentSets.every((s) => s.rir !== null && s.rir >= rirMin && s.rir <= rirMax);

  // A load increase needs evidence the rep ceiling was reached within the RIR
  // target; an unlogged RIR is no evidence, so repeat rather than guess.
  if (upperRepTargetAchieved && rirMissing) {
    return {
      targetLoadKg: lastLoad,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "CONTINUE_CURRENT_LOAD",
      loadInstruction: null,
      message: "You hit the top of the rep range but didn't log RIR — log reps in reserve for every set so load can progress.",
    };
  }

  if (upperRepTargetAchieved && rirTargetSatisfied) {
    const nextLoad = lastLoad !== null ? resolveKnownNextLoad(observedLoadsKg, lastLoad, "up") : null;
    return {
      targetLoadKg: nextLoad,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "INCREASE_LOAD",
      loadInstruction: nextLoad === null ? "Increase to the smallest available resistance increment." : null,
      message:
        nextLoad === null
          ? "Hit the top of the rep range within the target RIR — time to progress. Your next available increment isn't known yet, so move up by the smallest available step and restart the rep range."
          : "Hit the top of the rep range within the target RIR — increase to your next known load and restart the rep range.",
    };
  }

  const failedAtFloor =
    worstReps < repMin && recentSets.some((s) => s.reps === worstReps && s.rir !== null && s.rir <= 0);
  if (failedAtFloor) {
    const nextLoad = lastLoad !== null ? resolveKnownNextLoad(observedLoadsKg, lastLoad, "down") : null;
    return {
      targetLoadKg: nextLoad,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "REDUCE_LOAD",
      loadInstruction: nextLoad === null ? "Reduce to the next lighter available resistance." : null,
      message:
        nextLoad === null
          ? "Fell below the rep floor at RIR 0 — drop to the next lighter available resistance and rebuild."
          : "Fell below the rep floor at RIR 0 — reduce to your next known lighter load and rebuild.",
    };
  }

  const nextReps = Math.max(repMin, Math.min(worstReps + 1, repMax));
  return {
    targetLoadKg: lastLoad,
    targetRepMin: nextReps,
    targetRepMax: repMax,
    reason: "CONTINUE_REP_PROGRESSION",
    loadInstruction: null,
    message: "Same load, one more rep than your weakest set last time.",
  };
}
