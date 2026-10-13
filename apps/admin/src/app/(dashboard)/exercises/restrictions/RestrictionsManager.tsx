"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@mogd/ui";
import { safety } from "@mogd/domain";
import { createRestrictionAction, deleteRestrictionAction, renameRestrictionAction } from "./actions";

interface Row {
  id: string;
  key: string;
  label: string;
  exerciseCount: number;
  athleteCount: number;
}

function RestrictionRow({ row, onError }: { row: Row; onError: (message: string | null) => void }) {
  const router = useRouter();
  const [label, setLabel] = useState(row.label);
  const [busy, setBusy] = useState(false);
  const inUse = row.exerciseCount > 0 || row.athleteCount > 0;

  async function perform(work: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    onError(null);
    setBusy(true);
    try {
      const result = await work();
      if (!result.ok) onError(result.error);
      else router.refresh();
    } catch {
      onError("Could not save. Check the label and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col">
        <code className="text-xs text-fg-secondary">{row.key}</code>
        <Input aria-label={`Label for ${row.key}`} value={label} onChange={(e) => setLabel(e.target.value)} />
        <span className="text-xs text-fg-secondary">
          {row.exerciseCount} exercise{row.exerciseCount === 1 ? "" : "s"} · {row.athleteCount} athlete
          {row.athleteCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={busy || label.trim() === row.label}
          onClick={() => perform(() => renameRestrictionAction(row.id, label))}
        >
          Rename
        </Button>
        <Button
          variant="outline"
          disabled={busy || inUse}
          title={inUse ? "In use: remove it from exercises and athletes first" : undefined}
          onClick={() => perform(() => deleteRestrictionAction(row.id))}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

export function RestrictionsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setError(null);
    const parsed = safety.createRestrictionCategoryInput.safeParse({ key, label });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
      return;
    }
    setBusy(true);
    try {
      const result = await createRestrictionAction(parsed.data.key, parsed.data.label);
      if (!result.ok) setError(result.error);
      else {
        setKey("");
        setLabel("");
        router.refresh();
      }
    } catch {
      setError("Could not add the category.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Categories">
        {rows.length === 0 ? (
          <p className="text-sm text-fg-secondary">
            No categories yet, so no exercise is filtered by a reported restriction.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((row) => (
              <RestrictionRow key={row.id} row={row} onError={setError} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add a category">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="key (lowercase_with_underscores, cannot be changed)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Input placeholder="Label shown to athletes" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <Button onClick={add} disabled={busy} className="self-start">
          Add category
        </Button>
      </Card>

      {error && <p className="text-sm text-status-warning">{error}</p>}
    </div>
  );
}
