"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Input } from "@mogd/ui";

export interface UserRow {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

/** Search-by-email over the already-fetched user list. */
export function UsersTable({ rows }: { rows: UserRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((row) => row.email.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <span className="text-xs text-fg-secondary">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-alt p-6 text-center text-sm text-fg-secondary">
          No users match.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-surface-elevated/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/users/${user.id}`} className="font-medium text-fg hover:text-accent">
                      {user.email}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={user.role === "admin" ? "current" : "neutral"}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-fg-secondary-alt">{user.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
