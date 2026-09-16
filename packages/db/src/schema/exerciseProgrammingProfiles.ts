import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { exercises } from "./exercises";

/** Kept in sync by hand with packages/domain/src/assessment/options.ts's
 * EXPERIENCE_LEVEL_OPTIONS — packages/db never imports from packages/domain
 * (same convention already used by exercises.ts's SESSION_ROLE_VALUES). */
const TRAINEE_LEVEL_VALUES = ["beginner", "intermediate", "advanced"] as const;

/** Only one value each is valid in v1 (mogd_programming_engine_specs 01/02:
 * "initially: rir" / "initially: double_progression") — real enum columns so
 * the schema is ready for a second value later without implying one exists
 * today (admin UI renders these as locked, not live dropdowns). */
const PRESCRIPTION_TYPE_VALUES = ["rir"] as const;
const PROGRESSION_TYPE_VALUES = ["double_progression"] as const;

/**
 * Trainee-level baseline programming profile (mogd_programming_engine_specs
 * 01-domain-model.md §2, 02-admin-programming-profiles.md). A profile is a
 * *range/rule*, never a universal working kg — actual load is athlete
 * performance history (packages/db/src/schema/programs.ts exerciseLogs).
 *
 * Exactly one row per (exerciseId, traineeLevel) — never a combinatorial
 * (level × sessionRole) explosion; session-role modifiers are applied on top
 * of the resolved profile at generation time
 * (packages/domain/src/training/sessionRoleAssignment.ts), not stored here.
 */
export const exerciseProgrammingProfiles = sqliteTable(
  "exercise_programming_profile",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    exerciseId: text("exerciseId")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    traineeLevel: text("traineeLevel", { enum: TRAINEE_LEVEL_VALUES }).notNull(),
    // "Profiles may be disabled where inappropriate" (spec 02) — disabled
    // rather than deleted so admin-entered bounds aren't lost on toggle.
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    // True only for profiles the migration backfill created by copying the
    // old single defaultRepMin/Max/RIR-default onto all three levels
    // identically — cleared the first time admin actually edits this level
    // (spec 05: "do not silently fabricate three distinct profiles unless
    // explicitly marked as inherited/default").
    isInheritedDefault: integer("isInheritedDefault", { mode: "boolean" }).notNull().default(false),
    setsMin: integer("setsMin").notNull(),
    setsMax: integer("setsMax").notNull(),
    repsMin: integer("repsMin").notNull(),
    repsMax: integer("repsMax").notNull(),
    rirMin: integer("rirMin").notNull(),
    rirMax: integer("rirMax").notNull(),
    restSecondsMin: integer("restSecondsMin").notNull(),
    restSecondsMax: integer("restSecondsMax").notNull(),
    prescriptionType: text("prescriptionType", { enum: PRESCRIPTION_TYPE_VALUES }).notNull().default("rir"),
    progressionType: text("progressionType", { enum: PROGRESSION_TYPE_VALUES })
      .notNull()
      .default("double_progression"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("exercise_programming_profile_exercise_level").on(table.exerciseId, table.traineeLevel)],
);
