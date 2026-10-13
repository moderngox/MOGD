"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ZodError } from "zod";
import { Button, Card, Checkbox, Input, Select, Textarea } from "@mogd/ui";
import { exercises, physique } from "@mogd/domain";
import { createExerciseAction, updateExerciseAction } from "./actions";

const { MOVEMENT_PATTERN_OPTIONS, EXERCISE_DIFFICULTY_OPTIONS, EQUIPMENT_OPTIONS, SESSION_ROLE_OPTIONS, LOAD_TYPE_OPTIONS } =
  exercises;

const LOAD_TYPE_LABELS: Record<string, string> = {
  external: "Added weight (more kg = harder)",
  assisted: "Assisted (more kg of help = easier)",
};
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
  loadType: string;
  contraindicationTags: string[];
  instructions?: string;
  isActive: boolean;
  allowedSessionRoles: string[];
  preferredSessionRole?: string;
}

const EMPTY: ExerciseFormValue = {
  canonicalId: "",
  name: "",
  movementPattern: "",
  difficulty: "",
  primaryMuscles: [],
  secondaryMuscles: [],
  equipment: [],
  loadType: "external",
  contraindicationTags: [],
  isActive: true,
  // Eligibility is explicit: a new exercise starts as accessory-eligible.
  allowedSessionRoles: ["accessory"],
};

export interface RestrictionCategoryOption {
  key: string;
  label: string;
}

