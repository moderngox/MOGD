import { describe, expect, it } from "vitest";
import { checkEligibility } from "./eligibility";

describe("checkEligibility", () => {
  it("accepts an adult male", () => {
    expect(checkEligibility({ sex: "male", age: 25 })).toEqual({
      eligible: true,
      reasons: [],
    });
  });

  it("rejects a female with a male-only reason", () => {
    const result = checkEligibility({ sex: "female", age: 25 });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(["MOGᴰ is a male-only product in this version."]);
  });

  it("rejects a minor with an age reason", () => {
    const result = checkEligibility({ sex: "male", age: 16 });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(["You must be 18 or older to use MOGᴰ."]);
  });

  it("accumulates both reasons when both gates fail", () => {
    const result = checkEligibility({ sex: "female", age: 16 });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(2);
  });

  it("treats exactly 18 as eligible", () => {
    expect(checkEligibility({ sex: "male", age: 18 }).eligible).toBe(true);
  });
});
