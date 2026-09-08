import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * One row per user (upserted on each submission — M1 does a single-flow
 * assessment, not per-step persistence or history). An ineligible
 * submission (see @mogd/domain's checkEligibility) is never persisted here
 * at all: rejecting before writing anything avoids retaining profile data
 * for a user MOGᴰ cannot serve.
 */
export const assessments = sqliteTable("assessment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["completed"] }).notNull(),
  optionalNote: text("optionalNote"),
  completedAt: integer("completedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const physiqueGoals = sqliteTable("physique_goal", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  primaryGoal: text("primaryGoal").notNull(),
  // Raw UI-level selection (docs/PRODUCT.md §5), e.g. ["shoulders","abs"].
  // Compiling this into canonical muscle priorities is M3 scope.
  physiquePriorities: text("physiquePriorities", { mode: "json" }).$type<string[]>().notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const bodyMeasurements = sqliteTable("body_measurement", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  sex: text("sex", { enum: ["male", "female"] }).notNull(),
  age: integer("age").notNull(),
  heightCm: real("heightCm").notNull(),
  weightKg: real("weightKg").notNull(),
  waistCm: real("waistCm").notNull(),
  targetWeightKg: real("targetWeightKg"),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const trainingProfiles = sqliteTable("training_profile", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  experienceLevel: text("experienceLevel").notNull(),
  trainingConsistency: text("trainingConsistency").notNull(),
  currentActivityLevel: text("currentActivityLevel").notNull(),
  trainingHistoryNotes: text("trainingHistoryNotes"),
  limitations: text("limitations"),
  injuryRestrictions: text("injuryRestrictions"),
  sessionsPerWeek: integer("sessionsPerWeek").notNull(),
  sessionDurationMinutes: integer("sessionDurationMinutes").notNull(),
  trainingContext: text("trainingContext", { mode: "json" }).$type<string[]>().notNull(),
  equipment: text("equipment", { mode: "json" }).$type<string[]>().notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const nutritionProfiles = sqliteTable("nutrition_profile", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  dietaryPreference: text("dietaryPreference").notNull(),
  allergies: text("allergies"),
  mealsPerDay: integer("mealsPerDay").notNull(),
  cookingPreference: text("cookingPreference").notNull(),
  dislikedFoods: text("dislikedFoods"),
  willingToTrackCalories: integer("willingToTrackCalories", { mode: "boolean" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * One row per user — the in-progress wizard state (docs/PRODUCT.md §6),
 * saved on each step transition so a user who leaves mid-assessment resumes
 * where they stopped instead of restarting. Deleted once submitAssessment
 * succeeds (`assessments` becomes the durable record from then on); never
 * holds photos, since File objects can't survive a session (see
 * AssessmentWizard's photos-step handling).
 */
export const assessmentDrafts = sqliteTable("assessment_draft", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  step: integer("step").notNull(),
  formState: text("formState", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Private only — object keys point into the private-photos R2 bucket
 * (@mogd/media), never the public exercise-media bucket
 * (docs/ARCHITECTURE.md §9). One row per user per angle, replaced on
 * re-upload rather than accumulating history.
 */
export const assessmentPhotos = sqliteTable(
  "assessment_photo",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    angle: text("angle", { enum: ["front", "side"] }).notNull(),
    objectKey: text("objectKey").notNull(),
    consentGrantedAt: integer("consentGrantedAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("assessment_photo_user_angle_idx").on(table.userId, table.angle)],
);
