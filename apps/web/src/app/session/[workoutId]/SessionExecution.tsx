"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@mogd/ui";
import { logSetAction } from "./actions";

export interface SessionExerciseView {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number;
  restSeconds: number;
  selectionReason: string;
  videoUrl: string | null;
  previousPerformance: { loadKg: number | null; reps: number } | null;
  progressionTarget: {
    targetLoadKg: number | null;
    targetRepMin: number;
    targetRepMax: number;
    reason: string;
  };
}

interface LoggedSet {
  setNumber: number;
  loadKg?: number;
  reps: number;
}

function ExerciseCard({
  exercise,
  workoutId,
}: {
  exercise: SessionExerciseView;
  workoutId: string;
}) {
  const [logged, setLogged] = useState<LoggedSet[]>([]);
  const [loadInput, setLoadInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nextSetNumber = logged.length + 1;
  const done = logged.length >= exercise.sets;

  async function logSet() {
    setError(null);
    const reps = Number(repsInput);
    if (!reps || reps <= 0) {
      setError("Enter reps for this set.");
      return;
    }
    const loadKg = loadInput ? Number(loadInput) : undefined;

    setSaving(true);
    try {
      await logSetAction({
        exerciseId: exercise.exerciseId,
        workoutId,
        setNumber: nextSetNumber,
        loadKg,
        reps,
      });
      setLogged((prev) => [...prev, { setNumber: nextSetNumber, loadKg, reps }]);
      setRepsInput("");
    } catch {
      setError("Could not save this set. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{exercise.name}</h2>
        <span className="text-sm text-zinc-500">
          {exercise.sets} × {exercise.repMin}-{exercise.repMax} · RIR {exercise.rir} ·{" "}
          {exercise.restSeconds}s rest
        </span>
      </div>
      <p className="text-xs text-zinc-500">{exercise.selectionReason}</p>

      {exercise.videoUrl && (
        <video src={exercise.videoUrl} controls className="w-full rounded-md" />
      )}

      <div className="grid grid-cols-2 gap-x-4 text-sm">
        <span className="text-zinc-500">Previous</span>
        <span className="text-zinc-500">Current target</span>
        <span className="text-zinc-100">
          {exercise.previousPerformance
            ? `${exercise.previousPerformance.loadKg ?? "—"} kg × ${exercise.previousPerformance.reps}`
            : "No previous data"}
        </span>
        <span className="text-zinc-100">
          {exercise.progressionTarget.targetLoadKg !== null
            ? `${exercise.progressionTarget.targetLoadKg} kg × ${exercise.progressionTarget.targetRepMin}-${exercise.progressionTarget.targetRepMax}`
            : `${exercise.progressionTarget.targetRepMin}-${exercise.progressionTarget.targetRepMax} reps`}
        </span>
      </div>
      <p className="text-xs text-zinc-500">{exercise.progressionTarget.reason}</p>

      {logged.length > 0 && (
        <ul className="text-sm text-zinc-400">
          {logged.map((s) => (
            <li key={s.setNumber}>
              Set {s.setNumber}: {s.loadKg ?? "—"} kg × {s.reps}
            </li>
          ))}
        </ul>
      )}

      {!done ? (
        <div className="flex items-end gap-2">
          <Input
            type="number"
            placeholder="Load (kg)"
            value={loadInput}
            onChange={(e) => setLoadInput(e.target.value)}
            className="w-24"
          />
          <Input
            type="number"
            placeholder="Reps"
            value={repsInput}
            onChange={(e) => setRepsInput(e.target.value)}
            className="w-20"
          />
          <Button onClick={logSet} disabled={saving}>
            Log set {nextSetNumber}/{exercise.sets}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-green-400">All sets logged.</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function SessionExecution({
  workoutId,
  exercises,
}: {
  workoutId: string;
  exercises: SessionExerciseView[];
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workout</h1>
        <Button variant="secondary" onClick={() => router.push("/program")}>
          Back to program
        </Button>
      </div>
      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.workoutExerciseId} exercise={exercise} workoutId={workoutId} />
      ))}
    </div>
  );
}
