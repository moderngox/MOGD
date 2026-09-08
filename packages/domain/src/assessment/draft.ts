import { eq } from "drizzle-orm";
import { z } from "zod";
import { schema, type Database } from "@mogd/db";
import { assessmentDraftFormStateSchema, type AssessmentDraftFormState } from "./schemas";

const saveDraftInputSchema = z.object({
  step: z.number().int().min(0),
  formState: assessmentDraftFormStateSchema,
});

export type SaveDraftInput = z.infer<typeof saveDraftInputSchema>;

export interface AssessmentDraft {
  step: number;
  formState: AssessmentDraftFormState;
}

/**
 * Upserts the current user's in-progress wizard state (docs/PRODUCT.md §6).
 * Called on each step transition, not per keystroke — matches how the
 * wizard already validates a whole step at once before advancing.
 */
export async function saveDraft(db: Database, userId: string, rawInput: SaveDraftInput): Promise<void> {
  const input = saveDraftInputSchema.parse(rawInput);
  const now = new Date();

  await db
    .insert(schema.assessmentDrafts)
    .values({ userId, step: input.step, formState: input.formState, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.assessmentDrafts.userId,
      set: { step: input.step, formState: input.formState, updatedAt: now },
    });
}

/**
 * Reads the current user's saved draft, if any. Returns null both when
 * there is none and when a stored draft no longer matches
 * assessmentDraftFormStateSchema (e.g. an option was renamed after the
 * draft was saved) — a resume that can't be trusted is treated the same as
 * no resume, rather than surfacing an error mid-onboarding.
 */
export async function getDraft(db: Database, userId: string): Promise<AssessmentDraft | null> {
  const [row] = await db.select().from(schema.assessmentDrafts).where(eq(schema.assessmentDrafts.userId, userId));
  if (!row) return null;

  const formState = assessmentDraftFormStateSchema.safeParse(row.formState);
  if (!formState.success) return null;

  return { step: row.step, formState: formState.data };
}
