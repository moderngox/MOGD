import Link from "next/link";
import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";
import { Button } from "@mogd/ui";
import { ExercisesTable } from "./ExercisesTable";

export default async function AdminExercisesPage() {
  const rows = await exercises.listExercises(getDb());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-fg">Exercises</h1>
        <Link href="/exercises/new">
          <Button>New exercise</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-alt p-6 text-center text-sm text-fg-secondary">
          No exercises yet.
        </p>
      ) : (
        <ExercisesTable rows={rows} />
      )}
    </div>
  );
}
