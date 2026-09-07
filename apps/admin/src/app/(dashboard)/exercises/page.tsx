import Link from "next/link";
import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";
import { Button } from "@mogd/ui";

export default async function AdminExercisesPage() {
  const rows = await exercises.listExercises(getDb());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Exercises</h1>
        <Link href="/exercises/new">
          <Button>New exercise</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No exercises yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-4">canonicalId</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Difficulty</th>
              <th className="py-2 pr-4">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((exercise) => (
              <tr key={exercise.id} className="border-t border-zinc-800">
                <td className="py-2 pr-4">
                  <Link href={`/exercises/${exercise.id}`} className="hover:underline">
                    {exercise.canonicalId}
                  </Link>
                </td>
                <td className="py-2 pr-4">{exercise.name}</td>
                <td className="py-2 pr-4">{exercise.difficulty}</td>
                <td className="py-2 pr-4">{exercise.isActive ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