export function ExerciseForm({
  exerciseId,
  initial,
  restrictionCategories,
}: {
  exerciseId?: string;
  initial?: ExerciseFormValue;
  restrictionCategories: RestrictionCategoryOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<ExerciseFormValue>(initial ?? EMPTY);
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

  const categoryKeys = new Set(restrictionCategories.map((c) => c.key));
  /** Tags saved before the taxonomy existed (or whose category is gone): they match nobody, so they must be removed, not carried. */
  const unrecognisedTags = form.contraindicationTags.filter((tag) => !categoryKeys.has(tag));

  function toggleRestriction(value: string) {
    const current = form.contraindicationTags;
    set("contraindicationTags", current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  function toggleEquipment(value: string) {
    const current = form.equipment;
    set(
      "equipment",
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  }

  /** Kept in canonical SESSION_ROLE_OPTIONS order (not click order) — the
   * assignment engine's last-resort fallback picks allowedRoles[0], which
   * must be deterministic (packages/domain/src/training/sessionRoleAssignment.ts). */
  function toggleSessionRole(value: string) {
    const current = form.allowedSessionRoles;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value].sort(
          (a, b) =>
            SESSION_ROLE_OPTIONS.indexOf(a as (typeof SESSION_ROLE_OPTIONS)[number]) -
            SESSION_ROLE_OPTIONS.indexOf(b as (typeof SESSION_ROLE_OPTIONS)[number]),
        );
    set("allowedSessionRoles", next);
  }

  async function save() {
    setError(null);
    if (unrecognisedTags.length > 0) {
      setError(`Remove the unrecognised restriction tags before saving: ${unrecognisedTags.join(", ")}.`);
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
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
      if (err instanceof ZodError) {
        setError(
          err.issues
            .map((issue) => `${issue.path.join(".") || "form"}: ${issue.message}`)
            .join("; "),
        );
      } else if (err instanceof Error && err.message.includes("already exists")) {
        setError(err.message);
      } else {
        setError("Could not save. Check required fields.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card title="Identity">
        {exerciseId ? (
          <p className="text-sm text-fg-secondary">
            canonicalId: <span className="font-mono text-fg-secondary-alt">{form.canonicalId}</span> (immutable)
          </p>
        ) : (
          <Input
            placeholder="canonicalId (e.g. incline_dumbbell_press) *"
            value={form.canonicalId}
            onChange={(e) => set("canonicalId", e.target.value)}
          />
        )}

        <Input placeholder="Name *" value={form.name} onChange={(e) => set("name", e.target.value)} />

        <Checkbox
          id="isActive"
          label="Active (resolvable by generated plans)"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
        />
      </Card>

      <Card title="Classification">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select value={form.movementPattern} onChange={(e) => set("movementPattern", e.target.value)}>
            <option value="" disabled>
              Movement pattern *
            </option>
            {MOVEMENT_PATTERN_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </Select>

          <Select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            <option value="" disabled>
              Difficulty *
            </option>
            {EXERCISE_DIFFICULTY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
            Primary muscles * (at least one)
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
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
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
            Secondary muscles
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
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
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-secondary">Equipment</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
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
      </Card>

      <Card title="Programming">
        <div className="flex flex-col gap-1 pb-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-fg-secondary" htmlFor="loadType">
            What a logged load means
          </label>
          <Select id="loadType" value={form.loadType} onChange={(e) => set("loadType", e.target.value)}>
            {LOAD_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {LOAD_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-fg-secondary">
            Assisted exercises (e.g. an assisted pull-up machine) progress by lowering the assistance.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            placeholder="Hypertrophy score (0-10)"
            value={form.hypertrophyScore ?? ""}
            onChange={(e) => set("hypertrophyScore", e.target.value ? Number(e.target.value) : undefined)}
          />
          <Input
            type="number"
            placeholder="Strength score (0-10)"
            value={form.strengthScore ?? ""}
            onChange={(e) => set("strengthScore", e.target.value ? Number(e.target.value) : undefined)}
          />
          <Input
            type="number"
            placeholder="Fatigue score (0-10)"
            value={form.fatigueScore ?? ""}
            onChange={(e) => set("fatigueScore", e.target.value ? Number(e.target.value) : undefined)}
          />
          <Input
            type="number"
            placeholder="Stability demand (0-10)"
            value={form.stabilityDemand ?? ""}
            onChange={(e) => set("stabilityDemand", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </Card>

      <Card title="Session Roles">
        <p className="text-xs text-fg-secondary">
          What this exercise CAN be used as. The engine assigns the actual role per generated
          session — this is eligibility, not an assignment. A superset is a pair, so it needs a second
          allowed role; it only happens when a compatible partner prefers superset too.
        </p>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
            Allowed roles
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {SESSION_ROLE_OPTIONS.map((r) => (
              <Checkbox
                key={r}
                id={`session-role-${r}`}
                label={label(r)}
                checked={form.allowedSessionRoles.includes(r)}
                onChange={() => toggleSessionRole(r)}
              />
            ))}
          </div>
        </div>

        <Select
          value={form.preferredSessionRole ?? ""}
          onChange={(e) => set("preferredSessionRole", e.target.value || undefined)}
        >
          <option value="">Preferred role (none)</option>
          {SESSION_ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {label(r)}
            </option>
          ))}
        </Select>

        {form.allowedSessionRoles.length === 0 && (
          <p className="text-xs text-status-warning">Select at least one allowed role.</p>
        )}
      </Card>

      <Card title="Safety">
        <p className="text-xs text-fg-secondary">
          Tick every restriction category this exercise is unsuitable for. An athlete who reports a ticked category is
          never given this exercise.
        </p>
        {restrictionCategories.length === 0 && unrecognisedTags.length === 0 ? (
          <p className="text-sm text-fg-secondary">
            No restriction categories exist yet.{" "}
            <Link href="/exercises/restrictions" className="text-accent hover:underline">
              Add reviewed categories
            </Link>{" "}
            to use this.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {restrictionCategories.map((category) => (
              <Checkbox
                key={category.key}
                id={`restriction-${category.key}`}
                label={category.label}
                checked={form.contraindicationTags.includes(category.key)}
                onChange={() => toggleRestriction(category.key)}
              />
            ))}
          </div>
        )}
        {unrecognisedTags.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-status-warning/40 p-3">
            <p className="text-xs text-status-warning">
              These tags are not restriction categories, so they match no athlete. Untick to remove them; saving is blocked
              until they are gone.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {unrecognisedTags.map((tag) => (
                <Checkbox
                  key={tag}
                  id={`restriction-legacy-${tag}`}
                  label={tag}
                  checked
                  onChange={() => toggleRestriction(tag)}
                />
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="Instructions">
        <Textarea
          placeholder="Instructions (optional)"
          value={form.instructions ?? ""}
          onChange={(e) => set("instructions", e.target.value)}
        />
      </Card>

      {error && <p className="text-sm text-status-warning">{error}</p>}

      <Button onClick={save} disabled={saving} className="self-start">
        {saving ? "Saving…" : exerciseId ? "Save changes" : "Create exercise"}
      </Button>
    </div>
  );
}
