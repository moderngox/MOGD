import { describe, expect, it } from "vitest";
import { selectSplit, SESSION_MUSCLE_MAP } from "./splitTemplates";

describe("selectSplit", () => {
  it("uses full_body for 1-3 sessions/week with matching session count", () => {
    expect(selectSplit(1)).toEqual({ splitType: "full_body", sessions: ["full_body"] });
    expect(selectSplit(3).sessions).toHaveLength(3);
    expect(selectSplit(3).sessions.every((s) => s === "full_body")).toBe(true);
  });

  it("uses upper_lower alternating for 4 sessions/week", () => {
    expect(selectSplit(4)).toEqual({
      splitType: "upper_lower",
      sessions: ["upper", "lower", "upper", "lower"],
    });
  });

  it("uses push_pull_legs_upper_lower for 5 sessions/week", () => {
    expect(selectSplit(5).sessions).toEqual(["push", "pull", "legs", "upper", "lower"]);
  });

  it("uses two push/pull/legs cycles for 6 and 7 sessions/week", () => {
    expect(selectSplit(6).sessions).toEqual(["push", "pull", "legs", "push", "pull", "legs"]);
    expect(selectSplit(7).sessions).toEqual(["push", "pull", "legs", "push", "pull", "legs"]);
  });

  it("clamps out-of-range input instead of producing zero or negative sessions", () => {
    expect(selectSplit(0).sessions.length).toBeGreaterThan(0);
    expect(selectSplit(10).sessions.length).toBeLessThanOrEqual(6);
  });
});

describe("SESSION_MUSCLE_MAP", () => {
  it("covers push and pull with no overlapping primary emphasis", () => {
    const overlap = SESSION_MUSCLE_MAP.push.filter((m) => SESSION_MUSCLE_MAP.pull.includes(m));
    expect(overlap).toEqual([]);
  });

  it("every session label maps to at least one muscle group", () => {
    for (const muscles of Object.values(SESSION_MUSCLE_MAP)) {
      expect(muscles.length).toBeGreaterThan(0);
    }
  });
});
