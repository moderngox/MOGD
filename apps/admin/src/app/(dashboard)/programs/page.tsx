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
      <h1 className="text-2xl font-semibold">Programs</h1>
      <p className="text-zinc-400">
        Goal strategy, nutrition targets, workouts, validation results and adjustments.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No programs generated yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-4">User</th>
              <th className="py-2 pr-4">Split</th>
              <th className="py-2 pr-4">Sessions/week</th>
              <th className="py-2 pr-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((program) => (
              <tr key={program.programId} className="border-t border-zinc-800">
                <td className="py-2 pr-4">
                  <Link href={`/users/${program.userId}`} className="hover:underline">
                    {program.userEmail}
                  </Link>
                </td>
                <td className="py-2 pr-4">{label(program.splitType)}</td>
                <td className="py-2 pr-4">{program.sessionsPerWeek}</td>
                <td className="py-2 pr-4">
                  {new Date(program.createdAt).toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
