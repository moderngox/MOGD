import type { CanonicalMuscleGroup } from "../physique/muscles";
import type { TrainingBias } from "../physique/goalStrategy";
import type { SessionRole } from "../exercises/options";
import type { SessionLabel } from "./splitTemplates";
import { SESSION_MUSCLE_MAP } from "./splitTemplates";
import type { CatalogExercise } from "./candidatePool";
import { assignSessionRoles, applyRoleModifier } from "./sessionRoleAssignment";
import type { RoleReason } from "./sessionRoleAssignment";

export interface AllocatedExercise {
  exerciseId: string;
  canonicalId: string;
  orderIndex: number;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number;
  restSeconds: number;
  /** Engine-assigned per docs/MOGD_06-session-role-architecture.md — never a
   * property of the canonical exercise (see exercises.allowedSessionRoles/
   * preferredSessionRole for what the exercise merely permits). */
  sessionRole: SessionRole;
  roleReason: RoleReason;
}

/**
 * How many distinct exercises a session gets, by duration — a lookup
 * table, not linear scaling. SPIDRA's compose-program.ts learned this the
 * hard way (its own comment: a prior linear formula produced 16 exercises
 * for a 90-minute session, which is wrong — real programming uses a small
 * number of exercises with more sets/rest per exercise, not more novelty).
 */
const EXERCISE_COUNT_TIERS: { maxMinutes: number; count: number }[] = [
  { maxMinutes: 30, count: 3 },
  { maxMinutes: 45, count: 4 },
  { maxMinutes: 60, count: 5 },
  { maxMinutes: 90, count: 6 },
  { maxMinutes: Infinity, count: 7 },
];

function exerciseCountForDuration(minutes: number): number {
  return EXERCISE_COUNT_TIERS.find((tier) => minutes <= tier.maxMinutes)!.count;
}

/** Average minutes per set including rest and transitions — a provisional
 * estimate (docs/AI_AND_SAFETY.md's illustrative-values caution applies to
 * this constant same as the nutrition ones), not a measured figure.
 * Exported so the program validator can independently re-derive the same
 * duration estimate rather than trusting whatever this module produced. */
export const MINUTES_PER_SET = 4;

export const MIN_SETS_PER_EXERCISE = 2;
export const MAX_SETS_PER_EXERCISE = 5;

const HYPERTROPHY_REP_RANGE = { min: 8, max: 12 };
const STRENGTH_REP_RANGE = { min: 4, max: 6 };
const BLENDED_REP_RANGE = { min: 6, max: 10 };

const DEFAULT_RIR = 2;
const LONG_REST_SECONDS = 120;
const SHORT_REST_SECONDS = 75;
const LARGE_REST_PATTERNS = new Set(["squat", "hinge", "carry"]);

/** Primary/secondary muscle-role scoring weights (docs/02_EXERCISE_RELATIONSHIPS_IMPLEMENTATION.md
 * §4's "recommendation configuration", not per-exercise data). Values are the
 * existing tuned constants, unchanged — this is a naming extraction only. */
export const MUSCLE_ROLE_WEIGHTS = { PRIMARY: 1.0, SECONDARY: 0.3 } as const;

/**
 * Small flat bonus for a candidate that's a known relationship (progression/
 * regression/variation/alternative) of a caller-supplied reference exercise
 * — see relatedExerciseIds on allocateSession's input. Illustrative/provisional,
 * like this file's other weights (line above); kept small relative to
 * QUALITY_WEIGHT * quality so it nudges selection rather than dominating it.
 */
const RELATIONSHIP_BONUS = 2;

/**
 * Weighted-sum candidate score (the architecture reviewed in SPIDRA's
 * score-candidates.ts — explicit small weights per contributing factor,
 * not an opaque single sort key). Terms:
 *  - muscleRelevance: how much this exercise's primary/secondary muscles
 *    overlap the session's target muscles, weighted by each muscle's own
 *    weekly volume target so priority muscles pull higher-relevance
 *    exercises to the top.
 *  - quality: the exercise's own hypertrophy/strength scores blended by
 *    the user's trainingBias (falls back to a neutral 5 when an exercise
 *    hasn't had those optional fields filled in by admin).
 *  - fatigue: a small penalty for higher fatigue cost.
 */
