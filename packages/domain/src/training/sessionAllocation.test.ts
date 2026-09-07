import { describe, expect, it } from "vitest";
import { allocateSession } from "./sessionAllocation";
import type { CatalogExercise } from "./candidatePool";
import type { CanonicalMuscleGroup } from "../physique/muscles";

let counter = 0;
function mockExercise(overrides: Partial<CatalogExercise>): CatalogExercise {
  counter += 1;
  return {
    id: `id-${counter}`,
    canonicalId: `exercise_${counter}`,
    name: `Exercise ${counter}`,
    movementPattern: "push",
    difficulty: "intermediate",
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    hypertrophyScore: null,
    strengthScore: null,
    fatigueScore: null,
    stabilityDemand: null,
    defaultRepMin: null,
    defaultRepMax: null,
    contraindicationTags: [],
    instructions: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("allocateSession", () => {
  it("uses the duration tier's exercise count, not a linear scale", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      mockExercise({
        canonicalId: `push_${i}`,
        primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[],
      }),
    );

    const result30 = allocateSession({
      sessionLabel: "push",
      candidates,
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 30,
    });
    const result90 = allocateSession({
      sessionLabel: "push",
      candidates,
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 90,
    });

    expect(result30).toHaveLength(3);
    expect(result90).toHaveLength(6);
    // Never "16 exercises for 90 minutes" — a small number with more sets,
    // not more novelty.
    expect(result90.length).toBeLessThan(10);
  });

  it("prioritizes exercises targeting muscles with a higher weekly volume target", () => {
    const highPriority = mockExercise({
      canonicalId: "lateral_raise",
      primaryMuscles: ["lateral_deltoids"] as CanonicalMuscleGroup[],
    });
    const lowPriority = mockExercise({
      canonicalId: "generic_push",
      primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[],
    });

    const result = allocateSession({
      sessionLabel: "push",
      candidates: [lowPriority, highPriority],
      weeklyVolumeTargets: {
        lateral_deltoids: 23,
        upper_chest: 10,
      } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 30,
    });

    expect(result[0]?.canonicalId).toBe("lateral_raise");
  });

  it("respects an exercise's own configured rep range over the goal-derived default", () => {
    const configured = mockExercise({
      primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[],
      defaultRepMin: 6,
      defaultRepMax: 8,
    });

    const result = allocateSession({
      sessionLabel: "push",
      candidates: [configured],
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 30,
    });

    expect(result[0]).toMatchObject({ repMin: 6, repMax: 8 });
  });

  it("falls back to a hypertrophy rep range when trainingBias favors hypertrophy", () => {
    const unconfigured = mockExercise({ primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[] });
    const result = allocateSession({
      sessionLabel: "push",
      candidates: [unconfigured],
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.8, strength: 0.2 },
      sessionDurationMinutes: 30,
    });
    expect(result[0]).toMatchObject({ repMin: 8, repMax: 12 });
  });

  it("falls back to a strength rep range when trainingBias favors strength", () => {
    const unconfigured = mockExercise({ primaryMuscles: ["quadriceps"] as CanonicalMuscleGroup[] });
    const result = allocateSession({
      sessionLabel: "legs",
      candidates: [unconfigured],
      weeklyVolumeTargets: { quadriceps: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.2, strength: 0.8 },
      sessionDurationMinutes: 30,
    });
    expect(result[0]).toMatchObject({ repMin: 4, repMax: 6 });
  });

  it("keeps sets within the configured min/max per exercise", () => {
    const candidates = Array.from({ length: 3 }, (_, i) =>
      mockExercise({ canonicalId: `ex_${i}`, primaryMuscles: ["quadriceps"] as CanonicalMuscleGroup[] }),
    );
    const result = allocateSession({
      sessionLabel: "legs",
      candidates,
      weeklyVolumeTargets: { quadriceps: 18 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 120,
    });
    for (const allocated of result) {
      expect(allocated.sets).toBeGreaterThanOrEqual(2);
      expect(allocated.sets).toBeLessThanOrEqual(5);
    }
  });

  it("is deterministic: identical inputs produce identical output", () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      mockExercise({ canonicalId: `ex_${i}`, primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[] }),
    );
    const args = {
      sessionLabel: "push" as const,
      candidates,
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 45,
    };
    expect(allocateSession(args)).toEqual(allocateSession(args));
  });
});
