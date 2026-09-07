/**
 * Simple 1-5 Likert scale for hunger/energy/recovery (docs/ARCHITECTURE.md
 * §17 names these fields without specifying a scale) — a provisional,
 * reasonable default like the rest of this codebase's illustrative
 * choices, not a validated instrument.
 */
export const LIKERT_OPTIONS = [1, 2, 3, 4, 5] as const;
export type LikertRating = (typeof LIKERT_OPTIONS)[number];

export const PHOTO_ANGLE_OPTIONS = ["front", "side"] as const;
export type ProgressPhotoAngle = (typeof PHOTO_ANGLE_OPTIONS)[number];
