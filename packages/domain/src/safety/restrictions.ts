import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { schema, type Database } from "@mogd/db";

/**
 * Structured restriction categories: the one reviewed vocabulary shared by what
 * an athlete reports and what an exercise is unsuitable for. The catalog is
 * EMPTY until an admin adds categories someone has reviewed - docs/AI_AND_SAFETY.md
 * says clinical categories must not be invented here - so with no categories
 * nothing is filtered, and nothing pretends to be.
 *
 * Keys are immutable and stored verbatim in exercise.contraindicationTags and
 * training_profile.restrictionKeys. Both write boundaries reject a key that is
 * not a category (never dropped or "fixed"), and a category that anything still
 * references cannot be deleted, so a stored key cannot quietly stop matching.
 */

export const restrictionKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers and underscores only");

export const restrictionLabelSchema = z.string().trim().min(1, "Enter a label").max(80);

export const createRestrictionCategoryInput = z.object({
  key: restrictionKeySchema,
  label: restrictionLabelSchema,
});
export type CreateRestrictionCategoryInput = z.infer<typeof createRestrictionCategoryInput>;

export type RestrictionCategory = typeof schema.restrictionCategories.$inferSelect;

export class DuplicateRestrictionKeyError extends Error {
  constructor(key: string) {
    super(`A restriction category with key "${key}" already exists`);
    this.name = "DuplicateRestrictionKeyError";
  }
}

export class RestrictionNotFoundError extends Error {
  constructor(id: string) {
    super(`Restriction category ${id} not found`);
    this.name = "RestrictionNotFoundError";
  }
}

export class RestrictionInUseError extends Error {
  constructor(
    public readonly key: string,
    public readonly exerciseCount: number,
    public readonly athleteCount: number,
  ) {
    super(
      `Restriction "${key}" is still used by ${exerciseCount} exercise(s) and ${athleteCount} athlete(s); remove it from them before deleting`,
    );
    this.name = "RestrictionInUseError";
  }
}

export class UnknownRestrictionError extends Error {
  constructor(public readonly keys: string[]) {
    super(`Unknown restriction categories: ${keys.join(", ")}`);
    this.name = "UnknownRestrictionError";
  }
}

export async function listRestrictionCategories(db: Database): Promise<RestrictionCategory[]> {
  return db.select().from(schema.restrictionCategories).orderBy(asc(schema.restrictionCategories.label));
}

export async function createRestrictionCategory(
  db: Database,
  rawInput: CreateRestrictionCategoryInput,
): Promise<RestrictionCategory> {
  const input = createRestrictionCategoryInput.parse(rawInput);
  const [existing] = await db
    .select({ id: schema.restrictionCategories.id })
    .from(schema.restrictionCategories)
    .where(eq(schema.restrictionCategories.key, input.key));
  if (existing) throw new DuplicateRestrictionKeyError(input.key);

  const [created] = await db.insert(schema.restrictionCategories).values(input).returning();
  return created!;
}

/** Only the label can change: the key is what exercises and athletes store. */
export async function renameRestrictionCategory(db: Database, id: string, rawLabel: string): Promise<RestrictionCategory> {
  const label = restrictionLabelSchema.parse(rawLabel);
  const [updated] = await db
    .update(schema.restrictionCategories)
    .set({ label })
    .where(eq(schema.restrictionCategories.id, id))
    .returning();
  if (!updated) throw new RestrictionNotFoundError(id);
  return updated;
}

/** How many exercises and athletes currently store this key. */
export async function getRestrictionUsage(
  db: Database,
  key: string,
): Promise<{ exerciseCount: number; athleteCount: number }> {
  const [exercises] = await db.all<{ n: number }>(
    sql`select count(distinct e.id) as n from exercise e, json_each(e.contraindicationTags) j where j.value = ${key}`,
  );
  const [athletes] = await db.all<{ n: number }>(
    sql`select count(distinct t.id) as n from training_profile t, json_each(t.restrictionKeys) j where j.value = ${key}`,
  );
  return { exerciseCount: Number(exercises?.n ?? 0), athleteCount: Number(athletes?.n ?? 0) };
}

export async function deleteRestrictionCategory(db: Database, id: string): Promise<void> {
  const [category] = await db
    .select()
    .from(schema.restrictionCategories)
    .where(eq(schema.restrictionCategories.id, id));
  if (!category) throw new RestrictionNotFoundError(id);

  const usage = await getRestrictionUsage(db, category.key);
  if (usage.exerciseCount > 0 || usage.athleteCount > 0) {
    throw new RestrictionInUseError(category.key, usage.exerciseCount, usage.athleteCount);
  }
  await db.delete(schema.restrictionCategories).where(eq(schema.restrictionCategories.id, id));
}

/** The write-boundary check: every key must be a category. Throws; never filters the list. */
export async function assertKnownRestrictionKeys(db: Database, keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  const known = new Set((await db.select({ key: schema.restrictionCategories.key }).from(schema.restrictionCategories)).map((r) => r.key));
  const unknown = [...new Set(keys.filter((key) => !known.has(key)))];
  if (unknown.length > 0) throw new UnknownRestrictionError(unknown);
}

/** The categories an exercise is unsuitable for that the athlete has reported; empty = compatible. */
export function conflictingRestrictions(exerciseTags: readonly string[], athleteKeys: readonly string[]): string[] {
  const reported = new Set(athleteKeys);
  return [...new Set(exerciseTags.filter((tag) => reported.has(tag)))];
}