function scoreExercise(
  exercise: CatalogExercise,
  sessionMuscles: CanonicalMuscleGroup[],
  weeklyVolumeTargets: Record<CanonicalMuscleGroup, number>,
  trainingBias: TrainingBias,
  relatedExerciseIds?: Set<string>,
): number {
  const sessionMuscleSet = new Set(sessionMuscles);

  let muscleRelevance = 0;
  for (const muscle of exercise.primaryMuscles as CanonicalMuscleGroup[]) {
    if (sessionMuscleSet.has(muscle)) muscleRelevance += weeklyVolumeTargets[muscle] * MUSCLE_ROLE_WEIGHTS.PRIMARY;
  }
  for (const muscle of exercise.secondaryMuscles as CanonicalMuscleGroup[]) {
    if (sessionMuscleSet.has(muscle)) muscleRelevance += weeklyVolumeTargets[muscle] * MUSCLE_ROLE_WEIGHTS.SECONDARY;
  }

  const hypertrophyScore = exercise.hypertrophyScore ?? 5;
  const strengthScore = exercise.strengthScore ?? 5;
  const quality =
    hypertrophyScore * trainingBias.hypertrophy + strengthScore * trainingBias.strength;

  const fatigue = exercise.fatigueScore ?? 0;

  const MUSCLE_WEIGHT = 1.0;
  const QUALITY_WEIGHT = 2.0;
  const FATIGUE_WEIGHT = 1.0;

  const relationshipRelevance = relatedExerciseIds?.has(exercise.id) ? RELATIONSHIP_BONUS : 0;

  return (
    muscleRelevance * MUSCLE_WEIGHT +
    quality * QUALITY_WEIGHT -
    fatigue * FATIGUE_WEIGHT +
    relationshipRelevance
  );
}

function repRangeForBias(trainingBias: TrainingBias): { min: number; max: number } {
  if (trainingBias.hypertrophy >= 0.6) return HYPERTROPHY_REP_RANGE;
  if (trainingBias.strength >= 0.6) return STRENGTH_REP_RANGE;
  return BLENDED_REP_RANGE;
}

/**
 * Allocates one session's exercises, sets, rep ranges, RIR and rest —
 * pure and deterministic: identical inputs always produce identical
 * output (same candidates in the same order score identically; ties break
 * on canonicalId so output never depends on incidental array ordering).
 */
export function allocateSession(input: {
  sessionLabel: SessionLabel;
  candidates: CatalogExercise[];
  weeklyVolumeTargets: Record<CanonicalMuscleGroup, number>;
  trainingBias: TrainingBias;
  sessionDurationMinutes: number;
  /** Ids from exercises.getRelatedExerciseIds(db, referenceExerciseId) — resolved by the caller, kept out of this pure function. */
  relatedExerciseIds?: Set<string>;
}): AllocatedExercise[] {
  const sessionMuscles = SESSION_MUSCLE_MAP[input.sessionLabel];

  const scored = input.candidates
    .map((exercise) => ({
      exercise,
      score: scoreExercise(
        exercise,
        sessionMuscles,
        input.weeklyVolumeTargets,
        input.trainingBias,
        input.relatedExerciseIds,
      ),
    }))
    .sort((a, b) => b.score - a.score || a.exercise.canonicalId.localeCompare(b.exercise.canonicalId));

  const exerciseCount = Math.min(
    exerciseCountForDuration(input.sessionDurationMinutes),
    scored.length,
  );
  const selected = scored.slice(0, exerciseCount);

  const totalSetBudget = Math.max(
    exerciseCount * MIN_SETS_PER_EXERCISE,
    Math.round(input.sessionDurationMinutes / MINUTES_PER_SET),
  );
  const totalRelevance = selected.reduce((sum, s) => sum + Math.max(s.score, 0.01), 0);

  const { min: repMin, max: repMax } = repRangeForBias(input.trainingBias);
  const roles = assignSessionRoles(selected);

  return selected.map((s, index) => {
    const share = Math.max(s.score, 0.01) / totalRelevance;
    const sets = Math.min(
      MAX_SETS_PER_EXERCISE,
      Math.max(MIN_SETS_PER_EXERCISE, Math.round(totalSetBudget * share)),
    );
    const restSeconds = LARGE_REST_PATTERNS.has(s.exercise.movementPattern)
      ? LONG_REST_SECONDS
      : SHORT_REST_SECONDS;

    const baseline = {
      sets,
      repMin: s.exercise.defaultRepMin ?? repMin,
      repMax: s.exercise.defaultRepMax ?? repMax,
      rir: DEFAULT_RIR,
      restSeconds,
    };
    const { role, roleReason } = roles[index]!;
    const contextual = applyRoleModifier(baseline, role, {
      min: MIN_SETS_PER_EXERCISE,
      max: MAX_SETS_PER_EXERCISE,
    });

    return {
      exerciseId: s.exercise.id,
      canonicalId: s.exercise.canonicalId,
      orderIndex: index,
      ...contextual,
      sessionRole: role,
      roleReason,
    };
  });
}
