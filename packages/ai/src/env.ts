import { z } from "zod";

const schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
});

export type AiEnv = z.infer<typeof schema>;

/** Returns the configured AI env, or null if the API key is missing — the
 * single check every caller uses to decide whether structured generation is
 * usable in this environment. AI features are always optional enrichment
 * (CLAUDE.md rule 4, docs/AI_AND_SAFETY.md), so an absent key must fail
 * safely rather than throw. */
export function loadAiEnv(
  source: Record<string, string | undefined> = process.env,
): AiEnv | null {
  const result = schema.safeParse(source);
  return result.success ? result.data : null;
}
