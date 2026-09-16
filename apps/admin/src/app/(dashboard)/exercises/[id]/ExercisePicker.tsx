"use client";

import { useMemo, useState } from "react";
import { Input } from "@mogd/ui";

export interface ExercisePickerOption {
  id: string;
  name: string;
  canonicalId: string;
}

/**
 * In-memory search-and-pick list over an already-fetched exercise set — no
 * server search endpoint exists for exercises (same pattern as
 * ExercisesTable.tsx's client-side filter). No reusable autocomplete
 * component exists in @mogd/ui, so this is built from Input + a plain
 * filtered button list rather than repurposing ChoiceCard, which is a
 * persistent multi-select toggle, not a pick-and-dismiss pattern.
 */
export function ExercisePicker({
  options,
  excludeIds,
  onPick,
}: {
  options: ExercisePickerOption[];
  excludeIds: Set<string>;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((option) => !excludeIds.has(option.id))
      .filter(
        (option) =>
          !q || option.name.toLowerCase().includes(q) || option.canonicalId.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [options, excludeIds, query]);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-alt p-3">
      <Input
        autoFocus
        placeholder="Search by name or canonicalId"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-fg-secondary">No matching exercises.</p>
        ) : (
          filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onPick(option.id)}
              className="rounded px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-elevated"
            >
              {option.name}{" "}
              <span className="font-mono text-xs text-fg-secondary">{option.canonicalId}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
