import { describe, expect, it } from "vitest";
import { computeProgressionTarget } from "./progression";

describe("computeProgressionTarget", () => {
  it("suggests starting within the configured range when there's no prior data", () => {
    const target = computeProgressionTarget({
      previousLoadKg: null,
      previousReps: null,
      repMin: 8,
      repMax: 12,
      movementPattern: "push",
    });
    expect(target.targetLoadKg).toBeNull();
    expect(target).toMatchObject({ targetRepMin: 8, targetRepMax: 12 });
  });

  it("adds a rep at the same load when below the rep ceiling", () => {
    const target = computeProgressionTarget({
      previousLoadKg: 30,
      previousReps: 10,
      repMin: 8,
      repMax: 12,
      movementPattern: "push",
    });
    expect(target).toMatchObject({ targetLoadKg: 30, targetRepMin: 11, targetRepMax: 12 });
  });

  it("increases load and restarts the rep range once the ceiling is reached", () => {
    const target = computeProgressionTarget({
      previousLoadKg: 30,
      previousReps: 12,
      repMin: 8,
      repMax: 12,
      movementPattern: "push",
    });
    expect(target.targetLoadKg).toBeGreaterThan(30);
    expect(target).toMatchObject({ targetRepMin: 8, targetRepMax: 12 });
  });

  it("uses a larger load increment for squat/hinge/carry patterns than other patterns", () => {
    const squat = computeProgressionTarget({
      previousLoadKg: 100,
      previousReps: 5,
      repMin: 3,
      repMax: 5,
      movementPattern: "squat",
    });
    const isolation = computeProgressionTarget({
      previousLoadKg: 100,
      previousReps: 5,
      repMin: 3,
      repMax: 5,
      movementPattern: "isolation",
    });
    const squatIncrement = squat.targetLoadKg! - 100;
    const isolationIncrement = isolation.targetLoadKg! - 100;
    expect(squatIncrement).toBeGreaterThan(isolationIncrement);
  });

  it("never targets more reps than the configured ceiling", () => {
    const target = computeProgressionTarget({
      previousLoadKg: 30,
      previousReps: 11,
      repMin: 8,
      repMax: 12,
      movementPattern: "push",
    });
    expect(target.targetRepMin).toBeLessThanOrEqual(target.targetRepMax);
    expect(target.targetRepMax).toBe(12);
  });
});
