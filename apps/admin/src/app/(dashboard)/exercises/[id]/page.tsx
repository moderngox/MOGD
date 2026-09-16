import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";
import { Badge, Button } from "@mogd/ui";
import { ExerciseForm } from "../ExerciseForm";
import { RelationshipsSection } from "./RelationshipsSection";

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const exercise = await exercises.getExerciseById(db, id);
  if (!exercise) notFound();

  const [relationships, allExercises] = await Promise.all([
    exercises.getExerciseRelationships(db, id),
    exercises.listExercises(db),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-semibold text-fg">{exercise.name}</h1>
          <Badge variant={exercise.isActive ? "positive" : "neutral"}>
            {exercise.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <Link href={`/media?exerciseId=${exercise.id}`}>
          <Button variant="outline">Manage media →</Button>
        </Link>
      </div>
      <ExerciseForm
        exerciseId={exercise.id}
        initial={{
          canonicalId: exercise.canonicalId,
          name: exercise.name,
          movementPattern: exercise.movementPattern,
          difficulty: exercise.difficulty,
          primaryMuscles: exercise.primaryMuscles,
          secondaryMuscles: exercise.secondaryMuscles,
          equipment: exercise.equipment,
          hypertrophyScore: exercise.hypertrophyScore ?? undefined,
          strengthScore: exercise.strengthScore ?? undefined,
          fatigueScore: exercise.fatigueScore ?? undefined,
          stabilityDemand: exercise.stabilityDemand ?? undefined,
          defaultRepMin: exercise.defaultRepMin ?? undefined,
          defaultRepMax: exercise.defaultRepMax ?? undefined,
          contraindicationTags: exercise.contraindicationTags,
          instructions: exercise.instructions ?? undefined,
          isActive: exercise.isActive,
          allowedSessionRoles: exercise.allowedSessionRoles,
          preferredSessionRole: exercise.preferredSessionRole ?? undefined,
        }}
      />
      <RelationshipsSection
        exerciseId={exercise.id}
        relationships={relationships}
        allExercises={allExercises.map((e) => ({ id: e.id, name: e.name, canonicalId: e.canonicalId }))}
      />
    </div>
  );
}
