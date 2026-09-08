"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ChoiceCard, Checkbox, Input, NumberStepper, StepMeter, Textarea } from "@mogd/ui";
import { assessment, physique } from "@mogd/domain";
import { AssessmentIntro } from "./AssessmentIntro";
import {
  getPhotoUploadUrlAction,
  submitAssessmentAction,
  generateStrategyAction,
  generateProgramAction,
} from "./actions";

type AssessmentSubmission = assessment.AssessmentSubmission;

const {
  goalStepSchema,
  physiquePrioritiesStepSchema,
  bodyStepSchema,
  trainingHistoryStepSchema,
  availabilityStepSchema,
  nutritionStepSchema,
  optionalNoteStepSchema,
  PRIMARY_GOAL_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  TRAINING_CONSISTENCY_OPTIONS,
  ACTIVITY_LEVEL_OPTIONS,
  TRAINING_CONTEXT_OPTIONS,
  EQUIPMENT_OPTIONS,
  DIETARY_PREFERENCE_OPTIONS,
  COOKING_PREFERENCE_OPTIONS,
  SEX_OPTIONS,
} = assessment;
const { PHYSIQUE_PRIORITY_OPTIONS, MAX_PHYSIQUE_PRIORITIES } = physique;

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function describeIssue(issue: { path: (string | number)[]; message: string } | undefined): string {
  if (!issue) return "Please check this step.";
  const fieldLabel = typeof issue.path[0] === "string" ? FIELD_LABELS[issue.path[0]] : undefined;
  if (!fieldLabel) return issue.message;
  return issue.message === "Required" ? `${fieldLabel} is required.` : `${fieldLabel}: ${issue.message}`;
}

type FormState = Partial<Omit<AssessmentSubmission, "photos">>;

const STEP_TITLES = [
  "Goal",
  "Physique priorities",
  "Body",
  "Photos (optional)",
  "Training history",
  "Availability",
  "Nutrition",
  "Anything else?",
];

const STEP_DESCRIPTIONS = [
  "What outcome matters most right now.",
  "The areas you most want to develop.",
  "Used to calibrate targets — accurate numbers give a better plan.",
  "Optional. Never shown publicly.",
  "Helps calibrate difficulty and pacing from the start.",
  "Be realistic — the plan adapts to what you select here.",
  "Sets your calorie and macro targets.",
  "Optional — extra context for your plan. Structured answers above still take priority.",
];

const GOAL_DESCRIPTIONS: Record<string, string> = {
  fat_loss: "Reduce body fat while preserving muscle.",
  recomposition: "Lose fat and build muscle at the same time.",
  muscle_gain: "Build muscle, accept some fat gain.",
  strength: "Get stronger — prioritize load over appearance.",
};

const DEFAULT_AGE = 30;
const DEFAULT_HEIGHT_CM = 175;
const DEFAULT_WEIGHT_KG = 80;
const DEFAULT_WAIST_CM = 85;
const DEFAULT_SESSIONS_PER_WEEK = 3;
const DEFAULT_SESSION_DURATION_MIN = 45;
const DEFAULT_MEALS_PER_DAY = 3;

// Fields whose NumberStepper always shows a default (e.g. `form.age ?? DEFAULT_AGE`)
// must also be seeded here. Otherwise the UI shows a value the user never
// actually set, while the underlying field stays `undefined` until touched —
// and z.coerce.number() turns that `undefined` into NaN on submit if the
// step is passed without touching every slider.
const INITIAL_FORM: FormState = {
  physiquePriorities: [],
  equipment: [],
  age: DEFAULT_AGE,
  heightCm: DEFAULT_HEIGHT_CM,
  weightKg: DEFAULT_WEIGHT_KG,
  waistCm: DEFAULT_WAIST_CM,
  sessionsPerWeek: DEFAULT_SESSIONS_PER_WEEK,
  sessionDurationMinutes: DEFAULT_SESSION_DURATION_MIN,
  mealsPerDay: DEFAULT_MEALS_PER_DAY,
};

// Human labels for schema fields, used to turn zod's bare "Required" (or
// other) messages into something that names the actual field — the raw
// message alone doesn't say which input on the step is at fault.
const FIELD_LABELS: Record<string, string> = {
  primaryGoal: "Primary goal",
  physiquePriorities: "Physique priorities",
  sex: "Sex",
  age: "Age",
  heightCm: "Height",
  weightKg: "Weight",
  waistCm: "Waist",
  targetWeightKg: "Target weight",
  experienceLevel: "Experience level",
  trainingConsistency: "Recent consistency",
  currentActivityLevel: "Current activity level",
  sessionsPerWeek: "Sessions per week",
  sessionDurationMinutes: "Session duration",
  trainingContext: "Training location",
  equipment: "Equipment",
  dietaryPreference: "Dietary preference",
  mealsPerDay: "Meals per day",
  cookingPreference: "Cooking preference",
  optionalNote: "Note",
};

