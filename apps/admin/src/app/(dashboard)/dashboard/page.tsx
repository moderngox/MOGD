import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";

export default async function AdminDashboardPage() {
  const stats = await exercises.getCatalogStats(getDb());

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <dl className="grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Exercises</dt>
        <dd className="text-zinc-100">{stats.totalExercises}</dd>

        <dt className="text-zinc-500">Active</dt>
        <dd className="text-zinc-100">{stats.activeExercises}</dd>

        <dt className="text-zinc-500">Missing published video</dt>
        <dd className={stats.missingVideoCount > 0 ? "text-yellow-400" : "text-zinc-100"}>
          {stats.missingVideoCount}
        </dd>
      </dl>

      <p className="text-sm text-zinc-500">
        Users, active programs and AI failures land here in later milestones
        (docs/ARCHITECTURE.md §20).
      </p>
    </div>
  );
}
