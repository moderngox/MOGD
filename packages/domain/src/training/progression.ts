/**
 * Deterministic double-progression driven by actually logged performance
 * (mogd_programming_engine_specs 04-progression-engine.md): it evaluates the
 * working sets of the most recent comparable workout occurrence against the
 * range the athlete was *actually prescribed then* (not today's), and refuses
 * to carry a load across an equipment or prescription change — CLAUDE.md
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
 * `observedLoadsKg` must already be scoped to one equipment context.
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
  "CONTEXT_CHANGED",
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

export interface ProgressionPrescription {
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
}

export interface ProgressionInput {
  /** Sets of the most recent other occurrence in THIS equipment context; empty when none. */
  recentSets: LoggedSetForProgression[];
  /** What that occurrence was prescribed; null = unknown (legacy history), treated as the current one. */
  previousPrescription: ProgressionPrescription | null;
  currentPrescription: ProgressionPrescription;
  /** Every load ever logged for this exercise in this equipment context. */
  observedLoadsKg: number[];
  /** Nothing in this context, but the athlete has done the exercise in another one. */
  hasHistoryInOtherContext: boolean;
}

export interface ProgressionTarget {
  targetLoadKg: number | null;
  targetRepMin: number;
  targetRepMax: number;
  reason: ProgressionReason;
  /** Set when the engine wants a load change it can't express as a known kg
   * (never an invented number) - e.g. "increase to the smallest available increment". */
  loadInstruction: string | null;
  /** Human-readable explanation for the UI. */
  message: string;
}

function samePrescription(a: ProgressionPrescription, b: ProgressionPrescription): boolean {
  return a.repMin === b.repMin && a.repMax === b.repMax && a.rirMin === b.rirMin && a.rirMax === b.rirMax;
}

/**
 * The load most of the sets were done at (ties -> heaviest); a null load among
 * loaded sets counts as 0. Sets at other loads are warm-up/drop sets and are
 * not judged. Returns null for bodyweight work (no working set has a load).
 */
function resolveWorkingSets(sets: LoggedSetForProgression[]): { working: LoggedSetForProgression[]; loadKg: number | null } {
  const anyLoaded = sets.some((s) => s.loadKg !== null);
  const loadOf = (s: LoggedSetForProgression) => (anyLoaded ? (s.loadKg ?? 0) : 0);

  const counts = new Map<number, number>();
  for (const s of sets) counts.set(loadOf(s), (counts.get(loadOf(s)) ?? 0) + 1);
  const workingLoad = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];

  return {
    working: sets.filter((s) => loadOf(s) === workingLoad),
    loadKg: workingLoad > 0 ? workingLoad : null,
  };
}

/**
 * Decision order (first match wins):
 *  1. no sets in this context                            -> CONTEXT_CHANGED (done elsewhere) / NO_LOAD_HISTORY
 *  2. any set flagged pain                               -> REASSESS_DUE_TO_PAIN (safety outranks everything below)
 *  3. last prescription differs from today's             -> CONTEXT_CHANGED (a different rep/RIR range implies a different load)
 *  4. any set flagged invalid technique                  -> HOLD_FOR_TECHNIQUE
 *  5. fewer working sets than were prescribed            -> CONTINUE_CURRENT_LOAD
 *  6. working sets hit repMax within RIR, RIR logged     -> INCREASE_LOAD (known load, else null + instruction; never invented)
 *  7. weakest working set missed repMin at RIR <= 0      -> REDUCE_LOAD (same sourcing)
 *  8. otherwise                                          -> CONTINUE_REP_PROGRESSION
 * Achievement is judged against the PREVIOUS prescription; targets are
 * expressed in the CURRENT one (identical once rule 3 passes).
 */
