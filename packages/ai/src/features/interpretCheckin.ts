import type { Database } from "@mogd/db";
import { loadAiEnv } from "../env";
import { AnthropicStructuredProvider } from "../providers/anthropic";
import { runStructuredGeneration } from "../runLogger";
import type { StructuredGenerationProvider } from "../provider";
import {
  checkInInterpretationSchema,
  type CheckInInterpretation,
} from "../schemas/checkInInterpretation";
import {
  buildCheckInInterpretationPrompt,
  CHECK_IN_INTERPRETATION_PROMPT_VERSION,
  CHECK_IN_INTERPRETATION_SYSTEM_PROMPT,
  type CheckInInterpretationContext,
} from "../prompts/checkInInterpretation";

const SCHEMA_VERSION = "1";

/**
 * The "Optional AI Interpretation" step in docs/ARCHITECTURE.md §18's
 * adaptation pipeline — sits between the deterministic rules and safety
 * validation only in the sense of timing, never in the sense of influence:
 * this call happens after the deterministic decision is already final, and
 * its output is display-only enrichment that is never persisted as
 * plan_adjustments.reason and never fed back into any decision (CLAUDE.md
 * rule 3, rule 4).
 *
 * Every failure mode — no API key configured, provider unavailable, timeout,
 * malformed/unsafe output — resolves to `null` rather than throwing, so a
 * check-in submission is never blocked or delayed by AI availability
 * (docs/AI_AND_SAFETY.md, M6 exit criteria: "unavailable providers... fail
 * safely"). The run is still always logged to ai_runs, including failures,
 * by runStructuredGeneration.
 */
export async function interpretCheckin(
  db: Database,
  userId: string,
  context: CheckInInterpretationContext,
  /** Test-only seam — production callers always omit this and get the real
   * env-configured Anthropic provider (or null, if unconfigured). */
  providerOverride?: StructuredGenerationProvider,
): Promise<CheckInInterpretation | null> {
  const env = loadAiEnv();
  if (!providerOverride && !env) return null;

  try {
    const provider = providerOverride ?? new AnthropicStructuredProvider(env!.ANTHROPIC_API_KEY);
    const result = await runStructuredGeneration(db, provider, {
      purpose: "checkin_interpretation",
      schema: checkInInterpretationSchema,
      schemaName: "check_in_interpretation",
      schemaVersion: SCHEMA_VERSION,
      promptVersion: CHECK_IN_INTERPRETATION_PROMPT_VERSION,
      system: CHECK_IN_INTERPRETATION_SYSTEM_PROMPT,
      prompt: buildCheckInInterpretationPrompt(context),
      userId,
    });
    return result.data;
  } catch {
    return null;
  }
}
