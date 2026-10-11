"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input } from "@mogd/ui";
import { training } from "@mogd/domain";
import { resetRoleRulesAction, restoreRoleRulesAction, saveRoleRulesAction } from "./actions";

const { DEFAULT_ROLE_RULES, ROLE_RULE_BOUNDS: B, roleRulesSchema } = training;

type Role = "main" | "accessory" | "superset" | "finisher";
const ROLES: { key: Role; label: string }[] = [
  { key: "main", label: "Main" },
  { key: "accessory", label: "Accessory" },
  { key: "superset", label: "Superset" },
  { key: "finisher", label: "Finisher" },
];

interface RoleValues {
  restMultiplier: string;
  repShiftMin: string;
  repShiftMax: string;
  rirCeiling: string;
  setsDelta: string;
}

interface FormValues {
  roles: Record<Role, RoleValues>;
  restSecondsFloor: string;
  maxMainSlots: string;
  finisherFatigueCeiling: string;
  memberFatigueCeiling: string;
  combinedFatigueCeiling: string;
  maxPairsPerSession: string;
}

const text = (n: number | undefined) => (n === undefined ? "" : String(n));

function toValues(rules: training.RoleRules): FormValues {
  const roles = Object.fromEntries(
    ROLES.map(({ key }) => {
      const r = rules.roles[key];
      return [
        key,
        {
          restMultiplier: text(r.restMultiplier),
          repShiftMin: text(r.repShift?.min),
          repShiftMax: text(r.repShift?.max),
          rirCeiling: text(r.rirCeiling),
          setsDelta: text(r.setsDelta),
        },
      ];
    }),
  ) as Record<Role, RoleValues>;
  return {
    roles,
    restSecondsFloor: text(rules.restSecondsFloor),
    maxMainSlots: text(rules.maxMainSlots),
    finisherFatigueCeiling: text(rules.finisherFatigueCeiling),
    memberFatigueCeiling: text(rules.superset.memberFatigueCeiling),
    combinedFatigueCeiling: text(rules.superset.combinedFatigueCeiling),
    maxPairsPerSession: text(rules.superset.maxPairsPerSession),
  };
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** Blank optional fields are omitted (= "no cap" / "no shift"); the schema does the real validation. */
function buildRules(v: FormValues): { rules: unknown; problems: string[] } {
  const problems: string[] = [];
  const roles = Object.fromEntries(
    ROLES.map(({ key, label }) => {
      const r = v.roles[key];
      const min = num(r.repShiftMin);
      const max = num(r.repShiftMax);
      if ((min === undefined) !== (max === undefined)) problems.push(`${label}: fill both rep-shift fields or neither`);
      return [
        key,
        {
          restMultiplier: num(r.restMultiplier),
          ...(min !== undefined && max !== undefined ? { repShift: { min, max } } : {}),
          ...(num(r.rirCeiling) !== undefined ? { rirCeiling: num(r.rirCeiling) } : {}),
          ...(num(r.setsDelta) !== undefined ? { setsDelta: num(r.setsDelta) } : {}),
        },
      ];
    }),
  );
  return {
    problems,
    rules: {
      roles,
      restSecondsFloor: num(v.restSecondsFloor),
      maxMainSlots: num(v.maxMainSlots),
      finisherFatigueCeiling: num(v.finisherFatigueCeiling),
      superset: {
        memberFatigueCeiling: num(v.memberFatigueCeiling),
        combinedFatigueCeiling: num(v.combinedFatigueCeiling),
        maxPairsPerSession: num(v.maxPairsPerSession),
      },
    },
  };
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{label}</span>
      <Input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="text-xs text-fg-secondary">{hint}</span>
    </label>
  );
}

const range = (b: { min: number; max: number }, def: number | string) => `${b.min} to ${b.max} · default ${def}`;

interface RevisionView {
  id: string;
  createdAt: string;
  createdByEmail: string | null;
  note: string | null;
}

