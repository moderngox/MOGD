import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * A place the athlete trains (a gym, "home") — the smallest real notion of
 * equipment context (mogd_programming_engine_specs 03/04: two cable machines
 * can show the same stack kg yet differ, so history must not be carried
 * across equipment). Per-machine identity is deliberately out of scope.
 * No delete in v1: a location disappearing would silently merge its history
 * into the "unspecified" context.
 */
export const trainingLocations = sqliteTable(
  "training_location",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("training_location_user_name").on(table.userId, table.name)],
);
