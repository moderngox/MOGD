import { describe, expect, it } from "vitest";
import { allocateSession } from "./sessionAllocation";
import type { EligibleExercise } from "./candidatePool";
import type { ProgrammingProfile } from "../exercises/programmingProfiles";
import type { CanonicalMuscleGroup } from "../physique/muscles";
import { SESSION_ROLE_OPTIONS } from "../exercises/options";

let counter = 0;
let profileCounter = 0;

function mockProfile(overrides: Partial<ProgrammingProfile> = {}): ProgrammingProfile {
  profileCounter += 1;
  return {
    id: `profile-${profileCounter}`,
    exerciseId: "",
    traineeLevel: "intermediate",
    enabled: true,
    isInheritedDefault: false,
    setsMin: 2,
    setsMax: 5,
    repsMin: 6,
    repsMax: 10,
    rirMin: 1,
    rirMax: 3,
    restSecondsMin: 75,
    restSecondsMax: 120,
    prescriptionType: "rir",
    progressionType: "double_progression",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockExercise(
  overrides: Partial<Omit<EligibleExercise, "programmingProfile">> & {
    programmingProfile?: Partial<ProgrammingProfile>;
  } = {},
): EligibleExercise {
  counter += 1;
  const { programmingProfile, ...exerciseOverrides } = overrides;
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
    contraindicationTags: [],
    instructions: null,
    isActive: true,
    // Permissive by default so tests exercise real role-assignment branches
    // instead of always hitting the unconfigured fallback.
    allowedSessionRoles: [...SESSION_ROLE_OPTIONS],
    preferredSessionRole: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    programmingProfile: mockProfile(programmingProfile),
    ...exerciseOverrides,
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

  it("takes the rep range from the exercise's resolved programming profile", () => {
    const configured = mockExercise({
      primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[],
      programmingProfile: { repsMin: 6, repsMax: 8 },
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

  it("takes the RIR range from the resolved programming profile, independent of trainingBias", () => {
    const configured = mockExercise({
      primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[],
      programmingProfile: { rirMin: 0, rirMax: 2 },
    });

    const result = allocateSession({
      sessionLabel: "push",
      candidates: [configured],
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.2, strength: 0.8 },
      sessionDurationMinutes: 30,
    });

    expect(result[0]).toMatchObject({ rirMin: 0, rirMax: 2 });
  });

  it("keeps sets within the resolved profile's own min/max, not a global constant", () => {
    const candidates = Array.from({ length: 3 }, (_, i) =>
      mockExercise({
        canonicalId: `ex_${i}`,
        primaryMuscles: ["quadriceps"] as CanonicalMuscleGroup[],
        programmingProfile: { setsMin: 3, setsMax: 4 },
      }),
    );
    const result = allocateSession({
      sessionLabel: "legs",
      candidates,
      weeklyVolumeTargets: { quadriceps: 18 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 120,
    });
    for (const allocated of result) {
      expect(allocated.sets).toBeGreaterThanOrEqual(3);
      expect(allocated.sets).toBeLessThanOrEqual(4);
    }
  });

  it("prefers a candidate that is a known relationship of the reference exercise", () => {
    const related = mockExercise({
      canonicalId: "related_exercise",
      primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[],
    });
    const unrelated = mockExercise({
      canonicalId: "unrelated_exercise",
      primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[],
    });

    const result = allocateSession({
      sessionLabel: "push",
      candidates: [unrelated, related],
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 30,
      relatedExerciseIds: new Set([related.id]),
    });

    expect(result[0]?.canonicalId).toBe("related_exercise");
  });

  it("assigns 'main' to the only exercise in a 1-exercise session", () => {
    const only = mockExercise({ primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[] });
    const result = allocateSession({
      sessionLabel: "push",
      candidates: [only],
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 30,
    });
    expect(result.map((e) => e.sessionRole)).toEqual(["main"]);
  });

  it("assigns 'main' and 'finisher' in a 2-exercise session, no 'accessory'", () => {
    const candidates = Array.from({ length: 2 }, (_, i) =>
      mockExercise({ canonicalId: `ex_${i}`, primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[] }),
    );
    const result = allocateSession({
      sessionLabel: "push",
      candidates,
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 30,
    });
    expect(result.map((e) => e.sessionRole)).toEqual(["main", "finisher"]);
  });

  it("assigns 'main' first, 'finisher' last, and 'accessory' in between for 3+ exercises", () => {
    const candidates = Array.from({ length: 3 }, (_, i) =>
      mockExercise({ canonicalId: `ex_${i}`, primaryMuscles: ["upper_chest"] as CanonicalMuscleGroup[] }),
    );
    const result = allocateSession({
      sessionLabel: "push",
      candidates,
      weeklyVolumeTargets: { upper_chest: 14 } as Record<CanonicalMuscleGroup, number>,
      trainingBias: { hypertrophy: 0.75, strength: 0.25 },
      sessionDurationMinutes: 30,
    });
    expect(result.map((e) => e.sessionRole)).toEqual(["main", "accessory", "finisher"]);
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
