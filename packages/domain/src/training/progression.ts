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

const LARGE_INCREMENT_PATTERNS = new Set(["squat", "hinge", "carry"]);
const LARGE_LOAD_INCREMENT_KG = 5;
const SMALL_LOAD_INCREMENT_KG = 2.5;

/** The smallest known increment for this movement pattern — spec 03/04's
 * "increase to the smallest available increment" when no real
 * equipment/machine profile exists to ask (deferred scope, see the
 * approved plan's deviation #3). */
function knownIncrement(movementPattern: string): number {
  return LARGE_INCREMENT_PATTERNS.has(movementPattern) ? LARGE_LOAD_INCREMENT_KG : SMALL_LOAD_INCREMENT_KG;
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
  /** Missing RIR is treated as "satisfies the target" (benefit of doubt) —
   * RIR logging is optional (mogd_programming_engine_specs 03). */
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
  movementPattern: string;
}

export interface ProgressionTarget {
  targetLoadKg: number | null;
  targetRepMin: number;
  targetRepMax: number;
  reason: ProgressionReason;
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
 *  6. weakest set missed repMin at RIR <= 0           -> REDUCE_LOAD
 *  7. otherwise                                       -> CONTINUE_REP_PROGRESSION
 */
export function computeProgressionTarget(input: ProgressionInput): ProgressionTarget {
  const { recentSets, repMin, repMax, rirMin, rirMax, movementPattern, prescribedSets } = input;

  if (recentSets.length === 0) {
    return {
      targetLoadKg: null,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "NO_LOAD_HISTORY",
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
      message: "Technique was marked invalid last session — repeat the same target and prioritize form before progressing.",
    };
  }

  if (recentSets.length < prescribedSets) {
    return {
      targetLoadKg: lastLoad,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "CONTINUE_CURRENT_LOAD",
      message: "Last session was incomplete — repeat the same target before progressing.",
    };
  }

  const worstReps = Math.min(...recentSets.map((s) => s.reps));
  const upperRepTargetAchieved = recentSets.every((s) => s.reps >= repMax);
  const rirTargetSatisfied = recentSets.every((s) => s.rir === null || (s.rir >= rirMin && s.rir <= rirMax));

  if (upperRepTargetAchieved && rirTargetSatisfied) {
    const increment = knownIncrement(movementPattern);
    return {
      targetLoadKg: lastLoad !== null ? lastLoad + increment : null,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "INCREASE_LOAD",
      message: "Hit the top of the rep range within the target RIR — increase load by the smallest known increment and restart the rep range.",
    };
  }

  const failedAtFloor =
    worstReps < repMin && recentSets.some((s) => s.reps === worstReps && s.rir !== null && s.rir <= 0);
  if (failedAtFloor) {
    const increment = knownIncrement(movementPattern);
    return {
      targetLoadKg: lastLoad !== null ? Math.max(0, lastLoad - increment) : null,
      targetRepMin: repMin,
      targetRepMax: repMax,
      reason: "REDUCE_LOAD",
      message: "Fell below the rep floor at RIR 0 — reduce load by the smallest known increment and rebuild.",
    };
  }

  const nextReps = Math.max(repMin, Math.min(worstReps + 1, repMax));
  return {
    targetLoadKg: lastLoad,
    targetRepMin: nextReps,
    targetRepMax: repMax,
    reason: "CONTINUE_REP_PROGRESSION",
    message: "Same load, one more rep than your weakest set last time.",
  };
}
