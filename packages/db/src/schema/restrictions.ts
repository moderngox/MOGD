import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * The reviewed vocabulary that connects what an athlete reports ("I can't
 * load my knees") to what an exercise is unsuitable for. It ships EMPTY on
 * purpose: docs/AI_AND_SAFETY.md forbids inventing clinical categories, so
 * nothing is matched until an admin adds categories someone has reviewed.
 * `key` is the stable value stored in exercise.contraindicationTags and
 * training_profile.restrictionKeys and never changes; only `label` may.
 * A category in use is never deleted, so a stored key can't silently stop
 * matching.
 */
export const restrictionCategories = sqliteTable("restriction_category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
