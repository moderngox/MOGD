import { z } from "zod";

const schema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  // Two separate buckets: public deliverable exercise media vs. private user
  // photos. Never point both at the same bucket (see docs/ARCHITECTURE.md §9).
  R2_EXERCISE_MEDIA_BUCKET: z.string().min(1),
  R2_EXERCISE_MEDIA_PUBLIC_BASE_URL: z.string().url(),
  R2_PRIVATE_PHOTOS_BUCKET: z.string().min(1),
});

export type MediaEnv = z.infer<typeof schema>;

/** Returns the configured media env, or null if any var is missing — the
 * single check every caller uses to decide whether media upload is usable
 * in this environment (e.g. running domain tests without R2 configured). */
export function loadMediaEnv(
  source: Record<string, string | undefined> = process.env,
): MediaEnv | null {
  const result = schema.safeParse(source);
  return result.success ? result.data : null;
}
