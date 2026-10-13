import type { Database } from "@mogd/db";
import { conflictingRestrictions } from "../safety/restrictions";
import type { Equipment, ExperienceLevel } from "../assessment/options";
import { resolveActiveExercise } from "../exercises/exerciseCatalog";
import { listProgrammingProfiles, resolveApplicableProfile } from "../exercises/programmingProfiles";
import { baselinePrescription, MINUTES_PER_SET } from "../training/sessionAllocation";
import { applyRoleModifier } from "../training/sessionRoleAssignment";
import type { RoleRules } from "../training/roleRules";
import { getRoleRulesRevision } from "../training/roleRulesStore";
import {
  allowsSuperset,
  areSupersetCompatible,
  type SupersetExercise,
} from "../training/supersetPairing";
import type { SessionLabel } from "../training/splitTemplates";
import type { AllocatedExercise } from "../training/sessionAllocation";

export interface ProgramWorkoutPlan {
  dayIndex: number;
  sessionLabel: SessionLabel;
  exercises: AllocatedExercise[];
}

export interface ProgramPlan {
  sessionsPerWeek: number;
  sessionDurationMinutes: number;
  equipment: Equipment[];
  experienceLevel: ExperienceLevel;
  /** Restriction categories the athlete reported; no exercise in the plan may list any of them. */
  restrictionKeys: string[];
  /** The role-rules revision the plan was built under (null = built-in defaults); the validator re-reads it itself. */
  roleRulesRevisionId: string | null;
  workouts: ProgramWorkoutPlan[];
}

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

// Generous overshoot tolerance since set-count rounding can push an
// estimate over the target; the floor guards against a degenerate,
// near-empty session slipping through.
const DURATION_OVERSHOOT_TOLERANCE = 0.15;
const DURATION_UNDERSHOOT_FLOOR = 0.5;

/**
 * Re-derives an exercise's expected final prescription — the trainee-level
 * baseline from the live profile, then the assigned role's modifier under the
 * named rules revision — and rejects any mismatch, plus structural nonsense
 * (non-integers, inverted or out-of-range ranges) that would be wrong whatever
 * the derivation. Sets are range-checked elsewhere: their final value also
 * depends on the session's set budget and a superset's shared count, which
 * aren't re-derivable per exercise.
 */
function validatePrescription(
  exercise: AllocatedExercise,
  resolved: { movementPattern: string },
  profile: NonNullable<ReturnType<typeof resolveApplicableProfile>>,
  rules: RoleRules,
  reasons: string[],
): void {
  const name = `"${exercise.canonicalId}"`;

  const fields = ["sets", "repMin", "repMax", "rirMin", "rirMax", "restSeconds"] as const;
  const nonInteger = fields.filter((f) => !Number.isInteger(exercise[f]));
  if (nonInteger.length > 0) {
    reasons.push(`${name} has non-integer ${nonInteger.join(", ")}.`);
    return;
  }

  if (exercise.repMin < 1 || exercise.repMax > 100 || exercise.repMin > exercise.repMax) {
    reasons.push(`${name} has an invalid rep range ${exercise.repMin}-${exercise.repMax}.`);
  }
  if (exercise.rirMin < 0 || exercise.rirMax > 10 || exercise.rirMin > exercise.rirMax) {
    reasons.push(`${name} has an invalid RIR range ${exercise.rirMin}-${exercise.rirMax}.`);
  }
  if (exercise.restSeconds < rules.restSecondsFloor || exercise.restSeconds > 600) {
    reasons.push(
      `${name} has ${exercise.restSeconds}s rest, outside the ${rules.restSecondsFloor}-600s allowed.`,
    );
  }

  const expected = applyRoleModifier(
    baselinePrescription(resolved, profile, exercise.sets),
    exercise.sessionRole,
    { min: profile.setsMin, max: profile.setsMax },
    rules,
  );
  for (const field of ["repMin", "repMax", "rirMin", "rirMax", "restSeconds"] as const) {
    if (exercise[field] !== expected[field]) {
      reasons.push(
        `${name} has ${field} ${exercise[field]} but ${expected[field]} is expected for a ${exercise.sessionRole} under this profile and rules.`,
      );
    }
  }
}

