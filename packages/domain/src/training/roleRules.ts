import { z } from "zod";

/**
 * The session-role engine's tunable numbers (docs/MOGD_06-session-role-architecture.md
 * §2: "These values are conceptual starting points … Keep them configurable";
 * §6: the modifier logic belongs in a centralized configuration layer).
 *
 * Only the NUMBERS are configurable. The assignment/pairing algorithms and the
 * structural compatibility rules (muscle disjointness, adjacency, one role per
 * exercise) stay code. The bounds below are the deterministic safety envelope
 * (CLAUDE.md rule 4): whatever an admin saves, a value outside them is rejected
 * explicitly, and the prescription clamps downstream (reps 1-100, sets within
 * the exercise's own profile range) still apply after any rule.
 */

/** The deterministic safety envelope — one source for the schema below and the admin form's range hints. */
export const ROLE_RULE_BOUNDS = {
  restMultiplier: { min: 0.3, max: 2 },
  repShift: { min: -5, max: 10 },
  rirCeiling: { min: 0, max: 5 },
  setsDelta: { min: -2, max: 2 },
  restSecondsFloor: { min: 15, max: 120 },
  maxMainSlots: { min: 1, max: 2 },
  fatigueCeiling: { min: 0, max: 10 },
  combinedFatigueCeiling: { min: 0, max: 20 },
  maxPairsPerSession: { min: 0, max: 2 },
} as const;

const B = ROLE_RULE_BOUNDS;

const roleModifierSchema = z
  .object({
    /** Scales the baseline rest. */
    restMultiplier: z.number().min(B.restMultiplier.min).max(B.restMultiplier.max),
    /** Added to the baseline rep range (min and max separately). */
    repShift: z
      .object({
        min: z.number().int().min(B.repShift.min).max(B.repShift.max),
        max: z.number().int().min(B.repShift.min).max(B.repShift.max),
      })
      .strict()
      .optional(),
    /** Caps the RIR range's upper end; absent = no cap. */
    rirCeiling: z.number().int().min(B.rirCeiling.min).max(B.rirCeiling.max).optional(),
    /** Added to the set count (still clamped to the exercise's profile range). */
    setsDelta: z.number().int().min(B.setsDelta.min).max(B.setsDelta.max).optional(),
  })
  .strict();

export const roleRulesSchema = z
  .object({
    roles: z
      .object({
        main: roleModifierSchema,
        accessory: roleModifierSchema,
        superset: roleModifierSchema,
        finisher: roleModifierSchema,
      })
      .strict(),
    /** Rest never drops below this after a role's multiplier. */
    restSecondsFloor: z.number().int().min(B.restSecondsFloor.min).max(B.restSecondsFloor.max),
    /** At most this many exercises hold "main" in one session (0 would make main-only exercises unassignable). */
    maxMainSlots: z.number().int().min(B.maxMainSlots.min).max(B.maxMainSlots.max),
    /** On the 0-10 fatigue scale — above this an exercise can't be a finisher. */
    finisherFatigueCeiling: z.number().min(B.fatigueCeiling.min).max(B.fatigueCeiling.max),
    superset: z
      .object({
        /** Neither member of a pair may exceed this fatigue score. */
        memberFatigueCeiling: z.number().min(B.fatigueCeiling.min).max(B.fatigueCeiling.max),
        /** The pair's fatigue scores added together may not exceed this. */
        combinedFatigueCeiling: z.number().min(B.combinedFatigueCeiling.min).max(B.combinedFatigueCeiling.max),
        /** 0 disables supersets. */
        maxPairsPerSession: z.number().int().min(B.maxPairsPerSession.min).max(B.maxPairsPerSession.max),
      })
      .strict()
      .refine((s) => s.combinedFatigueCeiling >= s.memberFatigueCeiling, {
        message: "combinedFatigueCeiling must be at least memberFatigueCeiling",
        path: ["combinedFatigueCeiling"],
      }),
  })
  .strict();

export type RoleRules = z.infer<typeof roleRulesSchema>;

/**
 * Today's behaviour, unchanged by making it configurable (a test pins this).
 * Illustrative starting points, not tuned physiology — the same caveat the
 * engine's other constants carry. Used whenever no revision has been saved.
 */
export const DEFAULT_ROLE_RULES: RoleRules = {
  roles: {
    main: { restMultiplier: 1.2 },
    accessory: { restMultiplier: 1.0 },
    superset: { restMultiplier: 0.7 },
    finisher: { restMultiplier: 0.6, repShift: { min: 3, max: 5 }, rirCeiling: 2, setsDelta: -1 },
  },
  restSecondsFloor: 30,
  maxMainSlots: 1,
  finisherFatigueCeiling: 6,
  superset: { memberFatigueCeiling: 6, combinedFatigueCeiling: 10, maxPairsPerSession: 1 },
};
