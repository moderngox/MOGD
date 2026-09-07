import Link from "next/link";
import { getDb } from "@mogd/db";
import { users } from "@mogd/domain";

export default async function AdminUsersPage() {
  const rows = await users.listUsers(getDb());

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-zinc-400">
        Read-only inspection of profiles, assessments, strategy, programs, measurements and
        check-ins.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No users yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-t border-zinc-800">
                <td className="py-2 pr-4">
                  <Link href={`/users/${user.id}`} className="hover:underline">
                    {user.email}
                  </Link>
                </td>
                <td className="py-2 pr-4">{user.role}</td>
                <td className="py-2 pr-4">{new Date(user.createdAt).toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
