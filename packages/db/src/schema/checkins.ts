import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * Weekly check-in (docs/ARCHITECTURE.md §17, docs/PRODUCT.md §12). This
 * table doubles as the weight/waist history — there is no separate
 * measurements-over-time table; each check-in IS one dated reading.
 * trainingAdherencePercent is computed from actual exercise_logs, not
 * self-reported (docs/CLAUDE.md rule 4-adjacent: prefer real persisted
 * data over self-report where we have it). nutritionAdherencePercent is
 * self-reported since there is no food-logging system to derive it from
 * (docs/PRODUCT.md §11: no complete food database in Alpha).
 */
export const checkins = sqliteTable("checkin", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  averageWeightKg: real("averageWeightKg").notNull(),
  waistCm: real("waistCm").notNull(),
  trainingAdherencePercent: integer("trainingAdherencePercent").notNull(),
  nutritionAdherencePercent: integer("nutritionAdherencePercent").notNull(),
  hunger: integer("hunger").notNull(),
  energy: integer("energy").notNull(),
  recovery: integer("recovery").notNull(),
  performanceNote: text("performanceNote"),
  note: text("note"),
  completedAt: integer("completedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Private only — same bucket/discipline as assessment photos (M1). One row
 * per check-in per angle.
 */
export const progressPhotos = sqliteTable(
  "progress_photo",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkinId: text("checkinId")
      .notNull()
      .references(() => checkins.id, { onDelete: "cascade" }),
    angle: text("angle", { enum: ["front", "side"] }).notNull(),
    objectKey: text("objectKey").notNull(),
    consentGrantedAt: integer("consentGrantedAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("progress_photo_checkin_angle_idx").on(table.checkinId, table.angle)],
);

/**
 * One row per check-in, always — including "hold"/"address_adherence"/
 * "insufficient_data" decisions and rejected adjustment attempts
 * (docs/ARCHITECTURE.md §18/§21: "Persist plan adjustments and reasons";
 * "A failed generation must not replace a valid current plan"). decisionType
 * is *why*; outcome is *what actually happened to the plan*.
 */
export const planAdjustments = sqliteTable("plan_adjustment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  checkinId: text("checkinId")
    .notNull()
    .references(() => checkins.id, { onDelete: "cascade" }),
  decisionType: text("decisionType", {
    enum: ["insufficient_data", "hold", "adjust_calories", "address_adherence"],
  }).notNull(),
  outcome: text("outcome", { enum: ["not_attempted", "applied", "rejected"] }).notNull(),
  previousEnergyKcal: real("previousEnergyKcal"),
  newEnergyKcal: real("newEnergyKcal"),
  reason: text("reason").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
