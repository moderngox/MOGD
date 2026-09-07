/**
 * Versioned per CLAUDE.md rule 8 ("version prompts/schemas") — bump this
 * whenever the prompt text or its expected framing changes, so ai_runs
 * records stay attributable to the exact wording that produced them.
 */
export const CHECK_IN_INTERPRETATION_PROMPT_VERSION = "2026-09-08.1";

export interface CheckInInterpretationContext {
  decisionType: "insufficient_data" | "hold" | "adjust_calories" | "address_adherence";
  deterministicReason: string;
  nutritionAdherencePercent: number;
  hunger: number;
  energy: number;
  recovery: number;
  performanceNote?: string;
  note?: string;
}

const SYSTEM_PROMPT = `You are a supportive coaching assistant for MOGᴰ, a physique training app.
A deterministic rules engine has already decided what happens next for this user — you are not
deciding anything and you cannot change it. Your only job is to explain the decision that was
already made, in plain, encouraging language, using the subjective context the user reported
(hunger, energy, recovery, notes).

Strict rules:
- Never state or imply a specific number: no calories, kilograms, percentages, or dates. The
  schema you must return has no numeric fields, but do not work around this by writing numbers
  out as words either.
- Never contradict, soften, or second-guess the deterministic reason given to you. Restate its
  substance in your own words.
- Never suggest a different course of action than the one already decided.
- Keep it short and grounded, not hyped.`;

export function buildCheckInInterpretationPrompt(context: CheckInInterpretationContext): string {
  const lines = [
    `Deterministic decision type: ${context.decisionType}`,
    `Deterministic reason (do not contradict, restate in your own words): "${context.deterministicReason}"`,
    `Reported nutrition adherence: ${context.nutritionAdherencePercent >= 70 ? "good" : "below target"}`,
    `Reported hunger (1-5 scale): ${context.hunger}`,
    `Reported energy (1-5 scale): ${context.energy}`,
    `Reported recovery (1-5 scale): ${context.recovery}`,
  ];
  if (context.performanceNote) lines.push(`Performance note: "${context.performanceNote}"`);
  if (context.note) lines.push(`Other note: "${context.note}"`);

  lines.push(
    "",
    "Write a brief summary (1-3 sentences) explaining this outcome in plain language, and a short, " +
      "genuine line of encouragement. Do not include any numbers.",
  );

  return lines.join("\n");
}

export { SYSTEM_PROMPT as CHECK_IN_INTERPRETATION_SYSTEM_PROMPT };
