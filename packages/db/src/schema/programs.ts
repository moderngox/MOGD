import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { exercises } from "./exercises";

/**
 * Program hierarchy (docs/ARCHITECTURE.md §13): Program -> Workout ->
 * WorkoutExercise. No separate phase/week tables yet — M4 has no
 * periodization logic that would need them ("Not every hierarchy level
 * must become a table immediately if unnecessary"), so a program is
 * currently just one repeating week template. One current program per
 * user; regenerating replaces workouts/workout_exercises but never
 * exercise_logs (see below) — history must survive a regeneration.
 */
export const programs = sqliteTable("program", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  splitType: text("splitType").notNull(),
  sessionsPerWeek: integer("sessionsPerWeek").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const workouts = sqliteTable("workout", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  programId: text("programId")
    .notNull()
    .references(() => programs.id, { onDelete: "cascade" }),
  dayIndex: integer("dayIndex").notNull(),
  sessionLabel: text("sessionLabel").notNull(),
  estimatedDurationMinutes: integer("estimatedDurationMinutes").notNull(),
});

export const workoutExercises = sqliteTable("workout_exercise", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workoutId: text("workoutId")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: text("exerciseId")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  orderIndex: integer("orderIndex").notNull(),
  sets: integer("sets").notNull(),
  repMin: integer("repMin").notNull(),
  repMax: integer("repMax").notNull(),
  rirMin: integer("rirMin").notNull(),
  rirMax: integer("rirMax").notNull(),
  restSeconds: integer("restSeconds").notNull(),
  // Nullable, not backfilled: rows generated before this field existed
  // simply have no role (see packages/domain/src/training/sessionAllocation.ts).
  // Engine-assigned per docs/MOGD_06-session-role-architecture.md — never an
  // immutable property of the exercise itself (see exercises.allowedSessionRoles).
  sessionRole: text("sessionRole", {
    enum: ["main", "accessory", "superset", "finisher"],
  }),
  // Machine-readable "why this role" (docs/MOGD_06 §10) — nullable, same
  // not-backfilled convention as sessionRole.
  roleReason: text("roleReason", {
    enum: [
      "PREFERRED_ROLE",
      "STRONGEST_MAIN_CANDIDATE",
      "ONLY_ELIGIBLE_ROLE",
      "TAIL_POSITION_FINISHER",
      "DEFAULT_ACCESSORY_FALLBACK",
      "NO_CONFIG_DEFAULT_ACCESSORY",
    ],
  }),
  // Unused by the engine yet (superset ships unpaired in v1) — reserved so a
  // future pairing pass has somewhere to write without another migration.
  supersetGroupId: text("supersetGroupId"),
});
