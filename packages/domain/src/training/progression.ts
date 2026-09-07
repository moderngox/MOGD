/**
 * Deterministic progression (docs/ARCHITECTURE.md §15: "Do not ask the LLM
 * to rediscover progression rules during every workout"). Below the rep
 * ceiling, add a rep at the same load — matching that section's own
 * example (previous 30kg×10 in an 8-10 range → next target 30kg×11-12,
 * i.e. the top of a widened window). Once the ceiling is reached, increase
 * load and restart at the bottom of the configured rep range instead.
 *
 * Simplification: ARCHITECTURE.md says "once the ceiling is *consistently*
 * reached" — this checks only the single most recent logged set, not a
 * streak across sessions. Tracking a streak is a reasonable follow-up, not
 * something this milestone claims to already do.
 */
export interface ProgressionInput {
  previousLoadKg: number | null;
  previousReps: number | null;
  repMin: number;
  repMax: number;
  /** Used only to pick a load increment size on ceiling breakthrough. */
  movementPattern: string;
}

export interface ProgressionTarget {
  targetLoadKg: number | null;
  targetRepMin: number;
  targetRepMax: number;
  reason: string;
}

/**
 * Bigger compound lower-body/pulling patterns tolerate a larger jump than
 * smaller upper-body/isolation movements — a common practical convention,
 * not a precisely calibrated figure.
 */
const LARGE_INCREMENT_PATTERNS = new Set(["squat", "hinge", "carry"]);
const LARGE_LOAD_INCREMENT_KG = 5;
const SMALL_LOAD_INCREMENT_KG = 2.5;

export function computeProgressionTarget(input: ProgressionInput): ProgressionTarget {
  if (input.previousLoadKg === null || input.previousReps === null) {
    return {
      targetLoadKg: null,
      targetRepMin: input.repMin,
      targetRepMax: input.repMax,
      reason: "No previous performance logged yet — start conservatively within this rep range.",
    };
  }

  if (input.previousReps >= input.repMax) {
    const increment = LARGE_INCREMENT_PATTERNS.has(input.movementPattern)
      ? LARGE_LOAD_INCREMENT_KG
      : SMALL_LOAD_INCREMENT_KG;
    return {
      targetLoadKg: input.previousLoadKg + increment,
      targetRepMin: input.repMin,
      targetRepMax: input.repMax,
      reason: `Reached the ${input.repMax}-rep ceiling last time — increase load and restart the rep range.`,
    };
  }

  const nextReps = Math.min(input.previousReps + 1, input.repMax);
  return {
    targetLoadKg: input.previousLoadKg,
    targetRepMin: nextReps,
    targetRepMax: input.repMax,
    reason: "Same load, one more rep than last time.",
  };
}
