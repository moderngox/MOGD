import { z } from "zod";

/**
 * Deliberately has no numeric fields at all, and the digit refinement below
 * rejects any number written into the free-text fields too — the AI has no
 * way to state a calorie figure, adjustment size, or trend number even if
 * it tried. Every number shown to the user always comes from the
 * deterministic decision (packages/domain/adaptation), never from this
 * schema. This is the structural enforcement of docs/AI_AND_SAFETY.md:
 * "AI may explain their results... It must not silently change the
 * numbers." A response that violates this is rejected (schema_mismatch in
 * ai_runs), never sanitized and shown anyway.
 */
const noDigits = (value: string) => !/\d/.test(value);

export const checkInInterpretationSchema = z.object({
  summary: z.string().min(1).max(280).refine(noDigits, "must not contain digits"),
  encouragement: z.string().min(1).max(200).refine(noDigits, "must not contain digits"),
});

export type CheckInInterpretation = z.infer<typeof checkInInterpretationSchema>;
