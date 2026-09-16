import { sqliteTable, text, integer, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { exercises } from "./exercises";

/**
 * Curated exercise-to-exercise relationship graph (docs/01_EXERCISE_RELATIONSHIPS_ARCHITECTURE.md,
 * docs/02_EXERCISE_RELATIONSHIPS_IMPLEMENTATION.md). Only "progression",
 * "variation" and "alternative" are ever persisted — "regression" is
 * derived at read time as the inverse of a "progression" row (prefer a
 * single source of truth over syncing bidirectional rows, per doc 02 §2).
 * The domain layer (packages/domain/src/exercises/relationships.ts) is
 * responsible for canonicalizing symmetric (variation/alternative) pairs
 * to a consistent source/target ordering before insert — this table's
 * unique index alone cannot catch a reversed duplicate pair.
 */
export const exerciseRelationships = sqliteTable(
  "exercise_relationship",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceExerciseId: text("sourceExerciseId")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    targetExerciseId: text("targetExerciseId")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    relationshipType: text("relationshipType", {
      enum: ["progression", "variation", "alternative"],
    }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("exercise_relationship_unique_edge").on(
      table.sourceExerciseId,
      table.targetExerciseId,
      table.relationshipType,
    ),
    check(
      "exercise_relationship_no_self",
      sql`${table.sourceExerciseId} != ${table.targetExerciseId}`,
    ),
    index("exercise_relationship_source_idx").on(table.sourceExerciseId),
    index("exercise_relationship_target_idx").on(table.targetExerciseId),
  ],
);
