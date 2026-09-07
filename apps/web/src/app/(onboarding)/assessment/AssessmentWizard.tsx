"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input, Select, Textarea } from "@mogd/ui";
import { assessment, physique } from "@mogd/domain";
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

export function AssessmentWizard({ photosAvailable }: { photosAvailable: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({ physiquePriorities: [], equipment: [] });
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
      setError(result.error.issues[0]?.message ?? "Please check this step.");
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
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">MOGᴰ can&apos;t support this yet</h1>
        <ul className="list-inside list-disc text-zinc-400">
          {rejectionReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-zinc-500">
          Step {step + 1} of {STEP_TITLES.length}
        </p>
        <h1 className="text-2xl font-semibold">{STEP_TITLES[step]}</h1>
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-2">
          {PRIMARY_GOAL_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="radio"
                name="primaryGoal"
                checked={form.primaryGoal === option}
                onChange={() => set("primaryGoal", option)}
              />
              {label(option)}
            </label>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-500">
            Select up to {MAX_PHYSIQUE_PRIORITIES}.
          </p>
          {PHYSIQUE_PRIORITY_OPTIONS.map((option) => (
            <Checkbox
              key={option}
              id={`priority-${option}`}
              label={label(option)}
              checked={(form.physiquePriorities ?? []).includes(option)}
              onChange={() => togglePriority(option)}
            />
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <Select
            value={form.sex ?? ""}
            onChange={(e) => set("sex", e.target.value as (typeof SEX_OPTIONS)[number])}
          >
            <option value="" disabled>
              Sex
            </option>
            {SEX_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            placeholder="Age"
            value={form.age ?? ""}
            onChange={(e) => set("age", Number(e.target.value))}
          />
          <Input
            type="number"
            placeholder="Height (cm)"
            value={form.heightCm ?? ""}
            onChange={(e) => set("heightCm", Number(e.target.value))}
          />
          <Input
            type="number"
            placeholder="Weight (kg)"
            value={form.weightKg ?? ""}
            onChange={(e) => set("weightKg", Number(e.target.value))}
          />
          <Input
            type="number"
            placeholder="Waist (cm)"
            value={form.waistCm ?? ""}
            onChange={(e) => set("waistCm", Number(e.target.value))}
          />
          <Input
            type="number"
            placeholder="Target weight (kg) — optional"
            value={form.targetWeightKg ?? ""}
            onChange={(e) =>
              set("targetWeightKg", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          {!photosAvailable ? (
            <p className="text-sm text-zinc-500">
              Photo upload isn&apos;t available right now — you can skip this step.
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-500">
                Optional. Front and/or side. Private — never shown publicly.
              </p>
              <Checkbox
                id="photo-consent"
                label="I consent to MOGᴰ storing these photos privately for my own assessment."
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <label className="text-sm text-zinc-400">
                Front photo
                <input
                  type="file"
                  accept="image/*"
                  disabled={!consent}
                  className="block text-sm text-zinc-400"
                  onChange={(e) =>
                    setPhotoFiles((prev) => ({ ...prev, front: e.target.files?.[0] }))
                  }
                />
              </label>
              <label className="text-sm text-zinc-400">
                Side photo
                <input
                  type="file"
                  accept="image/*"
                  disabled={!consent}
                  className="block text-sm text-zinc-400"
                  onChange={(e) =>
                    setPhotoFiles((prev) => ({ ...prev, side: e.target.files?.[0] }))
                  }
                />
              </label>
            </>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3">
          <Select
            value={form.experienceLevel ?? ""}
            onChange={(e) =>
              set("experienceLevel", e.target.value as (typeof EXPERIENCE_LEVEL_OPTIONS)[number])
            }
          >
            <option value="" disabled>
              Experience level
            </option>
            {EXPERIENCE_LEVEL_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </Select>
          <Select
            value={form.trainingConsistency ?? ""}
            onChange={(e) =>
              set(
                "trainingConsistency",
                e.target.value as (typeof TRAINING_CONSISTENCY_OPTIONS)[number],
              )
            }
          >
            <option value="" disabled>
              Consistency
            </option>
            {TRAINING_CONSISTENCY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </Select>
          <Select
            value={form.currentActivityLevel ?? ""}
            onChange={(e) =>
              set(
                "currentActivityLevel",
                e.target.value as (typeof ACTIVITY_LEVEL_OPTIONS)[number],
              )
            }
          >
            <option value="" disabled>
              Current activity level
            </option>
            {ACTIVITY_LEVEL_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </Select>
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
        <div className="flex flex-col gap-3">
          <Input
            type="number"
            placeholder="Sessions per week"
            value={form.sessionsPerWeek ?? ""}
            onChange={(e) => set("sessionsPerWeek", Number(e.target.value))}
          />
          <Input
            type="number"
            placeholder="Session duration (minutes)"
            value={form.sessionDurationMinutes ?? ""}
            onChange={(e) => set("sessionDurationMinutes", Number(e.target.value))}
          />
          <Select
            value={form.trainingContext ?? ""}
            onChange={(e) =>
              set("trainingContext", e.target.value as (typeof TRAINING_CONTEXT_OPTIONS)[number])
            }
          >
            <option value="" disabled>
              Where do you train?
            </option>
            {TRAINING_CONTEXT_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </Select>
          <p className="text-sm text-zinc-500">Equipment available</p>
          {EQUIPMENT_OPTIONS.map((o) => (
            <Checkbox
              key={o}
              id={`equipment-${o}`}
              label={label(o)}
              checked={(form.equipment ?? []).includes(o)}
              onChange={() => toggleEquipment(o)}
            />
          ))}
        </div>
      )}

      {step === 6 && (
        <div className="flex flex-col gap-3">
          <Select
            value={form.dietaryPreference ?? ""}
            onChange={(e) =>
              set(
                "dietaryPreference",
                e.target.value as (typeof DIETARY_PREFERENCE_OPTIONS)[number],
              )
            }
          >
            <option value="" disabled>
              Dietary preference
            </option>
            {DIETARY_PREFERENCE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Allergies / intolerances (optional)"
            value={form.allergies ?? ""}
            onChange={(e) => set("allergies", e.target.value)}
          />
          <Input
            type="number"
            placeholder="Meals per day"
            value={form.mealsPerDay ?? ""}
            onChange={(e) => set("mealsPerDay", Number(e.target.value))}
          />
          <Select
            value={form.cookingPreference ?? ""}
            onChange={(e) =>
              set(
                "cookingPreference",
                e.target.value as (typeof COOKING_PREFERENCE_OPTIONS)[number],
              )
            }
          >
            <option value="" disabled>
              Cooking preference
            </option>
            {COOKING_PREFERENCE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {label(o)}
              </option>
            ))}
          </Select>
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

      {error && <p className="text-sm text-red-400">{error}</p>}

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
