import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * Append-only log of the session-role engine's tunable numbers
 * (docs/MOGD_06-session-role-architecture.md §2: "keep them configurable").
 * The current rules are the latest revision; history and rollback come from
 * the log itself, so there is no mutable "current" row to drift. No rows
 * means the built-in defaults in packages/domain. `rules` is JSON validated by
 * packages/domain's roleRulesSchema on every write and every read.
 */
export const roleRulesRevisions = sqliteTable("role_rules_revision", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdByUserId: text("createdByUserId").references(() => users.id, { onDelete: "set null" }),
  note: text("note"),
  rules: text("rules", { mode: "json" }).$type<unknown>().notNull(),
});
