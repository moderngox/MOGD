"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Checkbox, Input, Select, Textarea } from "@mogd/ui";
import { checkins } from "@mogd/domain";
import { getCheckinPhotoUploadUrlAction, submitCheckinAction } from "./actions";

const { LIKERT_OPTIONS } = checkins;

type CheckinSubmission = checkins.CheckinSubmission;

interface FormState {
  averageWeightKg: string;
  waistCm: string;
  nutritionAdherencePercent: string;
  hunger: number;
  energy: number;
  recovery: number;
  performanceNote: string;
  note: string;
}

const EMPTY: FormState = {
  averageWeightKg: "",
  waistCm: "",
  nutritionAdherencePercent: "",
  hunger: 3,
  energy: 3,
  recovery: 3,
  performanceNote: "",
  note: "",
};

export function CheckinForm({ photosAvailable }: { photosAvailable: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<{ front?: File; side?: File }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<checkins.SubmitCheckinResult | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadPhoto(angle: "front" | "side", file: File) {
    const extensionMatch = file.type.split("/")[1];
    const extension = (
      ["jpg", "jpeg", "png", "webp"].includes(extensionMatch ?? "") ? extensionMatch : "jpg"
    ) as "jpg" | "jpeg" | "png" | "webp";

    const uploadResult = await getCheckinPhotoUploadUrlAction(angle, extension);
    if (!uploadResult.available || !uploadResult.uploadUrl || !uploadResult.objectKey) return null;

    const res = await fetch(uploadResult.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!res.ok) return null;

    return { angle, objectKey: uploadResult.objectKey };
  }

  async function submit() {
    setError(null);
    setSubmitting(true);

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

      const submission: CheckinSubmission = checkins.checkinSubmissionSchema.parse({
        averageWeightKg: form.averageWeightKg,
        waistCm: form.waistCm,
        nutritionAdherencePercent: form.nutritionAdherencePercent,
        hunger: form.hunger,
        energy: form.energy,
        recovery: form.recovery,
        performanceNote: form.performanceNote || undefined,
        note: form.note || undefined,
        photos,
      });

      const submitResult = await submitCheckinAction(submission);
      setResult(submitResult);
    } catch {
      setError("Could not submit check-in. Check that weight, waist and adherence are filled in.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-semibold text-fg">Check-in received</h2>
        <p className="text-sm text-fg-secondary-alt">
          Training adherence this period: {result.trainingAdherencePercent}%
        </p>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">Adaptation</p>
          <p className="text-fg">{result.adaptation.decision.reason}</p>
        </Card>
        {result.adaptation.aiInterpretation && (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">In plain terms</p>
            <p className="text-fg">{result.adaptation.aiInterpretation.summary}</p>
            <p className="text-sm text-fg-secondary-alt">{result.adaptation.aiInterpretation.encouragement}</p>
          </Card>
        )}
        <Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Measurements">
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            placeholder="Average weight (kg)"
            value={form.averageWeightKg}
            onChange={(e) => set("averageWeightKg", e.target.value)}
          />
          <Input
            type="number"
            placeholder="Waist (cm)"
            value={form.waistCm}
            onChange={(e) => set("waistCm", e.target.value)}
          />
        </div>
      </Card>

      <Card title="Adherence">
        <Input
          type="number"
          placeholder="Nutrition adherence this week (0-100%)"
          value={form.nutritionAdherencePercent}
          onChange={(e) => set("nutritionAdherencePercent", e.target.value)}
        />
      </Card>

      <Card title="Wellness">
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
            Hunger
            <Select value={form.hunger} onChange={(e) => set("hunger", Number(e.target.value))}>
              {LIKERT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
            Energy
            <Select value={form.energy} onChange={(e) => set("energy", Number(e.target.value))}>
              {LIKERT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
            Recovery
            <Select value={form.recovery} onChange={(e) => set("recovery", Number(e.target.value))}>
              {LIKERT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      <Card title="Notes">
        <Textarea
          placeholder="Any meaningful performance changes? (optional)"
          value={form.performanceNote}
          onChange={(e) => set("performanceNote", e.target.value)}
        />
        <Textarea
          placeholder="Anything else? (optional)"
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </Card>

      {photosAvailable && (
        <Card title="Optional progress photos">
          <Checkbox
            id="checkin-photo-consent"
            label="I consent to MOGᴰ storing these photos privately."
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <label className="text-sm text-fg-secondary">
            Front photo
            <input
              type="file"
              accept="image/*"
              disabled={!consent}
              className="block text-sm text-fg-secondary"
              onChange={(e) => setPhotoFiles((prev) => ({ ...prev, front: e.target.files?.[0] }))}
            />
          </label>
          <label className="text-sm text-fg-secondary">
            Side photo
            <input
              type="file"
              accept="image/*"
              disabled={!consent}
              className="block text-sm text-fg-secondary"
              onChange={(e) => setPhotoFiles((prev) => ({ ...prev, side: e.target.files?.[0] }))}
            />
          </label>
        </Card>
      )}

      {error && <p className="text-sm text-status-warning">{error}</p>}

      <Button onClick={submit} disabled={submitting}>
        {submitting ? "Submitting…" : "Submit check-in"}
      </Button>
    </div>
  );
}
