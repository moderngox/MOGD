import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment, nutrition } from "@mogd/domain";
import { Button } from "@mogd/ui";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const db = getDb();
  const summary = await assessment.getUserAssessment(db, session.user.id);
  if (!summary) {
    redirect("/assessment");
  }

  const strategy = await nutrition.getGoalStrategy(db, session.user.id);
  const target = await nutrition.getNutritionTarget(db, session.user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-zinc-400">Signed in as {session.user.email}.</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Primary objective</dt>
        <dd className="text-zinc-100">{summary.primaryGoal.replaceAll("_", " ")}</dd>

        <dt className="text-zinc-500">Physique priorities</dt>
        <dd className="text-zinc-100">
          {(strategy?.priorityMuscles ?? summary.physiquePriorities)
            .map((p) => p.replaceAll("_", " "))
            .join(", ") || "balanced"}
        </dd>

        <dt className="text-zinc-500">Training</dt>
        <dd className="text-zinc-100">
          {summary.sessionsPerWeek} sessions/week · {summary.sessionDurationMinutes} min
        </dd>

        {target ? (
          <>
            <dt className="text-zinc-500">Nutrition</dt>
            <dd className="text-zinc-100">{Math.round(target.energyKcal)} kcal/day</dd>

            <dt className="text-zinc-500">Protein</dt>
            <dd className="text-zinc-100">{Math.round(target.proteinG)} g/day</dd>

            <dt className="text-zinc-500">Fat</dt>
            <dd className="text-zinc-100">{Math.round(target.fatG)} g/day</dd>

            <dt className="text-zinc-500">Carbs</dt>
            <dd className="text-zinc-100">{Math.round(target.carbG)} g/day</dd>
          </>
        ) : (
          <>
            <dt className="text-zinc-500">Nutrition</dt>
            <dd className="text-zinc-500">Not available yet</dd>
          </>
        )}

        <dt className="text-zinc-500">Weight</dt>
        <dd className="text-zinc-100">{summary.weightKg} kg</dd>

        <dt className="text-zinc-500">Waist</dt>
        <dd className="text-zinc-100">{summary.waistCm} cm</dd>
      </dl>

      <p className="text-sm text-zinc-500">
        Weekly workouts and adaptation land in later milestones.
      </p>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button variant="secondary" type="submit">
          Sign out
        </Button>
      </form>
    </main>
  );
}
