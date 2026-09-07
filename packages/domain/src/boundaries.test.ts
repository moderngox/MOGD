import { describe, expect, it } from "vitest";
import * as domain from "./index";

describe("domain package boundaries", () => {
  it("exposes exactly the M0-scoped module boundaries", () => {
    expect(Object.keys(domain).sort()).toEqual(
      [
        "adaptation",
        "assessment",
        "checkins",
        "exercises",
        "nutrition",
        "physique",
        "programs",
        "progress",
        "safety",
        "training",
        "users",
      ].sort(),
    );
  });
});
