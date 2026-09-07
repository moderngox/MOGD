import { desc } from "drizzle-orm";
import { getDb, schema } from "@mogd/db";

export default async function AdminAiRunsPage() {
  const runs = await getDb()
    .select()
    .from(schema.aiRuns)
    .orderBy(desc(schema.aiRuns.createdAt))
    .limit(50);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">AI Runs</h1>
      <p className="text-zinc-400">
        Every structured-generation call is logged here, including rejected
        and errored runs (docs/AI_AND_SAFETY.md "AI run logging"). No
        feature-specific generation exists yet in M0, so this list is
        expected to be empty until M6.
      </p>
      {runs.length === 0 ? (
        <p className="text-sm text-zinc-500">No AI runs recorded yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-4">Purpose</th>
              <th className="py-2 pr-4">Provider / model</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Latency</th>
              <th className="py-2 pr-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t border-zinc-800">
                <td className="py-2 pr-4">{run.purpose}</td>
                <td className="py-2 pr-4">
                  {run.provider} / {run.model}
                </td>
                <td className="py-2 pr-4">{run.validationStatus}</td>
                <td className="py-2 pr-4">{run.latencyMs}ms</td>
                <td className="py-2 pr-4">
                  {new Date(run.createdAt).toISOString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