export function RoleRulesForm({
  initial,
  currentRevisionId,
  revisions,
}: {
  initial: training.RoleRules;
  currentRevisionId: string | null;
  revisions: RevisionView[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(initial));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const setRole = (role: Role, patch: Partial<RoleValues>) =>
    setValues((prev) => ({ ...prev, roles: { ...prev.roles, [role]: { ...prev.roles[role], ...patch } } }));
  const setGlobal = (patch: Partial<FormValues>) => setValues((prev) => ({ ...prev, ...patch }));

  async function run(action: () => Promise<void>) {
    setErrors([]);
    setBusy(true);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Could not save."]);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const { rules, problems } = buildRules(values);
    const parsed = roleRulesSchema.safeParse(rules);
    if (problems.length > 0 || !parsed.success) {
      setErrors([
        ...problems,
        ...(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "rules"}: ${i.message}`)),
      ]);
      return;
    }
    await run(async () => {
      await saveRoleRulesAction(parsed.data, note);
      setNote("");
    });
  }

  const d = DEFAULT_ROLE_RULES;

  return (
    <div className="flex flex-col gap-4">
      {ROLES.map(({ key, label }) => (
        <Card key={key} title={label}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field
              label="Rest multiplier"
              hint={range(B.restMultiplier, d.roles[key].restMultiplier)}
              value={values.roles[key].restMultiplier}
              onChange={(v) => setRole(key, { restMultiplier: v })}
            />
            <Field
              label="Rep shift min"
              hint={`blank = none · ${B.repShift.min} to ${B.repShift.max}`}
              value={values.roles[key].repShiftMin}
              onChange={(v) => setRole(key, { repShiftMin: v })}
            />
            <Field
              label="Rep shift max"
              hint={`blank = none · default ${d.roles[key].repShift?.max ?? "none"}`}
              value={values.roles[key].repShiftMax}
              onChange={(v) => setRole(key, { repShiftMax: v })}
            />
            <Field
              label="RIR ceiling"
              hint={`blank = no cap · ${B.rirCeiling.min} to ${B.rirCeiling.max} · default ${d.roles[key].rirCeiling ?? "none"}`}
              value={values.roles[key].rirCeiling}
              onChange={(v) => setRole(key, { rirCeiling: v })}
            />
            <Field
              label="Sets delta"
              hint={`blank = none · ${B.setsDelta.min} to ${B.setsDelta.max} · default ${d.roles[key].setsDelta ?? "none"}`}
              value={values.roles[key].setsDelta}
              onChange={(v) => setRole(key, { setsDelta: v })}
            />
          </div>
        </Card>
      ))}

      <Card title="Limits">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Rest floor (s)" hint={range(B.restSecondsFloor, d.restSecondsFloor)} value={values.restSecondsFloor} onChange={(v) => setGlobal({ restSecondsFloor: v })} />
          <Field label="Max main exercises" hint={range(B.maxMainSlots, d.maxMainSlots)} value={values.maxMainSlots} onChange={(v) => setGlobal({ maxMainSlots: v })} />
          <Field label="Finisher fatigue ceiling" hint={range(B.fatigueCeiling, d.finisherFatigueCeiling)} value={values.finisherFatigueCeiling} onChange={(v) => setGlobal({ finisherFatigueCeiling: v })} />
          <Field label="Superset member fatigue" hint={range(B.fatigueCeiling, d.superset.memberFatigueCeiling)} value={values.memberFatigueCeiling} onChange={(v) => setGlobal({ memberFatigueCeiling: v })} />
          <Field label="Superset combined fatigue" hint={`${B.combinedFatigueCeiling.min} to ${B.combinedFatigueCeiling.max}, at least the member value · default ${d.superset.combinedFatigueCeiling}`} value={values.combinedFatigueCeiling} onChange={(v) => setGlobal({ combinedFatigueCeiling: v })} />
          <Field label="Superset pairs per session" hint={`${B.maxPairsPerSession.min} (off) to ${B.maxPairsPerSession.max} · default ${d.superset.maxPairsPerSession}`} value={values.maxPairsPerSession} onChange={(v) => setGlobal({ maxPairsPerSession: v })} />
        </div>
      </Card>

      {errors.length > 0 && (
        <ul className="text-sm text-status-warning">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Input placeholder="Note (optional) — why this change" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save as new revision"}
        </Button>
        <Button variant="outline" onClick={() => run(resetRoleRulesAction)} disabled={busy}>
          Reset to defaults
        </Button>
      </div>

      <Card title="History">
        {revisions.length === 0 ? (
          <p className="text-sm text-fg-secondary">No saved revisions — the built-in defaults are in use.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {revisions.map((revision, index) => (
              <li key={revision.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 text-sm hover:bg-surface-elevated">
                <span className="flex flex-col">
                  <span className="text-fg">
                    {new Date(revision.createdAt).toLocaleString()} · {revision.createdByEmail ?? "unknown"}
                    {revision.id === currentRevisionId && (
                      <>
                        {" "}
                        <Badge variant="positive">Current</Badge>
                      </>
                    )}
                  </span>
                  {revision.note && <span className="text-xs text-fg-secondary">{revision.note}</span>}
                </span>
                {index > 0 && (
                  <Button variant="outline" onClick={() => run(() => restoreRoleRulesAction(revision.id))} disabled={busy}>
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