export function computeProgressionTarget(input: ProgressionInput): ProgressionTarget {
  const { recentSets, observedLoadsKg, currentPrescription: current } = input;
  const base = { targetRepMin: current.repMin, targetRepMax: current.repMax };

  if (recentSets.length === 0) {
    if (input.hasHistoryInOtherContext) {
      return {
        targetLoadKg: null,
        ...base,
        reason: "CONTEXT_CHANGED",
        loadInstruction: null,
        message:
          "You've done this exercise, but not in this training location — loads don't transfer between equipment. Choose a resistance that lets you complete the prescribed reps with the target RIR in reserve.",
      };
    }
    return {
      targetLoadKg: null,
      ...base,
      reason: "NO_LOAD_HISTORY",
      loadInstruction: null,
      message:
        "No previous performance logged yet — choose a resistance that lets you complete the prescribed reps with the target RIR in reserve.",
    };
  }

  const previous = input.previousPrescription ?? current;
  const { working, loadKg: workingLoad } = resolveWorkingSets(recentSets);

  if (recentSets.some((s) => s.painFlag === true)) {
    return {
      targetLoadKg: workingLoad,
      targetRepMin: current.repMin,
      targetRepMax: current.repMin,
      reason: "REASSESS_DUE_TO_PAIN",
      loadInstruction: null,
      message:
        "Pain was reported last session — hold or reduce load and prioritize pain-free technique. Consult a qualified professional if pain persists.",
    };
  }

  if (!samePrescription(previous, current)) {
    return {
      targetLoadKg: null,
      ...base,
      reason: "CONTEXT_CHANGED",
      loadInstruction: null,
      message:
        "Your rep or RIR target for this exercise changed since last time, so last session's load doesn't carry over — choose a resistance that fits the new target.",
    };
  }

  if (recentSets.some((s) => s.techniqueValid === false)) {
    return {
      targetLoadKg: workingLoad,
      ...base,
      reason: "HOLD_FOR_TECHNIQUE",
      loadInstruction: null,
      message: "Technique was marked invalid last session — repeat the same target and prioritize form before progressing.",
    };
  }

  if (working.length < previous.sets) {
    return {
      targetLoadKg: workingLoad,
      ...base,
      reason: "CONTINUE_CURRENT_LOAD",
      loadInstruction: null,
      message: "Last session was incomplete — repeat the same target before progressing.",
    };
  }

  const bodyweight = workingLoad === null;
  const worstReps = Math.min(...working.map((s) => s.reps));
  const upperRepTargetAchieved = working.every((s) => s.reps >= previous.repMax);
  const rirMissing = working.some((s) => s.rir === null);
  const rirTargetSatisfied = working.every((s) => s.rir !== null && s.rir >= previous.rirMin && s.rir <= previous.rirMax);

  // A load increase needs evidence the rep ceiling was reached within the RIR
  // target; an unlogged RIR is no evidence, so repeat rather than guess.
  if (upperRepTargetAchieved && rirMissing) {
    return {
      targetLoadKg: workingLoad,
      ...base,
      reason: "CONTINUE_CURRENT_LOAD",
      loadInstruction: null,
      message: "You hit the top of the rep range but didn't log RIR — log reps in reserve for every set so load can progress.",
    };
  }

  if (upperRepTargetAchieved && rirTargetSatisfied) {
    const nextLoad = bodyweight ? null : resolveKnownNextLoad(observedLoadsKg, workingLoad, "up");
    const instruction = bodyweight
      ? "Add external load or move to a harder variation."
      : nextLoad === null
        ? "Increase to the smallest available resistance increment."
        : null;
    return {
      targetLoadKg: nextLoad,
      ...base,
      reason: "INCREASE_LOAD",
      loadInstruction: instruction,
      message: bodyweight
        ? "Hit the top of the rep range within the target RIR — time to progress. There's no external load to raise, so add some or move to a harder variation, then restart the rep range."
        : nextLoad === null
          ? "Hit the top of the rep range within the target RIR — time to progress. Your next available increment isn't known yet, so move up by the smallest available step and restart the rep range."
          : "Hit the top of the rep range within the target RIR — increase to your next known load and restart the rep range.",
    };
  }

  const failedAtFloor =
    worstReps < previous.repMin && working.some((s) => s.reps === worstReps && s.rir !== null && s.rir <= 0);
  if (failedAtFloor) {
    const nextLoad = bodyweight ? null : resolveKnownNextLoad(observedLoadsKg, workingLoad, "down");
    const instruction = bodyweight
      ? "Use an easier variation or add assistance."
      : nextLoad === null
        ? "Reduce to the next lighter available resistance."
        : null;
    return {
      targetLoadKg: nextLoad,
      ...base,
      reason: "REDUCE_LOAD",
      loadInstruction: instruction,
      message: bodyweight
        ? "Fell below the rep floor at RIR 0 — drop to an easier variation and rebuild."
        : nextLoad === null
          ? "Fell below the rep floor at RIR 0 — drop to the next lighter available resistance and rebuild."
          : "Fell below the rep floor at RIR 0 — reduce to your next known lighter load and rebuild.",
    };
  }

  const nextReps = Math.max(current.repMin, Math.min(worstReps + 1, current.repMax));
  return {
    targetLoadKg: workingLoad,
    targetRepMin: nextReps,
    targetRepMax: current.repMax,
    reason: "CONTINUE_REP_PROGRESSION",
    loadInstruction: null,
    message: "Same load, one more rep than your weakest set last time.",
  };
}
