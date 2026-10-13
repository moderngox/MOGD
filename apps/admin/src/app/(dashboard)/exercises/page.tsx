import Link from "next/link";
import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";
import { Button } from "@mogd/ui";
import { ExercisesTable } from "./ExercisesTable";

export default async function AdminExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ profiles?: string }>;
}) {
  const db = getDb();
  const [exerciseRows, inherited] = await Promise.all([
    exercises.listExercises(db),
    exercises.listInheritedDefaultLevels(db),
  ]);
  const rows = exerciseRows.map((row) => ({
    id: row.id,
    canonicalId: row.canonicalId,
    name: row.name,
    difficulty: row.difficulty,
    isActive: row.isActive,
    inheritedLevels: inherited.get(row.id) ?? [],
  }));
  const { profiles } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-fg">Exercises</h1>
        <div className="flex items-center gap-2">
          <Link href="/exercises/restrictions">
            <Button variant="outline">Restrictions</Button>
          </Link>
          <Link href="/exercises/role-rules">
            <Button variant="outline">Role rules</Button>
          </Link>
          <Link href="/exercises/new">
            <Button>New exercise</Button>
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-alt p-6 text-center text-sm text-fg-secondary">
          No exercises yet.
        </p>
      ) : (
        <ExercisesTable rows={rows} initialProfiles={profiles === "default" ? "default" : "all"} />
      )}
    </div>
  );
}