/**
 * A superset is exactly two adjacent exercises, both role "superset", sharing a
 * group, eligible and compatible, doing the same number of sets — re-derived
 * here with the same pure rules the generator used, never trusted from it.
 */
function validateSupersets(
  workout: ProgramWorkoutPlan,
  resolvedByOrder: Map<number, SupersetExercise>,
  rules: RoleRules,
  reasons: string[],
): void {
  const day = `Day ${workout.dayIndex}`;
  const groups = new Map<number, AllocatedExercise[]>();

  for (const exercise of workout.exercises) {
    if (exercise.supersetGroupIndex === null) {
      if (exercise.sessionRole === "superset") {
        reasons.push(`${day}: "${exercise.canonicalId}" is a superset with no partner.`);
      }
      continue;
    }
    if (exercise.sessionRole !== "superset") {
      reasons.push(`${day}: "${exercise.canonicalId}" is in a superset group but has role "${exercise.sessionRole}".`);
    }
    groups.set(exercise.supersetGroupIndex, [...(groups.get(exercise.supersetGroupIndex) ?? []), exercise]);
  }

  if (groups.size > rules.superset.maxPairsPerSession) {
    reasons.push(`${day} has ${groups.size} supersets, over the limit of ${rules.superset.maxPairsPerSession}.`);
  }

  for (const members of groups.values()) {
    if (members.length !== 2) {
      reasons.push(`${day}: a superset must be exactly two exercises, found ${members.length}.`);
      continue;
    }
    const [a, b] = members as [AllocatedExercise, AllocatedExercise];
    const label = `"${a.canonicalId}" / "${b.canonicalId}"`;

    if (Math.abs(a.orderIndex - b.orderIndex) !== 1) reasons.push(`${day}: superset ${label} isn't adjacent.`);
    if (a.sets !== b.sets) reasons.push(`${day}: superset ${label} has unequal set counts (${a.sets} vs ${b.sets}).`);

    const resolvedA = resolvedByOrder.get(a.orderIndex);
    const resolvedB = resolvedByOrder.get(b.orderIndex);
    if (!resolvedA || !resolvedB) continue; // already reported as unresolved / no profile

    for (const [exercise, resolved] of [[a, resolvedA], [b, resolvedB]] as const) {
      if (!allowsSuperset(resolved)) reasons.push(`${day}: "${exercise.canonicalId}" is not eligible for superset.`);
      if ((resolved.fatigueScore ?? 0) > rules.superset.memberFatigueCeiling) {
        reasons.push(`${day}: "${exercise.canonicalId}" is too fatiguing for a superset.`);
      }
    }
    if (!areSupersetCompatible(resolvedA, resolvedB, rules)) reasons.push(`${day}: superset ${label} isn't compatible.`);
  }
}

/**
 * Independently re-derives and re-checks every invariant the upstream
 * pipeline steps were supposed to guarantee — it never trusts them
 * (the same discipline reviewed in SPIDRA's validate-program.ts: "a
 * validator that only trusts upstream filtering isn't actually validating
 * anything"). Rejects explicitly rather than clamping or dropping the
 * offending exercise (CLAUDE.md rule 4/8).
 */
