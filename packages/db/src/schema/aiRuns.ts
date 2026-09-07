import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * One row per AI provider call. Foundation-only: no feature-specific
 * generation writes here yet (see docs/AI_AND_SAFETY.md "AI run logging").
 * Never store raw photos, unrestricted photo URLs or full sensitive prompts
 * here — inputHash/inputRef must be a reference, not the raw payload.
 */
export const aiRuns = sqliteTable("ai_run", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").references(() => users.id, { onDelete: "set null" }),
  purpose: text("purpose").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("promptVersion").notNull(),
  schemaVersion: text("schemaVersion").notNull(),
  inputHash: text("inputHash").notNull(),
  validatedOutput: text("validatedOutput", { mode: "json" }),
  validationStatus: text("validationStatus", {
    enum: ["accepted", "rejected", "error"],
  }).notNull(),
  errorClassification: text("errorClassification"),
  latencyMs: integer("latencyMs").notNull(),
  estimatedCostUsd: real("estimatedCostUsd"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
