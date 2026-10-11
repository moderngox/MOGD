import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { exercises } from "./exercises";
import { workouts } from "./programs";
import { trainingLocations } from "./trainingLocations";

// Kept in sync by hand with packages/domain (packages/db never imports from
// packages/domain — same convention as exercises.ts / programs.ts).
const SESSION_STATUS_VALUES = ["in_progress", "completed", "abandoned"] as const;
const SESSION_ROLE_VALUES = ["main", "accessory", "superset", "finisher"] as const;
const ROLE_REASON_VALUES = [
  "PREFERRED_ROLE",
  "STRONGEST_MAIN_CANDIDATE",
  "ONLY_ELIGIBLE_ROLE",
  "TAIL_POSITION_FINISHER",
  "DEFAULT_ACCESSORY_FALLBACK",
  "NO_CONFIG_DEFAULT_ACCESSORY",
] as const;
const PROGRESSION_REASON_VALUES = [
  "NO_LOAD_HISTORY",
  "CONTEXT_CHANGED",
  "REASSESS_DUE_TO_PAIN",
  "HOLD_FOR_TECHNIQUE",
  "CONTINUE_CURRENT_LOAD",
  "INCREASE_LOAD",
  "REDUCE_LOAD",
  "CONTINUE_REP_PROGRESSION",
] as const;

/**
 * One physical workout (mogd_programming_engine_specs 01 §4's
 * WorkoutSession). workouts.id identifies a *recurring program slot*; this
 * row identifies one dated occurrence of it. workoutId is set null on
 * delete — NOT cascade — so a program regeneration never deletes what the
 * athlete actually did (same rule exercise_log followed before).
 */
export const workoutSessions = sqliteTable(
  "workout_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutId: text("workoutId").references(() => workouts.id, { onDelete: "set null" }),
    // Equipment context of this occurrence. Null is a real bucket (never a
    // wildcard): history only compares sessions in the same context.
    trainingLocationId: text("trainingLocationId").references(() => trainingLocations.id, { onDelete: "set null" }),
    // Text snapshot so the session stays interpretable once its workout is gone.
    sessionLabel: text("sessionLabel").notNull(),
    status: text("status", { enum: SESSION_STATUS_VALUES }).notNull().default("in_progress"),
    startedAt: integer("startedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer("completedAt", { mode: "timestamp_ms" }),
  },
  (table) => [
    // "Reopen = resume": at most one open occurrence per user per program slot,
    // enforced by the database, not just application discipline.
    uniqueIndex("workout_session_one_in_progress_per_slot")
      .on(table.userId, table.workoutId)
      .where(sql`${table.status} = 'in_progress'`),
  ],
);

/**
 * One exercise within a session, holding the snapshot of what the athlete
 * was prescribed and told (mogd_programming_engine_specs 01 §4's
 * WorkoutExercisePerformance.prescribedProfileSnapshot). Flattened columns,
 * matching workout_exercise's own snapshot convention. Written once, when the
 * first set is logged — later profile edits or regeneration never touch it.
 */
export const workoutExercisePerformances = sqliteTable(
  "workout_exercise_performance",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workoutSessionId: text("workoutSessionId")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: text("exerciseId")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    orderIndex: integer("orderIndex").notNull(),
    sessionRole: text("sessionRole", { enum: SESSION_ROLE_VALUES }),
    roleReason: text("roleReason", { enum: ROLE_REASON_VALUES }),
    sets: integer("sets").notNull(),
    repMin: integer("repMin").notNull(),
    repMax: integer("repMax").notNull(),
    rirMin: integer("rirMin").notNull(),
    rirMax: integer("rirMax").notNull(),
    restSeconds: integer("restSeconds").notNull(),
    // The individualized recommendation the athlete was shown (null load =
    // no personalized kg, see loadInstruction).
    recommendedLoadKg: real("recommendedLoadKg"),
    recommendationReason: text("recommendationReason", { enum: PROGRESSION_REASON_VALUES }).notNull(),
    loadInstruction: text("loadInstruction"),
    // The human explanation shown with it; one reason can carry different messages.
    recommendationMessage: text("recommendationMessage").notNull(),
    targetRepMin: integer("targetRepMin").notNull(),
    targetRepMax: integer("targetRepMax").notNull(),
    // All prescribed sets logged — recomputed whenever a set changes.
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [uniqueIndex("workout_exercise_performance_session_exercise").on(table.workoutSessionId, table.exerciseId)],
);

/**
 * Set-level logging (docs/ARCHITECTURE.md §14; spec's WorkoutSetPerformance).
 * A row existing means the set happened — correction is edit or delete, there
 * is no separate "completed" flag. loadKg is unit-explicit by name; a second
 * unit would be a deliberate schema change, not a one-value enum today.
 */
export const exerciseLogs = sqliteTable(
  "exercise_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exerciseId")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    // Nullable only because SQLite can't add a NOT NULL column to a populated
    // table without a rebuild; the backfill links every legacy row and logging
    // always sets it.
    workoutExercisePerformanceId: text("workoutExercisePerformanceId").references(
      () => workoutExercisePerformances.id,
      { onDelete: "cascade" },
    ),
    setNumber: integer("setNumber").notNull(),
    loadKg: real("loadKg"),
    reps: integer("reps").notNull(),
    rir: integer("rir"),
    painFlag: integer("painFlag", { mode: "boolean" }),
    techniqueValid: integer("techniqueValid", { mode: "boolean" }),
    completedAt: integer("completedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("exercise_log_performance_set").on(table.workoutExercisePerformanceId, table.setNumber),
  ],
);
