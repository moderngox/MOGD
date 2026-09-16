"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Checkbox, Input } from "@mogd/ui";
import { assessment, type exercises } from "@mogd/domain";
import { upsertProgrammingProfileAction } from "../actions";

type TraineeLevel = (typeof assessment.EXPERIENCE_LEVEL_OPTIONS)[number];
type ProgrammingProfile = exercises.ProgrammingProfile;

const LEVEL_LABELS: Record<TraineeLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** mogd_programming_engine_specs 02: same generic starting point the
 * backend seeds for a brand-new profile — shown when a level has no row
 * yet (e.g. an exercise created before this feature existed). */
const BLANK_PROFILE = {
  enabled: true,
  setsMin: 2,
  setsMax: 4,
  repsMin: 6,
  repsMax: 10,
  rirMin: 1,
  rirMax: 3,
  restSecondsMin: 75,
  restSecondsMax: 120,
};

interface FormState {
  enabled: boolean;
  setsMin: string;
  setsMax: string;
  repsMin: string;
  repsMax: string;
  rirMin: string;
  rirMax: string;
  restSecondsMin: string;
  restSecondsMax: string;
}

function toFormState(profile: ProgrammingProfile | undefined): FormState {
  const source = profile ?? BLANK_PROFILE;
  return {
    enabled: source.enabled,
    setsMin: String(source.setsMin),
    setsMax: String(source.setsMax),
    repsMin: String(source.repsMin),
    repsMax: String(source.repsMax),
    rirMin: String(source.rirMin),
    rirMax: String(source.rirMax),
    restSecondsMin: String(source.restSecondsMin),
    restSecondsMax: String(source.restSecondsMax),
  };
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{label}</span>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function ProgrammingProfilesSection({
  exerciseId,
  profiles,
}: {
  exerciseId: string;
  profiles: ProgrammingProfile[];
}) {
  const router = useRouter();
  const profileByLevel = new Map(profiles.map((p) => [p.traineeLevel as TraineeLevel, p]));
  const [activeLevel, setActiveLevel] = useState<TraineeLevel>("beginner");
  const [forms, setForms] = useState<Record<TraineeLevel, FormState>>(() =>
    Object.fromEntries(
      assessment.EXPERIENCE_LEVEL_OPTIONS.map((level) => [level, toFormState(profileByLevel.get(level))]),
    ) as Record<TraineeLevel, FormState>,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = forms[activeLevel];
  const activeProfile = profileByLevel.get(activeLevel);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForms((prev) => ({ ...prev, [activeLevel]: { ...prev[activeLevel], [key]: value } }));
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await upsertProgrammingProfileAction(exerciseId, activeLevel, {
        enabled: active.enabled,
        setsMin: Number(active.setsMin),
        setsMax: Number(active.setsMax),
        repsMin: Number(active.repsMin),
        repsMax: Number(active.repsMax),
        rirMin: Number(active.rirMin),
        rirMax: Number(active.rirMax),
        restSecondsMin: Number(active.restSecondsMin),
        restSecondsMax: Number(active.restSecondsMax),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Programming Profiles" className="max-w-2xl">
      <div className="flex gap-2">
        {assessment.EXPERIENCE_LEVEL_OPTIONS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setActiveLevel(level)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              level === activeLevel
                ? "bg-accent text-white"
                : "bg-surface-elevated text-fg-secondary hover:text-fg"
            }`}
          >
            {LEVEL_LABELS[level]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {activeProfile?.isInheritedDefault && (
          <Badge variant="neutral">Inherited default — not yet customized</Badge>
        )}
        {!activeProfile && <Badge variant="neutral">Not configured yet — will be created on save</Badge>}
      </div>

      <Checkbox
        id={`profile-enabled-${activeLevel}`}
        label={`Prescribable at ${LEVEL_LABELS[activeLevel]} level`}
        checked={active.enabled}
        onChange={(e) => set("enabled", e.target.checked)}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Sets min" value={active.setsMin} onChange={(v) => set("setsMin", v)} />
        <NumberField label="Sets max" value={active.setsMax} onChange={(v) => set("setsMax", v)} />
        <NumberField label="Reps min" value={active.repsMin} onChange={(v) => set("repsMin", v)} />
        <NumberField label="Reps max" value={active.repsMax} onChange={(v) => set("repsMax", v)} />
        <NumberField label="RIR min" value={active.rirMin} onChange={(v) => set("rirMin", v)} />
        <NumberField label="RIR max" value={active.rirMax} onChange={(v) => set("rirMax", v)} />
        <NumberField
          label="Rest min (s)"
          value={active.restSecondsMin}
          onChange={(v) => set("restSecondsMin", v)}
        />
        <NumberField
          label="Rest max (s)"
          value={active.restSecondsMax}
          onChange={(v) => set("restSecondsMax", v)}
        />
      </div>

      <div className="flex gap-6 text-sm text-fg-secondary">
        <span>
          Prescription: <span className="font-medium text-fg">RIR</span>
        </span>
        <span>
          Progression: <span className="font-medium text-fg">Double progression</span>
        </span>
      </div>

      {error && <p className="text-sm text-status-warning">{error}</p>}

      <Button onClick={save} disabled={saving} className="self-start">
        {saving ? "Saving…" : `Save ${LEVEL_LABELS[activeLevel]} profile`}
      </Button>
    </Card>
  );
}