export function AssessmentWizard({ photosAvailable }: { photosAvailable: boolean }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [photoFiles, setPhotoFiles] = useState<{ front?: File; side?: File }>({});
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState<string[] | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateStep(): boolean {
    setError(null);
    let result;
    switch (step) {
      case 0:
        result = goalStepSchema.safeParse(form);
        break;
      case 1:
        result = physiquePrioritiesStepSchema.safeParse(form);
        break;
      case 2:
        result = bodyStepSchema.safeParse(form);
        break;
      case 3:
        return true; // photos step has no required fields
      case 4:
        result = trainingHistoryStepSchema.safeParse(form);
        break;
      case 5:
        result = availabilityStepSchema.safeParse(form);
        break;
      case 6:
        result = nutritionStepSchema.safeParse(form);
        break;
      case 7:
        result = optionalNoteStepSchema.safeParse(form);
        break;
      default:
        return true;
    }
    if (!result.success) {
      setError(describeIssue(result.error.issues[0]));
      return false;
    }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function togglePriority(value: (typeof PHYSIQUE_PRIORITY_OPTIONS)[number]) {
    const current = form.physiquePriorities ?? [];
    if (current.includes(value)) {
      set(
        "physiquePriorities",
        current.filter((v) => v !== value),
      );
    } else if (current.length < MAX_PHYSIQUE_PRIORITIES) {
      set("physiquePriorities", [...current, value]);
    }
  }

  function toggleEquipment(value: (typeof EQUIPMENT_OPTIONS)[number]) {
    const current = form.equipment ?? [];
    set(
      "equipment",
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  }

  async function uploadPhoto(angle: "front" | "side", file: File) {
    const extensionMatch = file.type.split("/")[1];
    const extension = (
      ["jpg", "jpeg", "png", "webp"].includes(extensionMatch ?? "") ? extensionMatch : "jpg"
    ) as "jpg" | "jpeg" | "png" | "webp";

    const result = await getPhotoUploadUrlAction(angle, extension);
    if (!result.available || !result.uploadUrl || !result.objectKey) return null;

    const res = await fetch(result.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!res.ok) return null;

    return { angle, objectKey: result.objectKey };
  }

  async function submit() {
    if (!validateStep()) return;
    setSubmitting(true);
    setError(null);

    try {
      const photos: { angle: "front" | "side"; objectKey: string }[] = [];
      if (consent) {
        for (const angle of ["front", "side"] as const) {
          const file = photoFiles[angle];
          if (!file) continue;
          const uploaded = await uploadPhoto(angle, file);
          if (uploaded) photos.push(uploaded);
        }
      }

      const submission = assessment.assessmentSubmissionSchema.parse({ ...form, photos });
      const result = await submitAssessmentAction(submission);

      if (!result.eligible) {
        setRejectionReasons(result.reasons);
        return;
      }

      // Best-effort: an extreme edge case can fail nutrition/program
      // validation (see packages/domain/src/nutrition/validate.ts and
      // src/programs/validator.ts) even though the assessment itself was
      // accepted. The dashboard handles a missing target/program
      // gracefully rather than blocking onboarding on this.
      await generateStrategyAction().catch(() => undefined);
      await generateProgramAction().catch(() => undefined);

      router.push("/dashboard");
    } catch {
      setError("Something went wrong submitting your assessment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (rejectionReasons) {
    return (
      <Card className="gap-3">
        <h1 className="font-display text-2xl font-semibold text-fg">MOGᴰ can&apos;t support this yet</h1>
        <ul className="list-inside list-disc text-fg-secondary">
          {rejectionReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </Card>
    );
  }

  if (!started) {
    return <AssessmentIntro onStart={() => setStarted(true)} />;
  }

  const priorityCount = form.physiquePriorities?.length ?? 0;
  const priorityAtMax = priorityCount >= MAX_PHYSIQUE_PRIORITIES;
  const targetWeightEnabled = form.targetWeightKg !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <StepMeter step={step} total={STEP_TITLES.length} />

      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-fg">{STEP_TITLES[step]}</h1>
        <p className="text-sm text-fg-secondary">{STEP_DESCRIPTIONS[step]}</p>
      </div>

      <Card className="gap-4">
        {step === 0 && (
          <div role="radiogroup" aria-label="Primary goal" className="flex flex-col gap-2">
            {PRIMARY_GOAL_OPTIONS.map((option) => (
              <ChoiceCard
                key={option}
                role="radio"
                variant="block"
                label={label(option)}
                description={GOAL_DESCRIPTIONS[option]}
                selected={form.primaryGoal === option}
                onSelect={() => set("primaryGoal", option)}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg-secondary">
              Select up to {MAX_PHYSIQUE_PRIORITIES} — {priorityCount} of {MAX_PHYSIQUE_PRIORITIES} selected.
            </p>
            <div role="group" aria-label="Physique priorities" className="flex flex-wrap gap-2">
              {PHYSIQUE_PRIORITY_OPTIONS.map((option) => {
                const selected = (form.physiquePriorities ?? []).includes(option);
                return (
                  <ChoiceCard
                    key={option}
                    role="checkbox"
                    variant="pill"
                    label={label(option)}
                    selected={selected}
                    disabled={priorityAtMax && !selected}
                    onSelect={() => togglePriority(option)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div role="radiogroup" aria-label="Sex" className="flex flex-col gap-2">
              <span className="text-sm font-medium text-fg-secondary-alt">Sex</span>
              <div className="flex flex-wrap gap-2">
                {SEX_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o}
                    role="radio"
                    variant="pill"
                    label={label(o)}
                    selected={form.sex === o}
                    onSelect={() => set("sex", o)}
                  />
                ))}
              </div>
            </div>
            <NumberStepper
              id="age"
              label="Age"
              min={16}
              max={80}
              value={form.age ?? DEFAULT_AGE}
              onChange={(v) => set("age", v)}
            />
            <NumberStepper
              id="height"
              label="Height"
              unit="cm"
              min={140}
              max={210}
              value={form.heightCm ?? DEFAULT_HEIGHT_CM}
              onChange={(v) => set("heightCm", v)}
            />
            <NumberStepper
              id="weight"
              label="Weight"
              unit="kg"
              min={40}
              max={180}
              value={form.weightKg ?? DEFAULT_WEIGHT_KG}
              onChange={(v) => set("weightKg", v)}
            />
            <NumberStepper
              id="waist"
              label="Waist"
              unit="cm"
              min={50}
              max={150}
              value={form.waistCm ?? DEFAULT_WAIST_CM}
              onChange={(v) => set("waistCm", v)}
            />
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Checkbox
                id="target-weight-toggle"
                label="Set a target weight"
                checked={targetWeightEnabled}
                onChange={(e) =>
                  set("targetWeightKg", e.target.checked ? (form.weightKg ?? DEFAULT_WEIGHT_KG) : undefined)
                }
              />
              {targetWeightEnabled && (
                <NumberStepper
                  id="target-weight"
                  label="Target weight"
                  unit="kg"
                  min={40}
                  max={180}
                  value={form.targetWeightKg ?? DEFAULT_WEIGHT_KG}
                  onChange={(v) => set("targetWeightKg", v)}
                />
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            {!photosAvailable ? (
              <p className="text-sm text-fg-secondary">
                Photo upload isn&apos;t available right now — you can skip this step.
              </p>
            ) : (
              <>
                <p className="text-sm text-fg-secondary">
                  Optional. Front and/or side. Private — never shown publicly.
                </p>
                <Checkbox
                  id="photo-consent"
                  label="I consent to MOGᴰ storing these photos privately for my own assessment."
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <div className="grid grid-cols-2 gap-3">
                  {(["front", "side"] as const).map((angle) => (
                    <label
                      key={angle}
                      className={
                        consent
                          ? "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-alt p-6 text-center transition-colors hover:border-accent"
                          : "flex cursor-not-allowed flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface-alt p-6 text-center opacity-50"
                      }
                    >
                      <span className="text-sm font-medium text-fg-secondary-alt">
                        {photoFiles[angle] ? photoFiles[angle]!.name : `${label(angle)} photo`}
                      </span>
                      <span className="text-xs text-fg-muted">
                        {photoFiles[angle] ? "Tap to replace" : "Tap to upload"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={!consent}
                        className="sr-only"
                        onChange={(e) =>
                          setPhotoFiles((prev) => ({ ...prev, [angle]: e.target.files?.[0] }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-fg-secondary-alt">Experience level</span>
              <div role="radiogroup" aria-label="Experience level" className="flex flex-wrap gap-2">
                {EXPERIENCE_LEVEL_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o}
                    role="radio"
                    variant="pill"
                    label={label(o)}
                    selected={form.experienceLevel === o}
                    onSelect={() => set("experienceLevel", o)}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-fg-secondary-alt">Recent consistency</span>
              <div role="radiogroup" aria-label="Training consistency" className="flex flex-wrap gap-2">
                {TRAINING_CONSISTENCY_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o}
                    role="radio"
                    variant="pill"
                    label={label(o)}
                    selected={form.trainingConsistency === o}
                    onSelect={() => set("trainingConsistency", o)}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-fg-secondary-alt">Current activity level</span>
              <div role="radiogroup" aria-label="Current activity level" className="flex flex-wrap gap-2">
                {ACTIVITY_LEVEL_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o}
                    role="radio"
                    variant="pill"
                    label={label(o)}
                    selected={form.currentActivityLevel === o}
                    onSelect={() => set("currentActivityLevel", o)}
                  />
                ))}
              </div>
            </div>
            <Textarea
              placeholder="Training history (optional)"
              value={form.trainingHistoryNotes ?? ""}
              onChange={(e) => set("trainingHistoryNotes", e.target.value)}
            />
            <Textarea
              placeholder="Limitations (optional)"
              value={form.limitations ?? ""}
              onChange={(e) => set("limitations", e.target.value)}
            />
            <Textarea
              placeholder="Injury restrictions (optional)"
              value={form.injuryRestrictions ?? ""}
              onChange={(e) => set("injuryRestrictions", e.target.value)}
            />
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-5">
            <NumberStepper
              id="sessions-per-week"
              label="Sessions per week"
              min={1}
              max={7}
              value={form.sessionsPerWeek ?? DEFAULT_SESSIONS_PER_WEEK}
              onChange={(v) => set("sessionsPerWeek", v)}
            />
            <NumberStepper
              id="session-duration"
              label="Session duration"
              unit="min"
              min={10}
              max={120}
              step={5}
              value={form.sessionDurationMinutes ?? DEFAULT_SESSION_DURATION_MIN}
              onChange={(v) => set("sessionDurationMinutes", v)}
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-fg-secondary-alt">Where do you train?</span>
              <div role="radiogroup" aria-label="Training context" className="flex flex-wrap gap-2">
                {TRAINING_CONTEXT_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o}
                    role="radio"
                    variant="pill"
                    label={label(o)}
                    selected={form.trainingContext === o}
                    onSelect={() => set("trainingContext", o)}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-fg-secondary-alt">Equipment available</span>
              <div role="group" aria-label="Equipment available" className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o}
                    role="checkbox"
                    variant="pill"
                    label={label(o)}
                    selected={(form.equipment ?? []).includes(o)}
                    onSelect={() => toggleEquipment(o)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-fg-secondary-alt">Dietary preference</span>
              <div role="radiogroup" aria-label="Dietary preference" className="grid grid-cols-2 gap-2">
                {DIETARY_PREFERENCE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o}
                    role="radio"
                    variant="pill"
                    label={label(o)}
                    selected={form.dietaryPreference === o}
                    onSelect={() => set("dietaryPreference", o)}
                  />
                ))}
              </div>
            </div>
            <Input
              placeholder="Allergies / intolerances (optional)"
              value={form.allergies ?? ""}
              onChange={(e) => set("allergies", e.target.value)}
            />
            <NumberStepper
              id="meals-per-day"
              label="Meals per day"
              min={1}
              max={8}
              value={form.mealsPerDay ?? DEFAULT_MEALS_PER_DAY}
              onChange={(v) => set("mealsPerDay", v)}
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-fg-secondary-alt">Cooking preference</span>
              <div role="radiogroup" aria-label="Cooking preference" className="flex flex-wrap gap-2">
                {COOKING_PREFERENCE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o}
                    role="radio"
                    variant="pill"
                    label={label(o)}
                    selected={form.cookingPreference === o}
                    onSelect={() => set("cookingPreference", o)}
                  />
                ))}
              </div>
            </div>
            <Input
              placeholder="Disliked foods (optional)"
              value={form.dislikedFoods ?? ""}
              onChange={(e) => set("dislikedFoods", e.target.value)}
            />
            <Checkbox
              id="track-calories"
              label="I'm willing to track calories/macros"
              checked={form.willingToTrackCalories ?? false}
              onChange={(e) => set("willingToTrackCalories", e.target.checked)}
            />
          </div>
        )}

        {step === 7 && (
          <Textarea
            placeholder="Anything else your coach should know? (optional)"
            value={form.optionalNote ?? ""}
            onChange={(e) => set("optionalNote", e.target.value)}
          />
        )}
      </Card>

      {error && <p className="text-sm text-status-warning">{error}</p>}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={back} disabled={step === 0 || submitting}>
          Back
        </Button>
        {step < STEP_TITLES.length - 1 ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Finish"}
          </Button>
        )}
      </div>
    </div>
  );
}
