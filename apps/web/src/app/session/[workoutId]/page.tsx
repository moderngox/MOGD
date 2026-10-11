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
  const userId = session.user.id;

  const db = getDb();

  // Authorization: a workout belongs to exactly one user via its program —
  // never trust that a workoutId from the URL belongs to this session.
  const ownerId = await programs.getWorkoutOwnerId(db, workoutId);
  if (ownerId !== userId) {
    notFound();
  }

  const workout = await programs.getWorkout(db, workoutId);
  if (!workout) {
    notFound();
  }

  const env = loadMediaEnv();

  // Read-only: opening the page never creates anything. The occurrence is
  // started by the first logged set (see logSetAction), and resumed here.
  const openSession = await progress.getInProgressSession(db, userId, workoutId);
  const summary = openSession ? await progress.getSessionSummary(db, userId, openSession.id) : null;
  const history = { excludeSessionId: openSession?.id };

  const exercises: SessionExerciseView[] = [];
  for (const exercise of workout.exercises) {
    const previous = await progress.getPreviousPerformance(db, userId, exercise.exerciseId, history);
    const performance = summary?.performances.find((p) => p.exerciseId === exercise.exerciseId) ?? null;

    // Once an exercise has been started, show the snapshot of what the athlete
    // was prescribed and told — not a fresh computation.
    const prescription = performance ?? exercise;
    const target = performance
      ? {
          targetLoadKg: performance.recommendedLoadKg,
          targetRepMin: performance.targetRepMin,
          targetRepMax: performance.targetRepMax,
          reason: performance.recommendationReason,
          message: performance.recommendationMessage,
          loadInstruction: performance.loadInstruction,
        }
      : await progress.getProgressionTargetForExercise(
          db,
          userId,
          exercise.exerciseId,
          {
            sets: exercise.sets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            rirMin: exercise.rirMin,
            rirMax: exercise.rirMax,
          },
          history,
        );

    exercises.push({
      workoutExerciseId: exercise.workoutExerciseId,
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      sets: prescription.sets,
      repMin: prescription.repMin,
      repMax: prescription.repMax,
      rirMin: prescription.rirMin,
      rirMax: prescription.rirMax,
      restSeconds: prescription.restSeconds,
      sessionRole: performance?.sessionRole ?? exercise.sessionRole,
      selectionReason: exercise.selectionReason,
      videoUrl:
        env && exercise.videoObjectKey
          ? `${env.R2_EXERCISE_MEDIA_PUBLIC_BASE_URL}/${exercise.videoObjectKey}`
          : null,
      previousPerformance: previous ? { loadKg: previous.loadKg, reps: previous.reps } : null,
      progressionTarget: target,
      performanceId: performance?.id ?? null,
      loggedSets: (performance?.loggedSets ?? []).map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        loadKg: s.loadKg,
        reps: s.reps,
      })),
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-8">
      <SessionExecution workoutId={workoutId} sessionId={openSession?.id ?? null} exercises={exercises} />
    </main>
  );
}
