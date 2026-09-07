import { describe, expect, it } from "vitest";
import { explainExerciseSelection } from "./explainSelection";

describe("explainExerciseSelection", () => {
  it("calls out a primary-muscle match for the session", () => {
    const reason = explainExerciseSelection("push", ["mid_chest", "triceps"], []);
    expect(reason).toMatch(/Primary driver/);
    expect(reason).toMatch(/mid chest/);
  });

  it("falls back to a secondary-muscle explanation when there is no primary overlap", () => {
    const reason = explainExerciseSelection("push", ["lats"], ["triceps"]);
    expect(reason).toMatch(/Secondary carryover/);
    expect(reason).toMatch(/triceps/);
  });

  it("falls back to a generic volume explanation when neither overlaps the session", () => {
    const reason = explainExerciseSelection("push", ["lats"], ["hamstrings"]);
    expect(reason).toMatch(/Rounds out/);
  });
});
