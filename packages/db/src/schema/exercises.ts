import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Canonical exercise identity + programming metadata (docs/ARCHITECTURE.md
 * §7). Unlike exerciseAssets below, this row is directly editable by admin
 * — docs/ARCHITECTURE.md's Exercise interface has no separate versioned
 * "content" table for metadata, only for media. canonicalId is immutable
 * once set (enforced at the application layer, not by this schema).
 */
export const exercises = sqliteTable("exercise", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  canonicalId: text("canonicalId").notNull().unique(),
  name: text("name").notNull(),
  movementPattern: text("movementPattern").notNull(),
  difficulty: text("difficulty").notNull(),
  primaryMuscles: text("primaryMuscles", { mode: "json" }).$type<string[]>().notNull(),
  secondaryMuscles: text("secondaryMuscles", { mode: "json" }).$type<string[]>().notNull(),
  equipment: text("equipment", { mode: "json" }).$type<string[]>().notNull(),
  hypertrophyScore: real("hypertrophyScore"),
  strengthScore: real("strengthScore"),
  fatigueScore: real("fatigueScore"),
  stabilityDemand: real("stabilityDemand"),
  defaultRepMin: integer("defaultRepMin"),
  defaultRepMax: integer("defaultRepMax"),
  contraindicationTags: text("contraindicationTags", { mode: "json" }).$type<string[]>().notNull(),
  instructions: text("instructions"),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Versioned media (docs/ARCHITECTURE.md §8). Rows are never deleted on
 * replace — approving a new version archives the previous one instead, so
 * exercise identity and any historical reference to a specific asset id
 * survive a replacement (docs/IMPLEMENTATION_PLAN.md M2 exit criteria).
 * generationModel/provider are informational metadata the admin fills in
 * manually; nothing here calls a generation API (CLAUDE.md rule 7).
 */
export const exerciseAssets = sqliteTable(
  "exercise_asset",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    exerciseId: text("exerciseId")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["video", "thumbnail"] }).notNull(),
    provider: text("provider"),
    generationModel: text("generationModel"),
    objectKey: text("objectKey").notNull(),
    version: integer("version").notNull(),
    status: text("status", { enum: ["draft", "approved", "archived"] })
      .notNull()
      .default("draft"),
    validationNotes: text("validationNotes"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    // At most one published asset per exercise+type at any time — a real
    // DB-level guarantee, not just application discipline. The service
    // layer archives the previous approved row before approving a new one
    // in the same transaction, so this is never violated in practice.
    uniqueIndex("exercise_asset_one_approved_per_type")
      .on(table.exerciseId, table.type)
      .where(sql`${table.status} = 'approved'`),
  ],
);
