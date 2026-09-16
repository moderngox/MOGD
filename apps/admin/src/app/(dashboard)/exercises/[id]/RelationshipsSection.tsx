"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@mogd/ui";
import type { exercises } from "@mogd/domain";
import { createRelationshipAction, deleteRelationshipAction } from "../actions";
import { ExercisePicker, type ExercisePickerOption } from "./ExercisePicker";

type RelatedExercise = exercises.RelatedExercise;
type RelationshipAction = exercises.RelationshipAction;

const BUCKETS: { key: keyof exercises.ExerciseRelationshipsView; action: RelationshipAction; label: string }[] = [
  { key: "progressions", action: "progression", label: "Progressions" },
  { key: "regressions", action: "regression", label: "Regressions" },
  { key: "variations", action: "variation", label: "Variations" },
  { key: "alternatives", action: "alternative", label: "Alternatives" },
];

function RelationshipList({
  exerciseId,
  action,
  label,
  related,
  allExercises,
  excludeIds,
}: {
  exerciseId: string;
  action: RelationshipAction;
  label: string;
  related: RelatedExercise[];
  allExercises: ExercisePickerOption[];
  excludeIds: Set<string>;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(relatedExerciseId: string) {
    setError(null);
    setBusy(true);
    try {
      await createRelationshipAction(exerciseId, relatedExerciseId, action);
      setPicking(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add relationship.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(relationshipId: string) {
    setError(null);
    setBusy(true);
    try {
      await deleteRelationshipAction(exerciseId, relationshipId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove relationship.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{label}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPicking((v) => !v)}
          className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
        >
          {picking ? "Cancel" : "+ Add exercise"}
        </button>
      </div>

      {related.length === 0 && !picking ? (
        <p className="text-sm text-fg-secondary">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {related.map((entry) => (
            <li
              key={entry.relationshipId}
              className="flex items-center justify-between rounded px-2 py-1 text-sm text-fg hover:bg-surface-elevated"
            >
              <span>{entry.exercise.name}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(entry.relationshipId)}
                className="px-1.5 text-fg-secondary hover:text-status-warning disabled:opacity-50"
                aria-label={`Remove ${entry.exercise.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {picking && (
        <ExercisePicker options={allExercises} excludeIds={excludeIds} onPick={pick} />
      )}

      {error && <p className="text-xs text-status-warning">{error}</p>}
    </div>
  );
}

export function RelationshipsSection({
  exerciseId,
  relationships,
  allExercises,
}: {
  exerciseId: string;
  relationships: exercises.ExerciseRelationshipsView;
  allExercises: ExercisePickerOption[];
}) {
  return (
    <Card title="Relationships" className="max-w-2xl">
      {BUCKETS.map(({ key, action, label }) => {
        const related = relationships[key];
        const excludeIds = new Set([exerciseId, ...related.map((entry) => entry.exercise.id)]);
        return (
          <RelationshipList
            key={key}
            exerciseId={exerciseId}
            action={action}
            label={label}
            related={related}
            allExercises={allExercises}
            excludeIds={excludeIds}
          />
        );
      })}
    </Card>
  );
}
