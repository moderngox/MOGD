import { describe, expect, it } from "vitest";
import { checkInInterpretationSchema } from "./checkInInterpretation";

describe("checkInInterpretationSchema", () => {
  it("accepts plain-language text with no digits", () => {
    const result = checkInInterpretationSchema.safeParse({
      summary: "Your trend is tracking close to plan.",
      encouragement: "Nice consistency this week.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a summary containing a digit", () => {
    const result = checkInInterpretationSchema.safeParse({
      summary: "You are down 2 kg this month.",
      encouragement: "Keep going.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an encouragement containing a digit", () => {
    const result = checkInInterpretationSchema.safeParse({
      summary: "Steady progress.",
      encouragement: "3 weeks in a row now!",
    });
    expect(result.success).toBe(false);
  });
});
