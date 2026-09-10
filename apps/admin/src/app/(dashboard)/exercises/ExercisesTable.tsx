"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Input, cn } from "@mogd/ui";

export interface ExerciseRow {
  id: string;
  canonicalId: string;
  name: string;
  difficulty: string;
  isActive: boolean;
}

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

/** Search-by-name/canonicalId + active/inactive filter chips over the already-fetched catalog. */
export function ExercisesTable({ rows }: { rows: ExerciseRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status === "active" && !row.isActive) return false;
      if (status === "inactive" && row.isActive) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q) || row.canonicalId.toLowerCase().includes(q);
    });
  }, [rows, query, status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by name or canonicalId"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <span className="text-xs text-fg-secondary">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
              status === f.value
                ? "border-accent bg-accent text-bg"
                : "border-border text-fg-secondary hover:border-border-strong hover:text-fg-secondary-alt",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-alt p-6 text-center text-sm text-fg-secondary">
          No exercises match.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">canonicalId</th>
                <th className="px-4 py-2.5 font-semibold">Difficulty</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((exercise) => (
                <tr key={exercise.id} className="hover:bg-surface-elevated/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/exercises/${exercise.id}`} className="font-medium text-fg hover:text-accent">
                      {exercise.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-fg-secondary">{exercise.canonicalId}</td>
                  <td className="px-4 py-2.5 text-fg-secondary-alt">{formatLabel(exercise.difficulty)}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={exercise.isActive ? "positive" : "neutral"}>
                      {exercise.isActive ? "Active" : "Inactive"}
                    </Badge>
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
