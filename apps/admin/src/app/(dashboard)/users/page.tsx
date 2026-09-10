import { getDb } from "@mogd/db";
import { users } from "@mogd/domain";
import { UsersTable } from "./UsersTable";

export default async function AdminUsersPage() {
  const rows = await users.listUsers(getDb());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-fg">Users</h1>
        <p className="text-sm text-fg-secondary">
          Read-only inspection of profiles, assessments, strategy, programs, measurements and
          check-ins.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-alt p-6 text-center text-sm text-fg-secondary">
          No users yet.
        </p>
      ) : (
        <UsersTable
          rows={rows.map((user) => ({
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: new Date(user.createdAt).toISOString().slice(0, 10),
          }))}
        />
      )}
    </div>
  );
}
