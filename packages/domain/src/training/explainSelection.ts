import type { CanonicalMuscleGroup } from "../physique/muscles";
import type { SessionLabel } from "./splitTemplates";
import { SESSION_MUSCLE_MAP } from "./splitTemplates";

/**
 * PRODUCT.md §14's "why this exercise" — a plain-language restatement of the
 * same muscle-overlap facts allocateSession() already scored on
 * (docs/domain/training/sessionAllocation.ts's muscleRelevance term), not a
 * new decision. Pure and computed on read: no persistence, so it can never
 * drift from the exercise catalog or diverge into an AI-authored reason for
 * a deterministic selection (CLAUDE.md rule 4).
 */
export function explainExerciseSelection(
  sessionLabel: SessionLabel,
  primaryMuscles: string[],
  secondaryMuscles: string[],
): string {
  const sessionMuscles = new Set(SESSION_MUSCLE_MAP[sessionLabel]);
  const label = (m: string) => m.replaceAll("_", " ");

  const primaryMatches = (primaryMuscles as CanonicalMuscleGroup[]).filter((m) =>
    sessionMuscles.has(m),
  );
  if (primaryMatches.length > 0) {
    return `Primary driver for ${primaryMatches.map(label).join(", ")} — a focus of this session.`;
  }

  const secondaryMatches = (secondaryMuscles as CanonicalMuscleGroup[]).filter((m) =>
    sessionMuscles.has(m),
  );
  if (secondaryMatches.length > 0) {
    return `Secondary carryover for ${secondaryMatches.map(label).join(", ")}.`;
  }

  return "Rounds out this session's overall volume.";
}
