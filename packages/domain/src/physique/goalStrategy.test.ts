import { describe, expect, it } from "vitest";
import { compileGoalStrategy } from "./goalStrategy";

describe("compileGoalStrategy", () => {
  it("matches docs/ARCHITECTURE.md §5's worked example for recomposition", () => {
    const strategy = compileGoalStrategy({
      primaryGoal: "recomposition",
      physiquePriorities: ["shoulders"],
    });
    expect(strategy.energyDirection).toBe("slight_deficit");
    expect(strategy.trainingBias).toEqual({ hypertrophy: 0.75, strength: 0.25 });
  });

  it("orders shoulders priority with lateral deltoids first, per docs/PRODUCT.md §8", () => {
    const strategy = compileGoalStrategy({
      primaryGoal: "recomposition",
      physiquePriorities: ["shoulders"],
    });
    expect(strategy.priorityMuscles[0]).toBe("lateral_deltoids");
  });

  it("deduplicates muscles shared across multiple priorities", () => {
    const strategy = compileGoalStrategy({
      primaryGoal: "muscle_gain",
      physiquePriorities: ["back", "arms"],
    });
    const unique = new Set(strategy.priorityMuscles);
    expect(unique.size).toBe(strategy.priorityMuscles.length);
  });

  it("maps 'balanced' to an empty priority list", () => {
    const strategy = compileGoalStrategy({
      primaryGoal: "strength",
      physiquePriorities: ["balanced"],
    });
    expect(strategy.priorityMuscles).toEqual([]);
  });

  it("gives fat_loss a deficit and muscle_gain a surplus", () => {
    expect(
      compileGoalStrategy({ primaryGoal: "fat_loss", physiquePriorities: ["legs"] })
        .energyDirection,
    ).toBe("deficit");
    expect(
      compileGoalStrategy({ primaryGoal: "muscle_gain", physiquePriorities: ["legs"] })
        .energyDirection,
    ).toBe("surplus");
  });

  it("biases strength goal training toward strength over hypertrophy", () => {
    const strategy = compileGoalStrategy({ primaryGoal: "strength", physiquePriorities: [] });
    expect(strategy.trainingBias.strength).toBeGreaterThan(strategy.trainingBias.hypertrophy);
  });
});