export async function validateProgram(db: Database, plan: ProgramPlan): Promise<ValidationResult> {
  const reasons: string[] = [];
  const rules = await getRoleRulesRevision(db, plan.roleRulesRevisionId);

  if (plan.workouts.length !== plan.sessionsPerWeek) {
    reasons.push(
      `Program has ${plan.workouts.length} sessions but the user asked for ${plan.sessionsPerWeek}/week.`,
    );
  }

  const userEquipment = new Set<string>(plan.equipment);

  for (const workout of plan.workouts) {
    if (workout.exercises.length === 0) {
      reasons.push(`Day ${workout.dayIndex} (${workout.sessionLabel}) has no exercises.`);
      continue;
    }

    const mainCount = workout.exercises.filter((e) => e.sessionRole === "main").length;
    if (mainCount > rules.maxMainSlots) {
      reasons.push(`Day ${workout.dayIndex} has ${mainCount} main exercises, over the limit of ${rules.maxMainSlots}.`);
    }

    const estimatedMinutes = workout.exercises.reduce((sum, e) => sum + e.sets * MINUTES_PER_SET, 0);
    const max = plan.sessionDurationMinutes * (1 + DURATION_OVERSHOOT_TOLERANCE);
    const min = plan.sessionDurationMinutes * DURATION_UNDERSHOOT_FLOOR;
    if (estimatedMinutes > max) {
      reasons.push(
        `Day ${workout.dayIndex} is estimated at ${estimatedMinutes} min, over the ${Math.round(max)} min tolerance for a ${plan.sessionDurationMinutes} min session.`,
      );
    }
    if (estimatedMinutes < min) {
      reasons.push(
        `Day ${workout.dayIndex} is estimated at only ${estimatedMinutes} min, below the ${Math.round(min)} min floor for a ${plan.sessionDurationMinutes} min session.`,
      );
    }

    const checked = new Map<number, SupersetExercise>();

    for (const exercise of workout.exercises) {
      // Re-resolve against the live catalog — never trust that a
      // canonicalId collected earlier in the pipeline is still active
      // (CLAUDE.md rule 6).
      const resolved = await resolveActiveExercise(db, exercise.canonicalId);
      if (!resolved) {
        reasons.push(`"${exercise.canonicalId}" does not resolve to an active canonical exercise.`);
        continue;
      }

      const equipmentOk =
        resolved.equipment.length === 0 || resolved.equipment.every((e) => userEquipment.has(e));
      if (!equipmentOk) {
        reasons.push(`"${exercise.canonicalId}" requires equipment the user doesn't have.`);
      }

      // Re-checked against the live tags, independently of the candidate filter.
      const conflicts = conflictingRestrictions(resolved.contraindicationTags, plan.restrictionKeys);
      if (conflicts.length > 0) {
        reasons.push(
          `"${exercise.canonicalId}" is marked unsuitable for a restriction the user reported (${conflicts.join(", ")}).`,
        );
      }

      // The applicable trainee-level profile is re-resolved independently (not trusted
      // from the generator), then the final prescription is re-derived from it.
      // The assigned role must appear in the exercise's allowed list verbatim (no implicit
      // default), and a finisher must be within the fatigue ceiling.
      const allowedRoles = resolved.allowedSessionRoles as string[];
      if (allowedRoles.length === 0) {
        reasons.push(`"${exercise.canonicalId}" has no allowed session roles.`);
      } else if (!allowedRoles.includes(exercise.sessionRole)) {
        reasons.push(`"${exercise.canonicalId}" was assigned role "${exercise.sessionRole}", which it is not eligible for.`);
      }
      if (exercise.sessionRole === "finisher" && (resolved.fatigueScore ?? 0) > rules.finisherFatigueCeiling) {
        reasons.push(`"${exercise.canonicalId}" is too fatiguing to be a finisher.`);
      }

      const profiles = await listProgrammingProfiles(db, resolved.id);
      const profile = resolveApplicableProfile(profiles, plan.experienceLevel);
      if (!profile) {
        reasons.push(`"${exercise.canonicalId}" has no enabled programming profile for this user's level.`);
      } else if (exercise.sets < profile.setsMin || exercise.sets > profile.setsMax) {
        reasons.push(
          `"${exercise.canonicalId}" has ${exercise.sets} sets, outside the ${profile.setsMin}-${profile.setsMax} bounds for this profile.`,
        );
      }

      if (profile) {
        validatePrescription(exercise, resolved, profile, rules, reasons);
        checked.set(exercise.orderIndex, { ...resolved, programmingProfile: profile });
      }
    }

    validateSupersets(workout, checked, rules, reasons);
  }

  return { valid: reasons.length === 0, reasons };
}
