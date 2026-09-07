"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input, Select, Textarea } from "@mogd/ui";
import { exercises, physique } from "@mogd/domain";
import { createExerciseAction, updateExerciseAction } from "./actions";

const { MOVEMENT_PATTERN_OPTIONS, EXERCISE_DIFFICULTY_OPTIONS, EQUIPMENT_OPTIONS } = exercises;
const { CANONICAL_MUSCLE_GROUPS } = physique;

function label(value: string): string {
  return value.replaceAll("_", " ");
}

export interface ExerciseFormValue {
  canonicalId: string;
  name: string;
  movementPattern: string;
  difficulty: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  hypertrophyScore?: number;
  strengthScore?: number;
  fatigueScore?: number;
  stabilityDemand?: number;
  defaultRepMin?: number;
  defaultRepMax?: number;
  contraindicationTags: string[];
  instructions?: string;
  isActive: boolean;
}

const EMPTY: ExerciseFormValue = {
  canonicalId: "",
  name: "",
  movementPattern: "",
  difficulty: "",
  primaryMuscles: [],
  secondaryMuscles: [],
  equipment: [],
  contraindicationTags: [],
  isActive: true,
};

export function ExerciseForm({
  exerciseId,
  initial,
}: {
  exerciseId?: string;
  initial?: ExerciseFormValue;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ExerciseFormValue>(initial ?? EMPTY);
  const [tagsText, setTagsText] = useState(initial?.contraindicationTags.join(", ") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ExerciseFormValue>(key: K, value: ExerciseFormValue[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMuscle(field: "primaryMuscles" | "secondaryMuscles", value: string) {
    const current = form[field];
    set(
      field,
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  }

  function toggleEquipment(value: string) {
    const current = form.equipment;
    set(
      "equipment",
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  }

  async function save() {
    setError(null);
    const contraindicationTags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const payload = { ...form, contraindicationTags };
      if (exerciseId) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { canonicalId, ...updatePayload } = payload;
        await updateExerciseAction(exerciseId, exercises.updateExerciseInput.parse(updatePayload));
        router.refresh();
      } else {
        const created = await createExerciseAction(exercises.createExerciseInput.parse(payload));
        router.push(`/exercises/${created.id}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) {
        setError(err.message);
      } else {
        setError("Could not save. Check required fields.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      {exerciseId ? (
        <p className="text-sm text-zinc-500">
          canonicalId: <span className="text-zinc-300">{form.canonicalId}</span> (immutable)
        </p>
      ) : (
        <Input
          placeholder="canonicalId (e.g. incline_dumbbell_press)"
          value={form.canonicalId}
          onChange={(e) => set("canonicalId", e.target.value)}
        />
      )}

      <Input
        placeholder="Name"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
      />

      <Select
        value={form.movementPattern}
        onChange={(e) => set("movementPattern", e.target.value)}
      >
        <option value="" disabled>
          Movement pattern
        </option>
        {MOVEMENT_PATTERN_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </Select>

      <Select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
        <option value="" disabled>
          Difficulty
        </option>
        {EXERCISE_DIFFICULTY_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </Select>

      <div>
        <p className="mb-1 text-sm text-zinc-500">Primary muscles</p>
        <div className="grid grid-cols-2 gap-1">
          {CANONICAL_MUSCLE_GROUPS.map((m) => (
            <Checkbox
              key={m}
              id={`primary-${m}`}
              label={label(m)}
              checked={form.primaryMuscles.includes(m)}
              onChange={() => toggleMuscle("primaryMuscles", m)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm text-zinc-500">Secondary muscles</p>
        <div className="grid grid-cols-2 gap-1">
          {CANONICAL_MUSCLE_GROUPS.map((m) => (
            <Checkbox
              key={m}
              id={`secondary-${m}`}
              label={label(m)}
              checked={form.secondaryMuscles.includes(m)}
              onChange={() => toggleMuscle("secondaryMuscles", m)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm text-zinc-500">Equipment</p>
        <div className="grid grid-cols-2 gap-1">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <Checkbox
              key={eq}
              id={`equipment-${eq}`}
              label={label(eq)}
              checked={form.equipment.includes(eq)}
              onChange={() => toggleEquipment(eq)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          type="number"
          placeholder="Hypertrophy score (0-10)"
          value={form.hypertrophyScore ?? ""}
          onChange={(e) =>
            set("hypertrophyScore", e.target.value ? Number(e.target.value) : undefined)
          }
        />
        <Input
          type="number"
          placeholder="Strength score (0-10)"
          value={form.strengthScore ?? ""}
          onChange={(e) =>
            set("strengthScore", e.target.value ? Number(e.target.value) : undefined)
          }
        />
        <Input
          type="number"
          placeholder="Fatigue score (0-10)"
          value={form.fatigueScore ?? ""}
          onChange={(e) =>
            set("fatigueScore", e.target.value ? Number(e.target.value) : undefined)
          }
        />
        <Input
          type="number"
          placeholder="Stability demand (0-10)"
          value={form.stabilityDemand ?? ""}
          onChange={(e) =>
            set("stabilityDemand", e.target.value ? Number(e.target.value) : undefined)
          }
        />
        <Input
          type="number"
          placeholder="Default rep min"
          value={form.defaultRepMin ?? ""}
          onChange={(e) =>
            set("defaultRepMin", e.target.value ? Number(e.target.value) : undefined)
          }
        />
        <Input
          type="number"
          placeholder="Default rep max"
          value={form.defaultRepMax ?? ""}
          onChange={(e) =>
            set("defaultRepMax", e.target.value ? Number(e.target.value) : undefined)
          }
        />
      </div>

      <Input
        placeholder="Contraindication tags, comma separated (e.g. knee_pain, shoulder_impingement)"
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
      />

      <Textarea
        placeholder="Instructions (optional)"
        value={form.instructions ?? ""}
        onChange={(e) => set("instructions", e.target.value)}
      />

      <Checkbox
        id="isActive"
        label="Active (resolvable by generated plans)"
        checked={form.isActive}
        onChange={(e) => set("isActive", e.target.checked)}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : exerciseId ? "Save changes" : "Create exercise"}
      </Button>
    </div>
  );
}
