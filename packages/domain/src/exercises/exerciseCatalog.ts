import { eq, desc } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { createExerciseInput, updateExerciseInput } from "./schemas";
import type { CreateExerciseInput, UpdateExerciseInput } from "./schemas";

export class DuplicateCanonicalIdError extends Error {
  constructor(canonicalId: string) {
    super(`An exercise with canonicalId "${canonicalId}" already exists`);
    this.name = "DuplicateCanonicalIdError";
  }
}

export async function createExercise(db: Database, rawInput: CreateExerciseInput) {
  const input = createExerciseInput.parse(rawInput);

  const [existing] = await db
    .select({ id: schema.exercises.id })
    .from(schema.exercises)
    .where(eq(schema.exercises.canonicalId, input.canonicalId));
  if (existing) {
    throw new DuplicateCanonicalIdError(input.canonicalId);
  }

  const [exercise] = await db.insert(schema.exercises).values(input).returning();
  return exercise;
}

/** canonicalId is immutable — this never accepts or touches it. */
export async function updateExercise(db: Database, id: string, rawInput: UpdateExerciseInput) {
  const input = updateExerciseInput.parse(rawInput);

  const [exercise] = await db
    .update(schema.exercises)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.exercises.id, id))
    .returning();
  return exercise ?? null;
}

export async function setExerciseActive(db: Database, id: string, isActive: boolean) {
  const [exercise] = await db
    .update(schema.exercises)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(schema.exercises.id, id))
    .returning();
  return exercise ?? null;
}

export async function getExerciseById(db: Database, id: string) {
  const [exercise] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, id));
  return exercise ?? null;
}

/**
 * The lookup generated plans must use (CLAUDE.md rule 6: "Generated plans
 * must resolve active catalog records"). Returns null for both "doesn't
 * exist" and "exists but inactive" — callers should treat both the same:
 * this canonicalId cannot be used in a plan right now.
 */
export async function resolveActiveExercise(db: Database, canonicalId: string) {
  const [exercise] = await db
    .select()
    .from(schema.exercises)
    .where(eq(schema.exercises.canonicalId, canonicalId));
  if (!exercise || !exercise.isActive) return null;
  return exercise;
}

export async function listExercises(db: Database, options: { activeOnly?: boolean } = {}) {
  const rows = await db
    .select()
    .from(schema.exercises)
    .orderBy(desc(schema.exercises.createdAt));
  return options.activeOnly ? rows.filter((row) => row.isActive) : rows;
}
