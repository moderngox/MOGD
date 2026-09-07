import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { programs } from "@mogd/domain";
import { Button } from "@mogd/ui";

function label(value: string): string {
  return value.replaceAll("_", " ");
}

export default async function ProgramPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const program = await programs.getCurrentProgram(getDb(), session.user.id);
  if (!program) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Your program</h1>
      <p className="text-sm text-zinc-500">
        {label(program.splitType)} · {program.sessionsPerWeek} sessions/week
      </p>

      <ul className="flex flex-col gap-3">
        {program.workouts.map((workout) => (
          <li key={workout.workoutId} className="rounded-md border border-zinc-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  Day {workout.dayIndex + 1}: {label(workout.sessionLabel)}
                </p>
                <p className="text-sm text-zinc-500">
                  {workout.exercises.length} exercises · ~{workout.estimatedDurationMinutes} min
                </p>
              </div>
              <Link href={`/session/${workout.workoutId}`}>
                <Button>Start</Button>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
