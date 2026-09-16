import { and, eq, inArray, or } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { createRelationshipInput } from "./schemas";
import type { CreateRelationshipInput } from "./schemas";
import type { RelationshipType } from "./options";

export class SelfReferentialRelationshipError extends Error {
  constructor() {
    super("An exercise cannot be related to itself");
    this.name = "SelfReferentialRelationshipError";
  }
}

export class DuplicateRelationshipError extends Error {
  constructor() {
    super("This relationship already exists");
    this.name = "DuplicateRelationshipError";
  }
}

export class ExerciseNotFoundError extends Error {
  constructor(id: string) {
    super(`No exercise with id "${id}"`);
    this.name = "ExerciseNotFoundError";
  }
}

export class RelationshipNotFoundError extends Error {
  constructor(id: string) {
    super(`No relationship with id "${id}"`);
    this.name = "RelationshipNotFoundError";
  }
}

/**
 * Normalizes a requested (exerciseId, relatedExerciseId, action) into the
 * canonical stored (source, target, type) triple. This is the only place
 * "regression" is translated into a swapped "progression" row, and the
 * only place symmetric types (variation/alternative) are canonically
 * ordered — docs/02_EXERCISE_RELATIONSHIPS_IMPLEMENTATION.md §2/§4.
 */
function normalize(
  exerciseId: string,
  relatedExerciseId: string,
  action: CreateRelationshipInput["action"],
): { sourceExerciseId: string; targetExerciseId: string; relationshipType: RelationshipType } {
  if (action === "progression") {
    return { sourceExerciseId: exerciseId, targetExerciseId: relatedExerciseId, relationshipType: "progression" };
  }
  if (action === "regression") {
    return { sourceExerciseId: relatedExerciseId, targetExerciseId: exerciseId, relationshipType: "progression" };
  }
  const [sourceExerciseId, targetExerciseId] =
    exerciseId < relatedExerciseId ? [exerciseId, relatedExerciseId] : [relatedExerciseId, exerciseId];
  return { sourceExerciseId, targetExerciseId, relationshipType: action };
}

export async function createExerciseRelationship(db: Database, rawInput: CreateRelationshipInput) {
  const input = createRelationshipInput.parse(rawInput);

  if (input.exerciseId === input.relatedExerciseId) {
    throw new SelfReferentialRelationshipError();
  }

  const exerciseRows = await db
    .select({ id: schema.exercises.id })
    .from(schema.exercises)
    .where(inArray(schema.exercises.id, [input.exerciseId, input.relatedExerciseId]));
  const foundIds = new Set(exerciseRows.map((row) => row.id));
  if (!foundIds.has(input.exerciseId)) throw new ExerciseNotFoundError(input.exerciseId);
  if (!foundIds.has(input.relatedExerciseId)) throw new ExerciseNotFoundError(input.relatedExerciseId);

  const { sourceExerciseId, targetExerciseId, relationshipType } = normalize(
    input.exerciseId,
    input.relatedExerciseId,
    input.action,
  );

  const [existing] = await db
    .select({ id: schema.exerciseRelationships.id })
    .from(schema.exerciseRelationships)
    .where(
      and(
        eq(schema.exerciseRelationships.sourceExerciseId, sourceExerciseId),
        eq(schema.exerciseRelationships.targetExerciseId, targetExerciseId),
        eq(schema.exerciseRelationships.relationshipType, relationshipType),
      ),
    );
  if (existing) throw new DuplicateRelationshipError();

  const [relationship] = await db
    .insert(schema.exerciseRelationships)
    .values({ sourceExerciseId, targetExerciseId, relationshipType })
    .returning();
  return relationship;
}

export async function deleteRelationship(db: Database, id: string): Promise<void> {
  const [existing] = await db
    .select({ id: schema.exerciseRelationships.id })
    .from(schema.exerciseRelationships)
    .where(eq(schema.exerciseRelationships.id, id));
  if (!existing) throw new RelationshipNotFoundError(id);

  await db.delete(schema.exerciseRelationships).where(eq(schema.exerciseRelationships.id, id));
}

export interface RelatedExercise {
  relationshipId: string;
  exercise: typeof schema.exercises.$inferSelect;
}

export interface ExerciseRelationshipsView {
  progressions: RelatedExercise[];
  regressions: RelatedExercise[];
  variations: RelatedExercise[];
  alternatives: RelatedExercise[];
}

/**
 * Every relationship touching exerciseId, resolved into a UI-shaped view.
 * "regressions" is derived here (incoming progression edges) — it is never
 * a stored relationshipType. One query for edges + one batched lookup for
 * the related exercise rows, no N+1.
 */
export async function getExerciseRelationships(
  db: Database,
  exerciseId: string,
): Promise<ExerciseRelationshipsView> {
  const edges = await db
    .select()
    .from(schema.exerciseRelationships)
    .where(
      or(
        eq(schema.exerciseRelationships.sourceExerciseId, exerciseId),
        eq(schema.exerciseRelationships.targetExerciseId, exerciseId),
      ),
    );

  const relatedIds = [
    ...new Set(
      edges.map((edge) => (edge.sourceExerciseId === exerciseId ? edge.targetExerciseId : edge.sourceExerciseId)),
    ),
  ];
  const relatedExercises = relatedIds.length
    ? await db.select().from(schema.exercises).where(inArray(schema.exercises.id, relatedIds))
    : [];
  const exerciseById = new Map(relatedExercises.map((exercise) => [exercise.id, exercise]));

  const view: ExerciseRelationshipsView = {
    progressions: [],
    regressions: [],
    variations: [],
    alternatives: [],
  };

  for (const edge of edges) {
    const isSource = edge.sourceExerciseId === exerciseId;
    const otherId = isSource ? edge.targetExerciseId : edge.sourceExerciseId;
    const exercise = exerciseById.get(otherId);
    if (!exercise) continue;
    const entry: RelatedExercise = { relationshipId: edge.id, exercise };

    if (edge.relationshipType === "progression") {
      (isSource ? view.progressions : view.regressions).push(entry);
    } else if (edge.relationshipType === "variation") {
      view.variations.push(entry);
    } else {
      view.alternatives.push(entry);
    }
  }

  return view;
}

/** Flattened union of every related exercise id — for relationship-aware scoring (see sessionAllocation.ts). */
export async function getRelatedExerciseIds(db: Database, exerciseId: string): Promise<Set<string>> {
  const view = await getExerciseRelationships(db, exerciseId);
  return new Set(
    [...view.progressions, ...view.regressions, ...view.variations, ...view.alternatives].map(
      (entry) => entry.exercise.id,
    ),
  );
}
