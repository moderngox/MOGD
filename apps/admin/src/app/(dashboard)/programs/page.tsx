import Link from "next/link";
import { getDb } from "@mogd/db";
import { programs } from "@mogd/domain";

function label(value: string): string {
  return value.replaceAll("_", " ");
}

export default async function AdminProgramsPage() {
  const rows = await programs.listPrograms(getDb());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-fg">Programs</h1>
        <p className="text-sm text-fg-secondary">
          Goal strategy, nutrition targets, workouts, validation results and adjustments.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-alt p-6 text-center text-sm text-fg-secondary">
          No programs generated yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                <th className="px-4 py-2.5 font-semibold">User</th>
                <th className="px-4 py-2.5 font-semibold">Split</th>
                <th className="px-4 py-2.5 font-semibold">Sessions/week</th>
                <th className="px-4 py-2.5 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((program) => (
                <tr key={program.programId} className="hover:bg-surface-elevated/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/users/${program.userId}`} className="font-medium text-fg hover:text-accent">
                      {program.userEmail}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-fg-secondary-alt">{label(program.splitType)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-fg-secondary-alt">{program.sessionsPerWeek}</td>
                  <td className="px-4 py-2.5 text-fg-secondary">
                    {new Date(program.createdAt).toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
