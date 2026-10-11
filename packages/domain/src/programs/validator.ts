import type { Database } from "@mogd/db";
import type { Equipment, ExperienceLevel } from "../assessment/options";
import { resolveActiveExercise } from "../exercises/exerciseCatalog";
import { listProgrammingProfiles, resolveApplicableProfile } from "../exercises/programmingProfiles";
import { MINUTES_PER_SET } from "../training/sessionAllocation";
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

      // Re-resolve the applicable trainee-level profile independently
      // rather than trusting the generator's own resolution (same
      // "re-derive every invariant" discipline as the rest of this
      // function) — mogd_programming_engine_specs 05 acceptance criteria.
      // Only sets is re-checked against the profile directly: session-role
      // modifiers (sessionRoleAssignment.ts) deliberately shift rep/RIR
      // targets outside the baseline profile envelope (e.g. finisher's
      // higher rep range), so those two aren't independently re-derivable
      // here without re-running role-modifier logic the validator
      // shouldn't need to know about.
      // Assigned role must be one the exercise actually allows (accessory-only
      // when unconfigured), and a finisher must be within the fatigue ceiling.
      const configuredRoles = resolved.allowedSessionRoles as string[];
      const allowedRoles = configuredRoles.length === 0 ? ["accessory"] : configuredRoles;
      if (!allowedRoles.includes(exercise.sessionRole)) {
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

      if (profile) checked.set(exercise.orderIndex, { ...resolved, programmingProfile: profile });
    }

    validateSupersets(workout, checked, rules, reasons);
  }

  return { valid: reasons.length === 0, reasons };
}
