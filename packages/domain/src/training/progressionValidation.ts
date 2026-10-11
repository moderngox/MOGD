import { PROGRESSION_REASON_OPTIONS, type ProgressionPrescription, type ProgressionTarget } from "./progression";

/**
 * Independent check of a load recommendation before it is persisted or shown
 * (CLAUDE.md rules 4 and 8: deterministic validation, explicit rejection).
 * Deliberately written from the spec's rules — never by calling the engine —
 * so it is a second opinion on computeProgressionTarget, not a restatement of it.
 */

export class InvalidRecommendationError extends Error {
  constructor(public readonly failures: string[]) {
    super(`Invalid progression recommendation: ${failures.join("; ")}`);
    this.name = "InvalidRecommendationError";
  }
}

export interface RecommendationContext {
  currentPrescription: ProgressionPrescription;
  /** Every load logged for this exercise in this equipment context — the only evidence a load may come from. */
  observedLoadsKg: number[];
}

const MAX_LOAD_KG = 500; // the logging bound
const EPSILON = 0.005;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Loads the engine is allowed to name: ones the athlete has used, or one smallest-observed-step away. */
function derivableLoads(observed: number[]): number[] {
  const distinct = [...new Set(observed.map(round2))].sort((a, b) => a - b);
  let smallestGap: number | null = null;
  for (let i = 1; i < distinct.length; i++) {
    const gap = round2(distinct[i]! - distinct[i - 1]!);
    if (gap > 0 && (smallestGap === null || gap < smallestGap)) smallestGap = gap;
  }
  if (smallestGap === null) return distinct;
  return [...distinct, ...distinct.flatMap((l) => [round2(l + smallestGap!), round2(l - smallestGap!)])];
}

/** Empty array = valid. */
export function validateProgressionTarget(target: ProgressionTarget, context: RecommendationContext): string[] {
  const failures: string[] = [];
  const { currentPrescription: cur } = context;

  if (!(PROGRESSION_REASON_OPTIONS as readonly string[]).includes(target.reason)) {
    failures.push(`unknown reason "${target.reason}"`);
  }

  // No evidence -> no personalized kg and no load instruction.
  if (target.reason === "NO_LOAD_HISTORY" || target.reason === "CONTEXT_CHANGED") {
    if (target.targetLoadKg !== null) failures.push(`${target.reason} must not carry a load`);
    if (target.loadInstruction !== null) failures.push(`${target.reason} must not carry a load instruction`);
  }

  // A load change with no number must say what to do; a number needs no instruction.
  if (target.reason === "INCREASE_LOAD" || target.reason === "REDUCE_LOAD") {
    if (target.targetLoadKg === null && !target.loadInstruction) {
      failures.push(`${target.reason} without a load must carry an instruction`);
    }
    if (target.targetLoadKg !== null && target.loadInstruction !== null) {
      failures.push(`${target.reason} with a load must not also carry an instruction`);
    }
  } else if (target.loadInstruction !== null && target.reason !== "NO_LOAD_HISTORY" && target.reason !== "CONTEXT_CHANGED") {
    failures.push(`${target.reason} must not carry a load instruction`);
  }

  if (target.targetLoadKg !== null) {
    const load = target.targetLoadKg;
    if (!Number.isFinite(load) || load <= 0 || load > MAX_LOAD_KG) {
      failures.push(`load ${load} kg is outside 0-${MAX_LOAD_KG} kg`);
    } else if (!derivableLoads(context.observedLoadsKg).some((l) => Math.abs(l - load) < EPSILON)) {
      failures.push(`load ${load} kg is not backed by logged history (invented)`);
    }
  }

  if (target.targetRepMin > target.targetRepMax) {
    failures.push(`target reps ${target.targetRepMin}-${target.targetRepMax} are inverted`);
  }
  if (target.targetRepMin < cur.repMin || target.targetRepMax > cur.repMax) {
    failures.push(
      `target reps ${target.targetRepMin}-${target.targetRepMax} fall outside the prescribed ${cur.repMin}-${cur.repMax}`,
    );
  }

  if (target.message.trim() === "") failures.push("missing explanation");

  return failures;
}
