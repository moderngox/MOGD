import { describe, expect, it } from "vitest";
import { deriveWeeklyVolumeTargets } from "./volumeTargets";
import { CANONICAL_MUSCLE_GROUPS } from "../physique/muscles";

describe("deriveWeeklyVolumeTargets", () => {
  it("gives every canonical muscle group a target", () => {
    const targets = deriveWeeklyVolumeTargets("intermediate", []);
    for (const muscle of CANONICAL_MUSCLE_GROUPS) {
      expect(targets[muscle]).toBeGreaterThan(0);
    }
  });

  it("boosts priority muscles above the base for that experience level", () => {
    const targets = deriveWeeklyVolumeTargets("intermediate", ["lateral_deltoids"]);
    expect(targets.lateral_deltoids).toBeGreaterThan(targets.biceps);
  });

  it("scales base volume up with experience", () => {
    const beginner = deriveWeeklyVolumeTargets("beginner", []);
    const advanced = deriveWeeklyVolumeTargets("advanced", []);
    expect(advanced.quadriceps).toBeGreaterThan(beginner.quadriceps);
  });
});
