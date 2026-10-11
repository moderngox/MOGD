import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { schema, type Database } from "@mogd/db";

export type TrainingLocation = typeof schema.trainingLocations.$inferSelect;

export class DuplicateLocationError extends Error {
  constructor(name: string) {
    super(`You already have a training location called "${name}"`);
    this.name = "DuplicateLocationError";
  }
}

export class LocationNotFoundError extends Error {
  constructor() {
    super("No such training location for this user");
    this.name = "LocationNotFoundError";
  }
}

export const locationNameSchema = z.string().trim().min(1).max(60);

export async function listLocations(db: Database, userId: string): Promise<TrainingLocation[]> {
  const rows = await db.select().from(schema.trainingLocations).where(eq(schema.trainingLocations.userId, userId));
  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name));
}

/**
 * Creates a named place. The user's FIRST location adopts every session they
 * have already logged without one — the explicit assumption "everything so far
 * happened here" — so naming a place never wipes their history. Later
 * locations start empty.
 */
export async function createLocation(db: Database, userId: string, rawName: string): Promise<TrainingLocation> {
  const name = locationNameSchema.parse(rawName);

  const existing = await listLocations(db, userId);
  if (existing.some((l) => l.name.toLowerCase() === name.toLowerCase())) throw new DuplicateLocationError(name);

  return db.transaction(async (tx) => {
    const [created] = await tx.insert(schema.trainingLocations).values({ userId, name }).returning();
    if (existing.length === 0) {
      await tx
        .update(schema.workoutSessions)
        .set({ trainingLocationId: created!.id })
        .where(and(eq(schema.workoutSessions.userId, userId), isNull(schema.workoutSessions.trainingLocationId)));
    }
    return created!;
  });
}

/** Throws unless the location exists and belongs to this user. */
export async function getOwnedLocation(db: Database, userId: string, locationId: string): Promise<TrainingLocation> {
  const [location] = await db
    .select()
    .from(schema.trainingLocations)
    .where(and(eq(schema.trainingLocations.id, locationId), eq(schema.trainingLocations.userId, userId)));
  if (!location) throw new LocationNotFoundError();
  return location;
}

/** Where the athlete trained last (null when never, or when they never named a place). */
export async function getDefaultLocationId(db: Database, userId: string): Promise<string | null> {
  const [latest] = await db
    .select({ trainingLocationId: schema.workoutSessions.trainingLocationId })
    .from(schema.workoutSessions)
    .where(eq(schema.workoutSessions.userId, userId))
    .orderBy(desc(schema.workoutSessions.startedAt))
    .limit(1);
  return latest?.trainingLocationId ?? null;
}
