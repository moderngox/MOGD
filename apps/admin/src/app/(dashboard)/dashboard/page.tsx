import { count, eq, or, desc } from "drizzle-orm";
import { getDb, schema } from "@mogd/db";
import { exercises } from "@mogd/domain";

export default async function AdminDashboardPage() {
  const db = getDb();
  const stats = await exercises.getCatalogStats(db);

  const [[userCount], [programCount], [aiFailureCount], recentFailures] = await Promise.all([
    db.select({ value: count() }).from(schema.users),
    db.select({ value: count() }).from(schema.programs),
    db
      .select({ value: count() })
      .from(schema.aiRuns)
      .where(or(eq(schema.aiRuns.validationStatus, "rejected"), eq(schema.aiRuns.validationStatus, "error"))),
    db
      .select()
      .from(schema.aiRuns)
      .where(or(eq(schema.aiRuns.validationStatus, "rejected"), eq(schema.aiRuns.validationStatus, "error")))
      .orderBy(desc(schema.aiRuns.createdAt))
      .limit(5),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <dl className="grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Users</dt>
        <dd className="text-zinc-100">{userCount!.value}</dd>

        <dt className="text-zinc-500">Active programs</dt>
        <dd className="text-zinc-100">{programCount!.value}</dd>

        <dt className="text-zinc-500">Exercises</dt>
        <dd className="text-zinc-100">{stats.totalExercises}</dd>

        <dt className="text-zinc-500">Active</dt>
        <dd className="text-zinc-100">{stats.activeExercises}</dd>

        <dt className="text-zinc-500">Missing published video</dt>
        <dd className={stats.missingVideoCount > 0 ? "text-yellow-400" : "text-zinc-100"}>
          {stats.missingVideoCount}
        </dd>

        <dt className="text-zinc-500">AI failures</dt>
        <dd className={aiFailureCount!.value > 0 ? "text-yellow-400" : "text-zinc-100"}>
          {aiFailureCount!.value}
        </dd>
      </dl>

      {recentFailures.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Recent AI failures</h2>
          <ul className="text-sm text-zinc-400">
            {recentFailures.map((run) => (
              <li key={run.id}>
                {new Date(run.createdAt).toISOString()} · {run.purpose} · {run.validationStatus}
                {run.errorClassification ? ` (${run.errorClassification})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
