import type { SessionRole } from "../exercises/options";
import type { CatalogExercise } from "./candidatePool";

/**
 * docs/MOGD_06-session-role-architecture.md §10: "allow deterministic
 * explanation/debugging of why a role was selected." A small, fixed
 * vocabulary — every branch of assignSessionRoles below maps to exactly one
 * of these.
 */
export const ROLE_REASON_OPTIONS = [
  "PREFERRED_ROLE",
  "STRONGEST_MAIN_CANDIDATE",
  "ONLY_ELIGIBLE_ROLE",
  "TAIL_POSITION_FINISHER",
  "DEFAULT_ACCESSORY_FALLBACK",
  "NO_CONFIG_DEFAULT_ACCESSORY",
] as const;
export type RoleReason = (typeof ROLE_REASON_OPTIONS)[number];

export interface RoleModifier {
  restModifierMultiplier: number;
  repShift?: { min: number; max: number };
  rirCeiling?: number;
  setsDelta?: number;
}

/**
 * docs/MOGD_06 §2's conceptual per-role config, adapted to what this
 * codebase's baseline already computes (see applyRoleModifier) rather than
 * the doc's illustrative fatigue_budget/volume_bias/load_bias fields, which
 * have no corresponding inputs anywhere in sessionAllocation.ts today.
 * Illustrative starting points, not tuned constants — same caveat this
 * file's sibling sessionAllocation.ts already applies to its own weights.
 */
export const SESSION_ROLE_MODIFIERS: Record<SessionRole, RoleModifier> = {
  main: { restModifierMultiplier: 1.2 },
  accessory: { restModifierMultiplier: 1.0 },
  superset: { restModifierMultiplier: 0.7 },
  finisher: { restModifierMultiplier: 0.6, repShift: { min: 3, max: 5 }, rirCeiling: 2, setsDelta: -1 },
};

/** At most this many exercises hold "main" in one session — flat per docs/MOGD_06 §3's
 * singular framing and its Bench Press example (a second compound falls back to accessory
 * once main is taken), not split-type-aware. */
export const MAX_MAIN_SLOTS_PER_SESSION = 1;

/** On the existing 0-10 fatigueScore scale — docs/MOGD_06 §10's "avoid placing
 * high-systemic-fatigue movements as finishers merely because the role exists." */
export const FINISHER_FATIGUE_CEILING = 6;

export interface RoleAssignment {
  role: SessionRole;
  roleReason: RoleReason;
}

/**
 * Assigns the actual session role per exercise, respecting each exercise's
 * admin-curated allowedSessionRoles (never assigns a role outside it — the
 * spec's most safety-critical constraint) and treating preferredSessionRole
 * as a bias, not a mandate (docs/MOGD_06 §3, §10).
 *
 * Runs as a pass over allocateSession's already-scored, already-ordered
 * `selected` array — it does not reselect or reorder candidates. The
 * existing muscle-relevance/volume-target scoring already functions as a
 * reasonable proxy for "structural needs" (docs/MOGD_06 §7 step 2), so
 * score-descending order is a legitimate input to role assignment, not an
 * arbitrary one. True candidate-selection steering (e.g. guaranteeing a
 * squat variant is *selected* before accessories) is separate, larger,
 * un-scoped work.
 */
export class UnassignableRoleError extends Error {
  constructor(canonicalId: string) {
    super(`"${canonicalId}" has no legal session role for this position (eligibility, main-slot and fatigue constraints)`);
    this.name = "UnassignableRoleError";
  }
}

export interface RoleAssignmentState {
  mainSlotsFilled: number;
}

/** Roles an exercise may take right now: its configured eligibility (accessory-only
 * when unconfigured), minus "main" once the main slot is full and minus "finisher"
 * above the fatigue ceiling — those two constraints hold on every branch, not just
 * the default one. */
export function legalRolesFor(exercise: CatalogExercise, state: RoleAssignmentState): SessionRole[] {
  const configured = exercise.allowedSessionRoles as SessionRole[];
  const allowed: SessionRole[] = configured.length === 0 ? ["accessory"] : configured;
  return allowed.filter(
    (role) =>
      !(role === "main" && state.mainSlotsFilled >= MAX_MAIN_SLOTS_PER_SESSION) &&
      !(role === "finisher" && (exercise.fatigueScore ?? 0) > FINISHER_FATIGUE_CEILING),
  );
}

