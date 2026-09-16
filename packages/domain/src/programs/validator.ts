import type { Database } from "@mogd/db";
import type { Equipment, ExperienceLevel } from "../assessment/options";
import { resolveActiveExercise } from "../exercises/exerciseCatalog";
import { listProgrammingProfiles, resolveApplicableProfile } from "../exercises/programmingProfiles";
import { MINUTES_PER_SET } from "../training/sessionAllocation";
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
 * Independently re-derives and re-checks every invariant the upstream
 * pipeline steps were supposed to guarantee — it never trusts them
 * (the same discipline reviewed in SPIDRA's validate-program.ts: "a
 * validator that only trusts upstream filtering isn't actually validating
 * anything"). Rejects explicitly rather than clamping or dropping the
 * offending exercise (CLAUDE.md rule 4/8).
 */
export async function validateProgram(db: Database, plan: ProgramPlan): Promise<ValidationResult> {
  const reasons: string[] = [];

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
      const profiles = await listProgrammingProfiles(db, resolved.id);
      const profile = resolveApplicableProfile(profiles, plan.experienceLevel);
      if (!profile) {
        reasons.push(`"${exercise.canonicalId}" has no enabled programming profile for this user's level.`);
      } else if (exercise.sets < profile.setsMin || exercise.sets > profile.setsMax) {
        reasons.push(
          `"${exercise.canonicalId}" has ${exercise.sets} sets, outside the ${profile.setsMin}-${profile.setsMax} bounds for this profile.`,
        );
      }
    }
  }

  return { valid: reasons.length === 0, reasons };
}
