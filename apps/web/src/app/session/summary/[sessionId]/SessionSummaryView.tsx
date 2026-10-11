"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input } from "@mogd/ui";
import { correctSetAction } from "../../[workoutId]/actions";

interface SummarySetView {
  id: string;
  setNumber: number;
  loadKg: number | null;
  reps: number;
  rir: number | null;
  painFlag: boolean | null;
  techniqueValid: boolean | null;
}

export interface SummaryPerformanceView {
  id: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  loggedSets: SummarySetView[];
}

function SetRow({ set }: { set: SummarySetView }) {
  const [load, setLoad] = useState(set.loadKg === null ? "" : String(set.loadKg));
  const [reps, setReps] = useState(String(set.reps));
  const [rir, setRir] = useState(set.rir === null ? "" : String(set.rir));
  const [pain, setPain] = useState(set.painFlag === true);
  const [technique, setTechnique] = useState(set.techniqueValid === false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    try {
      await correctSetAction(set.id, {
        loadKg: load === "" ? null : Number(load),
        reps: Number(reps),
        rir: rir === "" ? null : Number(rir),
        painFlag: pain ? true : null,
        techniqueValid: technique ? false : null,
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const markDirty = () => setStatus("idle");

  return (
    <div className="flex flex-col gap-2 border-t border-zinc-800 pt-2">
      <div className="flex items-end gap-2">
        <span className="w-10 text-sm text-zinc-500">Set {set.setNumber}</span>
        <Input type="number" placeholder="kg" value={load} onChange={(e) => { setLoad(e.target.value); markDirty(); }} className="w-20" />
        <Input type="number" placeholder="Reps" value={reps} onChange={(e) => { setReps(e.target.value); markDirty(); }} className="w-16" />
        <Input type="number" placeholder="RIR" value={rir} onChange={(e) => { setRir(e.target.value); markDirty(); }} className="w-16" />
        <Button variant="secondary" onClick={save} disabled={status === "saving"}>
          {status === "saved" ? "Saved" : "Save"}
        </Button>
      </div>
      <div className="flex items-center gap-4 pl-12">
        <Checkbox id={`${set.id}-pain`} label="Pain" checked={pain} onChange={(e) => { setPain(e.target.checked); markDirty(); }} />
        <Checkbox id={`${set.id}-tech`} label="Technique concern" checked={technique} onChange={(e) => { setTechnique(e.target.checked); markDirty(); }} />
      </div>
      {status === "error" && <p className="pl-12 text-sm text-red-400">Could not save this set.</p>}
    </div>
  );
}

export function SessionSummaryView({
  sessionLabel,
  finished,
  performances,
}: {
  sessionLabel: string;
  finished: boolean;
  performances: SummaryPerformanceView[];
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{finished ? "Workout complete" : "Workout summary"}</h1>
        <p className="text-sm text-zinc-500">
          {sessionLabel.replaceAll("_", " ")} — review your sets and correct anything that was logged wrong.
        </p>
      </div>
      {performances.map((performance) => (
        <div key={performance.id} className="flex flex-col gap-2 rounded-md border border-zinc-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{performance.name}</h2>
            <span className="text-sm text-zinc-500">
              {performance.loggedSets.length}/{performance.sets} sets · {performance.repMin}-{performance.repMax} reps · RIR{" "}
              {performance.rirMin}-{performance.rirMax}
            </span>
          </div>
          {performance.loggedSets.map((set) => (
            <SetRow key={set.id} set={set} />
          ))}
        </div>
      ))}
      <Button onClick={() => router.push("/dashboard")}>Done</Button>
    </div>
  );
}