/**
 * Assigns one exercise's role and advances `state` (main-slot count). Returns
 * null when no role is legal — the caller must then not select the exercise
 * rather than assign a role outside its eligibility or break a constraint.
 */
export function assignRole(
  exercise: CatalogExercise,
  state: RoleAssignmentState,
  isLast: boolean,
): RoleAssignment | null {
  const unconfigured = (exercise.allowedSessionRoles as SessionRole[]).length === 0;
  const legal = legalRolesFor(exercise, state);
  const preferred = exercise.preferredSessionRole as SessionRole | null;

  const take = (role: SessionRole, roleReason: RoleReason): RoleAssignment => {
    if (role === "main") state.mainSlotsFilled += 1;
    return { role, roleReason };
  };

  if (legal.length === 0) return null;

  if (preferred && legal.includes(preferred)) return take(preferred, "PREFERRED_ROLE");

  if (legal.length === 1) {
    const only = legal[0]!;
    if (unconfigured) return take(only, "NO_CONFIG_DEFAULT_ACCESSORY");
    // Narrowed to accessory by a constraint (e.g. main slot full) is the ordinary fallback.
    return take(only, only === "accessory" ? "DEFAULT_ACCESSORY_FALLBACK" : "ONLY_ELIGIBLE_ROLE");
  }

  if (legal.includes("main")) return take("main", "STRONGEST_MAIN_CANDIDATE");

  if (isLast && legal.includes("finisher")) return take("finisher", "TAIL_POSITION_FINISHER");

  if (legal.includes("accessory")) return take("accessory", "DEFAULT_ACCESSORY_FALLBACK");

  // Deterministic only because allowedSessionRoles is persisted in canonical
  // SESSION_ROLE_OPTIONS order (enforced at the admin-form layer).
  return take(legal[0]!, "ONLY_ELIGIBLE_ROLE");
}

export function assignSessionRoles(
  selected: { exercise: CatalogExercise; score: number }[],
): RoleAssignment[] {
  const state: RoleAssignmentState = { mainSlotsFilled: 0 };
  const lastIndex = selected.length - 1;

  return selected.map(({ exercise }, index) => {
    const assignment = assignRole(exercise, state, index === lastIndex);
    if (!assignment) throw new UnassignableRoleError(exercise.canonicalId);
    return assignment;
  });
}

interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  restSeconds: number;
}

const REST_SECONDS_FLOOR = 30;

/**
 * Layers a role's modifier on top of the baseline sessionAllocation.ts
 * already computes from trainingBias/movement pattern — deliberately NOT a
 * new (exercise x experienceLevel) baseline table (docs/MOGD_06 §6's own
 * "avoid combinatorial explosion" warning, and no such table exists
 * anywhere in this codebase today). Pure; never leaves prescriptions out of
 * their existing sane bounds.
 */
export function applyRoleModifier(
  baseline: Prescription,
  role: SessionRole,
  setsBounds: { min: number; max: number },
): Prescription {
  const modifier = SESSION_ROLE_MODIFIERS[role];

  const restSeconds = Math.max(
    REST_SECONDS_FLOOR,
    Math.round((baseline.restSeconds * modifier.restModifierMultiplier) / 5) * 5,
  );

  let repMin = baseline.repMin;
  let repMax = baseline.repMax;
  if (modifier.repShift) {
    repMin = Math.min(100, Math.max(1, repMin + modifier.repShift.min));
    repMax = Math.min(100, Math.max(1, repMax + modifier.repShift.max));
    if (repMin > repMax) repMin = repMax;
  }

  let rirMax = baseline.rirMax;
  let rirMin = baseline.rirMin;
  if (modifier.rirCeiling !== undefined) {
    rirMax = Math.min(rirMax, modifier.rirCeiling);
    rirMin = Math.min(rirMin, rirMax);
  }

  let sets = baseline.sets;
  if (modifier.setsDelta) {
    sets = Math.min(setsBounds.max, Math.max(setsBounds.min, sets + modifier.setsDelta));
  }

  return { sets, repMin, repMax, rirMin, rirMax, restSeconds };
}
