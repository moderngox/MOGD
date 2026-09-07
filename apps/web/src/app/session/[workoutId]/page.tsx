import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { programs, progress } from "@mogd/domain";
import { loadMediaEnv } from "@mogd/media";
import { SessionExecution, type SessionExerciseView } from "./SessionExecution";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ workoutId: string }>;
}) {
  const { workoutId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const db = getDb();

  // Authorization: a workout belongs to exactly one user via its program —
  // never trust that a workoutId from the URL belongs to this session.
  const ownerId = await programs.getWorkoutOwnerId(db, workoutId);
  if (ownerId !== session.user.id) {
    notFound();
  }

  const workout = await programs.getWorkout(db, workoutId);
  if (!workout) {
    notFound();
  }

  const env = loadMediaEnv();

  const exercises: SessionExerciseView[] = [];
  for (const exercise of workout.exercises) {
    const previous = await progress.getPreviousPerformance(db, session.user.id, exercise.exerciseId);
    const target = await progress.getProgressionTargetForExercise(
      db,
      session.user.id,
      exercise.exerciseId,
      exercise.repMin,
      exercise.repMax,
    );

    exercises.push({
      workoutExerciseId: exercise.workoutExerciseId,
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      sets: exercise.sets,
      repMin: exercise.repMin,
      repMax: exercise.repMax,
      rir: exercise.rir,
      restSeconds: exercise.restSeconds,
      videoUrl:
        env && exercise.videoObjectKey
          ? `${env.R2_EXERCISE_MEDIA_PUBLIC_BASE_URL}/${exercise.videoObjectKey}`
          : null,
      previousPerformance: previous
        ? { loadKg: previous.loadKg, reps: previous.reps }
        : null,
      progressionTarget: {
        targetLoadKg: target.targetLoadKg,
        targetRepMin: target.targetRepMin,
        targetRepMax: target.targetRepMax,
        reason: target.reason,
      },
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-8">
      <SessionExecution workoutId={workoutId} exercises={exercises} />
    </main>
  );
}
