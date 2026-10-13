import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { exercises, progress } from "@mogd/domain";
import { SessionSummaryView, type SummaryPerformanceView } from "./SessionSummaryView";

export default async function SessionSummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const db = getDb();

  // Ownership is enforced inside the domain call: another user's session is "not found".
  let summary: progress.SessionSummary;
  try {
    summary = await progress.getSessionSummary(db, session.user.id, sessionId);
  } catch (error) {
    if (error instanceof progress.SessionNotFoundError) notFound();
    throw error;
  }

  const performances: SummaryPerformanceView[] = [];
  for (const performance of summary.performances) {
    const exercise = await exercises.getExerciseById(db, performance.exerciseId);
    performances.push({
      id: performance.id,
      name: exercise?.name ?? "Exercise",
      loadType: exercise?.loadType ?? "external",
      sets: performance.sets,
      repMin: performance.repMin,
      repMax: performance.repMax,
      rirMin: performance.rirMin,
      rirMax: performance.rirMax,
      loggedSets: performance.loggedSets.map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        loadKg: s.loadKg,
        reps: s.reps,
        rir: s.rir,
        painFlag: s.painFlag,
        techniqueValid: s.techniqueValid,
      })),
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-8">
      <SessionSummaryView
        sessionLabel={summary.session.sessionLabel}
        finished={summary.session.status === "completed"}
        performances={performances}
      />
    </main>
  );
}
