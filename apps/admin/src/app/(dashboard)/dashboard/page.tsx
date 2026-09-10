import Link from "next/link";
import { count, eq, or, desc } from "drizzle-orm";
import { getDb, schema } from "@mogd/db";
import { exercises } from "@mogd/domain";
import { BigStat, Card } from "@mogd/ui";

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
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-semibold text-fg">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="People">
          <div className="grid grid-cols-2 gap-4">
            <BigStat label="Users" value={userCount!.value} />
            <BigStat label="Active programs" value={programCount!.value} />
          </div>
        </Card>

        <Card title="Exercise catalog" eyebrow={<Link href="/exercises" className="hover:text-accent">View all →</Link>}>
          <div className="grid grid-cols-2 gap-4">
            <BigStat label="Total" value={stats.totalExercises} />
            <BigStat label="Active" value={stats.activeExercises} />
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm text-fg-secondary-alt">Missing published video</span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                stats.missingVideoCount > 0 ? "text-status-caution" : "text-fg"
              }`}
            >
              {stats.missingVideoCount}
            </span>
          </div>
        </Card>

        <Card title="AI health" eyebrow={<Link href="/ai-runs" className="hover:text-accent">View all →</Link>}>
          <BigStat label="Rejected / errored runs" value={aiFailureCount!.value} />
        </Card>
      </div>

      {recentFailures.length > 0 && (
        <Card title="Recent AI failures">
          <ul className="flex flex-col divide-y divide-border">
            {recentFailures.map((run) => (
              <li key={run.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-fg">
                  {run.purpose} <span className="text-fg-secondary">· {run.validationStatus}</span>
                  {run.errorClassification ? (
                    <span className="text-fg-secondary"> ({run.errorClassification})</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-fg-muted">{new Date(run.createdAt).toISOString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
