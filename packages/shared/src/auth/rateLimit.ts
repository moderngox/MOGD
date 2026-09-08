/**
 * In-memory, per-process, per-key rate limiter for auth attempts
 * (docs/SPIDRA_MIGRATION.md's "Known gap carried forward" — closed here).
 * Alpha-scope only: state resets on restart and is not shared across
 * instances — fine for a single-process deployment, not sufficient once
 * this runs multi-instance (a shared store like Redis would be the real
 * fix at that point).
 *
 * Only failed attempts count toward the limit (recordFailedAttempt) — a
 * legitimately succeeding sign-in never increments the counter. That is
 * both the correct security posture (throttle brute-force guessing, not
 * repeated successful logins) and avoids penalizing a user who simply
 * signs in often.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function isLockedOut(key: string): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return false;
  if (Date.now() >= bucket.resetAt) {
    buckets.delete(key);
    return false;
  }
  return bucket.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count += 1;
}
