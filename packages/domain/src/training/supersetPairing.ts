import type { SessionRole } from "../exercises/options";
import type { CatalogExercise } from "./candidatePool";
import type { RoleAssignment } from "./sessionRoleAssignment";

/**
 * Superset pairing (docs/MOGD_06-session-role-architecture.md §2, §10, §11): a
 * superset is exactly two exercises done back to back, so it is decided by a
 * pairing pass over the whole session, never assigned to one exercise on its
 * own. The spec leaves "when" and "compatible" open, so the rules below are
 * explicit; the constants are illustrative starting points like this
 * codebase's other role constants, not tuned physiology.
 */

/** "fatigue_budget: controlled" (§2): neither member may be a heavy fatiguer. */
export const SUPERSET_MEMBER_FATIGUE_CEILING = 6;
/** Two controlled movements back to back still shouldn't add up to a heavy block. */
export const SUPERSET_COMBINED_FATIGUE_CEILING = 10;
export const MAX_SUPERSET_PAIRS_PER_SESSION = 1;

export type SupersetExercise = Pick<
  CatalogExercise,
  "primaryMuscles" | "secondaryMuscles" | "fatigueScore" | "allowedSessionRoles" | "preferredSessionRole"
> & { programmingProfile: { setsMin: number; setsMax: number } };

type PairOperand = Pick<SupersetExercise, "primaryMuscles" | "secondaryMuscles" | "fatigueScore"> & {
  programmingProfile: { setsMin: number; setsMax: number };
};

/** Whether the exercise's admin configuration permits it as a superset member. */
export function allowsSuperset(exercise: Pick<CatalogExercise, "allowedSessionRoles">): boolean {
  return (exercise.allowedSessionRoles as SessionRole[]).includes("superset");
}

/**
 * Eligible to join a pair: its base role is accessory (so never the main lift
 * or the finisher), admin allows superset, its preference is null or superset
 * (a preference for another role is a bias to respect, so it isn't pulled in),
 * and it is within the member fatigue ceiling.
 */
export function isSupersetCandidate(exercise: SupersetExercise, baseRole: SessionRole): boolean {
  const preferred = exercise.preferredSessionRole as SessionRole | null;
  return (
    baseRole === "accessory" &&
    allowsSuperset(exercise) &&
    (preferred === null || preferred === "superset") &&
    (exercise.fatigueScore ?? 0) <= SUPERSET_MEMBER_FATIGUE_CEILING
  );
}

/** The set counts both members can share (alternating A1 B1 A2 B2); null when their ranges don't overlap. */
export function supersetSetBounds(a: PairOperand, b: PairOperand): { min: number; max: number } | null {
  const min = Math.max(a.programmingProfile.setsMin, b.programmingProfile.setsMin);
  const max = Math.min(a.programmingProfile.setsMax, b.programmingProfile.setsMax);
  return min <= max ? { min, max } : null;
}

/**
 * Two exercises can be paired when they don't compete for the same muscles
 * (primaries disjoint, and neither's primary is the other's secondary), their
 * combined fatigue stays under the ceiling, and they can share a set count.
 */
export function areSupersetCompatible(a: PairOperand, b: PairOperand): boolean {
  const aPrimary = new Set<string>(a.primaryMuscles);
  const bPrimary = new Set<string>(b.primaryMuscles);
  if ([...aPrimary].some((m) => bPrimary.has(m))) return false;
  if (a.secondaryMuscles.some((m) => bPrimary.has(m)) || b.secondaryMuscles.some((m) => aPrimary.has(m))) return false;

  if ((a.fatigueScore ?? 0) + (b.fatigueScore ?? 0) > SUPERSET_COMBINED_FATIGUE_CEILING) return false;

  return supersetSetBounds(a, b) !== null;
}

export interface PairingResult<T> {
  /** Same exercises; each partner moved to sit directly after its pair's first member. */
  selected: T[];
  roles: RoleAssignment[];
  /** 0-based pair number for superset members, null for everything else. */
  groupIndexes: (number | null)[];
}

/**
 * Forms at most MAX_SUPERSET_PAIRS_PER_SESSION pairs from the already
 * role-assigned selection. A pair forms only if at least one member PREFERS
 * superset — admin intent is the trigger, so nothing nobody marked is ever
 * silently paired and unconfigured programs are unchanged. Among candidates
 * the pair with the most preferring members wins; ties go to the earliest
 * (first member, then partner) in selection order. With no compatible partner
 * an exercise simply keeps its accessory role.
 */
export function pairSupersets<T extends { exercise: SupersetExercise }>(
  selected: T[],
  roles: RoleAssignment[],
): PairingResult<T> {
  type Slot = { item: T; role: RoleAssignment; group: number | null };
  let slots: Slot[] = selected.map((item, i) => ({ item, role: roles[i]!, group: null }));

  const prefersSuperset = (s: Slot) => (s.item.exercise.preferredSessionRole as SessionRole | null) === "superset";

  for (let pair = 0; pair < MAX_SUPERSET_PAIRS_PER_SESSION; pair++) {
    const candidates = slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.group === null && isSupersetCandidate(slot.item.exercise, slot.role.role));

    let best: { i: number; j: number; preferring: number } | null = null;
    for (let a = 0; a < candidates.length; a++) {
      for (let b = a + 1; b < candidates.length; b++) {
        const first = candidates[a]!;
        const second = candidates[b]!;
        const preferring = Number(prefersSuperset(first.slot)) + Number(prefersSuperset(second.slot));
        if (preferring === 0) continue;
        if (!areSupersetCompatible(first.slot.item.exercise, second.slot.item.exercise)) continue;
        if (best === null || preferring > best.preferring) best = { i: first.index, j: second.index, preferring };
      }
    }
    if (best === null) break;

    const first = slots[best.i]!;
    const second = slots[best.j]!;
    const paired: Pick<Slot, "role" | "group"> = {
      role: { role: "superset", roleReason: "SUPERSET_PAIR" },
      group: pair,
    };
    first.role = paired.role;
    first.group = pair;
    second.role = paired.role;
    second.group = pair;

    slots = slots.filter((_, index) => index !== best.j);
    slots.splice(best.i + 1, 0, second);
  }

  return {
    selected: slots.map((s) => s.item),
    roles: slots.map((s) => s.role),
    groupIndexes: slots.map((s) => s.group),
  };
}
