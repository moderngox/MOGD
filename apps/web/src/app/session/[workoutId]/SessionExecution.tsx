"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Checkbox, Input, Select } from "@mogd/ui";
import type { BadgeVariant } from "@mogd/ui";
import { createLocationAction, deleteLastSetAction, finishSessionAction, logSetAction } from "./actions";

interface LoggedSetView {
  id: string;
  setNumber: number;
  loadKg: number | null;
  reps: number;
}

export interface SessionExerciseView {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  restSeconds: number;
  sessionRole: string | null;
  /** Shared by the two exercises of a superset pair; null otherwise. */
  supersetGroupId: string | null;
  selectionReason: string;
  videoUrl: string | null;
  previousPerformance: { loadKg: number | null; reps: number } | null;
  progressionTarget: {
    targetLoadKg: number | null;
    targetRepMin: number;
    targetRepMax: number;
    reason: string;
    message: string;
    loadInstruction: string | null;
  };
  /** Null until the first set of this exercise is logged in the open occurrence. */
  performanceId: string | null;
  loggedSets: LoggedSetView[];
}

/** "accessory" is the unmarked default — no badge for it, to avoid a badge on every card. */
const SESSION_ROLE_BADGES: Record<string, { label: string; variant: BadgeVariant }> = {
  main: { label: "Main", variant: "current" },
  finisher: { label: "Finisher", variant: "warning" },
  superset: { label: "Superset", variant: "info" },
};

