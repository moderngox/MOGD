import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment } from "@mogd/domain";
import { Button } from "@mogd/ui";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const summary = await assessment.getUserAssessment(getDb(), session.user.id);
  if (!summary) {
    redirect("/assessment");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-zinc-400">Signed in as {session.user.email}.</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Primary objective</dt>
        <dd className="text-zinc-100">{summary.primaryGoal.replaceAll("_", " ")}</dd>

        <dt className="text-zinc-500">Physique priorities</dt>
        <dd className="text-zinc-100">
          {summary.physiquePriorities.map((p) => p.replaceAll("_", " ")).join(", ")}
        </dd>

        <dt className="text-zinc-500">Training</dt>
        <dd className="text-zinc-100">
          {summary.sessionsPerWeek} sessions/week · {summary.sessionDurationMinutes} min
        </dd>

        <dt className="text-zinc-500">Nutrition</dt>
        <dd className="text-zinc-100">
          {summary.mealsPerDay} meals/day · {summary.dietaryPreference.replaceAll("_", " ")}
        </dd>

        <dt className="text-zinc-500">Weight</dt>
        <dd className="text-zinc-100">{summary.weightKg} kg</dd>

        <dt className="text-zinc-500">Waist</dt>
        <dd className="text-zinc-100">{summary.waistCm} cm</dd>
      </dl>

      <p className="text-sm text-zinc-500">
        Calorie/macro targets, weekly workouts and adaptation land in later milestones.
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
