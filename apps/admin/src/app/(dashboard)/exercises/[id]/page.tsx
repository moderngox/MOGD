import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";
import { ExerciseForm } from "../ExerciseForm";

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercise = await exercises.getExerciseById(getDb(), id);
  if (!exercise) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{exercise.name}</h1>
        <Link href={`/media?exerciseId=${exercise.id}`} className="text-sm text-zinc-400 hover:underline">
          Manage media →
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
        }}
      />
    </div>
  );
}
