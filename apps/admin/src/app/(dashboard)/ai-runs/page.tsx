import { desc } from "drizzle-orm";
import { getDb, schema } from "@mogd/db";
import { Badge } from "@mogd/ui";

const STATUS_BADGE = {
  accepted: "positive",
  rejected: "warning",
  error: "warning",
} as const;

export default async function AdminAiRunsPage() {
  const runs = await getDb()
    .select()
    .from(schema.aiRuns)
    .orderBy(desc(schema.aiRuns.createdAt))
    .limit(50);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-fg">AI Runs</h1>
        <p className="text-sm text-fg-secondary">
          Every structured-generation call is logged here, including rejected and errored runs
          (docs/AI_AND_SAFETY.md &quot;AI run logging&quot;).
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-alt p-6 text-center text-sm text-fg-secondary">
          No AI runs recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                <th className="px-4 py-2.5 font-semibold">Purpose</th>
                <th className="px-4 py-2.5 font-semibold">Provider / model</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Latency</th>
                <th className="px-4 py-2.5 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-surface-elevated/40">
                  <td className="px-4 py-2.5 font-medium text-fg">{run.purpose}</td>
                  <td className="px-4 py-2.5 text-fg-secondary-alt">
                    {run.provider} / {run.model}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={STATUS_BADGE[run.validationStatus as keyof typeof STATUS_BADGE] ?? "neutral"}>
                      {run.validationStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-fg-secondary-alt">{run.latencyMs}ms</td>
                  <td className="px-4 py-2.5 text-fg-secondary">{new Date(run.createdAt).toISOString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
