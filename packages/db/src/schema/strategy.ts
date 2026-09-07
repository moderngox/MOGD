import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * Compiled goal strategy (docs/ARCHITECTURE.md §5) — the current one per
 * user, upserted whenever regenerated. Distinct from physique_goals (M1's
 * raw primaryGoal + physiquePriorities selection): this is the *derived*
 * artifact (priorityMuscles, energyDirection, trainingBias) M4's training
 * engine and M3's own nutrition computation consume.
 */
export const goalStrategies = sqliteTable("goal_strategy", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  primaryGoal: text("primaryGoal").notNull(),
  priorityMuscles: text("priorityMuscles", { mode: "json" }).$type<string[]>().notNull(),
  energyDirection: text("energyDirection").notNull(),
  // {hypertrophy, strength} — small enough that a normalized table would
  // be pure ceremony for no queryability gained.
  trainingBias: text("trainingBias", { mode: "json" })
    .$type<{ hypertrophy: number; strength: number }>()
    .notNull(),
  computedAt: integer("computedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Deterministic nutrition targets (docs/ARCHITECTURE.md §16). Persisted so
 * dashboard loads read this instead of recomputing (CLAUDE.md rule 11) —
 * recomputation only happens through generateStrategyAndNutrition().
 */
export const nutritionTargets = sqliteTable("nutrition_target", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  bmr: real("bmr").notNull(),
  tdee: real("tdee").notNull(),
  energyDirection: text("energyDirection").notNull(),
  energyKcal: real("energyKcal").notNull(),
  proteinG: real("proteinG").notNull(),
  fatG: real("fatG").notNull(),
  carbG: real("carbG").notNull(),
  computedAt: integer("computedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