function ExerciseCard({
  exercise,
  workoutId,
  locationId,
  onSessionStarted,
}: {
  exercise: SessionExerciseView;
  workoutId: string;
  locationId: string | null;
  onSessionStarted: (sessionId: string) => void;
}) {
  // Initialised from the server so a reload resumes where the athlete left off.
  const [logged, setLogged] = useState<LoggedSetView[]>(exercise.loggedSets);
  const [performanceId, setPerformanceId] = useState<string | null>(exercise.performanceId);
  const [loadInput, setLoadInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [rirInput, setRirInput] = useState("");
  const [painFlag, setPainFlag] = useState(false);
  const [techniqueConcern, setTechniqueConcern] = useState(false);
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
    const rir = rirInput === "" ? undefined : Number(rirInput);
    if (rir !== undefined && (!Number.isInteger(rir) || rir < 0 || rir > 10)) {
      setError("RIR must be a whole number from 0 to 10.");
      return;
    }

    setSaving(true);
    try {
      const result = await logSetAction({
        workoutId,
        exerciseId: exercise.exerciseId,
        locationId,
        setNumber: nextSetNumber,
        loadKg,
        reps,
        rir,
        painFlag: painFlag || undefined,
        techniqueValid: techniqueConcern ? false : undefined,
      });
      setPerformanceId(result.performanceId);
      if (result.sessionId) onSessionStarted(result.sessionId);
      setLogged((prev) => [...prev, { id: result.setId, setNumber: nextSetNumber, loadKg: loadKg ?? null, reps }]);
      setRepsInput("");
      setRirInput("");
      setPainFlag(false);
      setTechniqueConcern(false);
    } catch {
      setError("Could not save this set. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function undoLastSet() {
    if (!performanceId) return;
    setError(null);
    setSaving(true);
    try {
      await deleteLastSetAction(performanceId);
      setLogged((prev) => prev.slice(0, -1));
    } catch {
      setError("Could not remove the last set. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const roleBadge = exercise.sessionRole ? SESSION_ROLE_BADGES[exercise.sessionRole] : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">{exercise.name}</h2>
          {roleBadge && <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>}
        </div>
        <span className="text-sm text-zinc-500">
          {exercise.sets} × {exercise.repMin}-{exercise.repMax} · RIR {exercise.rirMin}-{exercise.rirMax} ·{" "}
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
      {exercise.progressionTarget.loadInstruction && (
        <p className="text-sm font-medium text-zinc-100">{exercise.progressionTarget.loadInstruction}</p>
      )}
      <p className="text-xs text-zinc-500">{exercise.progressionTarget.message}</p>

      {logged.length > 0 && (
        <div className="flex items-start justify-between gap-2">
          <ul className="text-sm text-zinc-400">
            {logged.map((s) => (
              <li key={s.id}>
                Set {s.setNumber}: {s.loadKg ?? "—"} kg × {s.reps}
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={undoLastSet} disabled={saving}>
            Undo last set
          </Button>
        </div>
      )}

      {!done ? (
        <div className="flex flex-col gap-2">
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
            <Input
              type="number"
              placeholder="RIR"
              value={rirInput}
              onChange={(e) => setRirInput(e.target.value)}
              className="w-16"
            />
            <Button onClick={logSet} disabled={saving}>
              Log set {nextSetNumber}/{exercise.sets}
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <Checkbox
              id={`${exercise.workoutExerciseId}-pain`}
              label="Pain"
              checked={painFlag}
              onChange={(e) => setPainFlag(e.target.checked)}
            />
            <Checkbox
              id={`${exercise.workoutExerciseId}-technique`}
              label="Technique concern"
              checked={techniqueConcern}
              onChange={(e) => setTechniqueConcern(e.target.checked)}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-green-400">All sets logged.</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

/** Consecutive exercises sharing a superset group become one block; everything else stays a block of one. */
function groupSupersets(exercises: SessionExerciseView[]): { supersetGroupId: string | null; exercises: SessionExerciseView[] }[] {
  const blocks: { supersetGroupId: string | null; exercises: SessionExerciseView[] }[] = [];
  for (const exercise of exercises) {
    const last = blocks.at(-1);
    if (exercise.supersetGroupId && last?.supersetGroupId === exercise.supersetGroupId) {
      last.exercises.push(exercise);
    } else {
      blocks.push({ supersetGroupId: exercise.supersetGroupId, exercises: [exercise] });
    }
  }
  return blocks;
}

function LocationPicker({
  locations,
  locationId,
  locked,
}: {
  locations: { id: string; name: string }[];
  locationId: string | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addLocation() {
    setError(null);
    setSaving(true);
    try {
      const created = await createLocationAction(newName);
      setNewName("");
      router.replace(`?location=${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message.includes("already") ? err.message : "Could not add this place.");
    } finally {
      setSaving(false);
    }
  }

  const current = locations.find((l) => l.id === locationId);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-800 p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Training place</p>
      {locations.length > 0 && (
        <Select
          value={locationId ?? ""}
          disabled={locked}
          onChange={(e) => router.replace(`?location=${e.target.value}`)}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      )}
      {locked ? (
        <p className="text-xs text-zinc-500">
          {current ? `Locked to ${current.name} for this workout.` : "This workout has no named place."}
        </p>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <Input
              placeholder={locations.length === 0 ? "Name where you train (optional)" : "New place…"}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button variant="secondary" onClick={addLocation} disabled={saving || newName.trim() === ""}>
              Add
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Loads don&apos;t transfer between equipment, so progress is tracked per place.
            {locations.length === 0 && " Your earlier workouts will be assigned to the first place you add."}
          </p>
        </>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function SessionExecution({
  workoutId,
  sessionId: initialSessionId,
  exercises,
  locations,
  locationId,
  locationLocked,
}: {
  workoutId: string;
  sessionId: string | null;
  exercises: SessionExerciseView[];
  locations: { id: string; name: string }[];
  locationId: string | null;
  locationLocked: boolean;
}) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  async function finish() {
    if (!sessionId) return;
    setFinishError(null);
    setFinishing(true);
    try {
      const result = await finishSessionAction(sessionId);
      router.push(`/session/summary/${result.sessionId}`);
    } catch {
      setFinishError("Could not finish the workout. Please try again.");
      setFinishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workout</h1>
        <Button variant="secondary" onClick={() => router.push("/program")}>
          Back to program
        </Button>
      </div>
      <LocationPicker locations={locations} locationId={locationId} locked={locationLocked} />
      {groupSupersets(exercises).map((block) => {
        const cards = block.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.workoutExerciseId}
            exercise={exercise}
            workoutId={workoutId}
            locationId={locationId}
            onSessionStarted={setSessionId}
          />
        ));
        if (!block.supersetGroupId) return cards;
        return (
          <div
            key={block.supersetGroupId}
            className="flex flex-col gap-3 rounded-lg border border-sky-900 bg-sky-950/20 p-3"
          >
            <p className="text-sm font-medium text-sky-300">
              Superset — alternate sets between the two, resting after each pair
            </p>
            {cards}
          </div>
        );
      })}
      <Button onClick={finish} disabled={!sessionId || finishing}>
        {finishing ? "Finishing…" : "Finish workout"}
      </Button>
      {finishError && <p className="text-sm text-red-400">{finishError}</p>}
    </div>
  );
}
